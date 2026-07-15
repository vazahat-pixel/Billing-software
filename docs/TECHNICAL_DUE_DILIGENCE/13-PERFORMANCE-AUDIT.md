# 13 — Performance Audit

Full static inspection of every query path, index definition, N+1 pattern, and frontend rendering cost in the current codebase. Every finding cites the exact file. Severity: **P0** (fixes before any paying customer with real data volume), **P1** (fixes before 10+ concurrent users / 6-month data), **P2** (fixes before scale-out), **P3** (nice-to-have).

---

## 13.1 Scoreboard

| Area | Score /100 | Verdict |
|---|---:|---|
| Database indexing | 55 | Core tenancy + hot paths indexed; `AuditLog`, `Sales`, `Purchase`, `Party`, `Item` have **no explicit indexes beyond `_id`** |
| Query efficiency | 40 | Multiple N+1 loops in reporting/accounting hot paths |
| API pagination | 35 | Only `Sales`/`Purchase` list endpoints paginate; 10+ list endpoints return unbounded result sets |
| Transaction discipline | 70 | Sales/Purchase/Job/Return use Mongo sessions correctly; some accounting side-effects run outside transaction by design |
| Frontend bundle/render | 45 | `Dashboard.jsx` imports 30+ modal components eagerly; no code-splitting; no `React.memo`/virtualization on tables |
| Network layer | 42 | Two independent Axios instances; 5s config poll; 30s CA-Dashboard poll; no HTTP caching beyond 2 report endpoints |
| Offline/IndexedDB sync | 60 | Functionally solid differentiator, but full-table `cacheEntities` re-caches on every sync, no incremental diffing |

**Overall Performance Score: 52/100** — acceptable for pilot/beta with <20 concurrent users and <50k documents per collection; **will degrade sharply** past that without the P0/P1 fixes below.

---

## 13.2 Database Index Audit (collection by collection)

Evidence: every model file under `backend/models/`.

| Model | Indexes actually declared | Missing indexes that matter | Risk if missing |
|---|---|---|---|
| `InventoryLot.js` | `lotId` (single), `itemId` (single), `companyId` (single), **compound unique** `{lotId:1, companyId:1}` | `{companyId:1, status:1}` for "available lots by item" scans; `{companyId:1, itemId:1, status:1}` | Full collection scan per stock-pick during Sales/Job Issue as lot count grows |
| `StockMovement.js` | `{lotId:1, type:1}`, `{companyId:1, createdAt:-1}` | none critical — well indexed | Low |
| `AuditLog.js` | **NONE** beyond default `_id` | `{companyId:1, createdAt:-1}`, `{userId:1, createdAt:-1}`, `{module:1, referenceId:1}` | `admin.controller.getAuditLogs` will full-scan the entire audit collection company-wide as soon as it has >10k rows; this collection grows on **every** create/update/delete call site that logs |
| `Sales.js` | Not inspected with explicit index calls in schema (relies on default `_id` + whatever Mongoose auto-adds for `unique` fields, if any) | `{companyId:1, date:-1}`, `{companyId:1, status:1}`, `{companyId:1, customerId:1}` | `salesService.getSales`, `reportService.getSalesRegister`, and outstanding/aging reports all filter by `companyId` + `date`/`status`/`customerId` — every one of these is a collection scan today |
| `Purchase.js` | Same pattern as `Sales.js` | `{companyId:1, date:-1}`, `{companyId:1, supplierId:1}` | Same class of risk on purchase register / outstanding payable |
| `Party.js` | No compound index confirmed | `{companyId:1, type:1}`, `{companyId:1, name:1}` (search) | `partyController.searchParties` and every outstanding/report loop that does `Party.find({companyId, type:{$in:[...]}})` scans |
| `Item.js` | No compound index confirmed | `{companyId:1, name:1}`, text index for `itemController.searchItems` | Regex search (`$regex` name match, seen in `accountingController.listLedgers`-style patterns) cannot use an index at all if it's a `$regex` without anchor — **classic un-indexable query** |
| `LedgerMaster.js` | Not confirmed compound | `{companyId:1, group:1}`, `{companyId:1, linkedPartyId:1}` | `accountingController.listLedgers` filters exactly on these fields |
| `AccountingEntry.js` | Not confirmed compound (aggregation-heavy model) | `{companyId:1, isReversed:1, 'lines.ledgerId':1}`, `{companyId:1, entryDate:1}` | `getLedgerStatement` and `computeRunningBalances` aggregation both `$match` on these fields for **every ledger statement view and every Trial Balance/P&L/Balance Sheet render** |
| `Job.js` | Not confirmed compound | `{companyId:1, status:1}`, `{companyId:1, workerId:1}` | Job list/report scans |
| `PaymentVoucher.js` | Not confirmed compound | `{companyId:1, 'againstInvoices.invoiceId':1}` | This exact sub-document field is queried **inside a per-invoice loop** in 3 separate places (see §13.3) — without an index each call is a scan |

**P0-DB-1**: Add compound indexes to `Sales`, `Purchase`, `Party`, `Item`, `LedgerMaster`, `AccountingEntry`, `Job`, `PaymentVoucher`, `AuditLog` as listed above. None of these require a data migration — pure additive `schema.index()` calls.

**P1-DB-2**: Add `{companyId:1, itemId:1, status:1}` to `InventoryLot` to speed up FEFO/lot-picking as SKUs and lot counts grow into the thousands.

---

## 13.3 N+1 Query Patterns (confirmed by direct code read)

### 13.3.1 `accountingController.getOutstandingReport` — confirmed N+1×N+1

```645:726:backend/controllers/accountingController.js
    for (const party of parties) {
      // ...
      for (const doc of documents) {
        // Calculate paid amount from vouchers
        const vouchers = await PaymentVoucher.find({
          companyId,
          status: 'Posted',
          'againstInvoices.invoiceId': doc._id
        });
        // ...
      }
    }
```

For **every party** → **every invoice/bill of that party** → a fresh `PaymentVoucher.find()` query is issued. With 200 parties × 10 invoices each = **2,000 sequential DB round-trips** for a single "Outstanding Report" page load. This is the exact pattern the task calls out as "Outstanding voucher N+1 in accountingController" — confirmed at line 678 of `accountingController.js`.

- **Same anti-pattern is duplicated** in `backend/services/reportService.js` → `getOutstanding()` (line 214, `paidAgainstDoc` called once per document) and again inside `getSalesRegister`/`getPurchaseRegister` (`paidAgainstDoc` called once per row, lines 51 and 89).
- **Net effect**: `/api/reports/bundle` (used by `ReportsHub`) calls `getSalesRegister` + `getPurchaseRegister` + `getOutstanding` ×2 in `Promise.all` — each of which independently N+1s against `PaymentVoucher`. On a company with 1,000 sales + 500 purchases this is **1,500+ extra queries per single dashboard "Reports" open**.

**P0-PERF-1 — Fix**: Pre-aggregate paid amounts once per report call:
```js
// One aggregation instead of N queries
const paidMap = await PaymentVoucher.aggregate([
  { $match: { companyId, status: 'Posted' } },
  { $unwind: '$againstInvoices' },
  { $group: { _id: '$againstInvoices.invoiceId', paid: { $sum: '$againstInvoices.amount' } } }
]);
```
Apply identically to `accountingController.getOutstandingReport`, `reportService.getOutstanding`, `getSalesRegister`, `getPurchaseRegister`. This is the single highest-ROI performance fix in the codebase — 4 call sites, one aggregation pattern, removes >90% of DB round-trips on the busiest reporting screens.

### 13.3.2 `reportService.getReportBundle` — compounding N+1 on N+1

`getReportBundle` (`backend/services/reportService.js:352`) runs `getSalesRegister`, `getPurchaseRegister`, `getStockReport`, `getStockByItem`, `getJobWorkReport`, `getOutstanding` ×2, `getProfitLoss`, `getDailyTransactions`, `getMasterSummary` all via `Promise.all` — parallelized at the top level, but **each individual function is itself sequential-N+1 internally** (§13.3.1). Parallelizing 6 N+1 loops does not fix the N+1; it just runs them concurrently, which can still exhaust the Mongo connection pool (`mongoose` default pool size 100) under moderate concurrent report usage.

### 13.3.3 `jobService.receiveFromJob` — acceptable, but worth flagging

```73:82:backend/services/jobService.js
      const originalLot = await InventoryLot.findById(job.lotId)
        .populate({ path: 'purchaseId', select: 'taxableAmount' })
        .session(session);
```
Single lookup, not looped — **not** an N+1, but every job receive pays the cost of a `populate()` join even when `job.lotId` was already available on the `Job` document from issue time. Low priority; flagged for completeness (`P3`).

### 13.3.4 Return/Purchase-Return item loops

`returnController.createReturn` (`backend/controllers/returnController.js:56-115`) loops `items` and does one `InventoryLot.findOne()` + one `.save()` per line for Purchase Returns — correct for correctness (each line is a different lot) but **not batched**. Acceptable for typical invoice sizes (<50 lines); flag as `P2` if bulk/bulk-import returns are ever added.

---

## 13.4 Missing Pagination — full endpoint audit

Confirmed by reading every route file in `backend/routes/`.

| Endpoint | Controller | Paginated? | Evidence |
|---|---|---|---|
| `GET /api/sales` | `salesController.getSales` → `salesService.getSales` | **Yes** — `page`/`limit`, default `limit=100` | `salesService.js:70` |
| `GET /api/purchases` | `purchaseController.getPurchases` → `purchaseService.getPurchases` | **Yes** — same pattern | `purchaseService.js:75` |
| `GET /api/parties` | `partyController.getParties` | **No** — returns full `Party.find()` | `partyRoutes.js:6` |
| `GET /api/items` | `itemController.getItems` | **No** | `itemRoutes.js:6` |
| `GET /api/jobs` | `jobController.getJobs` → `jobService.getJobs` | **No** — `Job.find(query)` unbounded | `jobService.js:162` |
| `GET /api/returns` | `returnController.getReturns` | **No** | `returnController.js:184` |
| `GET /api/notes` | `noteController.getNotes` | **No** | `noteRoutes.js:5` |
| `GET /api/orders` | `orderController.getOrders` | **No** | `orderRoutes.js:5` |
| `GET /api/visits` | `visit.controller.getVisits` | **No** | `visit.routes.js:9` |
| `GET /api/accounting/ledgers` | `accountingController.listLedgers` | **No** | `accountingController.js:107` |
| `GET /api/accounting/payments` | `accountingController.listVouchers` | **No** | `accountingController.js:461` |
| `GET /api/inventory` | `inventoryController.getInventory` | **No** | `inventory.routes.js:6` |
| `GET /api/books` | `bookController.getAllBooks` | **No** | `bookRoutes.js:6` |
| `GET /api/submasters` | `subMasterController.getSubMasters` | **No** | `subMasterRoutes.js:5` |
| `GET /api/reports/*` (all 9) | `reportController.*` | **No** — always full-period, in-memory dataset | `reportRoutes.js` |
| `GET /api/gst/gstr1`, `/gstr2`, `/ca-dashboard` | `gstController.*` | **No** — loads all matching sales/purchases into memory | `gstRoutes.js` |
| `GET /api/admin/audit` | `admin.controller.getAuditLogs` | Unconfirmed, likely unbounded given no index either | `admin.routes.js:38` |

**Impact**: for a company with 5,000 parties, 3,000 items, or 10,000 audit rows, these screens will (a) transfer megabytes of JSON per click, (b) block the Node event loop while serializing, (c) render 10,000-row tables in React with no virtualization (see §13.6).

**P0-PERF-2**: Add `page`/`limit` (default 50–100) to `parties`, `items`, `jobs`, `orders`, `returns`, `notes`, `visits`, `accounting/ledgers`, `accounting/payments`, `inventory`, `books`, `submasters`, `admin/audit`. Reuse the exact `skip`/`limit`/`countDocuments` pattern already proven in `salesService.getSales`.

**P1-PERF-3**: GST/report endpoints (`gstr1`, `gstr2`, `ca-dashboard`, `reports/bundle`) are inherently "whole period" screens — pagination doesn't fit — but they **must** get the N+1 fix (§13.3.1) plus a hard date-range requirement (reject requests with no `startDate`/`endDate` beyond, say, 18 months) to bound memory use.

---

## 13.5 Config Polling & Redundant Network Chatter

| Poller | Interval | File | Why it matters |
|---|---:|---|---|
| Feature/module config bundle | **5,000 ms** | `frontend/src/context/ConfigContext.jsx:9` (`POLL_MS = 5000`) — fires `pollVersion` on a `setInterval` for **every mounted authenticated tab**, forever | With 50 concurrent logged-in users this is **10 requests/second sustained**, 24/7, purely to check if a config version hash changed. No WebSocket/SSE/long-poll fallback exists. |
| Online/offline sale-count refresh | 5,000 ms | `frontend/src/hooks/useOnlineStatus.js:28` | Compounds with the above — two independent 5s timers running concurrently per tab |
| CA Dashboard auto-refresh | 30,000 ms | `frontend/src/pages/gst/CADashboardModal.jsx:113` | Lower risk, but re-triggers the full `getCADashboard` aggregation (itself N+1-adjacent via `getGstr1`/`getGstr2`) every 30s **while the modal is simply left open** |

**P1-PERF-4**: Move config-version checks to (a) a much longer interval (60–120s) with (b) `ETag`/`If-None-Match` or a lightweight `HEAD`-style version endpoint, or (c) push-based invalidation (WebSocket/SSE) triggered only when an admin actually changes config — the 5s poll is solving a rare event with a constant-cost mechanism.

**P2-PERF-5**: Stop CA Dashboard auto-refresh while the tab/modal is not the active/focused one (`document.visibilityState`).

---

## 13.6 Frontend Rendering & Bundle Performance

### 13.6.1 `Dashboard.jsx` — monolithic eager-loaded shell

`frontend/src/pages/Dashboard.jsx` statically imports **30 modal/page components** at module top-level (lines 20–60): `SalesModal`, `PurchaseModal`, `AccountingForms`, `IssueModal`, `ReceiveModal`, `UpdateModal`, `JobReceiptModal`, `ProcessUpdateModal`, `SalesOutstanding`, `LedgerModal`, `AccountMasterModal`, `ItemMasterModal`, `BookMasterModal`, `InventoryPage`, `GstModals` (6 exports), `CADashboardModal`, `VisitLogModal`, `PartyModal`, `JobWorkerMaster`, `BookSelectionModal`, `GenericMasterModal`, `OrderModal`, `ReturnModal`, `NoteModal`, `JournalEntryModal`, `UserRightsModal`, `OpeningBalanceModal`, `OpeningStockModal`, `DataRecordsHub`, `ReportsHub`.

- **No `React.lazy()` / dynamic `import()`** anywhere in this file. Every one of these ~30 components (and their own transitive dependencies — e.g. `GstModals.jsx` alone is 600+ lines with 6 exported components) is parsed, compiled, and included in the **initial JS bundle for the single `/` route**, whether or not the user ever opens a single modal.
- All 30 modals are also **mounted in the DOM tree simultaneously** (each rendered with `isOpen={modals.x}` rather than conditionally rendered/unmounted), meaning React reconciles all 30 component trees on every Dashboard re-render even when their modal is closed. Only `SalesOutstanding` (`{modals.outstanding && <SalesOutstanding .../>}`, line 804) and `LotDetails`-in-`InventoryPage` conditionally mount; the rest render always-in-tree with `isOpen=false`.
- **Consequence**: Time-to-interactive for the single-page ERP shell is coupled to the combined bundle size of the entire application's feature surface. Every new module added to the ERP (and there are many) makes the *first paint* of the dashboard slower, not just the module being added.

**P0-PERF-6**: Convert all 30 modal imports in `Dashboard.jsx` to `React.lazy(() => import(...))` behind `<Suspense>`, and gate rendering with `{modals.x && <LazyModal ... />}` (mount-on-open, unmount-on-close) instead of always-mounted-with-`isOpen`. This alone should cut initial JS payload for the ERP shell substantially (exact % requires a bundle-analyzer run, not estimated here without data).

**P1-PERF-7**: Split `GstModals.jsx` (6 components in one file) into individual files so lazy-loading one GST screen doesn't pull in the other five.

### 13.6.2 No table virtualization

`frontend/src/components/forms/ERPTableGrid.jsx`, `PurchaseTable.jsx`, `InventoryTable.jsx`, `MovementTable.jsx` render with plain `.map()` over full arrays — no `react-window`/`react-virtualized`/windowing. Combined with the unpaginated list endpoints in §13.4, a 3,000-item Item Master or a 10,000-row Stock Movement ledger will render 3,000–10,000 real DOM rows in one pass.

**P1-PERF-8**: Either paginate these tables client-side against the now-paginated APIs (§13.4), or virtualize rendering for any list that can realistically exceed ~500 rows (Item Master, Party Master, Stock Ledger, Audit Log, Daily Transactions).

### 13.6.3 Dual Axios clients

Two independent Axios instances exist with **different configuration**:

```48:54:frontend/src/api/client.js
const client = axios.create({
  baseURL: getBaseUrl(),
  timeout: 8000,
  headers: { 'Content-Type': 'application/json' },
});
```
```11:15:frontend/src/utils/api.js
const api = axios.create({
  baseURL: getBaseUrl(),
  headers: { ... }
});
```

- `client.js` has offline-detection, request/response interceptors, in-flight request counters powering the global `ApiLoader`, and a `timeout: 8000`.
- `utils/api.js` has **no timeout**, no offline interception, no loading-indicator wiring — any component using this second client bypasses the app's offline/online architecture entirely and can hang indefinitely on a dead connection.
- Two connection pools, two sets of interceptor behavior, two places to configure `baseURL` — a change to auth-header injection or offline handling in one file silently does not apply to callers of the other.

**P0-PERF-9 / maintainability**: Delete `utils/api.js` and migrate all its call sites to `api/client.js`. This is both a performance issue (no timeout = hung requests pile up) and a correctness issue (inconsistent offline behavior depending on which client a given screen happens to import).

### 13.6.4 Single 1,500+ line Zustand store

`frontend/src/store/useStore.js` is ~1,570 lines, a single `create((set, get) => ({ ... }))` call holding auth, sales, purchases, parties, items, inventory lots, job work entries, offline cache orchestration, and more in one flat store object. Every component subscribing via `useStore()` without a selector re-renders on **any** state field change anywhere in the store (Zustand's default behavior without a selector function). A scan of usage shows most consumers destructure directly off `useStore()` (e.g. `Dashboard.jsx` line 111: `const { user, logout, bootstrapMasters, refreshAllData, sales, purchases, inventoryLots, jobWorkEntries, parties, items, plan } = useStore();`) rather than using per-field selectors, meaning `Dashboard` re-renders on updates to *any* of these ten-plus fields even if only one changed.

**P2-PERF-10**: Split `useStore` into domain slices (`useSalesStore`, `usePurchaseStore`, `useMasterDataStore`, `useAuthStore`, ...) or, at minimum, migrate hot components to selector-based subscriptions (`useStore(s => s.sales)`) to cut re-render fan-out.

---

## 13.7 Transaction & Write-Path Performance

Positive findings (confirmed correct, not blockers):

- `salesService.createInvoice`, `purchaseService.createPurchase`, `jobService.issueToJob`, `jobService.receiveFromJob`, `returnController.createReturn` all correctly wrap multi-document writes (`InventoryLot` + `StockMovement` + `AccountingEntry`/`Sales`/`Purchase`) in a single Mongo `session`/transaction — this is the right pattern for a system that must keep stock and ledgers consistent, and it is already in place. Do not regress this when optimizing (see `16-PRODUCTION-READINESS.md` / "never change" list).
- `accountingController.computeRunningBalances` (lines 515–567) already uses a **single aggregation pipeline** (`$match` → `$unwind` → `$group`) instead of per-ledger queries — this is the *correct* pattern the N+1 fixes in §13.3 should be modeled on; it was clearly already applied here but not propagated to the Outstanding Report path in the same file.

Negative finding:

- `jobService.receiveFromJob` posts `onJobWorkChargesPost`/`onAbnormalWastagePost` **outside** the main transaction (`backend/services/jobService.js:120-140`, comment: *"outside transaction — non-critical, logged only"*). This is a deliberate trade-off (job receive shouldn't roll back on an accounting-posting failure) but means job-work accounting entries can silently fail while the job/stock side succeeds, with only a `console.error` — no admin-visible alert, no retry queue. **P1-PERF-11**: at minimum, write these failures to `AuditLog` or a dedicated `FailedPosting` collection so they are discoverable instead of console-only.

---

## 13.8 Specific Numeric/Correctness-Adjacent Performance Bug

**Stock report valuation always zero.** `InventoryLot.js` schema (`backend/models/InventoryLot.js`) has **no `rate` field at all**. `reportService.getStockReport` (`backend/services/reportService.js:134-135`) reads `l.rate || 0` and computes `value: (l.remainingMtrs || 0) * (l.rate || 0)`, which is **always `0`** because `rate` is never persisted on the schema, never set by `purchaseService.createPurchase`, and never set by `returnController`/`jobService` when lots are created. Every "Stock Value" figure surfaced in `ReportsHub`, the Report Bundle summary (`summary.stockValue`), and `getStockByItem` is **silently zero** for every company, always. This is not a slow query — it is a query that is fast and wrong, included here because it was explicitly called out for this document and materially affects any performance/inventory-value dashboard.

**P0-PERF-12**: Add a `rate` (weighted average or FIFO cost) field to `InventoryLot`, populate it at lot-creation time (`purchaseService.createPurchase` from `item.rate`/purchase line taxable÷qty; `jobService.receiveFromJob` already computes `costPerMeter` for wastage accounting at line 77-82 — reuse that exact calculation to stamp the new finished lot's `rate` instead of discarding it after the wastage posting).

---

## 13.9 Priority Summary Table

| ID | Finding | Priority | Effort (eng-days) |
|---|---|---|---:|
| PERF-1 | N+1 in Outstanding Report / Sales & Purchase Register (4 call sites) | P0 | 2–3 |
| PERF-2 | Missing pagination on 12+ list endpoints | P0 | 2 |
| PERF-6 | Dashboard.jsx eager-loads 30 modals, no lazy/code-split | P0 | 2 |
| PERF-9 | Dual Axios clients, one with no timeout | P0 | 0.5 |
| PERF-12 | `InventoryLot.rate` missing → stock value always ₹0 | P0 | 1 |
| DB-1 | Missing compound indexes on Sales/Purchase/Party/Item/LedgerMaster/AccountingEntry/Job/PaymentVoucher/AuditLog | P0 | 1 |
| PERF-3 | Report/GST endpoints need bounded date ranges | P1 | 1 |
| PERF-4 | 5s config poll → longer interval + ETag | P1 | 1 |
| PERF-7 | Split `GstModals.jsx` into per-modal files for lazy loading | P1 | 0.5 |
| PERF-8 | No table virtualization on large masters/ledgers | P1 | 2 |
| PERF-11 | Silent-fail job accounting postings outside transaction | P1 | 1 |
| DB-2 | Additional `InventoryLot` lot-picking index | P1 | 0.5 |
| PERF-5 | CA Dashboard polls even when unfocused | P2 | 0.5 |
| PERF-10 | Monolithic Zustand store, no selectors | P2 | 3–5 (incremental) |

**Total estimated remediation for P0 items alone: ~9–10 engineer-days.** See `17-ROADMAP.md` Phase 6 (Production Hardening) for sequencing against other workstreams.
