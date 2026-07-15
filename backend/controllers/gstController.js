const gstService = require('../services/gstService');
const asyncHandler = require('../utils/asyncHandler');
const { ok } = require('../utils/apiResponse');
const AppError = require('../utils/AppError');

exports.getGstr1 = asyncHandler(async (req, res) => {
  if (!req.companyId) throw AppError.forbidden('No company context');
  const { startDate, endDate } = req.query;
  const data = await gstService.getGstr1(req.companyId, startDate, endDate);
  return ok(res, data);
});

exports.getGstr2 = asyncHandler(async (req, res) => {
  if (!req.companyId) throw AppError.forbidden('No company context');
  const { startDate, endDate } = req.query;
  const data = await gstService.getGstr2(req.companyId, startDate, endDate);
  return ok(res, data);
});

exports.getCADashboard = asyncHandler(async (req, res) => {
  if (!req.companyId) throw AppError.forbidden('No company context');
  const { startDate, endDate } = req.query;
  const data = await gstService.getCADashboard(req.companyId, startDate, endDate);
  res.set('Cache-Control', 'private, max-age=10');
  return ok(res, data);
});
