# Sprint 1.3 — API Standardization & Frontend ↔ Backend Integration

**Version:** 1.0 · **Date:** 15 Jul 2026 · **Stage:** Foundation Stabilization  
**Role lens:** Principal API Architect / Integration Specialist  
**Constraint honored:** No UI redesign · No new business features · Business algorithms unchanged · Backward-compatible envelopes

---

## Verdict

| Metric | Score |
|---|---|
| Sprint Completion | **72 / 100** |
| Production API Readiness | **68 / 100** |
| Module Integration (weighted avg) | **74 / 100** |
| Frontend API Coverage | **88 / 100** |
| Backend API Coverage (envelope + REST) | **70 / 100** |
| Integration Matrix Completeness | **92 / 100** |
| Acceptance criteria fully met | **No** (honest gaps below) |

Sprint 1.3 **establishes the production communication spine**: every live page/store path goes through centralized `frontend/src/api/*` services; list/dashboard KPIs are server-computed; HTTP client retries GETs only; mutating financial POSTs never auto-retry. Full “every table is server-paginated / every envelope identical” remains multi-sprint with Sprint 1.4.

---

## 1. API Audit Report

### Architecture (canonical)

```
Page / Modal
  → Zustand (useStore / useAdminStore)
    → api/{domain}.api.js
      → http.js (envelope unwrap)
        → api/client.js (Axios singleton)
          → /api/...
            → thin controller → service → model/repo → MongoDB
```

**Rule:** Pages must not import Axios. Allowed client touches outside services: `ApiLoader` (loading bus), `loginService` / `syncQueue` (offline infra), `utils/api.js` (re-export shim).

### Frontend service inventory

| Module file | Responsibility |
|---|---|
| `auth.api.js` | login, register, me, forgot/reset password |
| `party.api.js` | party CRUD + search |
| `item.api.js` | item CRUD + search |
| `purchase.api.js` | purchase list/create/status/delete (+ intended PUT) |
| `sales.api.js` | sales list/create/status/delete (+ intended PUT) |
| `inventory.api.js` | lots, stock, opening |
| `jobwork.api.js` | issue / receive / process / list |
| `accounting.api.js` + `ledger.api.js` | vouchers, TB, P&L, BS, outstanding, statement |
| `gst.api.js` | GSTR-1/2, CA dashboard |
| `report.api.js` | report registers / bundle |
| `dashboard.api.js` | `GET /dashboard/summary` |
| `admin.api.js` + `subscription.api.js` | SaaS admin / license / config |
| `masters.api.js` | books, config, users, visits, orders, returns, notes, submasters |
| `http.js` | envelope normalize, `asArray`, pagination helpers |
| `client.js` | JWT, request-id, GET retry once, no mutate retry |
| `index.js` | barrel — prefer `import { … } from '../api'` |

### Backend additions this sprint

| Endpoint | Purpose |
|---|---|
| `GET /api/dashboard/summary` | Server KPIs: sales/purchase today, cash receipts today, receivable, payable, low stock, tops, month totals |

Sales/purchase list controllers return **`data` as array** + **`meta.pagination`** `{ page, limit, total, totalPages }`.

### Critical remaining API gaps

| Gap | Severity | Notes |
|---|---|---|
| `PUT /api/purchases/:id` missing | **P0** | FE `updatePurchase` / `purchasesApi.update` call it; BE only has `PUT /:id/status` |
| `PUT /api/sales/:id` missing | **P0** | Same pattern as purchase |
| Many masters/list endpoints still return unpaginated arrays | P1 | Parties/items/inventory/jobs |
| Auth register/login still raw `{ token, user }` (no envelope) | P2 | `http.unwrap` tolerates both |
| Admin config payloads mixed envelope vs raw | P2 | Unwrapped safely |
| Deprecated `GET /api/ledgers/*` still mounted | P1 | Deprecation headers present (1.2); FE ledgerApi prefers accounting |

---

## 2. Endpoint Standardization Report

### Adopted REST shape

| Resource | List | Get | Create | Update | Delete | Notes |
|---|---|---|---|---|---|---|
| Parties | `GET /parties` | `GET /parties/:id` | `POST /parties` | `PUT /parties/:id` | `DELETE /parties/:id` | + `GET /parties/search` |
| Items | `GET /items` | `GET /items/:id` | `POST /items` | `PUT /items/:id` | `DELETE /items/:id` | + search |
| Purchases | `GET /purchases` | `GET /purchases/:id` | `POST /purchases` | ❌ full · ✅ status | `DELETE /purchases/:id` | |
| Sales | `GET /sales` | `GET /sales/:id` | `POST /sales` | ❌ full · ✅ status | `DELETE /sales/:id` | |
| Jobs | `GET /jobs` | — | issue/receive | `PUT /jobs/process` | — | Domain verbs retained |
| Accounting ledgers | `GET /accounting/ledgers` | statement | `POST /accounting/ledgers` | — | — | |
| Dashboard | `GET /dashboard/summary` | — | — | — | — | **New** |
| Admin companies | `GET /admin/companies` | configs | `POST /admin/company` | put/lock | — | Nested resource style |

### Envelope standard (target)

```json
{
  "success": true,
  "message": "",
  "data": {},
  "meta": {},
  "errors": []
}
```

Pagination (list):

```json
{
  "success": true,
  "data": [],
  "meta": {
    "pagination": { "page": 1, "limit": 50, "total": 120, "totalPages": 3 }
  }
}
```

**Status:** Core tenant CRUD controllers (sales, purchase, party, item, gst, dashboard) use `apiResponse`. Auth + some admin/legacy routes still mix shapes; FE `http.request` normalizes both.

### HTTP status map (policy)

| Code | Use |
|---|---|
| 200 | OK / list / update status |
| 201 | Created |
| 400 | Validation |
| 401 | Auth |
| 403 | Permission / company |
| 404 | Not found |
| 409 | Duplicate |
| 422 | Business rule (`AppError`) |
| 500 | Unexpected |

---

## 3. Integration Matrix (Sprint 1.3 delta)

Canonical full matrix remains `15-INTEGRATION-MATRIX.md`. Delta after this sprint:

| Screen | Component | Store | API module | Route | Status |
|---|---|---|---|---|---|
| Dashboard KPIs | `Dashboard.jsx` | `fetchDashboardSummary` | `dashboardApi.summary` | `GET /dashboard/summary` | ✅ **New — server computed** |
| Sales Billing | `SalesModal` | `useStore` | `salesApi` | `/sales` | ✅ via store services |
| Purchase Bill | `PurchaseModal` | `useStore` | `purchasesApi` | `/purchases` | ✅ create/list; ⚠️ edit PUT missing on BE |
| Account / Item / Book masters | masters modals | `useStore` | `partiesApi` / `itemsApi` / `booksApi` | matching | ✅ |
| Job work | Issue/Receive/Update | `useStore` | `jobworkApi` | `/jobs/*` | ✅ |
| Accounting vouchers | `AccountingForms` | `fetchVouchers` / create* | `accountingApi` | `/accounting/*` | ✅ |
| Fiscal Registry (orphan page) | `AccountingPage` | + `accountingApi` | ledgers | ✅ **no raw axios** |
| Ledger modal | `LedgerModal` | config + statement APIs | `accountingApi` | ✅ (Sprint 1.1+) |
| Reports hub | `ReportsHub` | — | `reportApi` | `/reports/*` | ✅ aggregations server-side |
| GST GSTR-1 / CA | GST modals | — | `gstApi` | `/gst/*` | ✅ |
| GSTR-2B | GST modal | purchases | store / purchases | ✅ live ERPs only (no fake match) |
| Visit Log | `VisitLogModal` | + `visitsApi.create` | `/visits` | ✅ **page axios removed** |
| Auth signup / forgot | auth pages | — | `authApi` | `/auth/*` | ✅ |
| Admin company/users/modules/dynamic config | admin pages | `useAdminStore` + `adminApi` | `/admin/*` | ✅ **page axios removed** |
| Data Records Hub | `DataRecordsHub` | store cache | *(reuse list APIs via store)* | ⚠️ no dedicated paginated records API |
| Utilities menu | Dashboard | toast.unavailable | — | ⚠️ intentionally non-API until Utilities stage |

---

## 4. Frontend API Coverage

| Area | Coverage | Evidence |
|---|---|---|
| Live ERP modals via store | **~95%** | `useStore` migrated off string `api.` paths (62 replacements) |
| Admin screens | **100%** of prior direct axios | CompanyConfig, UserManagement, DynamicConfig, ModuleControl |
| Auth screens | **100%** | Login path + Signup + ForgotPassword via `authApi` |
| Page-level Axios in `pages/` | **0** remaining imports of `utils/api` / `api/client` | Grep clean |
| Dropdown data | **Mostly** | Loaded via store bootstrap (`parties`, `items`, `books`, ledgers) |
| Tables · server pagination | **Partial** | Sales/purchase list APIs support meta; UI often still client filters store arrays |
| Dashboard cards | **Yes** | Wired to `dashboardSummary` |
| Business calc in React | **Reduced for KPIs** | Outstanding/receivable/payable from summary; GST line math still client-trusted on save (pre-existing — not rewritten) |

---

## 5. Backend API Coverage

| Area | Status |
|---|---|
| Feature modules mounted | Auth, parties, items, sales, purchases, inventory, jobs, accounting, gst, reports, books, users, visits, orders, returns, notes, submasters, admin, config, **dashboard** |
| Thin controllers + envelope | sales, purchase, party, item, gst, dashboard |
| Permission middleware (soft) | parties/items/sales/purchase |
| Company isolation | Global JWT SoT |
| Full update (PUT body) sales/purchase | **Missing** |
| Uniform pagination all lists | **Partial** |
| Upload/export progress APIs | **Not standardized this sprint** |
| Remove dead purchase.* / ledgers | Deprecated only — delete in later cleanup |

---

## 6. Duplicate Endpoint Report

| Duplicate / alias | Live preferred | Action |
|---|---|---|
| `purchase.controller.js` + `purchase.service.js` + `Inventory` | `purchaseController` + `purchaseService` + `InventoryLot` | Keep `@deprecated`; do not mount |
| `GET /api/ledgers/:partyId` | `GET /api/accounting/ledgers` + statement | Deprecation headers; FE uses accounting |
| `pages/dashboard/Dashboard.jsx` | `pages/Dashboard.jsx` | Orphan UI — out of API scope |
| Multiple historical “savePurchase*” style names | Single `POST /purchases` | No new aliases introduced |

**No new duplicate endpoints** were added in 1.3. Dashboard summary is unique.

---

## 7. Unused Endpoint Report

| Endpoint / stack | Used by FE? | Note |
|---|---|---|
| `GET /ledgers/*` | Only via optional `ledgerApi.partyLedger` (prefer accounting) | Treat as unused by Dashboard shell |
| Dead purchase.* files | No | Unmounted |
| Admin pricing-rules / notifications / reports config routes | Not all wired in DynamicConfig UI | Available; partial UI |
| `GET /reports/*` individual registers | Hub uses bundle primarily; individuals exist for deeper screens | Keep |

---

## 8. Response Standardization Report

| Layer | Behavior |
|---|---|
| `utils/apiResponse.js` | `{ success, message, data, meta, errors }` |
| FE `http.request` | Reads envelope; if `data` absent, returns whole body (auth/admin compat) |
| FE `asArray` | Normalizes list shapes `{ sales\|purchases\|items\|… }` |
| FE store shim | Many actions still wrap as `{ data: { data } }` for offline helpers — transitional |

**Remaining inconsistency:** auth login/register, some admin GETs. Compatible via unwrap; gradual BE migration recommended without breaking token clients.

---

## 9. Module Integration Score

| Module | Score | Driver |
|---|---|---|
| Auth | 85 | Services + pages; raw envelope |
| Parties / Items | 88 | Full CRUD services |
| Purchase | 72 | Create/list/delete OK; **full update API gap** |
| Sales | 72 | Same as purchase |
| Inventory | 80 | List/opening connected; pagination weak |
| Job Work | 86 | Domain verbs via services |
| Accounting | 84 | Vouchers + reports APIs; orphan page fixed |
| GST | 78 | Server reports; client amounts on invoice still trusted |
| Reports | 82 | Bundle aggregation |
| Dashboard | 90 | New summary API |
| Admin / Subscription | 88 | Central `adminApi` |
| CRM Visits | 85 | visitsApi from modal + store |
| Utilities | 20 | Intentionally stubbed toasts |

**Weighted average ≈ 74.**

---

## 10. Remaining Integration Gaps (carry to 1.4+)

1. Implement `PUT /purchases/:id` and `PUT /sales/:id` (or change FE edit to cancel+recreate — product decision) **without inventing new tax rules**.
2. Server pagination plumbing through Records Hub / long tables.
3. Move remaining client GST/outstanding **display** math to aggregation endpoints where still local.
4. Delete or fully gate deprecated `/ledgers` and dead purchase files.
5. Standardize auth/admin responses to full envelope.
6. Upload/export progress + cancel/retry contract.
7. Offline queue architecture hooks only (no full sync product yet) — client already has queue shim.

---

## 11. Sprint Completion Report — Acceptance Checklist

| Criterion | Met? |
|---|---|
| Every live screen API-driven (or explicitly non-API with toast) | ⚠️ Mostly — Utilities still non-API by design |
| Every API one standard (REST + envelope) | ⚠️ Core yes; auth/admin partial |
| Every CRUD via centralized services | ✅ Live paths |
| Dropdowns dynamic from backend | ⚠️ Via store bootstrap (not every infinite-scroll search) |
| Tables server pagination | ❌ Incomplete |
| Dashboard cards from backend | ✅ |
| No component calls axios directly | ✅ `pages/` clean |
| No duplicate endpoints introduced | ✅ |
| Integration matrix documented | ✅ (this doc + prior 15) |
| FE/BE synchronized contracts | ⚠️ Except sales/purchase full PUT |
| Business logic unchanged | ✅ |
| UI not redesigned | ✅ |

**Sprint completion score: 72/100** — foundation for Sprint 1.4 (DB integrity) is ready; remaining items are explicit gaps, not hidden debt.

---

## 12. Production API Readiness Score — **68 / 100**

| Factor | Weight | Score | Notes |
|---|---|---|---|
| Single client + domain services | 20 | 18 | Done |
| Envelope + error middleware | 15 | 12 | Mixed auth/admin |
| AuthZ / tenant binding | 15 | 11 | Soft RBAC; isolation OK |
| Idempotent / no financial POST retry | 10 | 10 | Client `_noRetry` |
| Dashboard/report server compute | 10 | 8 | KPIs yes; GST save amounts still client |
| CRUD completeness | 15 | 9 | Update bills missing |
| Pagination / search platform | 10 | 5 | Partial |
| Docs / matrix | 5 | 5 | This report |

---

## Files touched (high level)

**Frontend:** `api/http.js`, `api/client.js`, `api/*.api.js`, `api/index.js`, `store/useStore.js`, `store/useAdminStore.js`, `Dashboard.jsx`, auth pages, VisitLog, admin pages, AccountingPage, ConfigContext, AccountingForms.

**Backend:** `dashboard.routes.js`, `dashboardController.js`, `dashboardService.js`, sales/purchase list pagination meta, route mount.

**Docs:** this file.

---

## Handoff to Sprint 1.4 — Database Stabilization & Transaction Integrity

1.4 owns persistence, indexing, atomic multi-document writes, and making purchase/sales **update/cancel** transactionally correct.  
1.3 leaves a **stable, single FE API surface** so 1.4 can change services without rewriting every modal.

**Recommended first 1.4 tickets:**

1. Purchase/sales full update or explicit “edit = reverse + recreate” policy implemented in **one** BE service path.  
2. Unique indexes + FY counters under race.  
3. Wrap return/job receive paths already known fragile in single Mongo sessions.
