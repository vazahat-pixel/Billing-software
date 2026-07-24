const mongoose = require('mongoose');
const { enterpriseIntegrityPlugin } = require('./mixins/enterpriseMetaSchema');

const ItemSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  itemCode: { type: String, trim: true, default: '' },
  category: {
    type: String,
    enum: ['Grey', 'Finished', 'Yarn', 'Others'],
    required: true
  },
  /** Display label from legacy masters (e.g. FINISH STOCK) */
  categoryLabel: { type: String, trim: true, default: '' },
  fabricType: { type: String, trim: true },
  design: { type: String, trim: true },
  color: { type: String, trim: true },
  size: { type: String, trim: true },
  brand: { type: String, trim: true, default: '' },
  pattern: { type: String, trim: true, default: '' },
  quality: { type: String, trim: true, default: '' },
  shade: { type: String, trim: true, default: '' },
  hsnCode: { type: String, trim: true },
  hsnDigits: { type: Number, default: 0 },
  gstRate: { type: Number, default: 5 },
  /** GST FREE | GST JOBWORK | GST MILL | GST 5% etc. */
  gstTaxLabel: { type: String, trim: true, default: '' },
  unit: { type: String, default: 'MTRS' },
  purchaseRate: { type: Number, default: 0 },
  salesRate: { type: Number, default: 0 },
  mrp: { type: Number, default: 0 },
  openingStock: { type: Number, default: 0 },
  openingPcs: { type: Number, default: 0 },
  openingQty: { type: Number, default: 0 },
  openingRate: { type: Number, default: 0 },
  openingValue: { type: Number, default: 0 },
  cut: { type: Number, default: 0 },
  description: { type: String, trim: true, default: '' },
  ewayBillProductName: { type: String, trim: true, default: '' },
  imageUrl: { type: String, default: '' },
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
ItemSchema.index(
  { companyId: 1, itemCode: 1 },
  {
    unique: true,
    partialFilterExpression: { itemCode: { $type: 'string', $gt: '' } },
  }
);

ItemSchema.plugin(enterpriseIntegrityPlugin);

module.exports = mongoose.model('Item', ItemSchema);
