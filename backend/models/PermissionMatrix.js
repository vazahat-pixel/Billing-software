const mongoose = require('mongoose');
const configMetaSchema = require('./mixins/configMetaSchema');

const PermissionEntrySchema = new mongoose.Schema({
  module: { type: String, required: true },
  canView: { type: Boolean, default: true },
  canCreate: { type: Boolean, default: false },
  canEdit: { type: Boolean, default: false },
  canDelete: { type: Boolean, default: false },
  canExport: { type: Boolean, default: false },
  canPrint: { type: Boolean, default: false }
}, { _id: false });

const PermissionMatrixSchema = new mongoose.Schema({
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
    unique: true,
    index: true
  },
  roles: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  sections: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  ...configMetaSchema
}, { timestamps: true });

module.exports = mongoose.model('PermissionMatrix', PermissionMatrixSchema);
