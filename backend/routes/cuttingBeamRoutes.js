const express = require('express');
const router = express.Router();
const c = require('../controllers/cuttingBeamController');
const { requirePermission } = require('../middlewares/permission.middleware');
const { guard } = require('../utils/featureGuard');

router.use(guard('inventory'));
const read = requirePermission('inventory', 'read');
const write = requirePermission('inventory', 'create');

router.get('/cutting', read, c.listCutting);
router.post('/cutting', write, c.createCutting);
router.get('/beam', read, c.listBeam);
router.post('/beam', write, c.createBeam);

module.exports = router;
