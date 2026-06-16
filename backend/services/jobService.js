const mongoose = require('mongoose');
const Job = require('../models/Job');
const InventoryLot = require('../models/InventoryLot');
const StockMovement = require('../models/StockMovement');

class JobService {
  async issueToJob(issueData) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const { lotId, issueQty, issuePcs, companyId } = issueData;

      // Auto-generate Job Card Number
      const Counter = require('../models/Counter');
      const counterId = `JC-${companyId}`;
      const seq = await Counter.nextSeq(counterId);
      issueData.jobCardNo = issueData.jobCardNo && issueData.jobCardNo !== 'AUTO' ? issueData.jobCardNo : `JC-${seq}`;

      // 1. Validate Stock
      const lot = await InventoryLot.findOne({ _id: lotId, companyId }).session(session);
      if (!lot) throw new Error('Inventory Lot not found');
      if (lot.remainingMtrs < issueQty) {
        throw new Error(`Insufficient stock. Available: ${lot.remainingMtrs.toFixed(2)} mtrs`);
      }

      // 2. Create Job Card
      const job = new Job(issueData);
      await job.save({ session });

      // 3. Reduce Lot Stock
      lot.remainingMtrs = parseFloat((lot.remainingMtrs - issueQty).toFixed(4));
      lot.remainingPcs = Math.max(0, (lot.remainingPcs || 0) - (issuePcs || 0));
      lot.status = lot.remainingMtrs <= 0 ? 'Closed' : 'Partially Used';
      await lot.save({ session });

      // 4. Record Stock Movement (ISSUE)
      const movement = new StockMovement({
        lotId: lot._id,
        type: 'ISSUE',
        qtyPcs: -(issuePcs || 0),
        qtyMtrs: -issueQty,
        balanceMtrs: lot.remainingMtrs,
        referenceId: job._id,
        remarks: `Job Issued: ${job.jobCardNo}`,
        companyId
      });
      await movement.save({ session });

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
      const { jobId, receivedQty, receivedPcs, wastage, companyId } = receiveData;

      // 1. Get Job
      const job = await Job.findOne({ _id: jobId, companyId }).session(session);
      if (!job) throw new Error('Job record not found');
      if (job.status === 'Received') throw new Error('This job has already been received');

      // 2. Fetch original lot to calculate actual cost per unit (FIXED: was hardcoded 100)
      const originalLot = await InventoryLot.findById(job.lotId)
        .populate({ path: 'purchaseId', select: 'taxableAmount' })
        .session(session);

      // FIXED: Calculate cost per meter from actual purchase data
      let costPerMeter = 100; // fallback if no purchase data
      if (originalLot && originalLot.purchaseId && originalLot.totalMtrs > 0) {
        const purchaseCost = parseFloat(originalLot.purchaseId.taxableAmount || 0);
        costPerMeter = purchaseCost / originalLot.totalMtrs;
      }

      // 3. Update Job Record
      job.receivedQty = receivedQty;
      job.receivedPcs = receivedPcs || 0;
      job.wastage = wastage || 0;
      job.status = 'Received';
      job.receiveDate = new Date();
      await job.save({ session });

      // 4. Create NEW Finished Lot from received goods
      const newLot = new InventoryLot({
        lotId: `${originalLot ? originalLot.lotId : 'JOB'}-FIN-${Date.now()}`,
        itemId: originalLot ? originalLot.itemId : null,
        purchaseId: originalLot ? originalLot.purchaseId?._id || null : null,
        source: 'job_receive',
        totalPcs: receivedPcs || 0,
        remainingPcs: receivedPcs || 0,
        totalMtrs: receivedQty,
        remainingMtrs: receivedQty,
        status: 'Available',
        companyId
      });
      await newLot.save({ session });

      // 5. Record Stock Movement (RECEIVE)
      const movement = new StockMovement({
        lotId: newLot._id,
        type: 'RECEIVE',
        qtyPcs: receivedPcs || 0,
        qtyMtrs: receivedQty,
        balanceMtrs: receivedQty,
        referenceId: job._id,
        remarks: `Received from Job: ${job.jobCardNo}`,
        companyId
      });
      await movement.save({ session });

      // 6. Auto-accounting triggers (outside transaction — non-critical, logged only)
      const accountingService = require('./accountingService');
      try {
        await accountingService.onJobWorkChargesPost({
          companyId,
          millId: job.workerId,
          charges: parseFloat(receiveData.charges) || 0,
          gstAmount: parseFloat(receiveData.gstAmount) || 0,
          date: job.receiveDate || new Date(),
          _id: job._id
        });

        // FIXED: Use actual calculated cost per meter from the lot
        const wastageQty = parseFloat(wastage || 0);
        if (wastageQty > 0 && costPerMeter > 0) {
          await accountingService.onAbnormalWastagePost(companyId, wastageQty, costPerMeter, job._id);
        }
      } catch (ae) {
        console.error('Auto accounting on job receive failed:', ae);
        // Non-critical — job is already received, do not rollback
      }

      await session.commitTransaction();
      return { job, newLot };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  async updateProcess(jobId, status, companyId) {
    const validStatuses = ['Issued', 'In-Process', 'Received', 'Cancelled'];
    if (!validStatuses.includes(status)) throw new Error(`Invalid job status: ${status}`);
    return await Job.findOneAndUpdate(
      { _id: jobId, companyId },
      { status },
      { new: true }
    );
  }

  async getJobs(companyId, { status } = {}) {
    const query = { companyId };
    if (status) query.status = status;
    return await Job.find(query)
      .populate('lotId')
      .populate('workerId', 'name')
      .sort({ createdAt: -1 });
  }
}

module.exports = new JobService();
