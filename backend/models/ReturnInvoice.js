const mongoose = require('mongoose');

const ReturnInvoiceSchema = new mongoose.Schema({
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
    index: true
  },
  returnType: {
    type: String,
    enum: ['Sales', 'Purchase'],
    required: true,
    index: true
  },
  invoiceNo: {
    type: String,
    required: true
  },
  originalInvoiceNo: {
    type: String
  },
  partyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Party',
    required: true
  },
  date: {
    type: Date,
    default: Date.now
  },
  items: [{
    itemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Item',
      required: true
    },
    pcs: Number,
    mts: Number,
    rate: Number,
    amount: Number
  }],
  taxableAmount: {
    type: Number,
    required: true,
    min: 0
  },
  gstAmount: {
    type: Number,
    required: true,
    min: 0
  },
  netAmount: {
    type: Number,
    required: true,
    min: 0
  }
}, {
  timestamps: true
});

ReturnInvoiceSchema.index({ companyId: 1, returnType: 1, invoiceNo: 1 }, { unique: true });

module.exports = mongoose.model('ReturnInvoice', ReturnInvoiceSchema);
