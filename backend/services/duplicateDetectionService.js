const Sales = require('../models/Sales');
const Purchase = require('../models/Purchase');

/**
 * Soft duplicate detection — Sprint 2.6 (hard block lives in Sprint 2.9 validateBusiness).
 */
async function findSalesDuplicates(companyId, { customerId, netAmount, invoiceNo, windowHours = 24, excludeId = null }) {
  const since = new Date(Date.now() - windowHours * 3600 * 1000);
  const filter = {
    companyId,
    status: { $ne: 'cancelled' },
    createdAt: { $gte: since },
  };
  if (excludeId) filter._id = { $ne: excludeId };

  const or = [];
  if (invoiceNo) or.push({ invoiceNo });
  if (customerId && netAmount != null) {
    or.push({
      customerId,
      netAmount: Number(netAmount),
    });
  }
  if (!or.length) return [];

  filter.$or = or;
  const hits = await Sales.find(filter).select('invoiceNo customerId netAmount date').limit(10).lean();
  return hits;
}

async function findPurchaseDuplicates(companyId, { supplierId, netAmount, invoiceNo, windowHours = 24, excludeId = null }) {
  const since = new Date(Date.now() - windowHours * 3600 * 1000);
  const filter = {
    companyId,
    status: { $ne: 'cancelled' },
    createdAt: { $gte: since },
  };
  if (excludeId) filter._id = { $ne: excludeId };

  const or = [];
  if (invoiceNo) or.push({ invoiceNo });
  if (supplierId && netAmount != null) {
    or.push({ supplierId, netAmount: Number(netAmount) });
  }
  if (!or.length) return [];
  filter.$or = or;
  return Purchase.find(filter).select('invoiceNo supplierId netAmount date').limit(10).lean();
}

module.exports = {
  findSalesDuplicates,
  findPurchaseDuplicates,
};
