'use strict';

/**
 * JSM: Others Reports › Others Reports › Box Stock
 * (Rpt_Box_Stock_ItemDesc, titled "Online Key Wise Stock Report").
 *
 * Stock per item in whichever unit the screen asks for, with the sub-item — JSM's "online key",
 * the line's own IT_DISC1 — choosing which lines count. Its view (Stock_Book_String) unions the
 * books, each contributing to one column, and swaps the quantity column with the unit radio
 * (`op_qty`/`it_qty`, `op_pcs`/`it_pcs`, `op_kgs`/`it_kgs`):
 *
 *   SELECT … 0.00 AS OP_STOCK, B.<unit> AS SALES, 0.00 AS PURCHASE, 0.00 AS SL_RTN, 0.00 AS PU_RTN
 *   FROM MST_IT_MAST A INNER JOIN T_SL_ITEM B … UNION ALL … T_PU_ITEM …
 *
 * with the opening coming off the item master, and it prints only the rows where something moved
 * (genrate_reports: `{OP_STOCK} <> 0 OR {SALES} <> 0 OR {PURCHASE} <> 0 OR {SL_RTN} <> 0 OR
 * {PU_RTN} <> 0`), Normal, Date Wise or Month Wise.
 *
 * The Kgs unit reads the line's own net kilos; this software records no opening figure in kilos,
 * so on that unit the opening column is zero, as it is on the Kgs stock screens.
 */
const { orderRows, inList, inDateRange, groupBy, round, MONTHS } = require('../jcEngine');
const src = require('../sources/billRegister');

/** The unit radio and the line field it reads. */
const UNITS = {
  1: { name: 'Qty', line: 'IT_QTY', opening: 'openingQty' },
  2: { name: 'Pcs', line: 'IT_PCS', opening: 'openingPcs' },
  3: { name: 'Kgs', line: 'IT_KGS', opening: null },
};

/** Normal / Date Wise / Month Wise. */
const SHAPES = {
  1: { key: null, caption: '' },
  2: { key: 'BILL_DATE', caption: 'DATE' },
  3: { key: 'MONTH', caption: 'MONTH' },
};

const BOOKS = [
  { field: 'SALES', load: (c) => src.loadSalesRegisterRows(c) },
  { field: 'PURCHASE', load: (c) => src.loadPurchaseRegisterRows(c) },
  { field: 'SL_RTN', load: (c) => src.loadReturnRegisterRows(c, 'Sales') },
  { field: 'PU_RTN', load: (c) => src.loadReturnRegisterRows(c, 'Purchase') },
];

const MOVED = ['OP_STOCK', 'SALES', 'PURCHASE', 'SL_RTN', 'PU_RTN'];
const VALUES = ['SALES_VAL', 'PURCHASE_VAL', 'SL_RTN_VAL', 'PU_RTN_VAL'];

async function run(companyId, p = {}, deps = {}) {
  const unit = UNITS[Number(String(p.unit ?? '1').trim().split('-')[0]) || 1] || UNITS[1];
  const shape = SHAPES[Number(String(p.shape ?? '1').trim().split('-')[0]) || 1] || SHAPES[1];
  const withValue = p.withValue === true || String(p.withValue) === 'true';

  let rows = deps.rows;
  if (!rows) {
    rows = [];
    for (const b of BOOKS) {
      for (const bill of inDateRange(await b.load(companyId), 'BILL_DATE', p.from, p.to)) {
        for (const l of bill._lines || []) {
          const date = bill.BILL_DATE ? new Date(bill.BILL_DATE) : null;
          rows.push({
            ITEM_NAME: l.ITEM_NAME || '',
            CATEGORY: l.ITEM_GROUP || '',
            SUBITEM: l.IT_DISC1 || '',
            BILL_DATE: bill.BILL_DATE,
            MONTH: date ? MONTHS[date.getUTCMonth()] : '',
            OP_STOCK: 0,
            SALES: 0, PURCHASE: 0, SL_RTN: 0, PU_RTN: 0,
            SALES_VAL: 0, PURCHASE_VAL: 0, SL_RTN_VAL: 0, PU_RTN_VAL: 0,
            [b.field]: round(Number(l[unit.line] || 0)),
            [`${b.field}_VAL`]: round(Number(l.IT_AMOUNT || 0)),
          });
        }
      }
    }
  }

  rows = inList(rows, 'SUBITEM', p.subItems);
  rows = inList(rows, 'ITEM_NAME', p.items);

  // The opening off the item master, as JSM's own opening union reads it.
  if (!deps.rows && unit.opening) {
    const Item = require('../../../models/Item');
    const items = await Item.find({ companyId }).select(`name group ${unit.opening}`).lean();
    for (const i of items) {
      const opening = round(Number(i[unit.opening] || 0));
      if (!opening) continue;
      rows.push({
        ITEM_NAME: i.name || '',
        CATEGORY: i.group || '',
        SUBITEM: '',
        BILL_DATE: p.from ? new Date(p.from) : null,
        MONTH: p.from ? MONTHS[new Date(p.from).getUTCMonth()] : '',
        OP_STOCK: opening,
        SALES: 0, PURCHASE: 0, SL_RTN: 0, PU_RTN: 0,
        SALES_VAL: 0, PURCHASE_VAL: 0, SL_RTN_VAL: 0, PU_RTN_VAL: 0,
      });
    }
  }

  const keys = ['ITEM_NAME', shape.key].filter(Boolean);
  const grouped = groupBy(rows, keys, { sum: [...MOVED, ...VALUES] }, (first) => ({
    CATEGORY: first.CATEGORY,
    MONTH: first.MONTH,
    BILL_DATE: first.BILL_DATE,
  }));

  const out = [];
  for (const g of grouped) {
    for (const f of [...MOVED, ...VALUES]) g[f] = round(g[f]);
    g.CL_STOCK = round(g.OP_STOCK + g.PURCHASE + g.SL_RTN - g.SALES - g.PU_RTN);
    if (!withValue) for (const f of VALUES) delete g[f];
    // JSM prints only the rows where something moved.
    if (MOVED.some((f) => Math.abs(g[f]) >= 0.005)) out.push(g);
  }

  return {
    rows: orderRows(out, shape.key ? ['ITEM_NAME', shape.key] : ['ITEM_NAME']),
    grid: {
      layout: withValue ? 'JSM_VW_BOX_STOCK_VALUE' : 'JSM_VW_BOX_STOCK',
      variant: 1,
      groupColumns: [],
      groupDisplays: [],
      captions: { OP_STOCK: `OP.${unit.name.toUpperCase()}` },
      title: 'Stock Summary Report',
      period: `PERIOD : From ${p.fromText || p.from || ''}  To  ${p.toText || p.to || ''}`,
      pageWise: false,
    },
  };
}

async function options(companyId) {
  const bills = await src.loadSalesRegisterRows(companyId);
  const lines = bills.flatMap((b) => b._lines || []);
  const u = (f) => [...new Set(lines.map((l) => l[f]).filter((v) => String(v ?? '').trim()))]
    .sort((a, b) => String(a).localeCompare(String(b)));
  return { subItems: u('IT_DISC1'), items: u('ITEM_NAME') };
}

module.exports = { run, options };
