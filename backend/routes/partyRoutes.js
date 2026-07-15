const express = require('express');
const router = express.Router();
const partyController = require('../controllers/partyController');
const { partyCreate, objectIdParam } = require('../validators');
const { requirePermission } = require('../middlewares/permission.middleware');

router.post('/', requirePermission('masters', 'create'), partyCreate, partyController.createParty);
router.get('/', requirePermission('masters', 'read'), partyController.getParties);
router.get('/search', requirePermission('masters', 'read'), partyController.searchParties);
router.get('/:id', requirePermission('masters', 'read'), objectIdParam, partyController.getParty);
router.put('/:id', requirePermission('masters', 'update'), objectIdParam, partyController.updateParty);
router.delete('/:id', requirePermission('masters', 'delete'), objectIdParam, partyController.deleteParty);

module.exports = router;
