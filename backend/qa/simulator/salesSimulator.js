const salesService = require('../../services/salesService');
const salesEngineService = require('../../services/salesEngineService');
const InventoryLot = require('../../models/InventoryLot');
const Party = require('../../models/Party');
const Item = require('../../models/Item');
const Sales = require('../../models/Sales');
const { runBatched } = require('../utils/batch');
const { rand, randFloat, randomDateInFY, pick } = require('../utils/faker');
const logger = require('../utils/logger');

async function loadSalesMasters(companyId) {
  const [customers, lots, items] = await Promise.all([
    Party.find({ companyId, type: { $in: ['Customer', 'Both'] } }).limit(20).lean(),
    InventoryLot.find({ companyId, remainingMtrs: { $gt: 10 }, status: 'Available' })
      .sort({ createdAt: -1 })
      .limit(500)
      .lean(),
    Item.find({ companyId }).limit(50).lean(),
  ]);
  if (!customers.length) throw new Error('Customers required — run seed:masters');
  if (!lots.length) throw new Error('Inventory lots required — run purchase simulator first');
  return { customers, lots, items };
}

function buildDirectInvoice(companyId, masters) {
  const lot = pick(masters.lots.filter((l) => l.remainingMtrs > 20) || masters.lots);
  const sellMts = Math.min(randFloat(10, 80, 2), (lot.remainingMtrs || 0) - 1);
  const item = masters.items.find((i) => String(i._id) === String(lot.itemId)) || pick(masters.items);
  const rate = item.salesRate || randFloat(80, 200, 2);
  return {
    companyId,
    customerId: pick(masters.customers)._id,
    date: randomDateInFY(),
    gstType: 'CGST+SGST',
    items: [
      {
        itemId: item._id,
        lotId: lot._id,
        mts: sellMts,
        pcs: rand(1, 10),
        rate,
        amount: Number((sellMts * rate).toFixed(2)),
      },
    ],
    invoiceNo: 'AUTO',
  };
}

async function simulateSales(ctx) {
  const companyId = ctx.companyId;
  const total = ctx.profile.salesInvoices;
  const directCount = Math.floor(total * ctx.profile.salesDirectPct);
  const pipelineCount = Math.floor(total * ctx.profile.salesPipelinePct);
  const returnCount = Math.max(0, total - directCount - pipelineCount);

  const masters = await loadSalesMasters(companyId);
  const errors = [];
  let created = 0;
  let pipelineCreated = 0;
  let returnsCreated = 0;

  logger.info('Sales simulator starting', { directCount, pipelineCount, returnCount });

  const directIndices = Array.from({ length: directCount }, (_, i) => i);
  const directResult = await runBatched(
    directIndices,
    async () => {
      const body = buildDirectInvoice(companyId, masters);
      const sale = await salesEngineService.createDirectInvoice(companyId, body);
      return sale;
    },
    { concurrency: ctx.profile.concurrency }
  );
  created += directResult.success.length;
  errors.push(...directResult.failed);

  for (let i = 0; i < pipelineCount; i += 1) {
    try {
      const lot = pick(masters.lots);
      const item = masters.items.find((it) => String(it._id) === String(lot.itemId)) || pick(masters.items);
      const mts = Math.min(30, lot.remainingMtrs || 30);
      const customer = pick(masters.customers);
      const order = await salesEngineService.createSalesOrder(
        companyId,
        {
          partyId: customer._id,
          date: randomDateInFY(),
          approve: true,
          items: [{ itemId: item._id, lotId: lot._id, mts, rate: item.salesRate || 100 }],
        },
        ctx.userId
      );
      const challan = await salesEngineService.createChallanFromOrder(companyId, {
        orderId: order._id,
        lines: [{ orderLineIndex: 0, lotId: lot._id, mts, pcs: 0 }],
      });
      await salesEngineService.convertChallanToInvoice(companyId, challan._id, { date: randomDateInFY() });
      pipelineCreated += 1;
    } catch (err) {
      errors.push({ error: err.message, path: 'pipeline' });
    }
  }

  const salesDocs = await Sales.find({ companyId }).sort({ createdAt: -1 }).limit(returnCount + 5).lean();
  for (let i = 0; i < returnCount && i < salesDocs.length; i += 1) {
    try {
      const sale = salesDocs[i];
      const line = sale.items?.[0];
      if (!line) continue;
      await salesEngineService.createSalesReturn(companyId, {
        partyId: sale.customerId,
        originalSaleId: sale._id,
        originalInvoiceNo: sale.invoiceNo,
        date: randomDateInFY(),
        items: [
          {
            itemId: line.itemId,
            lotId: line.lotId,
            mts: Math.min(5, line.mts || 5),
            rate: line.rate || 100,
            amount: (line.mts || 5) * (line.rate || 100),
          },
        ],
      });
      returnsCreated += 1;
    } catch (err) {
      errors.push({ error: err.message, path: 'return' });
    }
  }

  return {
    requested: total,
    directInvoices: directResult.success.length,
    pipelineInvoices: pipelineCreated,
    returns: returnsCreated,
    created: created + pipelineCreated,
    failed: errors.length,
    errors: errors.slice(0, 20),
  };
}

module.exports = { simulateSales };
