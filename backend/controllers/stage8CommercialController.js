const asyncHandler = require('../utils/asyncHandler');
const { ok, created } = require('../utils/apiResponse');

const businessFlow = require('../services/businessFlowCertificationService');
const qaRegression = require('../services/qaRegressionService');
const licensing = require('../services/licensingActivationService');
const onboarding = require('../services/onboardingService');
const releaseMgmt = require('../services/releaseManagementService');
const commercialCert = require('../services/commercialCertificationService');
const testingPlatform = require('../services/enterpriseTestingPlatformService');

const uid = (req) => req.user?._id || req.user?.id || null;

// Overview
exports.overview = asyncHandler(async (req, res) => {
  const [version, desktop, docs, license, onb] = await Promise.all([
    releaseMgmt.currentVersion(),
    releaseMgmt.desktopStatus(),
    releaseMgmt.documentationIndex(),
    licensing.status(req.companyId),
    onboarding.status(req.companyId, uid(req)),
  ]);
  return ok(res, {
    version,
    desktop,
    documentation: docs.helpCenter,
    license,
    onboarding: { status: onb.status, progressPct: onb.progressPct },
    stage: 8,
    product: 'Textile ERP SaaS',
  });
});

// 8.1 Business flows
exports.flowCert = asyncHandler(async (req, res) => {
  const businessFlowCertifier = require('../services/certifiers/businessFlowCertifier');
  // GET defaults to readonly; pass ?seed=1 to bootstrap smoke data
  const seed = String(req.query.seed || '0') === '1';
  return ok(res, await businessFlowCertifier.certify(req.companyId, { seed }));
});
exports.flowCertExecute = asyncHandler(async (req, res) => {
  const businessFlowCertifier = require('../services/certifiers/businessFlowCertifier');
  return created(
    res,
    await businessFlowCertifier.certify(req.companyId, { seed: req.body?.seed !== false })
  );
});

// 8.2 QA
exports.qaInventory = asyncHandler(async (req, res) => {
  return ok(res, await qaRegression.inventory());
});
exports.qaSmoke = asyncHandler(async (req, res) => {
  return ok(res, await qaRegression.runSmoke(req.companyId));
});
exports.uiuxChecklist = asyncHandler(async (req, res) => {
  return ok(res, qaRegression.uiuxChecklist());
});

// 8.7 Licensing
exports.licenseStatus = asyncHandler(async (req, res) => {
  return ok(res, await licensing.status(req.companyId));
});
exports.licenseActivate = asyncHandler(async (req, res) => {
  return ok(res, await licensing.activateOnline(req.companyId, req.body, uid(req)));
});
exports.licenseActivateOffline = asyncHandler(async (req, res) => {
  return ok(res, await licensing.activateOffline(req.companyId, req.body, uid(req)));
});
exports.licenseOfflineCode = asyncHandler(async (req, res) => {
  return ok(res, await licensing.generateOfflineCode(req.companyId, req.body.licenseKey || req.query.licenseKey));
});
exports.licenseDeactivateDevice = asyncHandler(async (req, res) => {
  return ok(res, await licensing.deactivateDevice(req.companyId, req.params.deviceId || req.body.deviceId, uid(req)));
});
exports.licenseRenew = asyncHandler(async (req, res) => {
  return ok(res, await licensing.renew(req.companyId, req.body, uid(req)));
});
exports.licenseUpgrade = asyncHandler(async (req, res) => {
  return ok(res, await licensing.upgrade(req.companyId, req.body.planTier, uid(req)));
});
exports.licenseIssue = asyncHandler(async (req, res) => {
  return created(res, await licensing.issue(req.companyId, req.body, uid(req)));
});
exports.licenseAudit = asyncHandler(async (req, res) => {
  return ok(res, await licensing.audit(req.companyId));
});

// 8.8 Onboarding
exports.onboardingStatus = asyncHandler(async (req, res) => {
  return ok(res, await onboarding.status(req.companyId, uid(req)));
});
exports.onboardingWizard = asyncHandler(async (req, res) => {
  return ok(res, onboarding.wizardDefinition());
});
exports.onboardingStep = asyncHandler(async (req, res) => {
  return ok(res, await onboarding.completeStep(req.companyId, req.body.step, req.body.payload || {}, uid(req)));
});
exports.onboardingQuick = asyncHandler(async (req, res) => {
  return ok(res, await onboarding.runQuickSetup(req.companyId, uid(req), req.body || {}));
});
exports.onboardingSkip = asyncHandler(async (req, res) => {
  return ok(res, await onboarding.skip(req.companyId, uid(req)));
});

// 8.9 Release
exports.releaseVersion = asyncHandler(async (req, res) => {
  return ok(res, releaseMgmt.currentVersion());
});
exports.releaseList = asyncHandler(async (req, res) => {
  return ok(res, await releaseMgmt.list());
});
exports.releaseLatest = asyncHandler(async (req, res) => {
  return ok(res, await releaseMgmt.latest());
});
exports.releaseUpsert = asyncHandler(async (req, res) => {
  return created(res, await releaseMgmt.upsert(req.body, uid(req)));
});
exports.releaseApprove = asyncHandler(async (req, res) => {
  return ok(res, await releaseMgmt.approve(req.params.version, uid(req), req.body.scores));
});
exports.releaseShip = asyncHandler(async (req, res) => {
  return ok(res, await releaseMgmt.markReleased(req.params.version, uid(req)));
});
exports.releaseEnsureV1 = asyncHandler(async (req, res) => {
  return ok(res, await releaseMgmt.ensureV1());
});
exports.docsIndex = asyncHandler(async (req, res) => {
  return ok(res, releaseMgmt.documentationIndex());
});
exports.desktopStatus = asyncHandler(async (req, res) => {
  return ok(res, releaseMgmt.desktopStatus());
});

// 8.10 Certification
exports.certRun = asyncHandler(async (req, res) => {
  return created(res, await commercialCert.run(req.companyId, { triggeredBy: uid(req) }));
});
exports.certLatest = asyncHandler(async (req, res) => {
  return ok(res, await commercialCert.latest(req.companyId));
});
exports.certList = asyncHandler(async (req, res) => {
  return ok(res, await commercialCert.list(req.companyId));
});

// 8.11 Enterprise Testing Platform
exports.testingCatalog = asyncHandler(async (req, res) => {
  return ok(res, testingPlatform.catalog());
});
exports.testingDashboard = asyncHandler(async (req, res) => {
  return ok(res, await testingPlatform.dashboard(req.companyId));
});
exports.testingCertify = asyncHandler(async (req, res) => {
  return created(
    res,
    await testingPlatform.run(req.companyId, {
      triggeredBy: uid(req),
      mode: req.body?.mode || 'full',
    })
  );
});
exports.testingLatest = asyncHandler(async (req, res) => {
  return ok(res, await testingPlatform.latest(req.companyId));
});
exports.testingList = asyncHandler(async (req, res) => {
  return ok(res, await testingPlatform.list(req.companyId));
});
exports.testingScaffold = asyncHandler(async (req, res) => {
  return ok(res, testingPlatform.scaffoldHealth());
});
exports.testingGates = asyncHandler(async (req, res) => {
  const qualityGates = require('../services/certifiers/qualityGates');
  return ok(res, {
    productionGate: qualityGates.PRODUCTION_GATE,
    gates: qualityGates.GATES,
    suites: qualityGates.SUITES,
    testTypes: qualityGates.TEST_TYPES,
  });
});
