'use strict';

/**
 * JSM: Reports › Purchase › Purchase Bill › Summary and Detail (both the form Rpt_Jsm_Purchase).
 *
 * The screen's "Category Wise" combo IS the layout variant: 1-Register, 2-PartyWise, 3-BrokerWise,
 * 4-CityWise, 5-MainGroup, 6-ItemWise. JSM stores one caption per column, so the heading of the
 * grouping column is sent per run as `captions`, the way JSM relabels it on screen.
 *
 *   Summary -> JSM_VW_PURCHASE_SMRY_SHORT ("My Format" -> JSM_VW_PURCHASE_SMRY_FULL), one row per
 *              group. In JSM's own layout variants 5 and 6 carry no TOT.ADD / TOT.LESS and move
 *              NET.AMT up, which falls out of the captured layout — nothing to do here.
 *   Detail  -> JSM_VW_PURCHASE_DTL, bill columns repeated over one row per item line.
 */
const { loadPurchaseRegisterRows } = require('../sources/purchaseRegister');
const { orderRows, inList, inDateRange, groupBy, round } = require('../jcEngine');

/** Category number -> the row field it groups on, and the heading JSM shows for it. */
const CATEGORIES = {
  1: { key: 'REGISTER', caption: 'REGISTER' },
  2: { key: 'PARTY', caption: 'PARTY' },
  3: { key: 'BROKER', caption: 'BROKER' },
  4: { key: 'STATION', caption: 'CITY' },
  5: { key: 'MAINGROUP', caption: 'MAINGROUP' },
  6: { key: 'ITEM_NAME', caption: 'ITEM', perLine: true },
};

const LISTS = { parties: 'PARTY', brokers: 'BROKER', books: 'REGISTER', stations: 'STATION', items: 'ITEM_NAME' };
const SUM = ['TO_PCS', 'TO_QTY', 'SUB_TOT', 'T_ADD', 'T_LESS', 'TAXABLE_AMT', 'GST_AMT', 'NET_TOT'];

/** "6-ItemWise" / 6 / "ItemWise" -> 6 */
function categoryOf(raw) {
  const s = String(raw ?? '').trim();
  const byNumber = Number(s.split('-')[0]);
  if (CATEGORIES[byNumber]) return byNumber;
  const found = Object.entries(CATEGORIES).find(([, c]) => c.caption.toLowerCase() === s.replace(/^\d+-/, '').toLowerCase());
  return found ? Number(found[0]) : 1;
}

/** Order the bills the way the screen's A-Date / B-Bill.No / C-Serial.No radio asks. */
function billOrder(p) {
  if (p.orderBy === 'billno') return ['NCBILL_NO', 'BILL_DATE'];
  if (p.orderBy === 'srno') return ['SRAL_NO', 'BILL_DATE'];
  return ['BILL_DATE', 'SRAL_NO'];
}

/**
 * @param {object} p  from, to, fromText, toText, category, reportType ('1-Default'|'2-My Format'),
 *   detail (true for the Detail screen), orderBy ('date'|'billno'|'srno'), numFrom / numTo,
 *   tick lists, printout
 */
async function run(companyId, p = {}, deps = {}) {
  const category = categoryOf(p.category);
  const cat = CATEGORIES[category];
  const detail = p.detail === true || String(p.detail) === 'true';

  let rows = deps.rows || await loadPurchaseRegisterRows(companyId);
  rows = inDateRange(rows, 'BILL_DATE', p.from, p.to);

  // Number range, against whichever number the radio selected.
  const field = p.orderBy === 'billno' ? 'NCBILL_NO' : 'SRAL_NO';
  const from = String(p.numFrom ?? '').trim();
  const to = String(p.numTo ?? '').trim();
  if (from || to) {
    rows = rows.filter((r) => {
      const v = String(r[field] ?? '');
      return (!from || v >= from) && (!to || v <= to);
    });
  }

  for (const [param, f] of Object.entries(LISTS)) {
    if (f === 'ITEM_NAME') continue; // item is a line field; filtered below
    rows = inList(rows, f, p[param]);
  }
  if (Array.isArray(p.items) && p.items.length) {
    const want = new Set(p.items.map((s) => String(s).trim().toUpperCase()));
    rows = rows
      .map((r) => ({ ...r, _lines: r._lines.filter((l) => want.has(String(l.ITEM_NAME).trim().toUpperCase())) }))
      .filter((r) => r._lines.length);
  }

  if (detail) {
    // One row per item line, the bill's own columns repeated on each (the grid counts them once).
    const out = [];
    for (const r of rows) {
      const lines = r._lines.length ? r._lines : [{}];
      for (const l of lines) out.push({ ...r, ...l, _lines: undefined, XGROUP: r[cat.key] ?? l[cat.key] ?? '' });
    }
    const ordered = orderRows(out, ['XGROUP', ...billOrder(p), 'CO_ENT_NO']);
    return {
      rows: ordered,
      grid: {
        layout: 'JSM_VW_PURCHASE_DTL',
        variant: category,
        groupColumns: ['XGROUP'],
        groupDisplays: [cat.caption],
        primaryDetailColumn: 'CO_ENT_NO',
        captions: { GROUP2: cat.caption },
        title: `${cat.caption} Wise Purchase Detail Report`,
        period: `DATE : FROM ${p.fromText || p.from || ''}  TO  ${p.toText || p.to || ''}`,
        pageWise: p.printout === '2-PageWise',
      },
    };
  }

  // Summary: one row per group. ItemWise groups the LINES, so their figures are the line's.
  let grouped;
  if (cat.perLine) {
    const flat = [];
    for (const r of rows) {
      for (const l of r._lines) {
        flat.push({
          ...r,
          GROUP1: l.ITEM_GROUP || '',
          GROUP2: l.ITEM_NAME || '',
          GROUP3: l.ITEM_GROUP || '',
          TO_PCS: l.IT_PCS,
          TO_QTY: l.IT_QTY,
          SUB_TOT: l.IT_AMOUNT,
          T_ADD: 0,
          T_LESS: 0,
          TAXABLE_AMT: l.IT_AMOUNT,
          GST_AMT: 0,
          NET_TOT: l.IT_AMOUNT,
        });
      }
    }
    grouped = groupBy(flat, ['GROUP2'], { sum: SUM }, (first) => ({ GROUP1: first.GROUP1, GROUP3: first.GROUP3 }));
  } else {
    const flat = rows.map((r) => ({ ...r, GROUP1: '', GROUP2: r[cat.key] || '', GROUP3: '' }));
    grouped = groupBy(flat, ['GROUP2'], { sum: SUM }, () => ({ GROUP1: '', GROUP3: '' }));
  }
  for (const g of grouped) for (const f of SUM) g[f] = round(g[f]);

  return {
    rows: orderRows(grouped, ['GROUP2']),
    grid: {
      layout: String(p.reportType || '').startsWith('2') ? 'JSM_VW_PURCHASE_SMRY_FULL' : 'JSM_VW_PURCHASE_SMRY_SHORT',
      variant: category,
      groupColumns: [],
      groupDisplays: [],
      captions: { GROUP2: cat.caption },
      title: `${cat.caption} Wise Purchase Summary Report`,
      period: `DATE : FROM ${p.fromText || p.from || ''}  TO  ${p.toText || p.to || ''}`,
      pageWise: p.printout === '2-PageWise',
    },
  };
}

async function options(companyId, p = {}, deps = {}) {
  const rows = deps.rows || await loadPurchaseRegisterRows(companyId);
  const u = (pick) => [...new Set(rows.flatMap(pick).filter((v) => String(v ?? '').trim()))]
    .sort((a, b) => String(a).localeCompare(String(b)));
  return {
    parties: u((r) => [r.PARTY]),
    brokers: u((r) => [r.BROKER]),
    books: u((r) => [r.REGISTER]),
    stations: u((r) => [r.STATION]),
    items: u((r) => r._lines.map((l) => l.ITEM_NAME)),
  };
}

module.exports = { run, options, CATEGORIES, categoryOf };
