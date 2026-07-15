const mongoose = require('mongoose');
const { enterpriseIntegrityPlugin } = require('./mixins/enterpriseMetaSchema');

const StockAdjustmentSchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  adjustNo: { type: String, required: true },
  warehouseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse', default: null },
  reason: { type: String, default: 'Physical verification' },
  lines: [{
    lotId: { type: mongoose.Schema.Types.ObjectId, ref: 'InventoryLot', required: true },
    itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true },
    systemMts: { type: Number, default: 0 },
    physicalMts: { type: Number, default: 0 },
    varianceMts: { type: Number, default: 0 },
    remarks: { type: String, default: '' },
  }],
  status: {
    type: String,
    enum: ['Draft', 'Posted', 'Cancelled'],
    default: 'Draft',
    index: true,
  },
  postedAt: { type: Date, default: null },
}, { timestamps: true });

StockAdjustmentSchema.index({ companyId: 1, adjustNo: 1 }, { unique: true });
StockAdjustmentSchema.plugin(enterpriseIntegrityPlugin);

module.exports = mongoose.model('StockAdjustment', StockAdjustmentSchema);
