#!/bin/bash
# Run on EC2 as root after release tarball is extracted to /opt/sitropix-portal
set -euxo pipefail

APP_DIR=/opt/sitropix-portal
cd "$APP_DIR"

if [[ ! -f .env ]]; then
  echo "Missing $APP_DIR/.env — copy deploy/env.production.example and fill secrets."
  exit 1
fi

# Ensure production URLs for unified host (idempotent append)
grep -q '^APP_URL=https://app.sitropix.com' .env 2>/dev/null || cat >> .env <<'ENV'

# --- production overrides (deploy) ---
NODE_ENV=production
HOST=127.0.0.1
API_SERVER_PORT=8790
PORT=8790
APP_URL=https://app.sitropix.com
API_URL=https://app.sitropix.com
VITE_API_BASE_URL=
STRIPE_SUCCESS_URL=https://app.sitropix.com/billing
STRIPE_CANCEL_URL=https://app.sitropix.com/subscription
CLIENT_DOCUMENTS_DIR=/opt/sitropix-portal/data/client-documents
ENV

npm install --omit=dev
npm run prisma:generate
npx prisma migrate deploy
if [[ ! -f dist/index.html ]]; then
  echo "dist/ missing — run npm run build:prod on the deploy machine before publish."
  exit 1
fi

chown -R ec2-user:ec2-user "$APP_DIR" /var/log/sitropix-portal
mkdir -p "$APP_DIR/data/client-documents"

install -m 644 deploy/sitropix-portal.service /etc/systemd/system/sitropix-portal.service
systemctl daemon-reload
systemctl enable sitropix-portal
systemctl restart sitropix-portal

systemctl enable nginx
systemctl restart nginx

if ! grep -q "ssl_certificate" /etc/nginx/conf.d/sitropix-portal.conf 2>/dev/null; then
  certbot --nginx -d app.sitropix.com --non-interactive --agree-tos --register-unsafely-without-email || true
fi

systemctl status sitropix-portal --no-pager || true
curl -sf http://127.0.0.1:8790/api/health || true
