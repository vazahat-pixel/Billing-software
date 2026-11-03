'use strict';

/** JSM-identical reports, keyed by the JSM form that defines them. */
const REPORTS = {
  Rpt_Process_Issue_Report: require('./reports/processSend'),
  Rpt_Job_IssueReport: require('./reports/jobSend'),
  Rpt_Process_Receipt_Detail: require('./reports/processReceiptDetail'),
  Rpt_Process_Receipt_Summary: require('./reports/processReceiptSummary'),
  Rpt_JobWork_Receipt_Summary: require('./reports/jobReceiptSummary'),
  Rpt_JobWork_Receipt_Detail: require('./reports/jobReceiptDetail'),
  Rpt_Process_Stock_New_Gst: require('./reports/processStock'),
  Rpt_JobWork_Stock_Report: require('./reports/jobStock'),
  Rpt_Jsm_Sales: require('./reports/billRegisters').sales,
  Rpt_Jsm_Purchase: require('./reports/billRegisters').purchase,
  Rpt_Jsm_Sales_Return: require('./reports/billRegisters').salesReturn,
  Rpt_Jsm_Purchase_Return: require('./reports/billRegisters').purchaseReturn,
  Rpt_Jsm_Os_Sales: require('./reports/outstandingReports').os.sales,
  Rpt_Jsm_Os_Purchase: require('./reports/outstandingReports').os.purchase,
  Rpt_Jsm_Os_Process: require('./reports/outstandingReports').os.process,
  Rpt_Jsm_Os_Jobwork: require('./reports/outstandingReports').os.jobwork,
  Rpt_Jsm_Os_Sales_AgeAnalysis: require('./reports/outstandingReports').osAge.sales,
  Rpt_Jsm_Os_Purchase_AgeAnalysis: require('./reports/outstandingReports').osAge.purchase,
  Rpt_Jsm_Os_Process_AgeAnalysis: require('./reports/outstandingReports').osAge.process,
  Rpt_Jsm_Os_Jobwork_AgeAnalysis: require('./reports/outstandingReports').osAge.jobwork,
  Rpt_Jsm_Sales_ItemSummary: require('./reports/itemWiseSummary').salesItemWise,
  Rpt_Jsm_Purchase_ItemSummary: require('./reports/itemWiseSummary').purchaseItemWise,
  Rpt_Sales_Haste: require('./reports/salesHaste'),
  A_AccountLedgerSingleSide: require('./reports/ledger'),
  A_AccountLedgerDoubleSide: require('./reports/ledger'),
  Rpt_Trail_Bal_101: require('./reports/trialBalance'),
  Rpt_cashbank1: require('./reports/cashBank'),
  A_Final_BalanceSheet: require('./reports/balanceSheet'),
  A_Final_ProfitAndLoss: require('./reports/profitAndLoss'),
};

function get(reportId) {
  const report = REPORTS[reportId];
  if (!report) {
    const err = new Error(`Unknown JSM report: ${reportId}`);
    err.status = 404;
    throw err;
  }
  return report;
}

module.exports = { get, ids: () => Object.keys(REPORTS) };
