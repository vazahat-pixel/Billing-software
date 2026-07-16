const express = require('express');
const router = express.Router();
const gstController = require('../controllers/gstController');
const stage4 = require('../controllers/stage4ComplianceController');
const { guard } = require('../utils/featureGuard');

router.use(guard('gst'));

// Legacy + Stage 4 deepened surface under /api/gst
router.get('/gstr1', gstController.getGstr1);
router.get('/gstr2', gstController.getGstr2);
router.get('/ca-dashboard', gstController.getCADashboard);

router.get('/gstr3b', stage4.gstr3b);
router.get('/hsn-summary', stage4.hsnSummary);
router.get('/dashboard', stage4.dashboard);
router.get('/config', stage4.getConfig);

module.exports = router;
