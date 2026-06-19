const mongoose = require('mongoose');

const InventoryLotSchema = new mongoose.Schema({
  lotId: {
    type: String,
    required: true,
    index: true
  },
  itemId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Item',
    required: true,
    index: true
  },
  purchaseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Purchase',
    default: null
  },
  source: {
    type: String,
    enum: ['purchase', 'opening', 'jobwork', 'job_receive'],
    default: 'purchase'
  },
  totalPcs: {
    type: Number,
    default: 0
  },
  remainingPcs: {
    type: Number,
    default: 0
  },
  totalMtrs: {
    type: Number,
    required: true
  },
  remainingMtrs: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['Available', 'Partially Used', 'Closed'],
    default: 'Available'
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

InventoryLotSchema.index({ lotId: 1, companyId: 1 }, { unique: true });

module.exports = mongoose.model('InventoryLot', InventoryLotSchema);
