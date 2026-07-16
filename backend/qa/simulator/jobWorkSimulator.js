const jobService = require('../../services/jobService');
const InventoryLot = require('../../models/InventoryLot');
const Party = require('../../models/Party');
const Item = require('../../models/Item');
const ProcessChainTemplate = require('../../models/ProcessChainTemplate');
const { runBatched } = require('../utils/batch');
const { randFloat, pick, PROCESSES } = require('../utils/faker');
const logger = require('../utils/logger');

async function loadJobMasters(companyId) {
  const [greyLots, workers, finishedItems, chainTemplate] = await Promise.all([
    InventoryLot.find({
      companyId,
      remainingMtrs: { $gt: 50 },
      status: 'Available',
    })
      .populate({ path: 'itemId', select: 'category name' })
      .limit(200)
      .lean(),
    Party.find({ companyId, type: 'Job Worker' }).limit(10).lean(),
    Item.find({ companyId, category: 'Finished' }).limit(10).lean(),
    ProcessChainTemplate.findOne({ companyId, name: 'QA Textile Chain' }).lean(),
  ]);

  const grey = greyLots.filter((l) => l.itemId?.category === 'Grey' || !l.itemId?.category);
  if (!grey.length) throw new Error('Grey lots required — run purchase simulator first');
  if (!workers.length) throw new Error('Job workers required — run seed:masters');
  return { greyLots: grey.length ? grey : greyLots, workers, finishedItems, chainTemplate };
}

async function runOneJob(companyId, masters, index) {
  const lot = pick(masters.greyLots);
  const issueQty = Math.min(randFloat(30, Math.min(200, lot.remainingMtrs - 5), 2), lot.remainingMtrs - 1);
  if (issueQty < 10) throw new Error('Insufficient grey stock for job issue');

  const yieldPct = randFloat(92, 98, 2);
  const wastagePct = randFloat(1, 8, 2);
  const receivedQty = Number((issueQty * (yieldPct / 100)).toFixed(2));
  const charges = Number((issueQty * randFloat(3, 15, 2)).toFixed(2));
  const gstAmount = Number((charges * 0.05).toFixed(2));
  const processType = pick(PROCESSES);
  const worker = pick(masters.workers);
  const outputItem = pick(masters.finishedItems);

  const job = await jobService.issueToJob({
    companyId,
    lotId: lot._id,
    issueQty,
    issuePcs: 0,
    workerId: worker._id,
    processType,
    chainTemplateId: masters.chainTemplate?._id || null,
    outputItemId: outputItem?._id || null,
    toleranceWastagePct: wastagePct,
    jobCardNo: 'AUTO',
  });

  const result = await jobService.receiveFromJob({
    companyId,
    jobId: job._id,
    receivedQty,
    receivedPcs: 0,
    charges,
    gstAmount,
    outputItemId: outputItem?._id || null,
  });

  return {
    jobCardNo: job.jobCardNo,
    issueQty,
    receivedQty,
    wastage: result.wastage,
    finishedLotId: result.newLot?._id,
  };
}

async function simulateJobWork(ctx) {
  const count = ctx.profile.jobCards;
  const masters = await loadJobMasters(ctx.companyId);

  logger.info('Job work simulator starting', { count });
  const indices = Array.from({ length: count }, (_, i) => i);
  const result = await runBatched(
    indices,
    (index) => runOneJob(ctx.companyId, masters, index),
    { concurrency: Math.max(1, Math.floor(ctx.profile.concurrency / 2)) }
  );

  return {
    requested: count,
    created: result.success.length,
    failed: result.failed.length,
    errors: result.failed.slice(0, 20),
  };
}

module.exports = { simulateJobWork };
