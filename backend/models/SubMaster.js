const mongoose = require('mongoose');

const SubMasterSchema = new mongoose.Schema({
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
    index: true
  },
  type: {
    type: String,
    enum: ['AccountGroup', 'ItemGroup', 'City', 'Transport', 'Color', 'Design'],
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
