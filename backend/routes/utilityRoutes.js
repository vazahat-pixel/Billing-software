const express = require('express');
const router = express.Router();
const utilityController = require('../controllers/utilityController');
const { requirePermission } = require('../middlewares/permission.middleware');
const { guard } = require('../utils/featureGuard');

router.use(guard('accounting'));
const read = requirePermission('accounting', 'read');

router.get('/missing-series', read, utilityController.missingSeries);
router.get('/duplicate-entries', read, utilityController.duplicateEntries);

module.exports = router;
