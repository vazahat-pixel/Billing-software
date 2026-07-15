const express = require('express');
const router = express.Router();
const c = require('../controllers/productionEngineController');
const { requirePermission } = require('../middlewares/permission.middleware');
const { objectIdParam } = require('../validators');
const { guard } = require('../utils/featureGuard');

router.use(guard('jobWork'));

router.get('/pipeline', requirePermission('jobWork', 'read'), c.pipeline);
router.get('/board', requirePermission('jobWork', 'read'), c.statusBoard);
router.get('/jobs', requirePermission('jobWork', 'read'), c.listJobs);
router.get('/processes', requirePermission('jobWork', 'read'), c.listProcesses);

router.get('/chains', requirePermission('jobWork', 'read'), c.listChains);
router.post('/chains', requirePermission('jobWork', 'create'), c.createChain);

router.get('/mappings', requirePermission('jobWork', 'read'), c.listMappings);
router.get('/mappings/resolve', requirePermission('jobWork', 'read'), c.resolveMapping);
router.post('/mappings', requirePermission('jobWork', 'create'), c.createMapping);

router.post('/issue', requirePermission('jobWork', 'create'), c.issue);
router.post('/receive', requirePermission('jobWork', 'create'), c.receive);
router.post('/jobs/:id/advance', requirePermission('jobWork', 'update'), objectIdParam, c.advanceStep);
router.post('/jobs/:id/qc', requirePermission('jobWork', 'update'), objectIdParam, c.performQc);

module.exports = router;
