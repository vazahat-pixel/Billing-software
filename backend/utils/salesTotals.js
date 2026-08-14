const {
  computeTaxComponents,
  determineGstType,
} = require('./gstDetermination');

/**
 * Server-side sales totals — Stage 4 hardened (backend GST only).
 * Mirrors SalesModal's computeLine() so saved/printed amounts match what the user entered.
 */
const PCS_UNITS = ['PCS', 'PC', 'NOS', 'NO'];

/** Qty that drives Amount = Rate × Qty, matching SalesModal.jsx's lineQty(). */
function lineQty(line) {
  const unit = String(line.unit || 'MTRS').toUpperCase();
  if (PCS_UNITS.includes(unit)) return Number(line.pcs || 0);
  return Number(line.mts || line.qty || 0);
}

/**
 * Gross (pre-discount) line amount. Trusts the client-computed value when present —
 * it already carries fold adjustments (NETQTY/QTY) that can't be re-derived from
 * qty × rate alone — and only falls back to qty × rate for legacy/incomplete payloads.
 */
function lineAmount(line) {
  const provided = Number(line.amount);
  if (Number.isFinite(provided) && provided !== 0) return Math.max(0, Number(provided.toFixed(2)));
  const qty = lineQty(line);
  const rate = Number(line.rate || 0);
  return Math.max(0, Number((qty * rate).toFixed(2)));
}

/** Post-discount, post-addAmt taxable contribution of one (already-amounted) line. */
function lineTaxable(line) {
  const amount = Number(line.amount || 0);
  const dis1Amt = Number(line.dis1Amt || 0);
  const dis2Amt = Number(line.dis2Amt || 0);
  const legacyDiscount = Number(line.discount || 0);
  const discount = dis1Amt || dis2Amt ? dis1Amt + dis2Amt : legacyDiscount;
  const addAmt = Number(line.addAmt || 0);
  return Math.max(0, Number((amount - discount + addAmt).toFixed(2)));
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

  let taxable = mapped.reduce((s, it) => s + lineTaxable(it), 0);

  // Mirrors calcSalesBillTotals() in the frontend exactly — same five footer adjustments,
  // same +/- sign handling per field. FOLD LESS was missing here entirely (server ignored
  // it while the form correctly netted it out), which silently inflated every invoice that
  // used NETQTY/QTY fold pricing: the saved/printed amount came out higher than the screen.
  let totalAdd = Number(extras.freight || 0);
  let totalLess = 0;

  const foldLessAmt = Number(extras.foldLess || 0);
  if (foldLessAmt > 0) {
    if (extras.foldLessSign === '+') totalAdd += foldLessAmt;
    else totalLess += foldLessAmt;
  }

  const rdAmtVal = Number(extras.rdAmt || 0);
  if (rdAmtVal > 0) {
    if (extras.rdAmtSign === '+') totalAdd += rdAmtVal;
    else totalLess += rdAmtVal;
  }

  const discountAmtVal = Number(extras.discountAmt || 0);
  if (discountAmtVal > 0) {
    if (extras.discountSign === '+') totalAdd += discountAmtVal;
    else totalLess += discountAmtVal;
  }

  const lessAmtVal = Number(extras.lessAmt || 0);
  if (lessAmtVal > 0) {
    if (extras.lessSign === '+') totalAdd += lessAmtVal;
    else totalLess += lessAmtVal;
  }

  const addAmtVal = Number(extras.addAmt || 0);
  if (addAmtVal > 0) {
    if (extras.addSign === '-') totalLess += addAmtVal;
    else totalAdd += addAmtVal;
  }

  taxable = Math.max(0, Number((taxable - totalLess + totalAdd).toFixed(2)));

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

module.exports = { lineAmount, lineTaxable, recalcSalesTotals };
