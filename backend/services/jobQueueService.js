const JobQueue = require('../models/JobQueue');
const logger = require('../utils/logger');
const AppError = require('../utils/AppError');

const WORKER_ID = `worker-${process.pid}-${Date.now().toString(36)}`;
let intervalHandle = null;
const handlers = new Map();

/**
 * Stage 7.4 — Background job queue (Mongo-backed, Redis-optional later).
 */
class JobQueueService {
  registerHandler(jobType, fn) {
    handlers.set(jobType, fn);
  }

  async enqueue(companyId, { queue = 'default', jobType, payload = {}, maxAttempts = 3, delayMs = 0, priority = 0, scheduleCron = '' }) {
    if (!jobType) throw AppError.badRequest('jobType required');
    return JobQueue.create({
      companyId: companyId || null,
      queue,
      jobType,
      payload,
      maxAttempts,
      nextRunAt: new Date(Date.now() + (delayMs || 0)),
      priority,
      scheduleCron,
      status: 'pending',
    });
  }

  async list(companyId, { status, queue, limit = 50 } = {}) {
    const filter = {};
    if (companyId) filter.companyId = companyId;
    if (status) filter.status = status;
    if (queue) filter.queue = queue;
    return JobQueue.find(filter).sort({ createdAt: -1 }).limit(Math.min(limit, 200));
  }

  async stats(companyId) {
    const match = companyId ? { companyId } : {};
    const rows = await JobQueue.aggregate([
      { $match: match },
      { $group: { _id: { status: '$status', queue: '$queue' }, count: { $sum: 1 } } },
    ]);
    const byStatus = {};
    const byQueue = {};
    for (const r of rows) {
      byStatus[r._id.status] = (byStatus[r._id.status] || 0) + r.count;
      byQueue[r._id.queue] = (byQueue[r._id.queue] || 0) + r.count;
    }
    return { byStatus, byQueue, workerId: WORKER_ID, polling: !!intervalHandle };
  }

  async processOne() {
    const now = new Date();
    const job = await JobQueue.findOneAndUpdate(
      {
        status: 'pending',
        nextRunAt: { $lte: now },
      },
      {
        $set: { status: 'processing', lockedAt: now, lockedBy: WORKER_ID },
        $inc: { attempts: 1 },
      },
      { sort: { priority: -1, nextRunAt: 1 }, new: true }
    );
    if (!job) return null;

    const handler = handlers.get(job.jobType) || defaultHandler;
    try {
      const result = await handler(job);
      job.status = 'completed';
      job.result = result || { ok: true };
      job.completedAt = new Date();
      job.lastError = '';
      await job.save();
      return job;
    } catch (err) {
      job.lastError = err.message;
      if (job.attempts >= job.maxAttempts) {
        job.status = 'dead';
      } else {
        job.status = 'pending';
        job.nextRunAt = new Date(Date.now() + Math.min(60, job.attempts * 5) * 60 * 1000);
      }
      await job.save();
      logger.warn('job.failed', { jobType: job.jobType, id: job._id, error: err.message });
      return job;
    }
  }

  startWorker({ intervalMs = 5000 } = {}) {
    if (intervalHandle) return;
    // Register built-in handlers once
    this.registerDefaults();
    intervalHandle = setInterval(() => {
      this.processOne().catch((err) => logger.debug('job.poll.error', { error: err.message }));
    }, intervalMs);
    if (typeof intervalHandle.unref === 'function') intervalHandle.unref();
    logger.info('job.worker.started', { workerId: WORKER_ID, intervalMs });
  }

  stopWorker() {
    if (intervalHandle) {
      clearInterval(intervalHandle);
      intervalHandle = null;
      logger.info('job.worker.stopped');
    }
  }

  registerDefaults() {
    const noopOk = async (job) => ({ queued: true, type: job.jobType, at: new Date().toISOString() });
    for (const t of [
      'notification.dispatch',
      'email.send',
      'whatsapp.send',
      'gst.generate',
      'report.build',
      'export.build',
      'backup.run',
    ]) {
      if (!handlers.has(t)) this.registerHandler(t, noopOk);
    }
  }

  async retryDead(id, companyId) {
    const filter = { _id: id, status: 'dead' };
    if (companyId) filter.companyId = companyId;
    return JobQueue.findOneAndUpdate(
      filter,
      { status: 'pending', nextRunAt: new Date(), lastError: '', attempts: 0 },
      { new: true }
    );
  }
}

async function defaultHandler(job) {
  logger.debug('job.default', { jobType: job.jobType });
  return { ok: true, stub: true };
}

module.exports = new JobQueueService();
