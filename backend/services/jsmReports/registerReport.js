'use strict';

/**
 * Builder for JSM's four bill registers — Sales, Purchase, Sales Return, Purchase Return — whose
 * screens (Rpt_Jsm_Sales, Rpt_Jsm_Purchase, Rpt_Jsm_Sales_Return, Rpt_Jsm_Purchase_Return) and
 * captured layouts are the same shape:
 *
 *   Summary -> <VIEW>_SMRY_SHORT, or _SMRY_FULL when Report Type is "2-My Format"; one row per group.
 *   Detail  -> <VIEW>_DTL as master/detail: the bill's columns repeated over one row per item line,
 *              counted once per bill by the grid.
 *
 * The screen's "Category Wise" combo IS the layout variant, so JSM's own layout decides which
 * columns a category shows (variants 5 and 6 of the summary carry no TOT.ADD / TOT.LESS, for
 * instance). The grouping column's heading is relabelled per category through `captions`, the way
 * JSM relabels it on screen.
 */
const { orderRows, inList, inDateRange, groupBy, round } = require('./jcEngine');

/** Every grouping JSM offers on these screens. A register only gets the ones it can honour. */
const ALL_CATEGORIES = {
  1: { key: 'REGISTER', caption: 'REGISTER' },
  2: { key: 'PARTY', caption: 'PARTY' },
  3: { key: 'BROKER', caption: 'BROKER' },
  4: { key: 'STATION', caption: 'CITY' },
  5: { key: 'MAINGROUP', caption: 'MAINGROUP' },
  6: { key: 'ITEM_NAME', caption: 'ITEM', perLine: true },
  7: { key: 'ITEM_PARTY', caption: 'ITEM+PARTY', perLine: true },
};

const SUM = ['TO_PCS', 'TO_QTY', 'SUB_TOT', 'T_ADD', 'T_LESS', 'TAXABLE_AMT', 'GST_AMT', 'NET_TOT'];
const LISTS = { parties: 'PARTY', brokers: 'BROKER', books: 'REGISTER', stations: 'STATION' };

/**
 * @param {object} spec
 *   load        (companyId) => rows, each with the JSM column names and a `_lines` array
 *   views       { short, full, detail } captured layout names
 *   categories  the category numbers this register offers, in the screen's order
 *   noun        'Sales' | 'Purchase' | 'Sales Return' | 'Purchase Return'
 */
function registerReport(spec) {
  const offered = spec.categories;

  /** "6-ItemWise" / 6 / "ItemWise" -> 6, defaulting to the category the screen opens on. */
  function categoryOf(raw) {
    const s = String(raw ?? '').trim();
    const n = Number(s.split('-')[0]);
    if (offered.includes(n)) return n;
    const bare = s.replace(/^\d+-/, '').toLowerCase().replace(/[^a-z+]/g, '');
    const hit = offered.find((k) => ALL_CATEGORIES[k].caption.toLowerCase().replace(/[^a-z+]/g, '') === bare);
    if (hit) return hit;
    if (n > 0 && !offered.includes(n)) {
      // JSM's combo lists a grouping this software does not record (Suit, for one). Say so rather
      // than quietly grouping by something else and showing figures under the wrong heading.
      const err = new Error(`This report cannot be grouped that way: ${s}`);
      err.status = 400;
      throw err;
    }
    return offered[0];
  }

  function billOrder(p) {
    if (p.orderBy === 'billno') return ['NCBILL_NO', 'BILL_DATE'];
    if (p.orderBy === 'srno') return ['SRAL_NO', 'BILL_DATE'];
    return ['BILL_DATE', 'SRAL_NO'];
  }

  /** Apply the screen's date window, number range and tab tick lists. */
  function filter(rows, p) {
    let out = inDateRange(rows, 'BILL_DATE', p.from, p.to);

    const field = p.orderBy === 'billno' ? 'NCBILL_NO' : 'SRAL_NO';
    const from = String(p.numFrom ?? '').trim();
    const to = String(p.numTo ?? '').trim();
    if (from || to) {
      out = out.filter((r) => {
        const v = String(r[field] ?? '');
        return (!from || v >= from) && (!to || v <= to);
      });
    }

    for (const [param, f] of Object.entries(LISTS)) out = inList(out, f, p[param]);

    if (Array.isArray(p.items) && p.items.length) {
      const want = new Set(p.items.map((s) => String(s).trim().toUpperCase()));
      out = out
        .map((r) => ({ ...r, _lines: (r._lines || []).filter((l) => want.has(String(l.ITEM_NAME).trim().toUpperCase())) }))
        .filter((r) => r._lines.length);
    }
    return out;
  }

  async function run(companyId, p = {}, deps = {}) {
    const category = categoryOf(p.category);
    const cat = ALL_CATEGORIES[category];
    const detail = p.detail === true || String(p.detail) === 'true';
    const period = `DATE : FROM ${p.fromText || p.from || ''}  TO  ${p.toText || p.to || ''}`;
    const pageWise = p.printout === '2-PageWise';

    const rows = filter(deps.rows || await spec.load(companyId), p);

    const groupValue = (r, l = {}) => (cat.key === 'ITEM_PARTY'
      ? [l.ITEM_NAME || '', r.PARTY || ''].filter(Boolean).join(' / ')
      : (r[cat.key] ?? l[cat.key] ?? ''));

    if (detail) {
      const out = [];
      for (const r of rows) {
        const lines = (r._lines || []).length ? r._lines : [{}];
        for (const l of lines) out.push({ ...r, ...l, _lines: undefined, XGROUP: groupValue(r, l) });
      }
      return {
        rows: orderRows(out, ['XGROUP', ...billOrder(p), 'CO_ENT_NO']),
        grid: {
          layout: spec.views.detail,
          variant: category,
          groupColumns: ['XGROUP'],
          groupDisplays: [cat.caption],
          primaryDetailColumn: 'CO_ENT_NO',
          captions: { GROUP2: cat.caption },
          title: `${cat.caption} Wise ${spec.noun} Detail Report`,
          period,
          pageWise,
        },
      };
    }

    // Summary. A per-line category groups the item LINES, so one bill appears under each item.
    const flat = [];
    for (const r of rows) {
      if (!cat.perLine) {
        flat.push({ ...r, GROUP1: '', GROUP2: groupValue(r), GROUP3: '' });
        continue;
      }
      for (const l of r._lines || []) {
        flat.push({
          ...r,
          GROUP1: l.ITEM_GROUP || '',
          GROUP2: groupValue(r, l),
          GROUP3: l.ITEM_GROUP || '',
          TO_PCS: l.IT_PCS,
          TO_QTY: l.IT_QTY,
          SUB_TOT: l.IT_AMOUNT,
          // The footer adjustments belong to the whole bill, not to one of its lines, so an
          // item-wise summary carries none — as JSM's own layout shows (no TOT.ADD / TOT.LESS).
          T_ADD: 0,
          T_LESS: 0,
          TAXABLE_AMT: l.IT_AMOUNT,
          GST_AMT: 0,
          NET_TOT: l.IT_AMOUNT,
        });
      }
    }
    const grouped = groupBy(flat, ['GROUP2'], { sum: SUM }, (first) => ({
      GROUP1: first.GROUP1 || '', GROUP3: first.GROUP3 || '',
    }));
    for (const g of grouped) for (const f of SUM) g[f] = round(g[f]);

    return {
      rows: orderRows(grouped, ['GROUP2']),
      grid: {
        layout: String(p.reportType || '').startsWith('2') ? spec.views.full : spec.views.short,
        variant: category,
        groupColumns: [],
        groupDisplays: [],
        captions: { GROUP2: cat.caption },
        title: `${cat.caption} Wise ${spec.noun} Summary Report`,
        period,
        pageWise,
      },
    };
  }

  async function options(companyId, p = {}, deps = {}) {
    const rows = deps.rows || await spec.load(companyId);
    const u = (pick) => [...new Set(rows.flatMap(pick).filter((v) => String(v ?? '').trim()))]
      .sort((a, b) => String(a).localeCompare(String(b)));
    return {
      parties: u((r) => [r.PARTY]),
      brokers: u((r) => [r.BROKER]),
      books: u((r) => [r.REGISTER]),
      stations: u((r) => [r.STATION]),
      items: u((r) => (r._lines || []).map((l) => l.ITEM_NAME)),
    };
  }

  return { run, options, categoryOf, categories: offered };
}

module.exports = { registerReport, ALL_CATEGORIES };
