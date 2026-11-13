'use strict';

/**
 * JSM: Reports › Acc Stock Reports › Stock With Value Report (Rpt_Stk_Acc_Finish_Summary_Value,
 * "Summary - Stock Reports", With Value).
 *
 * The finish stock per item (or category): OP.STOCK, PROCESS (mill receipts), PURCHASE, SALES, SALES RETURN,
 * PURCHASE RETURN and CLOSING, in Qty or Pcs, valued at the item master's PU_RATE: VALUE = CLOSING × PU_RATE
 * ("/100" divides it by 100). JSM prints it from a Crystal template; here the same figures as a grid. The
 * stock-journal cut add/less columns are not recorded here and stay 0.
 */
const { orderRows, groupBy, round } = require('../jcEngine');
const finish = require('./stockFinishNew');

async function rates(companyId, deps) {
  if (deps.rates) return deps.rates;
  const Item = require('../../../models/Item');
  const items = await Item.find({ companyId }).select('name purchaseRate').lean();
  return new Map(items.map((i) => [String(i.name), Number(i.purchaseRate) || 0]));
}

async function run(companyId, p = {}, deps = {}) {
  const U = p.pcs ? 'PCS' : 'QTY';
  const base = await finish.run(companyId, {
    from: p.from, to: p.to, fromText: p.fromText, toText: p.toText, unit: p.pcs ? '2-Pcs' : '1-Qty', category: '1-Item', mode: 'summary',
    items: p.items, categories: p.categories, closingZero: true,
  }, { rows: deps.rows });
  const rateOf = await rates(companyId, deps);
  const divisor = p.div100 ? 100 : 1;
  let rows = base.rows.map((r) => {
    const rate = rateOf.get(String(r.ITEM_NAME)) || 0;
    return {
      ITEM_NAME: r.ITEM_NAME,
      GRIT_NAME: r.GRIT_NAME,
      PU_RATE: round(rate),
      OP_STOCK: r[`OP_${U}`],
      PROCESS: r[`ML_REC_${U}`],
      FNS_PU: r[`FNS_PU_${U}`],
      FNS_SL: r[`FNS_SL_${U}`],
      SL_RTN: r[`FNS_SLR_${U}`],
      FNS_RTN: r[`FNS_PUR_${U}`],
      CL_STOCK: r[`CL_${U}`],
      STOCK_VALUE: round((r[`CL_${U}`] * rate) / divisor),
    };
  }).filter((r) => [r.OP_STOCK, r.PROCESS, r.FNS_PU, r.FNS_SL, r.SL_RTN, r.FNS_RTN].some((v) => v !== 0));

  if (p.byCategory) {
    rows = groupBy(rows, ['GRIT_NAME'], { sum: ['OP_STOCK', 'PROCESS', 'FNS_PU', 'FNS_SL', 'SL_RTN', 'FNS_RTN', 'CL_STOCK', 'STOCK_VALUE'] })
      .map((g) => ({ ...g, ITEM_NAME: g.GRIT_NAME, PU_RATE: 0 }));
  }
  return {
    rows: orderRows(rows, [p.byCategory ? 'GRIT_NAME' : 'ITEM_NAME']),
    grid: {
      layout: 'RPT_STOCK_WITH_VALUE',
      variant: 1,
      groupColumns: [],
      groupDisplays: [],
      captions: {},
      title: 'Stock Summary Report - With Value',
      period: `PERIOD : From ${p.fromText || p.from || ''}  To  ${p.toText || p.to || ''}`,
      pageWise: false,
    },
  };
}

async function options(companyId) {
  return finish.options(companyId).then(async () => {
    const Item = require('../../../models/Item');
    const items = await Item.find({ companyId }).select('name group category').lean();
    const fin = items.filter((i) => String(i.category || i.group || '').toLowerCase() !== 'grey');
    const u = (v) => [...new Set(v.filter((x) => String(x ?? '').trim()))].sort((a, b) => String(a).localeCompare(String(b)));
    return { items: u(fin.map((i) => i.name)), categories: u(fin.map((i) => i.category || i.group)) };
  });
}

module.exports = { run, options };
