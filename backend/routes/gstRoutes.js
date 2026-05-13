const express = require('express');
const router = express.Router();
const gstController = require('../controllers/gstController');

router.get('/gstr1', gstController.getGstr1);
router.get('/gstr2', gstController.getGstr2);

module.exports = router;
