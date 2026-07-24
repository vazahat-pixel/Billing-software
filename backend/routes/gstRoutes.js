const express = require('express');
const router = express.Router();
const gstController = require('../controllers/gstController');
const stage4 = require('../controllers/stage4ComplianceController');
const { guard } = require('../utils/featureGuard');
const { requirePermission } = require('../middlewares/permission.middleware');

router.use(guard('gst'));

const read = requirePermission('gst', 'read');

router.get('/gstr1', read, gstController.getGstr1);
router.get('/gstr2', read, gstController.getGstr2);
router.get('/ca-dashboard', read, gstController.getCADashboard);
router.get('/gstr3b', read, stage4.gstr3b);
router.get('/hsn-summary', read, stage4.hsnSummary);
router.get('/dashboard', read, stage4.dashboard);
router.get('/config', read, stage4.getConfig);

module.exports = router;
