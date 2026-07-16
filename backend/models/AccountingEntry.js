const mongoose = require('mongoose');
const { enterpriseIntegrityPlugin } = require('./mixins/enterpriseMetaSchema');

const VOUCHER_TYPES = [
  'Payment', 'Receipt', 'Journal', 'Contra', 'DebitNote', 'CreditNote',
  'Sales', 'Purchase', 'Opening', 'Closing', 'Reversal',
  // Legacy auto-post aliases (kept for existing documents)
  'SalesAuto', 'PurchaseAuto', 'JobWorkAuto', 'WastageAuto', 'ReturnAuto', 'NoteAuto',
];

const AccountingEntrySchema = new mongoose.Schema({
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
    index: true,
  },
  entryNo: {
    type: String,
    required: true,
  },
  entryDate: {
    type: Date,
    required: true,
    index: true,
  },
  voucherType: {
    type: String,
    enum: VOUCHER_TYPES,
    required: true,
    index: true,
  },
  refType: {
    type: String,
    enum: [
      'SalesInvoice', 'PurchaseBill', 'GRN', 'JobIssue', 'JobReceive',
      'Payment', 'Receipt', 'Journal', 'Contra',
      'CreditNote', 'DebitNote',
      'SalesReturn', 'PurchaseReturn',
      'Opening', 'Closing', 'Reversal', 'BankCharges', 'Depreciation',
    ],
  },
  refId: {
    type: mongoose.Schema.Types.ObjectId,
  },
  lines: [{
    ledgerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LedgerMaster',
      required: true,
    },
    ledgerName: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ['Dr', 'Cr'],
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0.01,
    },
    narration: String,
    costCenterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CostCenter',
      default: null,
    },
  }],
  narration: String,
  totalDebit: {
    type: Number,
    required: true,
  },
  totalCredit: {
    type: Number,
    required: true,
  },
  status: {
    type: String,
    enum: ['Draft', 'Posted'],
    default: 'Posted',
    index: true,
  },
  isReversed: {
    type: Boolean,
    default: false,
  },
  reversalEntryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AccountingEntry',
  },
  reversedFromId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AccountingEntry',
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
}, {
  timestamps: true,
});

// Pre-validate — enforces double-entry rule
AccountingEntrySchema.pre('validate', function(next) {
  let totalDr = 0;
  let totalCr = 0;

  if (this.lines && this.lines.length > 0) {
    this.lines.forEach((line) => {
      if (line.type === 'Dr') totalDr += line.amount;
      else if (line.type === 'Cr') totalCr += line.amount;
    });
  }

  if (Math.abs(totalDr - totalCr) > 0.01) {
    return next(new Error(
      `Double Entry Imbalance: Total Debits (₹${totalDr.toFixed(2)}) must equal Total Credits (₹${totalCr.toFixed(2)})`
    ));
  }

  this.totalDebit = Number(totalDr.toFixed(2));
  this.totalCredit = Number(totalCr.toFixed(2));
  next();
});

/** Posted entries are immutable — only isReversed / reversalEntryId may change */
AccountingEntrySchema.pre('save', function immutabilityGuard(next) {
  if (this.isNew) return next();
  if (this.status !== 'Posted') return next();

  const allowed = new Set(['isReversed', 'reversalEntryId', 'updatedAt', 'updatedBy', 'version']);
  const modified = this.modifiedPaths().filter((p) => !p.startsWith('_'));
  const illegal = modified.filter((p) => !allowed.has(p) && !p.startsWith('lines'));
  // Disallow line / amount / date / voucher changes after post
  const blocked = modified.some((p) =>
    ['entryNo', 'entryDate', 'voucherType', 'refType', 'refId', 'lines', 'narration',
      'totalDebit', 'totalCredit', 'status'].includes(p) || p.startsWith('lines.')
  );
  if (blocked || illegal.length) {
    return next(new Error(
      'Posted journal is immutable. Create a Reversal entry instead of editing.'
    ));
  }
  next();
});

AccountingEntrySchema.index({ companyId: 1, entryDate: 1 });
AccountingEntrySchema.index({ companyId: 1, voucherType: 1 });
AccountingEntrySchema.index({ companyId: 1, isReversed: 1 });
AccountingEntrySchema.index({ 'lines.ledgerId': 1 });
AccountingEntrySchema.index({ entryNo: 1, companyId: 1 }, { unique: true });
AccountingEntrySchema.index({ companyId: 1, refId: 1, voucherType: 1 });
AccountingEntrySchema.index({ companyId: 1, status: 1, entryDate: 1 });

AccountingEntrySchema.plugin(enterpriseIntegrityPlugin, { softDelete: true, versionField: true });

module.exports = mongoose.model('AccountingEntry', AccountingEntrySchema);
module.exports.VOUCHER_TYPES = VOUCHER_TYPES;
