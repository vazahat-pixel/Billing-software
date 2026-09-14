/**
 * SaaS billing — subscription renew / upgrade via Razorpay or manual admin settle.
 * Isolated from ERP invoice/tax logic.
 */
const crypto = require('crypto');
const Plan = require('../models/Plan');
const Company = require('../models/Company');
const Subscription = require('../models/Subscription');
const License = require('../models/License');
const PaymentOrder = require('../models/PaymentOrder');
const entitlementService = require('./entitlementService');
const { POLICY_SAAS } = require('../utils/commercialPolicy');
const AppError = require('../utils/AppError');
const logger = require('../utils/logger');

const rupeesToPaise = (n) => Math.round(Number(n || 0) * 100);

function isRazorpayConfigured() {
  return !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
}

function getRazorpay() {
  if (!isRazorpayConfigured()) return null;
  // Lazy require — package may be absent until operator installs it.
  // eslint-disable-next-line global-require, import/no-extraneous-dependencies
  const Razorpay = require('razorpay');
  return new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
}

async function listPublicPlans() {
  return Plan.find({ isActive: true, isPublic: true })
    .sort({ sortOrder: 1, priceMonthly: 1 })
    .select('name slug description priceMonthly priceYearly features limits trialDays sortOrder')
    .lean();
}

async function getTenantBilling(companyId) {
  const [company, subscription, license, plans, recentOrders] = await Promise.all([
    Company.findById(companyId).populate('planId').lean(),
    Subscription.findOne({ companyId }).populate('planId').lean(),
    License.findOne({ companyId, isActive: true }).lean(),
    listPublicPlans(),
    PaymentOrder.find({ companyId }).sort({ createdAt: -1 }).limit(20).lean(),
  ]);
  const ent = await entitlementService.resolve(companyId);
  return {
    company: {
      id: company?._id,
      name: company?.name,
      commercialPolicy: company?.commercialPolicy || 'legacy_open',
      plan: company?.planId || null,
    },
    subscription,
    license: license
      ? { expiresAt: license.expiresAt, isActive: license.isActive, maxDevices: license.maxDevices }
      : null,
    entitlement: {
      status: ent.status,
      daysLeft: ent.daysLeft,
      limits: ent.limits,
      modules: ent.modules,
    },
    plans,
    orders: recentOrders,
    payment: {
      provider: isRazorpayConfigured() ? 'razorpay' : 'manual',
      razorpayKeyId: isRazorpayConfigured() ? process.env.RAZORPAY_KEY_ID : null,
    },
  };
}

async function createCheckoutOrder(companyId, { planId, billingCycle = 'monthly', userId = null }) {
  const plan = await Plan.findById(planId);
  if (!plan || !plan.isActive) throw AppError.badRequest('Plan not found or inactive');

  const cycle = billingCycle === 'yearly' ? 'yearly' : 'monthly';
  const amountRupees = cycle === 'yearly' ? plan.priceYearly : plan.priceMonthly;
  const amountPaise = rupeesToPaise(amountRupees);
  if (amountPaise < 0) throw AppError.badRequest('Invalid plan price');

  const order = await PaymentOrder.create({
    companyId,
    planId: plan._id,
    billingCycle: cycle,
    amountPaise,
    currency: 'INR',
    status: amountPaise === 0 ? 'paid' : 'created',
    provider: isRazorpayConfigured() && amountPaise > 0 ? 'razorpay' : 'manual',
    createdBy: userId,
    paidAt: amountPaise === 0 ? new Date() : null,
  });

  if (amountPaise === 0) {
    await applyPaidOrder(order);
    return { order, checkout: null, applied: true };
  }

  const rzp = getRazorpay();
  if (!rzp) {
    order.status = 'pending';
    order.meta = { ...(order.meta || {}), note: 'Awaiting admin mark-paid (Razorpay not configured)' };
    await order.save();
    return {
      order,
      checkout: null,
      applied: false,
      message: 'Payment order created. Admin will confirm after offline payment, or configure Razorpay.',
    };
  }

  try {
    const rzOrder = await rzp.orders.create({
      amount: amountPaise,
      currency: 'INR',
      receipt: String(order._id),
      notes: { companyId: String(companyId), planId: String(plan._id), cycle },
    });
    order.providerOrderId = rzOrder.id;
    order.status = 'pending';
    await order.save();
    return {
      order,
      checkout: {
        key: process.env.RAZORPAY_KEY_ID,
        amount: amountPaise,
        currency: 'INR',
        orderId: rzOrder.id,
        name: plan.name,
        description: `${plan.name} — ${cycle}`,
      },
      applied: false,
    };
  } catch (err) {
    logger.error('billing.razorpay.order_failed', { error: err.message, companyId: String(companyId) });
    order.provider = 'manual';
    order.status = 'pending';
    order.meta = { ...(order.meta || {}), razorpayError: err.message };
    await order.save();
    return {
      order,
      checkout: null,
      applied: false,
      message: 'Razorpay unavailable — order queued for manual confirmation.',
    };
  }
}

function verifyRazorpaySignature({ orderId, paymentId, signature }) {
  const secret = process.env.RAZORPAY_KEY_SECRET || '';
  const body = `${orderId}|${paymentId}`;
  const expected = crypto.createHmac('sha256', secret).update(body).digest('hex');
  return expected === signature;
}

async function applyPaidOrder(orderDoc) {
  const order = orderDoc.toObject ? orderDoc : orderDoc;
  const companyId = order.companyId;
  const planId = order.planId;
  const cycle = order.billingCycle || 'monthly';
  const months = cycle === 'yearly' ? 12 : 1;

  const start = new Date();
  const end = new Date(start);
  end.setMonth(end.getMonth() + months);

  await Subscription.findOneAndUpdate(
    { companyId },
    {
      companyId,
      planId,
      status: 'active',
      startDate: start,
      endDate: end,
      billingCycle: cycle,
      autoRenew: true,
      lastPaymentAt: new Date(),
      offlineModeEnabled: true,
    },
    { upsert: true, new: true }
  );

  let license = await License.findOne({ companyId, isActive: true });
  if (license) {
    license.expiresAt = end;
    await license.save();
  } else {
    const { generateLicenseKey } = require('../utils/license');
    const crypto = require('crypto');
    const key = generateLicenseKey(companyId);
    await License.create({
      companyId,
      licenseKey: key,
      expiresAt: end,
      isActive: true,
      checksum: crypto.createHash('sha256').update(`${companyId}-PAID`).digest('hex').substring(0, 8).toUpperCase(),
    });
    await Company.findByIdAndUpdate(companyId, { licenseKey: key });
  }

  await Company.findByIdAndUpdate(companyId, {
    planId,
    status: 'active',
    isActive: true,
    commercialPolicy: POLICY_SAAS,
  });

  try {
    const dunningService = require('./dunningService');
    if (typeof dunningService.clearDunningFlags === 'function') {
      await dunningService.clearDunningFlags(companyId);
    }
  } catch { /* optional */ }

  entitlementService.invalidate(companyId);
  return { start, end, planId, cycle };
}

async function confirmPayment(companyId, {
  orderId,
  providerOrderId,
  providerPaymentId,
  providerSignature,
  markManual = false,
}) {
  const order = await PaymentOrder.findOne({ _id: orderId, companyId });
  if (!order) throw AppError.notFound('Payment order not found');
  if (order.status === 'paid') return { alreadyPaid: true, order };

  if (markManual) {
    order.status = 'paid';
    order.provider = 'manual';
    order.paidAt = new Date();
    await order.save();
    const applied = await applyPaidOrder(order);
    return { order, applied };
  }

  if (!providerOrderId || !providerPaymentId || !providerSignature) {
    throw AppError.badRequest('Missing Razorpay payment fields');
  }
  if (order.providerOrderId && order.providerOrderId !== providerOrderId) {
    throw AppError.badRequest('Order id mismatch');
  }
  if (!verifyRazorpaySignature({
    orderId: providerOrderId,
    paymentId: providerPaymentId,
    signature: providerSignature,
  })) {
    order.status = 'failed';
    await order.save();
    throw AppError.forbidden('Invalid payment signature');
  }

  order.status = 'paid';
  order.providerPaymentId = providerPaymentId;
  order.providerSignature = providerSignature;
  order.paidAt = new Date();
  await order.save();
  const applied = await applyPaidOrder(order);
  return { order, applied };
}

async function adminMarkPaid(orderId, adminUserId) {
  const order = await PaymentOrder.findById(orderId);
  if (!order) throw AppError.notFound('Payment order not found');
  if (order.status === 'paid') return { alreadyPaid: true, order };
  order.status = 'paid';
  order.provider = 'manual';
  order.paidAt = new Date();
  order.meta = { ...(order.meta || {}), markedPaidBy: String(adminUserId || '') };
  await order.save();
  const applied = await applyPaidOrder(order);
  return { order, applied };
}

module.exports = {
  isRazorpayConfigured,
  listPublicPlans,
  getTenantBilling,
  createCheckoutOrder,
  confirmPayment,
  adminMarkPaid,
  applyPaidOrder,
};
