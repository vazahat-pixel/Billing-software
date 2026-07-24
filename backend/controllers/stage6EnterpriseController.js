const asyncHandler = require('../utils/asyncHandler');
const { ok, created } = require('../utils/apiResponse');

const enterpriseConfig = require('../services/enterpriseConfigService');
const globalSearch = require('../services/globalSearchService');
const enterpriseNotifications = require('../services/enterpriseNotificationService');
const automationEngine = require('../services/automationRuleEngineService');
const approvalEngine = require('../services/approvalEngineService');
const offlinePlatform = require('../services/offlinePlatformService');
const communicationHub = require('../services/communicationHubService');
const enterpriseDocuments = require('../services/enterpriseDocumentService');
const biAnalytics = require('../services/biAnalyticsService');
const productivity = require('../services/productivityService');
const enterpriseCert = require('../services/enterpriseCertificationService');

const uid = (req) => req.user?._id || req.user?.id || null;

// ─── Overview / Config (6.0) ─────────────────────────────────
exports.overview = asyncHandler(async (req, res) => {
  return ok(res, await enterpriseConfig.overview(req.companyId));
});
exports.getConfig = asyncHandler(async (req, res) => {
  return ok(res, await enterpriseConfig.getOrCreate(req.companyId));
});
exports.updateConfig = asyncHandler(async (req, res) => {
  return ok(res, await enterpriseConfig.update(req.companyId, req.body, uid(req)));
});
exports.seedFlags = asyncHandler(async (req, res) => {
  return ok(res, await enterpriseConfig.seedFeatureFlags(req.companyId), 'Feature flags seeded');
});

// ─── 6.1 Global Search ───────────────────────────────────────
exports.search = asyncHandler(async (req, res) => {
  const result = await globalSearch.search(req.companyId, req.query.q || req.body.q, {
    limit: req.query.limit || req.body.limit,
    types: req.query.types || req.body.types,
  });
  if (req.query.q && uid(req)) {
    productivity.recordSearch(req.companyId, uid(req), req.query.q).catch(() => {});
  }
  return ok(res, result);
});
exports.commands = asyncHandler(async (req, res) => {
  return ok(res, { actions: globalSearch.navigationActions() });
});

// ─── 6.2 Notifications ───────────────────────────────────────
exports.notifSeed = asyncHandler(async (req, res) => {
  return ok(res, await enterpriseNotifications.seedConfigs(req.companyId), 'Notification configs seeded');
});
exports.notifConfigs = asyncHandler(async (req, res) => {
  return ok(res, await enterpriseNotifications.listConfigs(req.companyId));
});
exports.notifConfigUpdate = asyncHandler(async (req, res) => {
  return ok(res, await enterpriseNotifications.updateConfig(req.companyId, req.params.ruleKey, req.body));
});
exports.notifInbox = asyncHandler(async (req, res) => {
  return ok(res, await enterpriseNotifications.inbox(req.companyId, req.query));
});
exports.notifUnread = asyncHandler(async (req, res) => {
  return ok(res, { count: await enterpriseNotifications.unreadCount(req.companyId) });
});
exports.notifRead = asyncHandler(async (req, res) => {
  return ok(res, await enterpriseNotifications.markRead(req.companyId, req.params.id));
});
exports.notifReadAll = asyncHandler(async (req, res) => {
  return ok(res, await enterpriseNotifications.markAllRead(req.companyId));
});
exports.notifArchive = asyncHandler(async (req, res) => {
  return ok(res, await enterpriseNotifications.archive(req.companyId, req.params.id));
});
exports.notifSend = asyncHandler(async (req, res) => {
  return created(res, await enterpriseNotifications.notify(req.companyId, req.body.event || 'manual', req.body));
});

// ─── 6.3 Automation ──────────────────────────────────────────
exports.autoPipeline = asyncHandler(async (req, res) => {
  return ok(res, await automationEngine.pipeline(req.companyId));
});
exports.autoSeed = asyncHandler(async (req, res) => {
  return ok(res, await automationEngine.seed(req.companyId), 'Automation rules seeded');
});
exports.autoList = asyncHandler(async (req, res) => {
  return ok(res, await automationEngine.list(req.companyId));
});
exports.autoUpsert = asyncHandler(async (req, res) => {
  return created(res, await automationEngine.upsert(req.companyId, req.body, uid(req)));
});
exports.autoLogs = asyncHandler(async (req, res) => {
  return ok(res, await automationEngine.logs(req.companyId, req.query));
});
exports.autoRun = asyncHandler(async (req, res) => {
  return ok(
    res,
    await automationEngine.runTrigger(req.companyId, req.body.event, req.body.context || {}, uid(req))
  );
});

// ─── 6.4 Approvals ───────────────────────────────────────────
exports.apprPipeline = asyncHandler(async (req, res) => {
  return ok(res, await approvalEngine.pipeline(req.companyId));
});
exports.apprSeed = asyncHandler(async (req, res) => {
  return ok(res, await approvalEngine.seed(req.companyId), 'Approval definitions seeded');
});
exports.apprDefs = asyncHandler(async (req, res) => {
  return ok(res, await approvalEngine.listDefinitions(req.companyId));
});
exports.apprDefUpdate = asyncHandler(async (req, res) => {
  return ok(res, await approvalEngine.updateDefinition(req.companyId, req.params.code, req.body, uid(req)));
});
exports.apprInbox = asyncHandler(async (req, res) => {
  return ok(res, await approvalEngine.inbox(req.companyId, req.query));
});
exports.apprStart = asyncHandler(async (req, res) => {
  return created(res, await approvalEngine.start(req.companyId, req.body, uid(req)));
});
exports.apprDecide = asyncHandler(async (req, res) => {
  return ok(res, await approvalEngine.decide(req.companyId, req.params.id, req.body, uid(req)));
});
exports.apprReject = asyncHandler(async (req, res) => {
  return ok(res, await approvalEngine.reject(req.companyId, req.params.id, req.body.note || '', uid(req)));
});
exports.apprResubmit = asyncHandler(async (req, res) => {
  return ok(res, await approvalEngine.resubmit(req.companyId, req.params.id, req.body.note || '', uid(req)));
});
exports.apprComment = asyncHandler(async (req, res) => {
  return ok(res, await approvalEngine.comment(req.companyId, req.params.id, req.body.text || '', uid(req)));
});
exports.apprHistory = asyncHandler(async (req, res) => {
  return ok(res, await approvalEngine.history(req.companyId, req.params.referenceId));
});

// ─── 6.5 Offline ─────────────────────────────────────────────
exports.offlineStatus = asyncHandler(async (req, res) => {
  return ok(res, await offlinePlatform.status(req.companyId, req.planId));
});
exports.offlineToggle = asyncHandler(async (req, res) => {
  return ok(res, await offlinePlatform.setEnabled(req.companyId, req.body.enabled, uid(req)));
});

// ─── 6.6 Communication ───────────────────────────────────────
exports.commTemplates = asyncHandler(async (req, res) => {
  return ok(res, communicationHub.templates());
});
exports.commSend = asyncHandler(async (req, res) => {
  return created(res, await communicationHub.send(req.companyId, req.body, uid(req)));
});
exports.commList = asyncHandler(async (req, res) => {
  return ok(res, await communicationHub.list(req.companyId, req.query));
});
exports.commPipeline = asyncHandler(async (req, res) => {
  return ok(res, await communicationHub.pipeline(req.companyId));
});

// ─── 6.7 Documents ───────────────────────────────────────────
exports.docPipeline = asyncHandler(async (req, res) => {
  return ok(res, await enterpriseDocuments.pipeline(req.companyId));
});
exports.docSeed = asyncHandler(async (req, res) => {
  return ok(res, await enterpriseDocuments.seed(req.companyId), 'Templates seeded');
});
exports.docList = asyncHandler(async (req, res) => {
  return ok(res, await enterpriseDocuments.list(req.companyId));
});
exports.docUpdate = asyncHandler(async (req, res) => {
  return ok(res, await enterpriseDocuments.update(req.companyId, req.params.id, req.body, uid(req)));
});
exports.docPreview = asyncHandler(async (req, res) => {
  return ok(res, await enterpriseDocuments.preview(req.companyId, req.body || req.query));
});

// ─── 6.8 BI ──────────────────────────────────────────────────
exports.biOverview = asyncHandler(async (req, res) => {
  return ok(res, await biAnalytics.overview(req.companyId));
});
exports.biSales = asyncHandler(async (req, res) => {
  return ok(res, await biAnalytics.salesAnalytics(req.companyId, req.query));
});
exports.biPurchase = asyncHandler(async (req, res) => {
  return ok(res, await biAnalytics.purchaseAnalytics(req.companyId, req.query));
});
exports.biInventory = asyncHandler(async (req, res) => {
  return ok(res, await biAnalytics.inventoryAnalytics(req.companyId));
});
exports.biProduction = asyncHandler(async (req, res) => {
  return ok(res, await biAnalytics.productionAnalytics(req.companyId));
});
exports.biAccounting = asyncHandler(async (req, res) => {
  return ok(res, await biAnalytics.accountingAnalytics(req.companyId));
});
exports.biBranch = asyncHandler(async (req, res) => {
  return ok(res, await biAnalytics.branchComparison(req.companyId));
});
exports.biExport = asyncHandler(async (req, res) => {
  return ok(res, await biAnalytics.exportBundle(req.companyId));
});

// ─── 6.9 Productivity ────────────────────────────────────────
exports.prodDashboard = asyncHandler(async (req, res) => {
  return ok(res, await productivity.dashboard(req.companyId, uid(req)));
});
exports.prodPin = asyncHandler(async (req, res) => {
  return ok(res, await productivity.pin(req.companyId, uid(req), req.body));
});
exports.prodUnpin = asyncHandler(async (req, res) => {
  return ok(res, await productivity.unpin(req.companyId, uid(req), req.params.id || req.body.id));
});
exports.prodTouch = asyncHandler(async (req, res) => {
  return ok(res, await productivity.touchDocument(req.companyId, uid(req), req.body));
});
exports.prodDraft = asyncHandler(async (req, res) => {
  return ok(res, await productivity.saveDraft(req.companyId, uid(req), req.body));
});
exports.prodClearDraft = asyncHandler(async (req, res) => {
  return ok(res, await productivity.clearDraft(req.companyId, uid(req), req.params.module || req.body.module));
});
exports.prodFavorite = asyncHandler(async (req, res) => {
  return ok(res, await productivity.toggleFavorite(req.companyId, req.body));
});
exports.prodDuplicate = asyncHandler(async (req, res) => {
  return ok(res, await productivity.duplicateSource(req.companyId, req.body));
});
exports.prodBulkExport = asyncHandler(async (req, res) => {
  return ok(res, await productivity.bulkExportMeta(req.companyId, req.body));
});

// ─── 6.10 Certification ──────────────────────────────────────
exports.certRun = asyncHandler(async (req, res) => {
  return created(
    res,
    await enterpriseCert.run(req.companyId, { triggeredBy: uid(req), planId: req.planId })
  );
});
exports.certLatest = asyncHandler(async (req, res) => {
  return ok(res, await enterpriseCert.latest(req.companyId));
});
exports.certList = asyncHandler(async (req, res) => {
  return ok(res, await enterpriseCert.list(req.companyId));
});
