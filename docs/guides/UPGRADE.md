# Upgrade Guide

1. Take a verified backup.
2. Pull release tag / install new desktop build.
3. Run `cd backend && npm run migrate`.
4. Restart API; clear FE cache / hard reload.
5. Run Stage 8 commercial certification.
6. If issues: rollback to `rollbackVersion` noted in release record.
