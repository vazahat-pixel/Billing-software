const mongoose = require('mongoose');

const PaymentVoucherSchema = new mongoose.Schema({
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
    index: true
  },
  voucherNo: {
    type: String,
    required: true,
    unique: true
  },
  date: {
    type: Date,
    required: true,
    index: true
  },
  voucherType: {
    type: String,
    enum: ['Payment', 'Receipt'],
    required: true
  },
  partyLedgerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LedgerMaster',
    required: true
  },
  partyName: {
    type: String,
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0.01
  },
  paymentMode: {
    type: String,
    enum: ['Cash', 'Cheque', 'NEFT', 'RTGS', 'UPI'],
    required: true
  },
  bankLedgerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LedgerMaster',
    required: true
  },
  chequeNo: String,
  chequeDate: Date,
  utrNo: String,
  narration: String,
  againstInvoices: [{
    invoiceId: mongoose.Schema.Types.ObjectId,
    invoiceNo: String,
    amount: Number
  }],
  accountingEntryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AccountingEntry'
  },
  status: {
    type: String,
    enum: ['Draft', 'Posted'],
    default: 'Draft'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('PaymentVoucher', PaymentVoucherSchema);
