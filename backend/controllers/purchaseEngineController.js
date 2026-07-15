const asyncHandler = require('../utils/asyncHandler');
const { ok, created } = require('../utils/apiResponse');
const purchaseEngineService = require('../services/purchaseEngineService');

const uid = (req) => req.user?._id || req.user?.id || null;

exports.pipeline = asyncHandler(async (req, res) => {
  return ok(res, await purchaseEngineService.pipeline(req.companyId));
});

// Indent
exports.listIndents = asyncHandler(async (req, res) => {
  return ok(res, await purchaseEngineService.listIndents(req.companyId, { status: req.query.status }));
});
exports.createIndent = asyncHandler(async (req, res) => {
  return created(res, await purchaseEngineService.createIndent(req.companyId, req.body, uid(req)));
});
exports.submitIndent = asyncHandler(async (req, res) => {
  return ok(res, await purchaseEngineService.submitIndent(req.params.id, req.companyId), 'Indent submitted');
});
exports.approveIndent = asyncHandler(async (req, res) => {
  const approve = req.body.approve !== false;
  return ok(
    res,
    await purchaseEngineService.approveIndent(req.params.id, req.companyId, uid(req), approve),
    approve ? 'Indent approved' : 'Indent rejected'
  );
});

// Quotation
exports.listQuotations = asyncHandler(async (req, res) => {
  return ok(
    res,
    await purchaseEngineService.listQuotations(req.companyId, {
      indentId: req.query.indentId,
      supplierId: req.query.supplierId,
    })
  );
});
exports.createQuotation = asyncHandler(async (req, res) => {
  return created(res, await purchaseEngineService.createQuotation(req.companyId, req.body));
});
exports.compareQuotations = asyncHandler(async (req, res) => {
  return ok(res, await purchaseEngineService.compareQuotations(req.companyId, req.params.indentId));
});
exports.selectQuotation = asyncHandler(async (req, res) => {
  return ok(res, await purchaseEngineService.selectQuotation(req.companyId, req.params.id), 'Quotation selected');
});

// PO
exports.listPurchaseOrders = asyncHandler(async (req, res) => {
  return ok(res, await purchaseEngineService.listPurchaseOrders(req.companyId, { status: req.query.status }));
});
exports.createPurchaseOrder = asyncHandler(async (req, res) => {
  return created(res, await purchaseEngineService.createPurchaseOrder(req.companyId, req.body, uid(req)));
});
exports.approvePurchaseOrder = asyncHandler(async (req, res) => {
  const approve = req.body.approve !== false;
  return ok(
    res,
    await purchaseEngineService.approvePurchaseOrder(req.params.id, req.companyId, uid(req), approve),
    approve ? 'PO approved' : 'PO rejected'
  );
});

// GRN + QC + Convert
exports.listGrns = asyncHandler(async (req, res) => {
  return ok(
    res,
    await purchaseEngineService.listGrns(req.companyId, {
      purchaseOrderId: req.query.purchaseOrderId,
      status: req.query.status,
    })
  );
});
exports.createGrn = asyncHandler(async (req, res) => {
  return created(res, await purchaseEngineService.createGrnFromPo(req.companyId, req.body), 'GRN created');
});
exports.performQc = asyncHandler(async (req, res) => {
  return ok(
    res,
    await purchaseEngineService.performQc(req.companyId, req.params.id, {
      items: req.body.items || [],
      userId: uid(req),
    }),
    'QC recorded'
  );
});
exports.convertGrnToInvoice = asyncHandler(async (req, res) => {
  const result = await purchaseEngineService.convertGrnToInvoice(
    req.companyId,
    req.params.id,
    req.body || {},
    uid(req)
  );
  return created(res, result, 'Purchase invoice created from GRN');
});
