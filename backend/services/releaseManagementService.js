const fs = require('fs');
const path = require('path');
const ReleaseRecord = require('../models/ReleaseRecord');
const AppError = require('../utils/AppError');
const auditService = require('./auditService');

const PRODUCT_VERSION = '1.0.0';

/**
 * Stage 8.9 — Release management.
 */
class ReleaseManagementService {
  currentVersion() {
    return {
      product: PRODUCT_VERSION,
      codename: 'Commercial Launch',
      stage: 8,
      api: '1.0.0',
      desktop: '1.0.0',
      semver: PRODUCT_VERSION,
      channels: ['stable', 'rc', 'hotfix', 'lts'],
    };
  }

  async list() {
    return ReleaseRecord.find().sort({ createdAt: -1 }).limit(50);
  }

  async latest() {
    return ReleaseRecord.findOne({ status: { $in: ['approved', 'released'] } }).sort({ releasedAt: -1, createdAt: -1 });
  }

  async upsert(data, userId) {
    if (!data.version) throw AppError.badRequest('version required');
    const row = await ReleaseRecord.findOneAndUpdate(
      { version: data.version },
      { ...data },
      { upsert: true, new: true }
    );
    await auditService.logSystem({
      companyId: null,
      userId,
      action: 'release.upsert',
      module: 'commercial',
      after: { version: row.version, status: row.status },
    });
    return row;
  }

  async approve(version, userId, scores = {}) {
    const row = await ReleaseRecord.findOne({ version });
    if (!row) throw AppError.notFound('Release not found');
    row.status = 'approved';
    row.approvedBy = userId;
    row.approvedAt = new Date();
    if (scores && Object.keys(scores).length) {
      Object.assign(row.scores, scores);
      row.scores.overall = scores.overall || row.scores.overall;
    }
    await row.save();
    return row;
  }

  async markReleased(version, userId) {
    const row = await ReleaseRecord.findOne({ version });
    if (!row) throw AppError.notFound('Release not found');
    if (row.status !== 'approved' && row.status !== 'rc') {
      throw AppError.badRequest('Release must be approved or RC before shipping');
    }
    row.status = 'released';
    row.releasedAt = new Date();
    await row.save();
    await auditService.logSystem({
      companyId: null,
      userId,
      action: 'release.shipped',
      module: 'commercial',
      after: { version },
    });
    return row;
  }

  async ensureV1() {
    return this.upsert({
      version: PRODUCT_VERSION,
      channel: 'stable',
      status: 'rc',
      title: 'Textile ERP SaaS Version 1.0 — Commercial Launch',
      notes: 'Production-ready commercial release candidate',
      changelog: [
        'Stages 1–7 foundation complete',
        'Enterprise productivity & infrastructure certified',
        'Desktop packaging scaffold',
        'Commercial licensing & onboarding',
        'Full documentation pack',
      ],
      migrationRequired: false,
      rollbackVersion: '0.9.0',
      desktopBuild: 'desktop/',
    });
  }

  documentationIndex() {
    const docsRoot = path.join(__dirname, '..', '..', 'docs');
    const guides = path.join(docsRoot, 'guides');
    const files = [];
    const walk = (dir, prefix = '') => {
      if (!fs.existsSync(dir)) return;
      for (const f of fs.readdirSync(dir)) {
        const full = path.join(dir, f);
        if (fs.statSync(full).isDirectory()) walk(full, `${prefix}${f}/`);
        else if (f.endsWith('.md')) files.push(`${prefix}${f}`);
      }
    };
    walk(guides);
    walk(path.join(docsRoot, 'TECHNICAL_DUE_DILIGENCE'));
    return {
      guides: files.filter((f) => !f.includes('TECHNICAL')),
      technical: files.filter((f) => f.includes('/') || true),
      helpCenter: [
        'Administrator Guide',
        'User Guide',
        'Quick Start',
        'Installation',
        'Upgrade',
        'Backup & Recovery',
        'Troubleshooting',
        'Keyboard Shortcuts',
        'API Docs',
        'Architecture',
      ],
    };
  }

  desktopStatus() {
    const desktopDir = path.join(__dirname, '..', '..', 'desktop');
    return {
      scaffold: fs.existsSync(desktopDir),
      electron: fs.existsSync(path.join(desktopDir, 'package.json')),
      main: fs.existsSync(path.join(desktopDir, 'main.js')),
      installerConfig: fs.existsSync(path.join(desktopDir, 'electron-builder.yml')),
      autoUpdate: fs.existsSync(path.join(desktopDir, 'updater.js')),
    };
  }
}

module.exports = new ReleaseManagementService();
