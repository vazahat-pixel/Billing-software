# Installation Guide

## Web / Server
1. Install Node 20+, MongoDB 7+.
2. Copy `backend/.env.example` → `backend/.env` and set `JWT_SECRET`, `MONGO_URI`.
3. `cd backend && npm ci && npm start`
4. `cd frontend && npm ci && npm run build` (serve `dist` or use Vite).

## Docker
```bash
docker compose up -d
```

## Desktop (Windows)
1. Build frontend: `cd frontend && npm run build`
2. `cd desktop && npm install && npm run dist:win`
3. Run the NSIS installer from `desktop/dist/`.

Silent install (NSIS): `TextileERP-Setup-1.0.0.exe /S`
