const EnterpriseConfig = require('../models/EnterpriseConfig');
const FeatureFlag = require('../models/FeatureFlag');
const auditService = require('./auditService');

const DEFAULT_FLAGS = [
  { flagKey: 'enterprise.search', label: 'Global Search', module: 'enterprise' },
  { flagKey: 'enterprise.command_palette', label: 'Command Palette', module: 'enterprise' },
  { flagKey: 'enterprise.notifications', label: 'Notification Center', module: 'enterprise' },
  { flagKey: 'enterprise.automation', label: 'Workflow Automation', module: 'enterprise' },
  { flagKey: 'enterprise.approvals', label: 'Approval Engine', module: 'enterprise' },
  { flagKey: 'enterprise.offline', label: 'Offline Mode', module: 'enterprise' },
  { flagKey: 'enterprise.communication', label: 'Communication Hub', module: 'enterprise' },
  { flagKey: 'enterprise.documents', label: 'Document Engine', module: 'enterprise' },
  { flagKey: 'enterprise.bi', label: 'BI Dashboards', module: 'enterprise' },
  { flagKey: 'enterprise.productivity', label: 'Productivity Tools', module: 'enterprise' },
];

class EnterpriseConfigService {
  async getOrCreate(companyId) {
    let cfg = await EnterpriseConfig.findOne({ companyId });
    if (!cfg) {
      cfg = await EnterpriseConfig.create({ companyId });
    }
    return cfg;
  }

  async update(companyId, patch, userId) {
    const cfg = await this.getOrCreate(companyId);
    if (patch.features) Object.assign(cfg.features, patch.features);
    if (patch.channels) Object.assign(cfg.channels, patch.channels);
    if (patch.shortcuts) Object.assign(cfg.shortcuts, patch.shortcuts);
    if (patch.meta) cfg.meta = { ...cfg.meta, ...patch.meta };
    await cfg.save();
    await auditService.logSystem({
      companyId,
      userId,
      action: 'enterprise.config.updated',
      module: 'enterprise',
      after: { features: cfg.features, channels: cfg.channels },
    });
    return cfg;
  }

  async seedFeatureFlags(companyId) {
    for (const f of DEFAULT_FLAGS) {
      await FeatureFlag.findOneAndUpdate(
        { companyId, flagKey: f.flagKey },
        {
          companyId,
          ...f,
          enabled: true,
          scope: 'module',
          description: `Stage 6 — ${f.label}`,
        },
        { upsert: true }
      );
    }
    return FeatureFlag.find({ companyId, module: 'enterprise' }).sort({ flagKey: 1 });
  }

  async isEnabled(companyId, featureKey) {
    const cfg = await this.getOrCreate(companyId);
    return cfg.features?.[featureKey] !== false;
  }

  async overview(companyId) {
    const cfg = await this.getOrCreate(companyId);
    const flags = await FeatureFlag.find({ companyId, module: 'enterprise' }).lean();
    return {
      config: cfg,
      flags,
      stage: 6,
      name: 'Enterprise Productivity Platform',
    };
  }
}

module.exports = new EnterpriseConfigService();
