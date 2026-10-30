const mongoose = require('mongoose');

/** One import of an old software's data. Documents created by the run are listed in `created` so Undo can remove exactly them. */
const MigrationRunSchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  source: { type: String, default: 'JSM' },
  status: { type: String, enum: ['created', 'uploading', 'uploaded', 'invalid', 'applying', 'applied', 'failed', 'undone'], default: 'created', index: true },
  filePath: { type: String, default: '' },
  uploadedBytes: { type: Number, default: 0 },
  header: { type: mongoose.Schema.Types.Mixed, default: null },
  problems: [{ type: String }],
  progress: { stage: { type: String, default: '' }, done: { type: Number, default: 0 }, total: { type: Number, default: 0 } },
  summary: { type: mongoose.Schema.Types.Mixed, default: null }, // counts, warnings, expected totals
  reconciliation: { type: mongoose.Schema.Types.Mixed, default: null },
  // accounts that were already here and took JSM's opening / head / code: their earlier values, put back by undo
  restores: { type: mongoose.Schema.Types.Mixed, default: null },
  error: { type: String, default: '' },
  appliedAt: { type: Date, default: null },
  undoneAt: { type: Date, default: null },
}, { timestamps: true });

/** Ids of the created documents, per collection (chunked so a run never nears the 16 MB document limit). */
const MigrationRunDocsSchema = new mongoose.Schema({
  runId: { type: mongoose.Schema.Types.ObjectId, ref: 'MigrationRun', required: true, index: true },
  model: { type: String, required: true },
  ids: [{ type: mongoose.Schema.Types.ObjectId }],
});

module.exports = {
  MigrationRun: mongoose.models.MigrationRun || mongoose.model('MigrationRun', MigrationRunSchema),
  MigrationRunDocs: mongoose.models.MigrationRunDocs || mongoose.model('MigrationRunDocs', MigrationRunDocsSchema),
};
