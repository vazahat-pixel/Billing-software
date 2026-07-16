const express = require('express');
const router = express.Router();
const c = require('../controllers/stage3FinanceController');
const { requirePermission } = require('../middlewares/permission.middleware');
const { objectIdParam } = require('../validators');
const { guard } = require('../utils/featureGuard');

router.use(guard('accounting'));

const read = requirePermission('accounting', 'read');
const write = requirePermission('accounting', 'create');
const update = requirePermission('accounting', 'update');

// 3.1 CoA
router.get('/coa/pipeline', read, c.coaPipeline);
router.post('/coa/seed', write, c.coaSeed);
router.get('/coa/groups', read, c.coaListGroups);
router.post('/coa/groups', write, c.coaCreateGroup);
router.get('/coa/hierarchy', read, c.coaHierarchy);
router.get('/coa/ledgers', read, c.coaListLedgers);
router.post('/coa/ledgers', write, c.coaCreateLedger);
router.patch('/coa/ledgers/:id', update, objectIdParam, c.coaUpdateLedger);
router.delete('/coa/ledgers/:id', update, objectIdParam, c.coaDeleteLedger);

// 3.2 Journals
router.get('/journals', read, c.journalList);
router.post('/journals/contra', write, c.journalContra);
router.post('/journals', write, c.journalPost);
router.get('/journals/:id', read, objectIdParam, c.journalGet);
router.post('/journals/:id/reverse', write, objectIdParam, c.journalReverse);

// 3.3 Ledgers
router.get('/ledgers/balances', read, c.ledgerBalances);
router.get('/ledgers/party/:partyId', read, c.partyLedger);
router.get('/ledgers/:id/statement', read, objectIdParam, c.ledgerStatement);

// 3.4 Cash & Bank
router.get('/cash-book', read, c.cashBook);
router.get('/bank-book', read, c.bankBook);
router.get('/bank-accounts', read, c.bankAccounts);
router.post('/bank-accounts', write, c.createBankAccount);
router.get('/cheques', read, c.chequeRegister);
router.get('/digital-instruments', read, c.digitalRegister);
router.post('/instruments', write, c.registerInstrument);
router.patch('/instruments/:id', update, objectIdParam, c.updateInstrument);
router.post('/bank-charges', write, c.bankCharges);
router.post('/deposit-withdraw', write, c.depositWithdraw);
router.get('/cash-closing', read, c.cashClosing);
router.post('/brs', write, c.startBRS);
router.post('/brs/:id/clear', update, objectIdParam, c.clearBRS);
router.post('/brs/:id/finalize', update, objectIdParam, c.finalizeBRS);

// 3.5 Outstanding
router.get('/outstanding', read, c.outstanding);
router.post('/outstanding/rebuild', write, c.rebuildSettlements);
router.patch('/outstanding/:id/follow-up', update, objectIdParam, c.followUp);
router.post('/outstanding/settle', write, c.settleBill);
router.post('/outstanding/credit-check', read, c.creditCheck);
router.get('/outstanding/reconcile', read, c.outstandingReconcile);

// 3.6 Reports
router.get('/reports/trial-balance', read, c.trialBalance);
router.get('/reports/profit-loss', read, c.profitLoss);
router.get('/reports/balance-sheet', read, c.balanceSheet);
router.get('/reports/cash-flow', read, c.cashFlow);
router.get('/reports/fund-flow', read, c.fundFlow);
router.get('/reports/day-book', read, c.dayBook);
router.get('/reports/journal-register', read, c.journalRegister);
router.get('/reports/voucher-register', read, c.voucherRegister);

// 3.7 Closing
router.post('/closing/lock-month', write, c.lockMonth);
router.post('/closing/unlock-month', write, c.unlockMonth);
router.post('/closing/lock-period', write, c.lockPeriod);
router.post('/closing/validate', read, c.validateClose);
router.post('/closing/close-year', write, c.closeYear);
router.post('/closing/reopen-year', write, c.reopenYear);
router.post('/closing/depreciation', write, c.depreciation);

// 3.8 Audit
router.get('/audit/reconcile', read, c.fullReconcile);
router.get('/audit/journals', read, c.journalAudit);
router.get('/audit/inventory-gl', read, c.inventoryGl);
router.get('/audit/gst-gl', read, c.gstGl);
router.get('/audit/trail', read, c.auditTrail);

// 3.9 Cost centers
router.post('/cost-centers/seed', write, c.ccSeed);
router.get('/cost-centers/report', read, c.ccReport);
router.get('/cost-centers', read, c.ccList);
router.post('/cost-centers', write, c.ccCreate);
router.patch('/cost-centers/:id', update, objectIdParam, c.ccUpdate);
router.delete('/cost-centers/:id', update, objectIdParam, c.ccDelete);
router.get('/costing/textile', read, c.ccTextile);
router.post('/costing/textile', read, c.ccTextile);
router.post('/costing/margin', read, c.ccMargin);
router.post('/costing/allocate-overhead', write, c.ccAllocate);

// 3.10 Certification
router.post('/certification/run', write, c.certRun);
router.get('/certification/latest', read, c.certLatest);
router.get('/certification', read, c.certList);

module.exports = router;
