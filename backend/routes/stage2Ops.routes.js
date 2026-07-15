const express = require('express');
const router = express.Router();
const c = require('../controllers/stage2OpsController');
const { requirePermission } = require('../middlewares/permission.middleware');
const { objectIdParam } = require('../validators');

router.get('/pipeline', requirePermission('sales', 'read'), c.stage2Pipeline);

// Documents 2.7
router.get('/documents/pipeline', requirePermission('sales', 'read'), c.docPipeline);
router.post('/documents/seed', requirePermission('sales', 'create'), c.docSeed);
router.get('/documents/templates', requirePermission('sales', 'read'), c.docListTemplates);
router.get('/documents/payload', requirePermission('sales', 'read'), c.docPayload);
router.post('/documents/payload', requirePermission('sales', 'read'), c.docPayload);
router.get('/documents/labels/:id', requirePermission('inventory', 'read'), objectIdParam, c.docLabel);
router.post('/documents/send', requirePermission('sales', 'create'), c.docSend);

// Workflow 2.8
router.get('/workflow/pipeline', requirePermission('sales', 'read'), c.wfPipeline);
router.post('/workflow/seed', requirePermission('sales', 'create'), c.wfSeed);
router.get('/workflow/definitions', requirePermission('sales', 'read'), c.wfListDefs);
router.get('/workflow/instances', requirePermission('sales', 'read'), c.wfList);
router.post('/workflow/start', requirePermission('sales', 'create'), c.wfStart);
router.post('/workflow/:id/decide', requirePermission('sales', 'update'), objectIdParam, c.wfDecide);
router.post('/workflow/:id/comments', requirePermission('sales', 'update'), objectIdParam, c.wfComment);
router.post('/workflow/escalate', requirePermission('sales', 'update'), c.wfEscalate);
router.post('/workflow/credit-check', requirePermission('sales', 'read'), c.wfCreditCheck);

// Validation 2.9
router.post('/validate', requirePermission('sales', 'read'), c.validate);

// Certification 2.10
router.post('/certification/run', requirePermission('sales', 'create'), c.certRun);
router.get('/certification/latest', requirePermission('sales', 'read'), c.certLatest);
router.get('/certification', requirePermission('sales', 'read'), c.certList);

module.exports = router;
