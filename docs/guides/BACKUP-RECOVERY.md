# Backup & Recovery Guide

**RTO target:** < 30 minutes · **RPO target:** < 15 minutes

## Backup
- Infra → Backups → Run Manual Backup (AES-256-GCM encrypted).
- Or `POST /api/stage7/backups`
- Retention: `BACKUP_RETENTION_DAYS` (default 30).

## Verify
`POST /api/stage7/backups/:id/verify`

## Preview restore point
`GET /api/stage7/backups/:id/preview`

## Recovery
1. Stop API writes.
2. Restore from verified `.bak` using ops runbook / Mongo restore of exported collections.
3. Restart API; run Stage 7 + Stage 8 certification.
