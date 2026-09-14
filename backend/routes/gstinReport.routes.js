const express = require('express');
const router = express.Router();
const c = require('../controllers/gstinReportController');
const { requirePermission } = require('../middlewares/permission.middleware');

const read = requirePermission('gst', 'read');

// ─── GSTIN Sales ───
router.get('/sales/summary', read, c.gstinSalesSummary);
router.get('/sales/detail', read, c.gstinSalesDetail);
router.get('/sales/return-summary', read, c.gstinSalesReturnSummary);
router.get('/sales/return-detail', read, c.gstinSalesReturnDetail);

// ─── GSTIN Purchase ───
router.get('/purchase/summary', read, c.gstinPurchaseSummary);
router.get('/purchase/detail', read, c.gstinPurchaseDetail);
router.get('/purchase/return-summary', read, c.gstinPurchaseReturnSummary);
router.get('/purchase/return-detail', read, c.gstinPurchaseReturnDetail);

// ─── GSTIN Process / JobWork / Journal / Expense ───
router.get('/process', read, c.gstinProcess);
router.get('/jobwork', read, c.gstinJobWork);
router.get('/journal', read, c.gstinJournal);
router.get('/expense', read, c.gstinExpense);

// ─── Error Checking ───
router.get('/gstr1-errors', read, c.gstr1Errors);
router.get('/gstr3b-errors', read, c.gstr3bErrors);

// ─── GSTR-3B Drill-Down ───
router.get('/gstr3b-drilldown', read, c.gstr3bDrillDown);

// ─── ITC-04 ───
router.get('/itc04', read, c.itc04);

// ─── Cross-Report Reconciliation ───
router.get('/cross-reconciliation', read, c.crossReconciliation);

module.exports = router;
