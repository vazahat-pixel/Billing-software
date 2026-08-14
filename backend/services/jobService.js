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

      if (issueData.jobCardNo && issueData.jobCardNo !== 'AUTO') {
        const existingJob = await Job.findOne({ jobCardNo: issueData.jobCardNo, companyId }).session(session);
        if (existingJob) {
          throw AppError.badRequest(`Challan number "${issueData.jobCardNo}" is already occupied. Please use a different challan number.`);
        }
      }

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

      // Normalize textile / process-charge form fields
      if (issueData.date && !issueData.issueDate) {
        issueData.issueDate = new Date(issueData.date);
      }
      if (issueData.jobRate != null && issueData.processCharges == null) {
        issueData.processCharges = Number(issueData.jobRate) || 0;
      }
      if (issueData.chargesRate != null && !issueData.jobRate) {
        issueData.jobRate = Number(issueData.chargesRate) || 0;
        if (!issueData.processCharges) issueData.processCharges = issueData.jobRate;
      }
      if (issueData.remarks && !issueData.remark) {
        issueData.remark = issueData.remarks;
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

      // Ledger: Stock → Job Work In Progress (mill issue track)
      const accountingService = require('./accountingService');
      await accountingService.onJobIssuePost(job, lot, session);

      await session.commitTransaction();
      return job;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Receive material back from a job worker. Supports MULTIPLE partial receives against
   * the same job: each call is one tranche, added on top of whatever was already banked
   * (job.receivedQty/receivedPcs are cumulative). The job only becomes 'Received' when
   * the CALLER explicitly says this tranche is the last one (receiveData.isFinal) — it is
   * never inferred from quantity, because real job-work almost never returns 100% of the
   * issued material (shrinkage/wastage is normal), so "received >= issued" would rarely
   * fire. isFinal defaults to true, so any existing caller that doesn't send it keeps
   * today's exact one-call-and-done behaviour.
   *
   * Financial postings are split deliberately:
   *   - job-work CHARGES/GST post every tranche (this tranche's own amount only) — a
   *     worker is commonly paid incrementally as goods come back.
   *   - stock VALUATION (WIP -> Stock) and wastage post ONLY on the final tranche.
   *     accountingService.onJobReceiveStockPost values that entry off job.issueQty (the
   *     full original amount), not whatever is passed as receivedQty — by design, so one
   *     posting clears the WIP the issue created. Calling it once, at closure, reproduces
   *     that exactly; calling it per tranche would re-post the full value every time.
   * Physical stock quantity (applyLotMovement) is always per tranche — inventory that
   * has genuinely arrived should be immediately available, closure or not.
   *
   * Configurable multi-step process chains (job.steps.length > 0) are a different,
   * separate feature (advanceStep/performQc already model "one step at a time") — for
   * those, a receive still completes the current step in one shot, exactly as before.
   */
  async receiveFromJob(receiveData) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const { jobId, companyId, billGpNo } = receiveData;
      const trancheQty = Number(receiveData.receivedQty || 0);
      const tranchePcs = Number(receiveData.receivedPcs || 0);

      const job = await Job.findOne({ _id: jobId, companyId }).session(session);
      if (!job) throw AppError.notFound('Job record not found');
      if (job.status === 'Received') throw AppError.badRequest('This job has already been fully received');
      if (job.status === 'Cancelled') throw AppError.badRequest('Cannot receive against a cancelled job');

      if (billGpNo) {
        // Multiple challans for the SAME job worker can share one Bill/Gp No
        // (combined mill receipt). Only block reuse across a different worker,
        // which usually indicates an accidental duplicate/typo.
        const existingReceipt = await Job.findOne({
          billGpNo: String(billGpNo).trim(),
          companyId,
          status: { $in: ['Received', 'Partial'] },
          workerId: { $ne: job.workerId },
        }).session(session);
        if (existingReceipt) {
          throw AppError.badRequest(`Bill/GP No. "${billGpNo}" is already used for a different Job Party. Please use a different one.`);
        }
      }

      if (trancheQty < 0) throw AppError.badRequest('Received quantity cannot be negative');

      const isChainJob = Array.isArray(job.steps) && job.steps.length > 0;
      const previouslyReceivedQty = isChainJob ? 0 : Number(job.receivedQty || 0);
      const previouslyReceivedPcs = isChainJob ? 0 : Number(job.receivedPcs || 0);
      const pendingQty = Number((Number(job.issueQty || 0) - previouslyReceivedQty).toFixed(4));

      if (!isChainJob && trancheQty > pendingQty + 0.0001) {
        throw AppError.badRequest(
          `Received quantity (${trancheQty}) cannot exceed the pending balance (${pendingQty})` +
          (previouslyReceivedQty > 0
            ? ` — ${previouslyReceivedQty} of ${job.issueQty} already received against this job`
            : ` (issued quantity ${job.issueQty})`)
        );
      }

      const cumulativeReceivedQty = isChainJob
        ? trancheQty
        : Number((previouslyReceivedQty + trancheQty).toFixed(4));
      const cumulativeReceivedPcs = isChainJob ? tranchePcs : previouslyReceivedPcs + tranchePcs;

      // Defaults to final/complete — matches every existing caller's expectation that one
      // receive call closes the job (any shortfall books as wastage). A caller must
      // EXPLICITLY pass isFinal: false to keep the job open for another tranche; this can
      // never be inferred from the remaining balance, because normal job-work almost
      // never returns exactly 100% of the issued quantity (see docblock above) — if
      // "remaining <= 0" gated finality, an ordinary receive with real wastage would get
      // stuck Partial forever instead of closing with that shortfall as wastage.
      const isFinal = isChainJob || receiveData.isFinal !== false;
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

      // This tranche's own job-work charges — never the job's running cumulative total,
      // or every subsequent tranche would re-post everything already booked by earlier
      // ones. Falls back to this tranche's share at the agreed per-unit job rate.
      const charges = parseFloat(receiveData.charges) || Number(((job.jobRate || 0) * trancheQty).toFixed(2)) || 0;
      const gstAmount = parseFloat(receiveData.gstAmount) || 0;
      const greyMaterialCost = greyCostPerMtr * trancheQty;
      const trancheFinishedRate =
        trancheQty > 0
          ? Number(((greyMaterialCost + charges) / trancheQty).toFixed(4))
          : greyCostPerMtr;

      // Wastage is only meaningful once the job is actually closing — computed against
      // whatever ends up NOT received (issueQty - cumulativeReceivedQty at closure).
      let wastage = 0;
      let abnormalWastage = 0;
      if (isFinal) {
        const tolerancePct = job.toleranceWastagePct ?? 3;
        ({ wastage, abnormalWastage } = computeWastageSplit(job.issueQty, cumulativeReceivedQty, tolerancePct));
      }

      job.receivedQty = cumulativeReceivedQty;
      job.receivedPcs = cumulativeReceivedPcs;
      job.wastage = wastage;
      // issueToJob seeds job.processCharges with the raw per-unit jobRate as a
      // placeholder (not a total) when no explicit processCharges is given at issue time
      // — safe to overwrite under the old flat-assignment design, but this is now a
      // running total, so that placeholder must never be added onto. Only trust the
      // existing value as a real baseline once a receive tranche has actually written it
      // (previouslyReceivedQty > 0); the very first tranche always starts from zero.
      const chargesBase = previouslyReceivedQty > 0 ? Number(job.processCharges || 0) : 0;
      const gstBase = previouslyReceivedQty > 0 ? Number(job.processGstAmount || 0) : 0;
      job.processCharges = Number((chargesBase + charges).toFixed(2));
      job.processGstAmount = Number((gstBase + gstAmount).toFixed(2));
      job.status = isFinal ? 'Received' : 'Partial';
      job.receiveDate = new Date();
      job.billGpNo = billGpNo || job.billGpNo || '';

      if (isChainJob) {
        const idx = job.currentStepIndex ?? 0;
        if (job.steps[idx]) {
          job.steps[idx].receivedQty = trancheQty;
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
        receivedQty: trancheQty,
        wastage,
        charges,
        completedAt: job.receiveDate,
      };

      // Grow the SAME finished lot across tranches instead of fragmenting stock into one
      // lot per partial receive.
      let finishedLot = job.finishedLotId
        ? await InventoryLot.findById(job.finishedLotId).session(session)
        : null;

      if (!finishedLot) {
        const inheritedHistory = (originalLot.processHistory || []).map((h) => ({ ...h }));
        inheritedHistory.push(processHistoryEntry);
        [finishedLot] = await InventoryLot.create(
          [
            {
              lotId: `${originalLot.lotId}-FIN-${Date.now()}`,
              itemId: outputItemId,
              purchaseId: originalLot.purchaseId?._id || originalLot.purchaseId || null,
              source: 'job_receive',
              parentLotId: originalLot._id,
              sourceJobId: job._id,
              processHistory: inheritedHistory,
              totalPcs: 0,
              remainingPcs: 0,
              totalMtrs: 0,
              remainingMtrs: 0,
              rate: trancheFinishedRate,
              warehouseId: originalLot.warehouseId || null,
              status: 'Available',
              companyId,
            },
          ],
          { session }
        );
      } else {
        finishedLot.processHistory = finishedLot.processHistory || [];
        finishedLot.processHistory.push(processHistoryEntry);
        // Blend the finished rate across tranches by value, not a flat overwrite.
        const existingValue = Number(finishedLot.rate || 0) * Number(finishedLot.totalMtrs || 0);
        const trancheValue = trancheFinishedRate * trancheQty;
        const newTotalMtrs = Number(finishedLot.totalMtrs || 0) + trancheQty;
        finishedLot.rate = newTotalMtrs > 0
          ? Number(((existingValue + trancheValue) / newTotalMtrs).toFixed(4))
          : trancheFinishedRate;
      }

      finishedLot.totalPcs = Number(finishedLot.totalPcs || 0) + tranchePcs;
      finishedLot.totalMtrs = Number(finishedLot.totalMtrs || 0) + trancheQty;
      await finishedLot.save({ session });

      await applyLotMovement({
        session,
        lot: finishedLot,
        companyId,
        deltaMts: trancheQty,
        deltaPcs: tranchePcs,
        type: 'RECEIVE',
        referenceId: job._id,
        idempotencyKey: `RECEIVE:${job._id}:${finishedLot._id}:${Date.now()}`,
        remarks: `Received from Job: ${job.jobCardNo}${isFinal ? '' : ' (partial)'}`,
      });

      job.finishedLotId = finishedLot._id;
      await job.save({ session });

      const accountingService = require('./accountingService');

      if (isFinal) {
        // WIP → Stock, valued off job.issueQty by design (see docblock) — must fire
        // exactly once per job, which "only on the final tranche" guarantees.
        await accountingService.onJobReceiveStockPost(
          job,
          { greyCostPerMtr, receivedQty: cumulativeReceivedQty },
          session
        );
        if (abnormalWastage > 0 && greyCostPerMtr > 0) {
          await accountingService.onAbnormalWastagePost(
            companyId,
            abnormalWastage,
            greyCostPerMtr,
            job._id,
            session
          );
        }
      }

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

      await session.commitTransaction();
      try {
        const eventBus = require('../events/eventBus');
        eventBus.emitSafe('job.received', {
          companyId: String(companyId),
          jobId: job._id?.toString?.(),
          jobCardNo: job.jobCardNo,
          finishedLotId: finishedLot._id?.toString?.(),
          isFinal,
        });
      } catch {
        /* optional */
      }
      return {
        job,
        newLot: finishedLot,
        wastage,
        abnormalWastage,
        finishedRate: trancheFinishedRate,
        isFinal,
        pendingQty: isFinal ? 0 : Number((Number(job.issueQty || 0) - cumulativeReceivedQty).toFixed(4)),
      };
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
    const validStatuses = ['Issued', 'In-Process', 'Received', 'Partial', 'Cancelled'];
    if (!validStatuses.includes(status)) throw AppError.badRequest(`Invalid job status: ${status}`);

    if (status !== 'Cancelled') {
      return Job.findOneAndUpdate({ _id: jobId, companyId }, { status }, { new: true });
    }

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const job = await Job.findOne({ _id: jobId, companyId }).session(session);
      if (!job) throw AppError.notFound('Job not found');
      if (job.status === 'Cancelled') {
        await session.commitTransaction();
        return job;
      }
      if (job.status === 'Received') {
        throw AppError.badRequest('Cannot cancel a received job. Reverse the receive first.');
      }

      // Issued / In-Process: restore lot qty taken at issue
      if (job.lotId && Number(job.issueQty || 0) > 0) {
        const lot = await loadLotForUpdate(session, job.lotId, companyId);
        const key = `ISSUE_CANCEL:${job._id}:${lot._id}`;
        const StockMovement = require('../models/StockMovement');
        const exists = await StockMovement.findOne({ companyId, idempotencyKey: key }).session(session);
        if (!exists) {
          // Temporarily reopen closed lots so restore can apply
          if (lot.status === 'Closed') lot.status = 'Available';
          await applyLotMovement({
            session,
            lot,
            companyId,
            deltaMts: job.issueQty || 0,
            deltaPcs: job.issuePcs || 0,
            type: 'ADJUSTMENT',
            referenceId: job._id,
            idempotencyKey: key,
            remarks: `Cancel Job Issue: ${job.jobCardNo}`,
          });
        }
      }

      // Reverse JobIssue accounting entry if present
      const AccountingEntry = require('../models/AccountingEntry');
      const originalEntry = await AccountingEntry.findOne({
        companyId,
        refType: 'JobIssue',
        refId: job._id,
        isReversed: { $ne: true },
      }).session(session);

      if (originalEntry) {
        const accountingService = require('./accountingService');
        const entryNo = await accountingService.generateEntryNo(companyId, 'JNL', session);
        const reversalLines = originalEntry.lines.map((line) => ({
          ledgerId: line.ledgerId,
          ledgerName: line.ledgerName,
          type: line.type === 'Dr' ? 'Cr' : 'Dr',
          amount: line.amount,
          narration: `Reversal: ${line.narration || ''}`,
        }));

        const reversalEntry = await AccountingEntry.create([{
          companyId,
          entryNo,
          entryDate: new Date(),
          voucherType: 'JobWorkAuto',
          refType: 'JobIssue',
          refId: job._id,
          lines: reversalLines,
          narration: `Reversal of Job Issue ${job.jobCardNo}`,
          isReversed: false,
        }], { session });

        await AccountingEntry.findByIdAndUpdate(
          originalEntry._id,
          { isReversed: true, reversalEntryId: reversalEntry[0]._id },
          { session }
        );
      }

      job.status = 'Cancelled';
      await job.save({ session });
      await session.commitTransaction();
      return job;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  async reverseJobReceive(jobId, companyId) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const job = await Job.findOne({ _id: jobId, companyId }).session(session);
      if (!job) throw AppError.notFound('Job not found');
      // Reversal undoes EVERYTHING received so far in one shot (all tranches at once),
      // not just the most recent one — there is no per-tranche undo.
      if (job.status !== 'Received' && job.status !== 'Partial') {
        throw AppError.badRequest('Only received (or partially received) jobs can be reversed. Current status: ' + job.status);
      }

      const AccountingEntry = require('../models/AccountingEntry');
      const journalEngineService = require('./journalEngineService');

      // Find and reverse the 3 accounting entries posted on receive
      // Look for entries with refType in ['JobReceive', 'JobWorkCharges'] or refType='Journal' and refId=jobId
      const entriesToReverse = await AccountingEntry.find({
        companyId,
        refId: job._id,
        $or: [
          { refType: 'JobReceive' },
          { refType: 'JobWorkCharges' },
          { refType: 'Journal' }
        ],
        isReversed: { $ne: true }
      }).session(session);

      for (const entry of entriesToReverse) {
        await journalEngineService.reverseJournal(companyId, entry._id, { session });
      }

      // Delete or mark finished lot as unused
      if (job.finishedLotId) {
        const finishedLot = await InventoryLot.findById(job.finishedLotId).session(session);
        if (finishedLot) {
          // Pre-existing bug fixed here: InventoryLot.status only allows
          // ['Available', 'Partially Used', 'Closed'] — 'Deleted' has never been a valid
          // value on this model, so this save always threw a validation error and
          // reverseJobReceive could never actually complete. 'Closed' is the closest
          // valid equivalent to "voided, no longer active stock."
          finishedLot.status = 'Closed';
          finishedLot.remainingMtrs = 0;
          finishedLot.remainingPcs = 0;
          await finishedLot.save({ session });
        }
      }

      // Restore original grey lot's remaining quantity to full
      if (job.lotId) {
        const originalLot = await InventoryLot.findById(job.lotId).session(session);
        if (originalLot) {
          originalLot.remainingMtrs = originalLot.totalMtrs;
          originalLot.remainingPcs = originalLot.totalPcs || 0;
          await originalLot.save({ session });
        }
      }

      // Update job status back to Issued — and, since receivedQty/receivedPcs now
      // ACCUMULATE across tranches (see receiveFromJob), reset every figure a receive
      // wrote so a fresh receive afterward starts from zero rather than adding onto
      // stale pre-reversal totals.
      job.status = 'Issued';
      job.receivedQty = 0;
      job.receivedPcs = 0;
      job.wastage = 0;
      job.processCharges = 0;
      job.processGstAmount = 0;
      job.billGpNo = '';
      job.finishedLotId = null;
      job.receiveReversedAt = new Date();
      // Store the first reversal entry ID for audit trail
      if (entriesToReverse.length > 0) {
        job.receiveReversalEntryId = entriesToReverse[0]._id;
      }
      await job.save({ session });

      await session.commitTransaction();

      try {
        const eventBus = require('../events/eventBus');
        eventBus.emitSafe('job.receive-reversed', {
          companyId: String(companyId),
          jobId: job._id?.toString?.(),
          jobCardNo: job.jobCardNo,
        });
      } catch {
        /* optional */
      }

      return job;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  async getJobs(companyId, { status } = {}) {
    const query = { companyId };
    if (status) query.status = status;
    return Job.find(query)
      .populate({
        path: 'lotId',
        populate: {
          path: 'itemId',
          select: 'name'
        }
      })
      .populate('workerId', 'name gstin state')
      .populate('outputItemId', 'name category')
      .populate('finishedLotId', 'lotId remainingMtrs')
      .sort({ createdAt: -1 });
  }
}

module.exports = new JobService();
