const express = require('express');
const router = express.Router();
const c = require('../controllers/salesEngineController');
const { requirePermission } = require('../middlewares/permission.middleware');
const { objectIdParam } = require('../validators');
const { guard } = require('../utils/featureGuard');

router.use(guard('sales'));

router.get('/pipeline', requirePermission('sales', 'read'), c.pipeline);

router.get('/quotations', requirePermission('sales', 'read'), c.listQuotations);
router.post('/quotations', requirePermission('sales', 'create'), c.createQuotation);
router.post('/quotations/:id/accept', requirePermission('sales', 'update'), objectIdParam, c.acceptQuotation);
router.post('/quotations/:id/convert', requirePermission('sales', 'create'), objectIdParam, c.convertQuotation);

router.get('/orders', requirePermission('sales', 'read'), c.listOrders);
router.post('/orders', requirePermission('sales', 'create'), c.createOrder);
router.post('/orders/:id/approve', requirePermission('sales', 'update'), objectIdParam, c.approveOrder);
router.post('/orders/:id/packing', requirePermission('sales', 'update'), objectIdParam, c.updatePacking);

router.get('/challans', requirePermission('sales', 'read'), c.listChallans);
router.post('/challans', requirePermission('sales', 'create'), c.createChallan);
router.post('/challans/:id/invoice', requirePermission('sales', 'create'), objectIdParam, c.convertChallanToInvoice);

router.post('/invoice', requirePermission('sales', 'create'), c.createDirectInvoice);
router.post('/returns', requirePermission('sales', 'create'), c.createSalesReturn);

module.exports = router;
