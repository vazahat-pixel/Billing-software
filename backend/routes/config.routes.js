const express = require('express');
const router = express.Router();
const configController = require('../controllers/config.controller');

router.get('/active', configController.getActiveConfig);
router.get('/version', configController.getConfigVersion);

module.exports = router;
