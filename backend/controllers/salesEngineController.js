const asyncHandler = require('../utils/asyncHandler');
const { ok, created } = require('../utils/apiResponse');
const salesEngineService = require('../services/salesEngineService');

const uid = (req) => req.user?._id || req.user?.id || null;

exports.pipeline = asyncHandler(async (req, res) => {
  return ok(res, await salesEngineService.pipeline(req.companyId));
});

exports.listQuotations = asyncHandler(async (req, res) => {
  return ok(res, await salesEngineService.listQuotations(req.companyId, { status: req.query.status }));
});

exports.createQuotation = asyncHandler(async (req, res) => {
  return created(res, await salesEngineService.createQuotation(req.companyId, req.body));
});

exports.acceptQuotation = asyncHandler(async (req, res) => {
  const accept = req.body.accept !== false;
  return ok(
    res,
    await salesEngineService.acceptQuotation(req.companyId, req.params.id, accept),
    accept ? 'Quotation accepted' : 'Quotation rejected'
  );
});

exports.convertQuotation = asyncHandler(async (req, res) => {
  return created(
    res,
    await salesEngineService.convertQuotationToOrder(req.companyId, req.params.id, uid(req), req.body)
  );
});

exports.listOrders = asyncHandler(async (req, res) => {
  return ok(res, await salesEngineService.listSalesOrders(req.companyId, { status: req.query.status }));
});

exports.createOrder = asyncHandler(async (req, res) => {
  return created(res, await salesEngineService.createSalesOrder(req.companyId, req.body, uid(req)));
});

exports.approveOrder = asyncHandler(async (req, res) => {
  const approve = req.body.approve !== false;
  return ok(
    res,
    await salesEngineService.approveSalesOrder(req.companyId, req.params.id, uid(req), approve),
    approve ? 'Order approved & reserved' : 'Order rejected'
  );
});

exports.updatePacking = asyncHandler(async (req, res) => {
  return ok(
    res,
    await salesEngineService.updatePacking(req.companyId, req.params.id, req.body.packingStatus),
    'Packing updated'
  );
});

exports.listChallans = asyncHandler(async (req, res) => {
  return ok(
    res,
    await salesEngineService.listChallans(req.companyId, {
      status: req.query.status,
      orderId: req.query.orderId,
    })
  );
});

exports.createChallan = asyncHandler(async (req, res) => {
  return created(res, await salesEngineService.createChallanFromOrder(req.companyId, req.body), 'Challan dispatched');
});

exports.convertChallanToInvoice = asyncHandler(async (req, res) => {
  return created(
    res,
    await salesEngineService.convertChallanToInvoice(req.companyId, req.params.id, req.body),
    'Invoice created'
  );
});

exports.createDirectInvoice = asyncHandler(async (req, res) => {
  return created(res, await salesEngineService.createDirectInvoice(req.companyId, req.body));
});

exports.createSalesReturn = asyncHandler(async (req, res) => {
  return created(res, await salesEngineService.createSalesReturn(req.companyId, req.body), 'Sales return posted');
});
