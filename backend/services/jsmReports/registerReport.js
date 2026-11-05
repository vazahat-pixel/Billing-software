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

/**
 * Every grouping JSM offers on these screens. A register only gets the ones it can honour.
 *
 * `key` is the column JSM puts in GROUP2 (the row label); `group1` is the extra outer level JSM
 * adds for MainGroup only — its own SQL is `GROUP1=A.PARTY_MN_GROUP, GROUP2=A.PARTY ... GROUP BY
 * A.PARTY_MN_GROUP, PARTY`, i.e. a row per PARTY under a main-group header, not one row per main
 * group (Rpt_Jsm_Sales.Genrate_Reports, decompiled).
 */
const ALL_CATEGORIES = {
  1: { key: 'REGISTER', caption: 'REGISTER', title: '' },
  2: { key: 'PARTY', caption: 'PARTY', title: 'Party Wise ' },
  3: { key: 'BROKER', caption: 'BROKER', title: 'Broker Wise ' },
  4: { key: 'STATION', caption: 'CITY', title: 'City Wise ' },
  5: { key: 'PARTY', group1: 'MAINGROUP', caption: 'MAINGROUP', title: 'MainGroup Wise ', registerTitle: 'Main Group Wise ' },
  6: { key: 'ITEM_NAME', caption: 'ITEM', perLine: true, title: 'Item Wise ' },
  // Item+Party lists under the ITEM alone and breaks ties on the party —
  // `JS_GROUP=A.ITEM_NAME, JS_DETAIL=A.PARTY ... order by A.ITEM_NAME,a.PARTY,...`. Only the
  // (JSM-less) summary of this category folds both into one label.
  7: { key: 'ITEM_PARTY', detailGroup: 'ITEM_NAME', order2: 'PARTY', caption: 'ITEM+PARTY', perLine: true, title: 'Item+Party Wise ' },
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

  /**
   * JSM always sorts a register the same way — `ORDER BY <group>, BILL_DATE, BILL_NO, CBILL_NO,
   * NCBILL_NO [, SR_NO]`. The A-Date / B-Bill.No / C-Serial.No radio only swaps which range
   * FILTERS the rows (Fill_String_For_Condition), it never re-sorts them, so this does not depend
   * on the radio. SRAL_NO stands in for JSM's internal BILL_NO/CBILL_NO pair.
   */
  const BILL_ORDER = ['BILL_DATE',
    { field: 'SRAL_NO', dir: 'asc', numeric: true },
    { field: 'NCBILL_NO', dir: 'asc', numeric: true }];

  /** Broker Wise and Item+Party break their ties on the party first, as JSM's own ORDER BY does. */
  const orderFor = (cat) => ((cat.key === 'BROKER' || cat.order2) ? [cat.order2 || 'PARTY', ...BILL_ORDER] : BILL_ORDER);

  /**
   * The screen's own "Summary Reports" tick. It opens ticked on JSM (the captured runtime state,
   * and what the owner's recording showed), so an unset param keeps the grouped summary.
   */
  const isSummary = (p) => p.summaryReports === undefined || p.summaryReports === null
    || p.summaryReports === true || String(p.summaryReports) === 'true';

  /** Compare bill numbers the way people read them: 9 before 10, then text for the rest. */
  function numCompare(a, b) {
    const na = Number(a);
    const nb = Number(b);
    if (Number.isFinite(na) && Number.isFinite(nb) && String(a).trim() !== '' && String(b).trim() !== '') return na - nb;
    return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
  }

  /**
   * Apply the screen's range and lists. On JSM's screen the date From/To and the number From/To sit in
   * the same spot and the A / B / C radio swaps one for the other, so exactly one of them filters:
   * A-Date the bill dates, B-Bill.No / C-Serial.No that number.
   */
  function filter(rows, p) {
    let out = rows;
    if (p.orderBy === 'billno' || p.orderBy === 'srno') {
      const field = p.orderBy === 'billno' ? 'NCBILL_NO' : 'SRAL_NO';
      const from = String(p.numFrom ?? '').trim();
      const to = String(p.numTo ?? '').trim();
      if (from || to) {
        out = out.filter((r) => {
          const v = String(r[field] ?? '').trim();
          return (!from || numCompare(v, from) >= 0) && (!to || numCompare(v, to) <= 0);
        });
      }
    } else {
      out = inDateRange(out, 'BILL_DATE', p.from, p.to);
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
    // Heads the grid with the range that actually filtered it.
    const period = p.orderBy === 'billno' || p.orderBy === 'srno'
      ? `${p.orderBy === 'billno' ? 'BILL.NO' : 'SR.NO'} : FROM ${p.numFrom ?? ''}  TO  ${p.numTo ?? ''}`
      : `DATE : FROM ${p.fromText || p.from || ''}  TO  ${p.toText || p.to || ''}`;
    const pageWise = p.printout === '2-PageWise';

    const rows = filter(deps.rows || await spec.load(companyId), p);

    const groupValue = (r, l = {}) => (cat.key === 'ITEM_PARTY'
      ? [l.ITEM_NAME || '', r.PARTY || ''].filter(Boolean).join(' / ')
      : (r[cat.key] ?? l[cat.key] ?? ''));
    // JSM's JS_GROUP: the outer level for MainGroup, the item alone for Item+Party, and the row
    // label itself for every other category.
    const outerValue = (r, l = {}) => {
      if (cat.group1) return r[cat.group1] ?? '';
      if (cat.detailGroup) return r[cat.detailGroup] ?? l[cat.detailGroup] ?? '';
      return groupValue(r, l);
    };

    if (detail) {
      const out = [];
      for (const r of rows) {
        const lines = (r._lines || []).length ? r._lines : [{}];
        for (const l of lines) out.push({ ...r, ...l, _lines: undefined, XGROUP: outerValue(r, l) });
      }
      return {
        rows: orderRows(out, ['XGROUP', ...orderFor(cat), 'CO_ENT_NO']),
        grid: {
          layout: spec.views.detail,
          variant: category,
          groupColumns: ['XGROUP'],
          groupDisplays: [cat.caption],
          primaryDetailColumn: 'CO_ENT_NO',
          captions: { GROUP2: cat.caption },
          title: `${cat.title}${spec.noun} Report [Detail]`,
          period,
          pageWise,
        },
      };
    }

    // "Summary Reports" unticked is JSM's plain Register: one row per bill under the category's
    // own header, on the _SMRY_FULL layout (which carries the per-bill columns). Ticked, JSM
    // builds its _RUNTIME grouped view instead and shows the _SMRY_SHORT totals layout.
    if (!isSummary(p)) {
      const out = rows.map((r) => ({ ...r, _lines: undefined, XGROUP: outerValue(r) }));
      return {
        rows: orderRows(out, ['XGROUP', ...orderFor(cat)]),
        grid: {
          layout: spec.views.full,
          variant: category,
          groupColumns: ['XGROUP'],
          groupDisplays: [cat.caption],
          captions: { GROUP2: cat.caption },
          title: `${cat.registerTitle ?? cat.title}${spec.noun} Report`,
          period,
          pageWise,
        },
      };
    }

    // Summary. A per-line category groups the item LINES, so one bill appears under each item.
    const flat = [];
    for (const r of rows) {
      if (!cat.perLine) {
        flat.push({ ...r, GROUP1: cat.group1 ? (r[cat.group1] ?? '') : '', GROUP2: groupValue(r), GROUP3: '' });
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
    // MainGroup is JSM's only two-level summary: GROUP BY PARTY_MN_GROUP, PARTY, ORDER BY both.
    const keys = cat.group1 ? ['GROUP1', 'GROUP2'] : ['GROUP2'];
    const grouped = groupBy(flat, keys, { sum: SUM }, (first) => ({
      GROUP1: first.GROUP1 || '', GROUP3: first.GROUP3 || '',
    }));
    for (const g of grouped) for (const f of SUM) g[f] = round(g[f]);

    return {
      rows: orderRows(grouped, keys),
      grid: {
        layout: spec.views.short,
        variant: category,
        groupColumns: cat.group1 ? ['GROUP1'] : [],
        groupDisplays: cat.group1 ? [cat.caption] : [],
        captions: { GROUP2: cat.caption },
        title: `${cat.title}${spec.noun} Report [Summary]`,
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
