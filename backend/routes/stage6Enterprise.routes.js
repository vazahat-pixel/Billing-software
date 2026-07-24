const express = require('express');
const router = express.Router();
const c = require('../controllers/stage6EnterpriseController');
const { requirePermission } = require('../middlewares/permission.middleware');
const { objectIdParam } = require('../validators');

const read = requirePermission('reports', 'read');
const write = requirePermission('reports', 'create');
const update = requirePermission('reports', 'update');
const salesRead = requirePermission('sales', 'read');
const salesWrite = requirePermission('sales', 'create');
const salesUpdate = requirePermission('sales', 'update');

// Overview / config
router.get('/overview', read, c.overview);
router.get('/config', read, c.getConfig);
router.put('/config', update, c.updateConfig);
router.post('/config/seed-flags', write, c.seedFlags);

// 6.1 Global Search & Command Center
router.get('/search', salesRead, c.search);
router.post('/search', salesRead, c.search);
router.get('/commands', salesRead, c.commands);

// 6.2 Notification Center
router.post('/notifications/seed', write, c.notifSeed);
router.get('/notifications/configs', read, c.notifConfigs);
router.put('/notifications/configs/:ruleKey', update, c.notifConfigUpdate);
router.get('/notifications/inbox', salesRead, c.notifInbox);
router.get('/notifications/unread', salesRead, c.notifUnread);
router.post('/notifications/read-all', salesUpdate, c.notifReadAll);
router.post('/notifications/send', write, c.notifSend);
router.post('/notifications/:id/read', salesUpdate, objectIdParam, c.notifRead);
router.post('/notifications/:id/archive', salesUpdate, objectIdParam, c.notifArchive);

// 6.3 Workflow Automation
router.get('/automation/pipeline', read, c.autoPipeline);
router.post('/automation/seed', write, c.autoSeed);
router.get('/automation/rules', read, c.autoList);
router.post('/automation/rules', write, c.autoUpsert);
router.get('/automation/logs', read, c.autoLogs);
router.post('/automation/run', write, c.autoRun);

// 6.4 Approval Engine
router.get('/approvals/pipeline', salesRead, c.apprPipeline);
router.post('/approvals/seed', write, c.apprSeed);
router.get('/approvals/definitions', salesRead, c.apprDefs);
router.put('/approvals/definitions/:code', update, c.apprDefUpdate);
router.get('/approvals/inbox', salesRead, c.apprInbox);
router.post('/approvals/start', salesWrite, c.apprStart);
router.post('/approvals/:id/decide', salesUpdate, objectIdParam, c.apprDecide);
router.post('/approvals/:id/reject', salesUpdate, objectIdParam, c.apprReject);
router.post('/approvals/:id/resubmit', salesUpdate, objectIdParam, c.apprResubmit);
router.post('/approvals/:id/comments', salesUpdate, objectIdParam, c.apprComment);
router.get('/approvals/history/:referenceId', salesRead, c.apprHistory);

// 6.5 Offline
router.get('/offline/status', read, c.offlineStatus);
router.put('/offline/enabled', update, c.offlineToggle);

// 6.6 Communication Hub
router.get('/communication/templates', salesRead, c.commTemplates);
router.post('/communication/send', salesWrite, c.commSend);
router.get('/communication/logs', salesRead, c.commList);
router.get('/communication/pipeline', read, c.commPipeline);

// 6.7 Document Engine
router.get('/documents/pipeline', read, c.docPipeline);
router.post('/documents/seed', write, c.docSeed);
router.get('/documents/templates', salesRead, c.docList);
router.put('/documents/templates/:id', update, objectIdParam, c.docUpdate);
router.post('/documents/preview', salesRead, c.docPreview);

// 6.8 BI
router.get('/bi/overview', read, c.biOverview);
router.get('/bi/sales', read, c.biSales);
router.get('/bi/purchase', read, c.biPurchase);
router.get('/bi/inventory', read, c.biInventory);
router.get('/bi/production', read, c.biProduction);
router.get('/bi/accounting', read, c.biAccounting);
router.get('/bi/branch', read, c.biBranch);
router.get('/bi/export', read, c.biExport);

// 6.9 Productivity
router.get('/productivity', salesRead, c.prodDashboard);
router.post('/productivity/pin', salesWrite, c.prodPin);
router.delete('/productivity/pin/:id', salesUpdate, objectIdParam, c.prodUnpin);
router.post('/productivity/touch', salesWrite, c.prodTouch);
router.post('/productivity/drafts', salesWrite, c.prodDraft);
router.delete('/productivity/drafts/:module', salesUpdate, c.prodClearDraft);
router.post('/productivity/favorite', salesWrite, c.prodFavorite);
router.post('/productivity/duplicate', salesRead, c.prodDuplicate);
router.post('/productivity/bulk-export', salesRead, c.prodBulkExport);

// 6.10 Certification
router.post('/certification/run', write, c.certRun);
router.get('/certification/latest', read, c.certLatest);
router.get('/certification', read, c.certList);

module.exports = router;
