'use strict';

/**
 * JSM: Reports › JobWork Reports › Job P & L (Tran_WorkChallan_PL_Repo).
 *
 * What the job work produced, what was sold out of it, and the difference. The screen is one grid
 * with a Refresh button; its own SELECT (Btn_Refresh_Click) is
 *
 *   SELECT ITEM_NAME,
 *          SUM(READY_PCS), SUM(READY_AMT), MAX(READY_RATE),
 *          SUM(SALES_PCS), SUM(SALES_AMT), MAX(SALES_RATE),
 *          (SUM(READY_PCS)-SUM(SALES_PCS)) AS CLOSE_PCS,
 *          (SUM(READY_PCS)-SUM(SALES_PCS))*MAX(READY_RATE) AS CLOSE_AMT,
 *          (SUM(SALES_PCS)*(MAX(SALES_RATE)-MAX(READY_RATE))) AS PL_RS
 *   FROM VW_JOB_CD5_PROFIT_REG GROUP BY ITEM_CODE, ITEM_NAME
 *
 * and its columns are the ones its own export names (Button1_Click): Item Name, ReadyPcs,
 * SalesPcs, Clos.Pcs, ReadyAmt, ReadyRt, SalesAmt, SalesRt, CloseAmt, Pl_Rs.
 *
 * Ready is what came back from job work — sources/millReceipt.js, the Job Receipt side — so a
 * piece's ready value is what it cost to get it ready: the work charges recorded against the
 * receipt. Sales is the sales register's own pieces and amount for the same item. Both rates are
 * per piece, as JSM's MAX(…_RATE) is, and the arithmetic above is JSM's, unchanged.
 */
const { orderRows, inList, inDateRange, round } = require('../jcEngine');
const { loadMillReceiptRows } = require('../sources/millReceipt');
const { loadSalesRegisterRows } = require('../sources/billRegister');

async function run(companyId, p = {}, deps = {}) {
  const receipts = inDateRange(deps.receipts || await loadMillReceiptRows(companyId, 'jobRec'),
    'BILL_DATE', p.from, p.to);
  const sales = inDateRange(deps.sales || await loadSalesRegisterRows(companyId),
    'BILL_DATE', p.from, p.to);

  const items = new Map();
  const of = (name) => {
    if (!items.has(name)) {
      items.set(name, {
        ITEM_NAME: name, READY_PCS: 0, READY_AMT: 0, READY_RATE: 0,
        SALES_PCS: 0, SALES_AMT: 0, SALES_RATE: 0,
      });
    }
    return items.get(name);
  };

  for (const r of receipts) {
    const row = of(r.RECITEM || r.ITEM || '');
    row.READY_PCS += Number(r.REC_PCS || 0);
    row.READY_AMT += Number(r.IT_AMOUNT || 0);
    row.READY_RATE = Math.max(row.READY_RATE, Number(r.IT_RATE || 0));
  }

  for (const b of sales) {
    for (const l of b._lines || []) {
      const row = of(l.ITEM_NAME || '');
      row.SALES_PCS += Number(l.IT_PCS || 0);
      row.SALES_AMT += Number(l.IT_AMOUNT || 0);
      row.SALES_RATE = Math.max(row.SALES_RATE, Number(l.IT_RATE || 0));
    }
  }

  const rows = [...items.values()].map((r) => {
    const closePcs = r.READY_PCS - r.SALES_PCS;
    return {
      ITEM_NAME: r.ITEM_NAME,
      READY_PCS: round(r.READY_PCS),
      READY_AMT: round(r.READY_AMT),
      READY_RATE: round(r.READY_RATE),
      SALES_PCS: round(r.SALES_PCS),
      SALES_AMT: round(r.SALES_AMT),
      SALES_RATE: round(r.SALES_RATE),
      CLOSE_PCS: round(closePcs),
      CLOSE_AMT: round(closePcs * r.READY_RATE),
      PL_RS: round(r.SALES_PCS * (r.SALES_RATE - r.READY_RATE)),
    };
  });

  // The screen's second radio asks for the pieces alone — JSM's own SELECT then drops every
  // amount and rate column and keeps READY_PCS, SALES_PCS and CLOSE_PCS.
  const pcsOnly = p.pcsOnly === true || String(p.pcsOnly) === 'true';
  const shown = pcsOnly
    ? rows.map((r) => ({
      ITEM_NAME: r.ITEM_NAME, READY_PCS: r.READY_PCS, SALES_PCS: r.SALES_PCS, CLOSE_PCS: r.CLOSE_PCS,
    }))
    : rows;

  return {
    rows: orderRows(inList(shown, 'ITEM_NAME', p.items), ['ITEM_NAME']),
    grid: {
      layout: pcsOnly ? 'JSM_VW_JOB_PROFIT_REG_PCS' : 'JSM_VW_JOB_PROFIT_REG',
      variant: 1,
      groupColumns: [],
      groupDisplays: [],
      captions: {},
      title: 'Job Profit Register',
      period: `DATE : FROM ${p.fromText || p.from || ''}  TO  ${p.toText || p.to || ''}`,
      pageWise: false,
    },
  };
}

async function options(companyId) {
  const receipts = await loadMillReceiptRows(companyId, 'jobRec');
  return {
    items: [...new Set(receipts.map((r) => r.RECITEM || r.ITEM).filter((v) => String(v ?? '').trim()))]
      .sort((a, b) => String(a).localeCompare(String(b))),
  };
}

module.exports = { run, options };
