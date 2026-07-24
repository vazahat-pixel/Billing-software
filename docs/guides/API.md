# API Documentation (Commercial surface)

## Auth
- `POST /api/auth/login` → `token`, `refreshToken`, `sessionId`
- `POST /api/auth/refresh`
- `POST /api/auth/logout` / `logout-all`

## Stage 8
- `GET /api/stage8/overview`
- `GET /api/stage8/flows/certify`
- `POST /api/stage8/qa/smoke`
- `POST /api/stage8/license/activate`
- `POST /api/stage8/onboarding/quick-setup`
- `POST /api/stage8/certification/run`

Full Stage 2–7 APIs remain under `/api/stage2` … `/api/stage7`.
