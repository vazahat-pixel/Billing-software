# Administrator Guide

- Manage tenants, plans, licenses from `/admin`.
- Feature flags: Admin → Dynamic Config.
- Security: `/api/stage7/security/config` — password policy, session limits.
- Backups: schedule via onboarding or Stage 7 backup APIs.
- Multi-company: super_admin uses `X-Company-Id`.
- Never share `JWT_SECRET` or backup encryption keys.
