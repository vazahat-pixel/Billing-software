const express = require('express');
const router = express.Router();
const c = require('../controllers/purchaseEngineController');
const { requirePermission } = require('../middlewares/permission.middleware');
const { objectIdParam } = require('../validators');
const { guard } = require('../utils/featureGuard');

router.use(guard('purchase'));

router.get('/pipeline', requirePermission('purchase', 'read'), c.pipeline);

router.get('/indents', requirePermission('purchase', 'read'), c.listIndents);
router.post('/indents', requirePermission('purchase', 'create'), c.createIndent);
router.post('/indents/:id/submit', requirePermission('purchase', 'update'), objectIdParam, c.submitIndent);
router.post('/indents/:id/approve', requirePermission('purchase', 'update'), objectIdParam, c.approveIndent);

router.get('/quotations', requirePermission('purchase', 'read'), c.listQuotations);
router.post('/quotations', requirePermission('purchase', 'create'), c.createQuotation);
router.get('/quotations/compare/:indentId', requirePermission('purchase', 'read'), c.compareQuotations);
router.post('/quotations/:id/select', requirePermission('purchase', 'update'), objectIdParam, c.selectQuotation);

router.get('/orders', requirePermission('purchase', 'read'), c.listPurchaseOrders);
router.post('/orders', requirePermission('purchase', 'create'), c.createPurchaseOrder);
router.post('/orders/:id/approve', requirePermission('purchase', 'update'), objectIdParam, c.approvePurchaseOrder);

router.get('/grns', requirePermission('purchase', 'read'), c.listGrns);
router.post('/grns', requirePermission('purchase', 'create'), c.createGrn);
router.post('/grns/:id/qc', requirePermission('purchase', 'update'), objectIdParam, c.performQc);
router.post('/grns/:id/invoice', requirePermission('purchase', 'create'), objectIdParam, c.convertGrnToInvoice);

module.exports = router;
