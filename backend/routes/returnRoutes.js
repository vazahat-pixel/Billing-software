const express = require('express');
const router = express.Router();
const returnController = require('../controllers/returnController');
const { guard } = require('../utils/featureGuard');
const { requirePermission } = require('../middlewares/permission.middleware');

router.use(guard('sales'));

const read = requirePermission('sales', 'read');
const write = requirePermission('sales', 'create');

router.get('/', read, returnController.getReturns);
router.post('/', write, returnController.createReturn);

module.exports = router;
