# 07 — Complete API Audit

Full static inspection of every Express route, controller, service, and model backing `/api/*`. Every endpoint below was traced from `backend/routes/*.js` → controller → service → Mongoose model. Where the frontend calls an endpoint, the calling file/line is cited from `frontend/src/store/useStore.js`, `useAdminStore.js`, or the relevant page/component. Endpoints with **no** matching frontend call are marked **Orphan (BE-only)**. Endpoints the frontend calls that have **no** matching backend route are marked **Broken (FE calls missing route)**.

---

## 0. Global request pipeline

```1:52:backend/routes/index.js
router.use('/auth', authRoutes);

// Protected Routes
router.use(authMiddleware);
router.use(subscriptionMiddleware);

router.use('/purchases', purchaseRoutes);
...
```

Every route except `/api/auth/*` passes through, in order:

1. **`authMiddleware`** (`backend/middlewares/auth.middleware.js`) — verifies JWT, loads `User`, attaches `req.user` / `req.companyId`, blocks suspended companies (403).
2. **`subscriptionMiddleware`** (`backend/middlewares/subscription.middleware.js`) — verifies `Subscription.status === 'active'` and `License` validity, **unless** `req.user.role === 'super_admin'` **or** `process.env.NODE_ENV === 'development'` (full bypass — see `12-SECURITY-AUDIT.md`).
3. Some route groups add **`guard(moduleName)`** (`backend/utils/featureGuard.js`) — checks the company's `Plan.features.modules[moduleName]`, super_admin bypasses.
4. `backend/routes/admin.routes.js` additionally requires **`roleMiddleware(['super_admin'])`**.

No route in this codebase enforces the per-user `PermissionMatrix` or `companyRole` (owner/admin/manager/accountant/salesman/viewer) at the Express layer — see finding **SEC-07** in `12-SECURITY-AUDIT.md`. All "permission" enforcement below is UI-only (`frontend/src/utils/permissions.js`) unless explicitly noted.

**Legend:**
| Symbol | Meaning |
|---|---|
| ✅ | Used by frontend, call site cited |
| ⚠️ | Called by FE but request/response shape mismatch, or partially used |
| ❌ | Orphan — no frontend caller found anywhere in `frontend/src` |
| 🔴 | Broken — FE calls a URL that does not exist as a backend route |

---

## 1. AUTH — `/api/auth` (no `authMiddleware`, no `subscriptionMiddleware`)

Router: `backend/routes/auth.routes.js`. Controller: `backend/controllers/auth.controller.js`. Service: `backend/services/auth.service.js`. Model: `User`, `Company`, `Plan`, `Subscription`, `License`.

| # | Method | URL | Auth |
|---|---|---|---|
| 1.1 | POST | `/api/auth/register` | None |
| 1.2 | POST | `/api/auth/login` | None |
| 1.3 | POST | `/api/auth/forgot-password` | None |
| 1.4 | POST | `/api/auth/reset-password` | None |
| 1.5 | GET | `/api/auth/me` | JWT (`authMiddleware` only, route-local) |

### 1.1 `POST /api/auth/register` ✅
- **Auth:** None (public signup).
- **Validation:** Controller checks `name`, `email`, `password`, `companyName` truthy (`auth.controller.js:5-8`); no email-format, password-strength, or company-name-length validation. `User.email` has a schema-level `unique` index (duplicate → Mongo E11000, surfaced as generic 400).
- **Controller → Service:** `authController.register` → `authService.register()` (`backend/services/auth.service.js:27-137`).
- **What it does (transaction-free, sequential writes — no `mongoose.startSession`):**
  1. Creates/fetches `Basic` `Plan`.
  2. Creates `User` (`role: 'user'`, `companyRole: 'owner'`).
  3. Creates `Company` (`ownerId`, `planId`).
  4. `accountingService.seedSystemLedgers(companyId)` — best-effort, errors only logged (`catch` swallows).
  5. Re-saves `User.companyId`.
  6. Creates a 30-day trial `Subscription` (`status: 'active'` — **not `'trial'`** even though the schema enum includes `'trial'`).
  7. Creates a `License` with `checksum = sha256(companyId-TRIAL + JWT_SECRET)`, truncated to 8 hex chars.
  8. `configService.seedCompanyDefaults()` — seeds `CompanyModuleConfig`, `CompanySettings`, `FormConfig`, `BillConfig`, `ColumnConfig`, `FeatureFlag`, `NotificationConfig`, `ReportConfig`, `PermissionMatrix`.
  9. Signs JWT (30-day expiry, no refresh token).
- **Success (201):** `{ token, user: { id, name, email, role, companyRole, companyId, plan, moduleConfig, settings, configVersion } }`.
- **Errors:** 400 `Email already registered`; 400 on any thrown error (generic `err.message` leak — no sanitization).
- **Used by FE:** ✅ `frontend/src/pages/auth/SignupPage.jsx:33`.
- **Broken/Missing:** No transaction wrapping steps 2–9 — a crash between step 3 (Company created) and step 6 (Subscription created) leaves an **orphaned Company with no Subscription/License**, which will then fail every subsequent login's `subscriptionMiddleware` check with 402/403 in production (masked in dev by the `NODE_ENV==='development'` bypass). No password strength rule; a 1-character password is accepted by the `User` schema.

### 1.2 `POST /api/auth/login` ✅
- **Auth:** None.
- **Validation:** `email` + `password` required (400 if missing). No rate limiting, no lockout after N failed attempts, no CAPTCHA.
- **Controller → Service:** `authService.login()` (`auth.service.js:139-220`).
- **Logic:** `User.findOne({ email }).select('+password')` → `bcrypt.compare` via `user.comparePassword` → 401 `Invalid credentials` (does not distinguish "no such user" vs "wrong password" — good practice) → checks `isActive` (401 `Account deactivated`) → signs JWT → resolves `companyId`/plan/moduleConfig/settings, auto-seeding config on first login if missing.
- **Success (200):** Same shape as register.
- **Errors:** 401 for bad credentials/deactivated account.
- **Used by FE:** ✅ `frontend/src/utils/loginService.js:28`.
- **Broken/Missing:** No brute-force protection (see `12-SECURITY-AUDIT.md` SEC-03). Super-admin login path re-queries `Company.findOne().sort({createdAt:1})` on **every** login — the oldest tenant is silently treated as the super-admin's "home company" (tenant-bleed risk, SEC-09).

### 1.3 `POST /api/auth/forgot-password` ✅
- **Auth:** None.
- **Validation:** `email` required.
- **Controller → Service:** `authService.forgotPassword()` (`auth.service.js:226-245`).
- **Logic:** Looks up user; **always** returns a generic success message (anti-enumeration — correct). Generates `crypto.randomBytes(32)` token, stores **sha256 hash** on `User.passwordResetToken`, 1-hour expiry.
- **Success (200):** `{ message, devToken? }` — `devToken` is the **raw unhashed token**, returned in the HTTP response body whenever `NODE_ENV === 'development'`.
- **Errors:** None thrown for unknown email (by design).
- **Used by FE:** ✅ `frontend/src/pages/auth/ForgotPasswordPage.jsx:20` (fire-and-forget, does not read `devToken`).
- **Broken/Missing:** **No email is ever sent.** The `TODO: Send email with resetToken` comment (`auth.service.js:240`) is the entire "delivery" mechanism — actual delivery is `console.log('[DEV] Password reset token for ...')` (`auth.service.js:242`), i.e. the reset flow **only works by reading the server console** or the `devToken` field. In a real production deployment (`NODE_ENV` unset or `production`) the user receives the generic message and the token is written **only to server stdout** — password reset is non-functional for end users. See SEC-10.

### 1.4 `POST /api/auth/reset-password` ✅ (endpoint exists, but see above — practically unreachable without console/log access)
- **Auth:** None (token-bearing).
- **Validation:** `token`, `password` required.
- **Controller → Service:** `authService.resetPassword()` (`auth.service.js:250-265`) — re-hashes provided token with sha256, matches against stored hash + expiry, sets new password (re-triggers the `pre('save')` bcrypt hook), clears reset fields.
- **Success (200):** `{ message: 'Password has been reset successfully.' }`.
- **Errors:** 400 `Password reset token is invalid or has expired.`
- **Used by FE:** No dedicated "Reset Password" page found under `frontend/src/pages/auth/` (only `ForgotPasswordPage.jsx` and `LoginPage.jsx`/`SignupPage.jsx` exist) — ❌ **Orphan**: backend supports the full reset flow but no frontend route consumes the token to call this endpoint.

### 1.5 `GET /api/auth/me` ✅
- **Auth:** `authMiddleware` only (deliberately **not** behind `subscriptionMiddleware`, since it is the endpoint that tells the client *whether* the subscription is valid downstream via `moduleConfig`/`plan`).
- **Controller:** `auth.controller.js:29-88` (logic duplicated almost verbatim from `login`/`register` — no shared helper; three copies of the same "resolve company/plan/config" block exist across the codebase).
- **Success (200):** `{ user: { id, name, email, role, companyRole, companyId, plan, company, moduleConfig, settings } }`.
- **Used by FE:** ✅ `frontend/src/store/useStore.js:198` — called on app bootstrap to hydrate the session.
- **Broken/Missing:** For `super_admin` with no `companyId`, silently falls back to the oldest company in the DB (same tenant-bleed pattern as login).

---

## 2. PURCHASES — `/api/purchases` (+ `guard('purchase')`)

Router: `backend/routes/purchase.routes.js`. Controller: `backend/controllers/purchaseController.js`. Service: `backend/services/purchaseService.js` (**live** stack). Model: `Purchase`, `InventoryLot`, `StockMovement`, `AccountingEntry`.

> ⚠️ A second, **dead** purchase stack exists: `backend/controllers/purchase.controller.js` + `backend/services/purchase.service.js` + `backend/models/Inventory.js`. It is not wired into `routes/index.js` and is unreachable from any HTTP route — confirmed by `Grep` of all `require('../controllers/purchase.controller')` call sites (none outside itself). It writes to the legacy `Inventory` model (flat `lotNo`/`currentStock`, no lot depletion, no accounting posting) and would silently diverge from the real stock ledger if ever wired up. Documented here only as a dead-code risk, not as a live endpoint.

| # | Method | URL | Controller fn |
|---|---|---|---|
| 2.1 | POST | `/api/purchases` | `createPurchase` |
| 2.2 | GET | `/api/purchases` | `getPurchases` |
| 2.3 | GET | `/api/purchases/:id` | `getPurchase` |
| 2.4 | PUT | `/api/purchases/:id/status` | `updatePurchaseStatus` |
| 2.5 | DELETE | `/api/purchases/:id` | `deletePurchase` |

### 2.1 `POST /api/purchases` ✅
- **Guard:** `guard('purchase')` — requires `Plan.features.modules.purchase === true`.
- **Validation:** No explicit controller-level validation; relies entirely on the `Purchase` Mongoose schema (`supplierId`, `invoiceNo`, `taxableAmount`, `netAmount` required). `companyId` is **forced server-side** (`req.body.companyId = req.companyId` — safe, `purchaseController.js:6`).
- **Controller → Service → Model:** `purchaseService.createPurchase()` (`purchaseService.js:8-73`), fully wrapped in a Mongo **transaction** (`session.startTransaction()`):
  1. Atomic `Counter.nextSeq('PUR-{companyId}')` → auto `invoiceNo` (`PUR-{seq}`) unless client supplies a non-`'AUTO'` value (client-suppliable invoice numbers are **not** re-validated for uniqueness beyond the schema's compound unique index `{invoiceNo, companyId}` — duplicate submission surfaces as a raw Mongo E11000 error, not a friendly message).
  2. Generates a random string `lotId` per line item (`LOT-{timestamp}-{random 4-digit}` — **not** collision-checked; two purchases saved within the same millisecond with the same random draw could theoretically collide, mitigated only by the compound unique index `{lotId, companyId}` on `InventoryLot`, which would then hard-fail the transaction).
  3. Creates one `InventoryLot` (`status: 'Available'`, `source: 'purchase'`) + one `StockMovement` (`type: 'PURCHASE'`) per line item.
  4. Calls `accountingService.onPurchaseBillPost(purchase, session)` **inside** the transaction (comment: `FIXED: Accounting posting INSIDE transaction (was outside before — silent failures)` — evidence of a prior production bug).
  5. Persists `purchase.accountingEntryId`.
- **Success (201):** `{ success: true, data: <Purchase document, unpopulated> }`.
- **Errors:** 400 with raw `error.message` (Mongoose validation errors, duplicate-key errors, insufficient-stock messages from downstream all surface verbatim to the client).
- **Used by FE:** ✅ `useStore.js:630` (`createPurchase`).
- **Broken/Missing:** No server-side re-computation of `taxableAmount`/`gstAmount`/`netAmount`/`cgst`/`sgst`/`igst` from line items — the client-computed totals are trusted as-is (see `12-SECURITY-AUDIT.md` — client-trusted financial amounts). No `PUT /api/purchases/:id` full-edit route exists (only `:id/status`) — see 2.4 note.

### 2.2 `GET /api/purchases` ✅
- **Validation:** None on filters.
- **Service:** `purchaseService.getPurchases(companyId, {page, limit, startDate, endDate, status})` (`purchaseService.js:75-100`) — supports pagination (`skip`/`limit`, default `limit=100`) and date-range/status filters, `.populate('supplierId')`, `.populate('items.itemId')`.
- **Success (200):** `{ success: true, data: { purchases: [...], total, page, limit } }`.
- **Used by FE:** ✅ `useStore.js:582` — `` `/purchases${queryParams ? '?' + queryParams : ''}` ``.
- **Notes:** `companyId` resolution is `req.companyId || req.query.companyId` (`purchaseController.js:17`) — client-controlled fallback; harmless while every authenticated user always has a `req.companyId`, but a latent IDOR pattern (see SEC-08).

### 2.3 `GET /api/purchases/:id` ⚠️
- **Service:** `getPurchaseById()` — scoped by `{_id, companyId}` (correct tenant isolation), 404 `Purchase not found` if cross-tenant ID guessed.
- **Used by FE:** ⚠️ No direct `api.get('/purchases/${id}')` call site was found in `frontend/src` — the Purchase view/print/edit modals read the already-fetched record from the Zustand `purchases` list in memory rather than re-fetching by ID. The backend route is reachable and correct but effectively **unused by the current UI**.

### 2.4 `PUT /api/purchases/:id/status` 🔴 (mismatched with FE edit flow)
- **Validation:** `validStatuses = ['active','cancelled','paid','partial']` (`purchaseService.js:111`).
- **Used by FE:** ✅ for status-only updates — `useStore.js:713` (`api.put('/purchases/${id}/status', {status})`).
- **Broken:** `useStore.js:688` also calls `api.put('/purchases/${id}', enriched)` (full-document edit) — **there is no `PUT /api/purchases/:id` route**; only `/:id/status` exists. Any "Edit Purchase" UI action that hits this code path will receive an Express 404 (no matching route falls through to Express's default handler, not the app's JSON error middleware, so the client likely sees an HTML 404 page instead of a JSON error). This is a genuine broken feature, not merely unused.

### 2.5 `DELETE /api/purchases/:id` ✅
- **Service:** `deletePurchase()` (`purchaseService.js:125-183`), transactional. If `status` is `'active'`/`'partial'`, does **not** hard-delete — instead posts a full **reversal `AccountingEntry`** (flips every `Dr`/`Cr` line), marks the original entry `isReversed: true`, and sets `Purchase.status = 'cancelled'`. Only a genuinely `'cancelled'` purchase is ever hard-deleted from Mongo.
- **Broken/Missing:** Deletion/cancellation **does not restore or adjust `InventoryLot`/`StockMovement`** — if goods from a cancelled purchase were already partially consumed by a sale or job issue, cancelling the purchase leaves stock figures unreconciled against the accounting reversal (accounting says the purchase never happened; the lot/stock ledger still shows it did, minus whatever was consumed). No compensating stock movement is created.
- **Used by FE:** ✅ `useStore.js:651`.

---

## 3. SALES — `/api/sales` (+ `guard('sales')`)

Router: `backend/routes/salesRoutes.js`. Controller: `backend/controllers/salesController.js`. Service: `backend/services/salesService.js`. Model: `Sales`, `InventoryLot`, `StockMovement`, `AccountingEntry`. Structurally a mirror of Purchases — differences only are called out.

| # | Method | URL | Controller fn |
|---|---|---|---|
| 3.1 | POST | `/api/sales` | `createInvoice` |
| 3.2 | GET | `/api/sales` | `getSales` |
| 3.3 | GET | `/api/sales/:id` | `getSale` |
| 3.4 | PUT | `/api/sales/:id/status` | `updateSaleStatus` |
| 3.5 | DELETE | `/api/sales/:id` | `deleteSale` |

### 3.1 `POST /api/sales` ✅
- **Guard:** `guard('sales')`.
- **Controller → Service:** `salesService.createInvoice()` (`salesService.js:8-68`), transactional:
  1. Atomic `Counter.nextSeq('INV-{companyId}')` → `INV-{seq}`.
  2. For each line item **with a `lotId`**: loads `InventoryLot`, throws `Lot not found` if missing, throws `Insufficient stock in Lot {lotId}. Available: {n} mtrs` if `remainingMtrs < item.mts` — **hard stock check, enforced server-side** (good). Decrements `remainingMtrs`/`remainingPcs`, flips `status` to `'Closed'`/`'Partially Used'`.
  3. **Line items without a `lotId` bypass all stock validation entirely** — a sale can be recorded for an item with zero traceable inventory if the UI ever omits `lotId` (e.g. a quick manual entry flow). No fallback "reduce from any available lot for this item" logic exists — `lotId` is mandatory *in practice* for stock integrity but not enforced by the schema (`Sales.items.lotId` default `null`).
  4. `accountingService.onSalesInvoicePost(sales, session)` inside the transaction.
- **Success (201):** `{ success: true, data: <Sales document> }`.
- **Used by FE:** ✅ `useStore.js:794`.
- **Broken/Missing:** Same client-trusted-totals issue as Purchases. No credit-limit check against `Party.creditLimit` before allowing a sale (field exists on `Party` schema, never read anywhere in `salesService`/`salesController`).

### 3.2 `GET /api/sales` ✅ — `useStore.js:746`. Same pagination/filter shape as Purchases.

### 3.3 `GET /api/sales/:id` ⚠️ — reachable, tenant-scoped correctly, but ❌ not directly called by FE (list-cache reuse, same as Purchases).

### 3.4 `PUT /api/sales/:id/status` 🔴 — same broken pattern as Purchases: FE calls `api.put('/sales/${id}', enriched)` at `useStore.js:852` for full edits, but only `PUT /api/sales/:id/status` exists server-side. **Editing a saved Sales Invoice from the UI is broken** (404 against a non-existent route). Status-only transitions via `useStore.js:877` work correctly.

### 3.5 `DELETE /api/sales/:id` ✅ — `useStore.js:815`. Same reversal-entry pattern as Purchases; explicit code comment confirms **stock is intentionally NOT restored on cancellation** (`salesService.js:120-121`: *"Inventory stock is NOT restored on cancellation (goods already dispatched). For stock restoration, use Sales Return workflow."*) — meaning cancelling a sale that was created in error (not actually shipped) permanently strands the stock as "sold" unless the operator remembers to also file a Sales Return.

---

## 4. INVENTORY — `/api/inventory` (no feature guard registered on this router)

Router: `backend/routes/inventory.routes.js`. Controller: `backend/controllers/inventoryController.js`. Service: `backend/services/inventoryService.js`. Model: `InventoryLot`, `StockMovement`.

> **Notable gap:** unlike every sibling module, `inventory.routes.js` has **no `guard('inventory')`** call — inventory endpoints are reachable by any authenticated, subscribed user regardless of their plan's `features.modules.inventory` flag.

| # | Method | URL | Controller fn |
|---|---|---|---|
| 4.1 | POST | `/api/inventory/opening-stock` | `createOpeningStock` |
| 4.2 | GET | `/api/inventory` | `getInventory` |
| 4.3 | GET | `/api/inventory/lots` | `getLotsByItem` |
| 4.4 | GET | `/api/inventory/lot/:lotId` | `getLotDetails` |
| 4.5 | GET | `/api/inventory/stock/:itemId` | `getItemStock` |

### 4.1 `POST /api/inventory/opening-stock` ✅
- **Validation:** `itemId` + `mts > 0` required (`inventoryService.js:28-30`); no GST/accounting side effects at all (see 10-ACCOUNTING-AUDIT.md — "Opening stock has no accounting entry").
- **Logic:** Creates one `InventoryLot` (`lotId: OPN-{timestamp}`, `source: 'opening'`) + one `StockMovement` (`type: 'OPENING'`). No transaction wrapping (two sequential non-atomic saves — a crash between them leaves an orphaned lot with no movement record).
- **Success (201):** `{ success: true, data: <InventoryLot> }`.
- **Used by FE:** ✅ `useStore.js:726`.

### 4.2 `GET /api/inventory` ✅ — `useStore.js:916`. Returns **every** `InventoryLot` for the company with no pagination — on a company with thousands of historical lots this is an unbounded query (see `13-PERFORMANCE-AUDIT.md` scope, flagged here as a correctness/scale risk).

### 4.3 `GET /api/inventory/lots?itemId=` ❌ — controller queries `InventoryLot.find({itemId, companyId})` directly (bypassing the service layer entirely — the only controller in the Inventory module that does this). No frontend call site found for `/inventory/lots` — **orphan**.

### 4.4 `GET /api/inventory/lot/:lotId` ❌ — `inventoryService.getLotDetails()` returns `{lot, movements}` (full stock-movement audit trail for one lot — genuinely useful for a "Lot Details"/"Stock Ledger" drill-down screen per `DEFAULT_SUB_MENUS.inventory` in `backend/config/defaultConfigs.js`). No FE call site found — **orphan**; the "Lot Details" submenu entry appears to have no wired screen calling this endpoint.

### 4.5 `GET /api/inventory/stock/:itemId` ❌ — aggregate `{totalMtrs, totalPcs, lotCount}` for one item. No FE call site found — **orphan**.

---

## 5. ITEMS — `/api/items` (no feature guard)

Router: `backend/routes/itemRoutes.js`. Controller/Service: `itemController.js` / `itemService.js`. Model: `Item`.

| # | Method | URL |
|---|---|---|
| 5.1 | POST | `/api/items` |
| 5.2 | GET | `/api/items` |
| 5.3 | GET | `/api/items/search?q=` |
| 5.4 | GET | `/api/items/:id` |
| 5.5 | PUT | `/api/items/:id` |
| 5.6 | DELETE | `/api/items/:id` |

- **5.1 POST** ✅ `useStore.js:492` — `itemService.createItem()` (`itemService.js:4-48`) normalizes many alternate field-name aliases (`name`/`itemName`, `fabricType`/`fabricQuality`, `design`/`designNo`/`designName`, `purchaseRate`/`purRate`, `salesRate`/`saleRate`, `openingStock`/`opStock`) — evidence of merged/legacy field conventions from an earlier schema version. Duplicate-name check per company (400 `Item with this name already exists`). **`openingStock` field is accepted and stored on `Item` but never creates a corresponding `InventoryLot`/`StockMovement`** — opening stock must be separately entered via `POST /api/inventory/opening-stock`; the two "opening stock" concepts (item-level number vs. lot-level record) are disconnected and can silently drift.
- **5.2 GET** ✅ `useStore.js:461` — unbounded `Item.find({companyId})`, no pagination.
- **5.3 GET /search** ✅ `useStore.js:557` — regex search across `name`/`hsnCode`/`design`, `limit(10)`. Unescaped user input passed directly into a Mongo `$regex` (`{ $options: 'i' }`) — a user-supplied value containing regex metacharacters (e.g. `.*`, `(`, `|`) is not sanitized; this is a minor ReDoS/behavior-surprise risk rather than an injection risk (Mongo `$regex` cannot execute code), but pathological input (e.g. deeply nested quantifiers) could cause slow queries.
- **5.4 GET /:id** ⚠️ Reachable, tenant-scoped, but no direct FE call site found (edit modals reuse cached list data) — orphan in practice.
- **5.5 PUT /:id** ✅ `useStore.js:513`. `companyId` resolution: `req.companyId || req.body.companyId || req.query.companyId` (`itemController.js:49`) — the **body** is also trusted as a companyId source on update, a broader IDOR surface than the read endpoints (see SEC-08).
- **5.6 DELETE /:id** ✅ `useStore.js:534`. **No check for existing references** — deleting an `Item` that is referenced by historical `Sales.items[].itemId`, `Purchase.items[].itemId`, or `InventoryLot.itemId` leaves those documents with a dangling `ObjectId` reference; all `.populate('items.itemId')` calls elsewhere will silently return `null` for the item, breaking historical invoice/report rendering (item name blank).

---

## 6. PARTIES — `/api/parties` (no feature guard)

Router: `backend/routes/partyRoutes.js`. Controller/Service: `partyController.js` / `partyService.js`. Model: `Party`.

Same CRUD + search shape as Items.

- **6.1 POST `/api/parties`** ✅ `useStore.js:379`. Explicitly rejects when `req.companyId` is missing (400 `No company context...` — `partyController.js:5-7`, the **only** controller in the codebase with this explicit guard). Auto-assigns next `accd` (legacy Tally-style account code) per company. Normalizes `group` string (`CREDITOR`/`DEBTOR`/`BROKER`/`JOB`/`WORKER`) into the `type` enum. **`'Both'` is a valid `type` enum value but is never derivable from the `group`-normalization logic** — a party can only become `type: 'Both'` via direct API/DB manipulation, not through the documented normalization rules, yet `accountingService.getOrCreatePartyLedger()` explicitly branches on `'Both'` as a creditor (see `10-ACCOUNTING-AUDIT.md`).
- **6.2 GET `/api/parties`** ✅ `useStore.js:348` — unbounded.
- **6.3 GET `/api/parties/search`** ✅ `useStore.js:444`.
- **6.4 GET `/api/parties/:id`** ⚠️ orphan in practice (list-cache reuse).
- **6.5 PUT `/api/parties/:id`** ✅ `useStore.js:400` — allow-listed field patch (`partyService.js:102-110`, 30+ fields), same triple-fallback `companyId` resolution as Items (`req.companyId || req.body.companyId || req.query.companyId`).
- **6.6 DELETE `/api/parties/:id`** ✅ `useStore.js:421` — **no reference check**; deleting a `Party` referenced by historical `Sales.customerId`/`Purchase.supplierId`/`Job.workerId`/`LedgerMaster.linkedPartyId` leaves dangling references and breaks the party ledger / outstanding reports for that party retroactively.

---

## 7. JOBS — `/api/jobs` (+ `guard('jobWork')`)

Router: `backend/routes/jobRoutes.js`. Controller/Service: `jobController.js` / `jobService.js`. Model: `Job`, `InventoryLot`, `StockMovement`.

| # | Method | URL | Controller fn |
|---|---|---|---|
| 7.1 | POST | `/api/jobs/issue` | `issueToJob` |
| 7.2 | POST | `/api/jobs/receive` | `receiveFromJob` |
| 7.3 | PUT | `/api/jobs/process` | `updateProcess` |
| 7.4 | GET | `/api/jobs` | `getJobs` |

### 7.1 `POST /api/jobs/issue` ✅ `useStore.js:960`
- **Logic (transactional):** Atomic `Counter.nextSeq('JC-{companyId}')` → `jobCardNo`. Validates `lot.remainingMtrs >= issueQty` (hard stock check, throws otherwise). Creates `Job` (`status: 'Issued'`). Decrements the source lot, logs a `StockMovement` (`type: 'ISSUE'`).
- **Notes:** No accounting entry is posted on issue (correct — job-work issue is a stock transfer, not an expense; the expense is recognized on **receive**, matching real job-work economics). `processType` is a free-text string on the schema, not a `SubMaster`-backed lookup, so process names ("Dyeing", "Printing", "Sizing"...) can be inconsistently typed across job cards with no validation against a master list.

### 7.2 `POST /api/jobs/receive` ✅ `useStore.js:970`
- **Logic (transactional):** Loads `Job`, rejects if already `'Received'`. Computes `costPerMeter` from the **original purchase's** `taxableAmount / totalMtrs` (comment: `FIXED: Calculate cost per meter from actual purchase data` — was previously hardcoded to `100`, evidence of a real prior bug now patched). Updates `Job` (`receivedQty`, `receivedPcs`, `wastage`, `status: 'Received'`). Creates a **brand-new finished-goods `InventoryLot`** (`source: 'job_receive'`, lot ID `{origLot}-FIN-{timestamp}`) — the original grey lot is **not** reduced further at receive time (it was already fully debited at issue time); the new finished lot is independent stock.
- **Accounting side effects — run OUTSIDE the transaction, wrapped in try/catch that only logs on failure** (`jobService.js:120-140`, comment: *"Auto-accounting triggers (outside transaction — non-critical, logged only)"*): posts `onJobWorkChargesPost()` (Dr Job Work Charges + GST Input, Cr Job Worker payable, with real inter-state/intra-state CGST+SGST vs IGST split based on `Party.gstin`/`CompanySettings.gstin` state-code comparison — this is the **one** place in the codebase that does GSTIN-based inter-state detection correctly, contrasted with Sales/Purchase which use a manual dropdown, see `11-GST-AUDIT.md`), then `onAbnormalWastagePost()` if `wastage > 0`.
- **Failure point:** Because accounting posting is **explicitly outside** the DB transaction here (unlike Sales/Purchase, which were "FIXED" to move posting inside), a Job Receive can complete successfully (stock created, job marked received) while its accounting entry silently fails to post — the `console.error('Auto accounting on job receive failed:', ae)` is the only trace, and the operation is **not rolled back**. This directly contradicts the fix applied to Sales/Purchase and is a regression risk / inconsistency worth flagging to engineering.
- **Success (200):** `{ success: true, data: { job, newLot } }`.

### 7.3 `PUT /api/jobs/process` ✅ `useStore.js:981` — simple status transition (`Issued|In-Process|Received|Cancelled`); note `'Received'` is reachable via this endpoint too, **bypassing** the cost-calculation / new-lot-creation / accounting-posting logic that `receiveFromJob` performs — if the UI ever calls `updateProcess(jobId, 'Received')` instead of `POST /jobs/receive`, the job is marked received with **no finished lot created and no accounting posted**, a silent data-integrity gap.

### 7.4 `GET /api/jobs` ✅ `useStore.js:941` — `.populate('lotId').populate('workerId', 'name gstin state')`, unbounded, no pagination. Supports an optional `status` filter in the service (`jobService.js:162`) that is **never passed by any FE call site** — dead parameter.

> **"Mill Issue/Mill Receive" and "Production" UI aliases:** `backend/config/defaultConfigs.js` defines sub-menus `Mill Issue`, `Mill Receive`, `Job Issue`, `Job Receive`, `Update Job` under the `jobWork` module, and `Dashboard.jsx` exposes menu items for "Mill Issue"/"Mill Receive" as **separate labels that open the same Job Issue/Job Receive modals** — there is no distinct "Mill" vs. "Job Worker" data model; both are simply a `Party` with `type: 'Job Worker'` routed through the identical `/api/jobs/issue` and `/api/jobs/receive` endpoints. See `08-BUSINESS-FLOWS.md` and `09-TEXTILE-DOMAIN.md` for the domain implications (no distinction between an in-house "mill/process house" and an external job worker, and no dedicated shop-floor "Production" entity/route exists anywhere in the backend — it is a UI label only).

---

## 8. ACCOUNTING — `/api/accounting` (+ `guard('accounting')`)

Router: `backend/routes/accountingRoutes.js`. Controller: `accountingController.js`. Service: `accountingService.js`. Models: `LedgerMaster`, `AccountingEntry`, `PaymentVoucher`, `Party`, `Sales`, `Purchase`, `Counter`, `Company`.

| # | Method | URL | Controller fn |
|---|---|---|---|
| 8.1 | POST | `/api/accounting/ledgers` | `createLedger` |
| 8.2 | GET | `/api/accounting/ledgers` | `listLedgers` |
| 8.3 | GET | `/api/accounting/ledgers/:id/statement` | `getLedgerStatement` |
| 8.4 | POST | `/api/accounting/payments` | `createPaymentVoucher` |
| 8.5 | POST | `/api/accounting/receipts` | `createReceiptVoucher` |
| 8.6 | GET | `/api/accounting/payments` | `listVouchers` |
| 8.7 | GET | `/api/accounting/trial-balance` | `getTrialBalance` |
| 8.8 | GET | `/api/accounting/profit-loss` | `getProfitLoss` |
| 8.9 | GET | `/api/accounting/balance-sheet` | `getBalanceSheet` |
| 8.10 | GET | `/api/accounting/outstanding` | `getOutstandingReport` |
| 8.11 | POST | `/api/accounting/journal` | `createJournalEntry` |

### 8.1 `POST /api/accounting/ledgers` ✅ `useStore.js:1031`
- **Security:** Explicit code comment `// SECURITY FIX: Always use server-side companyId from JWT, never trust req.body` (`accountingController.js:94-95`) — evidence this endpoint was previously vulnerable to a client-supplied `companyId` and was patched; a useful marker that a security pass happened on this specific controller but not uniformly across the rest of the API (see Items/Parties above, which still trust `req.body.companyId`).
- **Validation:** `checkPeriodLocked(companyId, new Date())` — blocks ledger creation if `Company.settings.lockedUntilDate` is in the future relative to "now" (creating a ledger is treated as a dated transaction for lock purposes, which is arguably too strict — a pure master-data create should not be period-locked).
- **Model constraint:** `LedgerMaster` schema enforces `group` ∈ `{Assets, Liabilities, Income, Expenses, Capital}` and a compound-unique `{companyId, name}` index.

### 8.2 `GET /api/accounting/ledgers` ✅ `useStore.js:1013` — supports `group`, `partyId`, `search` filters.

### 8.3 `GET /api/accounting/ledgers/:id/statement` ✅ `useStore.js:1138`
- **Logic:** Fetches the `LedgerMaster`, verifies `ledger.companyId === req.companyId` (403 `Unauthorized access to this ledger` if not — correct tenant isolation), queries all non-reversed `AccountingEntry` docs whose `lines[].ledgerId` matches, computes a **running balance** starting from `openingBalance`/`openingBalanceType`.
- **Success (200):** `{ ledger, openingBalance, openingBalanceType, closingBalance, closingBalanceType, statement: [{date, voucherNo, voucherType, narration, debit, credit, runningBalance, balanceType}] }`.
- **Notes:** `entry.lines.find(l => l.ledgerId.toString() === ledger._id.toString())` takes only the **first** matching line per entry — if a single journal entry has the same ledger appearing on both a Dr and a Cr line (legal in the schema, though unusual), only one of the two lines is reflected in the statement, silently under/over-stating that entry's contribution.

### 8.4 `POST /api/accounting/payments` ✅ `useStore.js:1068`
- **Logic (transactional):** `normalizePaymentDetails()` (`accountingController.js:24-78`) validates `amount > 0`, supports **split payments** across multiple modes (`paymentSplits[]`), cross-checks split total equals voucher `amount` (±0.01 tolerance), requires a reference/UTR for `Cheque`/`NEFT`/`RTGS`/`UPI`. Resolves/creates the party ledger via `getOrCreatePartyLedger`. If `status === 'Posted'`, creates a balanced `AccountingEntry` (`Dr Party, Cr Bank`) and updates `paidAmount`/`status` on any linked `Sales`/`Purchase` docs in `againstInvoices[]` (tries `Sales` first, then `Purchase` — a `continue` after a `Sales` match means a shared/ambiguous ID cannot double-apply, but also means the code assumes IDs never collide across the two collections, which Mongo `ObjectId`s guarantee in practice).
- **`checkPeriodLocked`** applies here too.
- **`Draft` vs `Posted` vouchers:** a `Draft` voucher is saved with **no accounting entry and no invoice-paid-amount update** — it exists purely as a record until (if ever) transitioned to `Posted`. **No endpoint exists to transition a Draft voucher to Posted after creation** (`PUT /api/accounting/payments/:id` does not exist) — a Draft voucher is a dead-end record with no way to post it later short of direct DB edit. This is a **missing endpoint**.

### 8.5 `POST /api/accounting/receipts` ✅ `useStore.js:1114` — mirror of Payments (`Dr Bank, Cr Party`). Same Draft dead-end gap.

### 8.6 `GET /api/accounting/payments` ✅ `useStore.js:1494` — lists both Payment and Receipt vouchers (`voucherType` filter optional); endpoint name is singular ("payments") but serves both types — a naming inconsistency that has no functional impact but is confusing.

### 8.7 `GET /api/accounting/trial-balance` ✅ `useStore.js:1150`
- **Logic:** `computeRunningBalances()` (`accountingController.js:515-567`) — single aggregation pipeline (`$unwind` + `$group`) across all `AccountingEntry.lines`, **fixed from a prior N+1-per-ledger pattern** (comment: *"FIXED: Uses MongoDB aggregation (single query) instead of N+1 per-ledger queries"*).
- **Notes:** Does **not** exclude `LedgerMaster` docs with `isActive: false` — a deactivated ledger still appears in the Trial Balance if it has any historical postings, which is arguably correct for TB (TB should reflect all balances) but is not documented behavior.

### 8.8 `GET /api/accounting/profit-loss` ✅ `useStore.js:1164` — `computeRunningBalances(companyId, to, from)`, filters `group ∈ {Income, Expenses}`. See `10-ACCOUNTING-AUDIT.md` for the "dual P&L" finding (this ledger-based P&L disagrees with `reportService.getProfitLoss()`, which is invoice-based).

### 8.9 `GET /api/accounting/balance-sheet` ❌ **Orphan** — no FE call site found anywhere in `frontend/src` (grep for `balance-sheet` returns only this backend route). The Balance Sheet report, despite being fully implemented server-side (`isBalanced` check, Assets/Liabilities/Capital breakdown), **has no UI screen wired to it**. See `10-ACCOUNTING-AUDIT.md` for the `isBalanced` correctness bug (P&L profit/loss is never plugged into Capital, so `isBalanced` is `false` for any company with net income ≠ 0).

### 8.10 `GET /api/accounting/outstanding` ✅ `useStore.js:1175`
- **Performance:** For every matching `Party`, issues a separate `Sales.find()`/`Purchase.find()`, then for **every document** issues a separate `PaymentVoucher.find()` — genuine **N+1 query pattern** (`accountingController.js:659-709`), unlike the Trial Balance which was already fixed to a single aggregation. On a company with hundreds of parties and thousands of invoices this endpoint's latency scales linearly with total transaction count, not company count.
- **Note:** This is a **separate, near-duplicate implementation** of `reportService.getOutstanding()` (used by `/api/reports/outstanding`) — two independently-maintained outstanding/aging calculators exist in the codebase with slightly different output shapes (`totalOutstanding` here vs. `totalOutstanding` + full per-invoice breakdown in reports) and could drift.

### 8.11 `POST /api/accounting/journal` ✅ `useStore.js:1520`
- **Validation:** Relies entirely on `AccountingEntry`'s Mongoose `pre('validate')` hook (`AccountingEntry.js:84-106`) to enforce `Σ Dr === Σ Cr` (±0.01) — the **only** server-side double-entry guard in the whole app, and it is schema-level, so it protects **every** write path that creates an `AccountingEntry`, not just this endpoint.
- **Missing:** No `checkPeriodLocked` call on this specific handler (present on `createLedger`/`createPaymentVoucher`/`createReceiptVoucher` but **omitted** on manual journal entries) — a locked accounting period can still be circumvented via a raw manual journal entry, which is precisely the entry point period-locking is meant to prevent.

---

## 9. LEDGERS (legacy) — `/api/ledgers` (no feature guard, no `guard()` call at all)

Router: `backend/routes/ledgerRoutes.js`. Controller: `ledgerController.js`. Service: `ledgerService.js`. Model: **`LedgerEntry`** (dead parallel books, distinct from the live `AccountingEntry`/`LedgerMaster` stack).

| # | Method | URL |
|---|---|---|
| 9.1 | GET | `/api/ledgers/:partyId` |
| 9.2 | GET | `/api/ledgers/balance/:partyId` |

### 9.1 `GET /api/ledgers/:partyId` ✅ `useStore.js:998` 🔴 **Tenant-isolation bug (confirmed IDOR)**
- **Logic:** `ledgerController.getPartyLedger` reads `companyId` **exclusively from `req.query.companyId`** (`ledgerController.js:6`) — it does **not** read `req.companyId` from the authenticated JWT context at all for the primary query. `ledgerService.getPartyLedger(partyId, companyId, ...)` then builds `LedgerEntry.find({accountId: partyId, companyId})`.
  - If the frontend caller (`useStore.js:998`, `` `/ledgers/${partyId}` ``) **does not append `?companyId=...`**, the query executes with `companyId: undefined`. Mongoose strips keys whose value is `undefined` from a `.find()` filter before it reaches the driver, so the effective query becomes `LedgerEntry.find({accountId: partyId})` — **matching that `partyId` across every company/tenant in the database**, not just the caller's own company.
  - If an attacker (or a compromised/malicious authenticated tenant user) explicitly supplies `?companyId=<victim-company-id>`, the endpoint returns another tenant's ledger entries for any `partyId` the attacker can guess/enumerate, with zero ownership check against `req.companyId`.
- **Severity:** This is a genuine cross-tenant data-leak vector, not merely a theoretical one, because the controller performs **no comparison whatsoever** between the caller's authenticated company and the queried company.
- **Mitigating factor:** The `LedgerEntry` collection is populated only by `ledgerService.postToLedger()`, which — per `03/05-...-AUDIT.md` cross-references and the absence of any controller `require('../services/ledgerService').postToLedger` call site found in this inspection — **appears to be dead/unused** in the live Sales/Purchase/Job/Accounting flows (those all post to `AccountingEntry`, not `LedgerEntry`). The vulnerability is real, but its blast radius today is limited to whatever `LedgerEntry` data happens to exist (likely near-empty in a live deployment). It should still be fixed or the route removed.

### 9.2 `GET /api/ledgers/balance/:partyId` ✅ (reachable, used indirectly) 🔴 **Same class of bug, worse priority order**
- **Logic:** `ledgerController.getAccountBalance` — `` const balance = await ledgerService.getAccountBalance(partyId, companyId || req.companyId); `` (`ledgerController.js:26`). Here the **query-string `companyId` takes priority over** the authenticated `req.companyId` (the `||` order is reversed compared to most of the rest of the codebase) — an authenticated user can **explicitly override their own tenant context** by passing `?companyId=<any-id>` and receive that other company's account balance for a guessed `partyId`.
- **Used by FE:** Not called with an explicit `companyId` query param anywhere found in `frontend/src` (the sibling `getPartyLedger` call in `ledgerController.js:8` invokes `ledgerService.getAccountBalance(partyId, companyId)` without the override — so the *live* call path is safe by omission, but the **route itself, if hit directly**, is exploitable).

---

## 10. GST — `/api/gst` (+ `guard('gst')`)

Router: `backend/routes/gstRoutes.js`. Controller: `gstController.js`. Service: `gstService.js`. Models: `Sales`, `Purchase`, `ReturnInvoice`, `DebitCreditNote`, `Company`.

| # | Method | URL |
|---|---|---|
| 10.1 | GET | `/api/gst/gstr1` |
| 10.2 | GET | `/api/gst/gstr2` |
| 10.3 | GET | `/api/gst/ca-dashboard` |

Full compliance-correctness findings are in `11-GST-AUDIT.md`; this section covers only the API contract.

### 10.1 `GET /api/gst/gstr1?startDate=&endDate=` ✅ `useStore.js:890`
- **Success (200):** `{ gstin, fp, version: 'GST3.2.2', hash: 'hash', b2b: [], b2cl: [], b2cs: [], hsn: {data: []}, invoices: [] }` — shaped to loosely resemble the GSTN JSON schema for offline-utility import, but `hash: 'hash'` is a **literal hardcoded string, not a computed hash** (`gstService.js:110`) — any consumer expecting a real GSTN-format signature hash will receive a non-functional placeholder.
- **Errors:** 500 with raw message on any DB failure — no distinction between "no data for period" (should be 200 with empty arrays, which it correctly does) and a real server error.

### 10.2 `GET /api/gst/gstr2?startDate=&endDate=` ✅ `useStore.js:895` — returns a **flat array** of purchase rows, not the B2B/Import/RCM-categorized structure real GSTR-2/2A/2B has. See `11-GST-AUDIT.md`.

### 10.3 `GET /api/gst/ca-dashboard?startDate=&endDate=` ✅ `useStore.js:900`
- Sets `Cache-Control: private, max-age=10` (10-second client cache — reasonable for a dashboard aggregation).
- Aggregates GSTR-1 + GSTR-2 + `ReturnInvoice` + `DebitCreditNote` into one payload with a computed `gstr3b` summary block and a rule-based `warnings[]` array (large-B2C-without-GSTIN check, zero-GST-on-taxable check, missing-HSN check, missing-supplier-GSTIN check).
- **Bug (cited fact, confirmed in code):** `noteGst = notes.reduce((s, n) => s + (n.gstAmount || 0), 0)` (`gstService.js:232`) — the `DebitCreditNote` Mongoose schema (`backend/models/DebitCreditNote.js`) **has no `gstAmount` field at all** (only `amount`); `n.gstAmount` is always `undefined`, so `noteGst` is **always `0`** regardless of actual note values, silently under-representing GST impact of debit/credit notes in the CA dashboard summary.

---

## 11. REPORTS — `/api/reports` (+ `guard('reports')`)

Router: `backend/routes/reportRoutes.js`. Controller: `reportController.js`. Service: `reportService.js`. Models: `InventoryLot`, `Sales`, `Purchase`, `Party`, `Item`, `Job`, `PaymentVoucher`, `Book`.

| # | Method | URL | Used by FE |
|---|---|---|---|
| 11.1 | GET | `/api/reports/bundle` | ✅ `useStore.js:1186` |
| 11.2 | GET | `/api/reports/sales` | ❌ Orphan |
| 11.3 | GET | `/api/reports/purchases` | ❌ Orphan |
| 11.4 | GET | `/api/reports/stock` | ✅ `useStore.js:1195` |
| 11.5 | GET | `/api/reports/outstanding` | ❌ Orphan |
| 11.6 | GET | `/api/reports/pl` | ❌ Orphan |
| 11.7 | GET | `/api/reports/jobwork` | ❌ Orphan |
| 11.8 | GET | `/api/reports/daily` | ❌ Orphan |
| 11.9 | GET | `/api/reports/masters` | ❌ Orphan |

### 11.1 `GET /api/reports/bundle?startDate=&endDate=` ✅
- **Logic:** `reportService.getReportBundle()` (`reportService.js:352-415`) runs **eight** report generators in `Promise.all` (Sales Register, Purchase Register, Stock Report, Stock-by-Item, Job Work Report, Outstanding Receivable, Outstanding Payable, Profit & Loss) plus Daily Transactions and Master Summary, then computes a rolled-up `summary` object. `Cache-Control: private, max-age=15`.
- **This single endpoint is the sole reason endpoints 11.2–11.3 and 11.5–11.9 are orphaned** — the frontend's "Reports" screen appears to call the bundle once and slice the response client-side rather than hitting each individual report endpoint, meaning **6 of 9 report endpoints exist, work correctly, and are entirely unreachable from the shipped UI.** They remain valid, independently-callable API surface (useful for external integrations/exports) but represent dead weight if the goal is a lean API surface, and duplicate logic that already runs inside the bundle (identical `reportService` methods are called both individually by these routes and collectively by `getReportBundle`).
- **Performance:** `getOutstanding()` (invoked twice inside the bundle, once per type) is itself an N+1 query pattern (`await PaymentVoucher.find(...)` inside a `for` loop over every invoice of every party) — see `13-PERFORMANCE-AUDIT.md` scope; called here twice per bundle request compounds the cost.

### 11.4 `GET /api/reports/stock` ✅ — thin wrapper over `reportService.getStockReport()`, same data as `/api/inventory` but reshaped/uppercased for report display (`itemName.toUpperCase()`) and adds a computed `value = remainingMtrs * rate` — **`InventoryLot.rate` does not exist on the `InventoryLot` schema** (`backend/models/InventoryLot.js` has no `rate` field), so `l.rate || 0` always evaluates to `0`, and **every stock report's computed `value`/`stockValue` is permanently `0`** regardless of actual purchase cost — a real correctness bug in stock valuation reporting.

---

## 12. BOOKS — `/api/books` (no feature guard)

Router: `backend/routes/bookRoutes.js`. Controller: `bookController.js`. Model: `Book`.

| # | Method | URL |
|---|---|---|
| 12.1 | GET | `/api/books/module/:module` |
| 12.2 | GET | `/api/books` |
| 12.3 | POST | `/api/books` |
| 12.4 | DELETE | `/api/books/:id` |

- **12.1** ✅ `useStore.js:1246` — auto-upserts a hardcoded `DEFAULT_BOOKS` map (`bookController.js:3-35`) for the requested module (`companyId: null` = "system book", shared across all tenants), then returns system + company-specific books.
- **12.2** ✅ `useStore.js:1215` — same upsert-then-fetch pattern across **all** modules on every call (9 modules × up to 2 default books each = up to 18 upsert round-trips per single `GET /api/books` call — a real N+1-on-every-read performance smell, since these defaults never change after first creation but are re-verified on every request).
- **12.3** ✅ `useStore.js:1264` — rejects if `{module, code}` collides with an existing (including system) book. Forces `name` to uppercase.
- **12.4** ✅ `useStore.js:1277` — explicitly blocks deleting system books (`companyId: null`, 403) and cross-tenant books (403) — correct authorization checks, one of the few controllers with explicit ownership checks beyond the query filter itself.

---

## 13. VISITS — `/api/visits` (route-local `authMiddleware`, redundant with the global one already applied in `routes/index.js` — harmless double-application, not a bug)

Router: `backend/routes/visit.routes.js`. Controller: `visit.controller.js`. Model: `Visit`.

| # | Method | URL |
|---|---|---|
| 13.1 | POST | `/api/visits` |
| 13.2 | GET | `/api/visits` |
| 13.3 | GET | `/api/visits/:id` |

- **13.1** ✅ `frontend/src/pages/crm/VisitLogModal.jsx:38`. Uses `req.user.companyId` / `req.user.id` directly (not `req.companyId`) — functionally equivalent since `authMiddleware` sets both from the same source, but inconsistent with the rest of the codebase's convention.
- **13.2** ✅ `useStore.js:1464`.
- **13.3** ❌ Orphan — no FE call site found; a "view single visit" screen does not appear to exist.
- **No `guard()` call** — Visits (a CRM/field-sales feature) is reachable regardless of the company's plan feature flags, unlike Sales/Purchase/Job/Accounting/GST/Reports.

---

## 14. SUBMASTERS — `/api/submasters` (no feature guard)

Router: `backend/routes/subMasterRoutes.js`. Controller: `subMasterController.js`. Model: `SubMaster`.

| # | Method | URL | Used by FE |
|---|---|---|---|
| 14.1 | GET | `/api/submasters?type=` | ✅ `useStore.js:1293` |
| 14.2 | POST | `/api/submasters` | ✅ `useStore.js:1311` |
| 14.3 | PUT | `/api/submasters/:id` | ✅ `useStore.js:1333` |
| 14.4 | DELETE | `/api/submasters/:id` | ✅ `useStore.js:1323` |

- **Validation:** `type` must be one of `SubMaster.SUB_MASTER_TYPES` — the static list is `AccountGroup, AccountHead, BookType, ItemGroup, Unit, ItemTaxSlab, City, Transport, Type, OtherMaster, Color, Design, HSN` (`backend/models/SubMaster.js:3-17`) — 400 with the allowed list echoed back if invalid. Duplicate-name conflicts surface as Mongo E11000 → generic 400.
- **Notable gap:** there is no `ProcessType` entry in `SUB_MASTER_TYPES` at all, and `Job.processType` (section 7.1) is a free-text schema field with no cross-reference to any master list, generic `Type` included. Job-work process names have zero standardization anywhere in the stack.

---

## 15. ORDERS — `/api/orders` (no feature guard)

Router: `backend/routes/orderRoutes.js`. Controller: `orderController.js`. Model: `Order`.

| # | Method | URL | Used by FE |
|---|---|---|---|
| 15.1 | GET | `/api/orders?orderType=` | ✅ `useStore.js:1354` |
| 15.2 | POST | `/api/orders` | ✅ `useStore.js:1372` |
| 15.3 | PUT | `/api/orders/:id/status` | ⚠️ Not directly confirmed in `useStore.js` grep results — likely invoked from an Orders-specific modal file not covered by the `useStore.js` action surface; treat as **partially verified**. |

- **Order number generation** (`orderController.js:3-9`) uses `Order.countDocuments({companyId, orderType})` + 1, **not** the atomic `Counter` model used everywhere else (`PUR-`, `INV-`, `JC-`, `PV-`/`RV-`, `JNL-`) — under concurrent order creation this is susceptible to the exact race condition the `Counter` model's code comments say was already fixed elsewhere (*"FIXED: uses atomic Counter to prevent race conditions"*), meaning Orders regressed/never received that fix. Two simultaneous `POST /api/orders` calls for the same company+type can generate the **same `orderNo`**, which then fails only via the schema's compound unique index (`{companyId, orderType, orderNo}`) — the second request gets a raw duplicate-key 500/400, not a clean retry.
- **No linkage from `Order` to `Sales`/`Purchase`** — there is no "convert Order to Invoice" endpoint anywhere in the API; `orderNo`/`orderDate` fields exist on the `Sales` schema for **manual** cross-referencing only (operator types the order number into the invoice form), not a real order-fulfillment workflow.

---

## 16. RETURNS — `/api/returns` (no feature guard)

Router: `backend/routes/returnRoutes.js`. Controller: `returnController.js`. Models: `ReturnInvoice`, `AccountingEntry`, `InventoryLot`, `StockMovement`, `Counter`.

| # | Method | URL |
|---|---|---|
| 16.1 | GET | `/api/returns?returnType=` |
| 16.2 | POST | `/api/returns` |

### 16.2 `POST /api/returns` ✅ `useStore.js:1409` — 🔴 **Confirmed bug: InventoryLot enum violation on Sales Return**
- **Logic (transactional):** Atomic `Counter.nextSeq()` → `SR-`/`PR-` numbered return. For `returnType === 'Sales'`, creates a **new** `InventoryLot` per returned line item with `source: 'return'` (`returnController.js:64-75`) to restore stock. For `returnType === 'Purchase'`, decrements the referenced original lot instead.
- **The bug:** `InventoryLot.source` schema enum is `['purchase', 'opening', 'jobwork', 'job_receive']` (`backend/models/InventoryLot.js`) — **`'return'` is not a member of this enum.** Every Sales Return that reaches the `new InventoryLot({..., source: 'return', ...})` line (`returnController.js:64-75`) will fail Mongoose schema validation on `.save({session})`, throwing a `ValidationError` that aborts the entire transaction (`catch` block calls `session.abortTransaction()`). **The net effect: `POST /api/returns` with `returnType: 'Sales'` and at least one line item containing both `itemId` and `mts` always fails** — the return is never persisted, no stock is restored, no accounting entry is posted, and the client receives a 500 with a raw Mongoose validation message (`"source is not a valid enum value for path 'source'."`) rather than a clean business error. **Purchase Returns are unaffected** (they only decrement an existing lot, never construct a new one with `source: 'return'`).
- **Impact:** The entire **Sales Return workflow is non-functional** in the current codebase for any return containing item quantities (`item.mts` truthy) — which is the normal case. A return with items lacking `mts` (or `itemId`) would skip the lot-creation block (`if (!item.itemId || !item.mts) continue;`) and could theoretically succeed with zero stock impact, but that is not a real-world return.
- **Fix required:** add `'return'` to `InventoryLotSchema.source` enum (one-line schema change) — flagged prominently in `16-PRODUCTION-READINESS.md`-equivalent triage as a launch blocker for any customer that processes sales returns.

### 16.1 `GET /api/returns?returnType=` ✅ `useStore.js:1391`.

---

## 17. NOTES — `/api/notes` (no feature guard)

Router: `backend/routes/noteRoutes.js`. Controller: `noteController.js`. Models: `DebitCreditNote`, `AccountingEntry`, `LedgerMaster`.

| # | Method | URL |
|---|---|---|
| 17.1 | GET | `/api/notes?noteType=` |
| 17.2 | POST | `/api/notes` |

### 17.2 `POST /api/notes` ✅ `useStore.js:1446`
- **Logic:** Resolves/creates the party ledger. If `status === 'Posted'`: **Credit Note** → `Dr Sales A/c, Cr Party`; **Debit Note** → `Dr Party, Cr Purchase A/c`.
- **Confirmed gap ("Notes have no GST lines"):** Unlike Sales Return/Purchase Return (`returnController.js`), the Debit/Credit Note posting logic (`noteController.js:50-99`) posts **only the flat `amount`** to `Sales A/c`/`Purchase A/c` — there is **no CGST/SGST/IGST line at all**, and the `DebitCreditNote` schema itself has no `gstAmount`/`taxableAmount`/`cgst`/`sgst`/`igst` fields to even capture a tax breakdown. A Credit/Debit Note issued for a GST-bearing adjustment (the overwhelmingly common real-world case — rate difference, quantity discrepancy, quality claim) is posted **without reversing the corresponding GST output/input tax**, understating/overstating the company's real GST liability every time this feature is used, and (per section 10.3 above) also feeds a permanently-zero `noteGst` into the GST CA Dashboard.
- **17.1 GET** ✅ `useStore.js:1428`.

---

## 18. USERS — `/api/users` (no feature guard, per-company user management)

Router: `backend/routes/user.routes.js`. Controller/Service: `user.controller.js` / `user.service.js`. Model: `User`, `Company`.

| # | Method | URL | Used by FE |
|---|---|---|---|
| 18.1 | GET | `/api/users` | ✅ `useStore.js:1531` |
| 18.2 | POST | `/api/users` | ✅ `useStore.js:1542` |
| 18.3 | PUT | `/api/users/:id` | ✅ `useStore.js:1549` |
| 18.4 | DELETE | `/api/users/:id` | ✅ `useStore.js:1558` (soft — see below) |

- **Authorization:** `userService.canManageUsers(requester)` gates create/update/deactivate to `companyRole ∈ {owner, admin}` (`user.service.js:7-9`) — this is the **one** place in the entire codebase where `companyRole` is checked **server-side**, not just in the frontend `permissions.js` helper. All other modules rely purely on client-side UI hiding for role-based restrictions (see `12-SECURITY-AUDIT.md` SEC-07).
- **18.2 POST** — enforces `Plan.limits.users` seat cap (`currentCount >= userLimit` → 400) — correct plan-limit enforcement, one of the few places `Plan.limits` is actually read and acted on (`Usage` model tracking is otherwise largely unused, see Admin section).
- **18.3 PUT** — blocks non-owners from modifying the owner account (`if (user.companyRole === 'owner' && requester.companyRole !== 'owner') throw ...`).
- **18.4 DELETE** — misleadingly named at the route/HTTP-verb level: `deactivateUser()` **never calls `.deleteOne()`**; it only flips `isActive = false` (`user.service.js:76-82`), and explicitly refuses to deactivate an owner. A `DELETE` verb that performs a soft-disable rather than a removal is a minor REST-semantics inconsistency worth flagging, though the behavior itself (soft-delete for audit-trail preservation) is defensible.

---

## 19. CONFIG — `/api/config` (no feature guard — must be reachable pre-module-check by definition)

Router: `backend/routes/config.routes.js`. Controller: `config.controller.js`. Service: `configService.js`.

| # | Method | URL |
|---|---|---|
| 19.1 | GET | `/api/config/active` |
| 19.2 | GET | `/api/config/version` |

- **19.1** ✅ `frontend/src/context/ConfigContext.jsx:26` — checks `Company.status !== 'suspended'` and `isActive !== false` before returning the bundle (403 `COMPANY_LOCKED` otherwise — a second, independent lock-check layer beyond `authMiddleware`'s own suspended-company block, redundant but harmless). Returns the full merged dynamic-config bundle (modules, sub-menus, fields, forms, columns, bills, feature flags, pricing rules, notifications, reports, permissions, company settings) with `X-Config-Version` / `X-Config-Hash` response headers and a 5-second `Cache-Control`.
- **19.2** ✅ `ConfigContext.jsx:46` — lightweight polling endpoint intended for live-reload of config changes (per code comment `Phase 3`), returns only `{bundleVersion, configHash, publishedAt}`. **Inefficiency:** internally calls the **full** `getActiveConfigBundle()` (same as 19.1) just to discard everything except three fields — there is no lightweight version-only query path; every poll re-runs 10 parallel Mongo queries and re-serializes the entire bundle merely to answer "has anything changed?".

---

## 20. ADMIN — `/api/admin` (+ `roleMiddleware(['super_admin'])` — the only role-gated router in the app)

Router: `backend/routes/admin.routes.js`. Controllers: `admin.controller.js` (SaaS/tenant management) + `adminConfig.controller.js` (dynamic per-company config editor). This is the largest single route group (44 endpoints) — the SaaS back-office console for managing all tenant companies.

### 20.1 Dashboard
| Method | URL | Notes |
|---|---|---|
| GET | `/api/admin/stats` | ✅ `useAdminStore.js:18`. Computes total companies, active subs, subs expiring within 7 days, **MRR** (monthly + yearly-amortized), plan distribution, a **6-month synthetic revenue trend** (recomputed from `Subscription.startDate`/`endDate` overlap per historical month — not a stored time-series, recalculated live on every dashboard load), and the 5 most recent audit logs. |

### 20.2 Companies (tenant CRUD)
| Method | URL | Used by FE | Notes |
|---|---|---|---|
| GET | `/companies` | ✅ `useAdminStore.js:28` | Populates `ownerId`, `planId`. Unbounded — every company in the DB is returned on every load, no pagination — a SaaS scaling ceiling once tenant count grows past a few hundred. |
| POST | `/company` | ✅ `useAdminStore.js:129` | Creates `User`(owner) + `Company` + seeds ledgers/config/settings + 30-day trial `Subscription` + `License` — a **third, near-identical copy** of the exact same 9-step bootstrap sequence found in `authService.register()` and here in `admin.controller.js:22-112` (no shared helper function exists — a maintenance/drift risk: three independent implementations of "create a tenant" that must be kept in sync by hand). |
| PUT | `/company/:id` | ✅ `useAdminStore.js:145` | Unrestricted `Company.findByIdAndUpdate(id, req.body)` — **no field allow-list**; a super_admin request (or a request that reaches this handler with a forged/leaked super_admin token) can overwrite **any** field on the `Company` document, including `planId`, `ownerId`, or `licenseKey`, with no validation that the new `planId`/`ownerId` reference real documents. |
| PUT | `/company/:id/lock` | ✅ `useAdminStore.js:37` | Sets `status: 'suspended'`. Note: `adminConfig.controller.js` **also** exports a `lockCompany`/`unlockCompany` pair (section 20.9) that additionally touches `CompanySettings.isLocked` — the route table only wires `admin.controller.js`'s simpler version to `/company/:id/lock`; the `adminConfig.controller.js` version exists but is **not mounted on any route** in `admin.routes.js` — dead code with a naming collision against a real, mounted handler. |
| PUT | `/company/:id/unlock` | ✅ `useAdminStore.js:48` | Mirror of lock. |

### 20.3 Plans
| Method | URL | Used by FE |
|---|---|---|
| GET | `/plans` | ✅ `useAdminStore.js:60` |
| POST | `/plans` | ✅ `useAdminStore.js:75` |
| PUT | `/plans/:id` | ✅ `useAdminStore.js:70` |
| DELETE | `/plans/:id` | ✅ `useAdminStore.js:161` |

- **No check for in-use plans before delete** — `deletePlan` unconditionally `findByIdAndDelete`s a `Plan` even if one or more `Company` documents still reference it via `planId`; every subsequent `Company.findById(...).populate('planId')` for those companies will simply resolve `planId` to `null`, and `plan?.features?.modules` reads will all evaluate falsy — silently **revoking every module for every company on that plan** without an explicit migration step or warning.

### 20.4 Subscriptions
| Method | URL | Used by FE |
|---|---|---|
| GET | `/subscriptions` | ✅ `useAdminStore.js:86` |
| PUT | `/subscription/:companyId` | ✅ `useAdminStore.js:176` |

- `updateSubscription` is an upsert (`{new:true, upsert:true}`) — if `offlineModeEnabled` is included in the body, it is mirrored onto `CompanySettings.offlineModeEnabled` as a secondary write with no transaction — the two flags (`Subscription.offlineModeEnabled` and `CompanySettings.offlineModeEnabled`) can drift if one write succeeds and the other fails.

### 20.5 License
| Method | URL | Used by FE | Notes |
|---|---|---|---|
| POST | `/license/generate` | ✅ `useAdminStore.js:95` | `checksum: 'CHECKSUM_PLACEHOLDER'` (`admin.controller.js:229`) — **literal placeholder string, not computed.** Every license generated through this specific admin endpoint has an identical, non-functional checksum value; contrast with `authService.register()`'s own license-creation path, which correctly computes a real `sha256(companyId-TRIAL + JWT_SECRET)` checksum. Two different license-issuance code paths exist with two different (one broken) checksum strategies. |
| PUT | `/license/:companyId/renew` | ✅ `useAdminStore.js:193` | Updates `expiresAt`/`isActive` but **does not recompute or touch `checksum` at all** — a renewed license keeps whatever checksum (real or placeholder) it was originally issued with; if `validateLicenseKey()` (`backend/utils/license.js`) were ever wired to check this `checksum` field against the license *key* (it currently is not — `subscriptionMiddleware` only checks `license.isActive`/`expiresAt`, never calls `validateLicenseKey`), a renewed license generated via the placeholder path would remain permanently unvalidatable. |

### 20.6 Usage / Audit
| Method | URL | Notes |
|---|---|---|
| GET | `/usage` | ✅ `useAdminStore.js:109`. Reads the `Usage` model — **no controller or service anywhere in the codebase writes to `Usage`** (confirmed: no `Usage.create`/`Usage.findOneAndUpdate` call site found outside the model file itself). The endpoint is fully wired and queryable, but the collection it reads from is never populated — it will always return an empty array in a real deployment. Plan seat limits are enforced live via `User.countDocuments()` (section 18.2), not via this `Usage` tracking mechanism, which appears to be vestigial/aspirational. |
| GET | `/audit` | ✅ `useAdminStore.js:119`. Reads real data — `AuditLog` **is** actively written by `auditService.log()`, but only from `purchaseController`/`salesController` (`CREATE_BILL`/`CREATE_INVOICE`/`UPDATE_STATUS`/`DELETE_BILL`/`DELETE_INVOICE`). No other module (Jobs, Accounting, GST, Returns, Notes, Items, Parties, Users, Admin itself) ever calls `auditService.log()` — the audit trail covers only two of the ~15 business modules. |

### 20.7 Module Config (legacy, superseded by dynamic config below but still mounted)
| Method | URL | Used by FE |
|---|---|---|
| GET | `/company/:id/module-config` | ✅ `ModuleControl.jsx:216` |
| PUT | `/company/:id/module-config` (→ `adminConfig.controller.saveModuleConfig`) | ✅ `ModuleControl.jsx:263` |

### 20.8 Dynamic Config Bundle
| Method | URL | Used by FE |
|---|---|---|
| GET | `/company/:id/config/bundle` | ❌ Orphan (no FE call site found — the public `GET /api/config/active` used by `ConfigContext.jsx` serves the *logged-in tenant's own* bundle; this admin variant for *inspecting another company's* bundle appears unused by the shipped admin console) |
| POST | `/company/:id/config/seed` | ❌ Orphan |
| GET | `/company/:id/config/logs` | ✅ `DynamicConfig.jsx:146` |

### 20.9 Forms / Columns / Bills / Feature Flags / Permissions / Pricing / Notifications / Reports (per-company dynamic config editors)
| Method | URL | Used by FE |
|---|---|---|
| GET/PUT | `.../config/forms[/:formKey]` | ❌ Orphan (GET has no FE caller found; `DynamicConfig.jsx` covers bills/columns/feature-flags/permissions but not a forms editor screen) |
| GET/PUT | `.../config/columns[/:tableKey]` | ✅ `DynamicConfig.jsx:105,182` |
| GET/PUT | `.../config/bills[/:billType]` | ✅ `DynamicConfig.jsx:92,169` |
| GET/PUT | `.../config/feature-flags[/:flagKey]` | ✅ `DynamicConfig.jsx:120,194` |
| GET/PUT | `.../config/permissions` | ✅ `DynamicConfig.jsx:133,207` — **but see `12-SECURITY-AUDIT.md` SEC-07: this `PermissionMatrix` is editable here yet never read by any Express route/middleware to actually restrict access. It is a fully-functional CRUD editor for a data structure with no runtime enforcement effect.** |
| GET/PUT | `.../config/pricing-rules[/:ruleKey]` | ❌ Orphan |
| GET/PUT | `.../config/notifications[/:ruleKey]` | ❌ Orphan |
| GET/PUT | `.../config/reports[/:reportKey]` | ❌ Orphan |

### 20.10 Company Settings & Company Users
| Method | URL | Used by FE |
|---|---|---|
| GET/PUT | `/company/:id/config` | ✅ `CompanyConfig.jsx:71,84` |
| GET | `/company/:id/users` | ✅ `UserManagement.jsx:70` |
| POST | `/company/:id/user` | ✅ `UserManagement.jsx:82` |
| PUT | `/user/:userId/role` | ✅ `UserManagement.jsx:93` |
| PUT | `/user/:userId/toggle-active` | ✅ `UserManagement.jsx:102` |
| DELETE | `/user/:userId` | ✅ `UserManagement.jsx:112` |

- `DELETE /user/:userId` here (admin console) performs a **real `User.findByIdAndDelete`** (`admin.controller.js:446-449`) — unlike the tenant-facing `DELETE /api/users/:id` (section 18.4), which only soft-deactivates. The same conceptual action ("remove a user") is hard-delete from the super-admin console and soft-disable from the tenant's own user-management screen — an intentional privilege distinction, but worth documenting since it means **super_admin-initiated user removal is irreversible** (no confirmation/audit-log call wraps this specific handler) while owner/admin-initiated removal is not.

---

## Cross-cutting findings summary (all modules)

| # | Finding | Scope |
|---|---|---|
| API-1 | `PUT /api/purchases/:id` and `PUT /api/sales/:id` (full-record edit) are called by the frontend but **do not exist** as routes — only `:id/status` exists. Editing a saved invoice/bill is broken. | Purchases, Sales |
| API-2 | Sales Return (`POST /api/returns`, `returnType: 'Sales'`) always fails validation because `InventoryLot.source: 'return'` is not in the model's enum. | Returns / Inventory |
| API-3 | Debit/Credit Notes post zero GST lines and cannot even store a GST amount on the schema. | Notes |
| API-4 | `GET /api/ledgers/:partyId` and `GET /api/ledgers/balance/:partyId` trust client-supplied `companyId` query params with no ownership check against the authenticated tenant — confirmed cross-tenant IDOR pattern (low current blast radius since `LedgerEntry` appears otherwise unused). | Legacy Ledgers |
| API-5 | `PermissionMatrix` has a full CRUD admin editor but zero runtime enforcement anywhere in the Express pipeline. | Admin / all business routes |
| API-6 | Three independent "bootstrap a new tenant" implementations exist (`authService.register`, `admin.controller.createCompany`, and the config-seeding call each makes) with no shared helper — drift risk. | Auth, Admin |
| API-7 | 6 of 9 `/api/reports/*` endpoints and most of the per-key dynamic-config editors under `/api/admin/company/:id/config/*` are fully implemented, reachable, and correct, but have no frontend caller — either intentionally reserved for external integrations or genuinely abandoned UI work. | Reports, Admin Config |
| API-8 | Client-supplied financial totals (`taxableAmount`, `gstAmount`, `netAmount`, `cgst`/`sgst`/`igst`) are trusted as-is on Sales/Purchase creation with no server-side recomputation from line items. | Sales, Purchase |
| API-9 | `companyId` resolution pattern `req.companyId || req.query.companyId` (reads) and `req.companyId || req.body.companyId || req.query.companyId` (writes on Items/Parties) is repeated across ~15 controllers — currently low-risk because `req.companyId` is always populated post-`authMiddleware`, but is an IDOR anti-pattern that should be removed in favor of `req.companyId` exclusively. | Items, Parties, Purchases, Sales, Inventory, GST, Reports |

Continue to `08-BUSINESS-FLOWS.md` for end-to-end sequence diagrams of how these endpoints compose into real textile-trading workflows.
