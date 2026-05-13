const express = require('express');
const router = express.Router();
const ledgerController = require('../controllers/ledgerController');

router.get('/:partyId', ledgerController.getPartyLedger);
router.get('/balance/:partyId', ledgerController.getAccountBalance);

module.exports = router;
