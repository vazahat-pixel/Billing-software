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

const SALES_CATEGORIES = {
  1: { fields: ['BOOK'], caption: 'BOOK' },
  2: { fields: ['ITEM_NAME'], caption: 'ITEM' },
  3: { fields: ['ITEM_NAME', 'PARTY'], caption: 'ITEM+PARTY' },
  4: { fields: ['ITEM_NAME', 'BROKER'], caption: 'ITEM+BROKER' },
  5: { fields: ['ITEM_NAME', 'BROKER', 'PARTY'], caption: 'ITEM+BROKER+PARTY' },
  6: { fields: ['PARTY'], caption: 'PARTY' },
  7: { fields: ['ITEM_NAME', 'BOOK'], caption: 'ITEM+BOOK' },
  8: { fields: ['ITEM_NAME', 'STATION'], caption: 'ITEM+CITY' },
  9: { fields: ['BROKER'], caption: 'BROKER' },
};

const PURCHASE_CATEGORIES = {
  1: { fields: ['BOOK'], caption: 'BOOK' },
  2: { fields: ['ITEM_NAME'], caption: 'ITEM' },
  3: { fields: ['ITEM_NAME', 'PARTY'], caption: 'ITEM+PARTY' },
  4: { fields: ['ITEM_NAME', 'BROKER'], caption: 'ITEM+BROKER' },
  5: { fields: ['ITEM_NAME', 'BROKER', 'PARTY'], caption: 'ITEM+BROKER+PARTY' },
};

const LISTS = { parties: 'PARTY', brokers: 'BROKER', books: 'BOOK', items: 'ITEM_NAME' };
const SUM = ['IT_PCS', 'IT_QTY', 'IT_AMOUNT'];

function categoryOf(raw, categories) {
  const n = Number(String(raw ?? '').trim().split('-')[0]);
  return categories[n] ? n : 1;
}

function groupValue(line, fields) {
  return fields.map((f) => line[f] || '').filter(Boolean).join(' / ');
}

function itemWiseSummaryReport({ side, view, categories, noun }) {
  const load = side === 'sales' ? loadSalesRegisterRows : loadPurchaseRegisterRows;

  async function run(companyId, p = {}, deps = {}) {
    const category = categoryOf(p.category, categories);
    const cat = categories[category];
    const monthWise = p.monthWise === true || String(p.monthWise) === 'true';

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
        const month = bill.BILL_DATE ? MONTHS[new Date(bill.BILL_DATE).getUTCMonth()] : '';
        lines.push({
          GROUP1: side === 'sales' ? bill.BROKER : bill.PARTY,
          GROUP2: groupValue(merged, cat.fields),
          GROUP3: monthWise ? month : '',
          IT_PCS: l.IT_PCS,
          IT_QTY: l.IT_QTY,
          IT_AMOUNT: l.IT_AMOUNT,
        });
      }
    }

    const groupKeys = monthWise ? ['GROUP2', 'GROUP3'] : ['GROUP2'];
    const grouped = groupBy(lines, groupKeys, { sum: SUM });
    for (const g of grouped) {
      for (const f of SUM) g[f] = round(g[f]);
      g.AVG_RATE = g.IT_QTY ? round(g.IT_AMOUNT / g.IT_QTY) : (g.IT_PCS ? round(g.IT_AMOUNT / g.IT_PCS) : 0);
    }

    return {
      rows: orderRows(grouped, groupKeys),
      grid: {
        layout: view,
        variant: category,
        groupColumns: [],
        groupDisplays: [],
        captions: { GROUP2: cat.caption },
        title: `${cat.caption} Wise ${noun} Item Summary Report`,
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
