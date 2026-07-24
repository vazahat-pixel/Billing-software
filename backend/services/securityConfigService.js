const SecurityConfig = require('../models/SecurityConfig');
const FeatureFlag = require('../models/FeatureFlag');
const auditService = require('./auditService');

const DEFAULT_FLAGS = [
  { flagKey: 'infra.security', label: 'Enterprise Security', module: 'infrastructure' },
  { flagKey: 'infra.sessions', label: 'Session Management', module: 'infrastructure' },
  { flagKey: 'infra.caching', label: 'Caching Layer', module: 'infrastructure' },
  { flagKey: 'infra.queues', label: 'Background Jobs', module: 'infrastructure' },
  { flagKey: 'infra.monitoring', label: 'Observability', module: 'infrastructure' },
  { flagKey: 'infra.backups', label: 'Backup & DR', module: 'infrastructure' },
];

class SecurityConfigService {
  async getOrCreate(companyId) {
    const filter = companyId ? { companyId } : { companyId: null, scope: 'global' };
    let cfg = await SecurityConfig.findOne(filter);
    if (!cfg) {
      cfg = await SecurityConfig.create({
        companyId: companyId || null,
        scope: companyId ? 'company' : 'global',
      });
    }
    return cfg;
  }

  async update(companyId, patch, userId) {
    const cfg = await this.getOrCreate(companyId);
    for (const key of ['passwordPolicy', 'lockout', 'session', 'security', 'features']) {
      if (patch[key]) Object.assign(cfg[key], patch[key]);
    }
    await cfg.save();
    await auditService.logSystem({
      companyId,
      userId,
      action: 'security.config.updated',
      module: 'infrastructure',
      after: patch,
    });
    return cfg;
  }

  async seedFlags(companyId) {
    if (!companyId) return [];
    for (const f of DEFAULT_FLAGS) {
      await FeatureFlag.findOneAndUpdate(
        { companyId, flagKey: f.flagKey },
        { companyId, ...f, enabled: true, scope: 'module', description: `Stage 7 — ${f.label}` },
        { upsert: true }
      );
    }
    return FeatureFlag.find({ companyId, module: 'infrastructure' }).sort({ flagKey: 1 });
  }

  validatePassword(password, policy = {}) {
    const p = {
      minLength: 8,
      requireUppercase: true,
      requireLowercase: true,
      requireNumber: true,
      requireSpecial: false,
      ...policy,
    };
    const gaps = [];
    if (!password || password.length < p.minLength) gaps.push(`Min length ${p.minLength}`);
    if (p.requireUppercase && !/[A-Z]/.test(password || '')) gaps.push('Need uppercase');
    if (p.requireLowercase && !/[a-z]/.test(password || '')) gaps.push('Need lowercase');
    if (p.requireNumber && !/[0-9]/.test(password || '')) gaps.push('Need number');
    if (p.requireSpecial && !/[^A-Za-z0-9]/.test(password || '')) gaps.push('Need special character');
    return { ok: gaps.length === 0, gaps };
  }
}

module.exports = new SecurityConfigService();
