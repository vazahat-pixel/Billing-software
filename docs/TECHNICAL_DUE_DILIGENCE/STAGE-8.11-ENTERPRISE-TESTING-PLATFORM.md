# Stage 8.11 — Enterprise Automated Business Certification & Zero Regression Testing Platform

**Date:** 18 Jul 2026  
**Status:** Engineering complete  
**API root:** `/api/stage8/testing/*`  
**Production gate:** **95%**

---

## Objective

Certify every deployment before release:

| Gate | Rule |
|------|------|
| Business flows | Must pass |
| Accounting | Debit == Credit, no orphan ledgers |
| Inventory | No negative stock / reservation overflow |
| GST | Component math + sample invoice integrity |
| Multi-company | Zero cross-tenant leakage |
| Security | Auth, sanitize, helmet, rate-limit |
| Performance | Latency budgets / k6 harness |
| Overall | Production score ≥ **95%** |

Any critical gate failure → **DEPLOY BLOCKED**.

---

## Platform layout

```
backend/
  services/enterpriseTestingPlatformService.js
  services/certifiers/
    qualityGates.js
    accountingCertifier.js
    inventoryCertifier.js
    gstCertifier.js
    multiCompanyCertifier.js
    securityCertifier.js
    apiCoverageCertifier.js
    desktopCertifier.js
    performanceCertifier.js
    offlineCertifier.js
    visualA11yCertifier.js
  tests/
    unit/           # GST, totals, inventory helpers
    certification/  # gates + certifier self-checks
    integration/    # core billing flow
    security/       # JWT, injection, spoofing
    isolation/      # Company A ↛ Company B
    api/            # routeManifest + GET coverage
  performance/k6/   # load-smoke + load-stress
  scripts/certify/  # runCertification + runQualityGates

frontend/
  e2e/smoke.spec.js | keyboard.spec.js | visual.spec.js | offline.spec.js
  pages/commercial/EnterpriseTestingDashboard.jsx
```

---

## API

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/stage8/testing/catalog` | Test types, suites, tools |
| GET | `/api/stage8/testing/dashboard` | Scores + latest run + scaffold |
| GET | `/api/stage8/testing/scaffold` | Artifact health |
| GET | `/api/stage8/testing/gates` | Quality gate definitions |
| POST | `/api/stage8/testing/certify` | Full certification run |
| GET | `/api/stage8/testing/latest` | Latest run |
| GET | `/api/stage8/testing/runs` | History |

FE: **QA Cert** toolbar · Utilities → **Enterprise Testing Platform**

---

## NPM scripts (backend)

```bash
npm run test:unit
npm run test:integration
npm run test:certification
npm run test:security
npm run test:isolation
npm run test:api
npm run test:ci
npm run certify          # full platform cert (Mongo required)
npm run certify:gates    # CI deploy gate
npm run perf:k6:smoke    # requires k6 binary
npm run perf:k6:stress
```

Frontend:

```bash
npm run test:e2e:smoke
npm run test:e2e:keyboard
npm run test:e2e:visual
npm run test:e2e:cert
```

---

## CI pipeline

```
PR / push
  → backend-unit (unit + certification)
  → backend-integration (integration, API, security, isolation, offline)
  → frontend-build (+ lint soft)
  → frontend-e2e-smoke (soft)
  → quality-gate (blocks docker deploy)
  → docker-build (push only, after gate)
```

---

## Acceptance mapping

| Criterion | Implementation |
|-----------|----------------|
| 95%+ critical unit coverage target | GST / sales / purchase / inventory unit suites |
| 100% transactional API groups | Expanded `routeManifest.js` (≥35 routes) + API cert tests |
| Business flow automation | Integration core flow + Stage 8.1 flow certifier |
| Financial / inventory / GST reconcile | Dedicated certifiers in platform run |
| Visual / a11y harness | Playwright visual + keyboard specs |
| Multi-company isolation | Automated isolation suite |
| Desktop verified | Desktop certifier (Electron scaffold) |
| CI blocks on failure | `quality-gate` job + `certify:gates` |
| Production score ≥ 95% | `PRODUCTION_GATE = 95` |

---

## Compatibility

- Additive to Stage 8.1–8.10
- No business module rewrites
- Commercial certification (8.10) remains available at `/api/stage8/certification/*`
