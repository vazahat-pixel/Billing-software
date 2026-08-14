const { computeTaxComponents, determineGstType } = require('./gstDetermination');

/**
 * Server-side purchase totals — Sprint 4.2 parity with salesTotals.
 * Never trust client GST totals, but mirror PurchaseModal's computeLine() for line
 * amounts so saved/printed figures match what the user actually entered.
 */
const PCS_UNITS = ['PCS', 'PC', 'NOS', 'NO'];

/** Qty that drives Amount = Rate × Qty, matching PurchaseModal.jsx's lineQty(). */
function lineQty(line) {
  const unit = String(line.unit || 'MTRS').toUpperCase();
  if (PCS_UNITS.includes(unit)) return Number(line.pcs || 0);
  return Number(line.mts || line.qty || line.quantity || 0);
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

  // Signed footer adjustments — sign '+' adds to taxable, anything else (default '-') subtracts.
  // Must mirror the frontend's adjust() in PurchaseModal.jsx exactly, or the saved bill won't
  // match what the user saw on screen before hitting Save.
  const signedAdjust = (amount, sign) => (sign === '+' ? Number(amount || 0) : -Number(amount || 0));

  let taxable = mapped.reduce((s, it) => s + lineTaxable(it), 0);
  taxable += signedAdjust(extras.discountAmt, extras.discountSign);
  taxable += signedAdjust(extras.lessAmt, extras.lessSign);
  taxable += signedAdjust(extras.addAmt, extras.addSign);
  taxable += signedAdjust(extras.octroi, extras.octroiSign);
  taxable -= Number(extras.rdAmt || 0);
  taxable += Number(extras.freight || 0);
  taxable = Math.max(0, Number(taxable.toFixed(2)));

  // Unregistered-dealer purchase — no GST is charged on the bill (rate forced to 0).
  const isUnregistered = /UNREGISTERED/i.test(extras.invoiceType || '');

  // Per-line GST rate, honouring what the operator actually typed.
  //
  // Two bugs lived here:
  //   1. Only `gstRate` was read, but PurchaseModal sends the rate as `gstPer` — so every
  //      per-line rate the user entered was silently ignored and the invoice-level
  //      fallback (default 5) was applied instead.
  //   2. `it.gstRate || …` treats an explicit 0 as "missing" and falls through to that
  //      same 5% fallback, making a genuinely zero-GST purchase impossible to record.
  // A stated 0 is a real answer ("this bill carries no GST"), not an absent one.
  const lineRate = (it) => {
    const raw = [it.gstPer, it.gstRate, it.itemId?.gstRate]
      .find((v) => v !== undefined && v !== null && v !== '');
    return raw === undefined ? null : Number(raw) || 0;
  };

  const statedRates = mapped.map(lineRate).filter((r) => r !== null);
  const positiveRates = statedRates.filter((r) => r > 0);

  const effectiveRate = isUnregistered
    ? 0
    : positiveRates.length
      // Mixed/positive rates: average them, as before.
      ? Number((positiveRates.reduce((a, b) => a + b, 0) / positiveRates.length).toFixed(2))
      : statedRates.length
        // Every line explicitly said 0 → the bill genuinely carries no GST.
        ? 0
        // Nothing stated at all (legacy/partial payload) → invoice-level fallback.
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
  // TCS — manually entered (rate/amount), collected on top by the seller, so it adds to payable.
  const tcsAmt = Number(extras.tcsAmt || 0);

  // RCM: tax is payable by recipient — net to supplier excludes GST (or includes depending on policy)
  // Standard: invoice net to supplier = taxable (+ non-RCM GST). Under RCM, GST paid separately.
  let netAmount;
  if (reverseCharge || extras.reverseCharge) {
    netAmount = Number((taxable - tdsAmount + roundOff + tcsAmt).toFixed(2));
  } else {
    netAmount = Number((taxable + tax.gstAmount + tax.cess - tdsAmount + roundOff + tcsAmt).toFixed(2));
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
    tcsAmt,
    reverseCharge: !!(reverseCharge || extras.reverseCharge),
    netAmount,
  };
}

module.exports = { lineAmount, lineTaxable, recalcPurchaseTotals };
