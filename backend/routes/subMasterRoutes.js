const express = require('express');
const router = express.Router();
const subMasterController = require('../controllers/subMasterController');
const { requirePermission } = require('../middlewares/permission.middleware');

const read = requirePermission('masters', 'read');
const write = requirePermission('masters', 'create');
const update = requirePermission('masters', 'update');
const del = requirePermission('masters', 'delete');

router.get('/', read, subMasterController.getSubMasters);
router.post('/', write, subMasterController.createSubMaster);
router.put('/:id', update, subMasterController.updateSubMaster);
router.delete('/:id', del, subMasterController.deleteSubMaster);

module.exports = router;
