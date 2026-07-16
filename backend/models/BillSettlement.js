const mongoose = require('mongoose');
const { enterpriseIntegrityPlugin } = require('./mixins/enterpriseMetaSchema');

/**
 * Bill-wise settlement for AR/AP (Sprint 3.5).
 * Tracks partial payments, advances, and adjustments against invoices.
 */
const BillSettlementSchema = new mongoose.Schema({
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
    index: true,
  },
  partyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Party',
    required: true,
    index: true,
  },
  partyLedgerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LedgerMaster',
  },
  billType: {
    type: String,
    enum: ['SalesInvoice', 'PurchaseBill', 'DebitNote', 'CreditNote', 'Advance'],
    required: true,
  },
  billId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true,
  },
  billNo: { type: String, default: '' },
  billDate: { type: Date, required: true },
  billAmount: { type: Number, required: true },
  settledAmount: { type: Number, default: 0 },
  outstandingAmount: { type: Number, required: true },
  dueDate: { type: Date },
  creditDays: { type: Number, default: 0 },
  followUpStatus: {
    type: String,
    enum: ['None', 'Called', 'Emailed', 'Promised', 'Disputed', 'Legal', 'Closed'],
    default: 'None',
  },
  followUpNotes: { type: String, default: '' },
  lastFollowUpAt: { type: Date },
  settlements: [{
    date: { type: Date, required: true },
    amount: { type: Number, required: true },
    mode: { type: String, default: '' },
    paymentVoucherId: { type: mongoose.Schema.Types.ObjectId, ref: 'PaymentVoucher' },
    accountingEntryId: { type: mongoose.Schema.Types.ObjectId, ref: 'AccountingEntry' },
    isAdvanceAdjustment: { type: Boolean, default: false },
    narration: String,
  }],
  status: {
    type: String,
    enum: ['Open', 'Partial', 'Settled', 'WrittenOff'],
    default: 'Open',
  },
}, { timestamps: true });

BillSettlementSchema.index({ companyId: 1, partyId: 1, status: 1 });
BillSettlementSchema.index({ companyId: 1, billType: 1, billId: 1 }, { unique: true });
BillSettlementSchema.plugin(enterpriseIntegrityPlugin, { softDelete: true, versionField: true });

module.exports = mongoose.model('BillSettlement', BillSettlementSchema);
