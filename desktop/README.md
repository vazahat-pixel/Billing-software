# Textile ERP Desktop

## Prerequisites
- Node 20+
- Backend API running (`backend`)
- Frontend built or Vite dev server

## Development
```bash
cd frontend && npm run dev
cd desktop && npm install && npm start
```

Set `ERP_DESKTOP_URL` to point at your ERP URL if needed.

## Production Windows installer
```bash
cd frontend && npm run build
cd desktop && npm install && npm run dist:win
```

Installer artifacts land in `desktop/dist/`.

## Auto-update
Configure `publish.url` in `electron-builder.yml` to your update CDN.
`updater.js` checks on startup when `electron-updater` is installed.

## Features
- System tray + hide-to-tray
- Native menu & shortcuts
- Desktop notifications bridge (`window.textileDesktop.notify`)
- Crash relaunch
- NSIS installer (desktop + start menu shortcuts)
