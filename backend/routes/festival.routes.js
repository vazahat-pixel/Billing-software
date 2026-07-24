const express = require('express');
const router = express.Router();
const festivalController = require('../controllers/festival.controller');
const configController = require('../controllers/config.controller');

router.get('/', festivalController.list);
router.get('/active', festivalController.active);
router.get('/:year', festivalController.getYear);
router.put('/:year', configController.requireCompanyAdmin, festivalController.upsertYear);

module.exports = router;
