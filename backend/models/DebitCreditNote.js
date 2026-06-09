const mongoose = require('mongoose');

const DebitCreditNoteSchema = new mongoose.Schema({
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
    index: true
  },
  noteType: {
    type: String,
    enum: ['Debit', 'Credit'],
    required: true,
    index: true
  },
  noteNo: {
    type: String,
    required: true
  },
  partyLedgerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LedgerMaster',
    required: true
  },
  date: {
    type: Date,
    default: Date.now
  },
  amount: {
    type: Number,
    required: true,
    min: 0.01
  },
  againstInvoiceNo: {
    type: String
  },
  reason: {
    type: String
  },
  status: {
    type: String,
    enum: ['Draft', 'Posted'],
    default: 'Draft'
  }
}, {
  timestamps: true
});

DebitCreditNoteSchema.index({ companyId: 1, noteType: 1, noteNo: 1 }, { unique: true });

module.exports = mongoose.model('DebitCreditNote', DebitCreditNoteSchema);
