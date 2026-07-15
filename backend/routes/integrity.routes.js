const express = require('express');
const router = express.Router();
const integrityController = require('../controllers/integrityController');
const { requirePermission } = require('../middlewares/permission.middleware');

// Owner/admin diagnostics — soft permission (Sprint 1.2 style)
router.post(
  '/reconcile',
  requirePermission('reports', 'read'),
  integrityController.runFull
);
router.get(
  '/reconcile',
  requirePermission('reports', 'read'),
  integrityController.listRuns
);
router.get(
  '/reconcile/:id',
  requirePermission('reports', 'read'),
  integrityController.getRun
);

module.exports = router;
