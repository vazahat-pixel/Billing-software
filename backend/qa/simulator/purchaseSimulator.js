const purchaseService = require('../../services/purchaseService');
const Party = require('../../models/Party');
const Item = require('../../models/Item');
const { runBatched } = require('../utils/batch');
const { rand, randFloat, randomDateInFY, pick } = require('../utils/faker');
const logger = require('../utils/logger');

async function loadMasters(companyId) {
  const [suppliers, items, warehouseId] = await Promise.all([
    Party.find({ companyId, type: { $in: ['Supplier', 'Both'] } }).limit(20).lean(),
    Item.find({ companyId, category: { $in: ['Grey', 'Yarn'] } }).limit(30).lean(),
    require('../../models/Warehouse').findOne({ companyId, isDefault: true }).select('_id').lean(),
  ]);
  if (!suppliers.length || !items.length) {
    throw new Error('Seed masters first ? suppliers and items required');
  }
  return { suppliers, items, warehouseId: warehouseId?._id };
}

function buildPurchasePayload(companyId, masters, index) {
  const lineCount = rand(1, masters.profile?.itemsPerLineMax || 5);
  const lines = [];
  for (let i = 0; i < lineCount; i += 1) {
    const item = pick(masters.items);
    const mts = randFloat(50, 500, 2);
    const rate = item.purchaseRate || randFloat(40, 120, 2);
    lines.push({
      itemId: item._id,
      mts,
      pcs: rand(1, 20),
      rate,
      amount: Number((mts * rate).toFixed(2)),
    });
  }
  const supplier = pick(masters.suppliers);
  const sameState = Math.random() > 0.3;
  return {
    companyId,
    supplierId: supplier._id,
    date: randomDateInFY(),
    gstType: sameState ? 'CGST+SGST' : 'IGST',
    warehouseId: masters.warehouseId || null,
    items: lines,
    invoiceNo: 'AUTO',
    remarks: `QA purchase #${index + 1}`,
  };
}

function isTransientPurchaseError(err) {
  const msg = err?.message || '';
  const code = err?.code || err?.cause?.code || '';
  return (
    msg.includes('has been aborted') ||
    msg.includes('TransientTransactionError') ||
    msg.includes('WriteConflict') ||
    msg.includes('ECONNRESET') ||
    msg.includes('MongoNetworkError') ||
    msg.includes('connection') ||
    code === 'ECONNRESET' ||
    err?.errorLabelSet?.has?.('TransientTransactionError') ||
    err?.errorLabelSet?.has?.('ResetPool')
  );
}

async function createPurchaseWithRetry(payload, attempts = 5) {
  let lastErr = null;
  for (let i = 1; i <= attempts; i += 1) {
    try {
      return await purchaseService.createPurchase(payload);
    } catch (err) {
      lastErr = err;
      if (!isTransientPurchaseError(err) || i === attempts) break;
      await new Promise((r) => setTimeout(r, 250 * 2 ** (i - 1)));
    }
  }
  throw lastErr;
}

async function simulatePurchases(ctx) {
  const companyId = ctx.companyId;
  const count = ctx.profile.purchases;
  const masters = await loadMasters(companyId);
  masters.profile = ctx.profile;

  logger.info('Purchase simulator starting', { count, concurrency: ctx.profile.concurrency });
  const indices = Array.from({ length: count }, (_, i) => i);

  const result = await runBatched(
    indices,
    async (index) => {
      const payload = buildPurchasePayload(companyId, masters, index);
      const purchase = await createPurchaseWithRetry(payload, 5);
      return { purchaseId: purchase._id, invoiceNo: purchase.invoiceNo, lines: purchase.items.length };
    },
    {
      concurrency: Math.max(1, ctx.profile.concurrency),
      onProgress: ({ completed, total, failed }) => {
        if (completed % Math.max(1, Math.floor(total / 10)) === 0 || completed === total) {
          logger.info('Purchase progress', { completed, total, failed });
        }
      },
    }
  );

  const lineItems = result.success.reduce((s, r) => s + (r.value?.lines || 0), 0);
  return {
    requested: count,
    created: result.success.length,
    failed: result.failed.length,
    lineItems,
    errors: result.failed.slice(0, 20),
  };
}

module.exports = { simulatePurchases };
