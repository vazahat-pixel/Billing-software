const ProcessChainTemplate = require('../models/ProcessChainTemplate');
const ItemProcessMapping = require('../models/ItemProcessMapping');
const Job = require('../models/Job');
const SubMaster = require('../models/SubMaster');
const Item = require('../models/Item');
const AppError = require('../utils/AppError');
const { assertRefs } = require('../utils/refIntegrity');
const jobService = require('./jobService');

const DEFAULT_CHAINS = [
  {
    name: 'Standard Dyeing',
    code: 'DYE-STD',
    processSteps: [
      { sequence: 1, processName: 'Dyeing', defaultTolerancePct: 3 },
      { sequence: 2, processName: 'Finishing', defaultTolerancePct: 2 },
    ],
  },
  {
    name: 'Print & Finish',
    code: 'PRT-STD',
    processSteps: [
      { sequence: 1, processName: 'Printing', defaultTolerancePct: 2 },
      { sequence: 2, processName: 'Dyeing', defaultTolerancePct: 3 },
      { sequence: 3, processName: 'Finishing', defaultTolerancePct: 2 },
    ],
  },
  {
    name: 'Embroidery',
    code: 'EMB-STD',
    processSteps: [{ sequence: 1, processName: 'Embroidery', defaultTolerancePct: 1 }],
  },
];

class ProductionEngineService {
  async pipeline(companyId) {
    const [issued, inProcess, qcPending, received, openJobs] = await Promise.all([
      Job.countDocuments({ companyId, status: 'Issued' }),
      Job.countDocuments({ companyId, status: 'In-Process' }),
      Job.countDocuments({ companyId, 'steps.status': 'QC-Pending' }),
      Job.countDocuments({ companyId, status: 'Received' }),
      Job.countDocuments({ companyId, status: { $in: ['Issued', 'In-Process'] } }),
    ]);
    return { issued, inProcess, qcPending, received, openJobs };
  }

  async statusBoard(companyId) {
    const jobs = await Job.find({ companyId, status: { $ne: 'Cancelled' } })
      .populate('lotId', 'lotId itemId remainingMtrs')
      .populate('workerId', 'name')
      .populate('outputItemId', 'name')
      .sort({ updatedAt: -1 })
      .limit(100)
      .lean();

    const columns = {
      Issued: [],
      'In-Process': [],
      'QC-Pending': [],
      Received: [],
    };

    for (const job of jobs) {
      const currentStep = job.steps?.[job.currentStepIndex];
      let col = job.status;
      if (currentStep?.status === 'QC-Pending') col = 'QC-Pending';
      if (!columns[col]) col = 'In-Process';
      columns[col].push({
        jobId: job._id,
        jobCardNo: job.jobCardNo,
        processType: job.processType,
        workerName: job.workerId?.name,
        lotCode: job.lotId?.lotId,
        issueQty: job.issueQty,
        receivedQty: job.receivedQty,
        currentStep: currentStep?.processName,
        stepStatus: currentStep?.status,
        outputItemName: job.outputItemId?.name,
        productionType: job.productionType,
      });
    }
    return columns;
  }

  // ─── Chain templates ───────────────────────────────────────
  async listChainTemplates(companyId) {
    let templates = await ProcessChainTemplate.find({ companyId }).sort({ name: 1 });
    if (!templates.length) {
      await this.seedDefaultChains(companyId);
      templates = await ProcessChainTemplate.find({ companyId }).sort({ name: 1 });
    }
    return templates;
  }

  async seedDefaultChains(companyId) {
    for (const chain of DEFAULT_CHAINS) {
      const exists = await ProcessChainTemplate.findOne({ companyId, code: chain.code });
      if (exists) continue;
      await ProcessChainTemplate.create({ companyId, ...chain, isDefault: chain.code === 'DYE-STD' });
    }
  }

  async createChainTemplate(companyId, data) {
    if (!data.name || !data.processSteps?.length) {
      throw AppError.badRequest('Name and processSteps required');
    }
    const code = data.code || data.name.toUpperCase().replace(/\s+/g, '-').slice(0, 12);
    return ProcessChainTemplate.create({
      companyId,
      name: data.name,
      code,
      description: data.description || '',
      isDefault: !!data.isDefault,
      processSteps: data.processSteps.map((s, i) => ({
        sequence: s.sequence ?? i + 1,
        processId: s.processId || null,
        processName: s.processName,
        defaultTolerancePct: s.defaultTolerancePct ?? 3,
      })),
    });
  }

  // ─── Item process mapping ──────────────────────────────────
  async listItemMappings(companyId, { inputItemId } = {}) {
    const filter = { companyId };
    if (inputItemId) filter.inputItemId = inputItemId;
    return ItemProcessMapping.find(filter)
      .populate('inputItemId', 'name category')
      .populate('outputItemId', 'name category')
      .sort({ processName: 1 });
  }

  async createItemMapping(companyId, data) {
    const { inputItemId, outputItemId, processName } = data;
    if (!inputItemId || !outputItemId || !processName) {
      throw AppError.badRequest('inputItemId, outputItemId, processName required');
    }
    await assertRefs(companyId, [
      { Model: Item, id: inputItemId, label: 'Input item' },
      { Model: Item, id: outputItemId, label: 'Output item' },
    ]);
    return ItemProcessMapping.findOneAndUpdate(
      { companyId, inputItemId, processName },
      {
        companyId,
        inputItemId,
        outputItemId,
        processId: data.processId || null,
        processName,
        shrinkagePct: data.shrinkagePct ?? 3,
        notes: data.notes || '',
      },
      { upsert: true, new: true }
    );
  }

  async resolveMapping(companyId, inputItemId, processName) {
    const mapping = await ItemProcessMapping.findOne({ companyId, inputItemId, processName })
      .populate('outputItemId', 'name category');
    return mapping;
  }

  // ─── Production flow (delegates to jobService kernel) ──────
  async issueWithChain(companyId, body) {
    body.companyId = companyId;
    return jobService.issueToJob(body);
  }

  async receiveFinished(companyId, body) {
    body.companyId = companyId;
    return jobService.receiveFromJob(body);
  }

  async advanceStep(companyId, jobId, data) {
    return jobService.advanceStep(jobId, companyId, data);
  }

  async performQc(companyId, jobId, data) {
    return jobService.performQc(jobId, companyId, data);
  }

  async listJobs(companyId, filters) {
    return jobService.getJobs(companyId, filters);
  }

  async listProcesses(companyId) {
    return SubMaster.find({ companyId, type: 'Process' }).sort({ name: 1 });
  }
}

module.exports = new ProductionEngineService();
