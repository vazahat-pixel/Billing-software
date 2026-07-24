const express = require('express');
const router = express.Router();
const inventoryController = require('../controllers/inventoryController');
const { guard } = require('../utils/featureGuard');
const { requirePermission } = require('../middlewares/permission.middleware');

router.use(guard('inventory'));

const read = requirePermission('inventory', 'read');
const write = requirePermission('inventory', 'create');

router.post('/opening-stock', write, inventoryController.createOpeningStock);
router.get('/', read, inventoryController.getInventory);
router.get('/stock-summary', read, inventoryController.getStockSummary);
router.get('/lots', read, inventoryController.getLotsByItem);
router.get('/lot/:lotId', read, inventoryController.getLotDetails);
router.get('/stock/:itemId', read, inventoryController.getItemStock);

module.exports = router;
