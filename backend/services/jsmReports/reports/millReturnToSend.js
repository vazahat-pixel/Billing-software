'use strict';

/**
 * JSM: Reports › Purchase › Mill Return To Send
 * (Rpt_1StockSubItemAcc_DetailReport, titled "Stock (Detail) Report").
 *
 * One timeline of what came back from the mill and what went out to it, with the balance running
 * down the page. JSM's own SELECT (btn_screen_Click) unions the two sides:
 *
 *   SELECT A.SRAL_NO, A.BILL_DATE AS ENT_DATE, A.NCBILL_NO, A.TO_REC_QTY AS RTN_FROM_MILL,
 *          C.AC_NAME AS PARTY, '' AS NCCHLN_NO, 0.00 AS ISS_QTY, REMARK_1
 *   FROM I_MILL_GP A … WHERE A.SGC='2'
 *   UNION ALL
 *   SELECT 0, A.CHLN_DATE, '', 0.00, C.AC_NAME, A.NCCHLN_NO, A.ISS_QTY, …
 *   FROM I_MILL_CH A … WHERE A.PU_BILLNO='' AND A.RE_FINISH<>'R'
 *   ORDER BY ENT_DATE
 *
 * and its export prints SralNo, Date, BillNo, Rtn_From_Mill, Party, ChlnNo, IssQty, BalQty,
 * Remark — BalQty being the running difference, which the export works out rather than the view.
 *
 * Both halves come from the mill sources the Process screens already use: the receipts' own
 * received quantity, and the issues whose goods came in on no purchase bill (the lot names the
 * purchase here, so a lot without one is JSM's blank PU_BILLNO).
 */
const { orderRows, inList, inDateRange, round } = require('../jcEngine');
const { loadMillIssueRows } = require('../sources/millIssue');
const { loadMillReceiptRows } = require('../sources/millReceipt');

async function run(companyId, p = {}, deps = {}) {
  const [issues, receipts] = await Promise.all([
    deps.issues || loadMillIssueRows(companyId),
    deps.receipts || loadMillReceiptRows(companyId),
  ]);

  const returned = inDateRange(receipts, 'BILL_DATE', p.from, p.to).map((r) => ({
    SRAL_NO: r.NCBILL_NO || '',
    ENT_DATE: r.BILL_DATE,
    NCBILL_NO: r.NCBILL_NO || '',
    RTN_FROM_MILL: round(r.REC_QTY),
    PARTY: r.PARTY || '',
    NCCHLN_NO: '',
    ISS_QTY: 0,
    REMARK1: r.IT_DESC1 || '',
  }));

  const sent = inDateRange(issues.filter((r) => !String(r.PU_BILLNO || '').trim()
    && String(r.RE_FINISH || '') !== 'R'), 'CHLN_DATE', p.from, p.to).map((r) => ({
    SRAL_NO: '',
    ENT_DATE: r.CHLN_DATE,
    NCBILL_NO: '',
    RTN_FROM_MILL: 0,
    PARTY: r.PARTY || '',
    NCCHLN_NO: r.NCCHLN_NO || '',
    ISS_QTY: round(r.ISS_QTY),
    REMARK1: r.REMARK_1 || '',
  }));

  let rows = orderRows([...returned, ...sent], ['ENT_DATE']);
  rows = inList(rows, 'PARTY', p.parties);

  // The balance JSM's export carries down the page: what has come back, less what has gone out.
  let balance = 0;
  rows = rows.map((r) => {
    balance = round(balance + Number(r.RTN_FROM_MILL || 0) - Number(r.ISS_QTY || 0));
    return { ...r, BAL_QTY: balance };
  });

  return {
    rows,
    grid: {
      layout: 'JSM_VW_MILL_RTN_TO_SEND',
      variant: 1,
      groupColumns: [],
      groupDisplays: [],
      captions: {},
      title: 'Stock (Detail) Report',
      period: `DATE : FROM ${p.fromText || p.from || ''}  TO  ${p.toText || p.to || ''}`,
      pageWise: false,
    },
  };
}

async function options(companyId) {
  const [issues, receipts] = await Promise.all([
    loadMillIssueRows(companyId),
    loadMillReceiptRows(companyId),
  ]);
  return {
    parties: [...new Set([...issues, ...receipts].map((r) => r.PARTY).filter((v) => String(v ?? '').trim()))]
      .sort((a, b) => String(a).localeCompare(String(b))),
  };
}

module.exports = { run, options };
