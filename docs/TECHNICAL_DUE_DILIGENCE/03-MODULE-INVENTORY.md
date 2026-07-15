# Technical Due Diligence — Module Inventory

**Companion to:** `01-EXECUTIVE-SUMMARY.md`, `02-PROJECT-STRUCTURE.md`
**Purpose:** Exhaustive, per-module completion assessment for every functional area of the system. Each module is scored against what was **actually found in code** — frontend component, backend route/controller/service, database model, and end-to-end business-logic correctness — not against what the menu label implies.

## Methodology & Status Legend

| Status | Meaning |
|---|---|
| `COMPLETE` | Frontend, backend, DB, and business logic all present and internally consistent; no known critical defect found during this audit. |
| `PARTIAL` | Functional end-to-end path exists, but with material gaps, edge-case defects, or missing sub-features documented in the "Missing"/"Broken" columns. |
| `STUB` | A route/controller/model exists but implements only the minimal/naive version of the feature (e.g. no validation, no cross-checks, placeholder values). |
| `MISSING` | No implementation was found anywhere in the codebase for this capability — verified by targeted `grep` across both `frontend/src` and `backend`. |
| `DEAD_CODE` | A real implementation exists but is unreachable from the live application graph (see `02-PROJECT-STRUCTURE.md §4-5`). |
| `FAKE_UI` | The frontend presents a working affordance (menu item, button, success toast/alert) with **no corresponding backend call** — the UI fabricates the outcome. |

Columns: **Purpose** (what the module should do) · **Status** · **Completion%** (an engineering estimate of finished-vs-total work for a production-grade version of that module) · **FE** (frontend evidence) · **BE** (backend route/controller/service evidence) · **DB** (model evidence) · **API** (actual HTTP verb+path, or "none") · **Business** (business-logic correctness notes) · **Dependencies** (what this module needs to function) · **Missing** (known gaps) · **Broken** (known defects).

---

## 1. Foundation & Identity

### 1.1 Auth

| Field | Detail |
|---|---|
| Purpose | Register company owners, authenticate users, issue JWTs, support password recovery, resolve session/company/plan context on `/me`. |
| Status | **PARTIAL** |
| Completion% | 75% |
| FE | `frontend/src/pages/auth/LoginPage.jsx`, `SignupPage.jsx`, `ForgotPasswordPage.jsx`; session bootstrap in `frontend/src/components/auth/AuthBootstrap.jsx`; route guard `frontend/src/components/auth/ProtectedRoute.jsx`. |
| BE | `backend/controllers/auth.controller.js`, `backend/services/auth.service.js`, `backend/middlewares/auth.middleware.js`. |
| DB | `backend/models/User.js` (bcrypt hash via `pre('save')` hook, `passwordResetToken`/`passwordResetExpires`). |
| API | `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/forgot-password`, `POST /api/auth/reset-password`, `GET /api/auth/me` (`backend/routes/auth.routes.js`). |
| Business | Registration seeds a `Company`, `Subscription` (30-day trial), `License`, `CompanySettings`, and system ledgers (`auth.service.js` lines 60-116) — this onboarding chain is genuinely well thought out. |
| Dependencies | `Company`, `Plan`, `Subscription`, `License`, `CompanySettings`, `CompanyModuleConfig`. |
| Missing | No email delivery integration visible for `forgotPassword` (no mail transport config in `backend/package.json` dependencies — no `nodemailer`/`sendgrid`/etc.); no MFA; no login rate-limiting/brute-force lockout. |
| Broken | Super-admin `companyId` resolution silently defaults to the oldest `Company` document (`auth.middleware.js` lines 23-31; see `01-EXECUTIVE-SUMMARY.md §3.10`). |

### 1.2 Dashboard

| Field | Detail |
|---|---|
| Purpose | Single landing surface presenting KPIs, recent activity, and the menu system that opens every other module as a modal. |
| Status | **PARTIAL** |
| Completion% | 65% |
| FE | `frontend/src/pages/Dashboard.jsx` (832 lines) — the entire ERP shell; also a second, unrelated `frontend/src/pages/dashboard/Dashboard.jsx` file exists in a different folder (not imported by `App.jsx`; likely an earlier draft). |
| BE | Aggregates data client-side from already-fetched `useStore.js` state (`sales`, `purchases`, `jobWorkEntries`) — no dedicated `/api/dashboard` summary endpoint exists. |
| DB | Indirect — reads whatever `Sales`, `Purchase`, `Job` collections return via existing list endpoints. |
| API | None dedicated; reuses `/api/sales`, `/api/purchases`, `/api/jobs`. |
| Business | Recent-activity feed (`Dashboard.jsx` lines ~380-396) is a client-side `.slice()` of already-loaded lists, not a real activity/audit feed. |
| Dependencies | `useStore.js` global state; `ConfigContext` for module visibility. |
| Missing | No server-computed KPI endpoint (all math done in the browser on unbounded list fetches — a scalability concern, see `01-EXECUTIVE-SUMMARY.md` Performance score). |
| Broken | None found beyond the aliasing/fake-menu items catalogued individually below (Utilities, Cash Book, Bank Book, TDS Entry, Process/Cutting/Beam/Production). |

### 1.3 Company

| Field | Detail |
|---|---|
| Purpose | Represent a tenant (legal entity) — the root of all multi-tenant data isolation. |
| Status | **PARTIAL** |
| Completion% | 70% |
| FE | `frontend/src/pages/admin/Companies.jsx`, `frontend/src/pages/admin/CompanyConfig.jsx`. |
| BE | `backend/controllers/admin.controller.js` (`getAllCompanies`, `createCompany`, `updateCompany`, `lockCompany`, `unlockCompany`, `getCompanyConfig`, `saveCompanyConfig`). |
| DB | `backend/models/Company.js` (`ownerId`, `planId`, `licenseKey`, `status` enum `active/suspended/expired`, `meta.{gstin,pan,state,...}`, `settings.lockedUntilDate`). |
| API | `GET/POST /api/admin/company*`, `PUT /api/admin/company/:id`, `PUT /api/admin/company/:id/lock`, `PUT /api/admin/company/:id/unlock` — all `super_admin`-only (`admin.routes.js`). |
| Business | `createCompany` correctly cascades: creates owner `User`, seeds system ledgers, seeds dynamic config defaults, creates trial `Subscription` and `License` (lines 22-112 of `admin.controller.js`) — a genuinely complete provisioning flow. |
| Dependencies | `User` (owner), `Plan`, `Subscription`, `License`, `CompanySettings`, `CompanyModuleConfig`. |
| Missing | No company deletion/offboarding flow; no GSTIN format validation on `meta.gstin`. |
| Broken | Super-admin "no tenant" fallback treats the oldest `Company` as an implicit default tenant for all ERP data routes (`01-EXECUTIVE-SUMMARY.md §3.10`). |

### 1.4 Users

| Field | Detail |
|---|---|
| Purpose | Per-company user accounts (distinct from the platform-level `super_admin`). |
| Status | **COMPLETE** (for CRUD + role-gating within its own module) |
| Completion% | 85% |
| FE | `frontend/src/pages/admin/UserManagement.jsx` (admin panel), `frontend/src/pages/admin/UserRightsModal.jsx` (tenant panel, opened from `Dashboard.jsx`'s "Setting"/"User Setup" menu items). |
| BE | `backend/controllers/user.controller.js`, `backend/services/user.service.js`. |
| DB | `backend/models/User.js`. |
| API | `GET/POST /api/users`, `PUT /api/users/:id`, `DELETE /api/users/:id` (`backend/routes/user.routes.js`) — tenant-scoped self-service; plus super-admin equivalents under `/api/admin/company/:id/users`, `/api/admin/company/:id/user`, `/api/admin/user/:userId/role`, `/api/admin/user/:userId/toggle-active`, `/api/admin/user/:userId` (DELETE). |
| Business | `user.service.js`'s `canManageUsers()` correctly restricts create/update/deactivate to `companyRole` of `owner`/`admin` (lines 4-9, 17-20, 48-51, 71-74); enforces a per-plan user-count limit (`company.planId.limits.users`, lines 25-30); blocks modifying/deactivating the `owner` account (lines 56-58, 78). This is the **one** module in the entire ERP surface with real server-side role enforcement. |
| Dependencies | `Company`, `Plan.limits.users`. |
| Missing | No email-verification/invite-link flow — new users are created with a plaintext password chosen by the admin, not a self-service invite. |
| Broken | None found. |

### 1.5 Roles

| Field | Detail |
|---|---|
| Purpose | Define what a `companyRole` (`owner/admin/manager/accountant/salesman/sales/viewer`) is permitted to do. |
| Status | **PARTIAL** |
| Completion% | 35% |
| FE | `frontend/src/utils/permissions.js` (`getPermissions()`), consumed by `Dashboard.jsx` to hide/show menu sections. |
| BE | Only enforced inside `user.service.js` (`MANAGER_ROLES`); **not** enforced in any other controller. |
| DB | `companyRole` enum lives on `backend/models/User.js`, not a separate collection. |
| API | Roles are not independently addressable via any endpoint — they are a field on the `User` write paths. |
| Business | The role vocabulary (7 values) is richer than what is actually checked anywhere except user management, so most of the intended access model is aspirational rather than enforced. |
| Dependencies | `User.companyRole`. |
| Missing | Any backend enforcement for Sales/Purchase/Accounting/Inventory/GST/Reports routes. |
| Broken | See `01-EXECUTIVE-SUMMARY.md §3.3` — this is the single largest security gap identified in the audit. |

### 1.6 Permissions

| Field | Detail |
|---|---|
| Purpose | Fine-grained, per-company, per-module CRUD/export/print permission matrix (view/create/edit/delete/export/print) intended to be configurable by the super-admin per tenant. |
| Status | **STUB** |
| Completion% | 30% |
| FE | `frontend/src/pages/admin/DynamicConfig.jsx` (admin panel tab for editing the matrix). |
| BE | `backend/controllers/adminConfig.controller.js` (`getPermissionMatrix`, `savePermissionMatrix`). |
| DB | `backend/models/PermissionMatrix.js` — `roles: Mixed`, `sections: Mixed` (untyped, schema-less blobs), one document per company (`unique: true` on `companyId`). |
| API | `GET/PUT /api/admin/company/:id/config/permissions` (super-admin only). |
| Business | The matrix is stored and retrievable via the dynamic config bundle (`configService.getActiveConfigBundle`), but **no controller in the transactional API surface (`salesController`, `purchaseController`, `accountingController`, etc.) ever reads `PermissionMatrix` to gate an action** — it is wired for storage and admin-side editing only, not for runtime enforcement. |
| Dependencies | `CompanyModuleConfig`, `configMetaSchema` mixin (versioning). |
| Missing | Any backend middleware that actually consults `PermissionMatrix` before allowing a create/edit/delete/export/print action. |
| Broken | Functionally a write-only settings blob from the runtime API's perspective. |

### 1.7 Audit Logs

| Field | Detail |
|---|---|
| Purpose | Immutable record of who did what, when, for compliance and support debugging. |
| Status | **PARTIAL** |
| Completion% | 45% |
| FE | `frontend/src/pages/admin/Audit.jsx`. |
| BE | `backend/services/auditService.js`; invoked from `backend/controllers/salesController.js` (`CREATE_INVOICE`, `UPDATE_STATUS`, `DELETE_INVOICE`) only. `backend/controllers/admin.controller.js`'s `getAuditLogs`/`getAdminStats` read it. |
| DB | `backend/models/AuditLog.js` (`userId`, `companyId`, `action`, `module`, `referenceId`, `before`/`after` Mixed snapshots, `ip`, `userAgent`). |
| API | `GET /api/admin/audit` (super-admin only). |
| Business | Schema supports before/after diffing (useful for real compliance audit trails), but logging calls are only wired into the Sales controller — Purchase, Accounting (journal/payment/receipt), Job Work, Returns, Notes, Orders, and GST actions perform **no** audit logging at all. |
| Dependencies | None beyond `User`/`Company` refs. |
| Missing | Audit coverage for Purchase, Job Work, Accounting vouchers, Returns, Notes, Orders, Party/Item master changes, GST report generation. |
| Broken | None functionally, but coverage gap materially undermines its value as a compliance control. |

---

## 2. Master Data

### 2.1 Party

| Field | Detail |
|---|---|
| Purpose | Single master for Customers, Suppliers, Brokers, and Job Workers (a unified counter-party record, distinguished by `type`). |
| Status | **COMPLETE** |
| Completion% | 85% |
| FE | `frontend/src/pages/masters/PartyModal.jsx`, `PartyMaster.jsx`. |
| BE | `backend/controllers/partyController.js`, `backend/services/partyService.js`. |
| DB | `backend/models/Party.js` — extremely wide schema (30+ fields covering GST/MSME/TDS/discount/credit-limit metadata), `type` enum `['Customer','Supplier','Both','Broker','Job Worker']`. |
| API | `POST/GET /api/parties`, `GET /api/parties/search`, `GET/PUT/DELETE /api/parties/:id` (no server-side role/feature guard applied to this router — see `02-PROJECT-STRUCTURE.md §3`). |
| Business | Per-company unique index on `name` and on `accd` (legacy account-code field) prevents duplicate-name masters within a tenant; `openingBalance`/`openingBalanceType` feed the accounting ledger auto-creation in `accountingService.getOrCreatePartyLedger()`. |
| Dependencies | Consumed by Sales, Purchase, Job, Order, Return, Note, Visit, LedgerMaster. |
| Missing | No GSTIN checksum/format validation; no duplicate-detection by GSTIN/PAN (only by exact name). |
| Broken | None found. |

### 2.2 Account (Account Master)

| Field | Detail |
|---|---|
| Purpose | Chart-of-accounts style ledger head master used interchangeably with "Ledger" in the UI (`Master → Account`, `Master → Account Main Group`, `Master → Account Head`). |
| Status | **PARTIAL** |
| Completion% | 55% |
| FE | `frontend/src/pages/masters/AccountMasterModal.jsx` (opened via `Dashboard.jsx`'s `{ label: 'Account', key: 'accountMaster' }`); "Account Main Group"/"Account Head" instead route to the **generic** `openGenericMaster('AccountGroup'/'AccountHead')` flow, i.e. they are stored as `SubMaster` records, not first-class chart-of-accounts nodes. |
| BE | `LedgerMaster` CRUD via `backend/controllers/accountingController.js` (`createLedger`, `listLedgers`); "Account Group"/"Account Head" via generic `subMasterController.js`. |
| DB | `backend/models/LedgerMaster.js` (real accounting ledger); `backend/models/SubMaster.js` type `'AccountGroup'`/`'AccountHead'` (a flat name-only lookup list, not a hierarchical chart-of-accounts tree). |
| API | `POST/GET /api/accounting/ledgers`; `POST/GET/PUT/DELETE /api/submasters?type=AccountGroup`. |
| Business | There is no true hierarchical chart-of-accounts (group → sub-group → ledger, with roll-up balances) — `LedgerMaster.group`/`subGroup` are flat string fields, and `AccountGroup`/`AccountHead` sub-masters are unconnected labels with no FK relationship back to `LedgerMaster`. |
| Dependencies | `LedgerMaster`, `SubMaster`. |
| Missing | Real hierarchical account grouping; UI-level connection between "Account Main Group" labels and actual `LedgerMaster.group` values used in Trial Balance/P&L/Balance Sheet. |
| Broken | None crash-level, but the two concepts (Account Master vs Account Group/Head) are not integrated. |

### 2.3 Broker

| Field | Detail |
|---|---|
| Purpose | Track brokers who intermediate Sales/Purchase transactions, for commission and reporting. |
| Status | **PARTIAL** |
| Completion% | 40% |
| FE | No dedicated Broker master screen — brokers are created through the generic `PartyModal.jsx` with `type: 'Broker'`. |
| BE | No dedicated broker controller — `brokerId` is a plain `ObjectId` ref to `Party` on `Sales`/`Purchase` schemas. |
| DB | `Sales.brokerId`, `Purchase.brokerId` (both `ref: 'Party'`, `default: null`); `Party.type` includes `'Broker'`; `Party.commi` (commission %) field exists but is never read by `accountingService.js` — no broker-commission ledger posting exists anywhere in the accounting engine. |
| API | Piggybacks on `/api/parties` (create) and `/api/sales`, `/api/purchases` (assignment). `reportService.getSalesRegister()`/`getPurchaseRegister()` do surface `broker: s.brokerId?.name` in the register rows. |
| Business | Broker assignment is tracked on transactions and appears in registers/GST CA dashboard warnings context, but there is **no commission calculation, no commission ledger, no broker statement/settlement report** — the Dashboard's "Brokreg Statment" menu item (`Others Reports`) just opens the generic Outstanding report hub (`openReportsHub('outstanding')`), not a broker-specific statement. |
| Dependencies | `Party` (type='Broker'). |
| Missing | Commission computation/posting, broker-specific ledger/statement, dedicated broker master fields (commission slab, brokerage GST treatment). |
| Broken | "Brokreg Statment" menu label promises a broker register that does not exist as distinct functionality. |

### 2.4 Item

| Field | Detail |
|---|---|
| Purpose | Product/material master (fabric/yarn/grey/finished goods) with GST rate, HSN, unit, and default pricing. |
| Status | **COMPLETE** |
| Completion% | 85% |
| FE | `frontend/src/pages/masters/ItemModal.jsx`, `ItemMasterModal.jsx`, `ItemMaster.jsx`. |
| BE | `backend/controllers/itemController.js`, `backend/services/itemService.js`. |
| DB | `backend/models/Item.js` — `category` enum `['Grey','Finished','Yarn','Others']`, `hsnCode`, `gstRate` (default 5), `unit`, `purchaseRate`/`salesRate`, `openingStock`. |
| API | `POST/GET /api/items`, `GET /api/items/search`, `GET/PUT/DELETE /api/items/:id`. |
| Business | `gstRate` on the item is the single source of truth consumed by `gstService.getGstr1()`'s HSN summary computation (`line.itemId?.gstRate`) — correctly threaded through when items are populated. |
| Dependencies | Consumed by Sales, Purchase, InventoryLot, Order, Return line items. |
| Missing | No item-image/attachment support; no size/color variant matrix (color/design/size are flat string fields, not a variant SKU model). |
| Broken | None found. |

### 2.5 HSN

| Field | Detail |
|---|---|
| Purpose | HSN/SAC code master for GST classification and rate lookup, decoupled from the Item master. |
| Status | **STUB** |
| Completion% | 20% |
| FE | No dedicated HSN screen; reachable only as a generic `SubMaster` type via `Master → OtherMaster`-style generic modal flows (type `'HSN'` is declared in `SUB_MASTER_TYPES` but no menu entry in `Dashboard.jsx`'s `Master` section explicitly opens `openGenericMaster('HSN')`). |
| BE | Generic `subMasterController.js` only. |
| DB | `backend/models/SubMaster.js` — `type: 'HSN'` is a valid enum value (line 16 of `SUB_MASTER_TYPES`) but the schema provides only `name` + freeform `extraFields` (Mixed) — no structured `hsnCode`/`gstRate`/`description`/`cess` fields. |
| API | `GET/POST/PUT/DELETE /api/submasters?type=HSN`. |
| Business | Each `Item` carries its own free-text `hsnCode` string (`Item.hsnCode`) with **no foreign-key or validation relationship** to any HSN master — two items can have typo'd, inconsistent HSN codes for the same product category with nothing to catch it, and there is no centralized GST-rate-by-HSN lookup table to auto-populate `Item.gstRate`. |
| Dependencies | None functioning. |
| Missing | Structured HSN/SAC master with rate + cess + effective-date fields; validation linking `Item.hsnCode` to the master; GST-rate auto-fill from HSN. |
| Broken | Not broken — simply not meaningfully built beyond a generic label bucket. |

### 2.6 Warehouse

| Field | Detail |
|---|---|
| Purpose | Represent physical stock locations/godowns for multi-location inventory tracking. |
| Status | **MISSING** |
| Completion% | 0% |
| FE | None. Grep for `warehouse`/`Warehouse`/`godown`/`location` (stock-location sense) across `frontend/src` returns no dedicated component. |
| BE | None. Grep for `warehouse`/`Warehouse` across the entire `backend/` directory returns **zero matches**. |
| DB | No `Warehouse` model exists; `InventoryLot` and `StockMovement` are scoped only by `companyId` — there is no location/godown dimension anywhere in the schema. |
| API | None. |
| Business | All stock is implicitly single-location per company. Any tenant operating more than one physical warehouse/godown cannot represent that distinction anywhere in the system — stock, transfers, and reports are all company-wide aggregates. |
| Dependencies | N/A |
| Missing | Everything: model, CRUD, stock-by-location reporting, inter-warehouse transfer vouchers. |
| Broken | N/A — not implemented, not broken. |

---

## 3. Transactions — Trading

### 3.1 Purchase

| Field | Detail |
|---|---|
| Purpose | Record supplier bills, create inbound `InventoryLot`s, post double-entry accounting. |
| Status | **COMPLETE** (live implementation) — but shadowed by a **DEAD_CODE** duplicate |
| Completion% | 80% |
| FE | `frontend/src/pages/purchase/PurchaseModal.jsx` (live, opened from `Dashboard.jsx`); `frontend/src/pages/purchase/PurchasePage.jsx` (`DEAD_CODE`, unreachable — see `02-PROJECT-STRUCTURE.md §4`). |
| BE | Live: `backend/controllers/purchaseController.js` + `backend/services/purchaseService.js`. Dead: `backend/controllers/purchase.controller.js` + `backend/services/purchase.service.js` (never wired into any route). |
| DB | `backend/models/Purchase.js`; side effects on `InventoryLot`, `StockMovement`, `AccountingEntry`. |
| API | `POST/GET /api/purchases`, `GET /api/purchases/:id`, `PUT /api/purchases/:id/status`, `DELETE /api/purchases/:id` — gated by `featureGuard('purchase')` only, no role check. |
| Business | `purchaseService.createPurchase()` runs inside a Mongo transaction: generates a per-item `lotId`, creates one `InventoryLot` (`source: 'purchase'`) + one `StockMovement` (`type: 'PURCHASE'`) per line item, then posts a real double-entry `AccountingEntry` via `accountingService.onPurchaseBillPost()` — all inside the same session, so a failure at any step rolls back everything. This is one of the best-engineered write paths in the codebase. |
| Dependencies | `Party` (supplier), `Item`, `Counter` (invoice numbering), `AccountingEntry`/`LedgerMaster`. |
| Missing | No PO-to-Bill matching/three-way-match against `Order` (Purchase Order) records — Purchase Orders and Purchase Bills are entirely independent, unlinked collections. |
| Broken | Client-trusted GST/tax fields (`01-EXECUTIVE-SUMMARY.md §3.9`) apply identically here. |

### 3.2 Purchase Return

| Field | Detail |
|---|---|
| Purpose | Record goods returned to a supplier, reduce the originating lot's stock, reverse the accounting impact. |
| Status | **PARTIAL** |
| Completion% | 60% |
| FE | `frontend/src/pages/transactions/ReturnModal.jsx` (`returnType='Purchase'`, opened via `Dashboard.jsx`'s `openReturn('Purchase')`). |
| BE | `backend/controllers/returnController.js`. |
| DB | `backend/models/ReturnInvoice.js` (`returnType` enum `['Sales','Purchase']`), side effects on `InventoryLot`/`StockMovement`/`AccountingEntry`. |
| API | `POST/GET /api/returns?returnType=Purchase` — **no server-side role/feature guard on this router at all** (`backend/routes/returnRoutes.js` applies neither `featureGuard` nor `roleMiddleware`). |
| Business | Correctly reduces `lot.remainingMtrs`/`remainingPcs` on the *original* lot referenced by `item.lotId` (`returnController.js` lines 91-116) and posts a debit-to-supplier / credit-to-purchase-and-GST reversal entry (lines 144-158) — the Purchase Return path itself does **not** hit the `InventoryLot.source` enum bug (that only affects Sales Return, §3.3 below), so this half of the Return module is not runtime-broken. |
| Dependencies | `InventoryLot` (must already exist and be referenced by `lotId`), `Party` (supplier), `LedgerMaster`. |
| Missing | No linkage validation that the returned `item.lotId` actually belongs to the same supplier/original purchase being referenced by `originalInvoiceNo` (that field is a free-text string, not a validated FK). |
| Broken | None specific to the Purchase-side logic (contrast with Sales Return, next). |

### 3.3 Sales

| Field | Detail |
|---|---|
| Purpose | Record customer invoices, deduct `InventoryLot` stock, post double-entry accounting, track payment status. |
| Status | **COMPLETE** |
| Completion% | 80% |
| FE | `frontend/src/pages/sales/SalesModal.jsx` (live), `frontend/src/pages/sales/SalesPage.jsx` (`DEAD_CODE`), `frontend/src/pages/sales/SalesPrint.jsx`, `frontend/src/components/InvoicePDFViewer.jsx` (subject to the `DEMO_COMPANY` fallback risk, `01-EXECUTIVE-SUMMARY.md §3.5`). |
| BE | `backend/controllers/salesController.js`, `backend/services/salesService.js`. |
| DB | `backend/models/Sales.js`; side effects on `InventoryLot`, `StockMovement`, `AccountingEntry`. |
| API | `POST/GET /api/sales`, `GET /api/sales/:id`, `PUT /api/sales/:id/status`, `DELETE /api/sales/:id` — `featureGuard('sales')` only. |
| Business | Transactionally sound: stock deduction validates `lot.remainingMtrs >= item.mts` before allowing the sale (`salesService.js` lines 27-30), and cancellation (`deleteSale`) posts a proper reversal `AccountingEntry` rather than deleting history (lines 130-166) — correctly notes in a comment that "Inventory stock is NOT restored on cancellation... For stock restoration, use Sales Return workflow" (line 121), which is the right design intent, contingent on Sales Return actually working (it does not — see 3.4 below). |
| Dependencies | `Party` (customer), `Item`, `InventoryLot`, `Counter`, `AccountingEntry`/`LedgerMaster`. |
| Missing | No credit-limit enforcement at save time (`Party.creditLimit` field exists but is never checked in `salesService.createInvoice`). |
| Broken | Client-trusted GST/tax fields (`01-EXECUTIVE-SUMMARY.md §3.9`); is also the entry point whose cancelled invoices rely on a Sales Return path that is broken (next). |

### 3.4 Sales Return

| Field | Detail |
|---|---|
| Purpose | Record goods returned by a customer, restore stock via a new inbound lot, reverse the accounting impact. |
| Status | **PARTIAL — contains a hard runtime defect** |
| Completion% | 45% (logic is designed correctly; fails at execution) |
| FE | `frontend/src/pages/transactions/ReturnModal.jsx` (`returnType='Sales'`). |
| BE | `backend/controllers/returnController.js`. |
| DB | `backend/models/ReturnInvoice.js`, `backend/models/InventoryLot.js`. |
| API | `POST /api/returns` with `returnType: 'Sales'` — no server-side role/feature guard. |
| Business | Intended flow (restore stock by creating a fresh `InventoryLot` per returned line, tagged with a traceable `source`) is directionally correct and the accounting reversal (debit Sales A/c + CGST/SGST Output, credit customer — lines 129-143) is correctly signed. |
| Dependencies | `Party` (customer), `Item`, `LedgerMaster`. |
| Missing | Any handling for partial returns against a specific original `InventoryLot` (new lots are always freshly minted with a synthetic `RET-<timestamp>-<random>` ID, never merged back into the originating lot). |
| Broken | **`source: 'return'` at `returnController.js` line 68 is not a member of `InventoryLot.source`'s enum (`['purchase','opening','jobwork','job_receive']`, `InventoryLot.js` line 22).** Every Sales Return containing at least one line with `item.mts > 0` throws a Mongoose `ValidationError` on `newLot.save()`, aborts the entire transaction, and returns a generic 500. **This is the single most severe functional defect found in the audit** — full detail and fix guidance in `01-EXECUTIVE-SUMMARY.md §3.1`. |

---

## 4. Inventory & Job Work

### 4.1 Inventory

| Field | Detail |
|---|---|
| Purpose | Umbrella view over stock lots — list, filter, and inspect current inventory. |
| Status | **COMPLETE** |
| Completion% | 75% |
| FE | `frontend/src/pages/inventory/InventoryPage.jsx`, `LotDetails.jsx`, `frontend/src/components/inventory/{InventoryTable,LotCard,MovementTable}.jsx`. |
| BE | `backend/controllers/inventoryController.js`, `backend/services/inventoryService.js`. |
| DB | `backend/models/InventoryLot.js`, `backend/models/StockMovement.js`. A **second, legacy** `backend/models/Inventory.js` collection also exists (`itemName`, `lotNo`, `currentStock` flat fields) — grep shows no controller/service references it; it is effectively an orphaned schema from an earlier data model, distinct from the live `InventoryLot`-based system. |
| API | `POST /api/inventory/opening-stock`, `GET /api/inventory`, `GET /api/inventory/lots`, `GET /api/inventory/lot/:lotId`, `GET /api/inventory/stock/:itemId` — no server-side role/feature guard applied at all on this router. |
| Business | `createOpeningStock()` correctly seeds a `source: 'opening'` lot + an `OPENING`-type `StockMovement` in one call (`inventoryService.js` lines 27-61). |
| Dependencies | `Item`, `Purchase` (for lot lineage), `Job` (for job-work lineage). |
| Missing | No low-stock threshold/reorder-point alerting despite `CompanySettings.notifyLowStock` existing as a toggle — nothing reads that flag anywhere in the backend. |
| Broken | The legacy `Inventory` model (distinct from `InventoryLot`) is dead weight that risks confusing future schema migrations. |

### 4.2 Lots

| Field | Detail |
|---|---|
| Purpose | The atomic unit of stock — a specific batch/lot of an item with its own remaining-quantity ledger. |
| Status | **COMPLETE**, with one **PARTIAL** sub-defect |
| Completion% | 75% |
| FE | `frontend/src/components/inventory/LotCard.jsx`, `frontend/src/pages/inventory/LotDetails.jsx`. |
| BE | Fed by `purchaseService.js` (`source: 'purchase'`), `inventoryService.js` (`source: 'opening'`), `jobService.js` (`source: 'job_receive'` on receipt), and `returnController.js` (attempted `source: 'return'`, broken). |
| DB | `backend/models/InventoryLot.js` — `lotId`, `itemId`, `purchaseId`, `source` enum, `totalPcs`/`remainingPcs`, `totalMtrs`/`remainingMtrs`, `status` enum `['Available','Partially Used','Closed']`, compound unique index `{lotId, companyId}`. |
| API | Surfaced via `/api/inventory/*` and consumed internally by Sales/Purchase/Job/Return controllers. |
| Business | Every stock-mutating write path correctly recomputes `status` from `remainingMtrs` (`<= 0 → 'Closed'`, else `'Partially Used'`) — this invariant is consistently maintained across `salesService.js`, `jobService.js`, and `returnController.js`. |
| Dependencies | `Item`, `Purchase`, `Job`. |
| Missing | `jobwork` is a declared enum value on `source` (`InventoryLot.js` line 22) but no code path was found that ever sets `source: 'jobwork'` (the actual job-issue path deducts from an *existing* lot rather than creating a new one tagged `jobwork` — only `job_receive` creates a new lot on the receiving side). This suggests the enum was designed for a symmetry that the implementation never completed. |
| Broken | The `'return'` enum gap (§3.4 above / `01-EXECUTIVE-SUMMARY.md §3.1`). |

### 4.3 Stock

| Field | Detail |
|---|---|
| Purpose | Aggregate, item-level and lot-level stock reporting (quantities, valuation). |
| Status | **COMPLETE** |
| Completion% | 75% |
| FE | `frontend/src/pages/reports/ReportsHub.jsx` (`key: 'stock'`, `'stockItem'`), Dashboard menu `Reports → Inv Stock Ledger` / `Others Reports → Zoom Item Ledger`. |
| BE | `backend/services/reportService.js` (`getStockReport`, `getStockByItem`), exposed via `backend/controllers/reportController.js`. |
| DB | Reads `InventoryLot` populated with `Item`. |
| API | `GET /api/reports/stock`. |
| Business | `getStockReport()` computes `value = remainingMtrs * rate`, but `rate` is read directly off the `InventoryLot` document (`l.rate || 0`) — **`InventoryLot.js`'s schema does not define a `rate` field at all** (confirmed by full schema read, `06-DATABASE-AUDIT.md`), meaning `value` silently resolves to `0` for every lot unless some other code path is separately setting an undeclared Mongoose field (Mongoose will persist it if `strict` mode is off at the connection level, but it is never populated by `purchaseService.js`'s lot-creation code). This means **stock valuation in the Stock Report is effectively always ₹0**, a materially misleading MIS defect. |
| Dependencies | `InventoryLot`, `Item`. |
| Missing | A real `costPerUnit`/`rate`/`landedCost` field on `InventoryLot`, populated at lot-creation time from the originating `Purchase` line's rate (the job-receive cost-basis calculation in `jobService.js` lines 77-82 shows the team *does* know how to derive this — `purchaseCost / originalLot.totalMtrs` — but that derived value is used only for wastage-loss posting, never persisted back onto the lot itself). |
| Broken | Stock valuation (`stockValue` in `getReportBundle()`'s summary) is not reliable. |

### 4.4 Job Work

| Field | Detail |
|---|---|
| Purpose | Umbrella process for sending raw/semi-finished goods to a third-party worker (dyeing, printing, weaving) and receiving finished goods back. |
| Status | **COMPLETE** |
| Completion% | 70% |
| FE | `frontend/src/pages/jobwork/{IssueModal,ReceiveModal,UpdateModal,JobReceiptModal,ProcessUpdateModal}.jsx`; unreachable `frontend/src/pages/jobwork/JobWorkPage.jsx` (`DEAD_CODE`). |
| BE | `backend/controllers/jobController.js`, `backend/services/jobService.js`. |
| DB | `backend/models/Job.js` — `status` enum `['Issued','In-Process','Received','Cancelled']`. |
| API | `POST /api/jobs/issue`, `POST /api/jobs/receive`, `PUT /api/jobs/process`, `GET /api/jobs` — `featureGuard('jobWork')` only. |
| Business | `issueToJob()` validates available lot stock before issuing and records a signed `StockMovement` (`type: 'ISSUE'`); `receiveFromJob()` computes a genuine cost-per-meter from the originating purchase (`jobService.js` lines 72-82, explicitly commented `// FIXED: was hardcoded 100`) and posts both job-work-charge and abnormal-wastage accounting entries. This is one of the more mature modules in the system. |
| Dependencies | `InventoryLot`, `Party` (job worker), `Counter`, `AccountingEntry`. |
| Missing | No job-worker rate-card/piece-rate master (charges are entered ad hoc per receipt, `receiveData.charges`). |
| Broken | Auto-accounting on receive is explicitly non-transactional with the job update itself (`jobService.js` lines 120-140, wrapped in its own try/catch with a comment `// Non-critical — job is already received, do not rollback`) — meaning it is possible for a Job to be marked `Received` while its Job-Work-Charges accounting entry silently fails to post, with only a `console.error` as the record of the failure. |

### 4.5 Mill Issue

| Field | Detail |
|---|---|
| Purpose | Send goods to an external processing mill (a job-work sub-flow, textile-industry-specific labeling). |
| Status | **COMPLETE** (as an alias) |
| Completion% | 70% (inherits Job Work's completion) |
| FE | `Dashboard.jsx`'s `Inventory` menu: `{ label: 'Mill Issue', key: 'millIssue' }` plus **three additional aliases** — `{ label: 'Process', action: () => toggleModal('millIssue', true) }`, `{ label: 'Work Process', ... }`, `{ label: 'Cutting Entry', ... }` (lines 449, 455-457) — all four menu labels open the identical `IssueModal`. |
| BE | Same as Job Work — `POST /api/jobs/issue`. |
| DB | Same `Job` model, no `processType`-specific schema differentiation beyond the free-text `processType` field. |
| API | `POST /api/jobs/issue`. |
| Business | There is no backend concept of "Mill Issue" as distinct from generic "Job Issue" — `processType` is a free-text string on the `Job` document, so "Mill Issue," "Cutting," and generic "Job Issue" are indistinguishable at the data layer except by whatever label the user typed into that field. |
| Dependencies | Job Work module. |
| Missing | Any structured `processType` enum/taxonomy; any mill-specific master (rate card per mill, per process type). |
| Broken | Not broken, but the apparent process-stage granularity in the menu (Process / Work Process / Cutting / Mill Issue) does not correspond to four distinct backend behaviors — it is one endpoint with four button labels. |

### 4.6 Mill Receive

| Field | Detail |
|---|---|
| Purpose | Receive processed goods back from an external mill. |
| Status | **COMPLETE** (as an alias) |
| Completion% | 70% |
| FE | `Dashboard.jsx`'s `Inventory` menu: `{ label: 'Mill Receive', key: 'millRec' }` plus aliases `{ label: 'Beam Entry', action: () => toggleModal('millRec', true) }` and `{ label: 'Production', action: () => toggleModal('millRec', true) }` (lines 450, 458-459). |
| BE | Same as Job Work — `POST /api/jobs/receive`. |
| DB | Same `Job` model. |
| API | `POST /api/jobs/receive`. |
| Business | Identical situation to Mill Issue: "Beam Entry" and "Production" are UI labels with zero backend differentiation from "Mill Receive" / generic "Job Receive." |
| Dependencies | Job Work module. |
| Missing | Structured taxonomy for receive sub-types. |
| Broken | Same labeling-vs-behavior mismatch as Mill Issue. |

### 4.7 Production

| Field | Detail |
|---|---|
| Purpose | Track in-house or mill-based production stages/output (implied by the menu label, textile weaving/finishing context). |
| Status | **FAKE_UI** (as a distinct concept) |
| Completion% | 10% |
| FE | `Dashboard.jsx` line 459: `{ label: 'Production', action: () => toggleModal('millRec', true) }`. |
| BE | None dedicated — silently reuses `POST /api/jobs/receive`. |
| DB | None dedicated. |
| API | None dedicated. |
| Business | "Production" as a menu concept promises production-stage tracking (WIP, output yield, production planning) but is wired to open the exact same modal as "Mill Receive" — there is no production-planning, WIP-stage, or yield-tracking data model anywhere in the codebase. |
| Dependencies | Job Work module (borrowed). |
| Missing | Everything a Production module would actually need: WIP tracking, stage-of-completion, machine/line allocation, yield/efficiency reporting. |
| Broken | Label promises functionality that does not exist independently. |

---

## 5. Accounting & Books

### 5.1 Accounting

| Field | Detail |
|---|---|
| Purpose | The double-entry general-ledger engine underlying every financial module (Ledger, Journal, Payment, Receipt, Trial Balance, P&L, Balance Sheet). |
| Status | **PARTIAL** |
| Completion% | 65% |
| FE | `frontend/src/pages/accounting/{AccountingForms,AccountingPage,GSTReport}.jsx`, `frontend/src/pages/LedgerModal.jsx`. |
| BE | `backend/controllers/accountingController.js`, `backend/services/accountingService.js`. |
| DB | `backend/models/{LedgerMaster,AccountingEntry}.js`. |
| API | Full route table in `backend/routes/accountingRoutes.js` — `/api/accounting/ledgers*`, `/payments`, `/receipts`, `/trial-balance`, `/profit-loss`, `/balance-sheet`, `/outstanding`, `/journal` — gated only by `featureGuard('accounting')`. |
| Business | Genuinely sound double-entry core: `AccountingEntry`'s `pre('validate')` hook mathematically enforces `Σ Dr = Σ Cr` per entry (`AccountingEntry.js` lines 84-106); atomic `Counter`-based voucher numbering eliminates race-condition duplicate voucher numbers (a documented fix, `accountingService.js` lines 88-91: *"Old: countDocuments + 1 (duplicate keys under concurrency). New: MongoDB atomic $inc"*); `computeRunningBalances()` in `accountingController.js` uses a single aggregation pipeline instead of N+1 per-ledger queries (documented fix, lines 511-514). |
| Dependencies | Underlies Sales, Purchase, Job Work, Returns, Notes, Payment/Receipt vouchers. |
| Missing | Period-close/year-end roll-forward (see Balance Sheet, §5.11); any UI/API for manually correcting a mis-posted entry other than the reversal mechanism. |
| Broken | Fed by client-trusted amounts (`01-EXECUTIVE-SUMMARY.md §3.9`); the parallel orphaned `LedgerEntry`/`ledgerService.js` subsystem (`01-EXECUTIVE-SUMMARY.md §3.8`) creates a trap for anyone who calls `/api/ledgers/*` expecting real data. |

### 5.2 Cash Book

| Field | Detail |
|---|---|
| Purpose | Chronological day-book of all cash-mode transactions for a company. |
| Status | **FAKE_UI** |
| Completion% | 5% |
| FE | `Dashboard.jsx` line 433: `{ label: 'Cash Book', action: () => toggleModal('receipt', true) }`. |
| BE | None dedicated — reuses the generic Receipt Voucher endpoint. |
| DB | None dedicated — no `paymentMode: 'Cash'`-filtered day-book view exists anywhere in `reportService.js` or `accountingController.js`. |
| API | None dedicated. |
| Business | Clicking "Cash Book" opens a single-voucher creation modal (Receipt), not a day-book *view* of historical cash transactions — a user looking for "show me all cash in/out for this month" has no such report; the closest available data is the generic `getDailyTransactions()` in `reportService.js`, which is not filtered by payment mode. |
| Dependencies | PaymentVoucher (indirectly, via generic Receipt creation). |
| Missing | A real Cash Book report: a chronological, running-balance ledger of `PaymentVoucher` documents where `paymentMode === 'Cash'` (or any split containing a Cash leg), for a date range. |
| Broken | Menu label promises a day-book; delivers a single-voucher entry form. |

### 5.3 Bank Book

| Field | Detail |
|---|---|
| Purpose | Chronological day-book of all bank-mode transactions, typically per bank ledger. |
| Status | **FAKE_UI** |
| Completion% | 5% |
| FE | `Dashboard.jsx` line 434: `{ label: 'Bank Book', action: () => toggleModal('receipt', true) }` — **identical action to Cash Book**, same modal, same key. |
| BE | None dedicated. |
| DB | None dedicated. |
| API | None dedicated. |
| Business | Cash Book and Bank Book are, at the code level, the exact same menu action (`toggleModal('receipt', true)`) — there is no way, from this menu, to distinguish "show me the cash day-book" from "show me the bank day-book"; both simply open a blank Receipt Voucher creation form. The correct bank-side data (which ledger, which transactions) is only reachable via the generic Ledger Statement (`GET /api/accounting/ledgers/:id/statement`) by manually selecting the relevant Bank ledger. |
| Dependencies | LedgerMaster (bank-group ledgers), PaymentVoucher. |
| Missing | A dedicated Bank Book report, ideally per-bank-ledger, with reconciliation-relevant fields (`chequeNo`, `utrNo`, `chequeDate`) surfaced prominently. |
| Broken | Same as Cash Book — label vs. behavior mismatch. |

### 5.4 Ledger

| Field | Detail |
|---|---|
| Purpose | Per-account (party or system ledger) statement of all postings with a running balance. |
| Status | **PARTIAL — two competing implementations, one dead** |
| Completion% | 60% (live path) / 0% (dead path) |
| FE | `frontend/src/pages/LedgerModal.jsx` calls `fetchLedgerStatement()`/`fetchLedgers()` in `useStore.js`, which hit the **live** `/api/accounting/ledgers*` endpoints. A separate store action `fetchLedger(partyId)` (`useStore.js` lines 995-1003) calls `GET /api/ledgers/:partyId` — the **dead/orphaned** endpoint. |
| BE | Live: `accountingController.js` (`createLedger`, `listLedgers`, `getLedgerStatement`). Dead: `backend/controllers/ledgerController.js` + `backend/services/ledgerService.js`, reading from `backend/models/LedgerEntry.js`, which nothing ever writes to. |
| DB | Live: `LedgerMaster` + `AccountingEntry`. Dead: `LedgerEntry` (always empty). |
| API | Live: `POST/GET /api/accounting/ledgers`, `GET /api/accounting/ledgers/:id/statement`. Dead: `GET /api/ledgers/:partyId`, `GET /api/ledgers/balance/:partyId`. |
| Business | The live `getLedgerStatement()` correctly computes running balance from `openingBalance`/`openingBalanceType` forward through each matching `AccountingEntry` line (`accountingController.js` lines 163-191) — sound implementation. |
| Dependencies | `LedgerMaster`, `AccountingEntry`, `Party`. |
| Missing | Consolidation of the two systems into one. |
| Broken | Any code path (current or future) that calls `useStore.js`'s `fetchLedger()` (as opposed to `fetchLedgerStatement()`) will silently receive an always-empty result — see `01-EXECUTIVE-SUMMARY.md §3.8` for full detail. |

### 5.5 Journal

| Field | Detail |
|---|---|
| Purpose | Manual double-entry journal voucher for adjustments not covered by Sales/Purchase/Payment/Receipt auto-posting. |
| Status | **COMPLETE** |
| Completion% | 70% |
| FE | `frontend/src/pages/transactions/JournalEntryModal.jsx` (opened via `Dashboard.jsx`'s `openJournal()`, mapped to both "Journal (GST)" and "Stock Transfer (Jv)" menu labels — two different business intents routed to one generic form). |
| BE | `accountingController.exports.createJournalEntry`. |
| DB | `AccountingEntry` with `voucherType: 'Journal'`, `refType: 'Journal'`. |
| API | `POST /api/accounting/journal`. |
| Business | Delegates to the same `pre('validate')` double-entry enforcement as every other entry type — correct. Period-lock check (`checkPeriodLocked`) is applied here too. |
| Dependencies | `LedgerMaster`. |
| Missing | No line-item templates/quick-fill for common adjustment types. |
| Broken | "Stock Transfer (Jv)" aliasing a generic ledger journal (rather than a stock-quantity-aware transfer voucher) means an inter-lot/inter-location stock transfer recorded this way affects ledger balances but does **not** touch `InventoryLot.remainingMtrs` — the stock and books can drift out of sync if this menu item is used for its literal purpose. |

### 5.6 Payment

| Field | Detail |
|---|---|
| Purpose | Record outbound payments to suppliers/parties, optionally allocated against specific bills. |
| Status | **COMPLETE** |
| Completion% | 80% |
| FE | `frontend/src/pages/accounting/AccountingForms.jsx` (`PaymentForm`, aliased as `AccountingModal` in `Dashboard.jsx`). |
| BE | `accountingController.exports.createPaymentVoucher`. |
| DB | `backend/models/PaymentVoucher.js` (`voucherType: 'Payment'`). |
| API | `POST /api/accounting/payments`. |
| Business | Supports **split payments** across multiple modes in one voucher (`paymentSplits` array validated to sum to the voucher `amount`, `accountingController.js` lines 30-53) with per-mode reference requirements (Cheque number, NEFT/RTGS/UPI UTR) enforced (lines 55-62) — a genuinely thorough real-world payment model. Correctly updates `paidAmount`/`status` on the referenced `Sales`/`Purchase` document per `againstInvoices` allocation, inside the same transaction (lines 291-322). |
| Dependencies | `LedgerMaster` (party + bank), `Sales`/`Purchase` (for allocation). |
| Missing | No payment-approval workflow (`status` is binary `Draft`/`Posted`, set by whoever creates it — no maker-checker). |
| Broken | None found in the Payment path itself. |

### 5.7 Receipt

| Field | Detail |
|---|---|
| Purpose | Record inbound receipts from customers/parties, optionally allocated against specific invoices. |
| Status | **COMPLETE** |
| Completion% | 80% |
| FE | `frontend/src/pages/accounting/AccountingForms.jsx` (`ReceiptForm`, same component family as Payment) — also the target of the Cash Book/Bank Book aliasing (§5.2-5.3). |
| BE | `accountingController.exports.createReceiptVoucher`. |
| DB | `backend/models/PaymentVoucher.js` (`voucherType: 'Receipt'`). |
| API | `POST /api/accounting/receipts`. |
| Business | Mirror-image of Payment — same split-payment/reference-validation/invoice-allocation logic, correctly Dr Bank / Cr Party (`accountingController.js` lines 396-410) as opposed to Payment's Dr Party / Cr Bank. |
| Dependencies | Same as Payment. |
| Missing | Same as Payment (no approval workflow). |
| Broken | None found. |

### 5.8 Contra

| Field | Detail |
|---|---|
| Purpose | Record fund transfers between two of the company's own cash/bank ledgers (cash↔bank, bank↔bank). |
| Status | **MISSING** |
| Completion% | 0% |
| FE | No menu item, modal, or form found anywhere referencing "Contra." |
| BE | None. `backend/models/PaymentVoucher.js`'s `voucherType` enum is exactly `['Payment', 'Receipt']` — there is no third value. |
| DB | No schema support. |
| API | None. |
| Business | A Contra entry could currently only be crudely simulated via a manual Journal entry (Dr one bank ledger, Cr another) with no dedicated UI, no cheque/transfer-reference fields, and no distinct reporting bucket. |
| Dependencies | N/A |
| Missing | Everything: voucher type, UI, controller logic. |
| Broken | N/A — not implemented. |

### 5.9 Debit Note

| Field | Detail |
|---|---|
| Purpose | Formal adjustment document reducing amount owed to a supplier (or increasing amount owed by a customer), independent of a full return. |
| Status | **COMPLETE** |
| Completion% | 70% |
| FE | `frontend/src/pages/transactions/NoteModal.jsx` (`noteType='Debit'`, via `Dashboard.jsx`'s `openNote('Credit')` — note the Dashboard's only wired call defaults to `'Credit'`; Debit Note is reachable through the same modal's internal type toggle rather than a distinct menu entry). |
| BE | `backend/controllers/noteController.js`. |
| DB | `backend/models/DebitCreditNote.js` (`noteType` enum `['Debit','Credit']`). |
| API | `POST/GET /api/notes` — no server-side role/feature guard on this router. |
| Business | Correctly posts Dr Party Ledger / Cr Purchase A/c (with GST reversal split) when `status === 'Posted'` (`noteController.js` lines 71-88) — mirrors real accounting treatment. |
| Dependencies | `LedgerMaster`. |
| Missing | Any linkage/validation against an original Purchase Bill beyond a free-text `againstInvoiceNo` string. |
| Broken | None found in the note-posting logic itself. |

### 5.10 Credit Note

| Field | Detail |
|---|---|
| Purpose | Formal adjustment document reducing amount owed by a customer (or increasing amount owed to a supplier). |
| Status | **COMPLETE** |
| Completion% | 70% |
| FE | Same `NoteModal.jsx`, and this is the type the Dashboard's single wired menu entry (`Transaction → Debit/Credit Note`) actually opens by default (`openNote('Credit')`, `Dashboard.jsx` line 437). |
| BE | Same `noteController.js`. |
| DB | Same `DebitCreditNote.js`. |
| API | Same `/api/notes` route. |
| Business | Correctly posts Dr Sales A/c / Cr Party Ledger (`noteController.js` lines 54-63) — correct signing for a sales-side adjustment. |
| Dependencies | `LedgerMaster`. |
| Missing | Same free-text `againstInvoiceNo` linkage gap as Debit Note. |
| Broken | None found. |

### 5.11 Trial Balance

| Field | Detail |
|---|---|
| Purpose | List every ledger's Dr/Cr closing balance as of a given date, the foundational report all other statements derive from. |
| Status | **COMPLETE** |
| Completion% | 80% |
| FE | Reachable via `Dashboard.jsx`'s `fetchTrialBalance()` (store action) — surfaced through the Accounting/Reports UI. |
| BE | `accountingController.exports.getTrialBalance`. |
| DB | Computed from `LedgerMaster` + `AccountingEntry` via `computeRunningBalances()`. |
| API | `GET /api/accounting/trial-balance`. |
| Business | The single-aggregation-pipeline `computeRunningBalances()` (lines 515-567) is efficient and correct: opening balance signed by `openingBalanceType`, then adjusted by aggregated `Σ Dr − Σ Cr` per ledger for the period — a technically sound report. |
| Dependencies | `LedgerMaster`, `AccountingEntry`. |
| Missing | No comparative (prior-period) column. |
| Broken | None found — this report is arithmetically reliable given its inputs (subject to the input-trust caveat in §3.9). |

### 5.12 Balance Sheet

| Field | Detail |
|---|---|
| Purpose | Statement of Assets = Liabilities + Capital as of a point in time. |
| Status | **PARTIAL — structurally incomplete** |
| Completion% | 40% |
| FE | Reachable via the Accounting/Reports UI. |
| BE | `accountingController.exports.getBalanceSheet`. |
| DB | Same `computeRunningBalances()` source as Trial Balance, filtered to `Assets`/`Liabilities`/`Capital` groups only. |
| API | `GET /api/accounting/balance-sheet`. |
| Business | **Excludes Income and Expense ledgers from the computation entirely, with no year-end closing/roll-forward mechanism to sweep net profit into Capital** — see full defect writeup in `01-EXECUTIVE-SUMMARY.md §3.2`. The report does self-report an `isBalanced` boolean, which is honest about the mismatch when it occurs, but does not fix it. |
| Dependencies | `LedgerMaster`, `AccountingEntry`. |
| Missing | Automatic (or manual, via the fake "Closing/UnClosing Year" Utilities menu item, §7.1) transfer of net Income − Expenses into a Capital/Retained-Earnings ledger. |
| Broken | Will not balance for any company with real trading activity within the reporting period. |

### 5.13 P&L (Profit & Loss)

| Field | Detail |
|---|---|
| Purpose | Statement of Income − Expenses over a period. |
| Status | **PARTIAL — two divergent implementations** |
| Completion% | 55% |
| FE | Reachable via Reports Hub (`key: 'pl'`) and Accounting UI (`fetchProfitLoss()`). |
| BE | Two separate implementations: (1) `accountingController.exports.getProfitLoss` — ledger-group-based (`Income`/`Expenses` groups from `LedgerMaster`/`AccountingEntry`); (2) `reportService.getProfitLoss()` — **document-based**, directly summing `Sales.taxableAmount` and `Purchase.taxableAmount` with no reference to the ledger system at all (`reportService.js` lines 251-278). |
| DB | (1) `LedgerMaster`+`AccountingEntry`; (2) `Sales`+`Purchase` collections directly. |
| API | `GET /api/accounting/profit-loss` (ledger-based) vs. `GET /api/reports/pl` (document-based). |
| Business | These two P&L computations **can legitimately disagree** — the ledger-based version includes Job Work Charges, Production Loss, and any manual Journal entries touching Income/Expense ledgers; the document-based version only ever sees Sales and Purchase taxable amounts, with no Job Work or manual-adjustment visibility at all. A user comparing the two reports for the same period should expect different numbers, with no in-product explanation of why. |
| Dependencies | Both `LedgerMaster` chain and `Sales`/`Purchase` collections independently. |
| Missing | Reconciliation or a single canonical source of truth between the two P&L code paths. |
| Broken | Not "broken" in the crash sense, but a serious data-consistency/trust issue for a report CFOs and CAs will scrutinize closely. |

---

## 6. GST Compliance

### 6.1 GSTR1

| Field | Detail |
|---|---|
| Purpose | Outward-supply return: B2B/B2CL/B2CS invoice-level detail plus HSN summary, in the shape required for GSTN filing. |
| Status | **PARTIAL** |
| Completion% | 55% |
| FE | `frontend/src/pages/gst/{GSTPage,GstModals,CADashboardModal}.jsx`. |
| BE | `backend/services/gstService.js` (`getGstr1`), `backend/controllers/gstController.js`. |
| DB | Reads `Sales` (populated with `Party`/`Item`). |
| API | `GET /api/gst/gstr1` — `featureGuard('gst')` only. |
| Business | Correctly buckets invoices into B2B (registered GSTIN ≥15 chars)/B2CL (unregistered, taxable > ₹2,50,000)/B2CS (else), and builds a per-HSN summary using each item's actual `gstRate` (a documented fix — comment: *"FIXED: Use actual item GST rate instead of hardcoded 5%"*, line 74). |
| Dependencies | `Sales`, `Item`, `Party`, `Company.meta.gstin`. |
| Missing | Digital signature/EVC, actual GSTN-schema-conformant file export, amendment (B2BA/B2CLA) support, HSN-summary `rt` field defaulting to `5` for the B2CS bucket regardless of actual mixed rates (line 63). |
| Broken | `hash: 'hash'` is a literal placeholder string, not a computed integrity hash (`gstService.js` line 110) — see `01-EXECUTIVE-SUMMARY.md §3.7`. |

### 6.2 GSTR2

| Field | Detail |
|---|---|
| Purpose | Inward-supply return / ITC register, ideally reconciled against supplier-filed GSTR-1 data (GSTR-2A/2B). |
| Status | **STUB** |
| Completion% | 35% |
| FE | Same GST module screens as GSTR1. |
| BE | `gstService.getGstr1... getGstr2()`. |
| DB | Reads `Purchase` (populated with `Party`/`Item`). |
| API | `GET /api/gst/gstr2`. |
| Business | This is a **purchase register re-shaped to look like GSTR-2**, not a reconciliation tool — it never ingests any counterparty-filed GSTR-1/2A/2B data (there is no external GSTN API integration anywhere in the codebase), so it cannot flag mismatches between what the company recorded and what suppliers actually filed, which is the entire point of a real GSTR-2/2B workflow. |
| Dependencies | `Purchase`, `Item`, `Party`. |
| Missing | GSTN 2A/2B ingestion, ITC eligibility cross-check, mismatch flagging. |
| Broken | Not broken, but materially mis-scoped relative to what "GSTR2" implies to a CA/compliance user. |

### 6.3 GSTR3B

| Field | Detail |
|---|---|
| Purpose | Monthly summary return: outward tax liability, ITC claimed, net tax payable. |
| Status | **STUB** |
| Completion% | 40% |
| FE | Surfaced only as a sub-block inside `CADashboardModal.jsx` / `GstModals.jsx`'s `Gst3bMonthlyModal`/`Gst3bDetailModal` — there is no independent `/gst/gstr3b` endpoint. |
| BE | Computed inline inside `gstService.getCADashboard()` (lines 258-279) — not its own service method or route. |
| DB | Derived from the same `Sales`/`Purchase` aggregates as GSTR1/GSTR2. |
| API | Bundled into `GET /api/gst/ca-dashboard` (no standalone `GET /api/gst/gstr3b`). |
| Business | Computes outward tax (taxable/CGST/SGST/IGST), ITC (same breakdown from GSTR2), and net tax payable — arithmetically reasonable **given** GSTR1/GSTR2's own limitations (§6.1-6.2 above) — but there is no submission/filing step, no challan generation, no set-off-rule application (IGST-ITC-first-against-IGST-then-CGST-then-SGST ordering per actual GST law is not modeled — it's a flat `net = outward − itc` per tax head). |
| Dependencies | `Sales`, `Purchase`. |
| Missing | Real GST set-off-rule ordering, challan/payment generation, filing submission. |
| Broken | Not broken as an internal MIS number; not filing-ready. |

### 6.4 TDS

| Field | Detail |
|---|---|
| Purpose | Tax Deducted at Source tracking — deduction on applicable payments, TDS certificate/return support. |
| Status | **FAKE_UI** |
| Completion% | 10% |
| FE | `Dashboard.jsx` line 438: `{ label: 'Tds Entry', action: () => toggleModal('payment', true) }` — opens the generic Payment voucher modal, with no TDS-specific fields surfaced. |
| BE | No TDS-specific controller, service, or route anywhere in `backend/`. |
| DB | `Party.tdsPer` field exists (rate %) and `CompanySettings.tdsEnabled` toggle exists, plus `Book.tdsHead`/`tdsCode` fields on the Book master — but **no code anywhere reads any of these fields** to compute or post a TDS deduction. |
| API | None dedicated (rides on `POST /api/accounting/payments`). |
| Business | There is no TDS ledger (no "TDS Payable" or "TDS Receivable" system ledger in `SYSTEM_LEDGER_TEMPLATES`, `accountingService.js` lines 6-26), no automatic deduction at payment time, and no TDS return/certificate (Form 16A-equivalent) generation. |
| Dependencies | Would need `Party.tdsPer`, `CompanySettings.tdsEnabled`, a new system ledger, and posting logic in `accountingService.js`. |
| Missing | Everything except a rate field on the Party master and a menu label. |
| Broken | Menu label promises a TDS workflow; delivers a generic, TDS-unaware payment form. |

### 6.5 Outstanding

| Field | Detail |
|---|---|
| Purpose | Party-wise receivable/payable aging report. |
| Status | **COMPLETE**, with a **performance caveat** |
| Completion% | 75% |
| FE | `frontend/src/pages/reports/SalesOutstanding.jsx`, Dashboard menu `Others Reports → Outstanding` / `Outstanding Zoom`. |
| BE | Two implementations again: `accountingController.getOutstandingReport()` and `reportService.getOutstanding()` — both compute conceptually the same thing (per-party aging buckets: 30/60/90/90+ days) independently. |
| DB | `Sales`/`Purchase` + `PaymentVoucher` (for paid-amount netting). |
| API | `GET /api/accounting/outstanding`, `GET /api/reports/outstanding`. |
| Business | Aging-bucket logic is correct and consistent between both implementations (`ageInDays <= 30/60/90` else `90Plus`). |
| Dependencies | `Party`, `Sales`, `Purchase`, `PaymentVoucher`. |
| Missing | Consolidation of the duplicate implementation. |
| Broken | **Performance**: both implementations call `PaymentVoucher.find({...'againstInvoices.invoiceId': doc._id})` **inside a nested loop over every party and every one of that party's invoices** (`accountingController.js` lines 676-687; `reportService.js`'s `paidAgainstDoc()` helper, called once per invoice in `getSalesRegister`/`getPurchaseRegister`/`getOutstanding`) — this is an N+1 (really N×M) query pattern that will degrade sharply as invoice volume grows; there is no aggregation-pipeline rewrite here despite one existing elsewhere in the same file (`computeRunningBalances`). |

---

## 7. Reporting, Configuration & Platform

### 7.1 Reports

| Field | Detail |
|---|---|
| Purpose | Umbrella reporting hub — sales/purchase registers, stock, job-work, outstanding, daily transactions, master lists, combined "report bundle." |
| Status | **COMPLETE** |
| Completion% | 70% |
| FE | `frontend/src/pages/reports/{ReportsHub,ReportsPage,SalesOutstanding}.jsx`. |
| BE | `backend/controllers/reportController.js`, `backend/services/reportService.js`. |
| DB | Reads across `Sales`, `Purchase`, `InventoryLot`, `Job`, `Party`, `Item`, `Book`, `PaymentVoucher`. |
| API | Full table in `backend/routes/reportRoutes.js`: `/bundle`, `/sales`, `/purchases`, `/stock`, `/outstanding`, `/pl`, `/jobwork`, `/daily`, `/masters` — `featureGuard('reports')` only. |
| Business | `getReportBundle()` (lines 352-415) is a well-composed `Promise.all` fan-out that assembles a full MIS snapshot in one call — good API ergonomics for a dashboard consumer. Inherits the Stock-valuation defect (§4.3) and the duplicate-P&L/duplicate-Outstanding inconsistency (§5.13, §6.5) as pass-through issues. |
| Dependencies | Nearly every other module. |
| Missing | Export-to-Excel/PDF for these reports was not found as a backend capability (any PDF export appears to be client-side via `jspdf`/`html2pdf.js`, per `frontend/package.json` dependencies, operating on already-rendered DOM rather than server-generated files). |
| Broken | Passes through the Stock/P&L/Outstanding defects noted above. |

### 7.2 Settings

| Field | Detail |
|---|---|
| Purpose | Per-company configuration — legal identity, financial year, GST scheme, voucher prefixes, branding, notification toggles. |
| Status | **COMPLETE** |
| Completion% | 75% |
| FE | `frontend/src/pages/SettingsPage.jsx`, `frontend/src/pages/admin/CompanyConfig.jsx`. |
| BE | `admin.controller.js` (`getCompanyConfig`/`saveCompanyConfig`), `config.controller.js` (`getActiveConfig`/`getConfigVersion`, tenant-side). |
| DB | `backend/models/CompanySettings.js` — a very wide, well-organized settings document (identity/contact/financial/vouchers/notifications/branding/custom-fields/limit-overrides). |
| API | Tenant: `GET /api/config/active`, `GET /api/config/version`. Admin: `GET/PUT /api/admin/company/:id/config`. |
| Business | `config.controller.js`'s `getActiveConfig` correctly checks `Company.status !== 'suspended'` before serving config and returns cache-control + version/hash headers (`X-Config-Version`, `X-Config-Hash`) enabling client-side live-reload polling via `getConfigVersion` — a thoughtful piece of the dynamic-config architecture. |
| Dependencies | `Company`, `configMetaSchema` mixin (versioning). |
| Missing | Field-level validation (e.g., GSTIN format on `CompanySettings.gstin`). |
| Broken | None found. |

### 7.3 Admin

| Field | Detail |
|---|---|
| Purpose | Platform super-admin backplane — the whole `/admin/*` SPA and its API surface. |
| Status | **COMPLETE** |
| Completion% | 80% |
| FE | `frontend/src/layouts/AdminLayout.jsx` + all `frontend/src/pages/admin/*.jsx`. |
| BE | `backend/controllers/{admin.controller,adminConfig.controller}.js`. |
| DB | Spans `Company`, `Plan`, `Subscription`, `License`, `Usage`, `AuditLog`, `CompanyModuleConfig`, plus the entire dynamic-config model family. |
| API | Full table under `backend/routes/admin.routes.js`, gated by `roleMiddleware(['super_admin'])` globally on the router (the one router in the whole backend with real role enforcement beyond Users). |
| Business | `getAdminStats()` computes MRR by summing active `Subscription`s weighted by `billingCycle` (monthly vs. yearly ÷ 12) and builds a 6-month historical revenue trend by re-querying subscriptions active in each historical month window (`admin.controller.js` lines 289-360) — a real, if computation-heavy (repeated `.find()` per month rather than a single aggregation), analytics feature. |
| Dependencies | Everything platform-level. |
| Missing | Company deletion/offboarding; plan-change migration tooling (changing a company's `planId` does not appear to reconcile already-created `CompanyModuleConfig`/`FeatureFlag` overrides against the new plan's feature set). |
| Broken | None found. |

### 7.4 Subscription

| Field | Detail |
|---|---|
| Purpose | Track each tenant's billing plan, cycle, and active/expired status; gate ERP API access accordingly. |
| Status | **PARTIAL** |
| Completion% | 55% |
| FE | `frontend/src/pages/admin/Subscriptions.jsx`. |
| BE | `admin.controller.js` (`getAllSubscriptions`, `updateSubscription`); enforcement in `backend/middlewares/subscription.middleware.js`. |
| DB | `backend/models/Subscription.js` — `status` enum `['trial','active','expired']`, `billingCycle` enum `['monthly','yearly']`; **no unique index on `companyId`**, so nothing in the schema prevents multiple `Subscription` documents existing for the same company simultaneously. |
| API | `GET /api/admin/subscriptions`, `PUT /api/admin/subscription/:companyId` (upsert). |
| Business | `updateSubscription`'s use of `findOneAndUpdate(..., { upsert: true })` combined with the missing unique index means repeated admin edits are safe (they'll match and update the existing doc), but any code path that ever does a plain `Subscription.create()` for a company that already has one (there is no explicit guard against this) could produce duplicate active subscriptions, and `subscriptionMiddleware`'s `Subscription.findOne({companyId})` would then non-deterministically pick whichever document Mongo returns first. |
| Dependencies | `Company`, `Plan`. |
| Missing | Payment-gateway integration (no Razorpay/Stripe/etc. dependency in `backend/package.json`) — `autoRenew`/`lastPaymentAt` fields exist but nothing automates renewal or records real payment events. |
| Broken | Enforcement is bypassed under `NODE_ENV=development` (`01-EXECUTIVE-SUMMARY.md §3.4`). |

### 7.5 License

| Field | Detail |
|---|---|
| Purpose | A secondary, license-key-based activation layer on top of the Subscription, presumably for offline/desktop-style activation semantics. |
| Status | **PARTIAL** |
| Completion% | 50% |
| FE | `frontend/src/pages/admin/Licenses.jsx`. |
| BE | `admin.controller.js` (`generateLicense`, `renewLicense`); enforcement in `subscription.middleware.js`. |
| DB | `backend/models/License.js` — `licenseKey` (globally unique), `checksum`, `expiresAt`, `isActive`. No unique index on `companyId`, so (like Subscription) multiple license rows per company are not prevented at the schema level. |
| API | `POST /api/admin/license/generate`, `PUT /api/admin/license/:companyId/renew`. |
| Business | `generateLicense()`'s ad-hoc path sets `checksum: 'CHECKSUM_PLACEHOLDER'` (`admin.controller.js` line 229, with the code comment `// Ideally actual checksum`) — a genuine placeholder left in a security-adjacent field, distinct from the `createCompany` provisioning path which does compute a real SHA-256-derived checksum (`admin.controller.js` lines 85-91). This is an inconsistency between two license-issuance code paths in the same controller. |
| Dependencies | `Company`, `backend/utils/license.js` (`generateLicenseKey`). |
| Missing | Any verification step anywhere that actually validates `checksum` against the `licenseKey` — the field is stored but never checked in `subscription.middleware.js`'s license-gate logic (which only checks `isActive` and `expiresAt`). |
| Broken | The checksum concept is half-implemented: computed on one path, placeholder on another, verified on neither. |

### 7.6 Company (see also §1.3)

Covered fully under Foundation & Identity above; included here only for cross-reference since it is both a master-data and a platform-admin concern.

### 7.7 Audit Logs (see also §1.7)

Covered fully under Foundation & Identity above.

---

## 8. Summary Table (All Modules, At a Glance)

| # | Module | Status | Completion% |
|---|---|---|---:|
| 1 | Auth | PARTIAL | 75% |
| 2 | Dashboard | PARTIAL | 65% |
| 3 | Party | COMPLETE | 85% |
| 4 | Account | PARTIAL | 55% |
| 5 | Broker | PARTIAL | 40% |
| 6 | Item | COMPLETE | 85% |
| 7 | HSN | STUB | 20% |
| 8 | GST (overall, see 6.1-6.3) | PARTIAL | 45% |
| 9 | Warehouse | MISSING | 0% |
| 10 | Purchase | COMPLETE (+ dead duplicate) | 80% |
| 11 | Purchase Return | PARTIAL | 60% |
| 12 | Sales | COMPLETE | 80% |
| 13 | Sales Return | PARTIAL (broken at runtime) | 45% |
| 14 | Inventory | COMPLETE | 75% |
| 15 | Lots | COMPLETE (partial defect) | 75% |
| 16 | Stock | COMPLETE (valuation broken) | 75% |
| 17 | Job Work | COMPLETE | 70% |
| 18 | Mill Issue | COMPLETE (alias) | 70% |
| 19 | Mill Receive | COMPLETE (alias) | 70% |
| 20 | Production | FAKE_UI | 10% |
| 21 | Accounting | PARTIAL | 65% |
| 22 | Cash Book | FAKE_UI | 5% |
| 23 | Bank Book | FAKE_UI | 5% |
| 24 | Ledger | PARTIAL (dual system) | 60% |
| 25 | Journal | COMPLETE | 70% |
| 26 | Payment | COMPLETE | 80% |
| 27 | Receipt | COMPLETE | 80% |
| 28 | Contra | MISSING | 0% |
| 29 | Debit Note | COMPLETE | 70% |
| 30 | Credit Note | COMPLETE | 70% |
| 31 | Trial Balance | COMPLETE | 80% |
| 32 | Balance Sheet | PARTIAL | 40% |
| 33 | P&L | PARTIAL (dual system) | 55% |
| 34 | GSTR1 | PARTIAL | 55% |
| 35 | GSTR2 | STUB | 35% |
| 36 | GSTR3B | STUB | 40% |
| 37 | TDS | FAKE_UI | 10% |
| 38 | Outstanding | COMPLETE (perf caveat) | 75% |
| 39 | Reports | COMPLETE | 70% |
| 40 | Settings | COMPLETE | 75% |
| 41 | Admin | COMPLETE | 80% |
| 42 | Subscription | PARTIAL | 55% |
| 43 | License | PARTIAL | 50% |
| 44 | Users | COMPLETE | 85% |
| 45 | Roles | PARTIAL | 35% |
| 46 | Permissions | STUB | 30% |
| 47 | Company | PARTIAL | 70% |
| 48 | Audit Logs | PARTIAL | 45% |

**Simple average across all 48 modules: ~57%**, consistent with the Executive Summary's holistic "~55–60% complete" estimate — the module-by-module view and the top-down scorecard triangulate to the same conclusion independently.
