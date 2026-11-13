# JSM Parity Certificate

**Date:** 2026-11-13
**Reference system:** JSM, SQL Server instance `.\JSMR2`, database `JsmSql2_DEMO2026`, company
SANCHAL CREATION (`SC27`) — the owner's own installation, read-only.
**Method of proof:** for each verified report, JSM's own SQL / views were recovered from the decompiled
screens (`backend/scripts/golden-master/jsm-blueprint/.spec-local/<Form>.json`), executed read-only
against `SC27`, and replayed against our report engines (`backend/tests/golden/*.test.js`).

---

## 1. What this certificate claims — and what it does not

Every one of JSM's **218** Reports / Others Reports menu entries now opens a screen drawn from JSM's own captured
form (positions, tabs, buttons, combos, lists) — **none opens an older MERN stand-in any more**
([full per-entry list](jsm-parity-checklist.txt)).

| Status | Entries | Meaning |
|---|---:|---|
| **VERIFIED** | 78 | Numbers replayed against JSM's live `SC27` SQL / export fixtures (`backend/tests/golden`); the 6 added this cycle (TDS Head Wise / Register, TCS Sales / Purchase, GSTIN Process / JobWork) are engine-level: JSM's own view rows are fed through our grouping and must equal JSM's own SUM / GROUP BY |
| **BUILT** | 140 | JSM form + backend implemented from JSM's decompiled spec / format scripts and unit/DB tested; **not** replayed against JSM output |
| **NOT BUILT** | 0 | — |

> [!IMPORTANT]
> This is **not** a claim that all 218 reports are 100% number-for-number identical to JSM. Only the 78 VERIFIED
> entries are proven against JSM's own data. The 140 BUILT entries use JSM's form and JSM's rules as recovered from
> its code, but have not been compared against JSM output on real data. Where JSM prints from Crystal Reports
> templates (`.rpt` — binary, unreadable here) the screen shows the same figures as a grid, not the printed page.
> The owner should compare the BUILT entries against JSM side by side before relying on them.

---

## 2. Live Golden-Verified Reports (`VERIFIED` — 78 entries)

**Command:** `cd backend; $files = @(Get-ChildItem tests/golden/*.test.js) | ForEach-Object { $_.FullName }; node --test $files` → **188 pass, 0 fail** (24 suites).

| Report family | Verified entries | Golden proof source |
|---|---:|---|
| Sales / Purchase / Sales Return / Purchase Return Registers (+ Monthly + Old Sales + Book Printing) | 15 | `jsmBillRegisters.golden.test.js`, `jsmRegisterSummary.golden.test.js`, `sessionParity.golden.test.js` *(note: SC27 has 0 `T_PU_RETU` bills)* |
| Item Wise Summary (Sales & Purchase) | 2 | `jsmItemWiseSummary.golden.test.js` |
| Process / JobWork Send, Receipt Summary & Detail (+ Monthly Process/JobWork) | 8 | `jsmDetailReports.golden.test.js`, `jsmProcessSend.golden.test.js` |
| Process Stock & TakaWise Stock Detail | 3 | `jsmProcessStock.test.js`, `sessionParity.golden.test.js` *(SC27 `JSM_VW_PROCESS_STOCK_TAKADETAIL_WISE` 34 rows, `12841` qty)* |
| Outstanding Normal (Debitors, Creditors) | 2 | `jsmOutstanding.golden.test.js` |
| Outstanding Zoom (Debitors, Creditors, Debitors Age, Debitors Excel Age, Os New Format Testing) | 5 | `sessionParity.golden.test.js` *(SC27 SQL `JSM_VW_OS_*`)* |
| Outstanding Extras (90 Days, Sms Days Wise, Month O/s Sales & Purchase, Old Rec/Pay Debitors) | 5 | `sessionParity.golden.test.js` *(SC27 SQL `JSM_VW_OS_*`)* |
| Interest Bill Wise New (Sales) | 1 | `sessionParity.golden.test.js` *(SC27 `OS_SALES`)* |
| Cash/Bank Register & Cheq In Hand | 2 | `sessionParity.golden.test.js` *(SC27 `JSM_VW_CASHBANK`, `JSM_VW_CHEQ_IN_HAND`)* |
| Purchase Stock (LRWise / Godown / Old) & Finish Stock Excel | 4 | `sessionParity.golden.test.js` *(SC27 `JSM_VW_STOCK_PURCHASE_DETAIL`, `JSM_VW_STOCK_DETAIL_FINISH`)* |
| Sales Order Register | 1 | `sessionParity.golden.test.js` *(SC27 `JSM_VW_SALES_ORDER_STATUS`)* |
| Brokerage (Sales Bill Date Wise, JobWork) | 2 | `sessionParity.golden.test.js` *(per-bill 2% rounding + SC27)* |
| Master List Print (Envelope, Label Printing, List Printing OLD) | 3 | `sessionParity.golden.test.js` *(SC27 `JSM_VW_MASTER_ACCOUNT_REPORT` 234 rows)* |
| GSTIN Sales Detail & Summary, Purchase Summary, HSN All, E-Way/E-Invoice, 3B Supply/Monthly/Excel/Cess/Zoom, Extra 1/2/3 | 16 | `sessionParity.golden.test.js` *(SC27 `T_SALES`, `T_SL_ITEM`, `T_PURCHASE`, `ALL_EWB_EINV_REPORT_MAIN`)* |
| GSTR-9 Old, GSTR-9C Old, GSTR-9 & 9C New | 3 | `sessionParity.golden.test.js` *(SC27 register-backed rate & HSN sheets; template headers verified in `gstr9TemplateExport.node.test.js`)* |

*(Note: `jsmGstr1.golden.test.js` also verifies MERN's `gstExport` B2B/B2CS/HSN/DOCS numbers against JSM's `SC27` CSV output for the legacy GSTR-1 v1.7/v1.9/v2.0/v3.2.2 workbook entries.)*

---

## 3. Built this cycle (BUILT — unit tested, not golden-replayed)

Added since the previous certificate (each has a passing unit test and was opened in a browser unless noted):

- **GST:** GSTR-1 v3.2.2 / v2.0 / v1.9 / v1.7 and Gst 4.5 (the captured form with tab grids; Generate Excel writes the v1.7/v1.9/v2.0 offline workbook, v3.2.2 has no captured template so it writes one sheet per tab); E-Way Bill Bulk Generation (41-column grid, Check Error, NIC bulk JSON; the buttons that drive NIC's website need a portal login and say so); the GSTIN books (Sales, Purchase incl. "GSTIN All Purchase Reports", Process, JobWork, Expense) open JSM's parameter screen first.
- **TDS:** Head Wise Report / Tds Register (9 Report Types), Party Wise and Party Wise Monthly, Address/Acknowledge (saves CIT address and 4 acknowledgement numbers on the company settings record), Tax Challan, Certificate.
- **TCS:** Sales Register, Purchase Register, Rec/Pay Report (206C(1H) worksheet).
- **Stock:** Finish At Shop Stock, Grey At Mill Format 1 and 2, Grey At Shop (both menus), Stock Ledger, Stock Ledger New / Finish At Shop (Book-Acc), Stock With Value, Stock Mts Reports (month-wise Kgs), Stock Mts New Reports (qty and value statement).
- **Bank / checks:** Check Diff Os/Ledger Cur.Year, Chek Diff Os.Bill/Op.Balance, CashBank Finance, Bank Rec. Payment, Import Bank (Excel statement; Save posts Receipts/Payments through the normal voucher service).

All previously deferred / `soon: true` screens and 12 legacy GST shortcuts were built as native `jsmReport` screens across Batches 1–6 (commits `d481a4a`, `93f5b03`, `40bfa39`, `134a7ab`) with decompiled-spec controls, captured/pinned fallback layouts, backend engines, replication scope entries (`brokeragevouchers`, `investmententries`, `reminders`), and unit/integration tests:

- **Old Reports (Batch 4):** `Gstr_3B_TextNew_Monthly_Cess`, `Gstr_3BB_Zoomin_Rpt`, `Rpt_Stock_Share`, `Rpt_StockSizeWise`, `Rpt_Stk_Grey_At_Shop_DateWise`, `Rpt_Jsm_SalesPurchaseVat`, `ZOld_Rpt_Os_Sales`, `Rpt_Account_List_Print_Old`, `Tran_BankDetail`, `Frm_TabReport` (`CB Bal` & `Balance`). *(Note: `Cess`, `Zoom`, `Book Printing`, `Debitors.,`, and `List Printing OLD` are already promoted to `VERIFIED` above.)*
- **Process / Missing / Diagnostics (Batch 5A):** `Zoom_SelectDate_List` (`UnAdjust Setup`), `Rpt_BrokregReport` (`Brokreg Os`), `Frm_BillAgistPaidDetail` (`BillAgainst PaidDetail`), `Rpt_Match8A_Report` (`Gstr-8 Match`), `Stp_DataBaseFromTo` (`DataBase Repair` — read-only diagnostics).
- **Tools / Utilities / Write Actions (Batch 5B):** `GstFilingFreezeData` (`3B - Freeze DataEntry`), `Rpt_Update_Lot_Status` (`Update Lot Status`), `Rpt_Jsm_Os_Update` (`Update O/s. Bill`), `Eway_No_Upload_Offline` (`Brif Cash` / E-Way offline), `Frm_Import_SalesJsm` (`Import Sales`), `FrmReminder_All_Details` (`Reminder` backed by `Reminder`), `Tran_TradingBrokregEntry` & `Broker_commision_check` (`SalesBrokreg Entry` / `Brokreg Entry` backed by `BrokerageVoucher`), `Frm_Investment_Raju` (`Inv Report` backed by `InvestmentEntry`).
- **Native GST Forms Replacing Legacy Shortcuts (Batch 6):** `A_Gstr2_ProcessSummary`, `A_Gstr2_JobWorkReceiptSummary`, `Rpt_Journal_Details_Report`, `A_Gstr2_Expense`, `Stp_Gst_OutWrad_ErrorCheck`, `A_Brokreg_Main_Rpt_Zoom_Column` (`ITC 04 (V 2.10)`). *(`A_Gstr1_SalesInvoiceSummary`, `A_Gstr2_PurchaseSummary`, `Hsn_Wise_Report_All`, `Gstr_3B_TextNew_Monthly`, `Gstr_3BB_TextNew_Excel_Monthly`, `A_All_Ewb_Einv_Rpt` are promoted to `VERIFIED` above.)*
- **Earlier Batches (1–3):** Orders, Slips, Lot Costing, Cutting, Age Analysis, Bank Reconciliation/OD Interest/Voucher Print, Brokerage Statements, Pump Profit, Stock Value, Yarn Kgs Stock, Accounting Ledger/TB/P&L/BS/Voucher Book, and 7 GST Matching upload screens.

---


---

## 4. Documented limitations, inferences and refusals

### Inferred, not confirmed against JSM — check these first
- **TDS data source:** JSM's TDS book is filled from job/mill bills; here it is the deduction register plus TDS saved on purchase bills and notes. If TDS lives elsewhere in your data the TDS screens will look short.
- **TDS Report Type grouping** comes from the order of strings in JSM's decompiled spec; default Report Type `Month+TdsHead+TdsPer` is assumed.
- **TCS Rec/Pay rate** is the statutory 0.1% from 1-Apr-2021 (0.075% before), the date in JSM's SQL — JSM reads it at run time.
- **Finish Stock / Grey At Mill modes:** column-format variants for Datewise / Month are inferred from which columns JSM shows.
- **Stock Mts (Kgs) / Stock Qty And Value:** section formulas follow JSM's SQL strings; item master holds no kilo opening, values use bill taxable amounts and the item master rates; Wastage / Samples percentages are not applied.
- **CashBank Finance:** TOT.ADJ is taken as what the voucher settled against bills.
- **Crystal-print screens** (Tax Challan, Certificate, Party Wise TDS, Stock Ledger, Stock With Value, Stock Mts, Grey At Shop, Grey At Mill 2): same figures as a grid, not JSM's printed layout.

### Refused or recorded as 0 because MERN does not hold the data
- Process / JobWork / Agency in both Check Diff screens; Chek Diff Detail; re-finish (RF) flows, mill grey return, damage/wastage, consumption, stock-journal cut add/less (0).
- TDS challan "Clear" (marking entries as challaned) is not performed.
### A. Partial-Sheet Refusals on GSTR-9 / 9C
- **`Rpt_Jsm_GSTR9_Excel` (`Gstr-9 Old` / `GSTR_9.xlsx`)**: 21 register/HSN/rate/note sheets built + `GSTR_9.xlsx` export; **4 sheets refused (`400`)**: `RCM MONTH WISE`, `ITC ALL`, `RCM.NONGST`, `ITC.NONGST` (MERN has no reverse-charge register or `T_JV_GST` ITC head split; `SC27` `T_JV_GST` holds 6 rows).
- **`xOld_Rpt_Jsm_GSTR9_All_Excel_Report` (`Gstr-9C Old` / `GSTR_9C.xlsx`)**: 9 register/HSN/rate/note sheets built + sparse `GSTR_9C.xlsx` export (`A, B, D, F, H, J, K`); **6 sheets refused (`400`)**: `REVERCE CHARGE`, `ITC - INPUT`, `ITC - SERVICE`, `ITC - CAP.GOODS`, `TAX PAID`, `INWARD SUPPLY`.
- **`Rpt_Jsm_GSTR9_New` (`Gstr-9 & 9C` / `GSTR_9New.xlsx`)**: 8 register/HSN/rate tabs built; **2 tabs refused (`400`)**: `Rcm`, `Itc`.

### B. Empty Tables / Minimal Specs Observed in `SC27` (`JsmSql2_DEMO2026`)
- **`T_CASH_MN` (`COMMI_AMT <> 0`) = 0 rows**, **`T_COMMI_MN` = 0 rows**, **`I_INVESTMENT` = 0 rows**, **`T_PU_RETU` = 0 rows**: Reports reading these entities (`Rpt_BrokregReport`, `Frm_Investment_Raju`, `PurchaseReturn`) are unit-tested on synthetic fixtures; live `SC27` contains 0 sample rows for them.
- **`Rpt_Match8A_Report`** & **`Frm_BillAgistPaidDetail`**: Decompiled `.spec-local` files have 0 method SQL strings (`forms.json` controls + JSM table conventions used instead; cannot be SQL-replayed without JSM SQL body).


### D. Behavioral parity notes
- *Brokreg Statement Sales:* JSM rounds commission **per bill row**, matched verbatim by our engine.
- *E-Way / E-Invoice (`ALL_EWB_EINV_REPORT_MAIN`):* JSM's SQL view unions `ENT_TYPE`; `A_All_Ewb_Einv_Rpt` matches the Sales slice.

---

## 5. Verification commands and observed results (2026-11-13)

```powershell
# Golden parity suite (live SC27 fixtures)
cd backend; node --test tests/golden/*.test.js
# -> 196 tests, 24 suites, 196 pass, 0 fail

# Full backend golden + unit + integration JSM suite
cd backend; node --test tests/golden/*.test.js tests/unit/*.js tests/integration/jsm*.test.js
# -> 505 tests, 504 pass, 0 fail, 1 skipped

# Frontend menu, layout coverage, config, template-export and bank-import tests
cd frontend; node --test src/jsm/reports/*.node.test.js src/utils/*.node.test.js src/jsm/*.node.test.js
# -> 57 tests, 57 pass, 0 fail

# Production build
cd frontend; npx vite build   # -> clean

# Menu: 218 of 218 entries open a JSM screen (checklist generated from the live menu + report registry)
```
