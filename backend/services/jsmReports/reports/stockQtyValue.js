'use strict';

/**
 * JSM: Reports › Inv Stock Ledger › Stock Mts New Reports (Rpt_Monthly_Stk_Qty_Value_Report,
 * "Stock Qty And Value Report").
 *
 * One stock statement of Head / Qty / Value for the dates, in four blocks — Grey (shop), Grey in Mill,
 * Finish (shop) and Job — each opening with the item master's stock and listing what was added (+) and
 * taken away (−), then its CLOSING. Qty is metres; Value is the bills' taxable amount, the mill
 * challans' purchase amount, and the opening at the item master's opening rate. The Wastages /
 * Samples percentages JSM takes are not applied here. Flows MERN does not record (RF issue and
 * receipt, plain return, damage/wastage, consumption, mill grey return) show 0.
 */
const { round } = require('../jcEngine');
const src = require('../sources/billRegister');
const { loadMillIssueRows } = require('../sources/millIssue');
const { loadMillReceiptRows } = require('../sources/millReceipt');

const dayKey = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');
const isGrey = (c) => String(c || '').toLowerCase() === 'grey';

async function load(companyId) {
  const [pu, sl, slr, pur, millIss, millRec, jobIss, jobRec] = await Promise.all([
    src.loadPurchaseRegisterRows(companyId), src.loadSalesRegisterRows(companyId),
    src.loadReturnRegisterRows(companyId, 'Sales'), src.loadReturnRegisterRows(companyId, 'Purchase'),
    loadMillIssueRows(companyId, 'millIssue'), loadMillReceiptRows(companyId, 'millRec'),
    loadMillIssueRows(companyId, 'jobIssue'), loadMillReceiptRows(companyId, 'jobRec'),
  ]);
  const Item = require('../../../models/Item');
  const items = await Item.find({ companyId }).select('name group category openingQty openingRate').lean();
  return { pu, sl, slr, pur, millIss, millRec, jobIss, jobRec, items };
}

/** A bill counts toward Grey when its lines are grey items, otherwise Finish. */
const billSide = (b) => ((b._lines || []).some((l) => isGrey(l.ITEM_CATEGORY)) ? 'grey' : 'finish');
const sumBills = (bills, side, from, to) => bills
  .filter((b) => billSide(b) === side && dayKey(b.BILL_DATE) >= from && dayKey(b.BILL_DATE) <= to)
  .reduce((t, b) => ({ qty: t.qty + Number(b.TO_QTY1 || b.TO_QTY || 0), val: t.val + Number(b.TAXABLE_AMT || 0) }), { qty: 0, val: 0 });
const sumRows = (rows, dateField, qtyField, valField, from, to) => rows
  .filter((r) => dayKey(r[dateField]) >= from && dayKey(r[dateField]) <= to)
  .reduce((t, r) => ({ qty: t.qty + Number(r[qtyField] || 0), val: t.val + (valField ? Number(r[valField] || 0) : 0) }), { qty: 0, val: 0 });

async function run(companyId, p = {}, deps = {}) {
  if (!p.from || !p.to) throw Object.assign(new Error('From and To dates are required'), { status: 400 });
  const d = deps.data || await load(companyId);
  const { from, to } = p;

  const opening = (side) => d.items
    .filter((i) => (isGrey(i.category || i.group) ? 'grey' : 'finish') === side)
    .reduce((t, i) => ({ qty: t.qty + Number(i.openingQty || 0), val: t.val + Number(i.openingQty || 0) * Number(i.openingRate || 0) }), { qty: 0, val: 0 });
  const earlier = (fn) => fn('0000-01-01', new Date(new Date(`${from}T00:00:00Z`).getTime() - 86400000).toISOString().slice(0, 10));

  const rows = [];
  const block = (title, lines) => {
    rows.push({ HEADNAME: title, QTY: null, VALUE: null, LINE: 'title' });
    let qty = 0;
    let val = 0;
    for (const [head, sign, v] of lines) {
      rows.push({ HEADNAME: head, QTY: round(v.qty), VALUE: round(v.val), LINE: 'line' });
      qty += sign * v.qty;
      val += sign * v.val;
    }
    rows.push({ HEADNAME: `${title} CLOSING`, QTY: round(qty), VALUE: round(val), LINE: 'total' });
  };
  const zero = { qty: 0, val: 0 };

  // Opening of each block = item master + everything dated before From, signed as the block adds it.
  const greyOpen = (() => {
    const o = opening('grey');
    const p0 = earlier((a, b) => sumBills(d.pu, 'grey', a, b));
    const s0 = earlier((a, b) => sumBills(d.sl, 'grey', a, b));
    const r0 = earlier((a, b) => sumBills(d.slr, 'grey', a, b));
    const u0 = earlier((a, b) => sumBills(d.pur, 'grey', a, b));
    const m0 = earlier((a, b) => sumRows(d.millIss, 'CHLN_DATE', 'ISS_QTY', 'PU_AMOUNT', a, b));
    return { qty: o.qty + p0.qty - s0.qty + r0.qty - u0.qty - m0.qty, val: o.val + p0.val - s0.val + r0.val - u0.val - m0.val };
  })();
  block('GREY STOCK', [
    ['+ Grey Opening Stock', 1, greyOpen],
    ['+ G.Purchase', 1, sumBills(d.pu, 'grey', from, to)],
    ['+ Mill Grey Return', 1, zero],
    ['- Purchase Grey Return', -1, sumBills(d.pur, 'grey', from, to)],
    ['- Mill Issue', -1, sumRows(d.millIss, 'CHLN_DATE', 'ISS_QTY', 'PU_AMOUNT', from, to)],
    ['- G.Sales', -1, sumBills(d.sl, 'grey', from, to)],
    ['+ G.Sales.Rtn', 1, sumBills(d.slr, 'grey', from, to)],
  ]);

  const millOpen = (() => {
    const i0 = earlier((a, b) => sumRows(d.millIss, 'CHLN_DATE', 'ISS_QTY', 'PU_AMOUNT', a, b));
    const r0 = earlier((a, b) => sumRows(d.millRec, 'BILL_DATE', 'SND_QTY', null, a, b));
    return { qty: i0.qty - r0.qty, val: i0.val };
  })();
  block('GREY IN MILL', [
    ['+ Mill Opening Stock', 1, millOpen],
    ['+ Grey Issue', 1, sumRows(d.millIss, 'CHLN_DATE', 'ISS_QTY', 'PU_AMOUNT', from, to)],
    ['- Receipt Mill', -1, sumRows(d.millRec, 'BILL_DATE', 'SND_QTY', null, from, to)],
    ['- Mill Return', -1, zero],
    ['+ Rf Issue', 1, zero],
    ['- Rf Receipt Mill', -1, zero],
    ['- Short', -1, sumRows(d.millRec, 'BILL_DATE', 'SHORT_QTY', null, from, to)],
  ]);

  const finOpen = (() => {
    const o = opening('finish');
    const p0 = earlier((a, b) => sumBills(d.pu, 'finish', a, b));
    const s0 = earlier((a, b) => sumBills(d.sl, 'finish', a, b));
    const r0 = earlier((a, b) => sumBills(d.slr, 'finish', a, b));
    const u0 = earlier((a, b) => sumBills(d.pur, 'finish', a, b));
    const m0 = earlier((a, b) => sumRows(d.millRec, 'BILL_DATE', 'REC_QTY', 'IT_AMOUNT', a, b));
    return { qty: o.qty + p0.qty - s0.qty + r0.qty - u0.qty + m0.qty, val: o.val + p0.val - s0.val + r0.val - u0.val + m0.val };
  })();
  block('FINISH STOCK', [
    ['+ Finish Opening Stock', 1, finOpen],
    ['- Rf Issue', -1, zero],
    ['+ Receipt Mill', 1, sumRows(d.millRec, 'BILL_DATE', 'REC_QTY', 'IT_AMOUNT', from, to)],
    ['+ Receipt Rf Mill', 1, zero],
    ['+ Finish Purchase', 1, sumBills(d.pu, 'finish', from, to)],
    ['- Finish Pu.Return', -1, sumBills(d.pur, 'finish', from, to)],
    ['- Finish Sales', -1, sumBills(d.sl, 'finish', from, to)],
    ['+ Finish.Sales.Rtn', 1, sumBills(d.slr, 'finish', from, to)],
    ['+ Job Receipt', 1, sumRows(d.jobRec, 'BILL_DATE', 'REC_QTY', 'IT_AMOUNT', from, to)],
  ]);

  const jobOpen = (() => {
    const i0 = earlier((a, b) => sumRows(d.jobIss, 'CHLN_DATE', 'ISS_QTY', 'PU_AMOUNT', a, b));
    const r0 = earlier((a, b) => sumRows(d.jobRec, 'BILL_DATE', 'SND_QTY', null, a, b));
    return { qty: i0.qty - r0.qty, val: i0.val };
  })();
  block('JOB STOCK', [
    ['+ Job Opening Stock', 1, jobOpen],
    ['+ Job Issue', 1, sumRows(d.jobIss, 'CHLN_DATE', 'ISS_QTY', 'PU_AMOUNT', from, to)],
    ['- Job Receipt', -1, sumRows(d.jobRec, 'BILL_DATE', 'SND_QTY', null, from, to)],
    ['- Plain Return', -1, zero],
    ['- Dmg/Wstg', -1, sumRows(d.jobRec, 'BILL_DATE', 'SHORT_QTY', null, from, to)],
    ['- Consumption', -1, zero],
  ]);

  return {
    rows,
    grid: {
      layout: 'RPT_STOCK_QTY_VALUE',
      variant: 1,
      groupColumns: [],
      groupDisplays: [],
      captions: {},
      title: 'Stock Qty And Value Report',
      period: `DATE : FROM ${p.fromText || from}  TO  ${p.toText || to}`,
      pageWise: false,
    },
  };
}

async function options() {
  return {};
}

module.exports = { run, options };
