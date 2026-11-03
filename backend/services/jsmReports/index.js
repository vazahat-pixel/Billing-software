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
