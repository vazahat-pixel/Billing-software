const express = require('express');
const router = express.Router();
const tdsController = require('../controllers/tdsController');
const { requirePermission } = require('../middlewares/permission.middleware');
const { guard } = require('../utils/featureGuard');

router.use(guard('accounting'));

const read = requirePermission('accounting', 'read');
const write = requirePermission('accounting', 'create');

router.get('/sections', read, tdsController.sections);
router.get('/report', read, tdsController.report);
router.get('/', read, tdsController.list);
router.post('/', write, tdsController.postTds);
router.post('/tcs', write, tdsController.postTcs);
router.post('/:id/certificate', write, tdsController.issueCertificate);

module.exports = router;
