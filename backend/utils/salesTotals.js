/**
 * Server-side sales totals — Sprint 2.5 (harden further in 2.9).
 * Recalculates line amounts and GST from items + gstType; does not trust client net.
 */
function lineAmount(line) {
  const mts = Number(line.mts || 0);
  const rate = Number(line.rate || 0);
  const discount = Number(line.discount || line.dis1Amt || 0);
  const gross = mts * rate;
  return Math.max(0, Number((gross - discount).toFixed(2)));
}

function recalcSalesTotals(items = [], { gstType = 'CGST+SGST', gstRate = 5, extras = {} } = {}) {
  const mapped = items.map((it) => {
    const amount = lineAmount(it);
    return { ...it, amount };
  });

  let taxable = mapped.reduce((s, it) => s + Number(it.amount || 0), 0);

  // Adjustments (less/add) applied to taxable before GST — simplified Stage 2.5
  const lessAmt = Number(extras.lessAmt || 0) + Number(extras.discountAmt || 0) + Number(extras.rdAmt || 0);
  const addAmt = Number(extras.addAmt || 0) + Number(extras.freight || 0);
  taxable = Math.max(0, Number((taxable - lessAmt + addAmt).toFixed(2)));

  const rate = Number(gstRate);
  let cgst = 0;
  let sgst = 0;
  let igst = 0;
  let gstAmount = 0;

  if (gstType === 'IGST') {
    igst = Number(((taxable * rate) / 100).toFixed(2));
    gstAmount = igst;
  } else {
    const half = Number(((taxable * (rate / 2)) / 100).toFixed(2));
    const other = Number((((taxable * rate) / 100) - half).toFixed(2));
    cgst = half;
    sgst = other;
    gstAmount = Number((cgst + sgst).toFixed(2));
  }

  const tcsAmount = Number(extras.tcsAmount || 0);
  const roundOff = Number(extras.roundOff || 0);
  const netAmount = Number((taxable + gstAmount + tcsAmount + roundOff).toFixed(2));

  return {
    items: mapped,
    taxableAmount: taxable,
    gstType,
    cgst,
    sgst,
    igst,
    gstAmount,
    netAmount,
  };
}

module.exports = { lineAmount, recalcSalesTotals };
