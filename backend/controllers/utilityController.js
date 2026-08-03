const asyncHandler = require('../utils/asyncHandler');
const { ok } = require('../utils/apiResponse');
const voucherSeriesAuditService = require('../services/voucherSeriesAuditService');

const companyId = (req) => req.companyId || req.query.companyId;

exports.missingSeries = asyncHandler(async (req, res) => {
  return ok(res, await voucherSeriesAuditService.scan(companyId(req)));
});
