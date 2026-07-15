const WorkflowDefinition = require('../models/WorkflowDefinition');
const WorkflowInstance = require('../models/WorkflowInstance');
const AppError = require('../utils/AppError');
const notificationDispatch = require('./notificationDispatchService');
const businessAutomationService = require('./businessAutomationService');
const outstandingRefresh = require('./outstandingRefreshService');
const Party = require('../models/Party');
const auditService = require('./auditService');

const DEFAULT_DEFS = [
  {
    code: 'SO_APPROVAL',
    name: 'Sales order approval',
    module: 'sales',
    minAmount: 100000,
    steps: [
      { sequence: 1, name: 'Manager review', role: 'manager', escalateAfterHours: 24 },
      { sequence: 2, name: 'Owner approve', role: 'owner', escalateAfterHours: 48 },
    ],
  },
  {
    code: 'PO_APPROVAL',
    name: 'Purchase order approval',
    module: 'purchase',
    minAmount: 50000,
    steps: [{ sequence: 1, name: 'Purchase manager', role: 'manager', escalateAfterHours: 24 }],
  },
  {
    code: 'CREDIT_LIMIT',
    name: 'Credit limit override',
    module: 'credit_limit',
    minAmount: 0,
    steps: [{ sequence: 1, name: 'Credit approval', role: 'owner', escalateAfterHours: 12 }],
  },
  {
    code: 'DISCOUNT',
    name: 'High discount approval',
    module: 'discount',
    minAmount: 0,
    steps: [{ sequence: 1, name: 'Discount approval', role: 'manager', escalateAfterHours: 12 }],
  },
];

class WorkflowEngineService {
  async pipeline(companyId) {
    const [pending, escalated, defs] = await Promise.all([
      WorkflowInstance.countDocuments({ companyId, status: { $in: ['Pending', 'InProgress'] } }),
      WorkflowInstance.countDocuments({ companyId, status: 'Escalated' }),
      WorkflowDefinition.countDocuments({ companyId, enabled: true }),
    ]);
    return { pending, escalated, definitions: defs };
  }

  async seedDefinitions(companyId) {
    for (const d of DEFAULT_DEFS) {
      await WorkflowDefinition.findOneAndUpdate(
        { companyId, code: d.code },
        { companyId, ...d, enabled: true },
        { upsert: true }
      );
    }
    return this.listDefinitions(companyId);
  }

  async listDefinitions(companyId) {
    let defs = await WorkflowDefinition.find({ companyId }).sort({ module: 1 });
    if (!defs.length) {
      await this.seedDefinitions(companyId);
      defs = await WorkflowDefinition.find({ companyId }).sort({ module: 1 });
    }
    return defs;
  }

  async startWorkflow(companyId, data, userId) {
    const {
      module,
      referenceType,
      referenceId,
      referenceNo = '',
      amount = 0,
      force = false,
    } = data;
    if (!module || !referenceType || !referenceId) {
      throw AppError.badRequest('module, referenceType, referenceId required');
    }

    const approval = await businessAutomationService.evaluateApproval(companyId, { module, amount });
    let def = await WorkflowDefinition.findOne({ companyId, module, enabled: true });
    if (!def && module === 'credit_limit') {
      def = await WorkflowDefinition.findOne({ companyId, code: 'CREDIT_LIMIT', enabled: true });
    }
    if (!force && !approval.requiresApproval && (!def || amount < (def.minAmount || 0))) {
      return { required: false, message: 'No workflow required' };
    }

    if (!def) {
      await this.seedDefinitions(companyId);
      def = await WorkflowDefinition.findOne({ companyId, module, enabled: true });
    }

    const hours = def?.steps?.[0]?.escalateAfterHours || 24;
    const instance = await WorkflowInstance.create({
      companyId,
      definitionId: def?._id || null,
      module,
      referenceType,
      referenceId,
      referenceNo,
      amount,
      status: 'Pending',
      currentStepIndex: 0,
      requestedBy: userId || null,
      dueAt: new Date(Date.now() + hours * 3600 * 1000),
      timeline: [{ action: 'started', by: userId || null, note: approval.message || 'Workflow started' }],
    });

    await notificationDispatch.dispatch(companyId, 'automation.approval_pending', {
      title: `Approval: ${referenceNo || referenceType}`,
      body: `${module} — ₹${amount} pending`,
      severity: 'warning',
      referenceType,
      referenceId,
      meta: { workflowId: instance._id },
    });

    return { required: true, instance };
  }

  async listInstances(companyId, { status } = {}) {
    const filter = { companyId };
    if (status) filter.status = status;
    return WorkflowInstance.find(filter).sort({ createdAt: -1 }).limit(100);
  }

  async decide(companyId, id, { approve = true, note = '' }, userId) {
    const instance = await WorkflowInstance.findOne({
      _id: id,
      companyId,
      status: { $in: ['Pending', 'InProgress', 'Escalated'] },
    });
    if (!instance) throw AppError.notFound('Pending workflow not found');

    const def = instance.definitionId
      ? await WorkflowDefinition.findById(instance.definitionId)
      : null;

    if (approve) {
      const next = (instance.currentStepIndex || 0) + 1;
      const totalSteps = def?.steps?.length || 1;
      instance.timeline.push({
        action: next >= totalSteps ? 'approved' : 'step_approved',
        by: userId || null,
        note,
      });
      if (next >= totalSteps) {
        instance.status = 'Approved';
        instance.decidedBy = userId || null;
        instance.decidedAt = new Date();
      } else {
        instance.currentStepIndex = next;
        instance.status = 'InProgress';
        const hours = def.steps[next]?.escalateAfterHours || 24;
        instance.dueAt = new Date(Date.now() + hours * 3600 * 1000);
      }
    } else {
      instance.status = 'Rejected';
      instance.decidedBy = userId || null;
      instance.decidedAt = new Date();
      instance.timeline.push({ action: 'rejected', by: userId || null, note });
    }

    await instance.save();
    await auditService.logSystem({
      companyId,
      userId,
      action: approve ? 'workflow.approved' : 'workflow.rejected',
      module: 'workflow',
      referenceId: instance._id,
      after: { status: instance.status, referenceId: instance.referenceId },
    });
    return instance;
  }

  async addComment(companyId, id, text, userId) {
    const instance = await WorkflowInstance.findOne({ _id: id, companyId });
    if (!instance) throw AppError.notFound('Workflow not found');
    instance.comments.push({ text, by: userId || null });
    instance.timeline.push({ action: 'comment', by: userId || null, note: text });
    await instance.save();
    return instance;
  }

  async escalateOverdue(companyId) {
    const now = new Date();
    const pending = await WorkflowInstance.find({
      companyId,
      status: { $in: ['Pending', 'InProgress'] },
      dueAt: { $lte: now },
    });
    const out = [];
    for (const inst of pending) {
      inst.status = 'Escalated';
      inst.escalatedAt = now;
      inst.timeline.push({ action: 'escalated', note: 'Overdue escalation' });
      await inst.save();
      await notificationDispatch.dispatch(companyId, 'automation.approval_pending', {
        title: `Escalated: ${inst.referenceNo || inst.referenceType}`,
        body: 'Approval overdue',
        severity: 'critical',
        referenceType: inst.referenceType,
        referenceId: inst.referenceId,
      });
      out.push(inst);
    }
    return out;
  }

  /** Credit limit gate — returns workflow start if over limit */
  async checkCreditLimit(companyId, customerId, additionalAmount = 0, userId) {
    const party = await Party.findOne({ _id: customerId, companyId });
    if (!party) throw AppError.notFound('Party not found');
    const limit = Number(party.creditLimit || 0);
    if (limit <= 0) return { blocked: false, withinLimit: true };

    const bal = await outstandingRefresh.refreshPartyOutstanding(companyId, customerId);
    const projected = (bal.receivable || 0) + Number(additionalAmount || 0);
    if (projected <= limit) return { blocked: false, withinLimit: true, projected, limit };

    const wf = await this.startWorkflow(
      companyId,
      {
        module: 'credit_limit',
        referenceType: 'Party',
        referenceId: customerId,
        referenceNo: party.name,
        amount: projected,
        force: true,
      },
      userId
    );
    return {
      blocked: true,
      withinLimit: false,
      projected,
      limit,
      message: `Credit limit ₹${limit} exceeded (projected ₹${projected.toFixed(2)})`,
      workflow: wf,
    };
  }
}

module.exports = new WorkflowEngineService();
