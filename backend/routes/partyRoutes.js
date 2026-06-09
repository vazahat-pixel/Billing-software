const express = require('express');
const router = express.Router();
const partyController = require('../controllers/partyController');

router.post('/', partyController.createParty);
router.get('/', partyController.getParties);
router.get('/search', partyController.searchParties);
router.get('/:id', partyController.getParty);
router.put('/:id', partyController.updateParty);
router.delete('/:id', partyController.deleteParty);

module.exports = router;
