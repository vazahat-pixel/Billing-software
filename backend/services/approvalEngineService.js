const workflowEngine = require('./workflowEngineService');
const WorkflowDefinition = require('../models/WorkflowDefinition');
const WorkflowInstance = require('../models/WorkflowInstance');
const AppError = require('../utils/AppError');
const auditService = require('./auditService');

/**
 * Stage 6.4 — Approval Engine.
 * Extends Stage 2.8 workflow with additional approval types & maker-checker helpers.
 * Never duplicates decide/start logic — delegates to workflowEngineService.
 */
const EXTRA_DEFS = [
  {
    code: 'PAYMENT_APPROVAL',
    name: 'Payment Approval',
    module: 'general',
    minAmount: 25000,
    steps: [
      { sequence: 1, name: 'Maker check', role: 'accountant', escalateAfterHours: 12 },
      { sequence: 2, name: 'Checker approve', role: 'manager', escalateAfterHours: 24 },
    ],
  },
  {
    code: 'JOURNAL_APPROVAL',
    name: 'Journal Approval',
    module: 'general',
    minAmount: 0,
    steps: [
      { sequence: 1, name: 'Accountant review', role: 'accountant', escalateAfterHours: 12 },
      { sequence: 2, name: 'Owner approve', role: 'owner', escalateAfterHours: 24 },
    ],
  },
  {
    code: 'STOCK_ADJ_APPROVAL',
    name: 'Stock Adjustment Approval',
    module: 'stock',
    minAmount: 0,
    steps: [{ sequence: 1, name: 'Inventory manager', role: 'manager', escalateAfterHours: 24 }],
  },
  {
    code: 'SALES_APPROVAL',
    name: 'Sales Approval',
    module: 'sales',
    minAmount: 100000,
    steps: [
      { sequence: 1, name: 'Sales manager', role: 'manager', escalateAfterHours: 24 },
      { sequence: 2, name: 'Owner', role: 'owner', escalateAfterHours: 48 },
    ],
  },
];

class ApprovalEngineService {
  async seed(companyId) {
    await workflowEngine.seedDefinitions(companyId);
    for (const d of EXTRA_DEFS) {
      await WorkflowDefinition.findOneAndUpdate(
        { companyId, code: d.code },
        { companyId, ...d, enabled: true },
        { upsert: true }
      );
    }
    return this.listDefinitions(companyId);
  }

  async listDefinitions(companyId) {
    let defs = await WorkflowDefinition.find({ companyId }).sort({ module: 1, code: 1 });
    if (!defs.length) {
      await this.seed(companyId);
      defs = await WorkflowDefinition.find({ companyId }).sort({ module: 1, code: 1 });
    }
    return defs;
  }

  async updateDefinition(companyId, code, patch, userId) {
    const def = await WorkflowDefinition.findOneAndUpdate(
      { companyId, code },
      { $set: patch },
      { new: true }
    );
    if (!def) throw AppError.notFound('Approval definition not found');
    await auditService.logSystem({
      companyId,
      userId,
      action: 'approval.definition.updated',
      module: 'enterprise',
      after: { code, enabled: def.enabled, minAmount: def.minAmount },
    });
    return def;
  }

  async start(companyId, data, userId) {
    return workflowEngine.startWorkflow(companyId, data, userId);
  }

  async decide(companyId, id, body, userId) {
    return workflowEngine.decide(companyId, id, body, userId);
  }

  async reject(companyId, id, note, userId) {
    return workflowEngine.decide(companyId, id, { approve: false, note }, userId);
  }

  async resubmit(companyId, id, note, userId) {
    const instance = await WorkflowInstance.findOne({ _id: id, companyId });
    if (!instance) throw AppError.notFound('Approval not found');
    if (instance.status !== 'Rejected') {
      throw AppError.badRequest('Only rejected approvals can be resubmitted');
    }
    instance.status = 'Pending';
    instance.currentStepIndex = 0;
    instance.decidedBy = null;
    instance.decidedAt = null;
    instance.timeline.push({ action: 'resubmitted', by: userId || null, note: note || 'Resubmitted' });
    const def = instance.definitionId ? await WorkflowDefinition.findById(instance.definitionId) : null;
    const hours = def?.steps?.[0]?.escalateAfterHours || 24;
    instance.dueAt = new Date(Date.now() + hours * 3600 * 1000);
    await instance.save();
    return instance;
  }

  async comment(companyId, id, text, userId) {
    return workflowEngine.addComment(companyId, id, text, userId);
  }

  async inbox(companyId, { status, role } = {}) {
    const filter = { companyId };
    if (status) filter.status = status;
    else filter.status = { $in: ['Pending', 'InProgress', 'Escalated'] };
    const rows = await WorkflowInstance.find(filter).sort({ createdAt: -1 }).limit(100).lean();
    if (!role) return rows;
    // Soft role filter via definition step
    const defs = await WorkflowDefinition.find({ companyId }).lean();
    const byId = Object.fromEntries(defs.map((d) => [String(d._id), d]));
    return rows.filter((r) => {
      const def = byId[String(r.definitionId)];
      const step = def?.steps?.[r.currentStepIndex || 0];
      return !step?.role || step.role === role || ['owner', 'admin'].includes(role);
    });
  }

  async history(companyId, referenceId) {
    return WorkflowInstance.find({ companyId, referenceId }).sort({ createdAt: -1 });
  }

  async pipeline(companyId) {
    const base = await workflowEngine.pipeline(companyId);
    const rejected = await WorkflowInstance.countDocuments({ companyId, status: 'Rejected' });
    const approved = await WorkflowInstance.countDocuments({ companyId, status: 'Approved' });
    return { ...base, rejected, approved, makerChecker: true };
  }
}

module.exports = new ApprovalEngineService();
