const asyncHandler = require('../utils/asyncHandler');
const { ok } = require('../utils/apiResponse');
const AppError = require('../utils/AppError');
const reconciliationService = require('../services/reconciliationService');
const ReconciliationRun = require('../models/ReconciliationRun');

exports.runFull = asyncHandler(async (req, res) => {
  if (!req.companyId) throw AppError.forbidden('No company context');
  const run = await reconciliationService.runFull(req.companyId, {
    triggeredBy: req.user?._id || req.user?.id || null,
  });
  return ok(res, run, 'Reconciliation completed');
});

exports.listRuns = asyncHandler(async (req, res) => {
  if (!req.companyId) throw AppError.forbidden('No company context');
  const runs = await ReconciliationRun.find({ companyId: req.companyId })
    .sort({ createdAt: -1 })
    .limit(20)
    .lean();
  return ok(res, runs);
});

exports.getRun = asyncHandler(async (req, res) => {
  if (!req.companyId) throw AppError.forbidden('No company context');
  const run = await ReconciliationRun.findOne({ _id: req.params.id, companyId: req.companyId }).lean();
  if (!run) throw AppError.notFound('Reconciliation run not found');
  return ok(res, run);
});
