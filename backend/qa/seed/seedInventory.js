const Item = require('../../models/Item');
const ProcessChainTemplate = require('../../models/ProcessChainTemplate');
const ItemProcessMapping = require('../../models/ItemProcessMapping');
const { resolveCompanyId } = require('../utils/tenant');
const { itemName } = require('../utils/faker');
const logger = require('../utils/logger');

const ITEM_SPECS = [
  { category: 'Grey', count: 10, hsn: '5208', rate: 50 },
  { category: 'Finished', count: 8, hsn: '6204', rate: 120 },
  { category: 'Yarn', count: 4, hsn: '5509', rate: 180 },
];

async function seedItems(companyId, ctx) {
  const grey = [];
  const finished = [];
  const yarn = [];
  const warehouseId = ctx.masters?.warehouses?.warehouseId || null;

  for (const spec of ITEM_SPECS) {
    for (let i = 1; i <= spec.count; i += 1) {
      const name = itemName(spec.category, i);
      const doc = await Item.findOneAndUpdate(
        { companyId, name },
        {
          category: spec.category,
          hsnCode: spec.hsn,
          gstRate: 5,
          unit: 'MTRS',
          purchaseRate: spec.rate,
          salesRate: spec.rate * 2.2,
          defaultWarehouseId: warehouseId,
          openingStock: 0,
        },
        { upsert: true, new: true }
      );
      if (spec.category === 'Grey') grey.push(doc);
      if (spec.category === 'Finished') finished.push(doc);
      if (spec.category === 'Yarn') yarn.push(doc);
    }
  }
  return { grey, finished, yarn, all: [...grey, ...finished, ...yarn] };
}

async function seedProcessChain(companyId, greyItems, finishedItems) {
  const template = await ProcessChainTemplate.findOneAndUpdate(
    { companyId, name: 'QA Textile Chain' },
    {
      description: 'Grey → Printing → Dyeing → Embroidery → Packing',
      processSteps: [
        { sequence: 1, processName: 'Printing', defaultTolerancePct: 3 },
        { sequence: 2, processName: 'Dyeing', defaultTolerancePct: 4 },
        { sequence: 3, processName: 'Embroidery', defaultTolerancePct: 2 },
        { sequence: 4, processName: 'Packing', defaultTolerancePct: 1 },
      ],
      isActive: true,
    },
    { upsert: true, new: true }
  );

  if (greyItems[0] && finishedItems[0]) {
    for (const processName of ['Printing', 'Dyeing', 'Embroidery']) {
      await ItemProcessMapping.findOneAndUpdate(
        { companyId, inputItemId: greyItems[0]._id, processName },
        { outputItemId: finishedItems[0]._id, isActive: true },
        { upsert: true }
      );
    }
  }
  return template;
}

async function seedOpeningStock() {
  // Opening stock is created via purchase simulator (service path). No direct lot inserts.
  return [];
}

async function seedInventory(ctx) {
  const companyId = await resolveCompanyId(ctx);
  if (!ctx.masters?.parties) {
    const { seedMasters } = require('./seedMasters');
    await seedMasters(ctx);
  }

  const items = await seedItems(companyId, ctx);
  const chainTemplate = await seedProcessChain(companyId, items.grey, items.finished);
  const openingLots = await seedOpeningStock();

  ctx.masters.items = items;
  ctx.masters.chainTemplate = chainTemplate;
  ctx.masters.openingLots = openingLots;

  logger.info('Seeded inventory masters', {
    items: items.all.length,
    openingLots: openingLots.length,
  });
  return ctx.masters;
}

module.exports = { seedInventory };
