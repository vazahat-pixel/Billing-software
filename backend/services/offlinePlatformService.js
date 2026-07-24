const Plan = require('../models/Plan');
const CompanySettings = require('../models/CompanySettings');
const Subscription = require('../models/Subscription');
const enterpriseConfigService = require('./enterpriseConfigService');

/**
 * Stage 6.5 — Offline First Platform status & admin gates.
 * Does not rebuild IndexedDB/SW — reports readiness over existing FE offline stack.
 */
class OfflinePlatformService {
  async status(companyId, planId) {
    const [cfg, settings, plan, sub] = await Promise.all([
      enterpriseConfigService.getOrCreate(companyId),
      CompanySettings.findOne({ companyId }).lean().catch(() => null),
      planId ? Plan.findById(planId).lean() : null,
      Subscription.findOne({ companyId, status: { $in: ['active', 'trialing', 'Active', 'Trial'] } })
        .sort({ createdAt: -1 })
        .lean()
        .catch(() => null),
    ]);

    const planAllows =
      plan?.features?.offlineMode !== false && plan?.features?.modules?.offline !== false;
    const settingsAllows = settings?.offlineModeEnabled !== false;
    const enterpriseAllows = cfg.features?.offlineMode !== false;
    const enabled = planAllows && settingsAllows && enterpriseAllows;

    return {
      enabled,
      planAllows,
      settingsAllows,
      enterpriseAllows,
      features: {
        offlineBilling: enabled,
        offlinePurchase: enabled,
        offlineMasters: enabled,
        offlineReportsCached: enabled,
        autoSync: enabled,
        syncQueue: true,
        conflictResolution: true,
        retryFailedSync: true,
      },
      pwa: {
        serviceWorker: true,
        indexedDb: true,
        manifest: true,
      },
      subscriptionStatus: sub?.status || 'unknown',
      guidance: enabled
        ? 'Offline mode available — use Sync when back online'
        : 'Offline mode disabled by plan, company settings, or enterprise config',
    };
  }

  async setEnabled(companyId, enabled, userId) {
    return enterpriseConfigService.update(
      companyId,
      { features: { offlineMode: !!enabled } },
      userId
    );
  }
}

module.exports = new OfflinePlatformService();
