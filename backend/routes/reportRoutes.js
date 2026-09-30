const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const { guard } = require('../utils/featureGuard');

router.use(guard('reports'));

router.get('/bundle', reportController.getReportBundle);
router.get('/sales', reportController.getSalesRegister);
router.get('/purchases', reportController.getPurchaseRegister);
router.get('/stock', reportController.getStockReport);
router.get('/outstanding', reportController.getOutstanding);
router.get('/outstanding/filter-options', reportController.getOutstandingFilterOptions);
router.get('/pl', reportController.getProfitLoss);
router.get('/jobwork', reportController.getJobWorkReport);
router.get('/stock-ledger', reportController.getStockLedger);
router.get('/daily', reportController.getDailyTransactions);
router.get('/masters', reportController.getMasterSummary);
router.get('/ledger-interest', reportController.getLedgerInterest);
router.get('/confirmation', reportController.getConfirmation);
router.get('/above-below', reportController.getAboveBelow);
router.get('/diff-opening', reportController.getDiffOpening);
router.get('/diff-ledger', reportController.getDiffYear);
router.post('/import-bank', reportController.postImportBank);

module.exports = router;
