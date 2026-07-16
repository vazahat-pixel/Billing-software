const {
  computeTaxComponents,
  determineGstType,
} = require('./gstDetermination');

/**
 * Server-side sales totals — Stage 4 hardened (backend GST only).
 */
function lineAmount(line) {
  const mts = Number(line.mts || line.qty || 0);
  const rate = Number(line.rate || 0);
  const discount = Number(line.discount || line.dis1Amt || 0);
  const gross = mts * rate;
  return Math.max(0, Number((gross - discount).toFixed(2)));
}

function recalcSalesTotals(items = [], {
  gstType = 'CGST+SGST',
  gstRate = 5,
  extras = {},
  companyGstin,
  companyStateCode,
  partyGstin,
  partyStateCode,
} = {}) {
  const mapped = items.map((it) => {
    const amount = lineAmount(it);
    return { ...it, amount };
  });

  let taxable = mapped.reduce((s, it) => s + Number(it.amount || 0), 0);
  const lessAmt = Number(extras.lessAmt || 0) + Number(extras.discountAmt || 0) + Number(extras.rdAmt || 0);
  const addAmt = Number(extras.addAmt || 0) + Number(extras.freight || 0);
  taxable = Math.max(0, Number((taxable - lessAmt + addAmt).toFixed(2)));

  const rates = mapped
    .map((it) => Number(it.gstRate || it.itemId?.gstRate || gstRate))
    .filter((r) => r >= 0);
  const effectiveRate = rates.length
    ? Number(gstRate) || rates[0]
    : Number(gstRate);

  const resolvedType = determineGstType({
    companyGstin,
    companyStateCode,
    partyGstin,
    partyStateCode,
    forceType: extras.forceGstType || (['IGST', 'CGST+SGST', 'Exempt', 'NilRated', 'ZeroRated', 'Export'].includes(gstType) ? gstType : null),
  });

  // Export / LUT zero-rated
  const typeForTax = extras.isExport || resolvedType === 'Export' ? 'ZeroRated' : resolvedType;
  const tax = computeTaxComponents(
    taxable,
    typeForTax === 'ZeroRated' || typeForTax === 'Exempt' || typeForTax === 'NilRated' ? 0 : effectiveRate,
    typeForTax === 'ZeroRated' ? 'ZeroRated' : resolvedType,
    extras.cessRate || 0
  );

  const tcsAmount = Number(extras.tcsAmount || 0);
  const roundOff = Number(extras.roundOff || 0);
  const netAmount = Number((tax.taxableAmount + tax.gstAmount + tax.cess + tcsAmount + roundOff).toFixed(2));

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
    tcsAmount,
    netAmount,
  };
}

module.exports = { lineAmount, recalcSalesTotals };
