# Troubleshooting Guide

| Symptom | Check |
|---|---|
| Login fails / locked | Wait lockout window; reset password |
| Session revoked | Re-login; check single-session policy |
| CORS blocked | Set `FRONTEND_URL` |
| Mongo down | `/health/ready` |
| Offline sync stuck | Failed Sync modal → retry |
| License inactive | Commercial → License Activate |
| Slow API | Stage 7 Monitoring P95; indexes |

No browser `alert`/`confirm` — use ERP toast/confirm dialogs.
