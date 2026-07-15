const mongoose = require('mongoose');
const Job = require('../models/Job');
const InventoryLot = require('../models/InventoryLot');
const ProcessChainTemplate = require('../models/ProcessChainTemplate');
const ItemProcessMapping = require('../models/ItemProcessMapping');
const AppError = require('../utils/AppError');
const { applyLotMovement, loadLotForUpdate } = require('../utils/inventoryStockHelper');

function buildStepsFromTemplate(template, issueQty) {
  return (template.processSteps || [])
    .sort((a, b) => a.sequence - b.sequence)
    .map((s, idx) => ({
      sequence: s.sequence,
      processId: s.processId || null,
      processName: s.processName,
      status: idx === 0 ? 'In-Process' : 'Pending',
      startedAt: idx === 0 ? new Date() : null,
      issueQty: idx === 0 ? issueQty : 0,
    }));
}

async function resolveOutputItemId(companyId, inputItemId, processName, explicitOutputItemId) {
  if (explicitOutputItemId) return explicitOutputItemId;
  const mapping = await ItemProcessMapping.findOne({
    companyId,
    inputItemId,
    processName,
  }).lean();
  return mapping?.outputItemId || null;
}

function computeWastageSplit(issueQty, receivedQty, tolerancePct) {
  const wastage = Math.max(0, Number((issueQty - receivedQty).toFixed(4)));
  const toleranceQty = Number(((issueQty * (tolerancePct || 0)) / 100).toFixed(4));
  const abnormalWastage = Math.max(0, Number((wastage - toleranceQty).toFixed(4)));
  const normalShrinkage = Number((wastage - abnormalWastage).toFixed(4));
  return { wastage, normalShrinkage, abnormalWastage, toleranceQty };
}

class JobService {
  async issueToJob(issueData) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const { lotId, issueQty, issuePcs, companyId, chainTemplateId } = issueData;

      const Counter = require('../models/Counter');
      const counterId = `JC-${companyId}`;
      const seq = await Counter.nextSeq(counterId, session);
      issueData.jobCardNo =
        issueData.jobCardNo && issueData.jobCardNo !== 'AUTO' ? issueData.jobCardNo : `JC-${seq}`;

      const lot = await loadLotForUpdate(session, lotId, companyId);

      if (chainTemplateId) {
        const template = await ProcessChainTemplate.findOne({ _id: chainTemplateId, companyId }).session(session);
        if (!template) throw AppError.notFound('Process chain template not found');
        issueData.steps = buildStepsFromTemplate(template, issueQty);
        issueData.chainTemplateId = chainTemplateId;
        issueData.currentStepIndex = 0;
        issueData.processType = issueData.steps[0]?.processName || issueData.processType;
        issueData.processId = issueData.steps[0]?.processId || null;
        issueData.toleranceWastagePct =
          template.processSteps[0]?.defaultTolerancePct ?? issueData.toleranceWastagePct ?? 3;
      } else if (issueData.steps?.length) {
        issueData.steps = issueData.steps.map((s, idx) => ({
          ...s,
          status: idx === 0 ? 'In-Process' : s.status || 'Pending',
          startedAt: idx === 0 ? new Date() : s.startedAt || null,
          issueQty: idx === 0 ? issueQty : s.issueQty || 0,
        }));
        issueData.currentStepIndex = 0;
      }

      if (issueData.outputItemId == null && lot.itemId) {
        issueData.outputItemId = await resolveOutputItemId(
          companyId,
          lot.itemId,
          issueData.processType,
          null
        );
      }

      const job = new Job(issueData);
      await job.save({ session });

      await applyLotMovement({
        session,
        lot,
        companyId,
        deltaMts: -issueQty,
        deltaPcs: -(issuePcs || 0),
        type: 'ISSUE',
        referenceId: job._id,
        idempotencyKey: `ISSUE:${job._id}:${lot._id}`,
        remarks: `Job Issued: ${job.jobCardNo}`,
      });

      await session.commitTransaction();
      return job;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  async receiveFromJob(receiveData) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const { jobId, receivedQty, receivedPcs, companyId } = receiveData;

      const job = await Job.findOne({ _id: jobId, companyId }).session(session);
      if (!job) throw AppError.notFound('Job record not found');
      if (job.status === 'Received') throw AppError.badRequest('This job has already been received');

      const openStep = job.steps?.length
        ? job.steps.find((s) => ['In-Process', 'QC-Pending', 'QC-Pass'].includes(s.status))
        : null;
      if (openStep && openStep.status === 'QC-Pending') {
        throw AppError.badRequest('QC pending — complete QC before receive');
      }

      const originalLot = await InventoryLot.findById(job.lotId)
        .populate({ path: 'purchaseId', select: 'taxableAmount' })
        .session(session);
      if (!originalLot) throw AppError.notFound('Source lot not found');

      const tolerancePct = job.toleranceWastagePct ?? 3;
      const { wastage, abnormalWastage } = computeWastageSplit(job.issueQty, receivedQty, tolerancePct);

      const outputItemId =
        receiveData.outputItemId ||
        job.outputItemId ||
        (await resolveOutputItemId(companyId, originalLot.itemId, job.processType, null)) ||
        originalLot.itemId;

      let greyCostPerMtr = Number(originalLot.rate || 0);
      if (!greyCostPerMtr && originalLot.purchaseId && originalLot.totalMtrs > 0) {
        greyCostPerMtr = parseFloat(originalLot.purchaseId.taxableAmount || 0) / originalLot.totalMtrs;
      }
      if (!greyCostPerMtr) greyCostPerMtr = 100;

      const charges = parseFloat(receiveData.charges) || parseFloat(job.processCharges) || 0;
      const gstAmount = parseFloat(receiveData.gstAmount) || parseFloat(job.processGstAmount) || 0;
      const greyMaterialCost = greyCostPerMtr * job.issueQty;
      const finishedRate =
        receivedQty > 0
          ? Number(((greyMaterialCost + charges) / receivedQty).toFixed(4))
          : greyCostPerMtr;

      job.receivedQty = receivedQty;
      job.receivedPcs = receivedPcs || 0;
      job.wastage = wastage;
      job.processCharges = charges;
      job.processGstAmount = gstAmount;
      job.status = 'Received';
      job.receiveDate = new Date();

      if (job.steps?.length) {
        const idx = job.currentStepIndex ?? 0;
        if (job.steps[idx]) {
          job.steps[idx].receivedQty = receivedQty;
          job.steps[idx].wastage = wastage;
          job.steps[idx].charges = charges;
          job.steps[idx].status = 'Completed';
          job.steps[idx].completedAt = new Date();
        }
      }

      await job.save({ session });

      const processHistoryEntry = {
        jobId: job._id,
        jobCardNo: job.jobCardNo,
        processName: job.processType,
        workerId: job.workerId,
        issueQty: job.issueQty,
        receivedQty,
        wastage,
        charges,
        completedAt: job.receiveDate,
      };

      const inheritedHistory = (originalLot.processHistory || []).map((h) => ({ ...h }));
      inheritedHistory.push(processHistoryEntry);

      const [newLotDoc] = await InventoryLot.create(
        [
          {
            lotId: `${originalLot.lotId}-FIN-${Date.now()}`,
            itemId: outputItemId,
            purchaseId: originalLot.purchaseId?._id || originalLot.purchaseId || null,
            source: 'job_receive',
            parentLotId: originalLot._id,
            sourceJobId: job._id,
            processHistory: inheritedHistory,
            totalPcs: receivedPcs || 0,
            remainingPcs: 0,
            totalMtrs: receivedQty,
            remainingMtrs: 0,
            rate: finishedRate,
            warehouseId: originalLot.warehouseId || null,
            status: 'Available',
            companyId,
          },
        ],
        { session }
      );

      await applyLotMovement({
        session,
        lot: newLotDoc,
        companyId,
        deltaMts: receivedQty,
        deltaPcs: receivedPcs || 0,
        type: 'RECEIVE',
        referenceId: job._id,
        idempotencyKey: `RECEIVE:${job._id}:${newLotDoc._id}`,
        remarks: `Received from Job: ${job.jobCardNo}`,
      });

      newLotDoc.remainingPcs = receivedPcs || 0;
      await newLotDoc.save({ session });

      job.finishedLotId = newLotDoc._id;
      await job.save({ session });

      const accountingService = require('./accountingService');
      if (charges > 0 || gstAmount > 0) {
        await accountingService.onJobWorkChargesPost(
          {
            companyId,
            millId: job.workerId,
            charges,
            gstAmount,
            date: job.receiveDate || new Date(),
            _id: job._id,
          },
          session
        );
      }

      if (abnormalWastage > 0 && greyCostPerMtr > 0) {
        await accountingService.onAbnormalWastagePost(
          companyId,
          abnormalWastage,
          greyCostPerMtr,
          job._id,
          session
        );
      }

      await session.commitTransaction();
      try {
        const eventBus = require('../events/eventBus');
        eventBus.emitSafe('job.received', {
          companyId: String(companyId),
          jobId: job._id?.toString?.(),
          jobCardNo: job.jobCardNo,
          finishedLotId: newLotDoc._id?.toString?.(),
        });
      } catch {
        /* optional */
      }
      return { job, newLot: newLotDoc, wastage, abnormalWastage, finishedRate };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  async advanceStep(jobId, companyId, data = {}) {
    const job = await Job.findOne({ _id: jobId, companyId });
    if (!job) throw AppError.notFound('Job not found');
    if (!job.steps?.length) throw AppError.badRequest('Job has no process chain');

    const idx = job.currentStepIndex ?? 0;
    const step = job.steps[idx];
    if (!step) throw AppError.badRequest('Invalid step index');

    if (data.completeStep !== false) {
      step.receivedQty = data.receivedQty ?? step.receivedQty ?? job.issueQty;
      step.wastage = data.wastage ?? Math.max(0, (step.issueQty || job.issueQty) - step.receivedQty);
      step.charges = data.charges ?? step.charges ?? 0;
      step.status = data.requireQc ? 'QC-Pending' : 'Completed';
      step.completedAt = new Date();
    }

    if (step.status === 'Completed' && idx < job.steps.length - 1) {
      job.currentStepIndex = idx + 1;
      const next = job.steps[job.currentStepIndex];
      next.status = 'In-Process';
      next.startedAt = new Date();
      next.issueQty = step.receivedQty || job.issueQty;
      job.processType = next.processName;
      job.processId = next.processId || null;
      job.status = 'In-Process';
    } else if (step.status === 'QC-Pending') {
      job.status = 'In-Process';
    } else if (idx === job.steps.length - 1 && step.status === 'Completed') {
      job.status = 'In-Process';
    }

    await job.save();
    return job;
  }

  async performQc(jobId, companyId, { passed, notes = '' }) {
    const job = await Job.findOne({ _id: jobId, companyId });
    if (!job) throw AppError.notFound('Job not found');
    const idx = job.currentStepIndex ?? 0;
    const step = job.steps?.[idx];
    if (!step || step.status !== 'QC-Pending') {
      throw AppError.badRequest('No step pending QC');
    }

    step.qcPassed = passed !== false;
    step.qcNotes = notes;
    step.status = step.qcPassed ? 'QC-Pass' : 'QC-Pending';

    if (!step.qcPassed) {
      step.status = 'In-Process';
    } else if (idx < job.steps.length - 1) {
      job.currentStepIndex = idx + 1;
      const next = job.steps[job.currentStepIndex];
      next.status = 'In-Process';
      next.startedAt = new Date();
      next.issueQty = step.receivedQty || job.issueQty;
      job.processType = next.processName;
      job.processId = next.processId || null;
    }

    await job.save();
    return job;
  }

  async updateProcess(jobId, status, companyId) {
    const validStatuses = ['Issued', 'In-Process', 'Received', 'Cancelled'];
    if (!validStatuses.includes(status)) throw AppError.badRequest(`Invalid job status: ${status}`);
    return Job.findOneAndUpdate({ _id: jobId, companyId }, { status }, { new: true });
  }

  async getJobs(companyId, { status } = {}) {
    const query = { companyId };
    if (status) query.status = status;
    return Job.find(query)
      .populate('lotId')
      .populate('workerId', 'name gstin state')
      .populate('outputItemId', 'name category')
      .populate('finishedLotId', 'lotId remainingMtrs')
      .sort({ createdAt: -1 });
  }
}

module.exports = new JobService();
