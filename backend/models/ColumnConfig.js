const mongoose = require('mongoose');
const configMetaSchema = require('./mixins/configMetaSchema');

const ColumnDefinitionSchema = new mongoose.Schema({
  key: { type: String, required: true },
  label: { type: String, required: true },
  visible: { type: Boolean, default: true },
  order: { type: Number, default: 0 },
  width: { type: String, default: '' },
  align: { type: String, enum: ['left', 'center', 'right'], default: 'left' },
  sortable: { type: Boolean, default: false },
  format: { type: String, default: '' }
}, { _id: false });

const ColumnConfigSchema = new mongoose.Schema({
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
    index: true
  },
  tableKey: {
    type: String,
    required: true,
    index: true
  },
  label: { type: String, default: '' },
  module: { type: String, default: '' },
  columns: [ColumnDefinitionSchema],
  ...configMetaSchema
}, { timestamps: true });

ColumnConfigSchema.index({ companyId: 1, tableKey: 1 }, { unique: true });

module.exports = mongoose.model('ColumnConfig', ColumnConfigSchema);
