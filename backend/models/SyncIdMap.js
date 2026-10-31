const mongoose = require('mongoose');

/**
 * Desktop hybrid: local _id -> central _id for documents this device created.
 *
 * The central side generates its own _id when it applies a pushed operation
 * (syncPushService deletes payload._id before calling the service), so a document
 * created offline has two different ids. Anything replayed to the cloud afterwards
 * — a receipt against that party, an edit of that bill — must carry the CENTRAL id
 * or it would point at a document the cloud has never seen.
 *
 * Lives in the LOCAL database only; the cloud never needs it.
 */
const SyncIdMapSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    entityType: { type: String, required: true },
    localId: { type: String, required: true },
    serverId: { type: String, required: true },
  },
  { timestamps: true }
);

SyncIdMapSchema.index({ companyId: 1, localId: 1 }, { unique: true });

module.exports = mongoose.models.SyncIdMap || mongoose.model('SyncIdMap', SyncIdMapSchema);
