const mongoose = require('mongoose');
const { enterpriseIntegrityPlugin } = require('./mixins/enterpriseMetaSchema');

/**
 * GST Configuration — Sprint 4.1
 * Company-level statutory GST setup (not hardcoded in UI).
 */
const GstConfigSchema = new mongoose.Schema({
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
    unique: true,
    index: true,
  },
  gstin: { type: String, default: '', uppercase: true, trim: true },
  legalName: { type: String, default: '' },
  tradeName: { type: String, default: '' },
  stateCode: { type: String, default: '', trim: true }, // 2-digit
  stateName: { type: String, default: '' },
  registrationType: {
    type: String,
    enum: ['Regular', 'Composition', 'SEZ', 'Casual', 'InputServiceDistributor'],
    default: 'Regular',
  },
  filingFrequency: {
    type: String,
    enum: ['Monthly', 'Quarterly'],
    default: 'Monthly',
  },
  isExporter: { type: Boolean, default: false },
  lutNumber: { type: String, default: '' },
  lutValidFrom: { type: Date },
  lutValidTo: { type: Date },
  reverseChargeEnabled: { type: Boolean, default: true },
  eInvoiceEnabled: { type: Boolean, default: false },
  eWayEnabled: { type: Boolean, default: false },
  eInvoiceThreshold: { type: Number, default: 0 }, // turnover threshold helper
  eWayThreshold: { type: Number, default: 50000 },
  /** Ledger ObjectIds for GST control accounts */
  ledgerMap: {
    cgstInput: { type: mongoose.Schema.Types.ObjectId, ref: 'LedgerMaster' },
    sgstInput: { type: mongoose.Schema.Types.ObjectId, ref: 'LedgerMaster' },
    igstInput: { type: mongoose.Schema.Types.ObjectId, ref: 'LedgerMaster' },
    cgstOutput: { type: mongoose.Schema.Types.ObjectId, ref: 'LedgerMaster' },
    sgstOutput: { type: mongoose.Schema.Types.ObjectId, ref: 'LedgerMaster' },
    igstOutput: { type: mongoose.Schema.Types.ObjectId, ref: 'LedgerMaster' },
    cessInput: { type: mongoose.Schema.Types.ObjectId, ref: 'LedgerMaster' },
    cessOutput: { type: mongoose.Schema.Types.ObjectId, ref: 'LedgerMaster' },
    tdsPayable: { type: mongoose.Schema.Types.ObjectId, ref: 'LedgerMaster' },
    tcsPayable: { type: mongoose.Schema.Types.ObjectId, ref: 'LedgerMaster' },
  },
  taxTemplates: [{
    code: String,
    name: String,
    rate: Number,
    cessRate: { type: Number, default: 0 },
    category: {
      type: String,
      enum: ['Taxable', 'Exempt', 'NilRated', 'ZeroRated', 'NonGST'],
      default: 'Taxable',
    },
  }],
  lockedUntilPeriod: { type: String, default: '' }, // YYYY-MM
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

GstConfigSchema.plugin(enterpriseIntegrityPlugin, { softDelete: true, versionField: true });

module.exports = mongoose.model('GstConfig', GstConfigSchema);
