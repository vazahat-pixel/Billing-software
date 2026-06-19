const express = require('express');
const router = express.Router();
const gstController = require('../controllers/gstController');
const { guard } = require('../utils/featureGuard');

router.use(guard('gst'));

router.get('/gstr1', gstController.getGstr1);
router.get('/gstr2', gstController.getGstr2);
router.get('/ca-dashboard', gstController.getCADashboard);

module.exports = router;
