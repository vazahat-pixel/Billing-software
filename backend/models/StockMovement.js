const mongoose = require('mongoose');

const StockMovementSchema = new mongoose.Schema({
  lotId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'InventoryLot',
    required: true,
    index: true
  },
  type: {
    type: String,
    enum: ['PURCHASE', 'ISSUE', 'RECEIVE', 'SALE', 'ADJUSTMENT', 'OPENING', 'RETURN'],
    required: true
  },
  qtyPcs: {
    type: Number,
    default: 0
  },
  qtyMtrs: {
    type: Number,
    required: true
  },
  balanceMtrs: {
    type: Number,
    required: true
  },
  referenceId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  remarks: String,
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
    index: true
  }
}, {
  timestamps: true
});

// Performance indexes
StockMovementSchema.index({ lotId: 1, type: 1 });
StockMovementSchema.index({ companyId: 1, createdAt: -1 });

module.exports = mongoose.model('StockMovement', StockMovementSchema);

