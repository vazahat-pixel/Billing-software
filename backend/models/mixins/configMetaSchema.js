const mongoose = require('mongoose');

/** Shared metadata for all dynamic config documents (versioning + soft-delete + publish). */
const configMetaSchema = {
  version: { type: Number, default: 1, min: 1 },
  isActive: { type: Boolean, default: true, index: true },
  publishedAt: { type: Date, default: Date.now },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  deletedAt: { type: Date, default: null },
  configHash: { type: String, default: '' }
};

module.exports = configMetaSchema;
