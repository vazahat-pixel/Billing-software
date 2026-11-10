'use strict';

/**
 * JSM: Reports › Monthly Reports › Sales G/F (Rpt_Stk_Grey_Finish_Summary,
 * "Summary - Stock Reports").
 *
 * Sales for each day, grey on one side and finish on the other. JSM's own view
 * (Stock_Book_String) is two halves unioned on the bill's SGC flag:
 *
 *   select BILL_DATE, SUM(TO_PCS) AS GREY_PCS, SUM(TO_QTY) AS GREY_QTY, SUM(NET_TOT) AS GREY_AMOUNT,
 *          0,0,0  from t_sales where sgc='R'  ... GROUP BY BILL_DATE
 *   union all
 *   select BILL_DATE, 0,0,0, SUM(TO_PCS) AS FINISH_PCS, SUM(TO_QTY), SUM(NET_TOT)
 *          from t_sales where sgc<>'R' ... GROUP BY BILL_DATE
 *
 * This software has no bill-level grey/finish flag, so a bill counts as grey when its items are
 * the grey ones — the item master's own category, which is what that flag records.
 */
const { orderRows, inDateRange, round } = require('../jcEngine');
const { loadSalesRegisterRows } = require('../sources/billRegister');

/** JSM's SGC='R': the grey side. */
const isGrey = (bill) => {
  const lines = bill._lines || [];
  if (lines.length) return lines.every((l) => String(l.ITEM_CATEGORY || '').toLowerCase() === 'grey');
  return /grey/i.test(String(bill.REGISTER || ''));
};

const dayKey = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');

async function run(companyId, p = {}, deps = {}) {
  const bills = inDateRange(deps.rows || await loadSalesRegisterRows(companyId), 'BILL_DATE', p.from, p.to);

  const byDay = new Map();
  for (const b of bills) {
    const key = dayKey(b.BILL_DATE);
    if (!byDay.has(key)) {
      byDay.set(key, {
        BILL_DATE: b.BILL_DATE,
        GREY_PCS: 0, GREY_QTY: 0, GREY_AMOUNT: 0,
        FINISH_PCS: 0, FINISH_QTY: 0, FINISH_AMOINT: 0,
      });
    }
    const row = byDay.get(key);
    const side = isGrey(b) ? 'GREY' : 'FINISH';
    row[`${side}_PCS`] += Number(b.TO_PCS || 0);
    row[`${side}_QTY`] += Number(b.TO_QTY || 0);
    // JSM's own column really is spelled FINISH_AMOINT.
    row[side === 'GREY' ? 'GREY_AMOUNT' : 'FINISH_AMOINT'] += Number(b.NET_TOT || 0);
  }

  const rows = [...byDay.values()].map((r) => ({
    ...r,
    GREY_PCS: round(r.GREY_PCS), GREY_QTY: round(r.GREY_QTY), GREY_AMOUNT: round(r.GREY_AMOUNT),
    FINISH_PCS: round(r.FINISH_PCS), FINISH_QTY: round(r.FINISH_QTY), FINISH_AMOINT: round(r.FINISH_AMOINT),
  }));

  return {
    rows: orderRows(rows, ['BILL_DATE']),
    grid: {
      layout: 'JSM_VW_ROW_FINISH_STOCK',
      variant: 1,
      groupColumns: [],
      groupDisplays: [],
      captions: {},
      title: 'Sales Summary Report',
      period: `DATE : FROM ${p.fromText || p.from || ''}  TO  ${p.toText || p.to || ''}`,
      pageWise: false,
    },
  };
}

async function options() { return {}; }

module.exports = { run, options };
