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
    required: true
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
    enum: ['Cash', 'Card', 'Cheque', 'NEFT', 'RTGS', 'UPI', 'Mixed'],
    required: true
  },
  paymentSplits: [{
    mode: {
      type: String,
      enum: ['Cash', 'Card', 'Cheque', 'NEFT', 'RTGS', 'UPI']
    },
    amount: { type: Number, min: 0 },
    reference: String
  }],
  bankLedgerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LedgerMaster',
    required: true
  },
  chequeNo: String,
  chequeDate: Date,
  utrNo: String,
  slipNo: String,
  intBillNo: String,
  intBillFlag: { type: String, default: 'N' },
  partyBank: String,
  accBill: { type: String, default: 'B' },
  finance: { type: Number, default: 0 },
  financeFlag: { type: Boolean, default: false },
  remark2: String,
  bookId: { type: mongoose.Schema.Types.ObjectId, ref: 'Book' },
  bookName: String,
  bookKind: { type: String, enum: ['cash', 'bank', ''], default: '' },
  narration: String,
  againstInvoices: [{
    invoiceId: mongoose.Schema.Types.ObjectId,
    invoiceNo: String,
    billDate: Date,
    billAmt: Number,
    partRc: Number,
    rg: Number,
    tds: Number,
    osDy: Number,
    billType: { type: String, default: '' },
    osAmt: Number,
    amount: Number,
    jvDis: Number,
    pq: String,
    disPer: Number,
    discount: Number,
    bc: String,
    netOs: Number,
    nSlash: String
  }],
  accountingEntryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AccountingEntry'
  },
  status: {
    type: String,
    enum: ['Draft', 'Posted', 'Reversed'],
    default: 'Draft'
  },
  isReversed: {
    type: Boolean,
    default: false,
    index: true,
  },
  reversalEntryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AccountingEntry',
  },
  reversedAt: Date,
  reverseReason: String,
}, {
  timestamps: true
});

PaymentVoucherSchema.index({ voucherNo: 1, companyId: 1, voucherType: 1 }, { unique: true });

module.exports = mongoose.model('PaymentVoucher', PaymentVoucherSchema);
