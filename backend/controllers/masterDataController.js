const asyncHandler = require('../utils/asyncHandler');
const { ok } = require('../utils/apiResponse');
const masterDataService = require('../services/masterDataService');
const setupMasterService = require('../services/setupMasterService');

exports.mergeParties = asyncHandler(async (req, res) => {
  const data = await masterDataService.mergeParties(req.companyId, {
    ...req.body,
    userId: req.user?._id || req.user?.id,
  });
  return ok(res, data, 'Parties merged');
});

exports.mergeItems = asyncHandler(async (req, res) => {
  const data = await masterDataService.mergeItems(req.companyId, {
    ...req.body,
    userId: req.user?._id || req.user?.id,
  });
  return ok(res, data, 'Items merged');
});

exports.importMasters = asyncHandler(async (req, res) => {
  const data = await masterDataService.importMasters(req.companyId, {
    entity: req.body.entity,
    rows: req.body.rows || [],
    dryRun: req.body.dryRun !== false,
    userId: req.user?._id || req.user?.id,
  });
  return ok(res, data, data.dryRun ? 'Import dry-run completed' : 'Import applied');
});

exports.exportMasters = asyncHandler(async (req, res) => {
  const data = await masterDataService.exportMasters(req.companyId, req.query.entity || 'party');
  return ok(res, data);
});

exports.listFinancialYears = asyncHandler(async (req, res) => {
  return ok(res, await setupMasterService.listFinancialYears(req.companyId));
});

exports.createFinancialYear = asyncHandler(async (req, res) => {
  return ok(res, await setupMasterService.createFinancialYear(req.companyId, req.body), 'Financial year created');
});

exports.activateFinancialYear = asyncHandler(async (req, res) => {
  return ok(res, await setupMasterService.setActiveFinancialYear(req.params.id, req.companyId), 'Financial year activated');
});

exports.listVoucherSeries = asyncHandler(async (req, res) => {
  return ok(res, await setupMasterService.listVoucherSeries(req.companyId, { module: req.query.module }));
});

exports.createVoucherSeries = asyncHandler(async (req, res) => {
  return ok(res, await setupMasterService.createVoucherSeries(req.companyId, req.body), 'Voucher series created');
});
