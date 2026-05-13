const express = require('express');
const router = express.Router();
const jobController = require('../controllers/jobController');

router.post('/issue', jobController.issueToJob);
router.post('/receive', jobController.receiveFromJob);
router.put('/process', jobController.updateProcess);
router.get('/', jobController.getJobs);

module.exports = router;
