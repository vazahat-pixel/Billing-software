const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { guard } = require('../utils/featureGuard');
const { requirePermission } = require('../middlewares/permission.middleware');

router.use(guard('sales'));

const read = requirePermission('sales', 'read');
const write = requirePermission('sales', 'create');
const update = requirePermission('sales', 'update');

router.get('/', read, orderController.getOrders);
router.post('/', write, orderController.createOrder);
router.put('/:id/status', update, orderController.updateOrderStatus);

module.exports = router;
