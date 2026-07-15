const express = require('express');
const router = express.Router();
const c = require('../controllers/inventoryEngineController');
const { requirePermission } = require('../middlewares/permission.middleware');
const { objectIdParam } = require('../validators');
const { guard } = require('../utils/featureGuard');

router.use(guard('inventory'));

router.get('/pipeline', requirePermission('inventory', 'read'), c.pipeline);
router.get('/availability', requirePermission('inventory', 'read'), c.availability);
router.get('/ledger', requirePermission('inventory', 'read'), c.stockLedger);
router.get('/lot/:id/ledger', requirePermission('inventory', 'read'), objectIdParam, c.lotLedger);
router.get('/valuation/:id', requirePermission('inventory', 'read'), objectIdParam, c.valuation);
router.get('/low-stock', requirePermission('inventory', 'read'), c.lowStock);

router.get('/reservations', requirePermission('inventory', 'read'), c.listReservations);
router.post('/reservations', requirePermission('inventory', 'create'), c.reserveStock);
router.post('/reservations/:id/release', requirePermission('inventory', 'update'), objectIdParam, c.releaseReservation);

router.get('/transfers', requirePermission('inventory', 'read'), c.listTransfers);
router.post('/transfers', requirePermission('inventory', 'create'), c.transferStock);

router.get('/adjustments', requirePermission('inventory', 'read'), c.listAdjustments);
router.post('/adjustments', requirePermission('inventory', 'create'), c.createAdjustment);
router.post('/adjustments/:id/post', requirePermission('inventory', 'update'), objectIdParam, c.postAdjustment);

router.post('/lots/:id/hold', requirePermission('inventory', 'update'), objectIdParam, c.setLotHold);

module.exports = router;
