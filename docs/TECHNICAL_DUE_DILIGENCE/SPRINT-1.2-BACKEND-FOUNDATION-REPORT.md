# Sprint 1.2 — Backend Architecture Cleanup & Enterprise Foundation
**Version:** 1.0 · **Date:** 15 Jul 2026 · **Stage:** Foundation Stabilization

## Verdict

| Metric | Value |
|---|---|
| Sprint Completion Score | **64 / 100** |
| Production Readiness (backend foundation) | **58 / 100** |
| Business logic rewritten | **No** (preserved purchase/sales/job/accounting services) |
| API compatibility | **Preserved** (response now includes standard envelope fields) |

Full acceptance criteria (every controller thin, every model via repository, 80% tests) is multi-sprint. This sprint installs the **platform spine** so Sprint 1.3 (API standardization) and later stages plug in without redesign.

---

## What shipped

### Security & request pipeline (`server.js`)
- `helmet`
- `express-rate-limit` (global + auth bucket)
- `express-mongo-sanitize`
- JSON body limit `2mb`
- `X-Request-Id` middleware
- Structured request logger
- `/health` endpoint
- Upgraded global error middleware → standard `{ success, message, errorCode, errors, data, meta }`

### Middleware matrix

| Middleware | Path | Role |
|---|---|---|
| requestId | global | Trace ID |
| helmet | global | HTTP hardening |
| apiLimiter | global | Rate limit |
| cors | global | Origin allowlist |
| mongoSanitize | global | NoSQL injection |
| requestLogger | global | Access log |
| authLimiter | `/api/auth` | Brute-force dampening |
| authMiddleware | `/api/*` except auth | JWT |
| subscriptionMiddleware | `/api/*` | License/sub (bypass logged in development) |
| companyIsolationMiddleware | `/api/*` | Strip spoofed `companyId`; bind JWT tenant |
| featureGuard | module routes | Plan modules |
| requirePermission | parties/items/sales/purchase | Soft RBAC via PermissionMatrix |
| validate* | same | Input rules |
| errorHandler | last | Central errors |

### Repository layer added
`repositories/BaseRepository.js` + party, item, purchase, sales, inventoryLot, accountingEntry, job.

**Note:** Existing services still use Models directly (no algorithm rewrite). Repositories are the mandated path for **new** code and gradual migration.

### Thin controllers refactored
`salesController`, `purchaseController`, `partyController`, `itemController`, `gstController` → `asyncHandler` + `apiResponse` + JWT `companyId` only (no `query.companyId` fallback).

### Critical bug fix
`InventoryLot.source` enum now includes `'return'` — unblocks Sales Return stock restore (P0 from due diligence).

### Dead code marked
`purchase.controller.js` + `purchase.service.js` annotated `@deprecated DEAD` (still unmounted).  
`/api/ledgers` returns `Deprecation` / successor `Link` headers → use `/api/accounting/ledgers`.

### Other
- `constants/errorCodes.js`, `constants/statuses.js`
- `utils/AppError`, `asyncHandler`, `apiResponse`, `logger`
- `validators/index.js`
- `events/eventBus.js` + `socket/` placeholder
- Auth: prefer `X-Company-Id` for super-admin; log fallback oldest-company

---

## Dependency graph (request)

```
Client
  → helmet / rateLimit / cors / sanitize / requestId / logger
  → /api/auth (authLimiter) OR
  → auth → subscription → companyIsolation
  → featureGuard / requirePermission / validate
  → thin controller → service → (model | repository) → MongoDB
  → errorHandler
```

---

## Transaction status

| Flow | Atomic today? |
|---|---|
| Sales create (stock + JE) | Yes (`salesService` session) |
| Purchase create (lots + JE) | Yes (`purchaseService` session) |
| Job receive + accounting | Partial (accounting outside tx historically) — unchanged |
| Returns | Session present; enum now valid |

---

## Dead code report

| Artifact | Status |
|---|---|
| `controllers/purchase.controller.js` | Dead / marked deprecated |
| `services/purchase.service.js` | Dead / legacy Inventory |
| `models/Inventory.js` | Legacy only via dead service |
| `LedgerEntry` + `/api/ledgers` | Deprecated parallel books |
| `onGRNPost` accounting helpers | Still unused (not deleted — may return in Stage 3) |

---

## Remaining technical debt (Sprint 1.3+)

1. Migrate all remaining controllers to `asyncHandler` + standard envelope.
2. Move service Mongo calls onto repositories (party/item first).
3. Hard RBAC when matrix present (currently fail-open for missing matrix — intentional compat).
4. Server-side GST/tax recomputation (Stage 2/4).
5. Emit `eventBus` from sales/purchase after commit.
6. Attach Socket.IO gateway to eventBus.
7. Automated tests toward 80% coverage.
8. Physically delete / archive dead purchase.* files after confirmation.
9. Refresh tokens (Sprint security later).

---

## Regression risks

| Risk | Mitigation |
|---|---|
| Response shape has extra `meta`/`errors` | Frontend already tolerates `success`+`data` |
| companyId query param ignored | Intentional — JWT only; fix any clients spoofing query |
| PermissionMatrix deny surprises | Only denies when matrix **explicitly** false; owners/admins bypass |
| Rate limit in shared NAT | Tune `RATE_LIMIT_MAX` / `AUTH_RATE_LIMIT_MAX` |
| Development subscription bypass | Logged; set `ENFORCE_SUBSCRIPTION=true` to test |

---

## Production readiness score rationale (58 → foundation)

+ Security stack & rate limit (+12)  
+ Tenant isolation strip (+10)  
+ Error/response standardization (+8)  
+ Thin core controllers (+8)  
+ Repository + validators scaffolding (+8)  
+ Sales return enum fix (+6)  
− Full repo migration not done (−10)  
− Accounting/job controller still fat (−8)  
− Tests near zero (−12)  
− Soft RBAC / job accounting outside tx unchanged (−8)

---

## Sprint score (64)

Foundation complete enough to unlock Sprint 1.3 without redesign. Not “enterprise finished.”

## Recommended Sprint 1.3 focus

API Standardization & Integration — finish controller migration, OpenAPI-ish docs, pagination meta on list endpoints, wire repositories into party/item/sales services.
