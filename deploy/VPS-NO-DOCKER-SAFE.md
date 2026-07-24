# Billing API on VPS (alongside existing backends) — NO Docker

Use this when the server already runs 2–3 other backends.
This app must NOT reuse their ports, PM2 names, domains, or Mongo DB names.

---

## RULES (read once)

| Item | This project value | Why |
|------|--------------------|-----|
| PM2 name | `billing-api` | Must be unique |
| App port | `5010` | Avoids common `3000/5000/8000` used by others |
| Mongo DB name | `billing_software` | Separate database |
| Nginx site file | `billing-api` | Separate site config |
| Folder | `/opt/Billing-software` | Separate code path |
| Domain | your `api-billing...` subdomain | Separate from other APIs |

Do **not** change other apps’ `.env`, PM2, or nginx files.

---

## BEFORE YOU START — check what is already used

SSH in, then run:

```bash
pm2 list
ss -tlnp | grep -E ':(3000|4000|5000|5001|5010|8000|8080)\s'
ls /etc/nginx/sites-enabled/
```

- If port **5010** is free → keep `5010` below.
- If **5010** is taken → pick another free port (example `5011`) and use that everywhere instead of `5010`.

---

## STEP 1 — Install only what is missing

```bash
node -v          # need v20+
mongod --version # or: systemctl status mongod
nginx -v
pm2 -v
```

Install only missing pieces:

```bash
# Node 20 (skip if already installed)
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs build-essential

# PM2 (skip if already installed)
npm i -g pm2

# Nginx (skip if already installed)
apt install -y nginx

# MongoDB (skip if already running)
# Prefer using the SAME mongod already on the server — just a NEW database name.
systemctl status mongod
```

If Mongo is already running on this VPS, **do not reinstall**. Just use a new DB name in `MONGO_URI`.

---

## STEP 2 — Upload / clone project (new folder only)

```bash
mkdir -p /opt
# From your Windows PC (separate terminal):
# scp -r c:\Users\admin\Desktop\Billing-software root@SERVER_IP:/opt/Billing-software

cd /opt/Billing-software/backend
pwd
# must show: /opt/Billing-software/backend
```

---

## STEP 3 — Create THIS app’s `.env` only

```bash
nano /opt/Billing-software/backend/.env
```

Paste exactly (edit the 3 marked lines):

```env
NODE_ENV=production
PORT=5010
MONGO_URI=mongodb://127.0.0.1:27017/billing_software
JWT_SECRET=REPLACE_WITH_OPENSSL_SECRET
JWT_ACCESS_EXPIRES=8h
JWT_REFRESH_DAYS=30
FRONTEND_URL=https://YOUR_FRONTEND_DOMAIN
RATE_LIMIT_MAX=1000
BACKUP_DIR=./backups
LOG_LEVEL=info
```

Generate secret:

```bash
openssl rand -base64 32
```

Paste that into `JWT_SECRET=...`.

Save: `Ctrl+O`, Enter, `Ctrl+X`.

---

## STEP 4 — Install deps + seed (this folder only)

```bash
cd /opt/Billing-software/backend
npm ci
npm run migrate
node seed.js
```

Default admin after seed:
- Email: `admin@textileerp.com`
- Password: `Admin@123`

---

## STEP 5 — Start with PM2 (unique name)

```bash
cd /opt/Billing-software/backend
pm2 start server.js --name billing-api --time
pm2 save
```

Verify **only this** app:

```bash
pm2 show billing-api
curl http://127.0.0.1:5010/health/ready
```

Expected: JSON/OK response, not connection refused.

If fail:

```bash
pm2 logs billing-api --lines 50
```

---

## STEP 6 — Nginx for THIS API only (new site file)

```bash
nano /etc/nginx/sites-available/billing-api
```

Paste (change domain + port if needed):

```nginx
server {
    listen 80;
    server_name YOUR_API_DOMAIN;

    client_max_body_size 10m;

    location / {
        proxy_pass http://127.0.0.1:5010;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
    }
}
```

Enable **without touching** other sites:

```bash
ln -sf /etc/nginx/sites-available/billing-api /etc/nginx/sites-enabled/billing-api
nginx -t
systemctl reload nginx
```

DNS: create `A` record `YOUR_API_DOMAIN` → server IP. Wait 1–5 minutes.

HTTPS:

```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d YOUR_API_DOMAIN
```

Final check:

```bash
curl https://YOUR_API_DOMAIN/health/ready
```

---

## STEP 7 — Frontend must point to THIS API

On your PC, build frontend with this API URL (must end with `/api`):

```powershell
cd c:\Users\admin\Desktop\Billing-software
.\deploy\build-frontend.ps1 -ApiUrl "https://YOUR_API_DOMAIN/api"
```

Upload `deploy\frontend-dist\` to hosting.

Backend `.env` `FRONTEND_URL` must match the frontend site exactly (no trailing slash).

Then restart API once:

```bash
pm2 restart billing-api
```

---

## DO NOT DO

- Do not stop other PM2 apps (`pm2 stop all` is forbidden).
- Do not overwrite other nginx site files.
- Do not reuse another app’s port or domain.
- Do not set `PORT=5000` if another backend already uses 5000.
- Do not use Docker for this deploy.

---

## QUICK STATUS CHEATSHEET

```bash
pm2 status
pm2 logs billing-api --lines 100
curl http://127.0.0.1:5010/health/ready
curl https://YOUR_API_DOMAIN/health/ready
```

Restart only this backend:

```bash
pm2 restart billing-api
```

Update code later:

```bash
cd /opt/Billing-software
# pull or re-upload
cd backend
npm ci
npm run migrate
pm2 restart billing-api
```
