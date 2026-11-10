/**
 * Which screen each of JSM's own menu entries opens in this software.
 *
 * Keyed by the JSM form the entry points at (blueprint/menu.json), never by its label — several
 * entries share a label ("Summary", "Detail") and a few share a form, so the form plus, where it
 * matters, the entry's full path is the only unambiguous key.
 *
 * Anything absent from here is a JSM entry this software has no screen for yet: the menu still
 * shows it, in JSM's own place and wording, marked as not available.
 */

/** JSM form -> how this software opens it. */
export const FORM_HANDLERS = {
  // --- JSM-identical report screens (jsm/reports/*) ---------------------------------------
  Rpt_Jsm_Purchase: { id: 'purchase-summary', external: 'jsmReport', jsmForm: 'Rpt_Jsm_Purchase' },
  Rpt_Jsm_Sales_Return: { id: 'sales-return-summary', external: 'jsmReport', jsmForm: 'Rpt_Jsm_Sales_Return' },
  Rpt_Jsm_Purchase_Return: { id: 'purchase-return-summary', external: 'jsmReport', jsmForm: 'Rpt_Jsm_Purchase_Return' },
  Rpt_Jsm_Sales: { id: 'old-sales-summary', external: 'jsmReport', jsmForm: 'Rpt_Jsm_Sales' },
  Rpt_Jsm_Sales_ItemSummary: { id: 'sales-item-wise', external: 'jsmReport', jsmForm: 'Rpt_Jsm_Sales_ItemSummary' },
  Rpt_Jsm_Purchase_ItemSummary: { id: 'purchase-item-wise', external: 'jsmReport', jsmForm: 'Rpt_Jsm_Purchase_ItemSummary' },
  Rpt_Sales_Haste: { id: 'sales-haste', external: 'jsmReport', jsmForm: 'Rpt_Sales_Haste' },
  Rpt_Process_Issue_Report: { id: 'process-send', external: 'jsmReport', jsmForm: 'Rpt_Process_Issue_Report' },
  Rpt_Job_IssueReport: { id: 'jw-send', external: 'jsmReport', jsmForm: 'Rpt_Job_IssueReport' },
  Rpt_Process_Receipt_Detail: { id: 'process-rec-detail', external: 'jsmReport', jsmForm: 'Rpt_Process_Receipt_Detail' },
  Rpt_Process_Receipt_Summary: { id: 'process-rec-summary', external: 'jsmReport', jsmForm: 'Rpt_Process_Receipt_Summary' },
  Rpt_JobWork_Receipt_Detail: { id: 'jw-rec-detail', external: 'jsmReport', jsmForm: 'Rpt_JobWork_Receipt_Detail' },
  Rpt_JobWork_Receipt_Summary: { id: 'jw-rec-summary', external: 'jsmReport', jsmForm: 'Rpt_JobWork_Receipt_Summary' },
  Rpt_Process_Stock_New_Gst: { id: 'process-stock', external: 'jsmReport', jsmForm: 'Rpt_Process_Stock_New_Gst' },
  Rpt_JobWork_Stock_Report: { id: 'jw-stock', external: 'jsmReport', jsmForm: 'Rpt_JobWork_Stock_Report' },
  Rpt_Trail_Bal_101: { id: 'final-tb', external: 'jsmReport', jsmForm: 'Rpt_Trail_Bal_101' },
  A_Final_ProfitAndLoss: { id: 'final-pl', external: 'jsmReport', jsmForm: 'A_Final_ProfitAndLoss' },
  A_Final_BalanceSheet: { id: 'final-bs', external: 'jsmReport', jsmForm: 'A_Final_BalanceSheet' },
  A_AccountLedgerSingleSide: { id: 'fas-ledger', external: 'jsmReport', jsmForm: 'A_AccountLedgerSingleSide' },
  Rpt_cashbank1: { id: 'fas-cashbook', external: 'jsmReport', jsmForm: 'Rpt_cashbank1' },
  Rpt_Jsm_Os_Sales: { id: 'os-debitors', external: 'jsmReport', jsmForm: 'Rpt_Jsm_Os_Sales' },
  Rpt_Jsm_Os_Purchase: { id: 'os-creditors', external: 'jsmReport', jsmForm: 'Rpt_Jsm_Os_Purchase' },
  Rpt_Jsm_Os_Process: { id: 'os-process', external: 'jsmReport', jsmForm: 'Rpt_Jsm_Os_Process' },
  Rpt_Jsm_Os_Jobwork: { id: 'os-jobwork', external: 'jsmReport', jsmForm: 'Rpt_Jsm_Os_Jobwork' },
  Rpt_Jsm_Os_Sales_AgeAnalysis: { id: 'os-debitors-age', external: 'jsmReport', jsmForm: 'Rpt_Jsm_Os_Sales_AgeAnalysis' },
  Rpt_Jsm_Os_Purchase_AgeAnalysis: { id: 'os-creditors-age', external: 'jsmReport', jsmForm: 'Rpt_Jsm_Os_Purchase_AgeAnalysis' },
  Rpt_Jsm_Os_Process_AgeAnalysis: { id: 'os-process-age', external: 'jsmReport', jsmForm: 'Rpt_Jsm_Os_Process_AgeAnalysis' },
  Rpt_Jsm_Os_Jobwork_AgeAnalysis: { id: 'os-jobwork-age', external: 'jsmReport', jsmForm: 'Rpt_Jsm_Os_Jobwork_AgeAnalysis' },

  // --- this software's own screens, on the JSM entry they correspond to -------------------
  // GST: one screen of ours covers a whole JSM folder (its Excel versions, its matching
  // variants), so it is attached to the entry that folder opens on today.
  Gstr_3B_TextNew_Monthly: { id: 'gst-3b', external: 'gstReports', reportKind: 'gst3b' },
  Stp_Gst_OutWrad_ErrorCheck: { id: 'gst-gstr1-err', external: 'gstReports', reportKind: 'gstr1Errors' },
  Rpt_Jsm_GSTR1_3_2_2: { id: 'gst-gstr1', external: 'gstReports', reportKind: 'gstr1' },
  Rpt_Match2B_Report_Tejas: { id: 'gst-matching', external: 'gstReports', reportKind: 'gstrMatching' },
  Rpt_Match2A: { id: 'gst-gstr2', external: 'gstReports', reportKind: 'gstr2' },
  Rpt_Jsm_GSTR9_New: { id: 'gst-gstr9', external: 'gstReports', reportKind: 'gstr9' },
  A_Brokreg_Main_Rpt_Zoom_Column: { id: 'gst-itc04', external: 'gstReports', reportKind: 'itc04' },
  Eway_Billing_Bulk: { id: 'gst-ewb-bulk', external: 'gstReports', reportKind: 'ewayBulk' },
  A_All_Ewb_Einv_Rpt: { id: 'gst-ewb-status', external: 'gstReports', reportKind: 'ewayStatus' },
  Gstr_3BB_TextNew_Excel_Monthly: { id: 'gst-ewb-excel', external: 'gstReports', reportKind: 'ewayExcel' },
  Rpt_Jsm_GSTR1_1x_8_GovAllExcel_Old: { id: 'gst-45', external: 'gstReports', reportKind: 'gst45' },
  A_Gstr1_SalesInvoiceSummary: { id: 'gst-sales', external: 'gstReports', reportKind: 'gstinSales' },
  A_Gstr2_PurchaseSummary: { id: 'gst-purchase', external: 'gstReports', reportKind: 'gstinPurchase' },
  A_Gstr2_ProcessSummary: { id: 'gst-process', external: 'gstReports', reportKind: 'gstinProcess' },
  A_Gstr2_JobWorkReceiptSummary: { id: 'gst-jobwork', external: 'gstReports', reportKind: 'gstinJobwork' },
  Rpt_Journal_Details_Report: { id: 'gst-journal', external: 'gstReports', reportKind: 'gstinJournal' },
  A_Gstr2_Expense: { id: 'gst-expense', external: 'gstReports', reportKind: 'gstinExpense' },
  Hsn_Wise_Report_All: { id: 'gst-hub', external: 'gstReports', reportKind: 'gstr1' },

  // Stock
  Rpt_Stk_Meter_TanusKgs: { id: 'stock-mts', external: 'stockLedger', reportKind: 'stockMts' },
  Rpt_Monthly_Stk_Qty_Value_Report: { id: 'stock-kgs', external: 'stockLedger', reportKind: 'stockKgs' },
  Rpt_Jsm_Stock_Finish_New1: { id: 'stock-finish-shop', external: 'stockLedger', reportKind: 'finishShop' },
  Rpt_Stk_Grey_At_Shop: { id: 'stock-grey-shop', external: 'stockLedger', reportKind: 'greyShop' },
  Rpt_Jsm_Stock_Grey_At_Mill: { id: 'stock-grey-pcs', external: 'stockLedger', reportKind: 'greyShopPcs' },
  Rpt1_Stk_Grey_At_Mill: { id: 'stock-grey-mill', external: 'stockLedger', reportKind: 'greyMill' },
  Rpt_Stk_Acc_Finish_Summary: { id: 'stock-finish-book', external: 'stockLedger', reportKind: 'finishBook' },
  Rpt_Stk_Acc_Finish_Summary_Value: { id: 'stock-value', external: 'stockLedger', reportKind: 'stockValue' },
  Rpt_Stock_Acc_Finish_Summary: { id: 'stock-finish-excel', external: 'stockLedger', reportKind: 'finishExcel' },

  // Tds / Tcs
  Rpt_TdsReports: { id: 'tds-head', reportKey: 'tds', view: 'tdsHead' },
  Rpt_Tds2_Prty_Mnth_Wise: { id: 'tds-party', reportKey: 'tds', view: 'tdsParty' },
  Rpt_Tds3_Add_Ackn: { id: 'tds-address', reportKey: 'tds', view: 'tdsAddress' },
  Rpt_Tds4_Challan: { id: 'tds-challan', reportKey: 'tds', view: 'tdsChallan' },
  Rpt_Tds5_Certi: { id: 'tds-certificate', reportKey: 'tds', view: 'tdsCertificate' },
  Rpt_Tcs: { id: 'tcs-recpay', reportKey: 'tcs', view: 'tcsRecPay' },
  Rpt_TcsReports: { id: 'tcs-sales', reportKey: 'tcs', view: 'tcsSales' },

  // Fas / Final
  A_AccountLedgerDoubleSide: { id: 'fas-ledger-t', external: 'jsmReport', jsmForm: 'A_AccountLedgerDoubleSide_TFormat' },
  Rpt_Above_Below: { id: 'fas-above', external: 'jsmReport', jsmForm: 'Rpt_Above_Below' },
  Rpt_JvBook1: { id: 'fas-voucher', external: 'jsmReport', jsmForm: 'Rpt_JvBook1' },
  Tran_ImportCashBank: { id: 'fas-import-bank', external: 'fasCheck', reportKind: 'importBank' },
  Mst1_Check_Diff: { id: 'final-diff-os', external: 'fasCheck', reportKind: 'diffOpening' },
  Rpt_Cash_Bank_Finance_Report: { id: 'final-cash-fin', external: 'cashBook' },
  Rpt_Jsm_Ledger_os_Diff_Check: { id: 'final-diff-year', external: 'fasCheck', reportKind: 'diffYear' },
  Rpt_Group_Balance: { id: 'final-group', external: 'jsmReport', jsmForm: 'Rpt_Group_Balance' },

  // Sales / Purchase Summary — the screens on the main menu path, which group on two Order By
  // combos rather than a Category Wise.
  Rpt_SalesRegisterSummary_Report: { id: 'sales-summary', external: 'jsmReport', jsmForm: 'Rpt_SalesRegisterSummary_Report' },
  Rpt_PurchaseRegisterSummary_Report: { id: 'purchase-summary-main', external: 'jsmReport', jsmForm: 'Rpt_PurchaseRegisterSummary_Report' },
  Rpt_SalesRegisterDetailDigital_Report: { id: 'sales-itemdetail', external: 'jsmReport', jsmForm: 'Rpt_SalesRegisterDetailDigital_Report' },
  Rpt_PurchaseRegisterDetail_Report: { id: 'purchase-itemdetail', external: 'jsmReport', jsmForm: 'Rpt_PurchaseRegisterDetail_Report' },

  Rpt_SalesRtnRegisterSummary_Report: { id: 'sales-rtn-summary', external: 'jsmReport', jsmForm: 'Rpt_SalesRtnRegisterSummary_Report' },
  OldRpt_SalesRTNRegisterSummary_Report: { id: 'sales-rtn-summary-new', external: 'jsmReport', jsmForm: 'OldRpt_SalesRTNRegisterSummary_Report' },
  Rpt_PurchaseRtnRegisterSummary_Report: { id: 'purchase-rtn-summary', external: 'jsmReport', jsmForm: 'Rpt_PurchaseRtnRegisterSummary_Report' },
  Rpt_SalesRtnRegisterDetail_Report: { id: 'sales-rtn-detail', external: 'jsmReport', jsmForm: 'Rpt_SalesRtnRegisterDetail_Report' },
  OldRpt_SalesRTNRegisterDetail_Report: { id: 'sales-rtn-itemdetail-new', external: 'jsmReport', jsmForm: 'OldRpt_SalesRTNRegisterDetail_Report' },
  Rpt_PurchaseRtnRegisterDetail_Report: { id: 'purchase-rtn-itemdetail', external: 'jsmReport', jsmForm: 'Rpt_PurchaseRtnRegisterDetail_Report' },

  Rpt_Jsm_Process_ItemSummary: { id: 'process-item-wise', external: 'jsmReport', jsmForm: 'Rpt_Jsm_Process_ItemSummary' },

  // Monthly
  Rpt_BankBookRec_GstMonthWise: { id: 'monthly-bank', external: 'cashBook' },
};

/**
 * A few JSM entries share a form with another entry but open a different screen here; those are
 * keyed by the entry's full menu path, which always wins over the form.
 */
export const PATH_HANDLERS = {
  'Reports > Fas Reports > Confirmation':
    { id: 'fas-confirm', external: 'jsmReport', jsmForm: 'A_AccountLedgerDoubleSide_Confirmation' },
  'Reports > Purchase > Purchase Bill > Detail':
    { id: 'purchase-detail', external: 'jsmReport', jsmForm: 'Rpt_Jsm_Purchase_Detail' },
  'Reports > Sales > Sales Return > Detail':
    { id: 'sales-return-detail', external: 'jsmReport', jsmForm: 'Rpt_Jsm_Sales_Return_Detail' },
  'Reports > Purchase > Purchase Return > Detail':
    { id: 'purchase-return-detail', external: 'jsmReport', jsmForm: 'Rpt_Jsm_Purchase_Return_Detail' },
  'Others Reports > Old Reports > Sales > SalesDetail':
    { id: 'old-sales-detail', external: 'jsmReport', jsmForm: 'Rpt_Jsm_Sales_Detail' },
  'Reports > Fas Reports > Bank / Cash Book > Cash Book':
    { id: 'fas-cashbook-cash', external: 'jsmReport', jsmForm: 'Rpt_cashbank1' },
  'Reports > Tds Reports > Party Wise Monthly Report':
    { id: 'tds-monthly', reportKey: 'tds', view: 'tdsMonthly' },
  'Reports > Tds Reports > Tds Register':
    { id: 'tds-reg', reportKey: 'tds', view: 'tdsRegister' },
  'Reports > Tcs Reports > Tcs Purchase Register':
    { id: 'tcs-purchase', reportKey: 'tcs', view: 'tcsPurchase' },
};
