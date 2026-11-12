'use strict';

/**
 * JSM: Reports › Sales › Sales Bill › Rg Pending (Rpt_Sales_Rg_Pend, "RG Pending Report").
 *
 * Bills where goods were promised back and have not come back. JSM builds TMP_VW_RG_PEND over
 * T_CASH_RPD — the receipt's own bill-wise lines — joined to the bill and to the returns booked
 * against it (Rg_String):
 *
 *   SELECT C.AC_NAME, S.ST_NAME, D.AC_NAME AS BROKER, A.INVOICE, A.BILL_DATE, A.BILL_AMT,
 *          A.AMT_6 AS RG_AMT, F.BILL_DATE AS REC_DATE, A.RG_PEND,
 *          DATEDIFF(DAY, A.BILL_DATE, '<as on>') AS DAY, ISNULL(F.RG_TOT,0.00) AS REC_RG_TOT
 *   FROM T_CASH_RPD A … LEFT JOIN (SELECT MAX(BILL_DATE), AC_CODE, XX_ENT FROM T_SL_RETU
 *        WHERE BILL_DATE<='<as on>' GROUP BY …) F …
 *   WHERE A.RG_PEND='P'
 *
 * and keeps the rows where `{rg_amt} <> {REC_RG_TOT}` (Genrate_Reports), printing them Normal,
 * Party Wise, Broker Wise or City Wise — its four Crystal layouts.
 *
 * AMT_6 is the RG line of a receipt, which this software records as `againstInvoices.rg`, and
 * REC_RG_TOT is what the returns against the bill add up to — the outstanding engine's own
 * goodsRtn. Both come from sources/outstanding.js, so this screen agrees with the outstanding
 * screens bill for bill.
 */
const { orderRows, inList, inDateRange, round } = require('../jcEngine');
const { loadOutstandingRows } = require('../sources/outstanding');

const LISTS = { parties: 'PARTY', stations: 'STATION' };

/** JSM's four prints. */
const CATEGORIES = {
  1: { key: null, caption: '', title: 'Return Goods Pending Report' },
  2: { key: 'PARTY', caption: 'PARTY', title: 'Party Wise Return Goods Pending Report' },
  3: { key: 'BROKER', caption: 'BROKER', order2: 'PARTY', title: 'Broker Wise Return Goods Pending Report' },
  4: { key: 'STATION', caption: 'CITY', order2: 'PARTY', title: 'City Wise Return Goods Pending Report' },
};

async function run(companyId, p = {}, deps = {}) {
  const n = Number(String(p.category ?? '1').trim().split('-')[0]) || 1;
  const cat = CATEGORIES[n] || CATEGORIES[1];

  let rows = deps.rows || await loadOutstandingRows(companyId, 'sales', {
    asOn: p.asOn,
    status: 'All',
    onlyRgPending: true,
  });
  rows = inDateRange(rows, 'BILL_DATE', p.from, p.to);
  for (const [param, field] of Object.entries(LISTS)) rows = inList(rows, field, p[param]);

  // JSM keeps only the bills whose promised RG and returned RG differ.
  const pending = rows.filter((r) => Math.abs(round(r.RG_AMT) - round(r.GOODS_RTN)) >= 0.005);

  const out = pending.map((r) => ({
    PARTY: r.PARTY || '',
    ST_NAME: r.STATION || '',
    BROKER: r.BROKER || '',
    STATION: r.STATION || '',
    INVOICE: r.NCBILL_NO || '',
    BILL_DATE: r.BILL_DATE,
    BILL_AMT: round(r.NET_TOT),
    RG_AMT: round(r.RG_AMT),
    REC_RG_TOT: round(r.GOODS_RTN),
    RG_PEND: round(round(r.RG_AMT) - round(r.GOODS_RTN)),
    REC_DATE: r.PAID_DATE || null,
    DAY: Number(r.OS_DAYS || 0),
    XGROUP: cat.key ? (r[cat.key] || '') : '',
  }));

  return {
    rows: orderRows(out, [
      cat.key ? 'XGROUP' : null,
      cat.order2,
      'BILL_DATE',
      { field: 'INVOICE', dir: 'asc', numeric: true },
    ].filter(Boolean)),
    grid: {
      layout: 'JSM_VW_RG_PEND',
      variant: 1,
      groupColumns: cat.key ? ['XGROUP'] : [],
      groupDisplays: cat.key ? [cat.caption] : [],
      captions: {},
      title: cat.title,
      period: `PERIOD : From ${p.fromText || p.from || ''} To ${p.toText || p.to || ''}   Rec Date as on : ${p.asOnText || p.asOn || ''}`,
      pageWise: false,
    },
  };
}

async function options(companyId) {
  const rows = await loadOutstandingRows(companyId, 'sales', {});
  const u = (f) => [...new Set(rows.map((r) => r[f]).filter((v) => String(v ?? '').trim()))]
    .sort((a, b) => String(a).localeCompare(String(b)));
  return { parties: u('PARTY'), stations: u('STATION') };
}

module.exports = { run, options };
