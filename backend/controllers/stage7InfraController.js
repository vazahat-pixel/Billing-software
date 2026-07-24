const asyncHandler = require('../utils/asyncHandler');
const { ok, created } = require('../utils/apiResponse');

const securityConfig = require('../services/securityConfigService');
const sessionService = require('../services/sessionService');
const cacheService = require('../services/cacheService');
const jobQueueService = require('../services/jobQueueService');
const monitoringService = require('../services/monitoringService');
const platformLogService = require('../services/platformLogService');
const backupService = require('../services/backupService');
const dbPerformance = require('../services/dbPerformanceService');
const infraCert = require('../services/infraCertificationService');

const uid = (req) => req.user?._id || req.user?.id || null;

// Config
exports.getConfig = asyncHandler(async (req, res) => {
  return ok(res, await securityConfig.getOrCreate(req.companyId));
});
exports.updateConfig = asyncHandler(async (req, res) => {
  return ok(res, await securityConfig.update(req.companyId, req.body, uid(req)));
});
exports.seedFlags = asyncHandler(async (req, res) => {
  return ok(res, await securityConfig.seedFlags(req.companyId), 'Flags seeded');
});
exports.validatePassword = asyncHandler(async (req, res) => {
  const cfg = await securityConfig.getOrCreate(req.companyId);
  return ok(res, securityConfig.validatePassword(req.body.password || '', cfg.passwordPolicy));
});

// Sessions
exports.listSessions = asyncHandler(async (req, res) => {
  return ok(res, await sessionService.listSessions(uid(req)));
});
exports.revokeSession = asyncHandler(async (req, res) => {
  return ok(res, await sessionService.revokeSession(uid(req), req.params.sessionId, 'user_revoke'));
});
exports.revokeAllSessions = asyncHandler(async (req, res) => {
  return ok(res, await sessionService.revokeAll(uid(req), req.sessionId, 'logout_all'));
});
exports.forceLogout = asyncHandler(async (req, res) => {
  return ok(res, await sessionService.forceLogout(req.params.userId, uid(req), req.companyId));
});
exports.loginHistory = asyncHandler(async (req, res) => {
  const userId = req.params.userId || uid(req);
  return ok(res, await sessionService.loginHistory(userId, req.query));
});
exports.trustDevice = asyncHandler(async (req, res) => {
  return ok(res, await sessionService.trustDevice(uid(req), req.body.sessionId || req.sessionId));
});

// DB performance
exports.dbHealth = asyncHandler(async (req, res) => {
  return ok(res, await dbPerformance.health());
});
exports.dbIndexes = asyncHandler(async (req, res) => {
  return ok(res, await dbPerformance.indexReport());
});
exports.dbAnalyze = asyncHandler(async (req, res) => {
  return ok(res, await dbPerformance.analyzeQuery(req.body));
});
exports.dbMigrations = asyncHandler(async (req, res) => {
  return ok(res, { files: dbPerformance.listMigrationFiles() });
});

// Cache & jobs
exports.cacheStats = asyncHandler(async (req, res) => {
  return ok(res, cacheService.stats());
});
exports.cacheClear = asyncHandler(async (req, res) => {
  cacheService.clearMemory();
  return ok(res, { cleared: true });
});
exports.queueStats = asyncHandler(async (req, res) => {
  return ok(res, await jobQueueService.stats(req.companyId));
});
exports.queueList = asyncHandler(async (req, res) => {
  return ok(res, await jobQueueService.list(req.companyId, req.query));
});
exports.queueEnqueue = asyncHandler(async (req, res) => {
  return created(res, await jobQueueService.enqueue(req.companyId, req.body));
});
exports.queueRetry = asyncHandler(async (req, res) => {
  return ok(res, await jobQueueService.retryDead(req.params.id, req.companyId));
});

// Monitoring
exports.monitorSnapshot = asyncHandler(async (req, res) => {
  return ok(res, await monitoringService.snapshot(req.companyId));
});
exports.monitorHealth = asyncHandler(async (req, res) => {
  return ok(res, await monitoringService.healthDetailed());
});

// Logs
exports.logsQuery = asyncHandler(async (req, res) => {
  return ok(res, await platformLogService.query(req.companyId, req.query));
});
exports.logsCategories = asyncHandler(async (req, res) => {
  return ok(res, await platformLogService.categories(req.companyId));
});
exports.logsAudit = asyncHandler(async (req, res) => {
  return ok(res, await platformLogService.auditTail(req.companyId, req.query));
});

// Backups
exports.backupList = asyncHandler(async (req, res) => {
  return ok(res, await backupService.list(req.companyId, req.query));
});
exports.backupCreate = asyncHandler(async (req, res) => {
  return created(res, await backupService.create(req.companyId, { ...req.body, userId: uid(req) }));
});
exports.backupVerify = asyncHandler(async (req, res) => {
  return ok(res, await backupService.verify(req.companyId, req.params.id));
});
exports.backupPreview = asyncHandler(async (req, res) => {
  return ok(res, await backupService.preview(req.companyId, req.params.id));
});
exports.backupSchedule = asyncHandler(async (req, res) => {
  return created(res, await backupService.schedule(req.companyId, uid(req)));
});
exports.backupPolicy = asyncHandler(async (req, res) => {
  return ok(res, await backupService.policy());
});

// Security posture summary
exports.securityPosture = asyncHandler(async (req, res) => {
  const cfg = await securityConfig.getOrCreate(req.companyId);
  return ok(res, {
    helmet: true,
    cors: true,
    rateLimit: true,
    mongoSanitize: true,
    jwt: true,
    refreshTokens: true,
    csrf: 'bearer-token-api (double-submit N/A)',
    passwordPolicy: cfg.passwordPolicy,
    lockout: cfg.lockout,
    csp: true,
    requestSizeLimit: '2mb',
    fileUploadValidation: true,
  });
});

// Certification
exports.certRun = asyncHandler(async (req, res) => {
  return created(res, await infraCert.run(req.companyId, { triggeredBy: uid(req) }));
});
exports.certLatest = asyncHandler(async (req, res) => {
  return ok(res, await infraCert.latest(req.companyId));
});
exports.certList = asyncHandler(async (req, res) => {
  return ok(res, await infraCert.list(req.companyId));
});
