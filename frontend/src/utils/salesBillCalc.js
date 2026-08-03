/**
 * Sales bill money math — exact 2-decimal INR rounding.
 * Line fields are user-entered; % fields are NOT used for totals.
 */

export function money(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  // Avoid binary float dust before 2-decimal round (critical for 0% / GST)
  return Number((Math.round((x + Number.EPSILON) * 100) / 100).toFixed(2));
}

/** Percent of base. Rate 0 or base 0 → exactly 0 (no float dust). */
export function taxOn(base, ratePct) {
  const b = money(base);
  const r = Number(ratePct);
  if (!Number.isFinite(r) || r === 0 || b === 0) return 0;
  return money((b * r) / 100);
}

export function lineTaxable(item) {
  const amount = money(item?.amount);
  const dis1 = money(item?.dis1Amt);
  const dis2 = money(item?.dis2Amt);
  const add = money(item?.addAmt);
  return money(amount - dis1 - dis2 + add);
}

/**
 * @param {object[]} gridItems
 * @param {object} footer foldLess / rdAmt / discountAmt / lessAmt / addAmt + signs, tcsRate, roundOff
 * @param {{ type: string }} header
 * @param {{ cgstRate: number, sgstRate: number, igstRate: number }} gstRates
 */
export function calcSalesBillTotals(gridItems = [], footer = {}, header = {}, gstRates = {}) {
  let gross = 0;
  let lineDiscounts = 0;
  let linesGst = 0;

  for (const item of gridItems) {
    const amt = money(item?.amount);
    const dis1 = money(item?.dis1Amt);
    const dis2 = money(item?.dis2Amt);
    gross = money(gross + amt);
    lineDiscounts = money(lineDiscounts + dis1 + dis2);
    linesGst = money(linesGst + money(item?.gstAmt));
  }

  let totalAdd = 0;
  let totalLess = lineDiscounts;

  // FOLD LESS adjustment based on sign
  const foldLessAmt = money(footer.foldLess);
  if (foldLessAmt > 0) {
    if (footer.foldLessSign === '+') {
      totalAdd = money(totalAdd + foldLessAmt);
    } else {
      totalLess = money(totalLess + foldLessAmt);
    }
  }

  const rdAmt = money(footer.rdAmt);
  if (rdAmt > 0) {
    if (footer.rdAmtSign === '+') totalAdd = money(totalAdd + rdAmt);
    else totalLess = money(totalLess + rdAmt);
  }

  const discountAmt = money(footer.discountAmt);
  if (discountAmt > 0) {
    if (footer.discountSign === '+') totalAdd = money(totalAdd + discountAmt);
    else totalLess = money(totalLess + discountAmt);
  }

  const lessAmt = money(footer.lessAmt);
  if (lessAmt > 0) {
    if (footer.lessSign === '+') totalAdd = money(totalAdd + lessAmt);
    else totalLess = money(totalLess + lessAmt);
  }

  const addAmt = money(footer.addAmt);
  if (addAmt > 0) {
    if (footer.addSign === '-') totalLess = money(totalLess + addAmt);
    else totalAdd = money(totalAdd + addAmt);
  }

  let taxable = money(gross + totalAdd - totalLess);
  if (taxable < 0) taxable = 0;

  const isInState = header.type !== 'INVOICE OUT OF STATE';
  const cgstRate = Number(gstRates.cgstRate) || 2.5;
  const sgstRate = Number(gstRates.sgstRate) || 2.5;
  const igstRate = Number(gstRates.igstRate) || 5.0;
  const tcsRate = Number(footer.tcsRate) || 0;

  let cgst = 0;
  let sgst = 0;
  let igst = 0;
  let gstAmt = 0;

  if (linesGst > 0) {
    gstAmt = linesGst;
    if (isInState) {
      cgst = money(gstAmt / 2);
      sgst = money(gstAmt - cgst);
      igst = 0;
    } else {
      igst = gstAmt;
      cgst = 0;
      sgst = 0;
    }
  } else {
    cgst = isInState ? taxOn(taxable, cgstRate) : 0;
    sgst = isInState ? taxOn(taxable, sgstRate) : 0;
    igst = !isInState ? taxOn(taxable, igstRate) : 0;
    gstAmt = money(cgst + sgst + igst);
  }

  const tcsAmt = taxOn(taxable, tcsRate);
  const roundOff = money(footer.roundOff);
  const net = money(taxable + gstAmt + tcsAmt + roundOff);

  return {
    gross,
    taxable,
    cgst,
    sgst,
    igst,
    gstAmt,
    linesGst,
    tcsAmt,
    totalAdd,
    totalLess,
    net,
    roundOff,
  };
}
