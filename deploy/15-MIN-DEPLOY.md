# 15-minute deploy — Frontend hosting + Backend VPS

Replace these before you start:

| Placeholder | Example |
|-------------|---------|
| `YOUR_FRONTEND_DOMAIN` | `https://billing.yourdomain.com` |
| `YOUR_API_DOMAIN` | `https://api.yourdomain.com` |
| `VPS_IP` | `203.0.113.10` |

---

## Minute 0–2 — Prepare secrets (on your PC)

```powershell
# Generate JWT secret (32+ chars)
-join ((48..57) + (65..90) + (97..122) | Get-Random -Count 40 | ForEach-Object {[char]$_})
```

Save:

- `JWT_SECRET` = that string  
- `FRONTEND_URL` = `https://YOUR_FRONTEND_DOMAIN` (no trailing slash)  
- `VITE_API_URL` = `https://YOUR_API_DOMAIN/api`

---

## Minute 2–10 — Backend on VPS

### Option A — Docker (fastest)

SSH into VPS, then:

```bash
# Need: Docker + Docker Compose
git clone <YOUR_REPO_URL> Billing-software
cd Billing-software

export JWT_SECRET='paste-your-40-char-secret-here'
export FRONTEND_URL='https://YOUR_FRONTEND_DOMAIN'

docker compose up -d --build
curl http://127.0.0.1:5000/health/ready
```

Point DNS `api.yourdomain.com` → `VPS_IP`, then install nginx TLS (see `deploy/nginx-api.conf`).

Seed admin (first time only):

```bash
docker compose exec api node seed.js
```

### Option B — Node + PM2 (no Docker)

```bash
# Need: Node 20+, MongoDB 7+ (local or Atlas)
git clone <YOUR_REPO_URL> Billing-software
cd Billing-software/backend
cp .env.example .env
nano .env   # set production values below
npm ci
npm run migrate
node seed.js
npx pm2 start ../deploy/ecosystem.config.cjs
npx pm2 save
npx pm2 startup
```

`backend/.env` production values:

```env
NODE_ENV=production
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/billing_software
JWT_SECRET=paste-your-40-char-secret-here
FRONTEND_URL=https://YOUR_FRONTEND_DOMAIN
```

---

## Minute 10–14 — Frontend on hosting

On your Windows PC:

```powershell
cd c:\Users\admin\Desktop\Billing-software\frontend

# Create production env (overwrite .env for this build)
@"
VITE_API_URL=https://YOUR_API_DOMAIN/api
"@ | Set-Content -Encoding utf8 .env.production.local

npm ci
npm run build
```

Upload **everything inside** `frontend/dist/` to your host’s `public_html` (or site root).

Also upload `deploy/frontend.htaccess` as `.htaccess` in that same folder (Apache shared hosting).

For Cloudflare Pages / Netlify: drag-drop the `dist` folder (SPA fallback is usually automatic).

---

## Minute 14–15 — Verify

1. Open `https://YOUR_API_DOMAIN/health/ready` → should be OK  
2. Open `https://YOUR_FRONTEND_DOMAIN` → login/signup loads  
3. Soft-refresh `/login` → must not 404 (SPA rewrite works)  
4. Login with seeded admin (check `seed.js` output / docs)

---

## DNS checklist

| Record | Type | Value |
|--------|------|-------|
| Frontend host | A / CNAME | hosting provider |
| `api` subdomain | A | `VPS_IP` |

Firewall on VPS: open **80** and **443** only (proxy to 5000). Do not expose Mongo publicly.

---

## Common failures

| Symptom | Fix |
|---------|-----|
| CORS error in browser | `FRONTEND_URL` must match SPA origin exactly |
| API calls go to localhost | Rebuild frontend with correct `VITE_API_URL` |
| `/login` 404 on refresh | Missing `.htaccess` / SPA rewrite |
| API won’t start | `JWT_SECRET` &lt; 32 chars or missing `MONGO_URI` |
| Health ready 503 | Mongo not running / wrong `MONGO_URI` |
