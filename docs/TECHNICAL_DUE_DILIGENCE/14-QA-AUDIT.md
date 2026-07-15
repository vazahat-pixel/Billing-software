# 14 — QA Audit: Complete Manual & Automated Test Plan

**Current automated coverage found in repo**: `backend/__tests__/` exists as a directory but contains **no test files** (0 `*.test.js`/`*.spec.js` found). `backend/package.json` declares **no `test` script** and no `jest`/`mocha` devDependency, despite `@jest`, `babel-jest`, etc. being present under `node_modules` (leftover/transient install, not wired to `package.json`). Frontend has exactly **one** Playwright spec: `frontend/e2e/offline.spec.js` (offline login + offline ERP flow). **Testing score: 22/100.** Everything below is therefore the plan to reach a shippable QA bar, not a report of existing passing tests.

Use this document as the master checklist. Each checkbox is one discrete test case. Total: **380+ manual cases**, **140+ API cases**, **60+ automated test specs** recommended.

---

## 14.1 Test Strategy

| Layer | Tool (recommended) | Current state | Target before launch |
|---|---|---|---|
| Unit (services/utils) | Jest (backend), Vitest (frontend) | 0 tests | 70%+ coverage on `services/*.js`, `utils/*.js` |
| Integration (route+controller+DB) | Jest + `mongodb-memory-server` or a dedicated test Mongo | 0 tests | Every mutating endpoint has a happy-path + 2 negative-path test |
| E2E (browser) | Playwright | 1 spec (`offline.spec.js`) | Cover the flows in §14.5 |
| Manual regression | This checklist | Never formally executed (no test plan existed before this doc) | Full pass before every release tagged for a paying customer |
| Load/perf | k6 or Artillery against `/api/reports/bundle`, `/api/sales`, `/api/accounting/outstanding` | None | Baseline + regression gate tied to `13-PERFORMANCE-AUDIT.md` fixes |

---

## 14.2 Manual Test Checklist — Screen by Screen

### 14.2.1 Authentication (`LoginPage.jsx`, `SignupPage.jsx`, `ForgotPasswordPage.jsx`, `AdminLogin`)

- [ ] Login with valid email/password succeeds and redirects to `/`
- [ ] Login with wrong password shows error, does not leak whether email exists
- [ ] Login with non-existent email shows generic error
- [ ] Login with empty fields is blocked client-side before request fires
- [ ] Token persists across page refresh (localStorage `token`/`user`)
- [ ] Expired/invalid JWT on `/auth/me` redirects to `/login`, does not loop
- [ ] Signup creates a new company + first admin user
- [ ] Signup with duplicate email is rejected with clear message
- [ ] Signup with weak/no password validated server-side (not just client)
- [ ] Forgot-password flow issues a resettable token (verify no email is actually sent if SMTP unconfigured — confirm this is surfaced to the user, not a silent failure)
- [ ] Reset-password invalidates the old password immediately
- [ ] `super_admin` role logging into `/admin/login` lands on Admin console, not the tenant Dashboard
- [ ] Regular `user` role cannot reach `/admin/*` routes (verify `ProtectedRoute allowedRoles={['super_admin']}` truly blocks, not just hides nav)
- [ ] Logout clears localStorage token/user and blocks back-navigation into protected routes
- [ ] Suspended company (`company.status === 'suspended'`) blocks login/API calls with 403, not a generic 500
- [ ] Offline login (`/offline-login`) works from cached IndexedDB session per `offlineAuth.js`
- [ ] Session on one device does not silently invalidate a session on another device (or, if single-session-by-design, verify that behavior is intentional and documented)

### 14.2.2 Dashboard Shell (`Dashboard.jsx`)

- [ ] All menu sections (Master, Transaction, Inventory, Reports, Others Reports, Utilities, Setup System, Records, Company) render for `super_admin`
- [ ] Menu items respect `moduleConfig`/`bundle` opt-out flags — disabling a module in Admin Config hides it here without full page reload
- [ ] Quick-access rail icons (`ALL_CORE_MODULES`) open the correct modal 1:1 for all 15 entries (Sales, Purchase, Bank Receipt, Bank Payment, Mill Issue, Mill Receive, Job Issue, Job Receive, Update Job, CA Desk, GSTR-1, GSTR-2, ETB, Visit Log, Outstanding)
- [ ] Keyboard shortcut bar (`1 Sales`, `2 Pur`, ... `9 Debt O/s`) triggers the same modals as clicking
- [ ] "Recent Activity" list correctly shows latest 3 sales + 2 purchases + 2 jobs, relative time labels correct (`mins ago`, `hour(s) ago`, date fallback)
- [ ] Sync button triggers `refreshAllData()` and updates "Live" badge timestamp
- [ ] Company name/initial in header reflects logged-in company, not a stale/demo value
- [ ] Logout button (top-right and in menu bar "Exit") both work identically
- [ ] Every `alert()`-stub Utilities menu item (`Backup`, `Restore`, `Closing/UnClosing Year`, `New A/c Year (Auto/Manual)`, `Transfer To Next Year`, `Voucher Relndex`, `Missing Series`, `Auto Expense Entry`, `MisMatch Data Scanner`, `Email Option`, `Missing Views Code`, `Backup Script Wise`, `Single Firm Backup/Restore`, `Bulk Whatsapp`, `Complain Form`, `Update DataBase`, `Information`) is confirmed to be a **non-functional stub** and is either removed from the menu or clearly labeled "Coming Soon" before any customer-facing release — QA must flag every one of these as a **false affordance** bug, not sign off silently
- [ ] Book-selection intercept (`CORE_MODULES_WITH_BOOKS`) shows correct book list per module and correctly threads the chosen book name into the opened modal's `selectedBook` prop

### 14.2.3 Sales (`SalesModal.jsx` / `SalesPage.jsx` / `SalesPrint.jsx`)

- [ ] Create invoice with 1 line item, valid party, valid item, valid lot — succeeds, invoice number auto-generated (`INV-{seq}`)
- [ ] Create invoice with multiple line items across multiple lots
- [ ] Create invoice selecting a lot with insufficient `remainingMtrs` — server rejects with clear message (`salesService.js:30`), UI surfaces it (not a raw 500 page)
- [ ] Create invoice with `mts` exactly equal to `remainingMtrs` — lot status flips to `Closed`
- [ ] Create invoice with partial `mts` — lot status flips to `Partially Used`, remaining values correct to 4 decimal places
- [ ] Create invoice with no `lotId` on a line (service-only line?) — verify this doesn't crash `for (const item of items)` stock-reduction loop
- [ ] Submitting with a manually-typed `invoiceNo` other than `'AUTO'` is respected as override
- [ ] Duplicate invoice number within same company is rejected (`Counter` uniqueness / schema unique check)
- [ ] Tax fields (`taxableAmount`, `gstAmount`, `cgst`, `sgst`, `igst`, `netAmount`) — verify these round-trip correctly when the browser sends them; **flag as a defect** that the server does **not** recompute these from item rate × qty × GST% server-side (client-trusted amounts — see `16-PRODUCTION-READINESS.md` P0 #3). QA test: tamper `netAmount` in browser devtools/network tab before submit and confirm the server currently accepts the tampered value unchanged.
- [ ] Accounting entry auto-posts on invoice save (`onSalesInvoicePost`) — verify Sales A/c, CGST/SGST/IGST Output, and Party ledger lines sum to zero (Dr=Cr)
- [ ] Save fails cleanly (no partial state) when accounting posting throws — confirm `session.abortTransaction()` truly rolls back the `Sales` doc, `InventoryLot` updates, and `StockMovement` record together
- [ ] Print preview (`SalesPrint.jsx` / `InvoicePDFViewer.jsx`) — **verify company header does NOT show `DEMO_COMPANY` ("MAHAVEER TEXTILES PVT. LTD.")** on a real customer's printed/PDF invoice; this is a P0 defect if any live company sees demo branding on their legal invoice
- [ ] WhatsApp share button (`buildWhatsAppMessage`) generates correct invoice number/amount in the message text
- [ ] Editing/cancelling an invoice (`updateSaleStatus`) — verify status transitions (`active`→`cancelled`, `active`→`partial`→`paid`) match actual payment application
- [ ] Delete/cancel invoice (`deleteSale`) — confirm accounting reversal entry posts correctly (Dr/Cr flipped) **and separately verify, as a known defect, that inventory stock is NOT restored** — write an explicit regression test that documents current (wrong) behavior so a future fix doesn't get "no reported bugs" false confidence
- [ ] Read-only mode (`readOnly={!permissions.canSave}`) truly disables all inputs/buttons for restricted roles, not just visually greys them out
- [ ] Sales Outstanding report (`SalesOutstanding.jsx`) reflects invoices immediately after creation and after partial payment

### 14.2.4 Purchase (`PurchaseModal.jsx` / `PurchaseTable.jsx` / `PurchaseForm.jsx` / `SummaryPanel.jsx`)

- [ ] Create purchase bill with 1+ line items — new `InventoryLot` per line created with correct `lotId` format (`LOT-{timestamp}-{random}`)
- [ ] `LOT-` id collision probability under rapid concurrent creation — stress test with 50 simultaneous purchase submissions and verify no duplicate `lotId` within a company (random 4-digit suffix + `Date.now()` — confirm this is safe enough, or flag as a latent bug if two lots ever collide)
- [ ] Purchase auto-generates `invoiceNo` as `PUR-{seq}` via `Counter.nextSeq`
- [ ] Accounting entry posts on save (`onPurchaseBillPost`) inside same transaction as lot/movement creation
- [ ] Navigation buttons `onOpenSales`, `onOpenJobIssue`, `onOpenMillIssue` correctly close Purchase and open the target modal with state intact
- [ ] Cancel/delete purchase (`deletePurchase`) posts reversal accounting entry; **confirm as known defect** that `InventoryLot`s created by this purchase are NOT reduced/closed on cancellation, so cancelled purchases still show their stock as available (same root cause as Sales — §16 P0 #8)
- [ ] Print purchase bill (`PurchasePrint.jsx`) shows correct GSTIN/HSN/amounts
- [ ] Partial payment updates `paidAmount`/`status` correctly when a Payment Voucher references this purchase in `againstInvoices`
- [ ] Job Purchase menu item (routes to same Purchase modal) behaves identically — confirm this isn't a mislabeled dead-end

### 14.2.5 Accounting — Payment/Receipt (`AccountingForms.jsx` → `PaymentForm`)

- [ ] Create Payment voucher, single payment mode (Cash) — posts Dr Party / Cr Bank correctly
- [ ] Create Payment voucher, split across 2+ modes (Cash + Cheque) — `normalizePaymentDetails` validates split total equals voucher amount to the cent
- [ ] Split total mismatch by even ₹0.02 is rejected with the exact error message showing both totals
- [ ] Cheque payment with no cheque number is rejected (`normalizePaymentDetails` line 56)
- [ ] NEFT/RTGS/UPI payment with no UTR reference is rejected (line 59)
- [ ] Payment voucher with `status: 'Draft'` does NOT post an accounting entry; changing Draft→Posted later does
- [ ] Payment applied `againstInvoices` correctly updates the target invoice's `paidAmount` and flips `status` to `partial`/`paid` at the right thresholds — **verify the fixed logic**: payment against a Sales invoice ID only updates `Sales`, payment against a Purchase bill ID only updates `Purchase` (regression test for the documented old bug where both were blindly set to Paid)
- [ ] Receipt voucher mirrors Payment voucher tests above (Dr Bank / Cr Party)
- [ ] Voucher number generation (`PV-{fy}-{seq}` / `RV-{fy}-{seq}`) is unique per company per financial year, no collisions under concurrent submission (uses atomic `Counter.nextSeq` — verify this actually holds under 20 concurrent requests)
- [ ] Attempting to post a voucher dated inside a locked accounting period (`company.settings.lockedUntilDate`) is rejected with the lock-date message
- [ ] Voucher list (`listVouchers`) filters correctly by `type`, `partyId`, date range
- [ ] Ledger selection dropdown only shows ledgers belonging to the current company (tenant isolation)

### 14.2.6 Journal Entry (`JournalEntryModal.jsx`)

- [ ] Manual journal entry with balanced Dr/Cr lines saves successfully
- [ ] Manual journal entry with **unbalanced** Dr/Cr lines is rejected — confirm `AccountingEntry` schema/model-level double-entry validation actually fires here (this is listed as a "never change, keep" architectural strength in `18-CTO-FINAL-REPORT.md` — QA must verify it is truly enforced on this manual-entry path, not only on auto-posted paths)
- [ ] Journal entry respects period lock same as vouchers
- [ ] Journal entry narration and per-line narration both persist and display correctly on ledger statements

### 14.2.7 Job Work (`IssueModal.jsx`, `ReceiveModal.jsx`, `UpdateModal.jsx`, `JobReceiptModal.jsx`, `ProcessUpdateModal.jsx`)

- [ ] Issue to job: select lot with sufficient stock — job card created (`JC-{seq}`), lot `remainingMtrs` reduced, `StockMovement` type `ISSUE` recorded
- [ ] Issue to job: select lot with **insufficient** stock — rejected with available-quantity message (`jobService.js:24`)
- [ ] Issue to job: `issuePcs`/`issueQty` of zero or negative — should be rejected client- and server-side (verify server-side; client-only validation is not sufficient)
- [ ] Receive from job: normal flow — new **finished** `InventoryLot` created with `source: 'job_receive'`, correct `lotId` suffix `-FIN-{timestamp}`
- [ ] Receive from job: attempting to receive an already-`Received` job is rejected (`jobService.js:70`)
- [ ] Receive from job: wastage entered — `onAbnormalWastagePost` posts using the **real** cost-per-meter derived from the original purchase's `taxableAmount ÷ totalMtrs`, not the old hardcoded ₹100 fallback; verify fallback ₹100 only triggers when `purchaseId` truly has no linked purchase (e.g., opening-stock-sourced lot issued to a job)
- [ ] Receive from job: verify the **received/finished lot inherits the same `itemId`** as the grey input lot — flag as a **functional gap** (not a crash) that there is no grey-fabric → distinct-finished-item SKU conversion; a trader who processes "Grey Cotton 40s" into "Dyed Cotton 40s — Navy" will see the finished lot still labeled as the grey item, because no item-mapping/BOM concept exists in `Job.js`/`jobService.js`
- [ ] Receive from job: accounting posting failure (simulate) does not roll back the already-committed job/stock transaction — confirm this matches documented intended behavior, and confirm the failure is at least logged somewhere reviewable (currently only `console.error` — flag as gap, see `13-PERFORMANCE-AUDIT.md` §13.7)
- [ ] Update Job / Process Update modal: status transitions restricted to `['Issued', 'In-Process', 'Received', 'Cancelled']`; invalid status string rejected
- [ ] Job report (`getJobWorkReport`) wastage % calculation correct (`wastage / issueQty * 100`) and doesn't divide-by-zero when `issueQty` is 0

### 14.2.8 Inventory (`InventoryPage.jsx`, `InventoryTable.jsx`, `LotCard.jsx`, `MovementTable.jsx`, `LotDetails.jsx`)

- [ ] Stock Ledger screen lists all lots for the company, correct remaining/used quantities
- [ ] Lot detail drill-down shows full `StockMovement` history for that lot in chronological order
- [ ] Opening Stock entry (`OpeningStockModal.jsx` → `POST /api/inventory/opening-stock`) creates a lot with `source: 'opening'` and a corresponding `StockMovement` of type `OPENING`
- [ ] Lot search/filter by item works correctly (`getLotsByItem`)
- [ ] Individual lot detail endpoint (`getLotDetails`) 404s cleanly for a lot ID belonging to another company (tenant isolation test — see §14.6)
- [ ] Item-level stock summary (`getItemStock`) totals match sum of that item's individual lots
- [ ] **Stock valuation column always shows ₹0** — confirmed defect (`InventoryLot` has no `rate` field; see `13-PERFORMANCE-AUDIT.md` §13.8). QA must log this as an open P0 defect on every report screen that shows "Stock Value", not just note it once.
- [ ] Negative-stock prevention: attempt to oversell/over-issue against a lot via rapid concurrent Sales + Job Issue requests referencing the *same* lot — verify Mongo session/transaction actually prevents the lot going negative under a race (write a concurrency test, don't just trust the `if (lot.remainingMtrs < qty) throw` check, since two concurrent requests can both read the same "sufficient" balance before either writes)

### 14.2.9 Masters — Account/Item/Book (`AccountMasterModal.jsx`, `ItemMasterModal.jsx`, `BookMasterModal.jsx`, `PartyModal.jsx`, `GenericMasterModal.jsx`, `JobWorkerMaster.jsx`)

- [ ] Create Party (Customer/Supplier/Both) with all fields — GSTIN format validated (15-char pattern) before save
- [ ] Create Party with invalid/short GSTIN — server should reject or at least flag, not silently store a garbage GSTIN that later breaks GST report classification (`gstService.getGstr1` treats `gstin.length >= 15` as "registered" — a malformed 15-char string would be misclassified as B2B)
- [ ] Edit Party updates propagate to already-created Sales/Purchase display (via `populate`), without needing to re-open old documents
- [ ] Delete Party that has existing Sales/Purchase/Ledger history — verify referential integrity: does it soft-fail, hard-block, or orphan the references? (No cascade/guard logic was found in `partyController` — treat "delete party with history" as an untested, high-risk action until proven safe)
- [ ] Search parties (`searchParties`) returns correct matches, case-insensitive
- [ ] Create Item with HSN code, GST rate, sales rate, purchase rate — all persist and correctly feed into Sales/Purchase tax computation and GST reports
- [ ] Item with missing/blank GST rate defaults to 5% in GST reports (`gstService.js:75` — `(line.itemId?.gstRate || 5) / 100`) — verify this silent default is intentional and not masking a data-entry gap that would misstate real GST liability
- [ ] Book Master: create book per module (Sales/Purchase/Receipt/Payment/MillIssue/MillRec/JobIssue/JobRec/Ledger), set one as default per module
- [ ] Book selection modal correctly filters to only books belonging to the module the user is entering (per `CORE_MODULES_WITH_BOOKS`)
- [ ] Delete a Book currently referenced by historical vouchers — verify no orphaned reference breaks voucher list rendering
- [ ] Generic Master modal (Account Group, Account Head, Book Type, Item Group, Unit, Item TaxSlab, Station/City, Transport, Type, OtherMaster) — create/edit/delete round-trip for **each** of the 10 sub-types; verify `SubMaster` model's `type` discriminator correctly scopes list/search per type and never leaks one type's rows into another type's dropdown
- [ ] Job Worker Master: create job worker with GSTIN/state, verify state feeds correctly into interstate wastage/job-charge accounting (`onJobWorkChargesPost`)

### 14.2.10 Opening Balance / Opening Stock (`OpeningBalanceModal.jsx`, `OpeningStockModal.jsx`)

- [ ] Set opening balance (Dr/Cr) on a Party via the `parties PUT /:id` endpoint — verify this is truly wired end-to-end and the value appears correctly as the starting point of that party's ledger statement (`accountingController.getLedgerStatement` reads `ledger.openingBalance`/`openingBalanceType` off `LedgerMaster`, **not** off `Party`— QA must verify whether `OpeningBalanceModal`'s PUT to `/api/parties/:id` actually syncs into the corresponding `LedgerMaster` record, or whether these are two disconnected values that can drift)
- [ ] Opening Stock entry correctly creates lots dated/tagged as pre-system stock and includes them in all stock/valuation reports identically to purchase-sourced lots
- [ ] Attempting to set an opening balance twice for the same party — does it overwrite, add, or duplicate? Verify and document actual behavior.

### 14.2.11 GST Screens — GSTR-1 (`GstModals.jsx` → `Gstr1Modal`)

- [ ] GSTR-1 correctly buckets invoices into B2B (registered GSTIN, len≥15), B2CL (unregistered, taxable > ₹250,000), B2CS (everything else, aggregated)
- [ ] B2CS bucket correctly accumulates **multiple** invoices into summary rows rather than one row per invoice (confirmed fixed behavior — verify with 3+ small unregistered invoices in the same state/rate bucket)
- [ ] HSN summary aggregates quantity/taxable/tax correctly across multiple invoices sharing the same HSN code
- [ ] Per-item GST rate is used for CGST/SGST split (not a hardcoded flat rate) — verify with two items on the same invoice carrying different GST rates (e.g., 5% and 12%) and confirm both compute independently
- [ ] Downloaded GSTR-1 JSON (`downloadJson`, `buildGstr1Filename`) — **verify the exported JSON schema against the actual GSTN portal-mandated GSTR-1 JSON schema** before ever telling a customer "you can upload this to the GST portal." Current export includes ad-hoc fields (`version: 'GST3.2.2'`, `hash: 'hash'` — literally the string `'hash'`, not a real hash) that do not match GSTN's real schema. **This is a compliance-labeling defect, not just a QA bug** — file as P0, see `16-PRODUCTION-READINESS.md`.
- [ ] Date-range filter (`startDate`/`endDate`) correctly scopes the return period and the `fp` (filing period) string format `MMYYYY`

### 14.2.12 GST Screens — GSTR-2B Matching (`Gst2bMatchingModal`) — FAKE, verify and flag

- [ ] Confirm (as a documented, not-hidden defect) that "ITC Reconciliation" screen does **not** call any real GSTR-2B portal/GSP API. `portalTaxable` is literally copied from the company's own `purchases` ERP data (`portalTaxable: parseFloat(p.totalAmount || 0)` — identical to `erpTaxable`), so ERP-vs-portal mismatch can **never** be detected by this screen as built.
- [ ] Confirm the "MATCHED"/"MISMATCH" status is a **deterministic fake pattern** (`index % 3 === 0`), not derived from any comparison logic.
- [ ] Confirm the summary tiles ("Verified: 24", "Mismatch: 02", "Missing: 01", "Net ITC: ₹84K") are **hardcoded literals**, unrelated to the company's actual data, and will show the exact same numbers for a brand-new company with zero purchases as for a company with thousands.
- [ ] QA sign-off requirement: this screen must be hidden behind a "Beta / Simulated Data" banner, or removed entirely, before any GST-compliance claim is made to a customer. Do not let this screen exist un-labeled in a paid product.

### 14.2.13 CA Dashboard (`CADashboardModal.jsx`)

- [ ] Dashboard loads GSTR-1 + GSTR-2 + returns + notes via `getCADashboard` aggregation and totals reconcile with the individual GSTR-1/GSTR-2 screens
- [ ] Warnings engine correctly flags: (a) large B2C sale without GSTIN classification check, (b) zero-GST invoice with nonzero taxable amount, (c) purchase with missing supplier GSTIN (ITC-blocked risk), (d) empty HSN summary despite invoices existing
- [ ] Auto-refresh every 30s does not cause visible flicker/loss of scroll position/open filter state
- [ ] Navigation buttons to GSTR-1/GSTR-2/GSTR-3B correctly close CA Dashboard and open the target modal
- [ ] `Trial Balance` link/data referenced from this dashboard (per integration matrix) correctly pulls from `/accounting/trial-balance`, and any rounding differences between GST figures and Trial Balance GST-ledger balances are either reconciled or explicitly explained (not silently different numbers with the same label)

### 14.2.14 ETB / GST Compliance / GSTR-3B Monthly (`GstComplianceModal`, `Gst3bMonthlyModal`, `Gst3bDetailModal`, `Gstr1ErrorChekModal`)

- [ ] GSTR-3B monthly figures computed client-side from `sales`/`purchases` store data (not a dedicated backend endpoint) match the server-computed CA Dashboard `gstr3b` block within rounding tolerance — **if they don't match, that is a defect** since customers will see two different "3B net payable" numbers depending on which screen they open
- [ ] "File Return" button (`handleFileReturn`) — confirm this is a **2-second `setTimeout` simulation**, not a real GSTN filing submission. QA must verify no customer-facing copy implies an actual return was filed with the government.
- [ ] Interstate vs intrastate detection (`gstin.startsWith('24')` hardcoded to Gujarat state code) — verify this hardcoded state-code check is correct for a Gujarat-based company and **flag as a portability defect** for any company registered outside Gujarat (state code `24`), since the interstate/intrastate CGST+SGST vs IGST split will be wrong for a non-Gujarat tenant

### 14.2.15 Visit Log (`VisitLogModal.jsx`)

- [ ] Create visit log entry with party, date, purpose, outcome — persists and lists correctly (`Visit.js` model)
- [ ] Visit list filters by date range and by party
- [ ] Visit detail view (`getVisitById`) 404s for cross-tenant IDs

### 14.2.16 Orders (`OrderModal.jsx`)

- [ ] Create Sales Order and Purchase Order (both `initialType` variants) — persist to `Order.js` model correctly with the right `orderType`
- [ ] Update order status transitions are constrained to valid states — verify allowed status list matches `orderController.updateOrderStatus` validation
- [ ] Order-to-Invoice conversion — **verify this either exists or does not**; the integration matrix shows `Order` as a standalone CRUD with no confirmed linkage back into `SalesModal`/`PurchaseModal` to auto-fill from an approved order. If no such linkage exists, this is a functional gap (orders are recorded but don't reduce re-entry work when actually invoicing), not just a missing "nice to have."

### 14.2.17 Returns (`ReturnModal.jsx`) — includes known P0 defect

- [ ] Create **Purchase Return** — reduces the original lot's `remainingMtrs`/`remainingPcs`, posts correct reversal accounting lines (Dr Party, Cr Purchase A/c, Cr GST Input reversal) — this path does **not** hit the schema-enum bug and should pass
- [ ] Create **Sales Return** — **THIS MUST FAIL OR BE FIXED BEFORE LAUNCH.** `returnController.createReturn` constructs a new `InventoryLot` with `source: 'return'` (`backend/controllers/returnController.js:68`), but `InventoryLot.js`'s schema enum for `source` is `['purchase', 'opening', 'jobwork', 'job_receive']` — **`'return'` is not in the enum.** Under Mongoose's default strict enum validation, `newLot.save({ session })` will throw a `ValidationError`, which is caught by the outer `try/catch`, triggers `session.abortTransaction()`, and returns a 500 — **every Sales Return submission is expected to fail outright** unless Mongoose enum validation has somehow been disabled or this path has never been exercised in practice. QA must run this exact flow against a real database and record the actual observed behavior (crash vs silent success vs partial success) as the very first regression test in this entire document.
- [ ] Once fixed (enum updated to include `'return'`, or schema loosened), re-run: Sales Return restores stock into a *new* lot correctly, `StockMovement` type `RETURN` recorded with positive qty, accounting reversal (Dr Sales, Dr CGST/SGST Output reversal, Cr Party) balances to zero
- [ ] Return number generation (`SR-{fy}-{seq}` / `PR-{fy}-{seq}`) unique per company/year
- [ ] Return list (`getReturns`) filters correctly by `returnType`

### 14.2.18 Debit/Credit Notes (`NoteModal.jsx`)

- [ ] Create Credit Note and Debit Note (both `initialType` variants) against a party, with/without a linked original invoice number
- [ ] Note GST amount correctly feeds into CA Dashboard `noteGst` summary
- [ ] Note list (`getNotes`) round-trips correctly

### 14.2.19 User Rights / Setup (`UserRightsModal.jsx`, `admin/UserManagement.jsx`)

- [ ] Create user with a role, assign company — user can log in and sees only permissions matching their `companyRole`/`role`
- [ ] Update user role — takes effect on next login/token refresh (verify if it takes effect immediately or requires re-login; if it requires re-login, ensure that's communicated in the UI, not silently inconsistent)
- [ ] Deactivate user — deactivated user's existing JWT (if not expired) should be rejected on next request, not just blocked from a fresh login (**verify this — `authMiddleware` only checks `User.findById`; if it doesn't check an `isActive` flag, a deactivated user's live token keeps working until natural expiry**, which is a security-relevant QA finding, cross-reference `12-SECURITY-AUDIT.md`)
- [ ] `PermissionMatrix` UI edits (`canView`/`canCreate`/`canEdit`/`canDelete`/`canExport`/`canPrint` per module) — **verify server actually enforces these on the API side**; per code inspection, `PermissionMatrix` is only read by admin-config screens (`adminConfig.controller.js`) and is **not** wired into any Express middleware on tenant-mutating routes (`sales`, `purchase`, `accounting`, etc.). QA must explicitly test: set a role's `canCreate: false` for Sales in the UI, then call `POST /api/sales` directly (Postman/curl) with that user's token — **expected finding: the request will still succeed**, proving client-side-only enforcement. File this as the top security/QA finding of the whole audit.

### 14.2.20 Data Records Hub (`DataRecordsHub.jsx`) — store-only, no dedicated API

- [ ] Verify each tab (`accounts`, `sales`, `purchases`, `jobs`, `parties`, `items`) reads exclusively from the Zustand store's already-fetched arrays and does **not** issue its own paginated/filterable API calls — confirm large datasets (1,000+ sales) either (a) were already fully fetched into the store elsewhere (defeating the point of "records hub" as a lightweight browse view) or (b) show incomplete/stale data because the store only holds a partial/cached slice. Either outcome should be documented as a known limitation.
- [ ] Search/filter within each tab operates only on already-loaded client-side data — confirm this is acceptable for expected data volumes or flag as a scale risk

### 14.2.21 Reports Hub (`ReportsHub.jsx`) — backed by `/api/reports/bundle`

- [ ] Every tab (`summary`, `pl`, `sales`, `purchase`, `jobwork`, `daily`, `masters`, `outstanding`, `stock`, `stockItem`) renders correct data matching the underlying `getReportBundle` fields
- [ ] Date range filter correctly re-fetches and re-scopes date-bound reports (sales/purchase/job/P&L/daily) while correctly leaving date-independent reports (stock, masters) unaffected
- [ ] `Cache-Control: private, max-age=15` on `/reports/bundle` doesn't cause stale data to display for longer than 15s after a fresh transaction — verify browser/proxy actually respects this header and doesn't over-cache
- [ ] Report totals in the `summary` block (`salesTotal`, `purchaseTotal`, `stockValue`, `receivable`, `payable`) reconcile with the same figures shown independently elsewhere (Sales Outstanding, CA Dashboard, Trial Balance) — **note**: `stockValue` will always read ₹0 (see §14.2.8 defect)
- [ ] Export/print of any report tab produces a usable, correctly formatted output (verify this exists at all — no export/PDF logic was found wired into `ReportsHub` beyond in-app viewing; if that's the actual state, QA should record "no export capability" as a functional gap, not assume it exists)

### 14.2.22 Ledger Modal (`LedgerModal.jsx`) — FAKE, no API, static UI

- [ ] Confirm (as documented defect, not oversight) this modal is **entirely static**: company dropdown hardcoded to a single option `"MAHAVEER IMPEX"`, date range hardcoded to `01/04/2026`–`31/03/2027`, "Days in Year"/"Interest Rate"/"Grace Days" inputs are plain uncontrolled text inputs with no submit handler, and buttons (`Ledger`, `Confirmation`, `Interest Report`, `Bank Recon.`, `Unpresented Entries`) have **no `onClick` at all** except `Exit`. This screen calls **zero backend endpoints.**
- [ ] Confirm this is a **different, disconnected** ledger UI from the working `accountingController.getLedgerStatement` API (which correctly computes real running balances and is used elsewhere, e.g. via `AccountMasterModal`/`GenericMasterModal` flows) — QA must document that two "ledger" surfaces exist in the product and only one is real, to prevent a support/sales team from assuming this modal works because a similarly-named feature elsewhere does.
- [ ] Sign-off requirement: remove this modal, or wire it to the real `getLedgerStatement` endpoint, before it is shown to any paying customer.

### 14.2.23 Utilities — all `alert()` stubs

- [ ] Every item under the "Utilities" and part of "Setup System"/"Company" menus that calls `alert(...)` (17 confirmed stub actions, listed in §14.2.2) must be individually clicked and the resulting alert text screenshotted/logged as **known non-functional** in the release test report. None of these should ship without a "not yet implemented" affordance if the underlying alert-stub approach is kept for beta.

### 14.2.24 Admin SaaS Console (`admin/Dashboard.jsx`, `Companies.jsx`, `Plans.jsx`, `Subscriptions.jsx`, `Licenses.jsx`, `Usage.jsx`, `Audit.jsx`, `ModuleControl.jsx`, `UserManagement.jsx`, `CompanyConfig.jsx`, `DynamicConfig.jsx`)

- [ ] Create/edit/lock/unlock company — locked company's users are immediately blocked from login/API (verify against `authMiddleware`'s `company.status === 'suspended'` check — note the admin UI's "lock" action must actually set `status` to the exact string `'suspended'` the middleware checks for, not a differently-spelled status value)
- [ ] Create/edit/delete Plan — deleting a Plan currently assigned to an active company should be blocked or handled gracefully, not orphan the company's `planId`
- [ ] Update Subscription — status/end-date changes take effect on the tenant's very next API call (verify latency: is it immediate, or does something cache `req.planId` per-session?)
- [ ] Generate/renew License — expired license correctly triggers the 403 in `subscriptionMiddleware` for a tenant in **production** mode
- [ ] **Verify the subscription/license bypass**: with `NODE_ENV=development` (or any value other than exactly what production expects), confirm `subscriptionMiddleware` skips company/subscription/license checks entirely (`backend/middlewares/subscription.middleware.js:7`). QA must run this exact test against whatever `NODE_ENV` value the real deployment target uses and confirm it is NOT `'development'`. This is one of the most severe single-line risks in the codebase — misconfigured deploy = all subscription/license gating silently disabled for every tenant.
- [ ] Usage dashboard numbers match real counts (sales/purchase/user counts) per company, not stale/cached
- [ ] Audit log viewer displays entries correctly and (once paginated per `13-PERFORMANCE-AUDIT.md`) performs acceptably at scale
- [ ] Module Control toggles (`moduleConfig`) correctly propagate to the tenant Dashboard within one 5s config-poll cycle (or whatever new interval is set per performance fix) without requiring re-login
- [ ] Dynamic Config screens (Form/Column/Bill/FeatureFlag/PricingRule/Notification/Report configs, Permission Matrix) all round-trip create/edit/delete correctly per config type, and `ConfigChangeLog` records every change with correct before/after diff

---

## 14.3 API Test Checklist — Endpoint by Endpoint

Every endpoint below needs, at minimum: (1) happy path, (2) missing-auth-token → 401, (3) wrong-company-tenant access attempt → 403/404 (not another tenant's data), (4) malformed body → 400 with useful message, (5) where listed, pagination bounds test.

### Auth (`/api/auth`)
- [ ] `POST /register` — happy path, duplicate email, missing fields, weak password
- [ ] `POST /login` — happy path, wrong password, nonexistent user, suspended company
- [ ] `POST /forgot-password` — valid email, nonexistent email (no enumeration leak)
- [ ] `POST /reset-password` — valid token, expired token, reused token
- [ ] `GET /me` — valid token, expired token, malformed token, no token

### Sales (`/api/sales`)
- [ ] `POST /` — happy path single/multi-line, insufficient stock, missing party, missing items array, cross-tenant `itemId`/`partyId` from another company (should be rejected, not silently accepted)
- [ ] `GET /` — pagination `page`/`limit` bounds, `status`/date filters, empty result set
- [ ] `GET /:id` — own company, other company's ID (expect 404, verify it's not a 500 or, worse, a 200 with leaked data)
- [ ] `PUT /:id/status` — valid transitions, invalid status string
- [ ] `DELETE /:id` — active→cancelled with reversal entry, cancelled→hard-delete, nonexistent ID

### Purchase (`/api/purchases`) — mirror all 5 Sales cases above for Purchase

### Parties (`/api/parties`)
- [ ] `POST /` — happy path, missing required fields, duplicate name-within-company (verify uniqueness scope is per-company, not global)
- [ ] `GET /` — **no pagination currently; test with 1,000+ synthetic parties and measure response time/size** (ties to `13-PERFORMANCE-AUDIT.md`)
- [ ] `GET /search` — partial match, case-insensitive, special-character injection attempt (`$where`, regex metacharacters in query string)
- [ ] `GET /:id`, `PUT /:id`, `DELETE /:id` — cross-tenant isolation, delete-with-history behavior (see §14.2.9)

### Items (`/api/items`) — mirror Parties pattern above, plus:
- [ ] GST rate boundary values (0%, 5%, 12%, 18%, 28%, missing/null defaulting to 5% in reports)

### Jobs (`/api/jobs`)
- [ ] `POST /issue` — insufficient stock, valid stock, zero/negative qty
- [ ] `POST /receive` — already-received job, wastage cost calculation correctness, missing `purchaseId` fallback ₹100/mtr
- [ ] `PUT /process` — invalid status enum
- [ ] `GET /` — status filter, **no pagination** (test at scale)

### Ledgers (`/api/ledgers`) — dead/legacy path
- [ ] `GET /:partyId` — verify which service actually backs this (`ledgerService`/`LedgerEntry`, the confirmed **dead parallel books path**) vs the live `accountingController.getLedgerStatement` (`AccountingEntry`/`LedgerMaster`) — run both for the same party and **document any figure mismatch**; if they diverge, this proves the dead path still returns misleading numbers if anything still calls it
- [ ] `GET /balance/:partyId` — same dual-path verification

### Accounting (`/api/accounting`)
- [ ] `POST /ledgers` — create, duplicate name-within-company
- [ ] `GET /ledgers` — group/search/partyId filters, **no pagination** at scale
- [ ] `GET /ledgers/:id/statement` — date range filtering, cross-tenant ledger ID access (verify the explicit 403 check at `accountingController.js:143` actually fires)
- [ ] `POST /payments`, `POST /receipts` — all split-payment validation cases from §14.2.5
- [ ] `GET /payments` — vouchers filter by type/party/date, **no pagination**
- [ ] `GET /trial-balance` — `asOn` date boundary, verify Dr total = Cr total always (structural invariant test — if this ever fails, something upstream broke double-entry integrity)
- [ ] `GET /profit-loss` — `from`/`to` correctly excludes prior-period balances (regression test for the documented fix)
- [ ] `GET /balance-sheet` — `isBalanced` flag correctness; **explicitly test and document that this will show `isBalanced: false` or nonsensical figures without a formal year-close/opening-balance-carry-forward process**, since no year-close feature exists (see `10-ACCOUNTING-AUDIT.md`/`16-PRODUCTION-READINESS.md`)
- [ ] `GET /outstanding` — **N+1 performance test** with 200+ parties × 10+ invoices each, measure response time before/after the fix in `13-PERFORMANCE-AUDIT.md` §13.3.1
- [ ] `POST /journal` — balanced/unbalanced entries, period lock

### GST (`/api/gst`)
- [ ] `GET /gstr1` — B2B/B2CL/B2CS bucketing boundary at exactly ₹250,000 taxable
- [ ] `GET /gstr2` — supplier GSTIN missing warning path
- [ ] `GET /ca-dashboard` — full aggregation correctness, warnings engine, **no pagination/date-bounding — test with 2+ years of data and measure load time and memory**

### Reports (`/api/reports`) — all 9 endpoints
- [ ] Each of `bundle`, `sales`, `purchases`, `stock`, `outstanding`, `pl`, `jobwork`, `daily`, `masters` — happy path, empty-company (zero data) path, and the N+1/no-pagination stress test from §13.4

### Books (`/api/books`)
- [ ] `GET /module/:module` — invalid module name, correct filtering
- [ ] `GET /`, `POST /`, `DELETE /:id` — default-book uniqueness per module, delete-in-use handling

### Visits, Orders, Returns, Notes, SubMasters, Users, Config — mirror the generic CRUD pattern (happy path / auth / tenant-isolation / malformed body / pagination-at-scale) for each of:
- [ ] `visits`: `POST /`, `GET /`, `GET /:id`
- [ ] `orders`: `POST /`, `GET /`, `PUT /:id/status`
- [ ] `returns`: `POST /` (**with the enum-crash test from §14.2.17 as the critical case**), `GET /`
- [ ] `notes`: `POST /`, `GET /`
- [ ] `submasters`: full CRUD × 10 sub-types
- [ ] `users`: `GET /`, `POST /`, `PUT /:id`, `DELETE /:id` (deactivate) — including the "deactivated user's live JWT still works" test from §14.2.19
- [ ] `config`: `GET /active`, `GET /version` — verify version-hash changes correctly trigger frontend re-fetch within one poll cycle

### Admin (`/api/admin/*`) — all 35 sub-routes in `admin.routes.js`
- [ ] Every route requires `super_admin` role — explicitly attempt each with a regular `user` token and confirm 403 across **all 35**, not just a sample (this middleware gap has historically been where regressions slip in when new admin routes are added without copy-pasting the auth check)
- [ ] Company lock/unlock — immediate effect test (see §14.2.24)
- [ ] Module/Feature/Bill/Column/Form/PricingRule/Notification/Report config + Permission Matrix CRUD — each of the 8 dynamic-config sub-resources round-trips correctly and writes a `ConfigChangeLog` entry

---

## 14.4 Accounting-Specific Deep Test Set

- [ ] **Double-entry invariant**: for every `AccountingEntry` ever created by any flow (Sales, Purchase, Return, Payment, Receipt, Journal, wastage, job charges, reversal), sum of `Dr` lines === sum of `Cr` lines, to the paisa. Write this as an automated nightly integrity-check script against the real database, not just a one-time manual spot check.
- [ ] **Trial Balance always balances**: `totalDr === totalCr` at every `asOn` date tested (run at month-ends for 12 consecutive months of synthetic data)
- [ ] **Balance Sheet equation**: Assets = Liabilities + Capital, `isBalanced` true — and explicitly test what happens across a simulated financial-year boundary given **no year-close mechanism exists** (expect and document failure/nonsense here — this is a known gap, not a bug to "fix" within this checklist, but QA must quantify exactly how wrong it gets)
- [ ] **Reversal correctness**: cancel a Sales invoice that had a Payment applied against it — verify the reversal entry, the original entry's `isReversed` flag, and the invoice `paidAmount` all end up in a mutually consistent state (this is a 3-way consistency check, not just "reversal entry exists")
- [ ] **Period lock enforcement**: attempt every voucher-creating endpoint (`payments`, `receipts`, `journal`, and implicitly Sales/Purchase/Return which do not currently call `checkPeriodLocked` at all — **verify this gap**: `salesService.createInvoice` and `purchaseService.createPurchase` do **not** call `checkPeriodLocked`, only `accountingController`'s payment/receipt/journal endpoints do. This means a locked accounting period can still be silently violated by simply creating a new Sales or Purchase invoice — file as a defect.)
- [ ] **Outstanding/aging bucket boundaries**: invoices at exactly 30/60/90 days old land in the correct bucket, not the adjacent one (off-by-one test at the boundary)

## 14.5 GST-Specific Deep Test Set

- [ ] HSN summary quantity/value totals reconcile exactly with the sum of underlying invoice line items for the same period
- [ ] B2CL boundary: taxable amount of exactly ₹250,000.00 and ₹250,000.01 land in the correct bucket
- [ ] Interstate/intrastate split correctness **only verified true for Gujarat (state code 24)** — explicitly test with a non-Gujarat party GSTIN and document the resulting (incorrect) split as a known limitation
- [ ] GSTR-1 exported JSON validated against actual GSTN schema documentation (external reference, not just internal consistency) before any "portal-ready" claim
- [ ] GSTR-2B Matching screen explicitly tested and screenshotted as fake per §14.2.12, filed as a release-blocking compliance-labeling issue, not a cosmetic one

## 14.6 Multi-Tenancy / Cross-Company Isolation Deep Test Set

For **every** model that carries a `companyId` field (confirmed pattern across `InventoryLot`, `StockMovement`, `Sales`, `Purchase`, `Party`, `Item`, `Job`, `LedgerMaster`, `AccountingEntry`, `PaymentVoucher`, `ReturnInvoice`, `Order`, `DebitCreditNote`, `Visit`, `Book`, `AuditLog`, `PermissionMatrix`, etc.):

- [ ] Log in as Company A user, capture a real document ID (invoice, party, item, lot, ledger) belonging to Company A
- [ ] Log in as Company B user (different tenant), attempt `GET`/`PUT`/`DELETE` on that exact ID via direct API call
- [ ] Expected: 403 or 404 on every single one of the ~20+ tenant-scoped resource types. **Any 200 response with real data is a critical cross-tenant data leak** — this must be run as a scripted sweep across all list/detail/update/delete endpoints, not spot-checked on 2–3 examples, given how many controllers independently implement their own `{ ..., companyId }` filter by hand (no shared query-scoping middleware/plugin was found — every controller re-implements tenant filtering itself, which means a single missed `companyId` filter in any one controller is a leak with no other safety net)
- [ ] Specifically re-verify the `super_admin` fallback-tenant logic in `authMiddleware` (`backend/middlewares/auth.middleware.js:24-31`, picks the **first-created** `Company` in the whole database as the super-admin's working tenant when they have no `companyId`) — confirm this doesn't accidentally let a super-admin action bleed into an arbitrary real customer's tenant when the admin intended to act in a company-agnostic context

## 14.7 Concurrency / Race-Condition Test Set

- [ ] 20 concurrent Payment-voucher submissions for the same `companyId` — verify `Counter.nextSeq` (atomic `findOneAndUpdate` `$inc`) produces zero duplicate voucher numbers
- [ ] 10 concurrent Sales invoices drawing from the *same* `InventoryLot` with combined requested quantity exceeding `remainingMtrs` — verify Mongo transactions correctly serialize and reject the overdraft attempts rather than allowing negative stock (see §14.2.8)
- [ ] 5 concurrent Purchase submissions — verify no duplicate `LOT-{timestamp}-{random}` collision (§14.2.4)
- [ ] Concurrent config-change (Admin) + config-poll (Tenant) — verify no race where the tenant reads a half-written config document

## 14.8 Offline / PWA Sync Test Set (existing differentiator — protect, don't regress)

- [ ] Go offline (airplane mode) mid-session — app correctly shows `OfflineIndicator`, blocks network-dependent actions gracefully rather than hanging (verify against the 8s timeout / `isOfflineBlocked` short-circuit in `api/client.js`)
- [ ] Create a Sales invoice while offline — persists to IndexedDB, appears in local UI immediately
- [ ] Reconnect — `FailedSyncModal` correctly surfaces any sync conflicts/failures rather than silently dropping offline-created records
- [ ] Two devices create conflicting offline changes (e.g., both issue against the same lot) — verify sync reconciliation behavior is defined and doesn't silently corrupt stock (this is the hardest offline case; at minimum verify the failure mode is visible to the user, not silent data loss)
- [ ] Existing `frontend/e2e/offline.spec.js` Playwright spec passes in CI, not just locally
- [ ] Offline login works against a previously-cached session per `offlineAuth.js`

---

## 14.9 Automated Test Plan — What To Build

### 14.9.1 Backend unit tests (Jest, target: every `services/*.js` and `utils/*.js`)
- [ ] `accountingService`: `generateEntryNo`, `getOrCreatePartyLedger`, `getSystemLedger`, `onSalesInvoicePost`, `onPurchaseBillPost`, `onJobWorkChargesPost`, `onAbnormalWastagePost` — mock Mongoose models, assert correct Dr/Cr line construction for every voucher type
- [ ] `salesService.createInvoice` / `deleteSale` — including the insufficient-stock rejection and the (currently missing) stock-restoration-on-cancel gap as an explicit failing/skipped test that documents the known gap
- [ ] `purchaseService` — mirror above
- [ ] `jobService.issueToJob` / `receiveFromJob` — including cost-per-meter fallback logic
- [ ] `returnController.createReturn` — **this must include a unit test that reproduces the `source: 'return'` enum-validation crash** as the very first test written, so the fix is provably verified
- [ ] `reportService` — every report function against a seeded in-memory dataset, with assertions on the N+1 fix (assert query-count via a Mongoose query-logging spy, not just correctness of output)
- [ ] `gstService.getGstr1`/`getGstr2`/`getCADashboard` — bucketing boundary tests from §14.5
- [ ] `Counter.nextSeq` — concurrency test using `Promise.all` of 50 parallel calls, assert all 50 sequence numbers are unique

### 14.9.2 Backend integration tests (Jest + `mongodb-memory-server`)
- [ ] Spin up an in-memory Mongo, run the full Express app, hit every endpoint in §14.3 via `supertest`
- [ ] Seed multi-tenant fixture data (2 companies) and run the full cross-tenant isolation sweep from §14.6 as one parametrized test suite iterating over every route

### 14.9.3 Frontend component/unit tests (Vitest + React Testing Library)
- [ ] `Dashboard.jsx` menu visibility logic (`isMenuItemAllowed`, `isModuleAllowed`) — table-driven test over every menu item × every role/moduleConfig combination
- [ ] `AccountingForms` split-payment validation logic
- [ ] `GstModals` GSTR-1 bucketing math (mirror backend bucketing tests to guard against future client/server drift, given the GSTR-3B modal currently duplicates server logic client-side)
- [ ] `useStore.js` — critical actions (`bootstrapMasters`, `refreshAllData`, offline queueing) with a mocked API client

### 14.9.4 E2E (Playwright, expand beyond current single `offline.spec.js`)
- [ ] **Critical path 1**: Login → Create Party → Create Item → Create Purchase (lot created) → Create Sales invoice against that lot → verify Trial Balance reflects both postings
- [ ] **Critical path 2**: Purchase → Job Issue → Job Receive (with wastage) → verify new finished lot appears in Stock Ledger → Sales invoice against the finished lot
- [ ] **Critical path 3**: Create Sales invoice → attempt Sales Return → **assert current known failure mode explicitly** (turns into a regression-guard test once fixed)
- [ ] **Critical path 4**: Create Payment voucher split across 2 modes against a partially-paid invoice → verify invoice status flips to `paid` at the correct cumulative threshold
- [ ] **Critical path 5**: GSTR-1 generation end-to-end for a mixed B2B/B2CL/B2CS month, verify downloaded JSON structure
- [ ] **Critical path 6**: Cross-tenant negative test — two seeded companies, assert Company B truly cannot see Company A's dashboard data after login
- [ ] **Critical path 7 (regression guard)**: Cancel a Sales invoice, assert accounting reversal posts AND explicitly assert (documenting current behavior) whether stock is or isn't restored, so this test breaks loudly the day someone "fixes" it without updating docs
- [ ] Existing offline critical path (extend `offline.spec.js`) — add offline invoice creation + reconnect sync assertions

### 14.9.5 CI wiring
- [ ] Add `"test": "jest"` to `backend/package.json` plus `jest`/`supertest`/`mongodb-memory-server` devDependencies (currently absent from `package.json` despite stray `node_modules` presence)
- [ ] Add a GitHub Actions (or equivalent) workflow: on every PR, run backend unit+integration tests, frontend unit tests, and the Playwright E2E suite against an ephemeral Mongo + built frontend
- [ ] Gate merge to main branch on green CI once the above exists — currently there is no CI gate of any kind found in the repo

---

## 14.10 Launch Sign-Off Gate (QA → Engineering handoff criteria)

QA should **not** sign off on a commercial launch (see `16-PRODUCTION-READINESS.md` for the authoritative blocker list) until, at minimum:

- [ ] Sales Return no longer crashes (§14.2.17) — verified by an automated regression test, not just a manual click-through
- [ ] Server recomputes/validates tax amounts rather than trusting client-submitted `netAmount`/`gstAmount` (§14.2.3), or the risk is formally accepted in writing by whoever owns commercial liability
- [ ] RBAC (`PermissionMatrix`) is enforced server-side on at least the highest-risk mutating routes (Sales/Purchase/Accounting delete & status-change), verified by the direct-API-bypass test in §14.2.19
- [ ] `NODE_ENV` in the actual deploy target is confirmed NOT `'development'`, verified by hitting a real endpoint that should be subscription-gated and confirming the gate fires
- [ ] Invoice print/PDF no longer shows `DEMO_COMPANY` for any real tenant (§14.2.3)
- [ ] Fake GSTR-2B Matching and static Ledger Modal are either hidden/labeled or removed before any GST-compliance or "full ERP" marketing claim is made
- [ ] Cancel-sale/cancel-purchase stock-inconsistency behavior is at minimum documented and communicated to pilot customers as a known limitation, ideally fixed
- [ ] The N+1 and no-pagination performance issues are fixed or the pilot cohort size is capped to a volume that won't trigger them (document the cap)

This checklist should be re-run in full before every subsequent major release, not just the first launch.
