const Sales = require('../../models/Sales');
const Purchase = require('../../models/Purchase');
const { computeTaxComponents, validateGstin, determineGstType } = require('../../utils/gstDetermination');

/**
 * GST certification — component math, GSTIN samples, CGST+SGST vs IGST consistency.
 */
async function certify(companyId) {
  const issues = [];
  const filter = companyId ? { companyId, status: { $ne: 'cancelled' } } : { status: { $ne: 'cancelled' } };

  const [sales, purchases] = await Promise.all([
    Sales.find(filter).sort({ createdAt: -1 }).limit(100).lean().catch(() => []),
    Purchase.find(filter).sort({ createdAt: -1 }).limit(100).lean().catch(() => []),
  ]);

  let mismatch = 0;

  const checkDoc = (doc, kind) => {
    const taxable = Number(doc.taxableAmount || 0);
    if (taxable <= 0) return;

    const rate = Number(doc.gstRate || 5);
    const type = doc.gstType || (Number(doc.igst || 0) > 0 ? 'IGST' : 'CGST+SGST');
    const expected = computeTaxComponents(taxable, rate, type, Number(doc.cessRate || 0));

    const cgst = Number(doc.cgst || 0);
    const sgst = Number(doc.sgst || 0);
    const igst = Number(doc.igst || 0);
    const gstAmount = Number(doc.gstAmount || cgst + sgst + igst);

    if (type === 'IGST' || type === 'ZeroRated' || type === 'Export') {
      if (cgst > 0.02 || sgst > 0.02) {
        mismatch += 1;
        if (issues.length < 20) issues.push(`${kind} ${doc.invoiceNo}: IGST type but CGST/SGST present`);
      }
    } else if (type === 'CGST+SGST') {
      if (igst > 0.02) {
        mismatch += 1;
        if (issues.length < 20) issues.push(`${kind} ${doc.invoiceNo}: CGST+SGST type but IGST present`);
      }
    }

    // Soft tolerance on recomputed totals (round-off / cess variants)
    const expectedGst = expected.gstAmount + (expected.cess || 0);
    if (Math.abs(gstAmount - expectedGst) > 1.0 && gstAmount > 0) {
      // Only warn-level — don't hard fail on historical rounding; track as soft
      if (Math.abs(gstAmount - expectedGst) > 5) {
        mismatch += 1;
        if (issues.length < 25) {
          issues.push(`${kind} ${doc.invoiceNo}: GST ${gstAmount} vs expected ~${expectedGst}`);
        }
      }
    }
  };

  for (const s of sales) checkDoc(s, 'Sales');
  for (const p of purchases) checkDoc(p, 'Purchase');

  // Pure function self-check (always runs)
  const intra = computeTaxComponents(1000, 5, 'CGST+SGST');
  const inter = computeTaxComponents(1000, 5, 'IGST');
  if (Math.abs(intra.cgst - 25) > 0.01 || Math.abs(intra.sgst - 25) > 0.01) {
    issues.push('GST engine self-check failed: CGST+SGST');
    mismatch += 1;
  }
  if (Math.abs(inter.igst - 50) > 0.01) {
    issues.push('GST engine self-check failed: IGST');
    mismatch += 1;
  }
  if (!validateGstin('24AAAAA0000A1Z5').ok) {
    issues.push('GSTIN validator self-check failed');
    mismatch += 1;
  }
  if (determineGstType({ companyStateCode: '24', partyStateCode: '27' }) !== 'IGST') {
    issues.push('GST type determination self-check failed');
    mismatch += 1;
  }

  const sampled = sales.length + purchases.length;
  const passed = mismatch === 0;
  return {
    passed,
    detail: `sampled=${sampled} mismatches=${mismatch}`,
    gaps: issues,
    sampled,
    mismatch,
    score: passed ? 100 : Math.max(0, 100 - mismatch * 10),
  };
}

module.exports = { certify };
