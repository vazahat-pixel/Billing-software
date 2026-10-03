const asyncHandler = require('../utils/asyncHandler');
const { ok } = require('../utils/apiResponse');
const masterDataService = require('../services/masterDataService');
const setupMasterService = require('../services/setupMasterService');
const dataImportService = require('../services/dataImportService');

exports.mergeParties = asyncHandler(async (req, res) => {
  const { sourceId, targetId } = req.body;
  const result = await masterDataService.mergeParties(req.companyId, {
    sourceId,
    targetId,
    userId: req.user?._id || req.user?.id,
  });
  return ok(res, result, 'Parties merged successfully');
});

exports.mergeItems = asyncHandler(async (req, res) => {
  const { sourceId, targetId } = req.body;
  const result = await masterDataService.mergeItems(req.companyId, {
    sourceId,
    targetId,
    userId: req.user?._id || req.user?.id,
  });
  return ok(res, result, 'Items merged successfully');
});

exports.suggestMappings = asyncHandler(async (req, res) => {
  const { headers, entity } = req.body;
  const result = dataImportService.suggestMappings(headers || [], entity || 'auto');
  return ok(res, result, 'Mappings suggested');
});

exports.previewImport = asyncHandler(async (req, res) => {
  const { entity, rows, columnMappings } = req.body;
  const data = await dataImportService.preview({
    companyId: req.companyId,
    entity: entity || 'item',
    rows: rows || [],
    columnMappings: columnMappings || {},
  });
  return ok(res, data, 'Import preview generated');
});

exports.executeImport = asyncHandler(async (req, res) => {
  const { entity, rows, columnMappings, options } = req.body;
  const data = await dataImportService.execute({
    companyId: req.companyId,
    entity: entity || 'item',
    rows: rows || [],
    columnMappings: columnMappings || {},
    options: options || {},
    userId: req.user?._id || req.user?.id,
  });
  return ok(res, data, 'Import executed successfully');
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
