const express = require('express');
const router = express.Router();
const inventoryController = require('../controllers/inventoryController');

router.get('/', inventoryController.getInventory);
router.get('/lots', inventoryController.getLotsByItem);
router.get('/lot/:lotId', inventoryController.getLotDetails);
router.get('/stock/:itemId', inventoryController.getItemStock);

module.exports = router;
