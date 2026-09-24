const express = require('express');
const router = express.Router();
const syncController = require('../controllers/sync.controller');
const { requirePermission } = require('../middlewares/permission.middleware');

// Sync status — any authenticated company user
router.get('/status', syncController.status);

router.post('/push', requirePermission('sales', 'create'), syncController.push);
router.get('/pull', requirePermission('sales', 'read'), syncController.pull);
router.post('/pull', requirePermission('sales', 'read'), syncController.pull);

router.post('/leases/invoice', requirePermission('sales', 'create'), syncController.leaseInvoice);
router.post('/resolve-conflict', requirePermission('sales', 'update'), syncController.resolveConflict);

// Desktop-local helpers
router.post('/apply-pull', syncController.applyPull);
router.get('/outbox', syncController.outboxPending);
router.post('/agent-tick', syncController.agentTick);

module.exports = router;
