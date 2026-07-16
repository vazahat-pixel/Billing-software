const asyncHandler = require('../utils/asyncHandler');
const { ok, created } = require('../utils/apiResponse');
const chartOfAccounts = require('../services/chartOfAccountsService');
const journalEngine = require('../services/journalEngineService');
const ledgerEngine = require('../services/ledgerEngineService');
const cashBankEngine = require('../services/cashBankEngineService');
const outstandingEngine = require('../services/outstandingEngineService');
const financialReports = require('../services/financialReportsService');
const financialClosing = require('../services/financialClosingService');
const financialAudit = require('../services/financialAuditService');
const costCenterService = require('../services/costCenterService');
const financialCertification = require('../services/financialCertificationService');

const uid = (req) => req.user?._id || req.user?.id || null;

// ─── 3.1 Chart of Accounts ───────────────────────────────────
exports.coaPipeline = asyncHandler(async (req, res) => {
  return ok(res, await chartOfAccounts.pipeline(req.companyId));
});
exports.coaSeed = asyncHandler(async (req, res) => {
  const groups = await chartOfAccounts.seedDefaultGroups(req.companyId);
  const ledgers = await chartOfAccounts.seedSystemLedgers(req.companyId);
  return ok(res, { groups: Object.keys(groups).length, ledgers: ledgers.length }, 'CoA seeded');
});
exports.coaListGroups = asyncHandler(async (req, res) => {
  return ok(res, await chartOfAccounts.listGroups(req.companyId, req.query));
});
exports.coaCreateGroup = asyncHandler(async (req, res) => {
  return created(res, await chartOfAccounts.createGroup(req.companyId, req.body, uid(req)));
});
exports.coaHierarchy = asyncHandler(async (req, res) => {
  return ok(res, await chartOfAccounts.getHierarchy(req.companyId));
});
exports.coaListLedgers = asyncHandler(async (req, res) => {
  return ok(res, await chartOfAccounts.listLedgers(req.companyId, req.query));
});
exports.coaCreateLedger = asyncHandler(async (req, res) => {
  return created(res, await chartOfAccounts.createLedger(req.companyId, req.body, uid(req)));
});
exports.coaUpdateLedger = asyncHandler(async (req, res) => {
  return ok(res, await chartOfAccounts.updateLedger(req.companyId, req.params.id, req.body, uid(req)));
});
exports.coaDeleteLedger = asyncHandler(async (req, res) => {
  return ok(res, await chartOfAccounts.softDeleteLedger(req.companyId, req.params.id, uid(req)), 'Soft-deleted');
});

// ─── 3.2 Journal Engine ──────────────────────────────────────
exports.journalList = asyncHandler(async (req, res) => {
  return ok(res, await journalEngine.listJournals(req.companyId, req.query));
});
exports.journalGet = asyncHandler(async (req, res) => {
  return ok(res, await journalEngine.getJournal(req.companyId, req.params.id));
});
exports.journalPost = asyncHandler(async (req, res) => {
  return created(res, await journalEngine.postJournal(req.companyId, req.body, { userId: uid(req) }));
});
exports.journalReverse = asyncHandler(async (req, res) => {
  return created(
    res,
    await journalEngine.reverseJournal(req.companyId, req.params.id, {
      userId: uid(req),
      reason: req.body.reason,
    }),
    'Reversed'
  );
});
exports.journalContra = asyncHandler(async (req, res) => {
  return created(res, await journalEngine.postContra(req.companyId, { ...req.body, userId: uid(req) }));
});

// ─── 3.3 Ledger Engine ───────────────────────────────────────
exports.ledgerStatement = asyncHandler(async (req, res) => {
  return ok(res, await ledgerEngine.getStatement(req.companyId, req.params.id, req.query));
});
exports.ledgerBalances = asyncHandler(async (req, res) => {
  return ok(res, await ledgerEngine.computeBalances(req.companyId, {
    asOn: req.query.asOn || req.query.to,
    from: req.query.from,
    includeOpening: req.query.includeOpening !== 'false',
  }));
});
exports.partyLedger = asyncHandler(async (req, res) => {
  return ok(res, await ledgerEngine.partyLedger(req.companyId, req.params.partyId, req.query));
});

// ─── 3.4 Cash & Bank ─────────────────────────────────────────
exports.cashBook = asyncHandler(async (req, res) => {
  return ok(res, await cashBankEngine.cashBook(req.companyId, req.query));
});
exports.bankBook = asyncHandler(async (req, res) => {
  return ok(res, await cashBankEngine.bankBook(req.companyId, req.query));
});
exports.bankAccounts = asyncHandler(async (req, res) => {
  return ok(res, await cashBankEngine.listBankAccounts(req.companyId));
});
exports.createBankAccount = asyncHandler(async (req, res) => {
  return created(res, await cashBankEngine.createBankAccount(req.companyId, req.body, uid(req)));
});
exports.chequeRegister = asyncHandler(async (req, res) => {
  return ok(res, await cashBankEngine.chequeRegister(req.companyId, req.query));
});
exports.digitalRegister = asyncHandler(async (req, res) => {
  return ok(res, await cashBankEngine.digitalRegister(req.companyId, req.query));
});
exports.registerInstrument = asyncHandler(async (req, res) => {
  return created(res, await cashBankEngine.registerInstrument(req.companyId, req.body, uid(req)));
});
exports.updateInstrument = asyncHandler(async (req, res) => {
  return ok(res, await cashBankEngine.updateInstrumentStatus(req.companyId, req.params.id, req.body, uid(req)));
});
exports.bankCharges = asyncHandler(async (req, res) => {
  return created(res, await cashBankEngine.postBankCharges(req.companyId, { ...req.body, userId: uid(req) }));
});
exports.depositWithdraw = asyncHandler(async (req, res) => {
  return created(res, await cashBankEngine.depositWithdraw(req.companyId, { ...req.body, userId: uid(req) }));
});
exports.cashClosing = asyncHandler(async (req, res) => {
  return ok(res, await cashBankEngine.cashClosing(req.companyId, req.query));
});
exports.startBRS = asyncHandler(async (req, res) => {
  return created(res, await cashBankEngine.startReconciliation(req.companyId, { ...req.body, userId: uid(req) }));
});
exports.clearBRS = asyncHandler(async (req, res) => {
  return ok(res, await cashBankEngine.clearEntries(req.companyId, req.params.id, req.body, uid(req)));
});
exports.finalizeBRS = asyncHandler(async (req, res) => {
  return ok(res, await cashBankEngine.finalizeReconciliation(req.companyId, req.params.id, uid(req)), 'Reconciled');
});

// ─── 3.5 Receivable / Payable ────────────────────────────────
exports.outstanding = asyncHandler(async (req, res) => {
  return ok(res, await outstandingEngine.outstandingReport(req.companyId, req.query));
});
exports.rebuildSettlements = asyncHandler(async (req, res) => {
  return ok(res, await outstandingEngine.rebuildSettlements(req.companyId), 'Rebuilt');
});
exports.followUp = asyncHandler(async (req, res) => {
  return ok(res, await outstandingEngine.updateFollowUp(req.companyId, req.params.id, req.body, uid(req)));
});
exports.settleBill = asyncHandler(async (req, res) => {
  return ok(res, await outstandingEngine.recordSettlement(req.companyId, req.body, uid(req)));
});
exports.creditCheck = asyncHandler(async (req, res) => {
  return ok(res, await outstandingEngine.checkCreditLimit(
    req.companyId, req.body.partyId || req.body.customerId, req.body.amount
  ));
});
exports.outstandingReconcile = asyncHandler(async (req, res) => {
  return ok(res, await outstandingEngine.reconcileWithLedger(req.companyId, req.query));
});

// ─── 3.6 Reports ─────────────────────────────────────────────
exports.trialBalance = asyncHandler(async (req, res) => {
  return ok(res, await financialReports.trialBalance(req.companyId, req.query));
});
exports.profitLoss = asyncHandler(async (req, res) => {
  return ok(res, await financialReports.profitAndLoss(req.companyId, req.query));
});
exports.balanceSheet = asyncHandler(async (req, res) => {
  return ok(res, await financialReports.balanceSheet(req.companyId, req.query));
});
exports.cashFlow = asyncHandler(async (req, res) => {
  return ok(res, await financialReports.cashFlow(req.companyId, req.query));
});
exports.fundFlow = asyncHandler(async (req, res) => {
  return ok(res, await financialReports.fundFlow(req.companyId, req.query));
});
exports.dayBook = asyncHandler(async (req, res) => {
  return ok(res, await financialReports.dayBook(req.companyId, req.query));
});
exports.journalRegister = asyncHandler(async (req, res) => {
  return ok(res, await financialReports.journalRegister(req.companyId, req.query));
});
exports.voucherRegister = asyncHandler(async (req, res) => {
  return ok(res, await financialReports.voucherRegister(req.companyId, req.query));
});

// ─── 3.7 Closing ─────────────────────────────────────────────
exports.lockMonth = asyncHandler(async (req, res) => {
  return ok(res, await financialClosing.lockMonth(req.companyId, { ...req.body, userId: uid(req) }));
});
exports.unlockMonth = asyncHandler(async (req, res) => {
  return ok(res, await financialClosing.unlockMonth(req.companyId, { ...req.body, userId: uid(req) }));
});
exports.lockPeriod = asyncHandler(async (req, res) => {
  return ok(res, await financialClosing.lockPeriod(req.companyId, { ...req.body, userId: uid(req) }));
});
exports.validateClose = asyncHandler(async (req, res) => {
  return ok(res, await financialClosing.validateBeforeClose(req.companyId, req.body.financialYearId || req.query.financialYearId));
});
exports.closeYear = asyncHandler(async (req, res) => {
  return ok(res, await financialClosing.closeYear(req.companyId, { ...req.body, userId: uid(req) }), 'FY closed');
});
exports.reopenYear = asyncHandler(async (req, res) => {
  return ok(res, await financialClosing.reopenYear(req.companyId, { ...req.body, userId: uid(req) }), 'FY reopened');
});
exports.depreciation = asyncHandler(async (req, res) => {
  return created(res, await financialClosing.postDepreciation(req.companyId, { ...req.body, userId: uid(req) }));
});

// ─── 3.8 Audit ───────────────────────────────────────────────
exports.fullReconcile = asyncHandler(async (req, res) => {
  return ok(res, await financialAudit.fullReconciliation(req.companyId));
});
exports.journalAudit = asyncHandler(async (req, res) => {
  return ok(res, await financialAudit.journalAudit(req.companyId, req.query));
});
exports.inventoryGl = asyncHandler(async (req, res) => {
  return ok(res, await financialAudit.inventoryVsGl(req.companyId));
});
exports.gstGl = asyncHandler(async (req, res) => {
  return ok(res, await financialAudit.gstVsGl(req.companyId));
});
exports.auditTrail = asyncHandler(async (req, res) => {
  return ok(res, await financialAudit.auditTrail(req.companyId, req.query));
});

// ─── 3.9 Cost Centers ────────────────────────────────────────
exports.ccSeed = asyncHandler(async (req, res) => {
  return ok(res, await costCenterService.seedTextileProcesses(req.companyId), 'Processes seeded');
});
exports.ccList = asyncHandler(async (req, res) => {
  return ok(res, await costCenterService.list(req.companyId, req.query));
});
exports.ccCreate = asyncHandler(async (req, res) => {
  return created(res, await costCenterService.create(req.companyId, req.body, uid(req)));
});
exports.ccUpdate = asyncHandler(async (req, res) => {
  return ok(res, await costCenterService.update(req.companyId, req.params.id, req.body, uid(req)));
});
exports.ccDelete = asyncHandler(async (req, res) => {
  return ok(res, await costCenterService.softDelete(req.companyId, req.params.id, uid(req)));
});
exports.ccReport = asyncHandler(async (req, res) => {
  return ok(res, await costCenterService.costReport(req.companyId, req.query));
});
exports.ccTextile = asyncHandler(async (req, res) => {
  return ok(res, await costCenterService.textileProcessCosting(req.companyId, { ...req.query, ...req.body }));
});
exports.ccMargin = asyncHandler(async (req, res) => {
  return ok(res, await costCenterService.marginAnalysis(req.companyId, req.body));
});
exports.ccAllocate = asyncHandler(async (req, res) => {
  return ok(res, await costCenterService.allocateOverhead(req.companyId, { ...req.body, userId: uid(req) }));
});

// ─── 3.10 Certification ──────────────────────────────────────
exports.certRun = asyncHandler(async (req, res) => {
  return ok(res, await financialCertification.run(req.companyId, { triggeredBy: uid(req) }), 'Certification complete');
});
exports.certLatest = asyncHandler(async (req, res) => {
  return ok(res, await financialCertification.latest(req.companyId));
});
exports.certList = asyncHandler(async (req, res) => {
  return ok(res, await financialCertification.list(req.companyId));
});
