const BusinessRule = require('../models/BusinessRule');
const ProfitSnapshot = require('../models/ProfitSnapshot');
const Sales = require('../models/Sales');
const Purchase = require('../models/Purchase');
const DomainEvent = require('../models/DomainEvent');
const AppError = require('../utils/AppError');
const voucherSeriesService = require('./voucherSeriesService');
const notificationDispatch = require('./notificationDispatchService');
const outstandingRefresh = require('./outstandingRefreshService');
const duplicateDetection = require('./duplicateDetectionService');
const inventoryEngineService = require('./inventoryEngineService');

const DEFAULT_RULES = [
  {
    ruleKey: 'sales_approval_threshold',
    name: 'Sales approval above amount',
    category: 'approval',
    conditions: { module: 'sales', minAmount: 100000, requireApproval: true },
    actions: { requireApproval: true, notify: true },
    notes: 'SO / invoices above ₹1L require approval',
  },
  {
    ruleKey: 'purchase_approval_threshold',
    name: 'Purchase approval above amount',
    category: 'approval',
    conditions: { module: 'purchase', minAmount: 50000, requireApproval: true },
    actions: { requireApproval: true, notify: true },
  },
  {
    ruleKey: 'sales_duplicate_soft',
    name: 'Duplicate sales soft warn (24h)',
    category: 'duplicate',
    blocking: false,
    conditions: { module: 'sales', duplicateWindowHours: 24, duplicateCheckFields: ['customerId', 'netAmount'] },
    actions: { notify: true },
  },
  {
    ruleKey: 'low_stock_notify',
    name: 'Low stock notification',
    category: 'stock',
    conditions: { module: 'inventory' },
    actions: { notify: true },
  },
  {
    ruleKey: 'outstanding_refresh_on_invoice',
    name: 'Refresh outstanding on invoice',
    category: 'general',
    conditions: { module: 'sales' },
    actions: { refreshOutstanding: true, notify: false },
  },
];

class BusinessAutomationService {
  async pipeline(companyId) {
    const [rules, unread, series, outstanding, lowStock, recentEvents] = await Promise.all([
      BusinessRule.countDocuments({ companyId, enabled: true }),
      notificationDispatch.unreadCount(companyId),
      voucherSeriesService.listSeries(companyId).then((r) => r.length),
      outstandingRefresh.refreshCompanyOutstandingSummary(companyId),
      inventoryEngineService.lowStockAlerts(companyId).catch(() => []),
      DomainEvent.find({ companyId }).sort({ createdAt: -1 }).limit(10).lean().catch(() => []),
    ]);

    return {
      enabledRules: rules,
      unreadNotifications: unread,
      voucherSeriesCount: series,
      outstanding,
      lowStockCount: Array.isArray(lowStock) ? lowStock.length : 0,
      recentEvents: (recentEvents || []).map((e) => ({
        eventType: e.eventType,
        createdAt: e.createdAt,
        processedAt: e.processedAt,
      })),
    };
  }

  async seedDefaults(companyId) {
    await voucherSeriesService.ensureDefaultSeries(companyId);
    for (const rule of DEFAULT_RULES) {
      await BusinessRule.findOneAndUpdate(
        { companyId, ruleKey: rule.ruleKey },
        { companyId, ...rule, enabled: true },
        { upsert: true, new: true }
      );
    }
    return { series: true, rules: DEFAULT_RULES.length };
  }

  async listRules(companyId) {
    let rules = await BusinessRule.find({ companyId }).sort({ category: 1, name: 1 });
    if (!rules.length) {
      await this.seedDefaults(companyId);
      rules = await BusinessRule.find({ companyId }).sort({ category: 1, name: 1 });
    }
    return rules;
  }

  async upsertRule(companyId, data) {
    if (!data.ruleKey || !data.name) throw AppError.badRequest('ruleKey and name required');
    return BusinessRule.findOneAndUpdate(
      { companyId, ruleKey: data.ruleKey },
      {
        companyId,
        ruleKey: data.ruleKey,
        name: data.name,
        category: data.category || 'general',
        enabled: data.enabled !== false,
        blocking: !!data.blocking,
        conditions: data.conditions || {},
        actions: data.actions || {},
        notes: data.notes || '',
      },
      { upsert: true, new: true }
    );
  }

  async evaluateApproval(companyId, { module, amount }) {
    const rules = await BusinessRule.find({
      companyId,
      enabled: true,
      category: 'approval',
      'conditions.module': module,
    }).lean();

    for (const rule of rules) {
      const min = rule.conditions?.minAmount;
      if (min != null && Number(amount) >= Number(min) && (rule.actions?.requireApproval || rule.conditions?.requireApproval)) {
        return {
          requiresApproval: true,
          ruleKey: rule.ruleKey,
          threshold: min,
          message: `${rule.name}: amount ${amount} ≥ ${min}`,
        };
      }
    }
    return { requiresApproval: false };
  }

  async checkDuplicates(companyId, module, payload) {
    const rule = await BusinessRule.findOne({
      companyId,
      enabled: true,
      category: 'duplicate',
      'conditions.module': module,
    }).lean();

    const windowHours = rule?.conditions?.duplicateWindowHours || 24;
    let hits = [];
    if (module === 'sales') {
      hits = await duplicateDetection.findSalesDuplicates(companyId, { ...payload, windowHours });
    } else if (module === 'purchase') {
      hits = await duplicateDetection.findPurchaseDuplicates(companyId, { ...payload, windowHours });
    }

    return {
      hasDuplicates: hits.length > 0,
      blocking: !!rule?.blocking,
      hits,
      message: hits.length ? `Possible duplicate (${hits.length}) in last ${windowHours}h` : null,
    };
  }

  async runLowStockScan(companyId) {
    const alerts = await inventoryEngineService.lowStockAlerts(companyId);
    for (const a of alerts.slice(0, 20)) {
      await notificationDispatch.dispatch(companyId, 'automation.low_stock', {
        title: `Low stock: ${a.itemName}`,
        body: `Available ${a.availableMtrs} ${a.unit || 'mtrs'} below threshold ${a.threshold}`,
        severity: 'warning',
        referenceType: 'Item',
        referenceId: a.itemId,
        meta: a,
      });
    }
    return alerts;
  }

  async runOverdueScan(companyId) {
    const overdue = await outstandingRefresh.listOverdueSales(companyId, { daysPastDue: 1 });
    for (const inv of overdue.slice(0, 20)) {
      await notificationDispatch.dispatch(companyId, 'automation.overdue', {
        title: `Overdue: ${inv.invoiceNo}`,
        body: `${inv.customerId?.name || 'Customer'} — ₹${inv.outstanding} (${inv.daysOverdue}d)`,
        severity: inv.daysOverdue > 30 ? 'critical' : 'warning',
        referenceType: 'Sales',
        referenceId: inv._id,
        meta: { outstanding: inv.outstanding, daysOverdue: inv.daysOverdue },
      });
    }
    return overdue;
  }

  async createProfitSnapshot(companyId, { periodFrom, periodTo } = {}) {
    const from = periodFrom ? new Date(periodFrom) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const to = periodTo ? new Date(periodTo) : new Date();

    const [sales, purchases] = await Promise.all([
      Sales.find({ companyId, date: { $gte: from, $lte: to }, status: { $ne: 'cancelled' } })
        .select('taxableAmount')
        .lean(),
      Purchase.find({ companyId, date: { $gte: from, $lte: to }, status: { $ne: 'cancelled' } })
        .select('taxableAmount')
        .lean(),
    ]);

    const salesTaxable = sales.reduce((s, i) => s + (i.taxableAmount || 0), 0);
    const purchaseTaxable = purchases.reduce((s, i) => s + (i.taxableAmount || 0), 0);
    // Estimated COGS proxy = purchases in period (documented — not full absorption costing)
    const estimatedCogs = purchaseTaxable;
    const estimatedGrossProfit = salesTaxable - estimatedCogs;

    return ProfitSnapshot.create({
      companyId,
      snapshotDate: new Date(),
      periodFrom: from,
      periodTo: to,
      salesTaxable: Number(salesTaxable.toFixed(2)),
      purchaseTaxable: Number(purchaseTaxable.toFixed(2)),
      estimatedCogs: Number(estimatedCogs.toFixed(2)),
      estimatedGrossProfit: Number(estimatedGrossProfit.toFixed(2)),
    });
  }

  async listProfitSnapshots(companyId, { limit = 20 } = {}) {
    return ProfitSnapshot.find({ companyId }).sort({ snapshotDate: -1 }).limit(limit);
  }

  async allocateNumber(companyId, module, opts) {
    return voucherSeriesService.allocateNext(companyId, module, opts);
  }

  async listSeries(companyId, module) {
    return voucherSeriesService.listSeries(companyId, module);
  }

  async listNotifications(companyId, q) {
    return notificationDispatch.listInbox(companyId, q);
  }

  async markNotificationRead(companyId, id) {
    return notificationDispatch.markRead(companyId, id);
  }

  async getOutstanding(companyId, partyId) {
    if (partyId) return outstandingRefresh.refreshPartyOutstanding(companyId, partyId);
    return outstandingRefresh.refreshCompanyOutstandingSummary(companyId);
  }
}

module.exports = new BusinessAutomationService();
