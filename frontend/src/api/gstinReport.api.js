import { get, unwrap } from './http';

/**
 * GSTIN Reports API — all GSTIN-wise report endpoints.
 * Every endpoint hits the backend service which queries real transactions.
 */
export const gstinReportApi = {
  // ─── GSTIN Sales ───
  salesSummary: (params) => unwrap(get('/gstin-reports/sales/summary', params)),
  salesDetail: (params) => unwrap(get('/gstin-reports/sales/detail', params)),
  salesReturnSummary: (params) => unwrap(get('/gstin-reports/sales/return-summary', params)),
  salesReturnDetail: (params) => unwrap(get('/gstin-reports/sales/return-detail', params)),

  // ─── GSTIN Purchase ───
  purchaseSummary: (params) => unwrap(get('/gstin-reports/purchase/summary', params)),
  purchaseDetail: (params) => unwrap(get('/gstin-reports/purchase/detail', params)),
  purchaseReturnSummary: (params) => unwrap(get('/gstin-reports/purchase/return-summary', params)),
  purchaseReturnDetail: (params) => unwrap(get('/gstin-reports/purchase/return-detail', params)),

  // ─── GSTIN Process / JobWork / Journal / Expense ───
  process: (params) => unwrap(get('/gstin-reports/process', params)),
  jobwork: (params) => unwrap(get('/gstin-reports/jobwork', params)),
  journal: (params) => unwrap(get('/gstin-reports/journal', params)),
  expense: (params) => unwrap(get('/gstin-reports/expense', params)),

  // ─── Error Checking ───
  gstr1Errors: (params) => unwrap(get('/gstin-reports/gstr1-errors', params)),
  gstr3bErrors: (params) => unwrap(get('/gstin-reports/gstr3b-errors', params)),

  // ─── GSTR-3B Drill-Down ───
  gstr3bDrillDown: (params) => unwrap(get('/gstin-reports/gstr3b-drilldown', params)),

  // ─── ITC-04 ───
  itc04: (params) => unwrap(get('/gstin-reports/itc04', params)),

  // ─── Cross-Report Reconciliation ───
  crossReconciliation: (params) => unwrap(get('/gstin-reports/cross-reconciliation', params)),
};

export default gstinReportApi;
