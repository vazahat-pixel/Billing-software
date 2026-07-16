const mongoose = require('mongoose');
const { enterpriseIntegrityPlugin } = require('./mixins/enterpriseMetaSchema');

/**
 * Chart of Accounts ledger — Sprint 3.1 enhanced.
 * Balances are NEVER stored as editable derived fields; openingBalance is
 * master OB only and is superseded by Opening journals when present.
 */
const LedgerMasterSchema = new mongoose.Schema({
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
    index: true,
  },
  code: {
    type: String,
    trim: true,
    default: '',
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  /** Top-level nature — Equity aliases Capital for legacy compatibility */
  group: {
    type: String,
    enum: ['Assets', 'Liabilities', 'Income', 'Expenses', 'Capital', 'Equity'],
    required: true,
    index: true,
  },
  subGroup: {
    type: String,
    default: '',
  },
  accountGroupId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AccountGroup',
    default: null,
    index: true,
  },
  parentLedgerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LedgerMaster',
    default: null,
    index: true,
  },
  /** Normal balance nature for the account */
  nature: {
    type: String,
    enum: ['Dr', 'Cr'],
    default: 'Dr',
  },
  openingBalance: {
    type: Number,
    default: 0,
  },
  openingBalanceType: {
    type: String,
    enum: ['Dr', 'Cr'],
    default: 'Dr',
  },
  /** Set when OB is posted as an Opening journal — prevents double-counting */
  openingEntryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AccountingEntry',
    default: null,
  },
  linkedPartyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Party',
    index: true,
  },
  linkedBankAccount: {
    accountNo: String,
    ifsc: String,
    bankName: String,
    branch: String,
  },
  /** Cash | Bank | General — drives Cash/Bank book routing */
  accountType: {
    type: String,
    enum: ['General', 'Cash', 'Bank', 'Party', 'Tax', 'Stock', 'System'],
    default: 'General',
    index: true,
  },
  costCenterId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CostCenter',
    default: null,
  },
  gstMapping: {
    taxType: {
      type: String,
      enum: ['', 'CGST_IN', 'SGST_IN', 'IGST_IN', 'CGST_OUT', 'SGST_OUT', 'IGST_OUT', 'CESS'],
      default: '',
    },
    hsnSac: { type: String, default: '' },
  },
  tdsMapping: {
    section: { type: String, default: '' },
    rate: { type: Number, default: 0 },
  },
  isSystemLedger: {
    type: Boolean,
    default: false,
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true,
  },
  allowManualEntry: {
    type: Boolean,
    default: true,
  },
  description: { type: String, default: '' },
}, {
  timestamps: true,
});

LedgerMasterSchema.index({ companyId: 1, name: 1 }, { unique: true });
LedgerMasterSchema.index({ companyId: 1, code: 1 }, { sparse: true });
LedgerMasterSchema.index({ companyId: 1, group: 1, isActive: 1 });
LedgerMasterSchema.index({ companyId: 1, accountType: 1 });

LedgerMasterSchema.plugin(enterpriseIntegrityPlugin, { softDelete: true, versionField: true });

/** Block direct balance mutation — balances derive from journals only */
LedgerMasterSchema.pre('save', function blockBalanceEdit(next) {
  if (!this.isNew && this.isModified('openingBalance') && this.openingEntryId) {
    return next(new Error(
      'Opening balance cannot be edited after Opening journal is posted. Use Opening/Reversal journals.'
    ));
  }
  next();
});

module.exports = mongoose.model('LedgerMaster', LedgerMasterSchema);
