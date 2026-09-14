# Textile ERP — Desktop (Electron)

End-user Windows app for the MERN Textile ERP.  
UI runs inside Electron; **API stays on your server** (localhost or cloud).

## Architecture

```
┌─────────────────────┐         HTTPS / LAN          ┌──────────────────┐
│  Electron (Windows) │  ─────────────────────────►  │  Node API        │
│  React UI bundled   │     /api/...                 │  + MongoDB       │
└─────────────────────┘                              └──────────────────┘
```

Admin SaaS panel can stay **web-only**; users get the desktop installer.

## Prerequisites

- Node 20+
- Backend running (`cd backend && npm run dev`) — default `http://localhost:5000`
- MongoDB available to the backend

## 1) Development (hot reload UI)

Terminal A — API:
```bash
cd backend
npm run dev
```

Terminal B — Vite UI:
```bash
cd frontend
npm run dev
```

Terminal C — Electron shell:
```bash
cd desktop
npm install
npm start
```

Electron opens `http://localhost:5173` and uses API from `desktop/config.json` / userData  
(default `http://localhost:5050/api`).

## 2) Production Windows installer (for users)

```bash
# From repo root — build UI into desktop/renderer, then NSIS setup
cd desktop
npm install
npm run dist:win
```

Optional: bake a default API URL into the UI build:
```bash
set ERP_API_URL=https://your-api.example.com/api
npm run dist:win
```

Installer output:
`desktop/dist/TextileERP-Setup-1.0.0.exe`

## 3) After install — point app at your API

On the user PC open:

`%APPDATA%\Textile ERP\config.json`

```json
{
  "apiBaseUrl": "https://your-api.example.com/api"
}
```

Restart the app.  
Menu **File → API Settings…** shows the path.

## Features

- System tray (close hides to tray)
- Native menu + shortcuts
- Licence device binding (`window.textileDesktop.machineId`)
- Desktop notifications bridge
- Auto-update stub (`electron-updater` when publish URL is set)

## Notes

- Public web signup can stay disabled; create companies from **Admin**.
- Do **not** set `ALLOW_SUBSCRIPTION_BYPASS=true` on customer servers.
- Offline mode still uses the existing IndexedDB / sync queue in the frontend.
