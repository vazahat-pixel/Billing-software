const mongoose = require('mongoose');
const { enterpriseIntegrityPlugin } = require('./mixins/enterpriseMetaSchema');

/**
 * Bank Reconciliation Statement line + session (Sprint 3.4).
 */
const BankReconciliationSchema = new mongoose.Schema({
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
    index: true,
  },
  bankLedgerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LedgerMaster',
    required: true,
    index: true,
  },
  statementDate: { type: Date, required: true },
  statementBalance: { type: Number, required: true },
  bookBalance: { type: Number, required: true },
  difference: { type: Number, default: 0 },
  status: {
    type: String,
    enum: ['Draft', 'InProgress', 'Reconciled'],
    default: 'Draft',
  },
  clearedEntries: [{
    accountingEntryId: { type: mongoose.Schema.Types.ObjectId, ref: 'AccountingEntry' },
    entryNo: String,
    entryDate: Date,
    amount: Number,
    type: { type: String, enum: ['Dr', 'Cr'] },
    clearedDate: Date,
    bankReference: String,
  }],
  unclearedEntries: [{
    accountingEntryId: { type: mongoose.Schema.Types.ObjectId, ref: 'AccountingEntry' },
    entryNo: String,
    entryDate: Date,
    amount: Number,
    type: { type: String, enum: ['Dr', 'Cr'] },
    reason: String,
  }],
  adjustments: [{
    description: String,
    amount: Number,
    type: { type: String, enum: ['Dr', 'Cr'] },
    accountingEntryId: { type: mongoose.Schema.Types.ObjectId, ref: 'AccountingEntry' },
  }],
  notes: { type: String, default: '' },
  reconciledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reconciledAt: { type: Date },
}, { timestamps: true });

BankReconciliationSchema.index({ companyId: 1, bankLedgerId: 1, statementDate: 1 });
BankReconciliationSchema.plugin(enterpriseIntegrityPlugin, { softDelete: true, versionField: true });

module.exports = mongoose.model('BankReconciliation', BankReconciliationSchema);
