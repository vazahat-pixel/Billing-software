const mongoose = require('mongoose');

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
  }
}, {
  timestamps: true
});

// A company can only have one sub-master of a specific type with the same name
SubMasterSchema.index({ companyId: 1, type: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('SubMaster', SubMasterSchema);
module.exports.SUB_MASTER_TYPES = SUB_MASTER_TYPES;
