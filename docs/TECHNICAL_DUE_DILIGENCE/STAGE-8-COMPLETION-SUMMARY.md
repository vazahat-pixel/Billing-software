# Stage 8 — Commercial Release, Production Certification & Desktop ERP Launch

**Date:** 18 Jul 2026  
**Status:** Engineering complete (Sprints 8.1–8.11)  
**API root:** `/api/stage8/*`  
**Product version:** **1.0.0**

---

## Delivered

| Sprint | Outcome |
|---|---|
| **8.1** | Business flow certification (sales/purchase/inventory/job/GST/accounting signals) |
| **8.2** | QA smoke harness + regression inventory |
| **8.3** | UI/UX checklist (toast/confirm/themes already enforced) |
| **8.4** | Electron desktop shell (`desktop/`) |
| **8.5** | NSIS installer config + auto-update stub |
| **8.6** | Customer guides under `docs/guides/` |
| **8.7** | Online/offline license activation, devices, renew/upgrade, checksum fix |
| **8.8** | Welcome wizard + quick setup (< 15 min) |
| **8.9** | Release records, semver 1.0.0, CHANGELOG |
| **8.10** | Commercial certification (gate **85**) → v1.0 RC approval |
| **8.11** | Enterprise Testing Platform — zero-regression gates (gate **95**), unit/API/security/isolation/recon, Playwright, k6, CI quality gate |

---

## Activate

```http
GET  /api/stage8/overview
POST /api/stage8/onboarding/quick-setup
POST /api/stage8/license/activate
POST /api/stage8/certification/run
POST /api/stage8/testing/certify
GET  /api/stage8/testing/dashboard
POST /api/stage8/release/ensure-v1
```

FE: **v1.0** · **QA Cert** · Utilities → Commercial Release / Enterprise Testing Platform / Welcome Wizard

See: `STAGE-8.11-ENTERPRISE-TESTING-PLATFORM.md`

Desktop:
```bash
cd frontend && npm run build
cd desktop && npm install && npm run dist:win
```

---

## Compatibility

- No business module rewrites
- Stages 2–7 APIs unchanged
- License schema extended additively
