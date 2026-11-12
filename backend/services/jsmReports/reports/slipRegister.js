'use strict';

/**
 * JSM:
 *  - Reports › Sales › Sales Bill › Slip Register (Rpt_Sales_Slip_Register)
 *  - Reports › Sales › Sales Bill › Slip (New) Register (Rpt_SalesSlipDetail_Report)
 *
 * Reads DeliveryChallan (MERN's counterpart of JSM's I_SL_CHALLAN / I_SL_CH_IT), tracking
 * whether each challan line has been converted into a sales invoice (SL_QTY / SL_BILLNO) or is
 * still pending (BAL_QTY). Nothing is recomputed.
 */
const { orderRows, inList, inDateRange, round, MONTHS } = require('../jcEngine');

const GROUP_FIELDS = {
  None: null,
  Register: 'BOOK',
  Party: 'PARTY',
  Book: 'BOOK',
  Item: 'ITEM',
  DateWise: 'BILL_DATE',
  Month: 'MONTH',
};

function fieldOf(choice, fallback = 'None') {
  const name = String(choice ?? '').trim() || fallback;
  if (!(name in GROUP_FIELDS)) {
    const err = new Error(`Unknown Order By: ${name}`);
    err.status = 400;
    throw err;
  }
  return { name, field: GROUP_FIELDS[name] };
}

async function slipLines(companyId) {
  const DeliveryChallan = require('../../../models/DeliveryChallan');
  require('../../../models/Party');
  require('../../../models/Item');
  const challans = await DeliveryChallan.find({ companyId, status: { $ne: 'Cancelled' } })
    .populate('customerId', 'name')
    .populate('items.itemId', 'name')
    .lean();

  const out = [];
  for (const c of challans) {
    const d = c.date ? new Date(c.date) : null;
    const invoiced = c.status === 'Invoiced' || Boolean(c.salesId);
    for (const l of c.items || []) {
      const qty = round(l.mts);
      const pcs = Number(l.pcs || 0);
      const slQty = invoiced ? qty : 0;
      const slPcs = invoiced ? pcs : 0;
      out.push({
        ENT_NO: String(c._id),
        BOOK: 'SALES CHALLAN',
        REGISTER: 'SALES CHALLAN',
        NCCHLN_NO: c.challanNo || '',
        CHLN_NO: /^\d+$/.test(String(c.challanNo || '')) ? Number(c.challanNo) : 0,
        BILL_DATE: c.date,
        YEAR_NO: d ? d.getUTCFullYear() : 0,
        MONTH_NO: d ? d.getUTCMonth() + 1 : 0,
        MONTH: d ? MONTHS[d.getUTCMonth()] : '',
        PARTY: c.customerId?.name || '',
        TRNS_NAME: c.transport || '',
        ITEM: l.itemId?.name || '',
        IT_DISC1: '',
        IT_PCS: pcs,
        IT_QTY: qty,
        IT_RATE: round(l.rate),
        IT_AMOUNT: round(l.amount),
        SL_PCS: slPcs,
        SL_QTY: slQty,
        BAL_QTY: round(qty - slQty),
        SL_BILLNO: c.invoiceNo || '',
        STOCK_CP: invoiced ? 'C' : 'P',
        REMARK_1: c.remarks || '',
      });
    }
  }
  return out;
}

const slip = {
  async run(companyId, p = {}, deps = {}) {
    let rows = deps.rows || await slipLines(companyId);
    rows = inDateRange(rows, 'BILL_DATE', p.from, p.to);
    const chFrom = Number(p.chFrom || 0);
    const chTo = Number(p.chTo || 0);
    if (chFrom || chTo) {
      rows = rows.filter((r) => (!chFrom || r.CHLN_NO >= chFrom) && (!chTo || r.CHLN_NO <= chTo));
    }
    rows = inList(rows, 'PARTY', p.parties);
    rows = inList(rows, 'ITEM', p.items);

    const status = String(p.status || '3-Both');
    if (status.startsWith('1') || status.toLowerCase().includes('pend')) {
      rows = rows.filter((r) => r.STOCK_CP !== 'C');
    } else if (status.startsWith('2') || status.toLowerCase().includes('clear')) {
      rows = rows.filter((r) => r.STOCK_CP === 'C');
    }

    const reportType = String(p.reportType || '1-Register');
    let groupField = null;
    let groupDisplay = '';
    if (reportType.startsWith('2')) { groupField = 'PARTY'; groupDisplay = 'PARTY'; }
    else if (reportType.startsWith('3')) { groupField = 'ITEM'; groupDisplay = 'ITEM'; }

    const ordered = orderRows(rows, [
      ...(groupField ? [groupField] : []),
      'BILL_DATE',
      { field: 'CHLN_NO', dir: 'asc', numeric: true },
      'NCCHLN_NO',
    ]);

    return {
      rows: ordered,
      grid: {
        layout: 'JSM_VW_SALES_SLIP_REGISTER',
        variant: 1,
        groupColumns: groupField ? [groupField] : [],
        groupDisplays: groupDisplay ? [groupDisplay] : [],
        primaryDetailColumn: 'ENT_NO',
        captions: {},
        title: reportType.startsWith('2')
          ? 'Partywise Slip Register'
          : reportType.startsWith('3') ? 'Itemwise Slip Register' : 'Slip Register',
        period: `PERIOD : ${p.fromText || p.from || ''} TO ${p.toText || p.to || ''}`,
        pageWise: false,
      },
    };
  },
  async options(companyId) {
    const rows = await slipLines(companyId);
    const u = (f) => [...new Set(rows.map((r) => r[f]).filter((v) => String(v ?? '').trim()))].sort((a, b) => String(a).localeCompare(String(b)));
    return { parties: u('PARTY'), items: u('ITEM') };
  },
};

const slipNew = {
  async run(companyId, p = {}, deps = {}) {
    const by1 = fieldOf(p.orderBy1, 'None');
    const by2 = fieldOf(p.orderBy2, 'None');
    let rows = deps.rows || await slipLines(companyId);
    rows = inDateRange(rows, 'BILL_DATE', p.from, p.to);
    rows = inList(rows, 'BOOK', p.registers);
    rows = inList(rows, 'PARTY', p.parties);
    rows = inList(rows, 'ITEM', p.items);

    const status = String(p.status || 'All');
    if (status === 'Pending' || status.startsWith('1')) {
      rows = rows.filter((r) => Math.abs(r.BAL_QTY) > 0.004);
    } else if (status === 'Clear' || status.startsWith('2')) {
      rows = rows.filter((r) => Math.abs(r.BAL_QTY) <= 0.004);
    }

    const keys = [by1.field ? 'ZGROUP1' : null, by2.field ? 'ZGROUP2' : null].filter(Boolean);
    const levelled = rows.map((r) => ({
      ...r,
      ZGROUP1: by1.field ? (r[by1.field] || '') : '',
      ZGROUP2: by2.field ? (r[by2.field] || '') : '',
    }));

    if (p.summary) {
      const grouped = new Map();
      for (const r of levelled) {
        const k = `${r.ZGROUP1}\u0000${r.ZGROUP2}`;
        const cur = grouped.get(k) || {
          REGISTER: 'SUMMARY', ZGROUP: r.ZGROUP1, ZGROUP2: r.ZGROUP2,
          TOT_PCS: 0, TOT_QTY: 0, SL_QTY: 0, BAL_QTY: 0, TOT_AMOUNT: 0,
        };
        cur.TOT_PCS += Number(r.IT_PCS || 0);
        cur.TOT_QTY = round(cur.TOT_QTY + Number(r.IT_QTY || 0));
        cur.SL_QTY = round(cur.SL_QTY + Number(r.SL_QTY || 0));
        cur.BAL_QTY = round(cur.BAL_QTY + Number(r.BAL_QTY || 0));
        cur.TOT_AMOUNT = round(cur.TOT_AMOUNT + Number(r.IT_AMOUNT || 0));
        grouped.set(k, cur);
      }
      return {
        rows: orderRows([...grouped.values()], ['ZGROUP', 'ZGROUP2']),
        grid: {
          layout: 'RPT_SALES_SLIP_SUMMARY_REPORT',
          variant: 1,
          groupColumns: by1.field ? ['ZGROUP'] : [],
          groupDisplays: [by1.name, by2.name].filter((n) => n && n !== 'None'),
          captions: {},
          title: `${by1.name} Wise Sales Slip Summary Report`,
          period: `DATE : FROM ${p.fromText || p.from || ''}  TO  ${p.toText || p.to || ''}`,
          pageWise: p.printout === '2-PageWise',
        },
      };
    }

    return {
      rows: orderRows(levelled, [...keys, 'BILL_DATE', 'NCCHLN_NO']),
      grid: {
        layout: 'RPT_SALES_SLIP_DETAIL_REPORT',
        variant: 1,
        groupColumns: keys,
        groupDisplays: [by1.name, by2.name].filter((n) => n && n !== 'None'),
        primaryDetailColumn: 'ENT_NO',
        captions: {},
        title: `${by1.name} Wise Sales Slip Detail Report`,
        period: `DATE : FROM ${p.fromText || p.from || ''}  TO  ${p.toText || p.to || ''}`,
        pageWise: p.printout === '2-PageWise',
      },
    };
  },
  async options(companyId) {
    const rows = await slipLines(companyId);
    const u = (f) => [...new Set(rows.map((r) => r[f]).filter((v) => String(v ?? '').trim()))].sort((a, b) => String(a).localeCompare(String(b)));
    return { registers: u('BOOK'), parties: u('PARTY'), items: u('ITEM') };
  },
};

module.exports = { slip, slipNew };
