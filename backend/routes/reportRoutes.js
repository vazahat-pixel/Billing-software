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
router.get('/pl', reportController.getProfitLoss);
router.get('/jobwork', reportController.getJobWorkReport);
router.get('/daily', reportController.getDailyTransactions);
router.get('/masters', reportController.getMasterSummary);

module.exports = router;
