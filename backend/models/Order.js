const mongoose = require('mongoose');

const OrderSchema = new mongoose.Schema({
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
    index: true
  },
  orderType: {
    type: String,
    enum: ['Sales', 'Purchase'],
    required: true,
    index: true
  },
  orderNo: {
    type: String,
    required: true
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
  totalAmount: {
    type: Number,
    required: true,
    min: 0
  },
  status: {
    type: String,
    enum: ['Open', 'Closed'],
    default: 'Open'
  }
}, {
  timestamps: true
});

// Compound unique constraint per company + orderType + orderNo
OrderSchema.index({ companyId: 1, orderType: 1, orderNo: 1 }, { unique: true });

module.exports = mongoose.model('Order', OrderSchema);
