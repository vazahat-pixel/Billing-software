const { seedAll } = require('../seed/seedAll');
const { simulatePurchases } = require('./purchaseSimulator');
const { simulateJobWork } = require('./jobWorkSimulator');
const { simulateSales } = require('./salesSimulator');
const { simulatePayments } = require('./paymentSimulator');
const inventoryEngineService = require('../../services/inventoryEngineService');
const InventoryLot = require('../../models/InventoryLot');
const logger = require('../utils/logger');

async function ensureSeeded(ctx) {
  const Item = require('../../models/Item');
  const count = await Item.countDocuments({ companyId: ctx.companyId });
  if (count === 0) {
    logger.info('Masters missing — running seed:all');
    await seedAll(ctx);
  }
}

async function sampleAdjustments(ctx) {
  const lots = await InventoryLot.find({
    companyId: ctx.companyId,
    remainingMtrs: { $gt: 20 },
    source: 'purchase',
  })
    .limit(1)
    .lean();
  if (!lots.length) return { adjustments: 0 };

  try {
    const adj = await inventoryEngineService.createAdjustment(
      ctx.companyId,
      {
        reason: 'QA cycle count sample',
        lines: lots.map((lot) => ({
          lotId: lot._id,
          itemId: lot.itemId,
          systemMts: lot.remainingMtrs,
          physicalMts: lot.remainingMtrs,
        })),
      },
      ctx.userId
    );
    await inventoryEngineService.postAdjustment(ctx.companyId, adj._id, ctx.userId);
    return { adjustments: 1 };
  } catch (err) {
    logger.warn('Sample adjustment skipped', { error: err.message });
    return { adjustments: 0, skipped: err.message };
  }
}

async function simulateBusinessFlow(ctx) {
  await ensureSeeded(ctx);
  const steps = [];

  const runStep = async (name, fn) => {
    ctx.startTimer(name);
    try {
      const result = await fn();
      const ms = ctx.endTimer(name);
      steps.push({
        name,
        success:
          result.created ??
          result.adjustments ??
          (result.payments || 0) + (result.receipts || 0),
        failed: result.failed || 0,
        ms,
        result,
      });
      return result;
    } catch (err) {
      const ms = ctx.endTimer(name);
      steps.push({ name, success: 0, failed: 1, ms, error: err.message });
      throw err;
    }
  };

  await runStep('purchases', () => simulatePurchases(ctx));
  await runStep('jobWork', () => simulateJobWork(ctx));
  await runStep('sales', () => simulateSales(ctx));
  await runStep('payments', () => simulatePayments(ctx));
  await runStep('adjustments', () => sampleAdjustments(ctx));

  return { steps, profile: ctx.profile.name, companyId: String(ctx.companyId) };
}

module.exports = { simulateBusinessFlow, ensureSeeded };
