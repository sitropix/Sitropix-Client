#!/bin/bash
# Bootstrap Amazon Linux 2023 for unified Sitropix portal (API + static on one Node process).
set -euxo pipefail
exec > /var/log/sitropix-user-data.log 2>&1

dnf update -y
dnf install -y git nginx certbot python3-certbot-nginx tar gzip

# Node.js 20 LTS
curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
dnf install -y nodejs
node -v
npm -v

id ec2-user &>/dev/null || useradd -m ec2-user
mkdir -p /opt/sitropix-portal /var/log/sitropix-portal
chown -R ec2-user:ec2-user /opt/sitropix-portal /var/log/sitropix-portal

# Nginx → Node (single app; no separate frontend host)
cat > /etc/nginx/conf.d/sitropix-portal.conf <<'NGINX'
server {
    listen 80;
    server_name app.sitropix.com;

    client_max_body_size 25m;

    location / {
        proxy_pass http://127.0.0.1:8790;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
NGINX

systemctl enable nginx
systemctl start nginx

echo "Sitropix EC2 bootstrap complete. Deploy app bundle to /opt/sitropix-portal and start sitropix-portal.service."
