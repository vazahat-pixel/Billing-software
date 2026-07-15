const express = require('express');
const router = express.Router();
const c = require('../controllers/businessAutomationController');
const { requirePermission } = require('../middlewares/permission.middleware');
const { objectIdParam } = require('../validators');

router.get('/pipeline', requirePermission('sales', 'read'), c.pipeline);
router.post('/seed', requirePermission('sales', 'create'), c.seedDefaults);

router.get('/rules', requirePermission('sales', 'read'), c.listRules);
router.post('/rules', requirePermission('sales', 'create'), c.upsertRule);

router.post('/evaluate-approval', requirePermission('sales', 'read'), c.evaluateApproval);
router.post('/check-duplicates', requirePermission('sales', 'read'), c.checkDuplicates);

router.get('/series', requirePermission('sales', 'read'), c.listSeries);
router.post('/series/allocate', requirePermission('sales', 'create'), c.allocateNumber);

router.get('/notifications', requirePermission('sales', 'read'), c.listNotifications);
router.post('/notifications/:id/read', requirePermission('sales', 'update'), objectIdParam, c.markRead);

router.get('/outstanding', requirePermission('sales', 'read'), c.getOutstanding);
router.post('/scans/low-stock', requirePermission('inventory', 'read'), c.runLowStock);
router.post('/scans/overdue', requirePermission('sales', 'read'), c.runOverdue);

router.get('/profit-snapshots', requirePermission('sales', 'read'), c.listProfitSnapshots);
router.post('/profit-snapshots', requirePermission('sales', 'create'), c.createProfitSnapshot);

module.exports = router;
