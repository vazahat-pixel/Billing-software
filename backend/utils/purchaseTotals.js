const { computeTaxComponents, determineGstType } = require('./gstDetermination');

/**
 * Server-side purchase totals — Sprint 4.2 parity with salesTotals.
 * Never trust client GST amounts.
 */
function lineAmount(line) {
  const qty = Number(line.mts || line.qty || line.quantity || 0);
  const rate = Number(line.rate || 0);
  const discount = Number(line.discount || line.dis1Amt || 0);
  const gross = qty * rate;
  return Math.max(0, Number((gross - discount).toFixed(2)));
}

function recalcPurchaseTotals(items = [], {
  gstType = 'CGST+SGST',
  gstRate = 5,
  extras = {},
  companyGstin,
  companyStateCode,
  partyGstin,
  partyStateCode,
  reverseCharge = false,
} = {}) {
  const mapped = items.map((it) => {
    const amount = lineAmount(it);
    return { ...it, amount };
  });

  let taxable = mapped.reduce((s, it) => s + Number(it.amount || 0), 0);
  const lessAmt = Number(extras.lessAmt || 0) + Number(extras.discountAmt || 0);
  const addAmt = Number(extras.addAmt || 0) + Number(extras.freight || 0);
  taxable = Math.max(0, Number((taxable - lessAmt + addAmt).toFixed(2)));

  // Prefer per-line rates when present; else invoice-level rate
  const rates = mapped.map((it) => Number(it.gstRate || it.itemId?.gstRate || gstRate)).filter((r) => r > 0);
  const effectiveRate = rates.length
    ? Number((rates.reduce((a, b) => a + b, 0) / rates.length).toFixed(2))
    : Number(gstRate);

  const resolvedType = determineGstType({
    companyGstin,
    companyStateCode,
    partyGstin,
    partyStateCode,
    forceType: extras.forceGstType || (gstType === 'IGST' || gstType === 'CGST+SGST' ? gstType : null),
  });

  const tax = computeTaxComponents(taxable, effectiveRate, resolvedType, extras.cessRate || 0);
  const tdsAmount = Number(extras.tdsAmount || 0);
  const roundOff = Number(extras.roundOff || 0);

  // RCM: tax is payable by recipient — net to supplier excludes GST (or includes depending on policy)
  // Standard: invoice net to supplier = taxable (+ non-RCM GST). Under RCM, GST paid separately.
  let netAmount;
  if (reverseCharge || extras.reverseCharge) {
    netAmount = Number((taxable - tdsAmount + roundOff).toFixed(2));
  } else {
    netAmount = Number((taxable + tax.gstAmount + tax.cess - tdsAmount + roundOff).toFixed(2));
  }

  return {
    items: mapped,
    taxableAmount: tax.taxableAmount,
    gstType: tax.gstType,
    gstRate: effectiveRate,
    cgst: tax.cgst,
    sgst: tax.sgst,
    igst: tax.igst,
    cess: tax.cess,
    gstAmount: Number((tax.gstAmount + tax.cess).toFixed(2)),
    tdsAmount,
    reverseCharge: !!(reverseCharge || extras.reverseCharge),
    netAmount,
  };
}

module.exports = { lineAmount, recalcPurchaseTotals };
