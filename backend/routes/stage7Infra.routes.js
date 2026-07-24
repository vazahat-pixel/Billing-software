const express = require('express');
const router = express.Router();
const c = require('../controllers/stage7InfraController');
const { requirePermission } = require('../middlewares/permission.middleware');
const { objectIdParam } = require('../validators');

const read = requirePermission('reports', 'read');
const write = requirePermission('reports', 'create');
const update = requirePermission('reports', 'update');

// Security config
router.get('/security/config', read, c.getConfig);
router.put('/security/config', update, c.updateConfig);
router.post('/security/seed-flags', write, c.seedFlags);
router.post('/security/validate-password', read, c.validatePassword);
router.get('/security/posture', read, c.securityPosture);

// Sessions
router.get('/sessions', read, c.listSessions);
router.delete('/sessions/:sessionId', update, c.revokeSession);
router.post('/sessions/revoke-all', update, c.revokeAllSessions);
router.post('/sessions/force-logout/:userId', update, c.forceLogout);
router.get('/sessions/history', read, c.loginHistory);
router.get('/sessions/history/:userId', read, c.loginHistory);
router.post('/sessions/trust', update, c.trustDevice);

// Database
router.get('/db/health', read, c.dbHealth);
router.get('/db/indexes', read, c.dbIndexes);
router.post('/db/analyze', write, c.dbAnalyze);
router.get('/db/migrations', read, c.dbMigrations);

// Cache & queues
router.get('/cache/stats', read, c.cacheStats);
router.post('/cache/clear', write, c.cacheClear);
router.get('/queue/stats', read, c.queueStats);
router.get('/queue/jobs', read, c.queueList);
router.post('/queue/jobs', write, c.queueEnqueue);
router.post('/queue/jobs/:id/retry', update, objectIdParam, c.queueRetry);

// Monitoring
router.get('/monitor/snapshot', read, c.monitorSnapshot);
router.get('/monitor/health', read, c.monitorHealth);

// Logs
router.get('/logs', read, c.logsQuery);
router.get('/logs/categories', read, c.logsCategories);
router.get('/logs/audit', read, c.logsAudit);

// Backups
router.get('/backups', read, c.backupList);
router.post('/backups', write, c.backupCreate);
router.get('/backups/policy', read, c.backupPolicy);
router.post('/backups/schedule', write, c.backupSchedule);
router.get('/backups/:id/preview', read, objectIdParam, c.backupPreview);
router.post('/backups/:id/verify', write, objectIdParam, c.backupVerify);

// Certification
router.post('/certification/run', write, c.certRun);
router.get('/certification/latest', read, c.certLatest);
router.get('/certification', read, c.certList);

module.exports = router;
