const mongoose = require('mongoose');

const SalesSchema = new mongoose.Schema({
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Party',
    required: true,
    index: true
  },
  invoiceNo: {
    type: String,
    required: true,
    unique: true
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
    lotId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InventoryLot',
      required: true
    },
    pcs: Number,
    mts: Number,
    rate: Number,
    amount: Number
  }],
  taxableAmount: {
    type: Number,
    required: true
  },
  gstAmount: {
    type: Number,
    required: true
  },
  netAmount: {
    type: Number,
    required: true
  },
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
    index: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Sales', SalesSchema);
