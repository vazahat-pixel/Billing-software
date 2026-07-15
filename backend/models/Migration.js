/**
 * Schema Migration Registry — versioned, idempotent migrations.
 * Never edit applied migration files; add new versions instead.
 */
const mongoose = require('mongoose');

const MigrationSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true }, // e.g. "001_core_indexes"
    name: { type: String, required: true },
    appliedAt: { type: Date, default: Date.now },
    checksum: { type: String, default: '' },
    notes: { type: String, default: '' },
  },
  { timestamps: true, collection: '_migrations' }
);

module.exports = mongoose.model('Migration', MigrationSchema);
