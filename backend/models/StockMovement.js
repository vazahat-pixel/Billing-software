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
    enum: ['PURCHASE', 'ISSUE', 'RECEIVE', 'SALE', 'SALE_CANCEL', 'PURCHASE_CANCEL', 'ADJUSTMENT', 'OPENING', 'RETURN', 'TRANSFER_OUT', 'TRANSFER_IN', 'RESERVE', 'UNRESERVE'],
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
  /** Prevent duplicate movements on client retry — set by services when available */
  idempotencyKey: {
    type: String,
    default: null
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

// Stock ledger is append-only — never allow updates of qty history
StockMovementSchema.pre(['updateOne', 'findOneAndUpdate', 'updateMany'], function blockHistoryEdit(next) {
  next(new Error('StockMovement history is immutable'));
});

// Performance indexes
StockMovementSchema.index({ lotId: 1, type: 1 });
StockMovementSchema.index({ companyId: 1, createdAt: -1 });
StockMovementSchema.index({ companyId: 1, referenceId: 1, type: 1 });
StockMovementSchema.index(
  { companyId: 1, idempotencyKey: 1 },
  {
    unique: true,
    partialFilterExpression: { idempotencyKey: { $type: 'string', $gt: '' } },
  }
);

module.exports = mongoose.model('StockMovement', StockMovementSchema);

