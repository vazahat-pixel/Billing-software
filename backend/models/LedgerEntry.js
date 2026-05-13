const mongoose = require('mongoose');

const LedgerEntrySchema = new mongoose.Schema({
  accountId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Party',
    required: true,
    index: true
  },
  date: {
    type: Date,
    required: true
  },
  debit: {
    type: Number,
    default: 0
  },
  credit: {
    type: Number,
    default: 0
  },
  referenceType: {
    type: String,
    enum: ['SALES', 'PURCHASE', 'RECEIPT', 'PAYMENT', 'JOURNAL'],
    required: true
  },
  referenceId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  description: String,
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
    index: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('LedgerEntry', LedgerEntrySchema);
