const {
  computeTaxComponents,
  determineGstType,
} = require('./gstDetermination');

/**
 * Server-side sales totals — Stage 4 hardened (backend GST only).
 * GST is computed **per line**, then rolled up with footer adjustments,
 * so dummy seed bills and live UI saves stay consistent.
 */
const PCS_UNITS = ['PCS', 'PC', 'NOS', 'NO'];

function lineQty(line) {
  const unit = String(line.unit || 'MTRS').toUpperCase();
  if (PCS_UNITS.includes(unit)) return Number(line.pcs || 0);
  return Number(line.mts || line.qty || 0);
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

function resolveLineRate(it, fallbackGstRate, zeroRated) {
  if (zeroRated) return 0;
  const candidates = [it.gstPer, it.gstRate];
  if (it.itemId && typeof it.itemId === 'object') candidates.push(it.itemId.gstRate);
  candidates.push(fallbackGstRate);

  for (const raw of candidates) {
    if (raw === undefined || raw === null || raw === '') continue;
    const n = Number(raw);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 5;
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
  const resolvedType = determineGstType({
    companyGstin,
    companyStateCode,
    partyGstin,
    partyStateCode,
    forceType: extras.forceGstType || (['IGST', 'CGST+SGST', 'Exempt', 'NilRated', 'ZeroRated', 'Export'].includes(gstType) ? gstType : null),
  });

  const typeForTax = extras.isExport || resolvedType === 'Export' ? 'ZeroRated' : resolvedType;
  const zeroRated = typeForTax === 'ZeroRated' || typeForTax === 'Exempt' || typeForTax === 'NilRated';

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
    const rate = resolveLineRate(it, gstRate, zeroRated);
    const tax = computeTaxComponents(
      taxable,
      rate,
      typeForTax === 'ZeroRated' ? 'ZeroRated' : resolvedType,
      Number(it.cessRate || extras.cessRate || 0)
    );

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

  const footerDelta = Number((totalAdd - totalLess).toFixed(2));
  const taxable = Math.max(0, Number((linesTaxable + footerDelta).toFixed(2)));

  const effectiveRate = zeroRated
    ? 0
    : rateWeight > 0
      ? Number((rateSum / rateWeight).toFixed(2))
      : Number(gstRate) || 0;

  if (Math.abs(footerDelta) >= 0.005 && !zeroRated) {
    const footerTax = computeTaxComponents(
      Math.abs(footerDelta),
      effectiveRate,
      resolvedType,
      extras.cessRate || 0
    );
    const sign = footerDelta >= 0 ? 1 : -1;
    cgst = Number((cgst + sign * footerTax.cgst).toFixed(2));
    sgst = Number((sgst + sign * footerTax.sgst).toFixed(2));
    igst = Number((igst + sign * footerTax.igst).toFixed(2));
    cess = Number((cess + sign * footerTax.cess).toFixed(2));
  }

  cgst = Math.max(0, Number(cgst.toFixed(2)));
  sgst = Math.max(0, Number(sgst.toFixed(2)));
  igst = Math.max(0, Number(igst.toFixed(2)));
  cess = Math.max(0, Number(cess.toFixed(2)));

  const gstAmount = Number((cgst + sgst + igst + cess).toFixed(2));
  const tcsAmount = Number(extras.tcsAmount || 0);
  const roundOff = Number(extras.roundOff || 0);
  const netAmount = Number((taxable + gstAmount + tcsAmount + roundOff).toFixed(2));

  return {
    items: mapped,
    taxableAmount: taxable,
    gstType: typeForTax === 'ZeroRated' ? 'ZeroRated' : (resolvedType || gstType),
    gstRate: effectiveRate,
    cgst,
    sgst,
    igst,
    cess,
    gstAmount,
    tcsAmount,
    netAmount,
  };
}

module.exports = { lineAmount, lineTaxable, recalcSalesTotals };
