'use strict';

/**
 * JSM's Sales Summary and Purchase Summary screens — the ones on the main menu path:
 *   Reports › Sales › Sales Bill › Sales Summary          Rpt_SalesRegisterSummary_Report
 *   Reports › Purchase › Purchase Bill › Purchase Summary Rpt_PurchaseRegisterSummary_Report
 *
 * They read the same bills the Category Wise registers do; nothing is loaded or recomputed here.
 */
const { registerSummaryReport } = require('../registerSummaryReport');
const src = require('../sources/billRegister');

const options = (load) => async (companyId, p = {}, deps = {}) => {
  const rows = deps.rows || await load(companyId);
  const u = (f) => [...new Set(rows.map((r) => r[f]).filter((v) => String(v ?? '').trim()))]
    .sort((a, b) => String(a).localeCompare(String(b)));
  return { parties: u('PARTY'), brokers: u('BROKER'), books: u('REGISTER'), stations: u('STATION') };
};

const sales = registerSummaryReport({
  load: src.loadSalesRegisterRows,
  views: {
    summary: 'JSM_VW_REGISTER_SALES_SUMMARY_SUMMARYREPORT',
    bills: 'JSM_VW_REGISTER_SALES_SUMMARY_REPORT',
  },
  noun: 'Sales',
  options: options(src.loadSalesRegisterRows),
});

const purchase = registerSummaryReport({
  load: src.loadPurchaseRegisterRows,
  views: {
    summary: 'JSM_VW_REGISTER_SALES_SUMMARY_SUMMARYREPORT',
    bills: 'JSM_VW_REGISTER_PURCHASE_SUMMARY_REPORT',
  },
  noun: 'Purchase',
  options: options(src.loadPurchaseRegisterRows),
});

module.exports = { sales, purchase };

// --- the matching "ItemDetail" screens -------------------------------------------------------
const { registerDetailReport } = require('../registerDetailReport');

const salesDetail = registerDetailReport({
  load: src.loadSalesRegisterRows,
  views: { summary: 'JSM_VW_SALES_DETAIL_SUM_REPORT', bills: 'JSM_VW_REGISTER_SALES_DETAIL_REPORT' },
  noun: 'Sales',
  options: options(src.loadSalesRegisterRows),
});

const purchaseDetail = registerDetailReport({
  load: src.loadPurchaseRegisterRows,
  views: { summary: 'JSM_VW_SALES_DETAIL_SUM_REPORT', bills: 'JSM_VW_REGISTER_SALES_DETAIL_REPORT' },
  noun: 'Purchase',
  options: options(src.loadPurchaseRegisterRows),
});

module.exports.salesDetail = salesDetail;
module.exports.purchaseDetail = purchaseDetail;

// --- the Return registers, same two shapes over the return bills -----------------------------
const salesReturnSummary = registerSummaryReport({
  load: (companyId) => src.loadReturnRegisterRows(companyId, 'Sales'),
  views: {
    summary: 'JSM_VW_REGISTER_SALES_SUMMARY_SUMMARYREPORT',
    bills: 'JSM_VW_REGISTER_SALES_RTN_SUMMARY_REPORT',
  },
  noun: 'Sales Return',
  options: options((companyId) => src.loadReturnRegisterRows(companyId, 'Sales')),
});

const purchaseReturnSummary = registerSummaryReport({
  load: (companyId) => src.loadReturnRegisterRows(companyId, 'Purchase'),
  views: {
    summary: 'JSM_VW_REGISTER_SALES_SUMMARY_SUMMARYREPORT',
    bills: 'JSM_VW_REGISTER_PURCHASE_RTN_SUMMARY_REPORT',
  },
  noun: 'Purchase Return',
  options: options((companyId) => src.loadReturnRegisterRows(companyId, 'Purchase')),
});

const salesReturnDetail = registerDetailReport({
  load: (companyId) => src.loadReturnRegisterRows(companyId, 'Sales'),
  views: { summary: 'JSM_VW_SALES_DETAIL_SUM_REPORT', bills: 'JSM_VW_REGISTER_SALES_DETAIL_REPORT' },
  noun: 'Sales Return',
  options: options((companyId) => src.loadReturnRegisterRows(companyId, 'Sales')),
});

const purchaseReturnDetail = registerDetailReport({
  load: (companyId) => src.loadReturnRegisterRows(companyId, 'Purchase'),
  views: { summary: 'JSM_VW_SALES_DETAIL_SUM_REPORT', bills: 'JSM_VW_REGISTER_SALES_DETAIL_REPORT' },
  noun: 'Purchase Return',
  options: options((companyId) => src.loadReturnRegisterRows(companyId, 'Purchase')),
});

module.exports.salesReturnSummary = salesReturnSummary;
module.exports.purchaseReturnSummary = purchaseReturnSummary;
module.exports.salesReturnDetail = salesReturnDetail;
module.exports.purchaseReturnDetail = purchaseReturnDetail;
