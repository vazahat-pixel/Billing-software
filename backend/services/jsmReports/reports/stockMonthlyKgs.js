'use strict';

/**
 * JSM: Reports › Inv Stock Ledger › Stock Mts Reports / Stock Mts Reports(Kgs) (Rpt_Stk_Meter_TanusKgs,
 * "Soctk Meter Report (Kgs)").
 *
 * The month-wise stock statement in kilos, from the start of the financial year to the As on Date, for
 * 1-All, 2-Grey Stock, 3-Grey In Mill, 4-Finish Stock or 5-Job Stock. JSM unions TMP_VW_MONTHLY_STOCK_MTR from
 * the item master and the books (IT_KGS of purchase / sales / returns, ISS_KGS of mill and job issues,
 * REC_KGS of receipts) and totals it by month; each section carries the previous month's closing
 * forward. JSM prints it from Crystal templates, so this is the same figures as a grid.
 *   Grey shop   CL = OP + PURCHASE + SALES RTN − PURCHASE RTN − SALES − MILL SEND
 *   Grey mill   CL = OP + MILL SEND − MILL REC
 *   Finish      CL = OP + MILL REC + FINISH PURCHASE + SALES RTN − SALES − PURCHASE RTN
 *   Job         CL = OP + JOB ISS − JOB REC
 * The item master holds no kilo opening, so openings are what earlier months moved.
 */
const { round, MONTHS } = require('../jcEngine');
const src = require('../sources/billRegister');
const { loadMillIssueRows } = require('../sources/millIssue');
const { loadMillReceiptRows } = require('../sources/millReceipt');

const bad = (m) => Object.assign(new Error(m), { status: 400 });
const isGrey = (c) => String(c || '').toLowerCase() === 'grey';
const SECTIONS = {
  grey: { layout: 'RPT_STK_METER_GREY', title: 'Monthwise Grey Stock Kgs Report', cols: ['PURCHASE', 'SL_RTN', 'PU_RTN_GRY', 'GR_SL', 'MILL_SEND'], inc: ['PURCHASE', 'SL_RTN'], dec: ['PU_RTN_GRY', 'GR_SL', 'MILL_SEND'] },
  mill: { layout: 'RPT_STK_METER_MILL', title: 'Monthwise Grey In Mill Stock Kgs Report', cols: ['MILL_SEND', 'MILL_REC'], inc: ['MILL_SEND'], dec: ['MILL_REC'] },
  finish: { layout: 'RPT_STK_METER_FINISH', title: 'Monthwise Finish Stock Mts Report', cols: ['MILL_REC', 'FNS_PURCHASE', 'FNS_SL_RTN', 'FNS_SALES', 'FNS_PU_RTN'], inc: ['MILL_REC', 'FNS_PURCHASE', 'FNS_SL_RTN'], dec: ['FNS_SALES', 'FNS_PU_RTN'] },
  job: { layout: 'RPT_STK_METER_JOB', title: 'Monthwise Job Stock Mts Report', cols: ['WORK_ISS', 'WORK_REC'], inc: ['WORK_ISS'], dec: ['WORK_REC'] },
};
const KEY_OF = { 1: 'all', 2: 'grey', 3: 'mill', 4: 'finish', 5: 'job' };
const ALL = [...new Set(Object.values(SECTIONS).flatMap((s) => s.cols))];

async function movements(companyId) {
  const [pu, sl, slr, pur, iss, rec, jIss, jRec] = await Promise.all([
    src.loadPurchaseRegisterRows(companyId), src.loadSalesRegisterRows(companyId),
    src.loadReturnRegisterRows(companyId, 'Sales'), src.loadReturnRegisterRows(companyId, 'Purchase'),
    loadMillIssueRows(companyId, 'millIssue'), loadMillReceiptRows(companyId, 'millRec'),
    loadMillIssueRows(companyId, 'jobIssue'), loadMillReceiptRows(companyId, 'jobRec'),
  ]);
  const out = [];
  const bills = (list, grey, finish) => {
    for (const b of list) for (const l of b._lines || []) {
      const field = isGrey(l.ITEM_CATEGORY) ? grey : finish;
      if (field) out.push({ date: b.BILL_DATE, [field]: round(Number(l.IT_KGS || 0), 3) });
    }
  };
  bills(pu, 'PURCHASE', 'FNS_PURCHASE');
  bills(sl, 'GR_SL', 'FNS_SALES');
  bills(slr, 'SL_RTN', 'FNS_SL_RTN');
  bills(pur, 'PU_RTN_GRY', 'FNS_PU_RTN');
  for (const j of iss) out.push({ date: j.CHLN_DATE, MILL_SEND: Number(j.ISS_KGS) || 0 });
  for (const j of rec) out.push({ date: j.BILL_DATE, MILL_REC: Number(j.REC_KGS) || 0 });
  for (const j of jIss) out.push({ date: j.CHLN_DATE, WORK_ISS: Number(j.ISS_KGS) || 0 });
  for (const j of jRec) out.push({ date: j.BILL_DATE, WORK_REC: Number(j.REC_KGS) || 0 });
  return out.filter((r) => r.date);
}

const net = (r, s) => s.inc.reduce((t, f) => t + (r[f] || 0), 0) - s.dec.reduce((t, f) => t + (r[f] || 0), 0);
const fyStartOf = (iso) => {
  const d = new Date(`${iso}T00:00:00Z`);
  return `${d.getUTCMonth() >= 3 ? d.getUTCFullYear() : d.getUTCFullYear() - 1}-04-01`;
};

async function run(companyId, p = {}, deps = {}) {
  const key = KEY_OF[Number(String(p.section || '1').split('-')[0])];
  if (!key) throw bad(`Unknown report: ${p.section}`);
  if (!p.to) throw bad('As on Date is required');
  const rows = deps.rows || await movements(companyId);
  const start = fyStartOf(p.to);
  const inDay = (r) => new Date(r.date).toISOString().slice(0, 10);

  // month buckets from the FY start to the As on Date
  const months = [];
  for (let d = new Date(`${start}T00:00:00Z`); d.toISOString().slice(0, 7) <= p.to.slice(0, 7); d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1))) {
    months.push({ key: d.toISOString().slice(0, 7), name: MONTHS[d.getUTCMonth()], no: d.getUTCMonth() + 1 });
  }
  const sectionKeys = key === 'all' ? ['grey', 'mill', 'finish', 'job'] : [key];
  const carry = Object.fromEntries(sectionKeys.map((k) => [k, rows.filter((r) => inDay(r) < start).reduce((t, r) => t + net(r, SECTIONS[k]), 0)]));
  const out = [];
  for (const m of months) {
    const mr = rows.filter((r) => inDay(r).slice(0, 7) === m.key && inDay(r) <= p.to);
    const sum = Object.fromEntries(ALL.map((f) => [f, mr.reduce((t, r) => t + (r[f] || 0), 0)]));
    const row = { MONTH: m.name, MONTH_NO: m.no };
    if (key === 'all') {
      for (const k of sectionKeys) {
        carry[k] += net(sum, SECTIONS[k]);
        row[`${k.toUpperCase()}_CL`] = round(carry[k], 3);
      }
    } else {
      const s = SECTIONS[key];
      row.OP_KGS = round(carry[key], 3);
      for (const f of s.cols) row[f] = round(sum[f], 3);
      carry[key] += net(sum, s);
      row.CL_KGS = round(carry[key], 3);
    }
    out.push(row);
  }
  return {
    rows: out,
    grid: {
      layout: key === 'all' ? 'RPT_STK_METER_ALL' : SECTIONS[key].layout,
      variant: 1,
      groupColumns: [],
      groupDisplays: [],
      captions: {},
      title: key === 'all' ? 'Monthwise Stock Mts Report' : SECTIONS[key].title,
      period: `Stock As on Date : ${p.toText || p.to}`,
      pageWise: false,
    },
  };
}

async function options() {
  return {};
}

module.exports = { run, options, SECTIONS };
