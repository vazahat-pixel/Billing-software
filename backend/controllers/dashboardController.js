const dashboardService = require('../services/dashboardService');
const asyncHandler = require('../utils/asyncHandler');
const { ok } = require('../utils/apiResponse');
const AppError = require('../utils/AppError');

exports.getSummary = asyncHandler(async (req, res) => {
  if (!req.companyId) throw AppError.forbidden('No company context');
  const data = await dashboardService.getSummary(req.companyId);
  return ok(res, data);
});
