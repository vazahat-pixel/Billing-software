const express = require('express');
const router = express.Router();
const accountingController = require('../controllers/accountingController');

// Ledger Routes
router.post('/ledgers', accountingController.createLedger);
router.get('/ledgers', accountingController.listLedgers);
router.get('/ledgers/:id/statement', accountingController.getLedgerStatement);

// Payment & Receipt Voucher Routes
router.post('/payments', accountingController.createPaymentVoucher);
router.post('/receipts', accountingController.createReceiptVoucher);
router.get('/payments', accountingController.listVouchers);

// Financial Reports
router.get('/trial-balance', accountingController.getTrialBalance);
router.get('/profit-loss', accountingController.getProfitLoss);
router.get('/balance-sheet', accountingController.getBalanceSheet);
router.get('/outstanding', accountingController.getOutstandingReport);

// Manual Journal Entries
router.post('/journal', accountingController.createJournalEntry);

module.exports = router;
