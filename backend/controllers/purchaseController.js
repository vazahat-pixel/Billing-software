const purchaseService = require('../services/purchaseService');
const billParseService = require('../services/billParseService');
const auditService = require('../services/auditService');
const asyncHandler = require('../utils/asyncHandler');
const { ok, created } = require('../utils/apiResponse');
const AppError = require('../utils/AppError');

exports.createPurchase = asyncHandler(async (req, res) => {
  const purchase = await purchaseService.createPurchase({ ...req.body, companyId: req.companyId });
  await auditService.log(req, 'CREATE_BILL', 'Purchase', purchase._id, null, {
    invoiceNo: purchase.invoiceNo,
    amount: purchase.netAmount,
  });
  return created(res, purchase, 'Purchase created');
});

exports.getPurchases = asyncHandler(async (req, res) => {
  if (!req.companyId) throw AppError.forbidden('No company context');
  const result = await purchaseService.getPurchases(req.companyId, req.query || {});
  const totalPages = Math.max(1, Math.ceil((result.total || 0) / (result.limit || 100)));
  return ok(res, result.purchases, '', {
    pagination: {
      page: result.page,
      limit: result.limit,
      total: result.total,
      totalPages,
    },
  });
});

exports.getPurchase = asyncHandler(async (req, res) => {
  if (!req.companyId) throw AppError.forbidden('No company context');
  const purchase = await purchaseService.getPurchaseById(req.params.id, req.companyId);
  if (!purchase) throw AppError.notFound('Purchase not found');
  return ok(res, purchase);
});

exports.updatePurchaseStatus = asyncHandler(async (req, res) => {
  if (!req.companyId) throw AppError.forbidden('No company context');
  const purchase = await purchaseService.updatePurchaseStatus(req.params.id, req.companyId, req.body.status);
  await auditService.log(req, 'UPDATE_STATUS', 'Purchase', purchase._id, null, { status: purchase.status });
  return ok(res, purchase, 'Status updated');
});

exports.deletePurchase = asyncHandler(async (req, res) => {
  if (!req.companyId) throw AppError.forbidden('No company context');
  const result = await purchaseService.deletePurchase(req.params.id, req.companyId);
  await auditService.log(req, 'DELETE_BILL', 'Purchase', req.params.id, result, null);
  return ok(res, result, 'Purchase cancelled');
});

/** Upload PDF/photo (or paste text) → extract supplier bill draft for Purchase entry */
exports.parseBill = asyncHandler(async (req, res) => {
  if (!req.companyId) throw AppError.forbidden('No company context');

  const pastedText = req.body?.text || req.body?.pastedText || '';
  const file = req.file;

  if (!file && !String(pastedText || '').trim()) {
    throw AppError.badRequest('Upload a bill PDF/photo or paste invoice text');
  }

  try {
    const draft = await billParseService.parseUploadedBill({
      companyId: req.companyId,
      buffer: file?.buffer,
      mimeType: file?.mimetype,
      originalName: file?.originalname,
      pastedText,
    });
    return ok(res, draft, 'Bill parsed');
  } catch (err) {
    if (err.statusCode === 422 || err.statusCode === 400) {
      throw AppError.badRequest(err.message, err.draft ? [{ draft: err.draft }] : []);
    }
    throw err;
  }
});
