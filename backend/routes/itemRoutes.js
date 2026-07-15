const express = require('express');
const router = express.Router();
const itemController = require('../controllers/itemController');
const { itemCreate, objectIdParam } = require('../validators');
const { requirePermission } = require('../middlewares/permission.middleware');

router.post('/', requirePermission('masters', 'create'), itemCreate, itemController.createItem);
router.get('/', requirePermission('masters', 'read'), itemController.getItems);
router.get('/search', requirePermission('masters', 'read'), itemController.searchItems);
router.get('/:id', requirePermission('masters', 'read'), objectIdParam, itemController.getItem);
router.put('/:id', requirePermission('masters', 'update'), objectIdParam, itemController.updateItem);
router.delete('/:id', requirePermission('masters', 'delete'), objectIdParam, itemController.deleteItem);

module.exports = router;
