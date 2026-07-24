# Release notes — Stage 7 Infrastructure
## 1.7.0 — Enterprise Security, Infrastructure, Performance & DevOps

### Security
- Helmet CSP, rate limits, mongo sanitize, upload validation
- Password policy, account lockout, refresh token rotation
- Session revoke / logout-all / force logout

### Infrastructure
- Mongo connection pooling, slow-query debug flag
- In-memory cache (+ optional Redis)
- Mongo-backed job queues with retry / DLQ
- Encrypted local backups (AES-256-GCM), RTO/RPO policy
- `/health`, `/health/live`, `/health/ready`, `/metrics`
- Docker + Compose + CI docker build
- Graceful shutdown on SIGTERM/SIGINT

### API
- `/api/stage7/*` operations surface
- Auth: `/api/auth/refresh`, `/logout`, `/logout-all`
