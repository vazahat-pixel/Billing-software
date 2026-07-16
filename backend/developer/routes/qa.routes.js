const express = require('express');
const router = express.Router();
const qaController = require('../controllers/qaController');

router.use(qaController.devGuard);

router.post('/run-simulator', qaController.runSimulator);
router.get('/run/:runId', qaController.getRunStatus);
router.get('/health', qaController.health);
router.get('/readiness/latest', qaController.latestReadiness);

module.exports = router;
