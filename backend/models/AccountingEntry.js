const mongoose = require('mongoose');
const { enterpriseIntegrityPlugin } = require('./mixins/enterpriseMetaSchema');

const AccountingEntrySchema = new mongoose.Schema({
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
    index: true
  },
  entryNo: {
    type: String,
    required: true
  },
  entryDate: {
    type: Date,
    required: true,
    index: true
  },
  voucherType: {
    type: String,
    enum: ['Payment', 'Receipt', 'Journal', 'SalesAuto', 'PurchaseAuto', 'JobWorkAuto', 'WastageAuto', 'ReturnAuto', 'NoteAuto'],
    required: true
  },
  refType: {
    type: String,
    enum: [
      'SalesInvoice', 'PurchaseBill', 'GRN', 'JobIssue', 'JobReceive',
      'Payment', 'Receipt', 'Journal',
      'CreditNote', 'DebitNote',           // Fix: was missing these
      'SalesReturn', 'PurchaseReturn'       // Fix: descriptive return types
    ]
  },
  refId: {
    type: mongoose.Schema.Types.ObjectId
  },
  lines: [{
    ledgerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LedgerMaster',
      required: true
    },
    ledgerName: {
      type: String,
      required: true
    },
    type: {
      type: String,
      enum: ['Dr', 'Cr'],
      required: true
    },
    amount: {
      type: Number,
      required: true,
      min: 0.01
    },
    narration: String
  }],
  narration: String,
  totalDebit: {
    type: Number,
    required: true
  },
  totalCredit: {
    type: Number,
    required: true
  },
  isReversed: {
    type: Boolean,
    default: false
  },
  reversalEntryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AccountingEntry'
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Pre-validate hook — enforces double-entry rule
AccountingEntrySchema.pre('validate', function(next) {
  let totalDr = 0;
  let totalCr = 0;

  if (this.lines && this.lines.length > 0) {
    this.lines.forEach(line => {
      if (line.type === 'Dr') {
        totalDr += line.amount;
      } else if (line.type === 'Cr') {
        totalCr += line.amount;
      }
    });
  }

  // Float precision comparison up to 2 decimal places
  if (Math.abs(totalDr - totalCr) > 0.01) {
    return next(new Error(`Double Entry Imbalance: Total Debits (₹${totalDr.toFixed(2)}) must equal Total Credits (₹${totalCr.toFixed(2)})`));
  }

  this.totalDebit = Number(totalDr.toFixed(2));
  this.totalCredit = Number(totalCr.toFixed(2));
  next();
});

// Performance indexes for date-range financial report queries
AccountingEntrySchema.index({ companyId: 1, entryDate: 1 });
AccountingEntrySchema.index({ companyId: 1, voucherType: 1 });
AccountingEntrySchema.index({ companyId: 1, isReversed: 1 });
AccountingEntrySchema.index({ 'lines.ledgerId': 1 });
AccountingEntrySchema.index({ entryNo: 1, companyId: 1 }, { unique: true });
AccountingEntrySchema.index({ companyId: 1, refId: 1, voucherType: 1 });

AccountingEntrySchema.plugin(enterpriseIntegrityPlugin, { softDelete: true, versionField: true });

module.exports = mongoose.model('AccountingEntry', AccountingEntrySchema);

