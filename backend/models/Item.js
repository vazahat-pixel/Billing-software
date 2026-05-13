const mongoose = require('mongoose');

const ItemSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  category: {
    type: String,
    enum: ['Grey', 'Finished', 'Yarn', 'Others'],
    required: true
  },
  fabricType: {
    type: String,
    trim: true
  },
  design: {
    type: String,
    trim: true
  },
  color: {
    type: String,
    trim: true
  },
  size: {
    type: String,
    trim: true
  },
  hsnCode: {
    type: String,
    trim: true
  },
  gstRate: {
    type: Number,
    default: 5
  },
  unit: {
    type: String,
    default: 'MTRS'
  },
  purchaseRate: {
    type: Number,
    default: 0
  },
  salesRate: {
    type: Number,
    default: 0
  },
  openingStock: {
    type: Number,
    default: 0
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

// Duplicate prevention per company
ItemSchema.index({ name: 1, companyId: 1 }, { unique: true });

module.exports = mongoose.model('Item', ItemSchema);
