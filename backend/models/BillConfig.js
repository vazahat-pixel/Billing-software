const mongoose = require('mongoose');
const configMetaSchema = require('./mixins/configMetaSchema');

const BillFieldSchema = new mongoose.Schema({
  key: { type: String, required: true },
  label: { type: String, required: true },
  type: { type: String, default: 'text' },
  section: { type: String, default: 'header' },
  required: { type: Boolean, default: false },
  visible: { type: Boolean, default: true },
  readOnly: { type: Boolean, default: false },
  order: { type: Number, default: 0 },
  defaultValue: { type: mongoose.Schema.Types.Mixed },
  options: [{ value: String, label: String }],
  validation: { type: mongoose.Schema.Types.Mixed },
  width: { type: String, default: 'full' }
}, { _id: false });

const BillLineColumnSchema = new mongoose.Schema({
  key: { type: String, required: true },
  label: { type: String, required: true },
  visible: { type: Boolean, default: true },
  order: { type: Number, default: 0 },
  width: { type: String, default: '' },
  align: { type: String, default: 'left' },
  calculated: { type: Boolean, default: false },
  formula: { type: String, default: '' }
}, { _id: false });

const BillConfigSchema = new mongoose.Schema({
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
    index: true
  },
  billType: {
    type: String,
    enum: ['sales', 'purchase', 'millIssue', 'millReceive', 'jobIssue', 'jobReceive'],
    required: true
  },
  label: { type: String, default: '' },
  headerFields: [BillFieldSchema],
  lineColumns: [BillLineColumnSchema],
  footerFields: [BillFieldSchema],
  calculations: {
    taxableFormula: { type: String, default: '' },
    gstTypeField: { type: String, default: 'type' },
    netAmountFormula: { type: String, default: '' }
  },
  printTemplate: {
    templateId: { type: String, default: 'classic' },
    showLogo: { type: Boolean, default: true },
    watermark: { type: Boolean, default: false }
  },
  ...configMetaSchema
}, { timestamps: true });

BillConfigSchema.index({ companyId: 1, billType: 1 }, { unique: true });

module.exports = mongoose.model('BillConfig', BillConfigSchema);
