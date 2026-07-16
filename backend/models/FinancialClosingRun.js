const mongoose = require('mongoose');
const { enterpriseIntegrityPlugin } = require('./mixins/enterpriseMetaSchema');

/**
 * Financial year closing run snapshot (Sprint 3.7).
 */
const FinancialClosingRunSchema = new mongoose.Schema({
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
    index: true,
  },
  financialYearId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FinancialYear',
    required: true,
  },
  fromFyCode: { type: String, required: true },
  toFyCode: { type: String, default: '' },
  status: {
    type: String,
    enum: ['Draft', 'Validated', 'Closed', 'Reopened'],
    default: 'Draft',
  },
  closingEntryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AccountingEntry',
  },
  openingEntryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AccountingEntry',
  },
  netProfit: { type: Number, default: 0 },
  retainedEarningsTransfer: { type: Number, default: 0 },
  ledgerSnapshots: [{
    ledgerId: { type: mongoose.Schema.Types.ObjectId, ref: 'LedgerMaster' },
    ledgerName: String,
    group: String,
    closingBalance: Number,
    closingType: { type: String, enum: ['Dr', 'Cr'] },
    carriedForward: { type: Boolean, default: false },
  }],
  validationReport: {
    trialBalanceOk: { type: Boolean, default: false },
    journalsBalanced: { type: Boolean, default: false },
    exceptions: [{ type: String }],
  },
  closedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  closedAt: { type: Date },
  reopenedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reopenedAt: { type: Date },
  reopenReason: { type: String, default: '' },
}, { timestamps: true });

FinancialClosingRunSchema.index({ companyId: 1, financialYearId: 1 }, { unique: true });
FinancialClosingRunSchema.plugin(enterpriseIntegrityPlugin, { softDelete: true, versionField: true });

module.exports = mongoose.model('FinancialClosingRun', FinancialClosingRunSchema);
