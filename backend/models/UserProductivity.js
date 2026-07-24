const mongoose = require('mongoose');
const { enterpriseIntegrityPlugin } = require('./mixins/enterpriseMetaSchema');

/**
 * Stage 6.9 — Per-user productivity prefs (favorites, pins, recent searches/docs).
 */
const UserProductivitySchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  recentSearches: [{
    query: { type: String },
    at: { type: Date, default: Date.now },
  }],
  pinnedRecords: [{
    kind: { type: String, required: true },
    id: { type: mongoose.Schema.Types.ObjectId, required: true },
    label: { type: String, default: '' },
    modal: { type: String, default: '' },
    pinnedAt: { type: Date, default: Date.now },
  }],
  favorites: [{
    kind: { type: String, required: true },
    id: { type: mongoose.Schema.Types.ObjectId, required: true },
    label: { type: String, default: '' },
  }],
  recentDocuments: [{
    kind: { type: String, required: true },
    id: { type: mongoose.Schema.Types.ObjectId, required: true },
    label: { type: String, default: '' },
    modal: { type: String, default: '' },
    at: { type: Date, default: Date.now },
  }],
  recentBills: [{
    kind: { type: String, enum: ['sales', 'purchase'], required: true },
    id: { type: mongoose.Schema.Types.ObjectId, required: true },
    label: { type: String, default: '' },
    at: { type: Date, default: Date.now },
  }],
  quickActions: [{ type: String }],
  drafts: [{
    module: { type: String, required: true },
    payload: { type: mongoose.Schema.Types.Mixed, default: {} },
    updatedAt: { type: Date, default: Date.now },
  }],
  shortcuts: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true });

UserProductivitySchema.index({ companyId: 1, userId: 1 }, { unique: true });
UserProductivitySchema.plugin(enterpriseIntegrityPlugin);

module.exports = mongoose.model('UserProductivity', UserProductivitySchema);
