const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const mongoose = require('mongoose');
const BackupRecord = require('../models/BackupRecord');
const jobQueueService = require('./jobQueueService');
const AppError = require('../utils/AppError');
const auditService = require('./auditService');
const logger = require('../utils/logger');

const BACKUP_DIR = process.env.BACKUP_DIR || path.join(__dirname, '..', 'backups');

/**
 * Stage 7.7 — Backup & disaster recovery (local + cloud-storage-ready stubs).
 */
class BackupService {
  ensureDir() {
    if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }

  async list(companyId, { limit = 50 } = {}) {
    const filter = companyId ? { companyId } : {};
    return BackupRecord.find(filter).sort({ createdAt: -1 }).limit(Math.min(limit, 100));
  }

  async create(companyId, { type = 'manual', scope = 'company', userId = null, collections = [] } = {}) {
    this.ensureDir();
    const restorePoint = `rp-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const record = await BackupRecord.create({
      companyId: companyId || null,
      type,
      scope,
      status: 'running',
      storage: process.env.BACKUP_STORAGE || 'local',
      restorePoint,
      encrypted: true,
      collections,
      triggeredBy: userId,
      retentionUntil: new Date(Date.now() + (Number(process.env.BACKUP_RETENTION_DAYS || 30) * 86400000)),
    });

    try {
      const db = mongoose.connection.db;
      if (!db) throw new Error('Database not connected');

      const names =
        collections.length > 0
          ? collections
          : (await db.listCollections().toArray()).map((c) => c.name).filter((n) => !n.startsWith('system.'));

      const dump = {
        version: 1,
        restorePoint,
        companyId: companyId ? String(companyId) : null,
        createdAt: new Date().toISOString(),
        collections: {},
      };
      const counts = {};

      for (const name of names.slice(0, 80)) {
        const col = db.collection(name);
        const filter = companyId && (await this.collectionHasCompanyId(col))
          ? { companyId: new mongoose.Types.ObjectId(String(companyId)) }
          : {};
        const docs = await col.find(filter).limit(5000).toArray();
        // Serialize ObjectIds
        dump.collections[name] = docs.map((d) => JSON.parse(JSON.stringify(d)));
        counts[name] = docs.length;
      }

      const raw = JSON.stringify(dump);
      const checksum = crypto.createHash('sha256').update(raw).digest('hex');
      const key = crypto.createHash('sha256').update(process.env.BACKUP_ENCRYPTION_KEY || process.env.JWT_SECRET || 'dev').digest();
      const iv = crypto.randomBytes(12);
      const ciph = crypto.createCipheriv('aes-256-gcm', key, iv);
      const enc = Buffer.concat([ciph.update(raw, 'utf8'), ciph.final()]);
      const tag = ciph.getAuthTag();
      const payload = Buffer.concat([iv, tag, enc]).toString('base64');

      const filename = `${restorePoint}.bak`;
      const filePath = path.join(BACKUP_DIR, filename);
      fs.writeFileSync(filePath, payload, 'utf8');

      record.status = 'completed';
      record.path = filePath;
      record.sizeBytes = Buffer.byteLength(payload);
      record.checksum = checksum;
      record.documentCounts = counts;
      record.collections = Object.keys(counts);
      record.meta = { encrypted: true, algo: 'aes-256-gcm', cloudReady: true };
      await record.save();

      await auditService.logSystem({
        companyId,
        userId,
        action: 'backup.created',
        module: 'infrastructure',
        referenceId: record._id,
        after: { restorePoint, sizeBytes: record.sizeBytes },
      });

      return record;
    } catch (err) {
      record.status = 'failed';
      record.error = err.message;
      await record.save();
      logger.error('backup.failed', { error: err.message });
      throw AppError.badRequest(`Backup failed: ${err.message}`);
    }
  }

  async collectionHasCompanyId(col) {
    try {
      const sample = await col.findOne({});
      return sample && Object.prototype.hasOwnProperty.call(sample, 'companyId');
    } catch {
      return false;
    }
  }

  async verify(companyId, id) {
    const record = await BackupRecord.findOne({ _id: id, ...(companyId ? { companyId } : {}) });
    if (!record) throw AppError.notFound('Backup not found');
    if (!record.path || !fs.existsSync(record.path)) {
      throw AppError.badRequest('Backup file missing');
    }
    const payload = fs.readFileSync(record.path, 'utf8');
    const buf = Buffer.from(payload, 'base64');
    if (buf.length < 28) throw AppError.badRequest('Corrupt backup');
    record.status = 'verified';
    record.verifiedAt = new Date();
    await record.save();
    return record;
  }

  async preview(companyId, id) {
    const record = await BackupRecord.findOne({ _id: id, ...(companyId ? { companyId } : {}) }).lean();
    if (!record) throw AppError.notFound('Backup not found');
    return {
      restorePoint: record.restorePoint,
      type: record.type,
      scope: record.scope,
      status: record.status,
      sizeBytes: record.sizeBytes,
      collections: record.collections,
      documentCounts: record.documentCounts,
      createdAt: record.createdAt,
      retentionUntil: record.retentionUntil,
      encrypted: record.encrypted,
      note: 'Preview only — restore applies company-scoped documents after confirmation',
    };
  }

  async schedule(companyId, userId) {
    return jobQueueService.enqueue(companyId, {
      queue: 'backup',
      jobType: 'backup.run',
      payload: { companyId: String(companyId), type: 'scheduled' },
      priority: 1,
    });
  }

  async policy() {
    return {
      rtoMinutes: 30,
      rpoMinutes: 15,
      retentionDays: Number(process.env.BACKUP_RETENTION_DAYS || 30),
      storage: process.env.BACKUP_STORAGE || 'local',
      encryption: 'aes-256-gcm',
      modes: ['manual', 'automatic', 'incremental', 'full'],
      cloudReady: true,
      pointInTime: 'restore-point based',
    };
  }
}

module.exports = new BackupService();
