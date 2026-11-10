'use strict';

/**
 * JSM: Reports › Process Reports › Item Wise Summary (Rpt_Jsm_Process_ItemSummary).
 *
 * The mill receipts totalled per item, on JSM's own GROUP1 / GROUP2 levels — straight out of the
 * decompiled form's Generate_Reports, which selects
 *
 *   <GROUP1> AS GROUP1, <GROUP2> AS GROUP2, '' AS GROUP3,
 *   SUM(IT_PCS) AS IT_PCS, SUM(SND_QTY) AS SND_QTY, SUM(REC_QTY) AS REC_QTY, SUM(IT_AMOUNT) ...
 *
 * and works the average rate out on the summed row as
 *   CASE REC_QTY WHEN 0 THEN 0 ELSE IT_AMOUNT / REC_QTY END.
 *
 * Reads the same mill receipts the Process Receipt reports already use; nothing is recomputed.
 */
const { orderRows, inList, inDateRange, groupBy, round } = require('../jcEngine');
const { loadMillReceiptRows } = require('../sources/millReceipt');

/**
 * JSM's own levels per Category Wise option, and the same with its Month Wise box ticked.
 * `null` is JSM's '' — no level.
 */
const CATEGORIES = {
  1: { plain: [null, 'BOOK'], month: ['BOOK', 'MONTH'], caption: 'BOOK', title: '' },
  2: { plain: [null, 'ITEM'], month: ['ITEM', 'MONTH'], caption: 'ITEM', title: 'Item Wise ' },
  3: { plain: ['PARTY', 'ITEM'], caption: 'ITEM', title: 'Party+Item Wise ' },
  4: { plain: ['PU_PARTY', 'ITEM'], caption: 'ITEM', title: 'PuParty+Item Wise ' },
  5: { plain: ['COMPANY', 'PARTY'], caption: 'PARTY', title: 'Party Wise ' },
};

/** Levels JSM groups on that this software does not record against a mill receipt. */
const UNRECORDED = { PU_PARTY: 'the purchase party', COMPANY: 'the company column' };

const SUM = ['IT_PCS', 'SND_QTY', 'REC_QTY', 'IT_AMOUNT'];
const LISTS = { parties: 'PARTY', books: 'BOOK', items: 'ITEM' };

function categoryOf(raw) {
  const n = Number(String(raw ?? '1').trim().split('-')[0]) || 1;
  return CATEGORIES[n] ? n : 1;
}

async function run(companyId, p = {}, deps = {}) {
  const category = categoryOf(p.category);
  const cat = CATEGORIES[category];
  const monthWise = p.monthWise === true || String(p.monthWise) === 'true';
  const levels = (monthWise && cat.month) ? cat.month : cat.plain;

  for (const lvl of levels) {
    if (lvl && UNRECORDED[lvl]) {
      const err = new Error(`This software does not record ${UNRECORDED[lvl]}, so it cannot group by it`);
      err.status = 400;
      throw err;
    }
  }

  let rows = inDateRange(deps.rows || await loadMillReceiptRows(companyId), 'BILL_DATE', p.from, p.to);
  for (const [param, field] of Object.entries(LISTS)) rows = inList(rows, field, p[param]);

  const flat = rows.map((r) => ({
    GROUP1: levels[0] ? (r[levels[0]] || '') : '',
    GROUP2: levels[1] ? (r[levels[1]] || '') : '',
    GROUP3: '',
    IT_PCS: Number(r.REC_PCS || 0),
    SND_QTY: Number(r.SND_QTY || 0),
    REC_QTY: Number(r.REC_QTY || 0),
    IT_AMOUNT: Number(r.IT_AMOUNT || 0),
  }));

  const keys = ['GROUP1', 'GROUP2'].filter((_, i) => levels[i]);
  const grouped = groupBy(flat, keys, { sum: SUM });
  for (const g of grouped) {
    for (const f of SUM) g[f] = round(g[f]);
    g.AVG_RATE = g.REC_QTY ? round(g.IT_AMOUNT / g.REC_QTY) : 0;
  }

  return {
    rows: orderRows(grouped, keys),
    grid: {
      layout: 'JSM_VW_PROCESS_SMRY_SHORT_ITEMWISE',
      variant: category,
      groupColumns: levels[0] ? ['GROUP1'] : [],
      groupDisplays: levels[0] ? [levels[0] === 'ITEM' ? 'ITEM' : levels[0]] : [],
      captions: { GROUP2: cat.caption },
      title: `${cat.title}Process Report [ItemWise Summary]`,
      period: `DATE : FROM ${p.fromText || p.from || ''}  TO  ${p.toText || p.to || ''}`,
      pageWise: p.printout === '2-PageWise',
    },
  };
}

async function options(companyId, p = {}, deps = {}) {
  const rows = deps.rows || await loadMillReceiptRows(companyId);
  const u = (f) => [...new Set(rows.map((r) => r[f]).filter((v) => String(v ?? '').trim()))]
    .sort((a, b) => String(a).localeCompare(String(b)));
  return { parties: u('PARTY'), books: u('BOOK'), items: u('ITEM') };
}

module.exports = { run, options, CATEGORIES };
