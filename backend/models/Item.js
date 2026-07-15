const mongoose = require('mongoose');
const { enterpriseIntegrityPlugin } = require('./mixins/enterpriseMetaSchema');

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
  fabricType: { type: String, trim: true },
  design: { type: String, trim: true },
  color: { type: String, trim: true },
  size: { type: String, trim: true },
  brand: { type: String, trim: true, default: '' },
  pattern: { type: String, trim: true, default: '' },
  quality: { type: String, trim: true, default: '' },
  shade: { type: String, trim: true, default: '' },
  hsnCode: { type: String, trim: true },
  gstRate: { type: Number, default: 5 },
  unit: { type: String, default: 'MTRS' },
  purchaseRate: { type: Number, default: 0 },
  salesRate: { type: Number, default: 0 },
  openingStock: { type: Number, default: 0 },
  reorderLevel: { type: Number, default: 0 },
  minLevel: { type: Number, default: 0 },
  maxLevel: { type: Number, default: 0 },
  itemGroupId: { type: mongoose.Schema.Types.ObjectId, ref: 'SubMaster', default: null },
  defaultWarehouseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse', default: null },
  barcode: { type: String, trim: true, default: '' },
  isFavorite: { type: Boolean, default: false, index: true },
  lastUsedAt: { type: Date, default: null },
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
    index: true
  }
}, {
  timestamps: true
});

ItemSchema.index({ name: 1, companyId: 1 }, { unique: true });
ItemSchema.index({ companyId: 1, hsnCode: 1 }, { sparse: true });
ItemSchema.index(
  { companyId: 1, barcode: 1 },
  {
    unique: true,
    partialFilterExpression: { barcode: { $type: 'string', $gt: '' } },
  }
);

ItemSchema.plugin(enterpriseIntegrityPlugin);

module.exports = mongoose.model('Item', ItemSchema);
