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
  let linesTaxable = 0;
  let linesGst = 0;

  for (const item of gridItems) {
    gross = money(gross + money(item?.amount));
    linesTaxable = money(linesTaxable + lineTaxable(item));
    linesGst = money(linesGst + money(item?.gstAmt));
  }

  let totalAdd = 0;
  let totalLess = 0;

  const adjust = (val, sign) => {
    const parsed = money(val);
    if (sign === '+') {
      totalAdd = money(totalAdd + parsed);
      return parsed;
    }
    totalLess = money(totalLess + parsed);
    return money(-parsed);
  };

  let taxable = linesTaxable;
  taxable = money(taxable + adjust(footer.foldLess, footer.foldLessSign || '-'));
  taxable = money(taxable + adjust(footer.rdAmt, footer.rdAmtSign || '-'));
  taxable = money(taxable + adjust(footer.discountAmt, footer.discountSign || '-'));
  taxable = money(taxable + adjust(footer.lessAmt, footer.lessSign || '-'));
  taxable = money(taxable + adjust(footer.addAmt, footer.addSign || '+'));
  if (taxable < 0) taxable = 0;

  const isInState = header.type !== 'INVOICE OUT OF STATE';
  const cgstRate = Number(gstRates.cgstRate) || 0;
  const sgstRate = Number(gstRates.sgstRate) || 0;
  const igstRate = Number(gstRates.igstRate) || 0;
  const tcsRate = Number(footer.tcsRate) || 0;

  const cgst = isInState ? taxOn(taxable, cgstRate) : 0;
  const sgst = isInState ? taxOn(taxable, sgstRate) : 0;
  const igst = !isInState ? taxOn(taxable, igstRate) : 0;
  const gstAmt = money(cgst + sgst + igst);
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
