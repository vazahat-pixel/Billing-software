const asyncHandler = require('../utils/asyncHandler');
const { ok, created } = require('../utils/apiResponse');
const gstConfigService = require('../services/gstConfigService');
const gstReturnService = require('../services/gstReturnService');
const hsnEngine = require('../services/hsnEngineService');
const tdsTcs = require('../services/tdsTcsService');
const einvoiceEway = require('../services/einvoiceEwayService');
const caWorkspace = require('../services/caWorkspaceService');
const gstReconciliation = require('../services/gstReconciliationService');
const complianceDashboard = require('../services/complianceDashboardService');
const complianceCertification = require('../services/complianceCertificationService');
const { periodKey } = require('../utils/gstDetermination');

const uid = (req) => req.user?._id || req.user?.id || null;
const period = (req) => req.query.period || req.body.period || periodKey();

// ─── 4.1 Config ──────────────────────────────────────────────
exports.getConfig = asyncHandler(async (req, res) => {
  return ok(res, await gstConfigService.getOrCreate(req.companyId));
});
exports.updateConfig = asyncHandler(async (req, res) => {
  return ok(res, await gstConfigService.update(req.companyId, req.body, uid(req)));
});
exports.mapLedgers = asyncHandler(async (req, res) => {
  return ok(res, await gstConfigService.mapSystemLedgers(req.companyId));
});
exports.listPeriods = asyncHandler(async (req, res) => {
  return ok(res, await gstConfigService.listPeriods(req.companyId));
});
exports.lockPeriod = asyncHandler(async (req, res) => {
  return ok(res, await gstConfigService.lockPeriod(req.companyId, req.body.period || period(req), uid(req)));
});
exports.unlockPeriod = asyncHandler(async (req, res) => {
  return ok(res, await gstConfigService.unlockPeriod(req.companyId, req.body.period, uid(req), req.body.reason));
});

// ─── 4.3 Returns ─────────────────────────────────────────────
exports.gstr1 = asyncHandler(async (req, res) => {
  return ok(res, await gstReturnService.buildGstr1(req.companyId, period(req)));
});
exports.gstr3b = asyncHandler(async (req, res) => {
  return ok(res, await gstReturnService.buildGstr3b(req.companyId, period(req)));
});
exports.gstr9 = asyncHandler(async (req, res) => {
  return ok(res, await gstReturnService.buildGstr9(req.companyId, req.query.financialYear || req.body.financialYear));
});
exports.snapshotReturn = asyncHandler(async (req, res) => {
  return created(
    res,
    await gstReturnService.snapshot(req.companyId, req.body.returnType, req.body.period || period(req), uid(req))
  );
});
exports.exportReturn = asyncHandler(async (req, res) => {
  const payload = await gstReturnService.exportJson(
    req.companyId,
    req.params.type || req.query.type,
    req.query.period || period(req)
  );
  return ok(res, payload);
});

// ─── 4.4 HSN ─────────────────────────────────────────────────
exports.hsnList = asyncHandler(async (req, res) => {
  return ok(res, await hsnEngine.list(req.companyId, req.query));
});
exports.hsnUpsert = asyncHandler(async (req, res) => {
  return created(res, await hsnEngine.upsert(req.companyId, req.body, uid(req)));
});
exports.hsnSync = asyncHandler(async (req, res) => {
  return ok(res, await hsnEngine.syncFromItems(req.companyId), 'Synced');
});
exports.hsnSummary = asyncHandler(async (req, res) => {
  return ok(res, await hsnEngine.summary(req.companyId, req.query));
});

// ─── 4.5 TDS/TCS ─────────────────────────────────────────────
exports.tdsSections = asyncHandler(async (req, res) => {
  return ok(res, tdsTcs.sections());
});
exports.tdsCompute = asyncHandler(async (req, res) => {
  return ok(res, await tdsTcs.computeTds(req.body));
});
exports.tdsPost = asyncHandler(async (req, res) => {
  return created(res, await tdsTcs.postTds(req.companyId, req.body, uid(req)));
});
exports.tcsPost = asyncHandler(async (req, res) => {
  return created(res, await tdsTcs.postTcs(req.companyId, req.body, uid(req)));
});
exports.tdsList = asyncHandler(async (req, res) => {
  return ok(res, await tdsTcs.list(req.companyId, req.query));
});
exports.tdsReport = asyncHandler(async (req, res) => {
  return ok(res, await tdsTcs.report(req.companyId, req.query));
});
exports.tdsCertificate = asyncHandler(async (req, res) => {
  return ok(res, await tdsTcs.issueCertificate(req.companyId, req.params.id, uid(req)));
});

// ─── 4.6 E-Invoice / E-Way ───────────────────────────────────
exports.einvoicePayload = asyncHandler(async (req, res) => {
  return ok(res, await einvoiceEway.buildEinvoicePayload(req.companyId, req.params.salesId || req.query.salesId));
});
exports.einvoiceGenerate = asyncHandler(async (req, res) => {
  return created(
    res,
    await einvoiceEway.generateEinvoice(req.companyId, req.body.salesId, uid(req), {
      provider: req.body.provider || 'Mock',
    })
  );
});
exports.einvoiceCancel = asyncHandler(async (req, res) => {
  return ok(res, await einvoiceEway.cancelEinvoice(req.companyId, req.params.id, req.body.reason, uid(req)));
});
exports.einvoiceList = asyncHandler(async (req, res) => {
  return ok(res, await einvoiceEway.listEinvoices(req.companyId, req.query));
});
exports.ewayGenerate = asyncHandler(async (req, res) => {
  return created(
    res,
    await einvoiceEway.generateEway(req.companyId, req.body, uid(req), {
      provider: req.body.provider || 'Mock',
    })
  );
});
exports.ewayList = asyncHandler(async (req, res) => {
  return ok(res, await einvoiceEway.listEway(req.companyId, req.query));
});

// ─── 4.7 CA Workspace ────────────────────────────────────────
exports.caOverview = asyncHandler(async (req, res) => {
  return ok(res, await caWorkspace.overview(req.companyId, { period: period(req) }));
});
exports.caTrialBalance = asyncHandler(async (req, res) => {
  return ok(res, await caWorkspace.trialBalance(req.companyId, req.query));
});
exports.caPL = asyncHandler(async (req, res) => {
  return ok(res, await caWorkspace.profitLoss(req.companyId, req.query));
});
exports.caBS = asyncHandler(async (req, res) => {
  return ok(res, await caWorkspace.balanceSheet(req.companyId, req.query));
});
exports.caJournals = asyncHandler(async (req, res) => {
  return ok(res, await caWorkspace.journalRegister(req.companyId, req.query));
});
exports.caLedger = asyncHandler(async (req, res) => {
  return ok(res, await caWorkspace.ledgerStatement(req.companyId, req.params.id, req.query));
});
exports.caGst = asyncHandler(async (req, res) => {
  return ok(res, await caWorkspace.gstReturns(req.companyId, period(req)));
});
exports.caAuditPack = asyncHandler(async (req, res) => {
  return ok(res, await caWorkspace.auditPack(req.companyId, period(req)));
});
exports.caExports = asyncHandler(async (req, res) => {
  return ok(res, await caWorkspace.exportCentre(req.companyId, period(req)));
});

// ─── 4.8 Reconciliation ──────────────────────────────────────
exports.import2b = asyncHandler(async (req, res) => {
  return created(res, await gstReconciliation.importGstr2b(req.companyId, req.body, uid(req)));
});
exports.reconcile2b = asyncHandler(async (req, res) => {
  return ok(res, await gstReconciliation.reconcile2b(req.companyId, req.params.id, uid(req)));
});
exports.fullReconcile = asyncHandler(async (req, res) => {
  return ok(res, await gstReconciliation.fullReconciliation(req.companyId, period(req)));
});
exports.salesVsGstr1 = asyncHandler(async (req, res) => {
  return ok(res, await gstReconciliation.salesVsGstr1(req.companyId, period(req)));
});

// ─── 4.9 Dashboard ───────────────────────────────────────────
exports.dashboard = asyncHandler(async (req, res) => {
  return ok(res, await complianceDashboard.get(req.companyId, { period: period(req) }));
});
exports.filingCalendar = asyncHandler(async (req, res) => {
  return ok(res, await complianceDashboard.filingCalendar(req.companyId, req.query.year));
});

// ─── 4.10 Certification ──────────────────────────────────────
exports.certRun = asyncHandler(async (req, res) => {
  return ok(
    res,
    await complianceCertification.run(req.companyId, {
      triggeredBy: uid(req),
      period: period(req),
    }),
    'Compliance certification complete'
  );
});
exports.certLatest = asyncHandler(async (req, res) => {
  return ok(res, await complianceCertification.latest(req.companyId));
});
exports.certList = asyncHandler(async (req, res) => {
  return ok(res, await complianceCertification.list(req.companyId));
});
