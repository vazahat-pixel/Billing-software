const mongoose = require('mongoose');
const { enterpriseIntegrityPlugin } = require('./mixins/enterpriseMetaSchema');

/**
 * TDS / TCS deduction register — Sprint 4.5
 */
const TaxDeductionSchema = new mongoose.Schema({
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
    index: true,
  },
  deductionType: { type: String, enum: ['TDS', 'TCS'], required: true, index: true },
  section: { type: String, required: true }, // 194C, 194H, 194J, 194Q, 206C...
  partyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Party', required: true },
  partyName: { type: String, default: '' },
  pan: { type: String, default: '', uppercase: true },
  refType: {
    type: String,
    enum: ['PurchaseBill', 'SalesInvoice', 'Payment', 'Receipt', 'Manual'],
    default: 'Manual',
  },
  refId: { type: mongoose.Schema.Types.ObjectId },
  refNo: { type: String, default: '' },
  transactionDate: { type: Date, required: true },
  taxableAmount: { type: Number, required: true },
  rate: { type: Number, required: true },
  deductedAmount: { type: Number, required: true },
  accountingEntryId: { type: mongoose.Schema.Types.ObjectId, ref: 'AccountingEntry' },
  certificateNo: { type: String, default: '' },
  certificateIssued: { type: Boolean, default: false },
  status: {
    type: String,
    enum: ['Draft', 'Posted', 'Reversed'],
    default: 'Posted',
  },
  narration: { type: String, default: '' },
}, { timestamps: true });

TaxDeductionSchema.index({ companyId: 1, deductionType: 1, transactionDate: 1 });
TaxDeductionSchema.index({ companyId: 1, section: 1, partyId: 1 });
TaxDeductionSchema.plugin(enterpriseIntegrityPlugin, { softDelete: true, versionField: true });

module.exports = mongoose.model('TaxDeduction', TaxDeductionSchema);
