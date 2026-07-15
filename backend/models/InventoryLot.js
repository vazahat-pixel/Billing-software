const mongoose = require('mongoose');
const { enterpriseIntegrityPlugin } = require('./mixins/enterpriseMetaSchema');

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
    enum: ['purchase', 'opening', 'jobwork', 'job_receive', 'return'],
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
  /** Operational hold — blocks issue/sale (Sprint 2.3) */
  holdStatus: {
    type: String,
    enum: ['None', 'Blocked', 'Damaged', 'InTransit'],
    default: 'None',
    index: true,
  },
  reservedMtrs: { type: Number, default: 0, min: 0 },
  reservedPcs: { type: Number, default: 0, min: 0 },
  barcode: { type: String, default: '', trim: true },
  warehouseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Warehouse',
    default: null,
    index: true,
  },
  rate: {
    type: Number,
    default: 0,
    min: 0,
  },
  /** Lineage — grey lot that produced this finished lot (Sprint 2.4) */
  parentLotId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'InventoryLot',
    default: null,
    index: true,
  },
  sourceJobId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Job',
    default: null,
    index: true,
  },
  processHistory: [{
    jobId: { type: mongoose.Schema.Types.ObjectId, ref: 'Job' },
    jobCardNo: { type: String, default: '' },
    processName: { type: String, default: '' },
    workerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Party', default: null },
    workerName: { type: String, default: '' },
    issueQty: { type: Number, default: 0 },
    receivedQty: { type: Number, default: 0 },
    wastage: { type: Number, default: 0 },
    charges: { type: Number, default: 0 },
    completedAt: { type: Date, default: null },
  }],
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
InventoryLotSchema.index({ companyId: 1, itemId: 1, status: 1 });
InventoryLotSchema.index({ companyId: 1, warehouseId: 1 });

InventoryLotSchema.plugin(enterpriseIntegrityPlugin);

module.exports = mongoose.model('InventoryLot', InventoryLotSchema);
