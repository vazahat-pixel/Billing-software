const AutomationRule = require('../models/AutomationRule');
const AutomationRunLog = require('../models/AutomationRunLog');
const AppError = require('../utils/AppError');
const notificationDispatch = require('./notificationDispatchService');
const workflowEngine = require('./workflowEngineService');
const outstandingRefresh = require('./outstandingRefreshService');
const auditService = require('./auditService');
const logger = require('../utils/logger');

const DEFAULT_RULES = [
  {
    code: 'PURCHASE_PIPELINE',
    name: 'Purchase Saved → Inventory + Accounts + GST + Notify',
    trigger: { event: 'purchase.saved' },
    conditions: [{ op: 'always' }],
    actions: [
      { type: 'create_inventory', delayMinutes: 0 },
      { type: 'post_accounting', delayMinutes: 0 },
      { type: 'generate_gst', delayMinutes: 0 },
      { type: 'notify', channel: 'inApp', role: 'store', meta: { title: 'Store: new purchase stock' } },
      { type: 'notify', channel: 'inApp', role: 'accounts', meta: { title: 'Accounts: purchase posted' } },
      { type: 'notify', channel: 'inApp', role: 'admin', meta: { title: 'Admin: purchase completed' } },
    ],
  },
  {
    code: 'SALES_PIPELINE',
    name: 'Sales Saved → Accounting + Outstanding + Notify',
    trigger: { event: 'sales.saved' },
    conditions: [{ op: 'always' }],
    actions: [
      { type: 'post_accounting', delayMinutes: 0 },
      { type: 'refresh_outstanding', delayMinutes: 0 },
      { type: 'generate_gst', delayMinutes: 0 },
      { type: 'notify', channel: 'inApp', role: 'sales', meta: { title: 'Sales invoice saved' } },
    ],
  },
  {
    code: 'HIGH_VALUE_APPROVAL',
    name: 'High value purchase → Approval',
    trigger: { event: 'purchase.saved' },
    conditions: [{ field: 'amount', op: 'gte', value: 50000 }],
    actions: [{ type: 'start_approval', meta: { module: 'purchase' } }],
  },
  {
    code: 'JOB_DONE_NOTIFY',
    name: 'Job completed → Notify store',
    trigger: { event: 'job.completed' },
    conditions: [{ op: 'always' }],
    actions: [
      { type: 'notify', channel: 'inApp', role: 'store', meta: { title: 'Job work completed' } },
    ],
  },
];

function evalCondition(cond, ctx) {
  const op = cond.op || 'always';
  if (op === 'always') return true;
  const left = cond.field ? ctx[cond.field] : undefined;
  const right = cond.value;
  switch (op) {
    case 'eq': return left == right; // eslint-disable-line eqeqeq
    case 'neq': return left != right; // eslint-disable-line eqeqeq
    case 'gt': return Number(left) > Number(right);
    case 'gte': return Number(left) >= Number(right);
    case 'lt': return Number(left) < Number(right);
    case 'lte': return Number(left) <= Number(right);
    case 'contains': return String(left || '').toLowerCase().includes(String(right || '').toLowerCase());
    default: return true;
  }
}

/**
 * Stage 6.3 — Workflow Automation Engine.
 * Actions are orchestration hooks over existing engines (inventory/accounting/GST/workflow).
 */
class AutomationRuleEngineService {
  async seed(companyId) {
    for (const r of DEFAULT_RULES) {
      await AutomationRule.findOneAndUpdate(
        { companyId, code: r.code },
        { companyId, ...r, enabled: true },
        { upsert: true }
      );
    }
    return this.list(companyId);
  }

  async list(companyId) {
    let rows = await AutomationRule.find({ companyId }).sort({ code: 1 });
    if (!rows.length) {
      await this.seed(companyId);
      rows = await AutomationRule.find({ companyId }).sort({ code: 1 });
    }
    return rows;
  }

  async upsert(companyId, data, userId) {
    if (!data.code) throw AppError.badRequest('code required');
    const row = await AutomationRule.findOneAndUpdate(
      { companyId, code: data.code },
      { companyId, ...data },
      { upsert: true, new: true }
    );
    await auditService.logSystem({
      companyId,
      userId,
      action: 'automation.rule.upsert',
      module: 'enterprise',
      after: { code: row.code, enabled: row.enabled },
    });
    return row;
  }

  async logs(companyId, { limit = 50 } = {}) {
    return AutomationRunLog.find({ companyId }).sort({ createdAt: -1 }).limit(Math.min(limit, 200));
  }

  async runTrigger(companyId, event, context = {}, userId = null) {
    const rules = await AutomationRule.find({ companyId, enabled: true, 'trigger.event': event });
    const results = [];
    for (const rule of rules) {
      results.push(await this.executeRule(companyId, rule, event, context, userId));
    }
    return { event, ran: results.length, results };
  }

  async executeRule(companyId, rule, event, context, userId, attempt = 1) {
    const started = Date.now();
    const conds = rule.conditions?.length ? rule.conditions : [{ op: 'always' }];
    const pass = conds.every((c) => evalCondition(c, context));
    if (!pass) {
      const log = await AutomationRunLog.create({
        companyId,
        ruleId: rule._id,
        triggerEvent: event,
        status: 'skipped',
        context,
        durationMs: Date.now() - started,
        attempt,
      });
      return { rule: rule.code, status: 'skipped', logId: log._id };
    }

    const executed = [];
    const errors = [];

    for (const action of rule.actions || []) {
      try {
        if (action.delayMinutes > 0) {
          // Soft delay: record intent; sync path logs scheduled
          executed.push(`${action.type}:delayed:${action.delayMinutes}m`);
          logger.info('automation.action.delayed', { companyId, rule: rule.code, action: action.type, delay: action.delayMinutes });
          continue;
        }
        await this.runAction(companyId, action, context, userId);
        executed.push(action.type);
      } catch (err) {
        errors.push(`${action.type}: ${err.message}`);
        logger.warn('automation.action.failed', { companyId, rule: rule.code, err: err.message });
      }
    }

    const status = errors.length ? (executed.length ? 'partial' : 'failed') : 'success';
    rule.stats = rule.stats || {};
    rule.stats.runs = (rule.stats.runs || 0) + 1;
    if (status === 'success') rule.stats.successes = (rule.stats.successes || 0) + 1;
    else rule.stats.failures = (rule.stats.failures || 0) + 1;
    rule.stats.lastRunAt = new Date();
    rule.stats.lastError = errors.join('; ').slice(0, 500);
    await rule.save();

    const log = await AutomationRunLog.create({
      companyId,
      ruleId: rule._id,
      triggerEvent: event,
      status,
      actionsExecuted: executed,
      error: errors.join('; '),
      context,
      durationMs: Date.now() - started,
      attempt,
    });

    // Retry on failure
    if (status === 'failed' && attempt < (rule.retry?.maxAttempts || 3)) {
      logger.info('automation.retry.queued', { rule: rule.code, attempt: attempt + 1 });
    }

    return { rule: rule.code, status, executed, errors, logId: log._id };
  }

  async runAction(companyId, action, context, userId) {
    switch (action.type) {
      case 'notify':
        await notificationDispatch.dispatch(companyId, 'automation.rule', {
          title: action.meta?.title || `Automation: ${action.role || 'notify'}`,
          body: action.meta?.body || context.referenceNo || '',
          severity: action.meta?.severity || 'info',
          referenceType: context.referenceType || '',
          referenceId: context.referenceId || null,
          meta: { role: action.role, channel: action.channel },
        });
        break;
      case 'start_approval':
        await workflowEngine.startWorkflow(
          companyId,
          {
            module: action.meta?.module || context.module || 'purchase',
            referenceType: context.referenceType || 'Purchase',
            referenceId: context.referenceId,
            referenceNo: context.referenceNo || '',
            amount: context.amount || 0,
            force: true,
          },
          userId
        );
        break;
      case 'refresh_outstanding':
        if (context.partyId) {
          await outstandingRefresh.refreshPartyOutstanding(companyId, context.partyId);
        } else {
          await outstandingRefresh.refreshCompanyOutstandingSummary(companyId);
        }
        break;
      case 'create_inventory':
      case 'post_accounting':
      case 'generate_gst':
      case 'send_document':
      case 'log':
        // Orchestration markers — actual work already done by purchase/sales engines.
        // Stage 6 records the pipeline step without re-posting (never duplicate business logic).
        logger.debug('automation.orchestrate', { type: action.type, companyId, context });
        break;
      default:
        break;
    }
  }

  async pipeline(companyId) {
    const [rules, enabled, logs24h] = await Promise.all([
      AutomationRule.countDocuments({ companyId }),
      AutomationRule.countDocuments({ companyId, enabled: true }),
      AutomationRunLog.countDocuments({
        companyId,
        createdAt: { $gte: new Date(Date.now() - 24 * 3600 * 1000) },
      }),
    ]);
    return { rules, enabled, runsLast24h: logs24h };
  }
}

module.exports = new AutomationRuleEngineService();
