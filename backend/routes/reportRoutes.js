const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');

router.get('/stock', reportController.getStockReport);
router.get('/outstanding', reportController.getOutstanding);
router.get('/pl', reportController.getProfitLoss);

module.exports = router;
