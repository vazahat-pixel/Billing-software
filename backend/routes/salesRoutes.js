const express = require('express');
const router = express.Router();
const salesController = require('../controllers/salesController');
const { guard } = require('../utils/featureGuard');
const { saleStatus, objectIdParam } = require('../validators');
const { requirePermission } = require('../middlewares/permission.middleware');
const { enforceInvoiceLimit } = require('../middlewares/planLimit.middleware');

router.use(guard('sales'));

// Sales invoices are the billable document the plan's monthly quota counts.
// (Purchase bills are the supplier's document, not one the customer issues.)
router.post('/', requirePermission('sales', 'create'), enforceInvoiceLimit, salesController.createInvoice);
router.get('/', requirePermission('sales', 'read'), salesController.getSales);
router.get('/:id', requirePermission('sales', 'read'), objectIdParam, salesController.getSale);
router.put('/:id', requirePermission('sales', 'update'), objectIdParam, salesController.updateInvoice);
router.put('/:id/status', requirePermission('sales', 'update'), objectIdParam, saleStatus, salesController.updateSaleStatus);
router.delete('/:id', requirePermission('sales', 'delete'), objectIdParam, salesController.deleteSale);

module.exports = router;
