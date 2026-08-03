const Sales = require('../models/Sales');
const Purchase = require('../models/Purchase');

/**
 * Missing Series — read-only voucher-number gap detector.
 * Never renumbers anything (that's a separate, much riskier operation) — just reports
 * where a numeric sequence within a prefix looks like it has a hole (deleted/skipped number).
 */
const NUM_SUFFIX = /^(.*?)(\d+)$/;

function splitPrefixNumber(voucherNo) {
  const m = NUM_SUFFIX.exec(String(voucherNo || '').trim());
  if (!m) return null;
  return { prefix: m[1], num: parseInt(m[2], 10), width: m[2].length };
}

function findGapsInList(voucherNos) {
  const byPrefix = new Map();
  for (const vNo of voucherNos) {
    const parsed = splitPrefixNumber(vNo);
    if (!parsed) continue;
    if (!byPrefix.has(parsed.prefix)) byPrefix.set(parsed.prefix, []);
    byPrefix.get(parsed.prefix).push(parsed.num);
  }

  const gaps = [];
  for (const [prefix, nums] of byPrefix.entries()) {
    const sorted = [...new Set(nums)].sort((a, b) => a - b);
    if (sorted.length < 2) continue;
    for (let i = 1; i < sorted.length; i++) {
      const diff = sorted[i] - sorted[i - 1];
      if (diff > 1) {
        for (let missing = sorted[i - 1] + 1; missing < sorted[i]; missing++) {
          gaps.push({ prefix, missingNumber: missing, betweenAfter: sorted[i - 1], betweenBefore: sorted[i] });
        }
      }
    }
  }
  return gaps;
}

async function scan(companyId) {
  const [sales, purchases] = await Promise.all([
    Sales.find({ companyId }).select('invoiceNo').lean(),
    Purchase.find({ companyId }).select('invoiceNo').lean(),
  ]);

  const salesGaps = findGapsInList(sales.map((s) => s.invoiceNo));
  const purchaseGaps = findGapsInList(purchases.map((p) => p.invoiceNo));

  return {
    sales: { total: sales.length, gaps: salesGaps, gapCount: salesGaps.length },
    purchase: { total: purchases.length, gaps: purchaseGaps, gapCount: purchaseGaps.length },
    scannedAt: new Date(),
  };
}

module.exports = { scan, findGapsInList, splitPrefixNumber };
