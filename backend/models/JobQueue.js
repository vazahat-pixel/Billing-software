const mongoose = require('mongoose');
const { enterpriseIntegrityPlugin } = require('./mixins/enterpriseMetaSchema');

/**
 * Stage 7.4 — Mongo-backed job queue (Redis optional later).
 */
const JobQueueSchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', default: null, index: true },
  queue: {
    type: String,
    enum: [
      'default',
      'notification',
      'email',
      'whatsapp',
      'gst',
      'report',
      'export',
      'backup',
    ],
    default: 'default',
    index: true,
  },
  jobType: { type: String, required: true, index: true },
  payload: { type: mongoose.Schema.Types.Mixed, default: {} },
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed', 'dead', 'cancelled'],
    default: 'pending',
    index: true,
  },
  attempts: { type: Number, default: 0 },
  maxAttempts: { type: Number, default: 3 },
  nextRunAt: { type: Date, default: Date.now, index: true },
  lockedAt: { type: Date, default: null },
  lockedBy: { type: String, default: '' },
  lastError: { type: String, default: '' },
  result: { type: mongoose.Schema.Types.Mixed, default: null },
  completedAt: { type: Date, default: null },
  priority: { type: Number, default: 0, index: true },
  scheduleCron: { type: String, default: '' },
}, { timestamps: true });

JobQueueSchema.index({ status: 1, queue: 1, nextRunAt: 1, priority: -1 });
JobQueueSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 3600 });
JobQueueSchema.plugin(enterpriseIntegrityPlugin);

module.exports = mongoose.model('JobQueue', JobQueueSchema);
