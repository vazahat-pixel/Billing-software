const asyncHandler = require('../utils/asyncHandler');
const { ok, created } = require('../utils/apiResponse');
const warehouseService = require('../services/warehouseService');

exports.list = asyncHandler(async (req, res) => {
  const data = await warehouseService.list(req.companyId, {
    type: req.query.type,
    parentId: req.query.parentId,
  });
  return ok(res, data);
});

exports.create = asyncHandler(async (req, res) => {
  const data = await warehouseService.create(req.companyId, req.body);
  return created(res, data, 'Warehouse created');
});

exports.update = asyncHandler(async (req, res) => {
  const data = await warehouseService.update(req.params.id, req.companyId, req.body);
  return ok(res, data, 'Warehouse updated');
});

exports.remove = asyncHandler(async (req, res) => {
  const data = await warehouseService.softDelete(req.params.id, req.companyId);
  return ok(res, data, 'Warehouse deleted');
});
