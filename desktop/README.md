# Textile ERP — Standalone Offline Desktop

**1 PC = 1 company.** Electron embeds a local MongoDB + Express API so the full ERP runs without internet.

## Architecture

```
┌──────────────────────────────────────────┐
│ Electron (Windows)                       │
│  React UI  →  http://127.0.0.1:PORT/api  │
│  portable mongod  +  Node Express API    │
│  Data: %APPDATA%/Textile ERP/data/mongo  │
└──────────────────────────────────────────┘
```

IndexedDB is **not** the system of record in desktop-local mode (cache disabled for large lists).

## Prerequisites (dev)

- Node 20+
- MongoDB available as `mongod` on PATH **or** run `node desktop/scripts/fetch-mongodb.cjs` once
- Backend deps: `cd backend && npm install`

## Development

```bash
# Terminal A — optional if you rely on embedded stack from Electron
cd backend && npm run dev

# Terminal B — Vite UI
cd frontend && npm run dev

# Terminal C — Electron (boots local mongod+API when mode=local)
cd desktop && npm install && npm start
```

First launch opens **Activate** (`/activate`): import the Super-Admin provisioning pack, set owner password, then login. Public signup/`/setup` company self-creation is disabled on desktop.

**Pack signing:** desktop and Web Super Admin must share the same `PROVISIONING_PACK_SECRET` (or `JWT_SECRET`). Generate packs from Admin → Companies → provisioning pack download.

## Production Windows installer

```bash
# 1) Fetch MongoDB Community binaries (SSPL) into desktop/vendor/mongodb
node desktop/scripts/fetch-mongodb.cjs

# 2) Ensure backend node_modules exist (copied into resources)
cd backend && npm install --omit=dev && cd ..

# 3) Build UI + NSIS
cd desktop
npm install
npm run dist:win
```

Installer output: `desktop/dist/TextileERP-Setup-*.exe`

### Extra resources packaged

- `vendor/mongodb/**` — portable `mongod`
- `backend/**` — Express API (with node_modules)
- Renderer UI under `renderer/`

## Backup / restore

In the app: **File → Backup data…** / **Restore data…**  
Zips `%APPDATA%/Textile ERP` (mongo data + config + jwt secret).

## Remote API mode (optional)

Edit `%APPDATA%/Textile ERP/config.json`:

```json
{
  "mode": "remote",
  "apiBaseUrl": "https://your-api.example.com/api"
}
```

Restart the app. Standalone offline requires `"mode": "local"`.

## Smoke test

```bash
cd desktop
node scripts/smoke-local-boot.js
```

## Licence note

Bundled MongoDB Community is under the **Server Side Public License (SSPL)**. See `vendor/mongodb/LICENSE-NOTICE.txt` after fetch.
