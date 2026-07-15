const mongoose = require('mongoose');
const { enterpriseIntegrityPlugin } = require('./mixins/enterpriseMetaSchema');

/**
 * Location hierarchy for textile inventory.
 * type: Warehouse | Godown | Rack | Bin
 * parentId: Godown→Warehouse, Rack→Godown/Warehouse, Bin→Rack
 */
const WarehouseSchema = new mongoose.Schema({
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
    index: true,
  },
  name: { type: String, required: true, trim: true },
  code: { type: String, required: true, trim: true, uppercase: true },
  type: {
    type: String,
    enum: ['Warehouse', 'Godown', 'Rack', 'Bin'],
    default: 'Warehouse',
    index: true,
  },
  parentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Warehouse',
    default: null,
  },
  address: { type: String, default: '' },
  isDefault: { type: Boolean, default: false },
  status: {
    type: String,
    enum: ['Active', 'Inactive'],
    default: 'Active',
  },
}, { timestamps: true });

WarehouseSchema.index({ companyId: 1, code: 1 }, { unique: true });
WarehouseSchema.index({ companyId: 1, type: 1, name: 1 });
WarehouseSchema.plugin(enterpriseIntegrityPlugin);

module.exports = mongoose.model('Warehouse', WarehouseSchema);
