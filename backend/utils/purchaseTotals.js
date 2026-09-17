const { computeTaxComponents, determineGstType } = require('./gstDetermination');

/**
 * Server-side purchase totals — Sprint 4.2 parity with salesTotals.
 * Never trust client GST totals. GST is computed **per line**, then rolled up,
 * so mixed rates / footer discounts stay consistent for dummy + live bills.
 */
const PCS_UNITS = ['PCS', 'PC', 'NOS', 'NO'];

function lineQty(line) {
  const unit = String(line.unit || 'MTRS').toUpperCase();
  if (PCS_UNITS.includes(unit)) return Number(line.pcs || 0);
  return Number(line.mts || line.qty || line.quantity || 0);
}

function lineAmount(line) {
  const provided = Number(line.amount);
  if (Number.isFinite(provided) && provided !== 0) return Math.max(0, Number(provided.toFixed(2)));
  const qty = lineQty(line);
  const rate = Number(line.rate || 0);
  return Math.max(0, Number((qty * rate).toFixed(2)));
}

function lineTaxable(line) {
  const amount = Number(line.amount || 0);
  const dis1Amt = Number(line.dis1Amt || 0);
  const dis2Amt = Number(line.dis2Amt || 0);
  const legacyDiscount = Number(line.discount || 0);
  const discount = dis1Amt || dis2Amt ? dis1Amt + dis2Amt : legacyDiscount;
  const addAmt = Number(line.addAmt || 0);
  return Math.max(0, Number((amount - discount + addAmt).toFixed(2)));
}

function resolveLineRate(it, fallbackGstRate, isUnregistered) {
  if (isUnregistered) return 0;
  const candidates = [it.gstPer, it.gstRate];
  if (it.itemId && typeof it.itemId === 'object') candidates.push(it.itemId.gstRate);
  candidates.push(fallbackGstRate);

  // Prefer first positive rate. Explicit 0 is ignored unless every source is 0
  // (dummy/bad rows often store gstPer:0 while the bill header still carries tax).
  for (const raw of candidates) {
    if (raw === undefined || raw === null || raw === '') continue;
    const n = Number(raw);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 5; // textile default slab when nothing usable is stated
}

function signedAdjust(amount, sign) {
  return sign === '+' ? Number(amount || 0) : -Number(amount || 0);
}

function footerTaxableDelta(extras = {}) {
  let delta = 0;
  delta += signedAdjust(extras.discountAmt, extras.discountSign);
  delta += signedAdjust(extras.lessAmt, extras.lessSign);
  delta += signedAdjust(extras.addAmt, extras.addSign);
  delta += signedAdjust(extras.octroi, extras.octroiSign);
  delta -= Number(extras.rdAmt || 0);
  delta += Number(extras.freight || 0);
  return Number(delta.toFixed(2));
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
  const isUnregistered = /UNREGISTERED/i.test(extras.invoiceType || '');

  const resolvedType = determineGstType({
    companyGstin,
    companyStateCode,
    partyGstin,
    partyStateCode,
    forceType: extras.forceGstType || (gstType === 'IGST' || gstType === 'CGST+SGST' ? gstType : null),
  });

  let linesTaxable = 0;
  let cgst = 0;
  let sgst = 0;
  let igst = 0;
  let cess = 0;
  let rateWeight = 0;
  let rateSum = 0;

  const mapped = items.map((it) => {
    const amount = lineAmount(it);
    const taxable = lineTaxable({ ...it, amount });
    const rate = resolveLineRate(it, gstRate, isUnregistered);
    const tax = computeTaxComponents(taxable, rate, resolvedType, Number(it.cessRate || extras.cessRate || 0));

    linesTaxable += taxable;
    cgst += tax.cgst;
    sgst += tax.sgst;
    igst += tax.igst;
    cess += tax.cess;
    if (taxable > 0) {
      rateWeight += taxable;
      rateSum += rate * taxable;
    }

    return {
      ...it,
      amount,
      taxableAmount: tax.taxableAmount,
      gstRate: rate,
      gstPer: rate,
      cgst: tax.cgst,
      sgst: tax.sgst,
      igst: tax.igst,
      gstAmt: tax.gstAmount,
      cess: tax.cess,
    };
  });

  const footerDelta = footerTaxableDelta(extras);
  let taxable = Math.max(0, Number((linesTaxable + footerDelta).toFixed(2)));

  const effectiveRate = rateWeight > 0
    ? Number((rateSum / rateWeight).toFixed(2))
    : (isUnregistered ? 0 : Number(gstRate) || 0);

  // Footer add/less must move GST with taxable (same bill rate).
  if (Math.abs(footerDelta) >= 0.005) {
    const footerTax = computeTaxComponents(Math.abs(footerDelta), effectiveRate, resolvedType, extras.cessRate || 0);
    const sign = footerDelta >= 0 ? 1 : -1;
    cgst = Number((cgst + sign * footerTax.cgst).toFixed(2));
    sgst = Number((sgst + sign * footerTax.sgst).toFixed(2));
    igst = Number((igst + sign * footerTax.igst).toFixed(2));
    cess = Number((cess + sign * footerTax.cess).toFixed(2));
  }

  // Clamp tiny negatives from rounding after large less-adjustments
  cgst = Math.max(0, Number(cgst.toFixed(2)));
  sgst = Math.max(0, Number(sgst.toFixed(2)));
  igst = Math.max(0, Number(igst.toFixed(2)));
  cess = Math.max(0, Number(cess.toFixed(2)));

  const gstAmount = Number((cgst + sgst + igst + cess).toFixed(2));
  const tdsAmount = Number(extras.tdsAmount || 0);
  const roundOff = Number(extras.roundOff || 0);
  const tcsAmt = Number(extras.tcsAmt || 0);
  const isRcm = Boolean(
    reverseCharge === true
    || extras.reverseCharge === 'Yes'
    || extras.reverseCharge === true
    || (Number(extras.rcmCharge) > 0)
  );

  let netAmount;
  if (isRcm) {
    netAmount = Number((taxable - tdsAmount + roundOff + tcsAmt).toFixed(2));
  } else {
    netAmount = Number((taxable + gstAmount - tdsAmount + roundOff + tcsAmt).toFixed(2));
  }

  return {
    items: mapped,
    taxableAmount: taxable,
    gstType: resolvedType || gstType,
    gstRate: effectiveRate,
    cgst,
    sgst,
    igst,
    cess,
    gstAmount,
    tdsAmount,
    tcsAmt,
    reverseCharge: isRcm,
    netAmount,
  };
}

module.exports = { lineAmount, lineTaxable, recalcPurchaseTotals };
