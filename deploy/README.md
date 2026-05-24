# Sitropix portal — AWS EC2 (unified app)

Single EC2 instance runs **Vite build + Express API** on port `8790`. Nginx terminates HTTP/HTTPS and proxies to Node.

- **Domain:** `app.sitropix.com`
- **Instance name tag:** `Sitropix` (separate from `Sitropix_Backend`)
- **Type:** `t3.large`

## 1. Launch EC2

```powershell
.\deploy\launch-ec2.ps1
```

Creates instance + Elastic IP. Point DNS:

| Type | Name | Value |
|------|------|--------|
| A | `app` | Elastic IP from `deploy/last-launch.json` |

## 2. Production `.env`

On the server, `/opt/sitropix-portal/.env` must include at least:

- `NODE_ENV=production`
- `APP_URL=https://app.sitropix.com`
- `API_URL=https://app.sitropix.com`
- `DATABASE_URL` (same RDS as other Sitropix apps — EC2 uses `ec2-rds-1` SG)
- Strong `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET`
- Stripe + email keys

See `deploy/env.production.example`.

## 3. Deploy from your machine

```powershell
.\deploy\publish.ps1
```

Uses `Sitropix.pem` if found, otherwise EC2 Instance Connect (requires `InstanceId` in `last-launch.json`).

## 4. Stripe webhooks

In Stripe Dashboard, set webhook URL to:

`https://app.sitropix.com/api/webhooks/stripe`

## Manual SSH

```bash
ssh -i Sitropix.pem ec2-user@<public-ip>
sudo journalctl -u sitropix-portal -f
curl http://127.0.0.1:8790/api/health
```
