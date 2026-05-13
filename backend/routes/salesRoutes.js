const express = require('express');
const router = express.Router();
const salesController = require('../controllers/salesController');

router.post('/', salesController.createInvoice);
router.get('/', salesController.getSales);

module.exports = router;
