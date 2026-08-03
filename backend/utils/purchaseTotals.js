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

  // Signed footer adjustments — sign '+' adds to taxable, anything else (default '-') subtracts.
  // Must mirror the frontend's adjust() in PurchaseModal.jsx exactly, or the saved bill won't
  // match what the user saw on screen before hitting Save.
  const signedAdjust = (amount, sign) => (sign === '+' ? Number(amount || 0) : -Number(amount || 0));

  let taxable = mapped.reduce((s, it) => s + Number(it.amount || 0), 0);
  taxable += signedAdjust(extras.discountAmt, extras.discountSign);
  taxable += signedAdjust(extras.lessAmt, extras.lessSign);
  taxable += signedAdjust(extras.addAmt, extras.addSign);
  taxable += signedAdjust(extras.octroi, extras.octroiSign);
  taxable -= Number(extras.rdAmt || 0);
  taxable += Number(extras.freight || 0);
  taxable = Math.max(0, Number(taxable.toFixed(2)));

  // Unregistered-dealer purchase — no GST is charged on the bill (rate forced to 0).
  const isUnregistered = /UNREGISTERED/i.test(extras.invoiceType || '');

  // Prefer per-line rates when present; else invoice-level rate
  const rates = mapped.map((it) => Number(it.gstRate || it.itemId?.gstRate || gstRate)).filter((r) => r > 0);
  const effectiveRate = isUnregistered
    ? 0
    : rates.length
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

module.exports = { lineAmount, recalcPurchaseTotals };
