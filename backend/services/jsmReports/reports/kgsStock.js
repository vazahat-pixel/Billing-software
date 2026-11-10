'use strict';

/**
 * JSM: Others Reports › Others Reports › Finish At Shp Kgs / Grey At Shop Kgs / Grey At Mill Kgs
 * (Rpt_StkKgsFinishAtShop, Rpt_StkKgsGreyAtshop, Rpt_StkKgsGreyAtMill).
 *
 * Stock in kilos per item. JSM's own closing figure (btn_screen_Click) is
 *
 *   Finish at shop : OpBalKgs + PuKgs − SlKgs − PurKgs + SlrKgs
 *   Grey at shop   : OpBalKgs + PuKgs − MIssKgs − SlKgs − PurKgs + SlrKgs
 *   Grey at mill   : what was issued to the mill and has not come back
 *
 * This software records no opening figure in kilos — only in pieces and quantity — so the
 * opening column is zero and the closing figure is the period's own movement. Every other term
 * is the line's own net kilos.
 */
const { orderRows, inList, inDateRange, round } = require('../jcEngine');
const src = require('../sources/billRegister');

/** Sum one book's lines per item, in kilos. */
async function kgsByItem(load, companyId, p, filterItem) {
  const bills = inDateRange(await load(companyId), 'BILL_DATE', p.from, p.to);
  const out = new Map();
  for (const b of bills) {
    for (const l of b._lines || []) {
      if (filterItem && !filterItem(l)) continue;
      const key = l.ITEM_NAME || '';
      out.set(key, round((out.get(key) || 0) + Number(l.IT_KGS || 0)));
    }
  }
  return out;
}

const greyOnly = (l) => String(l.ITEM_CATEGORY || '').toLowerCase() === 'grey';
const finishOnly = (l) => String(l.ITEM_CATEGORY || '').toLowerCase() !== 'grey';

function kgsStockReport(spec) {
  async function run(companyId, p = {}, deps = {}) {
    if (deps.rows) return shape(deps.rows, spec, p);

    const pick = spec.side === 'grey' ? greyOnly : (spec.side === 'finish' ? finishOnly : null);
    const [pu, sl, slr, pur] = await Promise.all([
      kgsByItem(src.loadPurchaseRegisterRows, companyId, p, pick),
      kgsByItem(src.loadSalesRegisterRows, companyId, p, pick),
      kgsByItem((c) => src.loadReturnRegisterRows(c, 'Sales'), companyId, p, pick),
      kgsByItem((c) => src.loadReturnRegisterRows(c, 'Purchase'), companyId, p, pick),
    ]);

    let issued = new Map();
    let received = new Map();
    if (spec.mill) {
      const { loadMillIssueRows } = require('../sources/millIssue');
      const { loadMillReceiptRows } = require('../sources/millReceipt');
      // A mill issue is dated by its challan, a receipt by the bill it came back on.
      const add = (rows, dateField, field, key) => {
        const m = new Map();
        for (const r of inDateRange(rows, dateField, p.from, p.to)) {
          const k = r[key] || '';
          m.set(k, round((m.get(k) || 0) + Number(r[field] || 0)));
        }
        return m;
      };
      const [iss, rec] = await Promise.all([loadMillIssueRows(companyId), loadMillReceiptRows(companyId)]);
      issued = add(iss, 'CHLN_DATE', 'ISS_KGS', 'ITEM');
      received = add(rec, 'BILL_DATE', 'REC_KGS', 'ITEM');
    }

    const items = new Set([...pu.keys(), ...sl.keys(), ...slr.keys(), ...pur.keys(), ...issued.keys(), ...received.keys()]);
    const rows = [...items].map((item) => {
      const PU_KGS = pu.get(item) || 0;
      const SL_KGS = sl.get(item) || 0;
      const SLR_KGS = slr.get(item) || 0;
      const PUR_KGS = pur.get(item) || 0;
      const ISS_KGS = issued.get(item) || 0;
      const REC_KGS = received.get(item) || 0;
      const CL_KGS = spec.atMill
        ? round(ISS_KGS - REC_KGS)
        : round(PU_KGS - SL_KGS - PUR_KGS + SLR_KGS - (spec.side === 'grey' ? ISS_KGS - REC_KGS : 0));
      return { ITEM_NAME: item, OP_KGS: 0, PU_KGS, SL_KGS, SLR_KGS, PUR_KGS, ISS_KGS, REC_KGS, CL_KGS };
    });

    return shape(rows, spec, p);
  }

  function shape(rows, s, p) {
    const filtered = inList(rows, 'ITEM_NAME', p.items);
    return {
      rows: orderRows(filtered, ['ITEM_NAME']),
      grid: {
        layout: s.view,
        variant: 1,
        groupColumns: [],
        groupDisplays: [],
        captions: {},
        title: s.noun,
        period: `DATE : FROM ${p.fromText || p.from || ''}  TO  ${p.toText || p.to || ''}`,
        pageWise: false,
      },
    };
  }

  async function options(companyId) {
    const bills = await src.loadSalesRegisterRows(companyId);
    const items = [...new Set(bills.flatMap((b) => (b._lines || []).map((l) => l.ITEM_NAME)).filter(Boolean))];
    return { items: items.sort((a, b) => a.localeCompare(b)) };
  }

  return { run, options };
}

module.exports = {
  finishAtShop: kgsStockReport({ side: 'finish', view: 'JSM_VW_KGS_STOCK', noun: 'Finish At Shop Stock (Kgs)' }),
  greyAtShop: kgsStockReport({ side: 'grey', mill: true, view: 'JSM_VW_KGS_STOCK', noun: 'Grey At Shop Stock (Kgs)' }),
  greyAtMill: kgsStockReport({ side: 'grey', mill: true, atMill: true, view: 'JSM_VW_KGS_STOCK', noun: 'Grey At Mill Stock (Kgs)' }),
};
