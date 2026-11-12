'use strict';

/**
 * JSM: Reports › Sales › Sales Bill › Sales Order Register (Rpt_Sales_Order_Detail_Report) and
 * Reports › Purchase › Purchase Bill › Purchase Order (Rpt_Purchase_Order_Detail_Rpt).
 *
 * Each order line with what has been delivered against it and what is still owed. JSM reads
 * JSM_VW_SALES_ORDER_STATUS / JSM_VW_PURCHASE_ORDER_STATUS, filters on the order date and the
 * ticked Party / Broker / Item (/ Delivery, State, Station on the sales side), and splits on
 * status (Fill_String_For_Condition):
 *
 *   Pending : balance pieces or quantity still open   (A.BAL_PCS<>0 OR A.BAL_QTY<>0)
 *   Clear   : nothing left                            (A.STOCK_CP = 'C')
 *   All
 *
 * ORD_PCS / ORD_QTY are the order, SL_ (sales) or REC_ (purchase) what was delivered, BAL_ the
 * difference. Delivered is the order line's own invoiced (sales) or received (purchase) count —
 * the same counters the order module keeps — so nothing is recomputed. The bill number and date
 * JSM prints against an order are not recorded on an order here and stay blank.
 */
const { orderRows, inList, inDateRange, round } = require('../jcEngine');

const GROUP_FIELDS = {
  None: null,
  Register: 'BOOK',
  Party: 'PARTY',
  Broker: 'BROKER',
  Item: 'ITEM',
  Delivery: 'DELIVERY',
  State_Code_Nm: 'STATE_NAME',
  Station: 'STATION',
};
const LISTS = {
  parties: 'PARTY', brokers: 'BROKER', items: 'ITEM', deliveries: 'DELIVERY', states: 'STATE_NAME', stations: 'STATION',
};

function fieldOf(choice) {
  const name = String(choice ?? '').trim() || 'None';
  if (!(name in GROUP_FIELDS)) {
    const err = new Error(`Unknown Order By: ${name}`);
    err.status = 400;
    throw err;
  }
  return { name, field: GROUP_FIELDS[name] };
}

async function orderLines(companyId, orderType) {
  const Order = require('../../../models/Order');
  const Party = require('../../../models/Party');
  require('../../../models/Item');
  const orders = await Order.find({ companyId, orderType })
    .populate('partyId', 'name city state brokerId')
    .populate('items.itemId', 'name')
    .lean();
  const brokerIds = [...new Set(orders.map((o) => o.partyId?.brokerId).filter((x) => /^[0-9a-f]{24}$/i.test(String(x || ''))))];
  const brokers = brokerIds.length
    ? new Map((await Party.find({ _id: { $in: brokerIds } }).select('name').lean()).map((p) => [String(p._id), p.name]))
    : new Map();
  const sales = orderType === 'Sales';
  const out = [];
  for (const o of orders) {
    const rawBrk = String(o.partyId?.brokerId || '');
    const brokerName = brokers.get(rawBrk) || (/^[0-9a-f]{24}$/i.test(rawBrk) ? '' : rawBrk);
    (o.items || []).forEach((l, i) => {
      const ordPcs = Number(l.pcs || 0);
      const ordQty = Number(l.mts || 0);
      const donePcs = Number(sales ? l.invoicedPcs : l.receivedPcs) || 0;
      const doneQty = Number(sales ? l.invoicedMts : l.receivedMts) || 0;
      const balPcs = ordPcs - donePcs;
      const balQty = ordQty - doneQty;
      out.push({
        ENT_NO: String(o._id),
        SR_NO: i + 1,
        BOOK: sales ? 'SALES ORDER' : 'PURCHASE ORDER',
        ORD_NO: o.orderNo || '',
        ORD_DATE: o.date,
        PARTY: o.partyId?.name || '',
        BROKER: brokerName,
        DELIVERY: '',
        STATION: o.partyId?.city || '',
        STATE_NAME: o.partyId?.state || '',
        ITEM: l.itemId?.name || '',
        ORD_PCS: ordPcs,
        DONE_PCS: donePcs,
        BAL_PCS: balPcs,
        ORD_QTY: round(ordQty),
        DONE_QTY: round(doneQty),
        BAL_QTY: round(balQty),
        RATE: round(l.rate),
        AMOUNT: round(l.amount),
        REMARK_1: o.remarks || '',
        BILLNO: '',
        BILLDT: null,
        STOCK_CP: Math.abs(balPcs) < 0.005 && Math.abs(balQty) < 0.005 ? 'C' : 'P',
      });
    });
  }
  return out;
}

function orderReport(spec) {
  async function run(companyId, p = {}, deps = {}) {
    const by1 = fieldOf(p.orderBy1);
    const by2 = fieldOf(p.orderBy2);
    let rows = deps.rows || await orderLines(companyId, spec.orderType);
    rows = inDateRange(rows, 'ORD_DATE', p.from, p.to);
    for (const [param, field] of Object.entries(LISTS)) rows = inList(rows, field, p[param]);

    const status = Number(String(p.status ?? '1').trim().split('-')[0]) || 1;
    if (status === 1) {
      rows = rows.filter((r) => r.STOCK_CP !== 'C' && (Math.abs(r.BAL_PCS) > 0.004 || Math.abs(r.BAL_QTY) > 0.004));
    }
    if (status === 2) rows = rows.filter((r) => r.STOCK_CP === 'C');

    const keys = [by1.field ? 'ZGROUP1' : null, by2.field ? 'ZGROUP2' : null].filter(Boolean);
    const levelled = rows.map((r) => ({
      ...r,
      [spec.doneP]: r.DONE_PCS,
      [spec.doneQ]: r.DONE_QTY,
      ZGROUP1: by1.field ? (r[by1.field] || '') : '',
      ZGROUP2: by2.field ? (r[by2.field] || '') : '',
    }));

    return {
      rows: orderRows(levelled, [
        ...keys, 'ORD_DATE',
        { field: 'ORD_NO', dir: 'asc', numeric: true },
        { field: 'SR_NO', dir: 'asc', numeric: true },
      ]),
      grid: {
        layout: spec.layout,
        variant: 1,
        groupColumns: keys,
        groupDisplays: [by1.name, by2.name].filter((n) => n && n !== 'None'),
        primaryDetailColumn: 'ENT_NO',
        captions: {},
        title: `${by1.name} Wise ${spec.noun} Order Details Report`,
        period: `DATE : FROM ${p.fromText || p.from || ''}  TO  ${p.toText || p.to || ''}`,
        pageWise: p.printout === '2-PageWise',
      },
    };
  }

  async function options(companyId) {
    const rows = await orderLines(companyId, spec.orderType);
    const u = (f) => [...new Set(rows.map((r) => r[f]).filter((v) => String(v ?? '').trim()))]
      .sort((a, b) => String(a).localeCompare(String(b)));
    return {
      parties: u('PARTY'), brokers: u('BROKER'), items: u('ITEM'),
      deliveries: u('DELIVERY'), states: u('STATE_NAME'), stations: u('STATION'),
    };
  }

  return { run, options };
}

module.exports = {
  sales: orderReport({
    orderType: 'Sales', noun: 'Sales', layout: 'JSM_VW_SALES_ORDER_DETAILED_REPORT', doneP: 'SL_PCS', doneQ: 'SL_QTY',
  }),
  purchase: orderReport({
    orderType: 'Purchase', noun: 'Purchase', layout: 'JSM_VW_PURCHASE_ORDER_STATUS_REPORT', doneP: 'REC_PCS', doneQ: 'REC_QTY',
  }),
};
