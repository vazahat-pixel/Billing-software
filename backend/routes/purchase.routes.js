const express = require('express');
const router = express.Router();
const purchaseController = require('../controllers/purchaseController');
const { guard } = require('../utils/featureGuard');

router.use(guard('purchase'));

router.post('/', purchaseController.createPurchase);
router.get('/', purchaseController.getPurchases);
router.get('/:id', purchaseController.getPurchase);
router.put('/:id/status', purchaseController.updatePurchaseStatus);
router.delete('/:id', purchaseController.deletePurchase);

module.exports = router;
