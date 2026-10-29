const express = require('express');
const router = express.Router();
const asyncHandler = require('../utils/asyncHandler');
const { ok } = require('../utils/apiResponse');
const AppError = require('../utils/AppError');
const { requirePermission } = require('../middlewares/permission.middleware');
const svc = require('../services/migration/migrationService');

const write = requirePermission('masters', 'create');
const read = requirePermission('masters', 'read');
const userId = (req) => req.user?._id || req.user?.id;
const brief = (run) => ({ id: run._id, status: run.status, source: run.source, progress: run.progress, problems: run.problems, header: run.header, summary: run.summary && { blockers: run.summary.blockers, counts: run.summary.counts, expected: run.summary.expected, warningCount: run.summary.warningCount, years: run.summary.years },
  error: run.error, uploadedBytes: run.uploadedBytes, appliedAt: run.appliedAt, undoneAt: run.undoneAt, reconciled: run.reconciliation ? { ok: run.reconciliation.ok, matched: run.reconciliation.matched, mismatched: run.reconciliation.mismatched } : null, createdAt: run.createdAt });

router.post('/runs', write, asyncHandler(async (req, res) => {
  const run = await svc.createRun({ companyId: req.companyId, userId: userId(req), source: req.body?.source || 'JSM' });
  return ok(res, brief(run), 'Import started');
}));

// one chunk of the package file (<= 8 MB each; the reverse proxy allows 10 MB)
router.put('/runs/:id/chunk', write, express.raw({ type: 'application/octet-stream', limit: '9mb' }), asyncHandler(async (req, res) => {
  const run = await svc.getRun(req.companyId, req.params.id);
  if (!Buffer.isBuffer(req.body) || !req.body.length) throw AppError.badRequest('Empty chunk');
  await svc.appendChunk(run, Number(req.query.index), req.body);
  return ok(res, brief(run));
}));

router.post('/runs/:id/complete', write, asyncHandler(async (req, res) => {
  const run = await svc.getRun(req.companyId, req.params.id);
  await svc.completeUpload(run, { expectedBytes: req.body?.bytes });
  return ok(res, brief(run), run.status === 'uploaded' ? 'Package received' : 'Package is incomplete');
}));

router.get('/runs', read, asyncHandler(async (req, res) => {
  const { MigrationRun } = require('../models/MigrationRun');
  const list = await MigrationRun.find({ companyId: req.companyId }).sort({ createdAt: -1 }).limit(20);
  return ok(res, list.map(brief));
}));
router.get('/runs/:id', read, asyncHandler(async (req, res) => ok(res, brief(await svc.getRun(req.companyId, req.params.id)))));

router.post('/runs/:id/preview', write, asyncHandler(async (req, res) => {
  const run = await svc.getRun(req.companyId, req.params.id);
  return ok(res, await svc.preview(run, { years: req.body?.years }));
}));

// applies in the background (minutes for big data); poll GET /runs/:id for progress
router.post('/runs/:id/apply', write, asyncHandler(async (req, res) => {
  const run = await svc.getRun(req.companyId, req.params.id);
  await svc.assertCompanyEmpty(req.companyId);
  if (run.status !== 'uploaded') throw AppError.badRequest('This import is not ready to apply');
  const years = req.body?.years;
  setImmediate(() => svc.apply(run, { years }).catch((e) => console.error('Migration apply failed:', e.message)));
  return ok(res, brief(run), 'Import running');
}));

router.post('/runs/:id/reconcile', write, asyncHandler(async (req, res) => {
  const run = await svc.getRun(req.companyId, req.params.id);
  return ok(res, await svc.reconcile(run));
}));
router.get('/runs/:id/report.csv', read, asyncHandler(async (req, res) => {
  const run = await svc.getRun(req.companyId, req.params.id);
  if (!run.reconciliation) throw AppError.badRequest('Run the reconciliation first');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="import-reconciliation-${run._id}.csv"`);
  return res.send(svc.reportCsv(run.reconciliation));
}));

router.post('/runs/:id/undo', write, asyncHandler(async (req, res) => {
  const run = await svc.getRun(req.companyId, req.params.id);
  await svc.undo(run);
  return ok(res, brief(run), 'Import undone');
}));

module.exports = router;
