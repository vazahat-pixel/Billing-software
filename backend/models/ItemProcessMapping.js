const mongoose = require('mongoose');
const { enterpriseIntegrityPlugin } = require('./mixins/enterpriseMetaSchema');

/** Grey item + process → finished item conversion rules */
const ItemProcessMappingSchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  inputItemId: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true, index: true },
  processId: { type: mongoose.Schema.Types.ObjectId, ref: 'SubMaster', default: null },
  processName: { type: String, required: true, trim: true },
  outputItemId: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true },
  shrinkagePct: { type: Number, default: 3, min: 0 },
  notes: { type: String, default: '' },
}, { timestamps: true });

ItemProcessMappingSchema.index(
  { companyId: 1, inputItemId: 1, processName: 1 },
  { unique: true, name: 'uniq_item_process_map' }
);
ItemProcessMappingSchema.plugin(enterpriseIntegrityPlugin);

module.exports = mongoose.model('ItemProcessMapping', ItemProcessMappingSchema);
