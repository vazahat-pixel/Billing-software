const billingService = require('../services/billingService');
const asyncHandler = require('../utils/asyncHandler');
const { ok, created } = require('../utils/apiResponse');

/** Public — no auth */
exports.listPublicPlans = asyncHandler(async (req, res) => {
  const plans = await billingService.listPublicPlans();
  return ok(res, { plans, paymentReady: billingService.isRazorpayConfigured() });
});

/** Tenant — auth + subscription middleware */
exports.getMyBilling = asyncHandler(async (req, res) => {
  const data = await billingService.getTenantBilling(req.companyId || req.user.companyId);
  return ok(res, data);
});

exports.createCheckout = asyncHandler(async (req, res) => {
  const companyId = req.companyId || req.user.companyId;
  const { planId, billingCycle } = req.body || {};
  if (!planId) {
    return res.status(400).json({ message: 'planId is required' });
  }
  const result = await billingService.createCheckoutOrder(companyId, {
    planId,
    billingCycle,
    userId: req.user._id || req.user.id,
  });
  return created(res, result);
});

exports.confirmCheckout = asyncHandler(async (req, res) => {
  const companyId = req.companyId || req.user.companyId;
  const {
    orderId,
    razorpay_order_id: providerOrderId,
    razorpay_payment_id: providerPaymentId,
    razorpay_signature: providerSignature,
  } = req.body || {};
  const result = await billingService.confirmPayment(companyId, {
    orderId,
    providerOrderId,
    providerPaymentId,
    providerSignature,
  });
  return ok(res, result);
});

/** Super-admin */
exports.adminMarkPaid = asyncHandler(async (req, res) => {
  const result = await billingService.adminMarkPaid(req.params.orderId, req.user._id || req.user.id);
  return ok(res, result);
});

exports.adminListOrders = asyncHandler(async (req, res) => {
  const PaymentOrder = require('../models/PaymentOrder');
  const q = {};
  if (req.query.companyId) q.companyId = req.query.companyId;
  if (req.query.status) q.status = req.query.status;
  const orders = await PaymentOrder.find(q)
    .sort({ createdAt: -1 })
    .limit(100)
    .populate('companyId', 'name')
    .populate('planId', 'name priceMonthly priceYearly')
    .lean();
  return ok(res, { orders });
});
