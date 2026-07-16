const mongoose = require('mongoose');
const { enterpriseIntegrityPlugin } = require('./mixins/enterpriseMetaSchema');

/**
 * Cheque / NEFT / RTGS / UPI instrument register (Sprint 3.4).
 */
const BankInstrumentSchema = new mongoose.Schema({
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
    index: true,
  },
  instrumentType: {
    type: String,
    enum: ['Cheque', 'NEFT', 'RTGS', 'UPI', 'IMPS', 'Cash', 'Other'],
    required: true,
  },
  direction: {
    type: String,
    enum: ['Issued', 'Received'],
    required: true,
  },
  instrumentNo: { type: String, required: true, trim: true },
  instrumentDate: { type: Date, required: true },
  amount: { type: Number, required: true, min: 0.01 },
  bankLedgerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LedgerMaster',
    required: true,
  },
  partyLedgerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LedgerMaster',
  },
  partyName: { type: String, default: '' },
  status: {
    type: String,
    enum: ['Pending', 'Cleared', 'Bounced', 'Cancelled', 'Deposited'],
    default: 'Pending',
  },
  clearedDate: { type: Date },
  bounceReason: { type: String, default: '' },
  accountingEntryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AccountingEntry',
  },
  paymentVoucherId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PaymentVoucher',
  },
  narration: { type: String, default: '' },
}, { timestamps: true });

BankInstrumentSchema.index({ companyId: 1, instrumentNo: 1, instrumentType: 1 });
BankInstrumentSchema.index({ companyId: 1, status: 1, instrumentDate: 1 });
BankInstrumentSchema.plugin(enterpriseIntegrityPlugin, { softDelete: true, versionField: true });

module.exports = mongoose.model('BankInstrument', BankInstrumentSchema);
