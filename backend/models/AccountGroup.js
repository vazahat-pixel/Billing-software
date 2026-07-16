const mongoose = require('mongoose');
const { enterpriseIntegrityPlugin } = require('./mixins/enterpriseMetaSchema');

/**
 * Account Group — hierarchical Chart of Accounts structure (Sprint 3.1).
 * Nature: primary classification used for Trial Balance / BS / P&L.
 */
const AccountGroupSchema = new mongoose.Schema({
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
    index: true,
  },
  code: { type: String, required: true, trim: true },
  name: { type: String, required: true, trim: true },
  nature: {
    type: String,
    enum: ['Assets', 'Liabilities', 'Equity', 'Income', 'Expenses'],
    required: true,
    index: true,
  },
  /** Debit-nature groups (Assets, Expenses) vs Credit-nature (Liabilities, Equity, Income) */
  normalBalance: {
    type: String,
    enum: ['Dr', 'Cr'],
    required: true,
  },
  parentGroupId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AccountGroup',
    default: null,
    index: true,
  },
  level: { type: Number, default: 1, min: 1, max: 8 },
  path: { type: String, default: '' }, // e.g. Assets/Current Assets/Cash
  sortOrder: { type: Number, default: 0 },
  isSystem: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  affectsGrossProfit: { type: Boolean, default: false },
  description: { type: String, default: '' },
}, { timestamps: true });

AccountGroupSchema.index({ companyId: 1, code: 1 }, { unique: true });
AccountGroupSchema.index({ companyId: 1, name: 1 });
AccountGroupSchema.index({ companyId: 1, parentGroupId: 1 });

AccountGroupSchema.plugin(enterpriseIntegrityPlugin, { softDelete: true, versionField: true });

module.exports = mongoose.model('AccountGroup', AccountGroupSchema);
