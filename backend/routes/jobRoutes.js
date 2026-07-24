const express = require('express');
const router = express.Router();
const jobController = require('../controllers/jobController');
const { guard } = require('../utils/featureGuard');
const { requirePermission } = require('../middlewares/permission.middleware');

router.use(guard('jobWork'));

const read = requirePermission('jobWork', 'read');
const write = requirePermission('jobWork', 'create');
const update = requirePermission('jobWork', 'update');

router.post('/issue', write, jobController.issueToJob);
router.post('/receive', write, jobController.receiveFromJob);
router.put('/process', update, jobController.updateProcess);
router.get('/', read, jobController.getJobs);

module.exports = router;
