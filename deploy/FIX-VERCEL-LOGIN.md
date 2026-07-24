# Fix Vercel login (API HTML / CORS / env)

## Why login fails

Public URLs like `billing-software-frontend.vercel.app` and `textile-erp.vercel.app` currently return **HTML** for `/api/...` (SPA fallback), not the Express API. The app then posts to `/api/auth/login` and gets a webpage → login breaks.

Also: the GitHub-connected deploy may show **Vercel SSO** (“Authentication Required”) so normal users cannot open Production.

## Fix in Vercel Dashboard (do this once)

Open the project that is linked to **vazahat-pixel/Billing-software** (not an old CRA / ByteSync project).

### 1) Project settings
- **Root Directory:** leave **empty** (repo root) so root `vercel.json` builds **frontend + `api/index.js`**
- Do **not** set Root Directory to `frontend` only (that drops the API)

### 2) Environment variables (Production)
| Name | Value |
|------|--------|
| `NODE_ENV` | `production` |
| `MONGO_URI` | your Atlas connection string |
| `JWT_SECRET` | random string **≥ 32 characters** (not `your_super_secret_jwt_key_here`) |
| `FRONTEND_URL` | your exact site URL, e.g. `https://YOUR-PROJECT.vercel.app` (no trailing slash) |

Redeploy after saving env vars.

### 3) Turn off Deployment Protection (for public login)
**Settings → Deployment Protection** → disable **Vercel Authentication** on Production (or allow public access). Otherwise browsers hit SSO instead of your login page.

### 4) Confirm API is real JSON
After deploy, open:

`https://YOUR-PROJECT.vercel.app/api/health`

You must see JSON like `{ "success": true, ... }`, **not** an HTML page.

Then try login with seeded users (only if that DB was seeded):
- `user@textileerp.com` / `User@123`
- `admin@textileerp.com` / `Admin@123`

### 5) If API stays on a VPS / Render instead
Set build env on Vercel:

`VITE_API_URL` = `https://YOUR-API-HOST/api`

Rebuild frontend so axios does not call same-origin `/api`.

## Quick checklist
- [ ] Correct Vercel project (this GitHub repo)
- [ ] Root = repo root (`vercel.json` with frontend + api)
- [ ] `MONGO_URI` + strong `JWT_SECRET` + `FRONTEND_URL`
- [ ] `/api/health` returns JSON
- [ ] Deployment Protection off for public users
- [ ] Seed users exist in that Mongo DB
