const asyncHandler = require('../utils/asyncHandler');
const { ok, created } = require('../utils/apiResponse');
const inventoryEngineService = require('../services/inventoryEngineService');

exports.pipeline = asyncHandler(async (req, res) => {
  return ok(res, await inventoryEngineService.pipeline(req.companyId));
});

exports.availability = asyncHandler(async (req, res) => {
  return ok(
    res,
    await inventoryEngineService.getAvailability(req.companyId, {
      itemId: req.query.itemId,
      lotId: req.query.lotId,
      warehouseId: req.query.warehouseId,
    })
  );
});

exports.stockLedger = asyncHandler(async (req, res) => {
  return ok(
    res,
    await inventoryEngineService.stockLedger(req.companyId, {
      itemId: req.query.itemId,
      lotId: req.query.lotId,
      limit: req.query.limit,
    })
  );
});

exports.lotLedger = asyncHandler(async (req, res) => {
  return ok(res, await inventoryEngineService.lotLedger(req.companyId, req.params.id));
});

exports.valuation = asyncHandler(async (req, res) => {
  return ok(res, await inventoryEngineService.getValuation(req.companyId, req.params.id));
});

exports.lowStock = asyncHandler(async (req, res) => {
  return ok(res, await inventoryEngineService.lowStockAlerts(req.companyId));
});

exports.listReservations = asyncHandler(async (req, res) => {
  return ok(
    res,
    await inventoryEngineService.listReservations(req.companyId, { status: req.query.status })
  );
});

exports.reserveStock = asyncHandler(async (req, res) => {
  const uid = req.user?._id || req.user?.id || null;
  return created(res, await inventoryEngineService.reserveStock(req.companyId, req.body, uid));
});

exports.releaseReservation = asyncHandler(async (req, res) => {
  return ok(
    res,
    await inventoryEngineService.releaseReservation(req.companyId, req.params.id, req.body),
    req.body.consume ? 'Reservation consumed' : 'Reservation released'
  );
});

exports.listTransfers = asyncHandler(async (req, res) => {
  return ok(res, await inventoryEngineService.listTransfers(req.companyId));
});

exports.transferStock = asyncHandler(async (req, res) => {
  return created(res, await inventoryEngineService.transferStock(req.companyId, req.body));
});

exports.listAdjustments = asyncHandler(async (req, res) => {
  return ok(res, await inventoryEngineService.listAdjustments(req.companyId));
});

exports.createAdjustment = asyncHandler(async (req, res) => {
  const uid = req.user?._id || req.user?.id || null;
  return created(res, await inventoryEngineService.createAdjustment(req.companyId, req.body, uid));
});

exports.postAdjustment = asyncHandler(async (req, res) => {
  const uid = req.user?._id || req.user?.id || null;
  return ok(
    res,
    await inventoryEngineService.postAdjustment(req.companyId, req.params.id, uid),
    'Adjustment posted'
  );
});

exports.setLotHold = asyncHandler(async (req, res) => {
  return ok(
    res,
    await inventoryEngineService.setLotHold(
      req.companyId,
      req.params.id,
      req.body.holdStatus,
      req.body.remarks
    ),
    'Lot hold updated'
  );
});
