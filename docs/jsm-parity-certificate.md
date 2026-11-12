# JSM Parity Certificate

**Date:** 2026-11-12
**Reference system:** JSM, SQL Server instance `.\JSMR2`, database `JsmSql2_DEMO2026`, company
SANCHAL CREATION (`SC27`) — the owner's own installation, read-only.
**Method of proof:** for each verified report, JSM's own SQL / views were recovered from the decompiled
screens (`backend/scripts/golden-master/jsm-blueprint/.spec-local/<Form>.json`), executed read-only
against `SC27` in `JsmSql2_DEMO2026`, and replayed against our report engines (`backend/tests/golden/*.test.js`).

---

## 1. Honest Summary — What This Certificate Does and Does Not Claim

This certificate separates **live JSM SQL-verified parity (`VERIFIED`)** from **built & unit/DB-tested
(`BUILT`)** and **legacy MERN shortcuts retained intact (`NOT BUILT (legacy shortcut)`)**.
All **218** JSM menu leaves are now **open (`0 soon`)**, and complete per-entry status is in
[jsm-parity-checklist.txt](file:///c:/Users/admin/Desktop/Billing-software/docs/jsm-parity-checklist.txt).

| Status | Entries | Meaning |
|---|---:|---|
| **VERIFIED** | 72 | Replayed against JSM's live `SC27` SQL / export fixtures in `backend/tests/golden/*.test.js` |
| **BUILT** | 113 | JSM-spec form + backend (`jsmReport`) implemented and unit/DB tested, not yet individually golden-replayed against SC27 SQL |
| **NOT BUILT (legacy shortcut)** | 33 | Opens existing MERN screen/workbook generator (`reportKind` / `action`), including GSTR-1 v1.7/v1.9/v2.0/v3.2.2, E-Way Bulk, TDS/TCS, and Inventory Stock hubs |
| **Menu Open / Soon Split** | **218** | **218 open** (`185 jsmReport` + `33` legacy shortcuts) · **0 soon** |

> [!IMPORTANT]
> Only the **72 VERIFIED** entries are certified as **live-SQL matched** against JSM `SC27`. The
> **113 BUILT** entries (plus the **33** preserved MERN legacy/workbook shortcuts, including GSTR-1
> v1.7/v1.9/v2.0/v3.2.2 exports) are unit/integration tested with zero failures, not individually
> golden-replayed across every filter permutation or against empty `SC27` tables. Zero fabricated
> 100% claims are made here.

---

## 2. Live Golden-Verified Reports (`VERIFIED` — 72 entries, 188 golden assertions)

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

## 3. Built & Tested Native JSM Screens (`BUILT` — 113 entries, Batches 1–6)

All previously deferred / `soon: true` screens and 12 legacy GST shortcuts were built as native `jsmReport` screens across Batches 1–6 (commits `d481a4a`, `93f5b03`, `40bfa39`, `134a7ab`) with decompiled-spec controls, captured/pinned fallback layouts, backend engines, replication scope entries (`brokeragevouchers`, `investmententries`, `reminders`), and unit/integration tests:

- **Old Reports (Batch 4):** `Gstr_3B_TextNew_Monthly_Cess`, `Gstr_3BB_Zoomin_Rpt`, `Rpt_Stock_Share`, `Rpt_StockSizeWise`, `Rpt_Stk_Grey_At_Shop_DateWise`, `Rpt_Jsm_SalesPurchaseVat`, `ZOld_Rpt_Os_Sales`, `Rpt_Account_List_Print_Old`, `Tran_BankDetail`, `Frm_TabReport` (`CB Bal` & `Balance`). *(Note: `Cess`, `Zoom`, `Book Printing`, `Debitors.,`, and `List Printing OLD` are already promoted to `VERIFIED` above.)*
- **Process / Missing / Diagnostics (Batch 5A):** `Zoom_SelectDate_List` (`UnAdjust Setup`), `Rpt_BrokregReport` (`Brokreg Os`), `Frm_BillAgistPaidDetail` (`BillAgainst PaidDetail`), `Rpt_Match8A_Report` (`Gstr-8 Match`), `Stp_DataBaseFromTo` (`DataBase Repair` — read-only diagnostics).
- **Tools / Utilities / Write Actions (Batch 5B):** `GstFilingFreezeData` (`3B - Freeze DataEntry`), `Rpt_Update_Lot_Status` (`Update Lot Status`), `Rpt_Jsm_Os_Update` (`Update O/s. Bill`), `Eway_No_Upload_Offline` (`Brif Cash` / E-Way offline), `Frm_Import_SalesJsm` (`Import Sales`), `FrmReminder_All_Details` (`Reminder` backed by `Reminder`), `Tran_TradingBrokregEntry` & `Broker_commision_check` (`SalesBrokreg Entry` / `Brokreg Entry` backed by `BrokerageVoucher`), `Frm_Investment_Raju` (`Inv Report` backed by `InvestmentEntry`).
- **Native GST Forms Replacing Legacy Shortcuts (Batch 6):** `A_Gstr2_ProcessSummary`, `A_Gstr2_JobWorkReceiptSummary`, `Rpt_Journal_Details_Report`, `A_Gstr2_Expense`, `Stp_Gst_OutWrad_ErrorCheck`, `A_Brokreg_Main_Rpt_Zoom_Column` (`ITC 04 (V 2.10)`). *(`A_Gstr1_SalesInvoiceSummary`, `A_Gstr2_PurchaseSummary`, `Hsn_Wise_Report_All`, `Gstr_3B_TextNew_Monthly`, `Gstr_3BB_TextNew_Excel_Monthly`, `A_All_Ewb_Einv_Rpt` are promoted to `VERIFIED` above.)*
- **Earlier Batches (1–3):** Orders, Slips, Lot Costing, Cutting, Age Analysis, Bank Reconciliation/OD Interest/Voucher Print, Brokerage Statements, Pump Profit, Stock Value, Yarn Kgs Stock, Accounting Ledger/TB/P&L/BS/Voucher Book, and 7 GST Matching upload screens.

---

## 4. Documented Limitations, SC27 Coverage Notes & Refused Heads

Per Hard Rule 5 (no guessing), gaps where data or JSM logic cannot be inferred are explicitly documented or refused with `400`:

### A. Partial-Sheet Refusals on GSTR-9 / 9C
- **`Rpt_Jsm_GSTR9_Excel` (`Gstr-9 Old` / `GSTR_9.xlsx`)**: 21 register/HSN/rate/note sheets built + `GSTR_9.xlsx` export; **4 sheets refused (`400`)**: `RCM MONTH WISE`, `ITC ALL`, `RCM.NONGST`, `ITC.NONGST` (MERN has no reverse-charge register or `T_JV_GST` ITC head split; `SC27` `T_JV_GST` holds 6 rows).
- **`xOld_Rpt_Jsm_GSTR9_All_Excel_Report` (`Gstr-9C Old` / `GSTR_9C.xlsx`)**: 9 register/HSN/rate/note sheets built + sparse `GSTR_9C.xlsx` export (`A, B, D, F, H, J, K`); **6 sheets refused (`400`)**: `REVERCE CHARGE`, `ITC - INPUT`, `ITC - SERVICE`, `ITC - CAP.GOODS`, `TAX PAID`, `INWARD SUPPLY`.
- **`Rpt_Jsm_GSTR9_New` (`Gstr-9 & 9C` / `GSTR_9New.xlsx`)**: 8 register/HSN/rate tabs built; **2 tabs refused (`400`)**: `Rcm`, `Itc`.

### B. Empty Tables / Minimal Specs Observed in `SC27` (`JsmSql2_DEMO2026`)
- **`T_CASH_MN` (`COMMI_AMT <> 0`) = 0 rows**, **`T_COMMI_MN` = 0 rows**, **`I_INVESTMENT` = 0 rows**, **`T_PU_RETU` = 0 rows**: Reports reading these entities (`Rpt_BrokregReport`, `Frm_Investment_Raju`, `PurchaseReturn`) are unit-tested on synthetic fixtures; live `SC27` contains 0 sample rows for them.
- **`Rpt_Match8A_Report`** & **`Frm_BillAgistPaidDetail`**: Decompiled `.spec-local` files have 0 method SQL strings (`forms.json` controls + JSM table conventions used instead; cannot be SQL-replayed without JSM SQL body).

### C. Preserved Legacy Workbook / Hub Shortcuts (`NOT BUILT` in `jsmReport` — 33 entries)
- Preserved intentionally per Hard Rule 1 (`gstExport.js` V3.2.2, `gstr1TemplateExport.js` V1.7/V1.9/V2.0, `ewayBulk`, `gst45`, TDS/TCS, and existing inventory stock views).

### D. Behavioral Parity Notes
- *Brokreg Statement Sales:* JSM rounds commission **per bill row** (`round(BASE_AMT * rate / 100)`), matched verbatim by our engine.
- *E-Way / E-Invoice (`ALL_EWB_EINV_REPORT_MAIN`):* JSM's SQL view unions `ENT_TYPE` (`29` total rows in `SC27`, including `26` `T_SALES` bills); `A_All_Ewb_Einv_Rpt` matches the Sales slice.

---

## 5. Verification Commands & Observed Results (2026-11-12)

```powershell
# Golden parity suite (live SC27 fixtures)
cd backend; $files = @(Get-ChildItem tests/golden/*.test.js) | ForEach-Object { $_.FullName }; node --test $files
# -> 188 tests, 24 suites, 188 pass, 0 fail

# Full backend golden + unit + integration JSM suite
cd backend; $files = @((Get-ChildItem tests/golden/*.test.js),(Get-ChildItem tests/unit/*.js),(Get-ChildItem tests/integration/jsm*.test.js)) | ForEach-Object { $_.FullName }; node --test $files
# -> 486 tests, 86 suites, 485 pass, 0 fail, 1 skipped

# Frontend menu, layout coverage, config & real Excel template tests
cd frontend; $files = @((Get-ChildItem src/jsm/reports/*.node.test.js),(Get-ChildItem src/utils/*.node.test.js)) | ForEach-Object { $_.FullName }; node --test $files
# -> 55 tests, 55 pass, 0 fail

# Menu open/soon count from repo root
# -> open 218 soon 0 (185 jsmReport + 33 legacy/portal shortcuts)
```
