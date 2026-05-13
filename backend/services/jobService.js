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

      // 1. Validate Stock
      const lot = await InventoryLot.findOne({ _id: lotId, companyId }).session(session);
      if (!lot) throw new Error('Inventory Lot not found');
      if (lot.remainingMtrs < issueQty) throw new Error(`Insufficient stock. Available: ${lot.remainingMtrs}`);

      // 2. Create Job Card
      const job = new Job(issueData);
      await job.save({ session });

      // 3. Reduce Lot Stock
      lot.remainingMtrs -= issueQty;
      lot.remainingPcs -= issuePcs;
      if (lot.remainingMtrs <= 0) lot.status = 'Closed';
      else lot.status = 'Partially Used';
      await lot.save({ session });

      // 4. Record Stock Movement (ISSUE)
      const movement = new StockMovement({
        lotId: lot._id,
        type: 'ISSUE',
        qtyPcs: -issuePcs,
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

      // 2. Update Job Record
      job.receivedQty = receivedQty;
      job.receivedPcs = receivedPcs;
      job.wastage = wastage;
      job.status = 'Received';
      job.receiveDate = new Date();
      await job.save({ session });

      // 3. Create NEW Finished Lot
      const originalLot = await InventoryLot.findById(job.lotId).session(session);
      
      const newLot = new InventoryLot({
        lotId: `${originalLot.lotId}-FIN`,
        itemId: originalLot.itemId,
        purchaseId: originalLot.purchaseId,
        totalPcs: receivedPcs,
        remainingPcs: receivedPcs,
        totalMtrs: receivedQty,
        remainingMtrs: receivedQty,
        status: 'Available',
        companyId
      });
      await newLot.save({ session });

      // 4. Record Stock Movement (RECEIVE)
      const movement = new StockMovement({
        lotId: newLot._id,
        type: 'RECEIVE',
        qtyPcs: receivedPcs,
        qtyMtrs: receivedQty,
        balanceMtrs: receivedQty,
        referenceId: job._id,
        remarks: `Received from Job: ${job.jobCardNo}`,
        companyId
      });
      await movement.save({ session });

      // Auto-accounting triggers
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

        if (parseFloat(wastage) > 0) {
          // Assuming typical cost per unit of 100 for production loss valuation
          await accountingService.onAbnormalWastagePost(companyId, wastage, 100, job._id);
        }
      } catch (ae) {
        console.error('Auto accounting on job receive failed:', ae);
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
    return await Job.findOneAndUpdate(
      { _id: jobId, companyId },
      { status },
      { new: true }
    );
  }

  async getJobs(companyId) {
    return await Job.find({ companyId })
      .populate('lotId')
      .populate('workerId', 'name')
      .sort({ createdAt: -1 });
  }
}

module.exports = new JobService();
