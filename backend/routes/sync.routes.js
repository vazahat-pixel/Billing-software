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

// Desktop mirroring (desktop and cloud hold the same documents; see services/replication)
const mirror = require('../controllers/mirror.controller');
router.get('/mirror/manifest', mirror.manifest);
router.get('/mirror/page', mirror.page);
router.post('/mirror/apply', mirror.apply);
router.get('/mirror/lock', mirror.getLock);
router.put('/mirror/lock', mirror.setLock);
router.get('/mirror/status', mirror.status);
router.post('/mirror/retry', mirror.retry);

module.exports = router;
