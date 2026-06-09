const express = require('express');
const router = express.Router();
const subMasterController = require('../controllers/subMasterController');

router.get('/', subMasterController.getSubMasters);
router.post('/', subMasterController.createSubMaster);
router.put('/:id', subMasterController.updateSubMaster);
router.delete('/:id', subMasterController.deleteSubMaster);

module.exports = router;
