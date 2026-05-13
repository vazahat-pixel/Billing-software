const mongoose = require('mongoose');

const PurchaseSchema = new mongoose.Schema({
  supplierId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Party',
    required: true,
    index: true
  },
  invoiceNo: {
    type: String,
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
    cut: Number,
    mts: Number,
    rate: Number,
    amount: Number,
    lotId: String // Generated on save
  }],
  totalAmount: {
    type: Number,
    required: true
  },
  gstType: String,
  gstAmount: Number,
  netAmount: Number,
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
    index: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Purchase', PurchaseSchema);
