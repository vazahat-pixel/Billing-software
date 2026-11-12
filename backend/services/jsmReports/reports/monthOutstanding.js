'use strict';

/**
 * JSM: Others Reports › Outstanding › Month O/s. › Sales / Purchase
 * (A_Textiles_Outstanding_MonthWise, titled "Month Wise Outstanding").
 *
 * The outstanding bills of the picked period, gathered under the month they fall in. JSM reads
 * JSM_VW_OS_SALES_SUMMARY / JSM_VW_OS_PURCHASE_SUMMARY (OpenReportFormat), filters on
 * `A.ENT_DATE >= … AND A.ENT_DATE <= …` and the ticked parties (Fill_String_For_Condition), and
 * heads the window "Month Wise Sales O/s. Report" / "Month Wise Purchase O/s. Report"
 * (Fill_String_For_Period).
 *
 * ENT_DATE is the date the bill was entered on; here a bill carries one date, the bill's own, so
 * the month is taken from that. Every figure comes from sources/outstanding.js — the engine the
 * Normal screens use — so this screen cannot disagree with them.
 */
const { orderRows, inList, round, MONTHS } = require('../jcEngine');
const { loadOutstandingRows } = require('../sources/outstanding');

function monthReport(spec) {
  async function run(companyId, p = {}, deps = {}) {
    let rows = deps.rows || await loadOutstandingRows(companyId, spec.kind, {
      asOn: p.to,
      billDateFrom: p.from,
      billDateTo: p.to,
      status: 'Pending',
    });
    rows = inList(rows, 'PARTY', p.parties);

    const dated = rows.map((r) => {
      const d = r.BILL_DATE ? new Date(r.BILL_DATE) : null;
      return {
        ...r,
        MONTH: d ? MONTHS[d.getUTCMonth()] : '',
        YEAR_NO: d ? d.getUTCFullYear() : 0,
        MONTH_NO: d ? d.getUTCMonth() + 1 : 0,
        TOT_BALANCE: round(r.TOT_BALANCE),
      };
    });

    return {
      // A month's bills stay in bill order inside it, and the months run in calendar order —
      // which is why the year is sorted on before the month name, not instead of it.
      rows: orderRows(dated, [
        { field: 'YEAR_NO', dir: 'asc', numeric: true },
        { field: 'MONTH_NO', dir: 'asc', numeric: true },
        'PARTY',
        'BILL_DATE',
        { field: 'NCBILL_NO', dir: 'asc', numeric: true },
      ]),
      grid: {
        layout: spec.view,
        variant: 1,
        groupColumns: ['MONTH'],
        groupDisplays: ['MONTH'],
        captions: {},
        title: `Month Wise ${spec.noun} O/s. Report`,
        period: `DATE : FROM ${p.fromText || p.from || ''}  TO  ${p.toText || p.to || ''}`,
        pageWise: p.printout === '2-PageWise',
      },
    };
  }

  async function options(companyId) {
    const rows = await loadOutstandingRows(companyId, spec.kind, {});
    return {
      parties: [...new Set(rows.map((r) => r.PARTY).filter((v) => String(v ?? '').trim()))]
        .sort((a, b) => String(a).localeCompare(String(b))),
    };
  }

  return { run, options };
}

module.exports = {
  sales: monthReport({ kind: 'sales', noun: 'Sales', view: 'JSM_VW_OS_SALES_SUMMARY' }),
  purchase: monthReport({ kind: 'purchase', noun: 'Purchase', view: 'JSM_VW_OS_PURCHASE_SUMMARY' }),
};
