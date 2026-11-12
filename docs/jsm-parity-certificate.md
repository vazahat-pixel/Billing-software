# JSM Parity Certificate

**Date:** 2026-11-12
**Reference system:** JSM, SQL Server instance `.\JSMR2`, database `JsmSql2_DEMO2026`, company
SANCHAL CREATION (`SC27`) — the owner's own installation, read-only.
**Method of proof:** for each verified report, JSM's own SQL / views were recovered from the decompiled
screens (`backend/scripts/golden-master/jsm-blueprint/.spec-local/<Form>.json`), executed read-only
against `SC27` in `JsmSql2_DEMO2026`, and replayed against our report engines (`backend/tests/golden/*.test.js`).

---

## 1. Honest Summary — What This Certificate Does and Does Not Claim

This certificate separates **live JSM SQL-verified parity (`VERIFIED`)** from **built & unit-tested
(`BUILT`)** and **not built as a JSM-identical clone (`NOT BUILT`)**. Complete per-entry status for all
**218** JSM menu leaves is in [jsm-parity-checklist.txt](file:///c:/Users/admin/Desktop/Billing-software/docs/jsm-parity-checklist.txt).

| Status | Entries | Meaning |
|---|---:|---|
| **VERIFIED** | 59 | Replayed against JSM's live `SC27` SQL / export fixtures in `backend/tests/golden/*.test.js` |
| **BUILT** | 87 | JSM-spec form + backend implemented and unit/DB tested, not yet individually replayed row-for-row against JSM SQL |
| **NOT BUILT (as JSM clone)** | 72 | **46** open existing MERN legacy/hub screens (`reportKind` / `nav` / `action`) + **26** `soon: true` unbuilt/skipped/withheld entries |
| **Menu Open / Soon Split** | **218** | **192 open** (`146 jsmReport` + `46` legacy shortcuts) · **26 soon** |

> [!IMPORTANT]
> Only the **59 VERIFIED** entries are certified as **live-SQL matched** against JSM `SC27`. The
> **87 BUILT** entries (and **46** legacy-routed entries, including GSTR-1 v1.7/v1.9/v2.0/v3.2.2
> template exports) are unit/integration tested cleanly, not individually golden-replayed across every
> filter permutation yet. Zero fake 100% claims are made here.

---

## 2. Live Golden-Verified Reports (`VERIFIED` — 59 entries, 185 golden assertions)

**Command:** `cd backend && node --test tests/golden/*.test.js` → **185 pass, 0 fail** (23 suites).

| Report family | Verified entries | Golden proof source |
|---|---:|---|
| Sales / Purchase / Sales Return / Purchase Return Registers (+ Monthly + Old Sales) | 14 | `jsmBillRegisters.golden.test.js`, `jsmRegisterSummary.golden.test.js` *(note: SC27 has 0 Purchase Return bills)* |
| Item Wise Summary (Sales & Purchase) | 2 | `jsmItemWiseSummary.golden.test.js` |
| Process / JobWork Send, Receipt Summary & Detail (+ Monthly Process/JobWork) | 8 | `jsmDetailReports.golden.test.js`, `jsmProcessSend.golden.test.js` |
| Process Stock | 2 | `jsmProcessStock.test.js` |
| Outstanding Normal (Debitors, Creditors) | 2 | `jsmOutstanding.golden.test.js` |
| Outstanding Zoom (Debitors, Creditors, Debitors Age, Debitors Excel Age, Os New Format Testing) | 5 | `sessionParity.golden.test.js` *(SC27 SQL `JSM_VW_OS_*`)* |
| Outstanding Extras (90 Days, Sms Days Wise, Month O/s Sales & Purchase) | 4 | `sessionParity.golden.test.js` *(SC27 SQL `JSM_VW_OS_*`)* |
| Interest Bill Wise New (Sales) | 1 | `sessionParity.golden.test.js` *(SC27 `OS_SALES`)* |
| Cash/Bank Register & Cheq In Hand | 2 | `sessionParity.golden.test.js` *(SC27 `JSM_VW_CASHBANK`)* |
| Purchase Stock (LRWise / Godown / Old) & Finish Stock Excel | 4 | `sessionParity.golden.test.js` *(SC27 `JSM_VW_STOCK_PURCHASE_DETAIL`, `FinishStock`)* |
| Sales Order Register | 1 | `sessionParity.golden.test.js` *(SC27 `ORD_NO` open qty)* |
| Brokerage (Sales Bill Date Wise, JobWork) | 2 | `sessionParity.golden.test.js` *(per-bill 2% rounding + SC27)* |
| Master List Print (Envelope & Label Printing) | 2 | `sessionParity.golden.test.js` *(SC27 `JSM_VW_MASTER_ACCOUNT_REPORT` 234 rows)* |
| GSTIN Sales Detail (Item), 3B Inward/Outward Supply (3 screens), Extra GSTR-1/2/3 (3 screens) | 7 | `sessionParity.golden.test.js` *(SC27 `T_SALES` + `T_SL_ITEM` + `Purchase` totals to the paisa)* |
| GSTR-9 Old, GSTR-9C Old, GSTR-9 & 9C New | 3 | `sessionParity.golden.test.js` *(SC27 register-backed rate & HSN sheets; template headers also verified in `gstr9TemplateExport.node.test.js`)* |

*(Note: Total above sums across shared forms = 59 checklist lines when deduplicated against `jsmGstr1.golden.test.js` which verifies MERN's `gstExport` B2B/B2CS/HSN/DOCS numbers on SC27 across the legacy GSTR-1 menu entries.)*

---

## 3. Built & Tested in Batches 1–3 (`BUILT` — 87 entries)

These JSM-identical screens (`jsmReport`) have captured layouts/fallback columns, decompiled-spec
parameters, backend report engines, and unit/DB integration tests passing with zero failures:

- **Financial / Final / Stock / Order / Slip / Costing / Cutting / Brokerage / GST Matching:**
  - Order & Slip: `Rpt_Purchase_Order_Detail_Rpt`, `Rpt_Sales_Slip_Register`, `Rpt_SalesSlipDetail_Report`
  - Lot Costing & Cutting: `Rpt_Lot_Costing`, `Rpt_Cutting_Report`, `Rpt_Stk_Cutting_At_Shop`
  - Outstanding Age & Interest Extra: `Rpt_Outstating_Report` (Process/JobWork), `Rpt_Jsm_Os_*_AgeAnalysis`, `Rpt_Sales_Interest`, `New_Rpt_Sales_Intrest_ZoomIn_New` (Purchase), `New_Rpt_Sales_Intrest_ZoomIn` (Process)
  - Bank Extras (read-only): `Rpt_CB1_Reconsilation` (`Reconciliation` / `Recon.Test`), `A_CashBankLedgerSingleSide` (`Bank OD Intrest`), `A_Bank_Receipt_Bill_Os_Details` (`Bank Voucher Print`)
  - Brokerage & Profit/Stock Value/Yarn: `A_Jsm_Brokreg_Statement_Report` (`Sales/Purchase/JobWork`), `A_BrokregStatment` (remaining variants), `Rpt_Sales_Pump_Profit`, `A_StockValueReport`, `A_ReportYarnStock`
  - Accounting & Registers (prior batches): Ledger (`Single`/`Double`/Confirmation), Trial Balance, Profit & Loss, Balance Sheet, Bank/Cash Book, Above/Below Rs., Voucher Book, Group List, Sales/Purchase Returns & GSTIN return/summary views
  - **GST Matching (7 screens — upload-based portal JSON/Excel matching against books):** `Rpt_Match2B_Report_Tejas`, `Rpt_Match2A`, `Rpt_Jsm_Gstr1_Match`, `Rpt_Match4A_Report_New`, `Rpt_Match2B_Report`, `Rpt_Jsm_GSTR1_Json_Match`, `Rpt_Match2B_x1_ReportNew`

---

## 4. Documented Limitations, Refused Heads & Unbuilt (`soon`) Screens

Per Hard Rule 5 (no guessing), every gap where MERN does not record JSM's source column/table is
refused cleanly instead of fabricated:

### A. Partial-Sheet Refusals on GSTR-9 / 9C
- **`Rpt_Jsm_GSTR9_Excel` (`Gstr-9 Old` / `GSTR_9.xlsx`)**: 21 register/HSN/rate/note sheets built + exact `GSTR_9.xlsx` workbook export; **4 sheets refused (`400`)**: `RCM MONTH WISE`, `ITC ALL`, `RCM.NONGST`, `ITC.NONGST` (MERN has no reverse-charge register or `T_JV_GST` ITC head split).
- **`xOld_Rpt_Jsm_GSTR9_All_Excel_Report` (`Gstr-9C Old` / `GSTR_9C.xlsx`)**: 9 register/HSN/rate/note sheets built + exact `GSTR_9C.xlsx` sparse-column workbook export (`A, B, D, F, H, J, K`); **6 sheets refused (`400`)**: `REVERCE CHARGE`, `ITC - INPUT`, `ITC - SERVICE`, `ITC - CAP.GOODS`, `TAX PAID`, `INWARD SUPPLY`.
- **`Rpt_Jsm_GSTR9_New` (`Gstr-9 & 9C` / `GSTR_9New.xlsx`)**: 8 register/HSN/rate tabs built; **2 tabs refused (`400`)**: `Rcm`, `Itc`.

### B. Skipped Screens (Missing Data or Empty Spec — `soon: true`)
1. **`Rpt_BrokregReport`** (`Others Reports > Brokreg Statment > Brokreg Os (Rec/Pay)`): JSM reads `T_CASH_MN.COMMI_AMT` / `COMMI_PER` / `EXP_VNO` / `BRK_CODE` directly on payment vouchers; MERN `PaymentVoucher` does not record per-voucher brokerage.
2. **`Rpt_Process_Stock_TakaDetail`** (`Reports > Process Reports > TakaWise Stock Detail`): MERN process issue/receipt does not track per-taka issue quantities matching JSM's `T_PR_ISSUE` taka table.
3. **`Rpt_Match8A_Report`** (`Reports > Gst Reports > Gstr Matching > Gstr-8 Match`) & **`Frm_BillAgistPaidDetail`** (`Others Reports > MissingReport(Query) > BillAgainst PaidDetail`): Missing/unusable JSM spec or voucher mapping in `.spec-local`.

### C. Write / Data-Repair Screens Withheld Pending Owner Permission (`soon: true`)
1. `GstFilingFreezeData` (`Reports > Gst Reports > 3B Monthly Return > 3B - Freeze DataEntry`) — period lock write action
2. `Rpt_Update_Lot_Status` (`Reports > Process Reports > Update Lot Status`)
3. `Rpt_Jsm_Os_Update` (`Others Reports > Outstanding > Update O/s. Bill`)
4. `Zoom_SelectDate_List` (`Others Reports > Outstanding > UnAdjust Setup`)
5. `Tran_TradingBrokregEntry` (`Others Reports > Brokreg Statment > SalesBrokreg Entry`)
6. `Stp_DataBaseFromTo` (`Others Reports > Jsm Testingfor > DataBase Repair`)

### D. Deprecated / Misc `Old Reports` Withheld Pending Owner Confirmation (16 entries — `soon: true`)
- `Old Reports > Extra Reports`: `3B Cess`, `3B Zoom`, `Brif Cash`, `Brokreg Entry`, `Reminder`, `CB Bal`, `Import Sales`, `Cash Bank Flow`, `Share Stock`, `Stock(Old) Detail SizeWise` (10)
- `Old Reports` others: `Old FinalReports > Book Printing`, `Old Stock Reports > GreyAtShop-DateWise`, `Rec/Pay Register > Debitors.,`, `List Printing OLD` (4)
- Misc: `Others Reports > Extra RajuBhai > Inv Report`, `Others Reports > Extra Report > Balance` (2)

### E. Smaller Behavioral Notes Observed
- *Brokreg Statement Sales:* JSM rounds commission **per bill row** (`round(BASE_AMT * rate / 100)`), which can differ by a few paise from rounding on the grand total (`13124.02` vs `13124.04` on SC27). Our engine matches JSM's per-row rounding.
- *Cash/Bank Book / Outstanding ties / Trial Balance `tr_code = 8` / Age 5th bucket:* Same documented differences preserved from earlier audit (drawee bank, internal `BILL_NO` tie-breaker, 4 captured Age columns).

---

## 5. Verification Commands & Observed Results (2026-11-12)

```powershell
# Golden parity suite (live SC27 fixtures)
cd backend; node --test tests/golden/*.test.js
# -> 185 tests, 23 suites, 185 pass, 0 fail

# Full backend golden + unit + integration JSM suite
cd backend; $files = (Get-ChildItem tests/golden/*.test.js, tests/unit/*.js, tests/integration/jsm*.test.js | ForEach-Object { $_.FullName }); node --test $files
# -> 469 tests, 85 suites, 468 pass, 0 fail, 1 skipped (purchaseReturn register on SC27 = 0 bills)

# Frontend menu, layout coverage, config & real Excel template tests
cd frontend; $files = (Get-ChildItem src/jsm/reports/*.node.test.js, src/utils/*.node.test.js | ForEach-Object { $_.FullName }); node --test $files
# -> 55 tests, 55 pass, 0 fail (includes GSTR1_V1.7/V1.9/V2.0 & GSTR_9/GSTR_9C template header verification)
```
