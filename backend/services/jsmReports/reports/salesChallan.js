'use strict';

/**
 * JSM: Reports › Sales › Sales Bill › Sales Challan
 * (Rpt_Sales_Challan_Detail_Report, "Sales Challan Report").
 *
 * Every line of every sales challan over a date range. JSM reads I_SL_CH_IT through
 * JSM_VW_SALES_CHALLAN_DTL (GetParaMetersNo_From_STP_REPORT), filters it with
 *
 *   (A.BILL_DATE >='…' AND A.BILL_DATE <='…') AND A.PARTY IN (…) AND A.BROKER IN (…)
 *   AND A.ITEM IN (…)
 *
 * and gathers it on two Order By boxes — Register, Party, Broker, Item or None — heading the
 * window `<Order By 1> Wise Sales Challan Details Report` (Fill_String_For_Period). Its columns
 * are the ones Js_Add_NewColumn_Function names: CHLN.NO, CHLN.DT, PARTY, BROKER, ORD.NO, ITEM,
 * DISC1, DISC2, PCS, QTY, RATE, AMOUNT, REMARK1, REMARK2, HASTE.
 *
 * A challan here records no broker or haste of its own, so the party's are shown — the same two
 * the bill raised from the challan will carry.
 */
const { orderRows, inList, inDateRange, round } = require('../jcEngine');

/** The Order By choices and the column each one gathers on. */
const GROUP_FIELDS = {
  None: null,
  Register: 'BOOK',
  Party: 'PARTY',
  Broker: 'BROKER',
  Item: 'ITEM',
};

const LISTS = { registers: 'BOOK', parties: 'PARTY', brokers: 'BROKER', items: 'ITEM' };

function fieldOf(choice, fallback) {
  const name = String(choice ?? '').trim() || fallback;
  if (!(name in GROUP_FIELDS)) {
    const err = new Error(`Unknown Order By: ${name}`);
    err.status = 400;
    throw err;
  }
  return { name, field: GROUP_FIELDS[name] };
}

/** One row per challan line, in the view's own column names. */
async function challanLines(companyId, p) {
  const DeliveryChallan = require('../../../models/DeliveryChallan');
  require('../../../models/Order');
  const match = { companyId, status: { $ne: 'Cancelled' } };
  if (p.from || p.to) {
    match.date = {};
    if (p.from) match.date.$gte = new Date(p.from);
    if (p.to) match.date.$lte = new Date(`${p.to}T23:59:59.999Z`);
  }
  const challans = await DeliveryChallan.find(match)
    .populate('customerId', 'name brokerId haste city station')
    .populate('items.itemId', 'name')
    .populate('orderId', 'orderNo date')
    .lean();

  const out = [];
  for (const c of challans) {
    for (const l of c.items || []) {
      out.push({
        ENT_NO: String(c._id),
        BOOK: 'SALES CHALLAN',
        REGISTER: 'SALES CHALLAN',
        NCCHLN_NO: c.challanNo || '',
        BILL_DATE: c.date,
        PARTY: c.customerId?.name || '',
        BROKER: c.customerId?.brokerId || '',
        HASTE: c.customerId?.haste || '',
        ORD_NO: c.orderId?.orderNo || '',
        ORD_DATE: c.orderId?.date || null,
        ITEM: l.itemId?.name || '',
        IT_DISC1: '',
        IT_DISC2: '',
        IT_PCS: Number(l.pcs || 0),
        IT_QTY: round(l.mts),
        IT_RATE: round(l.rate),
        IT_AMOUNT: round(l.amount),
        REMARK_1: c.remarks || '',
        REMARK_2: c.lrNo || '',
      });
    }
  }
  return out;
}

async function run(companyId, p = {}, deps = {}) {
  const by1 = fieldOf(p.orderBy1, 'None');
  const by2 = fieldOf(p.orderBy2, 'None');

  let rows = deps.rows || await challanLines(companyId, p);
  rows = inDateRange(rows, 'BILL_DATE', p.from, p.to);
  for (const [param, field] of Object.entries(LISTS)) rows = inList(rows, field, p[param]);

  const levelled = rows.map((r) => ({
    ...r,
    ZGROUP1: by1.field ? (r[by1.field] || '') : '',
    ZGROUP2: by2.field ? (r[by2.field] || '') : '',
  }));

  const keys = [by1.field ? 'ZGROUP1' : null, by2.field ? 'ZGROUP2' : null].filter(Boolean);

  return {
    rows: orderRows(levelled, [
      ...keys,
      'BILL_DATE',
      { field: 'NCCHLN_NO', dir: 'asc', numeric: true },
      'ENT_NO',
    ]),
    grid: {
      layout: 'JSM_VW_SALES_CHALLAN_DTL_REPORT',
      variant: 1,
      groupColumns: keys,
      groupDisplays: [by1.name, by2.name].filter((n) => n && n !== 'None'),
      primaryDetailColumn: 'ENT_NO',
      captions: {},
      title: `${by1.name} Wise Sales Challan Details Report`,
      period: `DATE : FROM ${p.fromText || p.from || ''}  TO  ${p.toText || p.to || ''}`,
      pageWise: p.printout === '2-PageWise',
    },
  };
}

async function options(companyId) {
  const rows = await challanLines(companyId, {});
  const u = (f) => [...new Set(rows.map((r) => r[f]).filter((v) => String(v ?? '').trim()))]
    .sort((a, b) => String(a).localeCompare(String(b)));
  return { registers: u('BOOK'), parties: u('PARTY'), brokers: u('BROKER'), items: u('ITEM') };
}

module.exports = { run, options };
