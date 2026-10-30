const asyncHandler = require('../utils/asyncHandler');
const { ok } = require('../utils/apiResponse');
const voucherSeriesAuditService = require('../services/voucherSeriesAuditService');
const duplicateEntryAuditService = require('../services/duplicateEntryAuditService');

const companyId = (req) => req.companyId || req.query.companyId;

exports.missingSeries = asyncHandler(async (req, res) => {
  return ok(res, await voucherSeriesAuditService.scan(companyId(req)));
});

exports.duplicateEntries = asyncHandler(async (req, res) => {
  return ok(res, await duplicateEntryAuditService.scan(companyId(req)));
});
