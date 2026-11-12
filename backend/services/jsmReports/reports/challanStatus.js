'use strict';

/**
 * JSM: Reports › JobWork Reports › Challan Status
 * (Rpt_Additional_Job_Bill, titled "Additional Job Bill Report").
 *
 * Which job challans have been billed and which are still waiting. JSM reads VW_I_JOB_RECEIPT over
 * a bill-date range and tells the two apart on the work bill's own entry number
 * (Genrate_Reports):
 *
 *   {VW_I_JOB_RECEIPT.BILL_DATE}>=CDATE('…') and {VW_I_JOB_RECEIPT.BILL_DATE}<=CDATE('…')
 *   {VW_I_JOB_RECEIPT.JOB_BILL_ENTNO}=0        -- A-Pending
 *   {VW_I_JOB_RECEIPT.JOB_BILL_ENTNO}<>0       -- B-Clear
 *   {VW_I_JOB_RECEIPT.AC_CODE} IN (…)          -- the ticked parties
 *   {VW_I_JOB_RECEIPT.TR_CODE} IN (…)          -- the ticked challan accounts
 *
 * and prints it Normal or Party Wise (its Rdbtn_B1 / Rdbtn_B2).
 *
 * The receipts come from sources/millReceipt.js, the engine behind the Job Receipt screens, so the
 * figures are the ones those screens show. JSM's second list holds its challan accounts
 * (`book_cd=6 and add_1='CHALLAN'`), which have no counterpart here — a challan belongs to a
 * register instead — so that list offers the registers and filters on them.
 */
const { orderRows, inList, inDateRange, round } = require('../jcEngine');
const { loadMillReceiptRows } = require('../sources/millReceipt');

const LISTS = { parties: 'PARTY', registers: 'BOOK' };

/** JSM's A-Pending / B-Clear / C-All. */
const STATUSES = {
  1: { label: 'Pending', keep: (r) => !String(r.JOB_BILL_NO || '').trim() },
  2: { label: 'Clear', keep: (r) => Boolean(String(r.JOB_BILL_NO || '').trim()) },
  3: { label: 'All', keep: () => true },
};

/** JSM's 1-Normal / 2-Party. */
const CATEGORIES = {
  1: { key: null, caption: '' },
  2: { key: 'PARTY', caption: 'PARTY' },
};

async function run(companyId, p = {}, deps = {}) {
  const s = Number(String(p.status ?? '1').trim().split('-')[0]) || 1;
  const n = Number(String(p.category ?? '1').trim().split('-')[0]) || 1;
  const status = STATUSES[s] || STATUSES[1];
  const cat = CATEGORIES[n] || CATEGORIES[1];

  let rows = deps.rows || await loadMillReceiptRows(companyId, 'jobRec');
  rows = inDateRange(rows, 'BILL_DATE', p.from, p.to).filter(status.keep);
  for (const [param, field] of Object.entries(LISTS)) rows = inList(rows, field, p[param]);

  const out = rows.map((r) => ({
    NCCHLN_NO: r.NCCHLN_NO || '',
    CHLN_DATE: r.CHLN_DATE,
    BILL_DATE: r.BILL_DATE,
    PARTY: r.PARTY || '',
    ITEM: r.RECITEM || r.ITEM || '',
    REC_PCS: Number(r.REC_PCS || 0),
    REC_QTY: round(r.REC_QTY),
    IT_RATE: round(r.IT_RATE),
    IT_AMOUNT: round(r.IT_AMOUNT),
    JOB_BILL_NO: r.JOB_BILL_NO || '',
    JOB_BILL_DATE: r.JOB_BILL_DATE,
    STATUS: String(r.JOB_BILL_NO || '').trim() ? 'Clear' : 'Pending',
    XGROUP: cat.key ? (r[cat.key] || '') : '',
  }));

  return {
    rows: orderRows(out, [
      cat.key ? 'XGROUP' : null,
      'BILL_DATE',
      { field: 'NCCHLN_NO', dir: 'asc', numeric: true },
    ].filter(Boolean)),
    grid: {
      layout: 'JSM_VW_JOB_CHALLAN_STATUS',
      variant: 1,
      groupColumns: cat.key ? ['XGROUP'] : [],
      groupDisplays: cat.key ? [cat.caption] : [],
      captions: {},
      title: `Job Bill Report [${status.label}]`,
      period: `PERIOD : From ${p.fromText || p.from || ''}  To  ${p.toText || p.to || ''}`,
      pageWise: false,
    },
  };
}

async function options(companyId) {
  const rows = await loadMillReceiptRows(companyId, 'jobRec');
  const u = (f) => [...new Set(rows.map((r) => r[f]).filter((v) => String(v ?? '').trim()))]
    .sort((a, b) => String(a).localeCompare(String(b)));
  return { parties: u('PARTY'), registers: u('BOOK') };
}

module.exports = { run, options };
