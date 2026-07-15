# 16 — Production Readiness Report

**Launch Ready: NO.** **Estimated completion: 55–60%** of a commercially-sellable textile ERP. This document is the authoritative blocker/bug/priority list. Every item cites the exact file and line evidence gathered during static inspection.

---

## 16.1 P0 — Launch Blockers (must fix before ANY paying customer, no exceptions)

These are the 8 blockers named in the audit brief, each verified against source code, plus supporting detail.

### P0-1: Sales Return crashes — `InventoryLot.source` schema enum mismatch

- **Evidence**: `returnController.js` line 68 creates `new InventoryLot({ ..., source: 'return', ... })`. `InventoryLot.js` line 22 declares `source: { type: String, enum: ['purchase', 'opening', 'jobwork', 'job_receive'], default: 'purchase' }`. `'return'` is not a member of this enum.
- **Impact**: Every Sales Return submission will throw a Mongoose `ValidationError` inside the transaction, triggering `session.abortTransaction()` and a 500 response. The Sales Return feature, as shipped, cannot successfully complete for a single test case.
- **Fix**: One-line schema change — add `'return'` to the enum. Effort: 5 minutes + regression test. **This is the cheapest, highest-leverage fix in the entire audit and should ship same-day.**

### P0-2: No production RBAC enforcement on mutating APIs

- **Evidence**: `PermissionMatrix` model exists and is edited via `UserRightsModal.jsx` → `adminConfig.controller.js`, but a repo-wide search for `PermissionMatrix` usage shows it is read **only** by admin-config display/edit endpoints. `roleMiddleware` (`backend/middlewares/role.middleware.js`) exists and is applied **only** inside `admin.routes.js`. None of `salesRoutes.js`, `purchase.routes.js`, `accountingRoutes.js`, `partyRoutes.js`, `itemRoutes.js`, `jobRoutes.js`, `inventory.routes.js`, `returnRoutes.js`, `noteRoutes.js`, `orderRoutes.js` reference `roleMiddleware` or `PermissionMatrix` at all.
- **Impact**: Any authenticated user of a company — regardless of their configured role/permissions in `PermissionMatrix` — can call `POST /api/sales`, `DELETE /api/purchases/:id`, `POST /api/accounting/journal`, etc. directly (Postman, curl, browser devtools network replay) even if their UI-visible role says "view only." The frontend's `permissions.canSave`/`readOnlyMasters` checks (`utils/permissions.js`, used in `Dashboard.jsx`) are **UI affordances only**, not security boundaries.
- **Fix**: Build an Express middleware that loads `PermissionMatrix` for `req.user.companyRole` and checks `canCreate`/`canEdit`/`canDelete` against the target module before allowing mutating verbs through, applied to every tenant route. Estimated 5–8 engineer-days including test coverage across ~20 route files.

### P0-3: Billing amounts trusted from client without server recompute

- **Evidence**: `salesService.createInvoice` (`backend/services/salesService.js`) takes `salesData` directly from `req.body` (via `salesController.createInvoice`, which does `req.body.companyId = req.companyId` and passes the rest through unchanged) and persists `netAmount`, `taxableAmount`, `gstAmount`, `cgst`, `sgst`, `igst` as submitted — no server-side recomputation from item rate × quantity × item GST rate exists anywhere in `salesService.js` or `purchaseService.js`.
- **Impact**: Any user with API access (or a compromised/modified frontend build) can submit an invoice with a manipulated `netAmount` lower than the true taxable value of the goods, directly falsifying revenue and understating GST liability. This is both a **fraud/leakage risk** and a **legal GST-compliance risk** (filed returns would not match actual transaction value).
- **Fix**: Add a server-side tax engine (see `18-CTO-FINAL-REPORT.md` rewrite candidates) that recomputes taxable/GST/net from `items[].itemId` (fetch real `Item.gstRate`/rate) × `qty`/`mts`, and rejects or overrides mismatched client totals beyond a rounding tolerance. Estimated 5–8 engineer-days (shared with GST engine rebuild in Phase 3/4 of `17-ROADMAP.md`).

### P0-4: Balance Sheet / year-close not viable

- **Evidence**: No year-close, opening-balance-carry-forward, or period-rollover logic exists anywhere in `backend/` — confirmed by the complete absence of any "close year"/"carry forward" service function, and by the Utilities menu items `Closing / UnClosing Year`, `New A/c. Year (Auto/Manual)`, `Transfer To Next Year` all being `alert()` stubs in `Dashboard.jsx` (§16.4). `accountingController.getBalanceSheet` computes `isBalanced` purely from `computeRunningBalances` against **all-time** `AccountingEntry` records with no year-boundary concept.
- **Impact**: A company cannot legitimately close a financial year, carry forward balances, or produce a defensible year-end Balance Sheet. Multi-year usage will accumulate all transactions into one undifferentiated ledger.
- **Fix**: Design and build a year-close workflow (snapshot closing balances into new opening balances, lock the closed period via the existing `company.settings.lockedUntilDate` mechanism, archive/tag entries by financial year). This is a substantial accounting feature, not a bug fix — see Phase 3 in `17-ROADMAP.md`.

### P0-5: GST portal readiness — false-advertising risk if sold as "compliant"

- **Evidence**: (a) `gstService.getGstr1` produces a JSON export via `utils/gstExport.js` containing a literal string `hash: 'hash'` and an invented `version: 'GST3.2.2'` field — not validated against GSTN's actual GSTR-1 JSON schema. (b) `Gst2bMatchingModal` fabricates portal-comparison data entirely client-side (§16.5). (c) `Gst3bMonthlyModal`'s "File Return" button is a 2-second `setTimeout` simulation, not a real GSTN submission. (d) Interstate/intrastate GST split logic hardcodes Gujarat's state code (`gstin.startsWith('24')`) — incorrect for any non-Gujarat tenant.
- **Impact**: If marketed as "GST-compliant" or "portal-ready," this is a **legal and reputational liability** — customers relying on these exports/filings for actual government compliance could face real penalties.
- **Fix**: Either (a) formally validate and align GSTR-1/2/3B JSON export against the current GSTN schema and add a real GSP/portal integration, or (b) clearly label all GST screens as "for internal reconciliation only — file via your CA/portal" until real integration exists. See Phase 4 in `17-ROADMAP.md`.

### P0-6: Invoice prints show `DEMO_COMPANY`

- **Evidence**: `frontend/src/utils/invoiceHelpers.js` line 2: `export const DEMO_COMPANY = { name: 'MAHAVEER TEXTILES PVT. LTD.', ... }`. `InvoicePDFViewer.jsx` line 23: `company = DEMO_COMPANY` is the **default value** for the `company` prop.
- **Impact**: Any print/PDF/WhatsApp-share call site that does not explicitly pass a real `company` prop will silently render a demo company's name/address on a real customer's legal invoice document.
- **Fix**: Audit every call site of `InvoicePDFViewer`/`buildWhatsAppMessage` to confirm the real tenant's `Company` record is always explicitly passed; remove the hardcoded default or make it throw/warn instead of silently substituting. Estimated 1 engineer-day including verification.

### P0-7: Subscription bypass if `NODE_ENV` mis-set

- **Evidence**: `backend/middlewares/subscription.middleware.js` line 7: `if ((req.user && req.user.role === 'super_admin') || process.env.NODE_ENV === 'development') { ... return next(); }` — this skips **all** company-active/subscription-status/license-expiry checks.
- **Impact**: If the production deployment's environment configuration ever sets (or fails to unset) `NODE_ENV=development` — a common accident in Node deployments (e.g., a copied `.env`, a misconfigured PaaS default, a Docker image built from a dev Dockerfile) — every subscription and license gate for every tenant is silently disabled. Unpaid/expired/suspended customers would retain full access with no error and no log signal.
- **Fix**: Never gate business-critical authorization on `NODE_ENV`. Replace with an explicit `SKIP_SUBSCRIPTION_CHECK` flag defaulting to `false`, only settable in local dev `.env`, and add a startup assertion that logs a loud warning (or refuses to boot) if this flag is enabled while `NODE_ENV !== 'development'` is not independently also true. Estimated 0.5 engineer-day.

### P0-8: Cancel sale/purchase leaves stock inconsistent

- **Evidence**: `salesService.deleteSale` (`backend/services/salesService.js:117-121`, explicit code comment): *"Inventory stock is NOT restored on cancellation (goods already dispatched). For stock restoration, use Sales Return workflow."* `purchaseService.deletePurchase` has the equivalent gap — the accounting reversal entry posts correctly, but no code touches `InventoryLot`/`StockMovement` on cancellation.
- **Impact**: Cancelling a Sales invoice correctly reverses the accounting entries but leaves the associated `InventoryLot` permanently reduced as if the sale still shipped — physical stock records diverge from financial records. Cancelling a Purchase leaves the created lots available for sale/issue even though the bill (and, implicitly, the goods) was cancelled — a company could sell stock that was never actually received.
- **Fix**: Either (a) restore/reduce the relevant `InventoryLot`s and post `StockMovement` entries as part of `deleteSale`/`deletePurchase` (mirroring the reversal-entry pattern already used for accounting), or (b) explicitly disallow cancellation once stock from a document has already moved on to a Sale/Job/Return, funneling users to the (once-fixed) Return workflow instead. Estimated 3–5 engineer-days including full N-way consistency testing per `14-QA-AUDIT.md` §14.4.

---

## 16.2 P0 Summary Table

| # | Blocker | File(s) | Fix effort | Fix category |
|---|---|---|---:|---|
| P0-1 | Sales Return enum crash | `InventoryLot.js`, `returnController.js` | 0.5 day | Bug fix |
| P0-2 | No server-side RBAC | all tenant `routes/*.js` | 5–8 days | Security feature |
| P0-3 | Client-trusted invoice amounts | `salesService.js`, `purchaseService.js` | 5–8 days | Feature (tax engine) |
| P0-4 | No year-close / BS not viable | (missing entirely) | 8–15 days | Feature (accounting) |
| P0-5 | GST compliance false-advertising risk | `gstService.js`, `GstModals.jsx`, `gstExport.js` | 10–20 days (real) / 1 day (relabel) | Feature or labeling |
| P0-6 | `DEMO_COMPANY` on real invoices | `invoiceHelpers.js`, `InvoicePDFViewer.jsx` | 1 day | Bug fix |
| P0-7 | Subscription bypass via `NODE_ENV` | `subscription.middleware.js` | 0.5 day | Security config fix |
| P0-8 | Cancel leaves stock inconsistent | `salesService.js`, `purchaseService.js` | 3–5 days | Bug fix / feature |

**Total P0 remediation: ~34–58 engineer-days** depending on how P0-5 is resolved (relabel vs. real GSP integration).

---

## 16.3 Critical Bugs (P1) — not launch-blocking in isolation, but severe

| # | Bug | Evidence | Impact |
|---|---|---|---|
| C-1 | Outstanding Report / Sales & Purchase Register N+1 | `accountingController.getOutstandingReport` (per-party-per-invoice `PaymentVoucher.find`), duplicated in `reportService.getOutstanding`/`getSalesRegister`/`getPurchaseRegister` | Reports page will time out or badly degrade past a few hundred invoices; see `13-PERFORMANCE-AUDIT.md` §13.3 |
| C-2 | Deactivated user's live JWT may still work | `authMiddleware` only does `User.findById`; no confirmed `isActive` check gate | A terminated employee's session could remain valid until natural JWT expiry (JWT TTL noted as 30 days in `00-INDEX.md` scoreboard) |
| C-3 | Cross-company data leak surface (each controller re-implements tenant filtering by hand) | No shared query-scoping plugin/middleware found across ~20 `companyId`-scoped models; every controller manually adds `{ companyId }` | A single missed filter in any future or existing controller is a full tenant data leak with no other safety net — see `12-SECURITY-AUDIT.md`, `14-QA-AUDIT.md` §14.6 |
| C-4 | Accounting period lock only enforced on Payment/Receipt/Journal, not Sales/Purchase | `checkPeriodLocked` called in `accountingController.js` handlers; **not called** in `salesService.createInvoice`/`purchaseService.createPurchase` | A locked period can be silently violated simply by creating a new Sales/Purchase invoice, defeating the purpose of period locking |
| C-5 | `InventoryLot.rate` field does not exist — stock valuation always ₹0 | `InventoryLot.js` schema has no `rate` field; `reportService.getStockReport` line 134-135 reads `l.rate \|\| 0` | Every "Stock Value" figure across Reports Hub, Report Bundle summary, and Stock-by-Item is silently and permanently zero |
| C-6 | GSTR-2B Matching is entirely fabricated | `GstModals.jsx` `Gst2bMatchingModal`, confirmed line-by-line in `15-INTEGRATION-MATRIX.md` | Any customer relying on this screen for real ITC reconciliation will make wrong GST decisions |
| C-7 | Ledger Modal (shortcut-bar "Ledger") is a static mockup with zero API wiring | `pages/LedgerModal.jsx` | Confuses users who expect this to behave like the working ledger-statement feature elsewhere in the app |

---

## 16.4 Major Bugs (P2)

| # | Bug | Evidence | Impact |
|---|---|---|---|
| M-1 | Dual Axios clients with different behavior | `frontend/src/api/client.js` (has timeout, offline-aware) vs `frontend/src/utils/api.js` (no timeout, not offline-aware) | Inconsistent hang/offline behavior depending on which module a given screen imports |
| M-2 | No pagination on 12+ list endpoints | Parties, Items, Jobs, Orders, Returns, Notes, Visits, Ledgers, Vouchers, Inventory, Books, SubMasters — see `13-PERFORMANCE-AUDIT.md` §13.4 | Full unbounded payloads and full client-side table renders as data grows |
| M-3 | Grey→finished item conversion missing on job receive | `jobService.receiveFromJob` creates the new finished lot with the **same `itemId`** as the grey input | A trader processing Grey Cotton into a distinct finished/dyed SKU sees the wrong item name on the resulting stock — misrepresents actual finished-goods inventory |
| M-4 | Opening Balance may not sync into the ledger statement's source of truth | `OpeningBalanceModal` writes to `Party` via `PUT /api/parties/:id`; `accountingController.getLedgerStatement` reads `openingBalance` off `LedgerMaster` | Opening balances entered via this screen may silently not appear on the real ledger statement — needs explicit verification (`14-QA-AUDIT.md` §14.2.10) |
| M-5 | Job-work accounting postings fail silently outside the transaction | `jobService.receiveFromJob` lines 120–140, comment: *"non-critical, logged only"* — only a `console.error`, no persisted failure record | Job-work charges/wastage accounting can silently vanish with no admin-visible trace |
| M-6 | Dead parallel ledger stack still publicly reachable | `ledgerRoutes.js` → `ledgerController.js` → `ledgerService.js` → `LedgerEntry` model, disconnected from the live `AccountingEntry`/`LedgerMaster` path | Any external caller of `/api/ledgers/:partyId` gets different, likely-wrong numbers vs. the app's real ledger statement |
| M-7 | Dead parallel purchase stack still present in codebase | `purchase.controller.js` + `purchase.service.js` + `Inventory.js`, near-duplicate-named files vs. the live `purchaseController.js`/`purchaseService.js`/`InventoryLot.js` | High risk of future engineers editing the wrong file |
| M-8 | Orphan multipage UI scaffolding | `pages/dashboard/Dashboard.jsx`, `components/layout/Sidebar.jsx`, `layouts/MainLayout.jsx` not routed anywhere in `App.jsx` | Dead code inflates bundle-analysis noise and onboarding confusion |
| M-9 | Config poll every 5 seconds, per open tab, forever | `ConfigContext.jsx` `POLL_MS = 5000` | Unnecessary sustained request volume that scales linearly with concurrent logged-in tabs |
| M-10 | Sales/Purchase Order has no confirmed conversion into an actual invoice | `OrderModal.jsx`/`orderController.js` CRUD only | Orders are recorded but don't reduce re-entry effort at actual billing time — a stated ERP value proposition gap |
| M-11 | GST interstate/intrastate split hardcodes Gujarat state code | `Gst3bMonthlyModal`: `s.gstin.startsWith('24')` | Wrong CGST+SGST vs IGST split for any tenant registered outside Gujarat — a portability defect for expansion beyond the initial Surat/Gujarat market |
| M-12 | Missing GST rate silently defaults to 5% | `gstService.js` line 75: `(line.itemId?.gstRate \|\| 5) / 100` | A genuine data-entry gap (item master missing GST rate) is silently masked as "5%" instead of surfacing as an error, which can misstate real GST liability |

---

## 16.5 Minor Bugs / Cosmetic-but-Notable (P3)

| # | Item | Evidence | Notes |
|---|---|---|---|
| N-1 | Utilities menu — 17 `alert()` stub actions | `Dashboard.jsx` `menuData.Utilities`/`Setup System`/`Company` | Not crashes, but false affordances; "Closing / UnClosing Year" and "Backup" sound like they work and don't |
| N-2 | Data Records Hub has no dedicated fetch/pagination | `pages/records/DataRecordsHub.jsx` | Works only as well as whatever bulk-load already populated the store |
| N-3 | `LOT-{timestamp}-{random}` / `RET-{timestamp}-{random}` ID generation uses `Date.now()` + 4-digit random suffix, not a guaranteed-unique scheme | `purchaseService.js:22-24`, `returnController.js:59-61` | Low but nonzero collision probability under high concurrent load; `Counter`-based sequencing (already used elsewhere) would be strictly safer |
| N-4 | `jobService.receiveFromJob` fallback cost-per-meter of ₹100 when no purchase-linked lot exists | `jobService.js:78` | Reasonable fallback but should be surfaced as a warning to the user, not silent |
| N-5 | CA Dashboard auto-refreshes every 30s even when tab/modal not focused | `CADashboardModal.jsx:113` | Wasted aggregation work; low severity |
| N-6 | No export/PDF capability confirmed on most Reports Hub tabs beyond in-app viewing | `ReportsHub.jsx` | Functional gap, not a bug, but relevant to "is this launch ready" |

---

## 16.6 Missing Features (confirmed absent, not just incomplete)

| Feature | Status | Notes |
|---|---|---|
| Financial year close / carry-forward | **Absent** | See P0-4 |
| Real GSTR-2B portal reconciliation | **Absent (fake UI only)** | See P0-5, C-6 |
| Real cash/bank/contra voucher types distinct from generic Payment/Receipt | **Absent / unclear** — only `Payment`/`Receipt`/`Journal` voucher types found in `AccountingEntry.voucherType` usage | Flagged as a rewrite candidate in `18-CTO-FINAL-REPORT.md` |
| Server-side tax computation engine | **Absent** | See P0-3 |
| Grey→finished item/SKU conversion (BOM-like mapping) | **Absent** | See M-3 |
| Order→Invoice conversion workflow | **Absent / unconfirmed** | See M-10 |
| Server-enforced RBAC/permission middleware | **Absent** | See P0-2 |
| Any automated test suite wired to CI | **Absent** — `backend/__tests__/` empty, no `test` script in `backend/package.json`, only 1 Playwright spec on the frontend | See `14-QA-AUDIT.md` §14.9 |
| Rate-limiting / brute-force protection on auth endpoints | **Not confirmed present** | Cross-reference `12-SECURITY-AUDIT.md` |
| Multi-currency / multi-GSTIN-per-company support | **Not found** | Not assumed required for MVP but worth flagging for enterprise positioning |

---

## 16.7 Hardcoded Values Inventory

| Value | Location | Risk |
|---|---|---|
| `DEMO_COMPANY` (`'MAHAVEER TEXTILES PVT. LTD.'` + address) | `frontend/src/utils/invoiceHelpers.js:2` | P0-6 |
| `"MAHAVEER IMPEX"` company selector | `frontend/src/pages/LedgerModal.jsx:21` | Confirms this screen is a non-functional mockup |
| Date range `01/04/2026`–`31/03/2027` | `frontend/src/pages/LedgerModal.jsx:33-35` | Same |
| Gujarat state code `'24'` for interstate detection | `frontend/src/pages/gst/GstModals.jsx` (`Gst3bMonthlyModal`) | M-11 |
| Default GST rate `5` when item has none | `backend/services/gstService.js:75` | M-12 |
| GST export `hash: 'hash'`, `version: 'GST3.2.2'` | `backend/services/gstService.js:110` (via `gstExport.js`) | P0-5 |
| Cost-per-meter fallback `₹100` | `backend/services/jobService.js:78` | N-4 |
| Config poll interval `5000` ms | `frontend/src/context/ConfigContext.jsx:9` | M-9 |
| CA Dashboard poll `30000` ms | `frontend/src/pages/gst/CADashboardModal.jsx:113` | N-5 |
| GSTR-2B fake summary tiles `"24"`, `"02"`, `"01"`, `"₹ 84K"` | `frontend/src/pages/gst/GstModals.jsx` (`Gst2bMatchingModal`) | C-6 |
| GSTR-2B fake GSTIN fallback `'24SPLY1234F1Z5'` | Same file | C-6 |
| GSTR-3B "File Return" fake `setTimeout(…, 2000)` | Same file (`Gst3bMonthlyModal.handleFileReturn`) | P0-5 |
| Default selected month `'2026-05'` | `Gst3bMonthlyModal` initial state | Minor, but a hardcoded date will silently be wrong after May 2026 |

---

## 16.8 Mocks / Fakes Inventory

| Screen/Function | What's fake | Real backend exists? |
|---|---|---|
| GSTR-2B Matching (`Gst2bMatchingModal`) | Entire reconciliation — portal data, match status, summary tiles | No |
| GSTR-3B "File Return" button | Simulated 2s delay, no actual filing | No |
| Ledger Modal (shortcut bar) | Entire screen — no data, no actions | No (real equivalent exists elsewhere: `getLedgerStatement`) |
| Utilities menu (17 items) | Every action is an `alert()` | No |
| "Setting"/"User Setup" → some entries just open `UserRightsModal` regardless of intent | Menu items imply distinct settings screens; several route to the same modal | Partial — real screen exists but menu semantics overstate its scope |
| "Merge Event" (Master menu) | Calls `refreshAllData()` then shows a success alert | Real refresh call exists, but "merge" is not an actual distinct operation — misleading label |
| "MisMatch Data Scanner" (Utilities) | Same pattern — real refresh, fake "scanner" framing | Partial |

---

## 16.9 Priority Roll-Up (P0/P1/P2/P3 counts)

| Priority | Count | Total est. effort |
|---|---:|---:|
| P0 (launch blockers) | 8 | ~34–58 eng-days |
| P1 / Critical (C-1..C-7) | 7 | ~15–20 eng-days |
| P2 / Major (M-1..M-12) | 12 | ~20–25 eng-days |
| P3 / Minor (N-1..N-6) | 6 | ~5–8 eng-days |

**Grand total to reach a defensible "production ready, sellable as a real ERP" state: ~74–111 engineer-days (≈15–22 engineer-weeks for a single engineer, ≈8–11 weeks for a 2-person team)** — consistent with the 14–22 week / 28–40 week ranges already published in `00-INDEX.md` for soft-launch vs. full-commercial-claim scenarios respectively. See `17-ROADMAP.md` for phased sequencing.
