const Purchase = require('../../models/Purchase');
const Sales = require('../../models/Sales');
const gstReturnService = require('../../services/gstReturnService');
const gstService = require('../../services/gstService');
const complianceCertificationService = require('../../services/complianceCertificationService');

function monthKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthDateRange(period) {
  const [y, m] = period.split('-').map(Number);
  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 0, 23, 59, 59);
  return { start, end };
}

async function verifyGst(companyId) {
  const issues = [];
  const period = monthKey();
  const { start, end } = monthDateRange(period);

  const [purchases, sales] = await Promise.all([
    Purchase.find({ companyId, status: { $ne: 'cancelled' } }).lean(),
    Sales.find({ companyId, status: { $ne: 'cancelled' } }).lean(),
  ]);

  const sourceInputGst = purchases.reduce((s, p) => s + (p.gstAmount || 0), 0);
  const sourceOutputGst = sales.reduce((s, inv) => s + (inv.gstAmount || 0), 0);

  let gstr2 = null;
  let gstr1 = null;
  try {
    gstr2 = await gstService.getGstr2(companyId, start, end);
    gstr1 = await gstReturnService.buildGstr1(companyId, period);
  } catch (err) {
    issues.push(`GST return build failed: ${err.message}`);
  }

  if (gstr2?.summary?.totalTax != null) {
    const built = Number(gstr2.summary.totalTax || 0);
    if (Math.abs(built - sourceInputGst) > purchases.length * 0.05 + 1) {
      issues.push(`GSTR-2 tax mismatch: built ${built} vs source ${sourceInputGst.toFixed(2)}`);
    }
  }

  if (gstr1?.summary?.totalTax != null) {
    const built = Number(gstr1.summary.totalTax || 0);
    if (Math.abs(built - sourceOutputGst) > sales.length * 0.05 + 1) {
      issues.push(`GSTR-1 tax mismatch: built ${built} vs source ${sourceOutputGst.toFixed(2)}`);
    }
  }

  const missingHsnPurchases = purchases.filter((p) => !(p.items || []).every((i) => i.hsnCode || i.itemId)).length;
  const missingHsnSales = sales.filter((s) => !(s.items || []).every((i) => i.hsnCode || i.itemId)).length;
  if (missingHsnPurchases) issues.push(`${missingHsnPurchases} purchases may be missing HSN on lines`);
  if (missingHsnSales) issues.push(`${missingHsnSales} sales may be missing HSN on lines`);

  let complianceCert = null;
  try {
    complianceCert = await complianceCertificationService.run(companyId);
    if (!complianceCert.passed) issues.push(...(complianceCert.gaps || []).slice(0, 5));
  } catch (err) {
    issues.push(`Compliance certification: ${err.message}`);
  }

  const passed = issues.length === 0;
  const score = passed ? 100 : Math.max(0, 100 - issues.length * 8);

  return {
    label: 'GST Integrity',
    passed,
    score,
    period,
    sourceInputGst,
    sourceOutputGst,
    gstr1Summary: gstr1?.summary || null,
    gstr2Summary: gstr2?.summary || null,
    issues,
    complianceCertification: complianceCert,
  };
}

module.exports = { verifyGst };
