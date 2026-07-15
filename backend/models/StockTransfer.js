const mongoose = require('mongoose');
const { enterpriseIntegrityPlugin } = require('./mixins/enterpriseMetaSchema');

const StockTransferSchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  transferNo: { type: String, required: true },
  fromLotId: { type: mongoose.Schema.Types.ObjectId, ref: 'InventoryLot', required: true },
  toLotId: { type: mongoose.Schema.Types.ObjectId, ref: 'InventoryLot', default: null },
  fromWarehouseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse', default: null },
  toWarehouseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse', required: true },
  itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true },
  qtyMts: { type: Number, required: true, min: 0.0001 },
  qtyPcs: { type: Number, default: 0 },
  status: {
    type: String,
    enum: ['Completed', 'Cancelled'],
    default: 'Completed',
  },
  remarks: { type: String, default: '' },
}, { timestamps: true });

StockTransferSchema.index({ companyId: 1, transferNo: 1 }, { unique: true });
StockTransferSchema.plugin(enterpriseIntegrityPlugin);

module.exports = mongoose.model('StockTransfer', StockTransferSchema);
