const express = require('express');
const router = express.Router();
const salesController = require('../controllers/salesController');
const { guard } = require('../utils/featureGuard');

router.use(guard('sales'));

router.post('/', salesController.createInvoice);
router.get('/', salesController.getSales);
router.get('/:id', salesController.getSale);
router.put('/:id/status', salesController.updateSaleStatus);
router.delete('/:id', salesController.deleteSale);

module.exports = router;
