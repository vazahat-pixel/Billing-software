'use strict';

/**
 * JSM: Others Reports › Outstanding › Debitors › 90 Days (Rpt_Os_90Days_Eklvya, titled "Eklv O/s.").
 *
 * One line per account: what it owes and how long since it last bought anything. JSM builds the
 * window from its own view (View_String):
 *
 *   SELECT A.AC_NAME, A.OP_BAL,
 *          CASE A.OP_DRCR WHEN 'DR' THEN A.OP_BAL ELSE -A.OP_BAL END AS OP_BAL_NEW,
 *          X.TOT_SALES, Y.TOT_REC,
 *          OP_BAL_NEW + TOT_SALES - TOT_REC AS TOT_OS,
 *          DATEDIFF(day, Z.BLDT, '<as on>') AS NO_OF_DAYS, Z.BLDT
 *   FROM MST_AC_MAST A
 *     LEFT JOIN (SELECT AC_CODE, SUM(NET_TOT) FROM T_SALES  GROUP BY AC_CODE) X
 *     LEFT JOIN (SELECT AC_CODE, SUM(REC_AMT) FROM T_CASH_MN GROUP BY AC_CODE) Y
 *     LEFT JOIN (SELECT AC_CODE, MAX(BILL_DATE) FROM T_SALES GROUP BY AC_CODE) Z
 *   WHERE A.GRAC_CODE=42
 *
 * — the debtors group, every bill up to the as-on date (`A.bill_Date<='<date>'`).
 *
 * The figures here come from sources/outstanding.js instead of being summed again, so the screen
 * agrees with every other outstanding screen: TOT_SALES is the bills' own total, TOT_REC what has
 * been received against them, TOT_OS what is left.
 *
 * JSM's OP_BAL column is not printed. An account's opening balance reaches this software as
 * opening bills, which are already inside the bill total — printing them again in their own
 * column would count them twice.
 */
const { orderRows, inList, groupBy, round } = require('../jcEngine');
const { loadOutstandingRows } = require('../sources/outstanding');

/** Whole days between a bill's date and the as-on date, as SQL's DATEDIFF(day, …) counts them. */
function daysBetween(from, to) {
  if (!from) return 0;
  const a = new Date(from);
  const b = to ? new Date(to) : new Date();
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 0;
  return Math.floor((Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate())
    - Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate())) / 86400000);
}

async function run(companyId, p = {}, deps = {}) {
  let rows = deps.rows || await loadOutstandingRows(companyId, 'sales', {
    asOn: p.asOn,
    billDateTo: p.asOn,
    status: 'All',
  });
  rows = inList(rows, 'PARTY', p.parties);

  const grouped = groupBy(rows, ['PARTY'], {
    sum: ['NET_TOT', 'ADJUST', 'TOT_BALANCE'],
    max: ['BILL_DATE'],
  });

  const out = grouped.map((g) => ({
    AC_NAME: g.PARTY,
    TOT_SALES: round(g.NET_TOT),
    TOT_REC: round(g.ADJUST),
    TOT_OS: round(g.TOT_BALANCE),
    BLDT: g.BILL_DATE || null,
    NO_OF_DAYS: daysBetween(g.BILL_DATE, p.asOn),
  }));

  return {
    rows: orderRows(out, ['AC_NAME']),
    grid: {
      layout: 'JSM_VW_OS_90DAYS',
      variant: 1,
      groupColumns: [],
      groupDisplays: [],
      captions: {},
      title: 'Os Report',
      period: `Rec Date as on : ${p.asOnText || p.asOn || ''}`,
      pageWise: false,
    },
  };
}

async function options(companyId) {
  const rows = await loadOutstandingRows(companyId, 'sales', {});
  return {
    parties: [...new Set(rows.map((r) => r.PARTY).filter((v) => String(v ?? '').trim()))]
      .sort((a, b) => String(a).localeCompare(String(b))),
  };
}

module.exports = { run, options };
