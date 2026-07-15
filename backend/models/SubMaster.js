const mongoose = require('mongoose');
const { enterpriseIntegrityPlugin } = require('./mixins/enterpriseMetaSchema');

const SUB_MASTER_TYPES = [
  'AccountGroup',
  'AccountHead',
  'BookType',
  'ItemGroup',
  'Unit',
  'ItemTaxSlab',
  'City',
  'Transport',
  'Type',
  'OtherMaster',
  'Color',
  'Design',
  'HSN',
  // Sprint 2.1 textile / ops expansions
  'Quality',
  'Pattern',
  'Brand',
  'Shade',
  'Process',
  'Machine',
  'Department',
  'PaymentTerms',
  'Currency',
];

const SubMasterSchema = new mongoose.Schema({
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
    index: true
  },
  type: {
    type: String,
    enum: SUB_MASTER_TYPES,
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  extraFields: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  isFavorite: { type: Boolean, default: false },
  lastUsedAt: { type: Date, default: null },
}, {
  timestamps: true
});

SubMasterSchema.index({ companyId: 1, type: 1, name: 1 }, { unique: true });
SubMasterSchema.plugin(enterpriseIntegrityPlugin);

module.exports = mongoose.model('SubMaster', SubMasterSchema);
module.exports.SUB_MASTER_TYPES = SUB_MASTER_TYPES;
