# 10 — Accounting & Books-of-Account Audit

Scope: `backend/models/AccountingEntry.js`, `LedgerMaster.js`, `PaymentVoucher.js`, `DebitCreditNote.js`, `Counter.js`; `backend/services/accountingService.js`, `reportService.js`, `ledgerService.js`; `backend/controllers/accountingController.js`, `returnController.js`, `noteController.js`; and every module that posts to the ledger (Sales, Purchase, Job, Returns, Notes, Payments/Receipts, manual Journal). This is the financial correctness core of the product — the module a real CA/auditor would scrutinize first.

---

## 1. The double-entry engine

**Live truth ledger:** `AccountingEntry` (journal-style, multi-line, `lines[]` array of `{ledgerId, ledgerName, type: 'Dr'|'Cr', amount, narration}`) + `LedgerMaster` (chart of accounts, `group ∈ {Assets, Liabilities, Income, Expenses, Capital}`).

**Dead parallel ledger:** `LedgerEntry` (single-line `{debit, credit}` per row) + `ledgerService.js`/`ledgerController.js`, exposed at `/api/ledgers/*`. Confirmed unreferenced by any live posting path (Sales/Purchase/Job/Returns/Notes/Payments all call `accountingService`, never `ledgerService.postToLedger`) — see `07-API-AUDIT.md` section 9 for the IDOR risk this dead stack still carries at the route level.

### 1.1 Schema-enforced balance rule

```84:106:backend/models/AccountingEntry.js
AccountingEntrySchema.pre('validate', function(next) {
  let totalDr = 0;
  let totalCr = 0;
  if (this.lines && this.lines.length > 0) {
    this.lines.forEach(line => {
      if (line.type === 'Dr') totalDr += line.amount;
      else if (line.type === 'Cr') totalCr += line.amount;
    });
  }
  if (Math.abs(totalDr - totalCr) > 0.01) {
    return next(new Error(`Double Entry Imbalance: Total Debits (₹${totalDr.toFixed(2)}) must equal Total Credits (₹${totalCr.toFixed(2)})`));
  }
  this.totalDebit = Number(totalDr.toFixed(2));
  this.totalCredit = Number(totalCr.toFixed(2));
  next();
});
```

This is a genuinely correct, model-level safety net: **every** write path that constructs an `AccountingEntry` — auto-postings from Sales/Purchase/Returns/Job-Work-Charges/Wastage, and manual Payment/Receipt/Journal vouchers — is forced through this validator with no way to bypass it short of `Model.collection.insertOne()` at the raw driver level (which nothing in this codebase does). Float-precision tolerance is a sane `0.01`. **This is the strongest single piece of financial-integrity engineering in the codebase.**

### 1.2 What is *not* enforced
- No check that a line's `ledgerId` actually exists in `LedgerMaster` for the same `companyId` at validation time — a forged/incorrect `ledgerId` would silently post against a non-existent or (if IDs collide across seed data) wrong-tenant ledger, only surfacing later as a "ledger not found" when someone tries to render a statement.
- No check that `entryDate` is not in the future, nor (except where individually added per-controller) that it isn't inside a locked period — locking is enforced by `checkPeriodLocked()` calls scattered per-controller (`createLedger`, `createPaymentVoucher`, `createReceiptVoucher`), and — as noted in `07/08` — **omitted entirely on `createJournalEntry`**, meaning a manual journal is the one posting path that can freely violate a locked period.
- No idempotency/duplicate-submission guard beyond the `{entryNo, companyId}` unique index — a network retry of an already-successful POST that regenerates a *new* `entryNo` via the atomic `Counter` will happily create a second, fully valid, duplicate entry.

---

## 2. Per-transaction posting rules (as actually coded)

| Transaction | Posting (from `accountingService.js` / controllers) | Correct double-entry? |
|---|---|---|
| **Sales Invoice** | `Dr Customer Ledger (netAmount)` / `Cr Sales A/c (taxableAmount)` + `Cr CGST/SGST/IGST Output (per invoice's own cgst/sgst/igst fields)` | ✅ Structurally correct, standard outward-supply posting. |
| **Purchase Bill** | `Dr Purchase A/c (taxableAmount)` + `Dr CGST/SGST/IGST Input` / `Cr Supplier Ledger (netAmount)` | ✅ Structurally correct, standard inward-supply + ITC posting. |
| **Payment Voucher (Posted)** | `Dr Party Ledger` / `Cr Bank Ledger` | ✅ Correct. |
| **Receipt Voucher (Posted)** | `Dr Bank Ledger` / `Cr Party Ledger` | ✅ Correct. |
| **Job Work Charges (on Receive)** | `Dr Job Work Charges + Dr CGST/SGST-or-IGST Input` / `Cr Job Worker Ledger` | ✅ Correct, and the **only** posting path with real GSTIN-based inter-state detection (see `11-GST-AUDIT.md`). |
| **Abnormal Wastage (on Receive, if wastage>0)** | `Dr Production Loss A/c` / `Cr Stock A/c` | ✅ Correct concept, costed at real per-meter rate. |
| **Sales/Purchase Cancellation (DELETE)** | Full reversal entry (all Dr/Cr lines flipped), original marked `isReversed:true` | ✅ Correct reversal mechanics — no lines are ever mutated/deleted in place, a proper audit-safe pattern. |
| **Manual Journal** | Whatever lines the operator enters, validated only by the Dr=Cr schema hook | ✅ Mechanically safe, but zero business-rule validation (e.g. nothing stops a user posting `Dr Sales A/c / Cr Sales A/c` as a no-op "balanced" entry, or debiting an `Income`-group ledger, which is unusual but not blocked). |

---

## 3. Confirmed structural defects

### 3.1 Sales/Purchase Return post to `Sales A/c`/`Purchase A/c`, not the dedicated Return ledgers
`accountingService.seedSystemLedgers()` explicitly seeds `Sales Return A/c` (Income/Direct Income) and `Purchase Return A/c` (Expenses/Direct Expenses) as system ledgers for every company (`accountingService.js:24-25`) — **but `returnController.js`'s posting logic never references either of them**:

```129:151:backend/controllers/returnController.js
if (returnType === 'Sales') {
  const salesLedger = await accountingService.getSystemLedger(companyId, 'Sales A/c');
  ...
  lines.push({ ledgerId: salesLedger._id, ledgerName: salesLedger.name, type: 'Dr', amount: taxableAmt, ... });
  ...
} else {
  const purchaseLedger = await accountingService.getSystemLedger(companyId, 'Purchase A/c');
  ...
  lines.push({ ledgerId: purchaseLedger._id, ledgerName: purchaseLedger.name, type: 'Cr', amount: taxableAmt, ... });
```

**Impact:** `Sales A/c` and `Purchase A/c` are debited/credited directly by returns instead of routing through `Sales Return A/c`/`Purchase Return A/c`. The **net** balance on the books is arithmetically correct (a return is a contra to the same-natured account either way, so Trial Balance still balances and P&L's bottom line is unaffected), but:
- **Gross revenue/purchase figures are understated by the return amount** rather than shown gross with a separate contra line — a CA reviewing the Trial Balance sees "Sales A/c: ₹X" where X is already net-of-returns, with no way to see gross sales and gross returns separately from the ledger itself (the only place gross-vs-return is visible is the transaction-level `Sales`/`ReturnInvoice` collections, not the books of account).
- The two return ledgers seeded specifically for this purpose sit permanently at zero balance in every company, forever — dead system ledgers.
- Any external audit or GST reconciliation process that expects "Sales Returns" to appear as its own line in a P&L/Trial Balance (standard practice, and often specifically required for GSTR-9 annual return reconciliation) will not find one.

### 3.2 Returns always split GST 50/50 CGST/SGST — inter-state returns are misposted
Both branches of `returnController.js` (lines 136-141 for Sales, 152-157 for Purchase) unconditionally do:
```js
const halfGst = parseFloat((gstAmt / 2).toFixed(2));
const otherHalf = parseFloat((gstAmt - halfGst).toFixed(2));
lines.push({ ledgerId: cgstLedger._id, ... });
lines.push({ ledgerId: sgstLedger._id, ... });
```
with **no branch for IGST at all** — contrast this with `onSalesInvoicePost`/`onPurchaseBillPost` (which post CGST+SGST+IGST as three independently-optional lines based on whatever the invoice itself carries) and with `onJobWorkChargesPost` (which does a real GSTIN-state-code inter-state check). **A return against an inter-state original sale/purchase will incorrectly reverse CGST Output/Input and SGST Output/Input — accounts that were never debited/credited by the original inter-state transaction in the first place** — while the real `IGST Output`/`IGST Input` that *was* affected by the original transaction is never touched by the return at all. This silently corrupts the CGST/SGST/IGST sub-ledgers for any inter-state return, even though the overall taxable+tax total still balances against the party.

### 3.3 Debit/Credit Notes post no GST lines whatsoever
`noteController.js`'s posting logic (lines 50-99) posts only the flat `amount` to `Sales A/c`/`Purchase A/c` against the party ledger — **there is no GST line in either branch**, and the `DebitCreditNote` schema itself has no `gstAmount`/`taxableAmount`/`cgst`/`sgst`/`igst` fields to even capture a tax component if the code were fixed. Any Credit/Debit Note representing a GST-bearing adjustment (rate difference, shortage, quality claim — the overwhelming majority of real-world notes) posts an amount that implicitly contains GST but records **none of it against CGST/SGST/IGST Output or Input**, meaning:
- The company's GST output/input tax ledgers never reflect note-driven adjustments.
- `11-GST-AUDIT.md`'s finding that `gstService.getCADashboard()`'s `noteGst` figure is always `0` (reading a non-existent `n.gstAmount` field) is a direct downstream consequence of this same schema gap.

### 3.4 Opening Balances are never posted as a dated journal entry
`Party.openingBalance`/`openingBalanceType` and `LedgerMaster.openingBalance`/`openingBalanceType` are **static fields on the master record itself** — there is no corresponding "Opening Balance" `AccountingEntry` document, and `AccountingEntry.voucherType`'s enum (`Payment, Receipt, Journal, SalesAuto, PurchaseAuto, JobWorkAuto, WastageAuto, ReturnAuto, NoteAuto`) has **no `'Opening'` value at all** — there is no schema slot for one even if the code wanted to create it.

**Consequences:**
- `computeRunningBalances()` (`accountingController.js:515-567`, backs Trial Balance / P&L / Balance Sheet) manually seeds every ledger's starting balance from the master field before adding aggregated `Dr`/`Cr` totals — this works correctly **only when the requested period covers the ledger's entire history**. There is no dated "opening" transaction, so the opening balance cannot be attributed to a point in time; `computeRunningBalances(companyId, asOnDate, fromDate)` **always** adds the full static `openingBalance`, regardless of `fromDate` — a P&L or Trial Balance requested for a sub-period still includes the ledger's all-time opening balance in the base, which is only correct if `openingBalance` genuinely represents the balance as of *that specific* `fromDate` (true only when `fromDate` coincides with the company's actual books-opening date).
- **The Ledger Statement (`GET /api/accounting/ledgers/:id/statement`) has the same bug in a more visible place:** `accountingController.js:164-169` sets `currentBalance` from `ledger.openingBalance` unconditionally, then walks only the entries matching the requested `{from, to}` filter. **Requesting a mid-period statement (e.g. "this ledger, from 1 June") does not compute "balance as of 31 May" as the starting point — it always starts from the ledger's original opening balance and then adds only the entries dated on/after 1 June**, silently omitting the net effect of every entry between the true opening date and the requested `from` date. Any ledger with transactions before the requested `from` date will show an **incorrect running balance for every line in the returned statement**, understated or overstated by exactly that omitted net effect.
- There is no audit trail proving *when* or *by whom* an opening balance was set/changed — editing `Party.openingBalance` via `PUT /api/parties/:id` retroactively changes every past and future Trial Balance/Statement computation with no journal record of the change ever having happened, unlike every other financial mutation in the system (which all flow through an immutable, reversal-only `AccountingEntry`).

### 3.5 Opening Stock has no accounting entry at all
`inventoryService.createOpeningStock()` (`08-BUSINESS-FLOWS.md` Flow 5 / `07-API-AUDIT.md` 4.1) creates an `InventoryLot` + `StockMovement` and **stops there** — no `Dr Stock A/c` entry is posted anywhere, despite `Stock A/c` existing as a seeded system ledger used elsewhere (Abnormal Wastage's `Cr Stock A/c`). This means:
- A company's opening stock value never appears on the Balance Sheet's Assets side via the books — the only place opening stock is visible at all is the Inventory/Stock Report (a quantity-only view, and — per `07-API-AUDIT.md` 11.4 — one whose computed `value` field is always `0` anyway, since `InventoryLot` has no `rate` field).
- `Stock A/c`'s balance is **only ever credited** (by wastage) across the entire codebase — there is no code path that ever debits it upward for a genuine stock increase (not for Purchase, not for Job Receive, not for Opening Stock). `Stock A/c` as modeled is a write-only decrement account with no corresponding increment logic, i.e., it is not actually functioning as a real "closing stock asset" ledger in any usable sense — the Balance Sheet's `Assets` group will never show meaningful stock value through this ledger.

### 3.6 Balance Sheet excludes the P&L plug — `isBalanced` is unreliable
```612:643:backend/controllers/accountingController.js
exports.getBalanceSheet = async (req, res) => {
  ...
  const assets = balances.filter(b => b.ledger.group === 'Assets');
  const liabilities = balances.filter(b => b.ledger.group === 'Liabilities');
  const capital = balances.filter(b => b.ledger.group === 'Capital');
  const totalAssets = assets.reduce(...);
  const totalLiabilities = liabilities.reduce(...);
  const totalCapital = capital.reduce(...);
  ...
  isBalanced: Math.abs(totalAssets - (totalLiabilities + totalCapital)) < 0.01
```
This computes `Assets = Liabilities + Capital` using **only** ledgers whose `group` is literally `Assets`/`Liabilities`/`Capital` — it never folds the **net result of Income and Expenses** (i.e., current-period Profit or Loss) into Capital/Retained Earnings before comparing. In standard double-entry accounting, the Balance Sheet only balances when the P&L's net profit/loss is added to (or subtracted from) the Capital/Retained Earnings side as a "plug" — because `Sales A/c`/`Purchase A/c`/expense ledgers accumulate real Dr/Cr postings all year (every Sale credits `Sales A/c`, every Purchase debits `Purchase A/c`), the accounting equation `Assets = Liabilities + Capital` is **structurally guaranteed to be out of balance by exactly the amount of net profit/loss for the period**, for **any company with nonzero sales/purchase activity**, every single time this endpoint is called.

**Concretely:** every sale posts `Dr Customer (Asset ↑)` / `Cr Sales (Income, excluded from this calc)` — the Asset side goes up but nothing on the Liabilities/Capital side reflects it, because Income isn't folded in. `isBalanced` will therefore report `false` for essentially every real, active company, making the field actively misleading (a genuinely balanced set of books, correctly reflecting real trading activity, is reported as "not balanced"). There is a `Retained Earnings` system ledger seeded (`accountingService.js:22`) that is **never posted to by any code path** — it exists as the obvious intended destination for this P&L-to-Capital plug but the closing/rollup logic that would populate it was never implemented. This is a genuine, launch-relevant financial-reporting defect, not a cosmetic one — a Balance Sheet screen (which, per `07-API-AUDIT.md` 8.9, has no frontend caller at all currently, likely *because* this defect makes it unusable) cannot be trusted to represent real financial position without a manual period-close adjustment the system never performs.

### 3.7 Dual, disagreeing Profit & Loss implementations
Two structurally different P&L calculators exist and are both live, callable endpoints:

| | `accountingController.getProfitLoss` (`/api/accounting/profit-loss`) | `reportService.getProfitLoss` (`/api/reports/pl`, also inside `/api/reports/bundle`) |
|---|---|---|
| Basis | **Ledger-based**: sums `AccountingEntry.lines` for ledgers where `group ∈ {Income, Expenses}` | **Invoice-based**: sums `Sales.taxableAmount`/`Purchase.taxableAmount` directly from the `Sales`/`Purchase` collections, `status !== 'cancelled'` |
| Includes manual journals affecting Income/Expense ledgers (e.g. a hand-posted "Bad Debts Written Off" journal) | ✅ Yes — any journal touching an Income/Expense ledger flows through | ❌ No — only `Sales`/`Purchase` documents are read; manual journal adjustments to revenue/expense ledgers are invisible to this calculator |
| Includes Job Work Charges / Abnormal Wastage (posted as `Expenses`-group ledgers) | ✅ Yes (they post to `Job Work Charges`/`Production Loss A/c`, both `Expenses`-group) | ❌ No — `reportService.getProfitLoss` has no awareness of `Job`/`AccountingEntry` at all |
| Affected by the Sales/Purchase Return misposting (3.1) | ✅ Yes (returns hit `Sales A/c`/`Purchase A/c` directly, same ledgers this calculator reads) | ❌ **Also affected but differently** — `Sales.find({status:{$ne:'cancelled'}})` does not exclude or net returns at all (a `ReturnInvoice` is a separate collection never queried here), so this P&L's revenue figure is **gross of returns**, while the ledger-based P&L's `Sales A/c` balance is **net of returns** (per 3.1) — **the two P&L reports will show different Sales/Revenue figures for the exact same period, by design of their divergent data sources, with no reconciliation between them.** |

**Impact:** A CA or investor pulling "the P&L" from this system gets a materially different number depending on which of the two equally-legitimate-looking endpoints they call, with no indication in either response that a second, disagreeing calculation exists. This is the kind of discrepancy that fails an audit immediately.

### 3.8 TCS and Freight fields exist but are never posted
- `Sales.tcs`, `Sales.tcsPer`, `Sales.tcsAmount` — present on the schema (relevant for textile trading, where TCS under Section 206C(1H)/GST TCS provisions can apply) — **never read by `onSalesInvoicePost`**; no `AccountingEntry` line is ever created for TCS, and no "TCS Payable" or "TCS Receivable" system ledger is seeded at all (`SYSTEM_LEDGER_TEMPLATES` has no TCS entry). Any TCS amount typed into a Sales Invoice is stored on the `Sales` document and displayed on the printed invoice (if the PDF template reads it) but has **zero accounting effect** — it does not increase the customer's receivable, does not create a TCS liability, and will never appear on a Trial Balance.
- `Sales.freight`, `Purchase` has no equivalent field — `Freight Charges` **is** a seeded system ledger (`accountingService.js:20`, `Expenses/Indirect Expenses`) but, like `Stock A/c` and both Return ledgers, is **never posted to by any code path** — a fully dead system ledger. Freight charged on a sales invoice is captured as a display-only number, not an accounting transaction; it neither increases the customer's net receivable in the books (the `netAmount` computation is done client-side and trusted as-is, per `07-API-AUDIT.md` API-8, so freight *might* be folded into `netAmount` by the frontend's calculation — but even if so, it lands undifferentiated inside `Dr Customer`/`Cr Sales A/c`, with no distinct `Freight Charges` line, meaning freight income/recovery is indistinguishable from fabric sales revenue in the books).

### 3.9 `'Both'`/`'Broker'`/`'Job Worker'` party types are hardcoded as creditors
```70:73:backend/services/accountingService.js
const isCreditor = ['Supplier', 'Both', 'Job Worker', 'Broker'].includes(party.type);
const group = isCreditor ? 'Liabilities' : 'Assets';
const subGroup = isCreditor ? 'Sundry Creditors' : 'Sundry Debtors';
```
`getOrCreatePartyLedger()` decides a party's **first-ever-referenced** ledger group permanently based on this static list at the moment the ledger is auto-created (subsequent calls just re-find the same `LedgerMaster` document, `group` is never re-evaluated). Consequences:
- A `Party.type: 'Both'` (a party who is simultaneously a customer and a supplier — common for barter/adjustment-style textile trading relationships, e.g. a mill that both sells finished goods to and buys grey from the same counterparty) is **always** bucketed as a pure creditor (`Liabilities`/`Sundry Creditors`), even on the very first transaction being a Sales Invoice to them (which should intuitively create a debtor relationship). Their single ledger then accumulates both receivable-natured and payable-natured postings from Sales and Purchase transactions alike, netted into one `Liabilities`-side balance — a `'Both'` party who is a large net debtor (they owe the company more than the company owes them) will show as a **negative Sundry Creditor balance** on the Balance Sheet rather than as a positive Sundry Debtor, which is arithmetically fine for the total but structurally wrong for BS presentation (receivables and payables are supposed to be shown gross, not netted into the wrong side).
- A `Broker`'s commission-earning relationship is treated identically to a Supplier — reasonable in most cases (brokers are usually paid, i.e., are creditors) but the same party could also occasionally be a customer if the business model allows it, with the same first-write-wins group-lock problem.
- Once a `Party.type` is later changed (e.g. `Customer` → `Both`) via `PUT /api/parties/:id`, the **already-created** `LedgerMaster` document's `group`/`subGroup` is **not retroactively updated** — the ledger silently continues under its original classification forever, regardless of the party master's current type.

### 3.10 GRN (Goods Receipt Note) posting functions are dead code
`accountingService.onGRNPost()` and `accountingService.onPurchaseBillLinkedToGRN()` (`accountingService.js:189-231`) are fully implemented (correct `Dr Stock A/c / Cr GRN Clearing A/c` and clearing-reversal logic) but **have no caller anywhere in the codebase** — confirmed by exhaustive `Grep` for both method names outside their own definitions. There is no `GRN` Mongoose model, no `/api/grn/*` route, no GRN-related frontend screen. `AccountingEntry.refType`'s enum still includes `'GRN'` as a legal value (`AccountingEntry.js:27`) for an entry type that can never actually be created. This is either an abandoned three-way-match (PO→GRN→Invoice) feature or scaffolding for a future one — either way, the `GRN Clearing A/c` system ledger it would use sits permanently at zero, like the Return and Freight ledgers.

---

## 4. Books-of-Account Coverage Gaps

| Standard book | Status |
|---|---|
| **Sales Register** | ✅ `reportService.getSalesRegister()` / `/api/reports/sales` (orphaned route, but bundle-embedded and used) |
| **Purchase Register** | ✅ Same pattern |
| **Journal Register** | ⚠️ Implicit only — `AccountingEntry.find()` filtered by `voucherType:'Journal'` is possible via direct query but **no dedicated `/api/accounting/journal-register` (list) endpoint exists** — only `POST /journal` (create) is exposed; there is no way to list/browse posted manual journal entries through the API at all, only to create new ones blind. |
| **Cash Book** | ❌ **Missing as a dedicated module.** `Dashboard.jsx`'s "Cash Book" menu item opens the same generic Payment/Receipt voucher modal as everything else (`08-BUSINESS-FLOWS.md` cross-reference) — there is no filtered "show me `Cash A/c`'s ledger statement specifically, in day-book format" screen; the operator would have to manually locate the `Cash A/c` `LedgerMaster` document and open its generic Ledger Statement, which is not the same UX or format as a traditional Cash Book (day-wise receipts/payments columnar view). |
| **Bank Book** | ❌ Same gap — "Bank Book" menu item is another alias for the same generic voucher modal, not a bank-specific day book, and with **multiple bank ledgers possible per company** (nothing prevents creating several `Assets/Cash & Bank`-subgroup ledgers), there is no per-bank-account reconciliation screen, no bank-statement-import/reconciliation feature, and no cheque-register (despite `PaymentVoucher.chequeNo`/`chequeDate` being captured — there is no "outstanding cheques" report). |
| **Contra Voucher (Cash↔Bank transfer)** | ❌ **Missing entirely.** `PaymentVoucher.voucherType` enum is `['Payment', 'Receipt']` only — there is no `'Contra'` type, and neither `PaymentVoucher` schema nor `accountingController.js` has any code path for a Cash-to-Bank or Bank-to-Bank transfer that isn't tied to a `partyLedgerId` (every Payment/Receipt voucher requires a party ledger — a pure internal transfer between the company's own Cash and Bank ledgers has no natural home in this data model at all). The only way to record such a transfer is a manual Journal Entry, which works mechanically (Dr one ledger, Cr the other) but bypasses all of the Payment/Receipt-specific features (payment-mode splits, cheque/UTR reference capture, `againstInvoices` linkage — none of which apply to a contra anyway, but it means Contra transactions are indistinguishable from any other manual journal in reporting, with no `voucherType: 'Contra'` to filter by). |
| **Trial Balance** | ✅ Implemented, single-aggregation-query, performant. Subject to the opening-balance date-anchoring caveat in 3.4. |
| **Profit & Loss** | ⚠️ Two disagreeing implementations (3.7). |
| **Balance Sheet** | ⚠️ Implemented but structurally guaranteed to report `isBalanced: false` for active companies (3.6), and has no frontend caller. |
| **Day Book (all vouchers, chronological, one screen)** | ⚠️ Partially covered by `reportService.getDailyTransactions()` (`/api/reports/daily`) — merges Sales/Purchase/Vouchers into one date-sorted list, but does **not** include Job Work, Returns, or Notes transactions, so it is not a complete Day Book. |

---

## 5. Multi-year / Period-Close

- **No financial-year-end close process exists anywhere in the codebase.** `Company.settings.financialYearStart` (`'April'`/`'January'`) is stored but never used to gate or trigger any closing routine. `CompanySettings.financialYear` (a free-text string like `'2024-25'`) is similarly just a display label.
- **No carry-forward mechanism.** Since `AccountingEntry` accumulates indefinitely in one continuous ledger per company with no year-boundary concept, and `LedgerMaster.openingBalance` is a single static field (not year-scoped), there is no way to "close FY2024-25 and open FY2025-26 with carried-forward balances" — the system implicitly treats the company's entire operating history as one perpetual accounting period. This also means the `Retained Earnings` ledger (seeded, unused per 3.6) has no closing routine that would ever populate it, compounding the Balance Sheet defect.
- `Party.updateInAllYear` (`'Y'`/`'N'`) — a vestigial field from the legacy multi-year desktop system this data model appears descended from (see `09-TEXTILE-DOMAIN.md` section 4) — implies multi-year party-master propagation was a design goal at some point; no such mechanism exists today.
- **Period locking** (`Company.settings.lockedUntilDate`) is the only "close-adjacent" control that actually works, and even it has the gap noted in 1.2/8.11 (`createJournalEntry` doesn't check it).

---

## 6. Summary Scorecard

| Dimension | Assessment |
|---|---|
| Double-entry integrity (schema level) | **Strong** — the `pre('validate')` Dr=Cr hook is real and universally applied. |
| Auto-posting correctness for core trade (Sales/Purchase/Job) | **Good** — structurally correct Dr/Cr, real GSTIN-based inter-state detection on Job Work. |
| Returns/Notes posting correctness | **Weak** — wrong ledgers (3.1), wrong GST split (3.2), no GST at all (3.3). |
| Opening balance handling | **Weak** — not journaled, date-anchoring bug on statements (3.4). |
| Balance Sheet reliability | **Broken for any active company** (3.6). |
| P&L reliability | **Internally inconsistent** — two disagreeing sources of truth (3.7). |
| Books-of-account completeness | **Incomplete** — no Cash Book, Bank Book, or Contra as real features; Journal Register has no list endpoint. |
| Period close / multi-year | **Not implemented.** |
| Dead/vestigial system ledgers | Sales Return A/c, Purchase Return A/c, Freight Charges, Stock A/c (write-only), GRN Clearing A/c, Retained Earnings — **6 of ~19 seeded system ledgers are permanently zero-balance dead weight** in every company created by this system. |

**Verdict:** the transaction-posting layer for the three core trading flows (Sales, Purchase, Job Work receive) is competently engineered with real transactional safety and a genuinely enforced double-entry invariant. Everything adjacent to period-end reporting (Balance Sheet, dual P&L), adjustment documents (Returns, Notes), and books-of-account completeness (Cash/Bank Book, Contra, year close) is **not production-ready for a business that needs audited, GST-reconcilable financial statements** — which is the normal bar for any registered GST taxpayer in India. This is consistent with the `10-ACCOUNTING-AUDIT` score already reflected in `00-INDEX.md`'s scoreboard ("accounting close broken" listed as a production-readiness blocker).
