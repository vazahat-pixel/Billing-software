'use strict';

/**
 * JSM: Reports › Sales/Purchase › Sales/Purchase Bill › Item Wise Summary
 * (Rpt_Jsm_Sales_ItemSummary / Rpt_Jsm_Purchase_ItemSummary), screens
 * JSM_VW_SALES_SMRY_SHORT_ITEMWISE / JSM_VW_PURCHASE_SMRY_SHORT_ITEMWISE.
 *
 * Reuses the same bill rows (and their item _lines) the registers already load — no new query, no
 * new figure. One row per item line becomes one grouped row here.
 *
 * JSM's own layout gives Sales GROUP1="BROKER", GROUP2="BOOK", GROUP3="MONTH" (Month Wise), and
 * Purchase GROUP1="PARTY", GROUP2="ITEM". GROUP1 carries no order in the captured layout (it is
 * never the primary sort key), and composite categories (Party+Item, Broker+Item, …) are joined
 * into GROUP2 the same way "Item+PartyWise" already is on the bill registers — confirmed from a
 * run read directly off the owner's JSM (today's JSM_VW_PURCHASE_SMRY_SHORT_ITEMWISE_RUNTIME):
 * Category 2-Item there grouped by ITEM_NAME alone, matching variant 2 here exactly.
 *
 * Verified from the owner's JSM screen recording (03/11/2026) and confirmed from the live
 * database; categories beyond 2-Item/3-Party+Item were not directly re-run there, so their
 * composite grouping follows the category's own name rather than a captured RUNTIME query.
 */
const { loadSalesRegisterRows, loadPurchaseRegisterRows } = require('../sources/billRegister');
const { orderRows, inList, inDateRange, groupBy, round, MONTHS } = require('../jcEngine');

/**
 * JSM's own GROUP1 / GROUP2 / GROUP3 per Category Wise option, straight out of the decompiled
 * screens (Rpt_Jsm_Sales_ItemSummary / _Purchase_ItemSummary → Generate_Reports). These are real
 * levels, not one joined label: GROUP1 is the group HEADER and GROUP2 (plus GROUP3 where the
 * captured layout shows it) are the row's own columns.
 *
 * `month` is the same category with the screen's "Month Wise" box ticked — JSM has a month form
 * only for the categories listed with one; the others ignore the box.
 */
const SALES_CATEGORIES = {
  1: { plain: [null, 'BOOK'], month: ['BOOK', 'MONTH_NAME'], caption: 'BOOK', title: '' },
  2: { plain: [null, 'ITEM_NAME'], month: ['ITEM_NAME', 'MONTH_NAME'], caption: 'ITEM', title: 'Item Wise ' },
  3: { plain: ['PARTY', 'ITEM_NAME'], month: ['PARTY', 'ITEM_NAME', 'MONTH_NAME'], caption: 'ITEM', title: 'Party+Item Wise ' },
  4: { plain: ['BROKER', 'ITEM_NAME'], month: ['BROKER', 'ITEM_NAME', 'MONTH_NAME'], caption: 'ITEM', title: 'Broker+Item Wise ' },
  5: { plain: ['BROKER', 'PARTY', 'ITEM_NAME'], caption: 'PARTY', title: 'Broker+Party+Item Wise ' },
  6: { plain: [null, 'PARTY'], month: ['PARTY', 'MONTH_NAME'], caption: 'PARTY', title: 'Party Wise ' },
  7: { plain: ['ITEM_NAME', 'BOOK'], caption: 'BOOK', title: 'Item+Book Wise ' },
  8: { plain: ['STATION', 'ITEM_NAME'], caption: 'ITEM', title: 'City+Item Wise ' },
  9: { plain: ['BROKER', 'PARTY'], caption: 'PARTY', title: 'Broker Wise ' },
};

const PURCHASE_CATEGORIES = {
  1: SALES_CATEGORIES[1],
  2: SALES_CATEGORIES[2],
  3: SALES_CATEGORIES[3],
  4: SALES_CATEGORIES[4],
  5: SALES_CATEGORIES[5],
};

const LISTS = { parties: 'PARTY', brokers: 'BROKER', books: 'REGISTER', items: 'ITEM_NAME' };

/** The levels above are named as JSM names them; this is where its name differs from ours. */
const FIELD = { BOOK: 'REGISTER' };
const valueOf = (row, level) => (level ? (row[FIELD[level] || level] || '') : '');
const SUM = ['IT_PCS', 'IT_QTY', 'IT_AMOUNT'];

function categoryOf(raw, categories) {
  const n = Number(String(raw ?? '').trim().split('-')[0]);
  return categories[n] ? n : 1;
}

/**
 * JSM's own average rate, computed on the already-summed row (Generate_Reports):
 *   CASE UNIT_NAME WHEN 'PCS' THEN IT_AMOUNT / (CASE IT_PCS WHEN 0 THEN 1 ELSE IT_PCS END)
 *                              ELSE IT_AMOUNT / (CASE IT_QTY1 WHEN 0 THEN 1 ELSE IT_QTY1 END) END
 * — the unit decides which quantity divides, and a zero divisor becomes 1, so the row shows the
 * amount rather than a zero. IT_QTY1 is JSM's second quantity column; this software records the
 * one quantity, so IT_QTY stands in for it.
 */
function avgRate(g) {
  const divisor = String(g.UNIT_NAME || '').trim().toUpperCase() === 'PCS' ? g.IT_PCS : g.IT_QTY;
  return round(g.IT_AMOUNT / (divisor || 1));
}

function itemWiseSummaryReport({ side, view, categories, noun }) {
  const load = side === 'sales' ? loadSalesRegisterRows : loadPurchaseRegisterRows;

  async function run(companyId, p = {}, deps = {}) {
    const category = categoryOf(p.category, categories);
    const cat = categories[category];
    const monthWise = p.monthWise === true || String(p.monthWise) === 'true';
    // JSM has a Month Wise form only for some categories; the rest ignore the box.
    const levels = (monthWise && cat.month) ? cat.month : cat.plain;

    let bills = deps.rows || await load(companyId);
    bills = inDateRange(bills, 'BILL_DATE', p.from, p.to);
    for (const [param, field] of Object.entries(LISTS)) {
      if (field === 'ITEM_NAME') continue;
      bills = inList(bills, field, p[param]);
    }

    const lines = [];
    for (const bill of bills) {
      for (const l of bill._lines) {
        const merged = { ...bill, ...l };
        if (Array.isArray(p.items) && p.items.length) {
          const want = new Set(p.items.map((s) => String(s).trim().toUpperCase()));
          if (!want.has(String(l.ITEM_NAME).trim().toUpperCase())) continue;
        }
        merged.MONTH_NAME = bill.BILL_DATE ? MONTHS[new Date(bill.BILL_DATE).getUTCMonth()] : '';
        lines.push({
          GROUP1: valueOf(merged, levels[0]),
          GROUP2: valueOf(merged, levels[1]),
          GROUP3: valueOf(merged, levels[2]),
          UNIT_NAME: l.UNIT_NAME || '',
          IT_PCS: l.IT_PCS,
          IT_QTY: l.IT_QTY,
          IT_AMOUNT: l.IT_AMOUNT,
        });
      }
    }

    // GROUP BY exactly the levels JSM names, in its order.
    const groupKeys = ['GROUP1', 'GROUP2', 'GROUP3'].filter((_, i) => levels[i]);
    const grouped = groupBy(lines, groupKeys, { sum: SUM }, (first) => ({ UNIT_NAME: first.UNIT_NAME }));
    for (const g of grouped) {
      for (const f of SUM) g[f] = round(g[f]);
      // JSM aggregates the unit as MIN(UNIT_NAME) before the rate is worked out.
      const units = lines
        .filter((l) => groupKeys.every((k) => l[k] === g[k]))
        .map((l) => String(l.UNIT_NAME || ''));
      g.UNIT_NAME = units.length ? units.reduce((a, b) => (a <= b ? a : b)) : '';
      g.AVG_RATE = avgRate(g);
    }

    return {
      rows: orderRows(grouped, groupKeys),
      grid: {
        layout: view,
        variant: category,
        // GROUP1 is JSM's group header; GROUP2/GROUP3 are the row's own columns.
        groupColumns: levels[0] ? ['GROUP1'] : [],
        groupDisplays: levels[0] ? [levels[0] === 'ITEM_NAME' ? 'ITEM' : levels[0]] : [],
        captions: { GROUP2: cat.caption },
        title: `${cat.title}${noun} Report [ItemWise Summary]`,
        period: `DATE : FROM ${p.fromText || p.from || ''}  TO  ${p.toText || p.to || ''}`,
        pageWise: p.printout === '2-PageWise',
      },
    };
  }

  async function options(companyId, p = {}, deps = {}) {
    const bills = deps.rows || await load(companyId);
    const u = (pick) => [...new Set(bills.flatMap(pick).filter((v) => String(v ?? '').trim()))]
      .sort((a, b) => String(a).localeCompare(String(b)));
    return {
      parties: u((r) => [r.PARTY]),
      brokers: u((r) => [r.BROKER]),
      books: u((r) => [r.BOOK]),
      items: u((r) => r._lines.map((l) => l.ITEM_NAME)),
    };
  }

  return { run, options, categories: Object.keys(categories).map(Number) };
}

module.exports = {
  salesItemWise: itemWiseSummaryReport({ side: 'sales', view: 'JSM_VW_SALES_SMRY_SHORT_ITEMWISE', categories: SALES_CATEGORIES, noun: 'Sales' }),
  purchaseItemWise: itemWiseSummaryReport({ side: 'purchase', view: 'JSM_VW_PURCHASE_SMRY_SHORT_ITEMWISE', categories: PURCHASE_CATEGORIES, noun: 'Purchase' }),
};
