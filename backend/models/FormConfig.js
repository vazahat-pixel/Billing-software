const mongoose = require('mongoose');
const configMetaSchema = require('./mixins/configMetaSchema');

const FieldDefinitionSchema = new mongoose.Schema({
  key: { type: String, required: true },
  label: { type: String, required: true },
  type: {
    type: String,
    enum: ['text', 'number', 'date', 'select', 'textarea', 'checkbox', 'searchable-select', 'readonly'],
    default: 'text'
  },
  section: { type: String, default: 'default' },
  required: { type: Boolean, default: false },
  visible: { type: Boolean, default: true },
  readOnly: { type: Boolean, default: false },
  order: { type: Number, default: 0 },
  defaultValue: { type: mongoose.Schema.Types.Mixed },
  options: [{ value: String, label: String }],
  validation: {
    min: Number,
    max: Number,
    pattern: String,
    message: String
  },
  width: { type: String, default: 'full' }
}, { _id: false });

const FormConfigSchema = new mongoose.Schema({
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
    index: true
  },
  formKey: {
    type: String,
    required: true,
    index: true
  },
  label: { type: String, default: '' },
  module: { type: String, default: '' },
  fields: [FieldDefinitionSchema],
  ...configMetaSchema
}, { timestamps: true });

FormConfigSchema.index({ companyId: 1, formKey: 1 }, { unique: true });
FormConfigSchema.index({ companyId: 1, module: 1 });

module.exports = mongoose.model('FormConfig', FormConfigSchema);
