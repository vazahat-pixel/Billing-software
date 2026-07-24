const express = require('express');
const router = express.Router();
const accountingController = require('../controllers/accountingController');
const { guard } = require('../utils/featureGuard');
const { requirePermission } = require('../middlewares/permission.middleware');

router.use(guard('accounting'));

const read = requirePermission('accounting', 'read');
const write = requirePermission('accounting', 'create');

// Ledger Routes
router.post('/ledgers', write, accountingController.createLedger);
router.get('/ledgers', read, accountingController.listLedgers);
router.get('/ledgers/:id/statement', read, accountingController.getLedgerStatement);

// Payment & Receipt Voucher Routes
router.post('/payments', write, accountingController.createPaymentVoucher);
router.post('/receipts', write, accountingController.createReceiptVoucher);
router.get('/payments', read, accountingController.listVouchers);
router.post('/payments/:id/reverse', write, accountingController.reverseVoucher);

// Financial Reports
router.get('/trial-balance', read, accountingController.getTrialBalance);
router.get('/profit-loss', read, accountingController.getProfitLoss);
router.get('/balance-sheet', read, accountingController.getBalanceSheet);
router.get('/outstanding', read, accountingController.getOutstandingReport);

// Manual Journal Entries
router.post('/journal', write, accountingController.createJournalEntry);
router.get('/entries', read, accountingController.listEntries);

module.exports = router;
