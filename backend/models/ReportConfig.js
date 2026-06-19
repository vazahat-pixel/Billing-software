const mongoose = require('mongoose');
const configMetaSchema = require('./mixins/configMetaSchema');

const ReportConfigSchema = new mongoose.Schema({
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
    index: true
  },
  reportKey: { type: String, required: true },
  name: { type: String, required: true },
  module: { type: String, default: 'reports' },
  enabled: { type: Boolean, default: true },
  exportFormats: {
    type: [String],
    enum: ['pdf', 'excel', 'csv', 'json'],
    default: ['pdf']
  },
  defaultFilters: { type: mongoose.Schema.Types.Mixed, default: {} },
  columns: [{
    key: String,
    label: String,
    visible: { type: Boolean, default: true },
    order: Number
  }],
  schedule: {
    enabled: { type: Boolean, default: false },
    cron: { type: String, default: '' },
    recipients: [String]
  },
  ...configMetaSchema
}, { timestamps: true });

ReportConfigSchema.index({ companyId: 1, reportKey: 1 }, { unique: true });

module.exports = mongoose.model('ReportConfig', ReportConfigSchema);
