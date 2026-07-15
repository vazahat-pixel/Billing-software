const express = require('express');
const router = express.Router();
const salesController = require('../controllers/salesController');
const { guard } = require('../utils/featureGuard');
const { saleStatus, objectIdParam } = require('../validators');
const { requirePermission } = require('../middlewares/permission.middleware');

router.use(guard('sales'));

router.post('/', requirePermission('sales', 'create'), salesController.createInvoice);
router.get('/', requirePermission('sales', 'read'), salesController.getSales);
router.get('/:id', requirePermission('sales', 'read'), objectIdParam, salesController.getSale);
router.put('/:id/status', requirePermission('sales', 'update'), objectIdParam, saleStatus, salesController.updateSaleStatus);
router.delete('/:id', requirePermission('sales', 'delete'), objectIdParam, salesController.deleteSale);

module.exports = router;
