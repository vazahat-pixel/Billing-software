const salesService = require('../services/salesService');
const auditService = require('../services/auditService');
const asyncHandler = require('../utils/asyncHandler');
const { ok, created } = require('../utils/apiResponse');
const AppError = require('../utils/AppError');

exports.createInvoice = asyncHandler(async (req, res) => {
  const sales = await salesService.createInvoice({ ...req.body, companyId: req.companyId });
  await auditService.log(req, 'CREATE_INVOICE', 'Sales', sales._id, null, {
    invoiceNo: sales.invoiceNo,
    amount: sales.netAmount,
  });
  return created(res, sales, 'Sales invoice created');
});

exports.getSales = asyncHandler(async (req, res) => {
  if (!req.companyId) throw AppError.forbidden('No company context');
  const result = await salesService.getSales(req.companyId, req.query || {});
  const totalPages = Math.max(1, Math.ceil((result.total || 0) / (result.limit || 100)));
  return ok(res, result.sales, '', {
    pagination: {
      page: result.page,
      limit: result.limit,
      total: result.total,
      totalPages,
    },
  });
});

exports.getSale = asyncHandler(async (req, res) => {
  if (!req.companyId) throw AppError.forbidden('No company context');
  const sale = await salesService.getSaleById(req.params.id, req.companyId);
  if (!sale) throw AppError.notFound('Sale not found');
  return ok(res, sale);
});

exports.updateSaleStatus = asyncHandler(async (req, res) => {
  if (!req.companyId) throw AppError.forbidden('No company context');
  const sale = await salesService.updateSaleStatus(req.params.id, req.companyId, req.body.status);
  await auditService.log(req, 'UPDATE_STATUS', 'Sales', sale._id, null, { status: sale.status });
  return ok(res, sale, 'Status updated');
});

exports.deleteSale = asyncHandler(async (req, res) => {
  if (!req.companyId) throw AppError.forbidden('No company context');
  const result = await salesService.deleteSale(req.params.id, req.companyId);
  await auditService.log(req, 'DELETE_INVOICE', 'Sales', req.params.id, result, null);
  return ok(res, result, 'Invoice cancelled');
});
