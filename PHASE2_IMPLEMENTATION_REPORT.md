# PHASE 2 IMPLEMENTATION REPORT: JSM UI FIELD ALIGNMENT & TRANSACTION GRID PARITY

**Project:** `Billing-software`  
**Branch:** `feature/phase1-ui-field-alignment`  
**Date:** October 21, 2026  
**Status:** Complete & Verified  

---

## 1. Files Changed and Rationale

| File Path | Component / Layer | Rationale for Modification |
| :--- | :--- | :--- |
| `backend/models/Sales.js` | Backend Schema | Added optional `lotNo: { type: String, trim: true, default: '' }` to line items subschema (`items`). Supports saving textual lot references alongside existing `lotId` without altering calculation formulas or payload format. |
| `backend/models/Purchase.js` | Backend Schema | Added optional `lotNo: { type: String, trim: true, default: '' }` and `weaverName: { type: String, trim: true, default: '' }` to purchase line items (`items`). Aligns with legacy JSM purchase inward attributes. |
| `frontend/src/pages/sales/SalesModal.jsx` | Frontend View / Modal | 1. Memoized `itemStockMap` over `inventoryLots` to provide live stock badges in item selection.<br>2. Added secondary balance badges (`₹X Dr`) to Customer combobox.<br>3. Linked `matchedLot` from `inventoryLots` on item selection to attach `lotId` and `lotNo`.<br>4. Preserved `lotId` and `lotNo` in save payload and reload (`loadInvoiceData`).<br>5. Implemented `⚙ Columns` toggle menu with `localStorage` persistence (`erp_sales_grid_cols`) for optional columns (`desc`, `fold`, `cut`, `dis1`, `dis2`, `addAmt`). |
| `frontend/src/pages/purchase/PurchaseModal.jsx` | Frontend View / Modal | 1. Integrated `inventoryLots` from `useStore()` and memoized live stock quantity lookup.<br>2. Added secondary payable badges (`₹X Cr`) to Vendor combobox and stock badges to Item combobox.<br>3. Added JSM-evidenced columns: `DIS2%`, `DISAMT.`, `Lot No`, and `Weaver`.<br>4. Preserved `lotNo` and `weaverName` in save payload and reload (`loadPurchaseData`).<br>5. Implemented `⚙ Columns` toggle menu with `localStorage` persistence (`erp_purchase_grid_cols`). |

*Note: Phase 1 files (`backend/models/Party.js`, `backend/models/Item.js`, `backend/services/partyService.js`, `backend/services/itemService.js`, `frontend/src/pages/masters/AccountMasterModal.jsx`, `frontend/src/pages/masters/ItemMasterModal.jsx`) were preserved without regression.*

---

## 2. Added & Updated Fields / Controls with JSM Audit Evidence

All additions were verified against the reverse-engineered SQL Server schema dumps (`raw_stp_setting.csv`, `raw_form_controls.csv`, `03_TRANSACTION_FORM_FIELD_CATALOG.csv`):

| Transaction Screen | Field / Control | JSM Legacy Setting Evidence (`STP_SETTING`) | Description & MERN UI Implementation |
| :--- | :--- | :--- | :--- |
| **Sales Grid** | `Lot No` / `lotId` | `TABLENAME='SALES'`, `SMRY_DTL=2`, `STP_ADDLESS` lot linkages | Automatically resolves active lot from in-memory inventory lots when an item is selected. Populates line `lotId` and `lotNo`. |
| **Sales Grid** | `⚙ Columns` (Visibility) | Legacy JSM desktop column visibility & sizing settings (`WIDTH`, `IS_VISIBLE`) | Custom dropdown toggle persisted in `localStorage` (`erp_sales_grid_cols`). Allows showing/hiding `desc`, `fold`, `cut`, `dis1`, `dis2`, `addAmt`. |
| **Sales Header** | Customer Outstanding Balance | Legacy Sales header party balance indicator (`DR_AMT` / `CR_AMT`) | Displayed as badge on Customer combobox options: `₹X Dr` (receivable) or `₹X Cr` (advance). |
| **Sales Grid** | Item Stock & Lots Badge | Legacy Item selection grid stock display (`STK_QTY`) | Displayed on Item combobox options: `X MTR (N lots)` or `0 MTR` based on in-memory lots. |
| **Purchase Grid** | `DIS2%` (`dis2Per`) | `TABLENAME='PURCHASE'`, `COL_HEADER='DIS2%'`, `FLD_NAME='DIS2_PER'`, `WIDTH=500` | Line-level secondary trade discount percentage input. Passed directly to `purchaseTotals.js`. |
| **Purchase Grid** | `DISAMT.` (`dis2Amt`) | `TABLENAME='PURCHASE'`, `COL_HEADER='DISAMT.'`, `FLD_NAME='DIS2_AMT'`, `WIDTH=600` | Secondary discount amount (calculated automatically from percentage or manually inputted). |
| **Purchase Grid** | `Lot No` (`lotNo`) | `TABLENAME='PURCHASE'`, `COL_HEADER='Lot No'`, `FLD_NAME='LOT_NO'`, `WIDTH=900` | Inward textile lot identifier input for greige/fabric tracing. |
| **Purchase Grid** | `Weaver` (`weaverName`) | `TABLENAME='PURCHASE'`, `COL_HEADER='Weaver'`, `FLD_NAME='WEAVER_NAME'`, `WIDTH=1000` | Weaver/job-worker name associated with inward textile goods. |
| **Purchase Grid** | `⚙ Columns` (Visibility) | Legacy JSM desktop purchase column settings | Custom dropdown toggle persisted in `localStorage` (`erp_purchase_grid_cols`). |
| **Purchase Header** | Supplier Outstanding Balance | Legacy Purchase header vendor balance indicator | Displayed on Vendor combobox options: `₹X Cr` (payable) or `₹X Dr` (advance). |

---

## 3. Persistence Classification

| Field / Control | Classification | Persistence Details |
| :--- | :--- | :--- |
| `Sales.items[].lotId` | **Persisted by Existing API** | Pre-existing field in `backend/models/Sales.js`; now populated upon item selection and submitted in payload. |
| `Sales.items[].lotNo` | **Persisted by Existing API** | Added optional string field to `backend/models/Sales.js`. Handled automatically by existing sales controller. |
| `Purchase.items[].dis2Per` | **Persisted by Existing API** | Pre-existing in `backend/models/Purchase.js` and `purchaseTotals.js`. Now exposed in grid UI. |
| `Purchase.items[].dis2Amt` | **Persisted by Existing API** | Pre-existing in `backend/models/Purchase.js` and `purchaseTotals.js`. Now exposed in grid UI. |
| `Purchase.items[].lotNo` | **Persisted by Existing API** | Added optional string field to `backend/models/Purchase.js`. Handled automatically by existing purchase controller. |
| `Purchase.items[].weaverName` | **Persisted by Existing API** | Added optional string field to `backend/models/Purchase.js`. Handled automatically by existing purchase controller. |
| Grid Column Visibility (`salesCols`, `purchaseCols`) | **Client-Side Persistent (UI-Only)** | Stored in browser `localStorage` (`erp_sales_grid_cols` and `erp_purchase_grid_cols`). |
| Master Selector Badges (Balances & Stock) | **UI-Only** | Dynamically computed in-memory from pre-fetched Zustand store data (`parties`, `inventoryLots`). Zero extra database writes or schema fields. |

---

## 4. Unaltered Calculation, Accounting, GST & Stock Services Confirmation

Per **Strict Safety Rule #2**, all financial calculations, tax engines, and posting hooks remain completely untouched:

- `backend/services/salesBillCalc.js` — **UNTOUCHED** (0 lines modified)
- `backend/services/jobReceiptCalc.js` — **UNTOUCHED** (0 lines modified)
- `backend/services/salesTotals.js` — **UNTOUCHED** (0 lines modified)
- `backend/services/purchaseTotals.js` — **UNTOUCHED** (0 lines modified)
- `backend/services/returnTotals.js` — **UNTOUCHED** (0 lines modified)
- `backend/services/accountingPostingService.js` — **UNTOUCHED** (0 lines modified)
- `backend/services/gstDetermination.js` & GST filing routes — **UNTOUCHED** (0 lines modified)
- Stock reservation and inventory movement hooks (`backend/services/inventoryStockHelper.js`) — **UNTOUCHED** (0 lines modified)

No automatic mill issue, stock deductions, or financial journal mutations were added.

---

## 5. Grid Configuration Behavior & Persistence Limitations

1. **Behavior:**
   - Both `SalesModal.jsx` and `PurchaseModal.jsx` feature a `⚙ Columns` toggle button located on the grid action bar.
   - Clicking opens an accessible popover displaying checkboxes for optional columns.
   - Users can toggle column visibility in real time.
   - Essential columns (`Sr #`, `Item Name`, `Qty/Pcs`, `Rate`, `Per`, `Amount`, `GST`, `Total`, `Actions`) are non-toggleable and locked visible to prevent grid corruption.
   - Column selections are remembered across modal openings, browser refreshes, and app restarts.
2. **Persistence Limitations:**
   - Saved strictly in browser `localStorage` under `erp_sales_grid_cols` and `erp_purchase_grid_cols`.
   - Settings are browser- and device-specific; they do not sync across different user workstations or across different user logins on shared browsers.
   - If local storage is cleared by the user or private browsing mode is active, the grid gracefully resets to default column visibility.

---

## 6. Master Selector Badges Implementation

1. **Party Outstanding Balance:**
   - **Sales Customer Selector:** Reads `party.currentBalance || party.openingBalance`. Appends badge `₹${balance} Dr` (warn badge if balance > 0) or `₹${balance} Cr` (ok badge if advance).
   - **Purchase Vendor Selector:** Reads `vendor.currentBalance || vendor.openingBalance`. Appends badge `₹${balance} Cr` (warn badge if payable > 0) or `₹${balance} Dr` (ok badge if advance).
2. **Item Stock Quantity & Lot Count:**
   - Memoized mapping `itemStockMap` groups `inventoryLots` by `itemId`.
   - Computes total available quantity and count of active lots without executing new API requests.
   - Displays `badge: "${qty} ${unit} (${lotCount} lots)"` or `badge: "0 ${unit}"` (warn badge).
3. **No N+1 Overhead:**
   - Leverages pre-existing Zustand `useStore()` state (`parties`, `inventoryLots`, `items`).
   - Zero additional network calls or synchronous fetch requests on combobox render or search.
4. **Omitted Badges:**
   - Overdue bill aging (e.g., 30/60/90 days) and credit limit utilization were omitted because they are not present in the lightweight party master payload and would require synchronous API round-trips.

---

## 7. Unresolved Fields & Uncertain JSM Mappings

1. **Weaver Master Linkage vs Free Text:**
   - In legacy JSM desktop ERP, the `Weaver` field in Purchase could either link to an optional Sub-Account / Job-Worker Master or be entered as free text. In Phase 2, `weaverName` is captured cleanly as an optional text string on the line item. If future phases require weaver sub-ledger linkage, a master combobox can be bound.
2. **Multi-Tax Sub-Components:**
   - Legacy JSM had columns for `ADD_TAX_PER`, `SURCHARGE`, and custom cess formulas. In MERN ERP, GST conforms to modern statutory Indian GST (CGST, SGST, IGST, Cess). These legacy VAT/excise sub-columns remain excluded from the standard GST grid.

---

## 8. Verification Commands & Results

### 1. Frontend Production Build Check
```bash
npm --prefix frontend run build
```
- **Result:** **Success (0 errors)**.
- **Output:** Built cleanly in 46.77s. Clean asset generation confirmed syntax, JSX, imports, and bundling validity.

### 2. Backend Unit Test Suite Check
```bash
node --test backend/tests/unit/*.test.js
```
- **Result:** **All 79 tests passed (0 failures, 16 suites)**.
- **Coverage Verified:**
  - `gstDetermination` (GSTIN validation, Place of Supply, Tax components, Periods): Passed.
  - GSTR-1 Classification & B2CL Threshold boundary tests (100k post-Aug 2024 vs 250k pre-Aug 2024): Passed.
  - GSTR-1 TCS exclusion formula: Passed.
  - `purchaseTotals` (gross qty x rate, discounts, footer adjustments, GST roll-up): Passed.
  - `salesTotals` (gross qty x rate, discount tiers, state determination, freight/less): Passed.
  - `returnTotals`: Passed.
  - `inventoryStockHelper`: Passed.
  - `startupChecks` & `provisioningPack`: Passed.

---

## 9. Final Git Diff Summary

```
 backend/models/Item.js                            |   5 +
 backend/models/Party.js                           |   5 +
 backend/models/Purchase.js                        |   2 +
 backend/models/Sales.js                           |   1 +
 backend/services/itemService.js                   |   5 +
 backend/services/partyService.js                  |   3 +-
 frontend/src/pages/masters/AccountMasterModal.jsx |  23 ++
 frontend/src/pages/masters/ItemMasterModal.jsx    |  38 ++
 frontend/src/pages/purchase/PurchaseModal.jsx     | 334 +++++++++++++----
 frontend/src/pages/sales/SalesModal.jsx           | 421 +++++++++++++++++-----
 10 files changed, 674 insertions(+), 163 deletions(-)
```

---

## 10. Comprehensive Regression Test Plan for End of All Phases

When all planned phases are completed, execute the following end-to-end regression plan:

1. **Sales Workflow Verification:**
   - Open Sales modal (`SalesModal.jsx`).
   - Verify Customer dropdown renders customer balances (`₹X Dr`).
   - Verify Item dropdown renders live available stock and lot counts.
   - Pick an item with existing inventory lots; verify `lotId` and `lotNo` populate without altering rate or quantity.
   - Toggle optional columns via `⚙ Columns` (hide Fold/Cut, show Dis1/Dis2/AddAmt); refresh page to verify `localStorage` persistence.
   - Save invoice; verify payload contains line-item `lotId` and `lotNo`.
   - Reopen saved invoice; confirm all line fields reload accurately.
   - Confirm invoice total, taxable amount, CGST, SGST, IGST, and round-off match statutory formulas.

2. **Purchase Workflow Verification:**
   - Open Purchase modal (`PurchaseModal.jsx`).
   - Verify Vendor dropdown renders supplier balances (`₹X Cr`).
   - Enter line items with `DIS2%`, `DISAMT.`, `Lot No`, and `Weaver`.
   - Verify `purchaseTotals.js` calculations correctly apply primary and secondary discounts.
   - Toggle purchase columns via `⚙ Columns`; verify visibility toggling and persistence.
   - Save purchase bill; verify payload preserves `dis2Per`, `dis2Amt`, `lotNo`, and `weaverName`.
   - Reopen saved purchase; confirm all line fields and header fields reload intact.

3. **Master Selector Performance:**
   - Monitor Chrome DevTools Network tab when typing in Party and Item comboboxes.
   - Verify zero additional HTTP requests occur during dropdown filtering.

4. **Automated Suite Execution:**
   - Run backend unit tests: `npm test` or `node --test backend/tests/unit/*.test.js`.
   - Run backend integration tests with MongoDB memory server: `npm --prefix backend run test:integration` (if configured).
   - Run frontend test runner: `npm --prefix frontend test`.
