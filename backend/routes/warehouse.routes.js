const express = require('express');
const router = express.Router();
const warehouseController = require('../controllers/warehouseController');
const { requirePermission } = require('../middlewares/permission.middleware');
const { objectIdParam } = require('../validators');

router.get('/', requirePermission('masters', 'read'), warehouseController.list);
router.post('/', requirePermission('masters', 'create'), warehouseController.create);
router.put('/:id', requirePermission('masters', 'update'), objectIdParam, warehouseController.update);
router.delete('/:id', requirePermission('masters', 'delete'), objectIdParam, warehouseController.remove);

module.exports = router;

