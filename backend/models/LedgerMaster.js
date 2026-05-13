const mongoose = require('mongoose');

const LedgerMasterSchema = new mongoose.Schema({
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true
  },
  group: {
    type: String,
    enum: ['Assets', 'Liabilities', 'Income', 'Expenses', 'Capital'],
    required: true
  },
  subGroup: {
    type: String
  },
  openingBalance: {
    type: Number,
    default: 0
  },
  openingBalanceType: {
    type: String,
    enum: ['Dr', 'Cr'],
    default: 'Dr'
  },
  linkedPartyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Party',
    index: true
  },
  linkedBankAccount: {
    accountNo: String,
    ifsc: String,
    bankName: String
  },
  isSystemLedger: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Compound unique index for companyId + name
LedgerMasterSchema.index({ companyId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('LedgerMaster', LedgerMasterSchema);
