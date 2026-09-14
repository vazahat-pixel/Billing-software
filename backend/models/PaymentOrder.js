const mongoose = require('mongoose');

/**
 * SaaS payment orders — Razorpay (or manual admin mark-paid).
 * Never touches ERP sales/purchase documents.
 */
const paymentOrderSchema = new mongoose.Schema({
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
    index: true,
  },
  planId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Plan',
    required: true,
  },
  billingCycle: {
    type: String,
    enum: ['monthly', 'yearly'],
    required: true,
  },
  amountPaise: { type: Number, required: true, min: 0 },
  currency: { type: String, default: 'INR' },
  status: {
    type: String,
    enum: ['created', 'pending', 'paid', 'failed', 'cancelled'],
    default: 'created',
    index: true,
  },
  provider: {
    type: String,
    enum: ['razorpay', 'manual'],
    default: 'manual',
  },
  providerOrderId: { type: String, default: null, index: true },
  providerPaymentId: { type: String, default: null },
  providerSignature: { type: String, default: null },
  paidAt: { type: Date, default: null },
  meta: { type: mongoose.Schema.Types.Mixed, default: {} },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

module.exports = mongoose.model('PaymentOrder', paymentOrderSchema);
