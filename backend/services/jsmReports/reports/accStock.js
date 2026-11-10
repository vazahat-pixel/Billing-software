'use strict';

/**
 * JSM: Reports › Acc Stock Reports › Stock SubItem Wise / Stock SubItem(Detail) Wise /
 * Stock Register (Rpt_StockSubItemAccReport, Rpt_StockSubItemAcc_DetailReport,
 * Rpt_StockSubItemAcc_DetailReport_Online).
 *
 * What came in and what went out, per item and the sub-item written on the line. JSM builds one
 * runtime view by unioning the four books, a row per item line, each contributing to its own
 * quantity column (btn_screen_Click):
 *
 *   'PU'   … B.IT_QTY AS PUQTY,  0 AS SLQTY,  0 AS SLRQTY, 0 AS PURQTY   FROM T_PURCHASE
 *   'SL'   … 0,        B.IT_QTY AS SLQTY,     0,           0             FROM T_SALES
 *   'RTSL' … 0, 0,     B.IT_QTY AS SLRQTY,    0                          FROM T_SL_RETU
 *   'RTPU' … 0, 0, 0,  B.IT_QTY AS PURQTY                                FROM T_PU_RETU
 *
 * with SUBITEM = the line's IT_DISC1 and CATEGORY = the item's group.
 */
const { orderRows, inList, inDateRange, groupBy, round } = require('../jcEngine');
const src = require('../sources/billRegister');

const BOOKS = [
  { book: 'PU', field: 'PUQTY', load: (c) => src.loadPurchaseRegisterRows(c) },
  { book: 'SL', field: 'SLQTY', load: (c) => src.loadSalesRegisterRows(c) },
  { book: 'RTSL', field: 'SLRQTY', load: (c) => src.loadReturnRegisterRows(c, 'Sales') },
  { book: 'RTPU', field: 'PURQTY', load: (c) => src.loadReturnRegisterRows(c, 'Purchase') },
];

const QTYS = ['PUQTY', 'SLQTY', 'SLRQTY', 'PURQTY'];
const LISTS = { items: 'ITEM', categories: 'CATEGORY' };

/** One row per item line of every book, as JSM's union produces them. */
async function movementRows(companyId, p, deps) {
  if (deps.rows) return deps.rows;
  const out = [];
  for (const b of BOOKS) {
    const bills = inDateRange(await b.load(companyId), 'BILL_DATE', p.from, p.to);
    for (const bill of bills) {
      for (const l of bill._lines || []) {
        out.push({
          BOOK: b.book,
          NCBILL_NO: bill.NCBILL_NO || '',
          BILL_DATE: bill.BILL_DATE,
          PARTY: bill.PARTY || '',
          ITEM: l.ITEM_NAME || '',
          CATEGORY: l.ITEM_GROUP || '',
          SUBITEM: l.IT_DISC1 || '',
          PUQTY: 0, SLQTY: 0, SLRQTY: 0, PURQTY: 0,
          [b.field]: round(Number(l.IT_QTY || 0)),
        });
      }
    }
  }
  return out;
}

/**
 * @param {object} spec
 *   detail  true keeps every line; false totals them per item and sub-item
 *   noun    what JSM heads the window with
 */
function accStockReport(spec) {
  async function run(companyId, p = {}, deps = {}) {
    let rows = await movementRows(companyId, p, deps);
    for (const [param, field] of Object.entries(LISTS)) rows = inList(rows, field, p[param]);

    if (spec.detail) {
      return {
        rows: orderRows(rows, ['ITEM', 'SUBITEM', 'BILL_DATE', { field: 'NCBILL_NO', dir: 'asc', numeric: true }]),
        grid: {
          layout: 'JSM_VW_ACC_STOCK_DETAIL',
          variant: 1,
          groupColumns: ['ITEM'],
          groupDisplays: ['ITEM'],
          captions: {},
          title: `${spec.noun} Report`,
          period: `DATE : FROM ${p.fromText || p.from || ''}  TO  ${p.toText || p.to || ''}`,
          pageWise: p.printout === '2-PageWise',
        },
      };
    }

    const grouped = groupBy(rows, ['ITEM', 'SUBITEM'], { sum: QTYS }, (first) => ({ CATEGORY: first.CATEGORY }));
    for (const g of grouped) {
      for (const f of QTYS) g[f] = round(g[f]);
      // What is left: everything bought and returned in, less everything sold and returned out.
      g.BALQTY = round(g.PUQTY + g.SLRQTY - g.SLQTY - g.PURQTY);
    }

    return {
      rows: orderRows(grouped, ['ITEM', 'SUBITEM']),
      grid: {
        layout: 'JSM_VW_ACC_STOCK',
        variant: 1,
        groupColumns: [],
        groupDisplays: [],
        captions: {},
        title: `${spec.noun} Report`,
        period: `DATE : FROM ${p.fromText || p.from || ''}  TO  ${p.toText || p.to || ''}`,
        pageWise: p.printout === '2-PageWise',
      },
    };
  }

  async function options(companyId, p = {}, deps = {}) {
    const rows = await movementRows(companyId, p, deps);
    const u = (f) => [...new Set(rows.map((r) => r[f]).filter((v) => String(v ?? '').trim()))]
      .sort((a, b) => String(a).localeCompare(String(b)));
    return { items: u('ITEM'), categories: u('CATEGORY') };
  }

  return { run, options };
}

module.exports = {
  subItem: accStockReport({ detail: false, noun: 'SubItem Wise Stock' }),
  subItemDetail: accStockReport({ detail: true, noun: 'SubItem Detail Wise Stock' }),
  register: accStockReport({ detail: true, noun: 'Stock Register' }),
};
