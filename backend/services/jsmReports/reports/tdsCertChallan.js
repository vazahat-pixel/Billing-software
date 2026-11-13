'use strict';

/**
 * JSM: Reports › Tds Reports › Certificate (Rpt_Tds5_Certi) and Tax Challan (Rpt_Tds4_Challan).
 *
 * Both are printed from Crystal templates in JSM; here the same figures as a grid.
 *
 * Certificate: per ticked account or TDS head, the amount paid and TDS deducted per party and month, with the
 * quarter, and the CIT address and acknowledgement numbers saved on the Address/Acknowledge screen.
 *
 * Challan: the TDS of one head for the dates, split Company / Non Company by the party's PAN (4th letter
 * C), with the Penalty, Interest, bank and cheque typed on the form. JSM's Clear button marks entries as
 * challaned; no such flag is kept here, so nothing is marked.
 */
const { orderRows, inList, inDateRange, groupBy, round } = require('../jcEngine');
const { loadTdsBook } = require('./tdsTcsBooks');

const period = (p) => `DATE : FROM ${p.fromText || p.from || ''}  TO  ${p.toText || p.to || ''}`;
const quarterOf = (m) => (m >= 4 && m <= 6 ? 'Q1' : m >= 7 && m <= 9 ? 'Q2' : m >= 10 && m <= 12 ? 'Q3' : 'Q4');

async function settings(companyId, deps) {
  const CompanySettings = deps.CompanySettings || require('../../../models/CompanySettings');
  const c = (await CompanySettings.findOne({ companyId }).lean()) || {};
  return { pan: c.pan || '', tan: c.tan || '', cit: c.tdsCitAddress || '', q: [c.tdsAckQ1, c.tdsAckQ2, c.tdsAckQ3, c.tdsAckQ4].map((v) => v || '') };
}

const certificate = {
  async run(companyId, p = {}, deps = {}) {
    let rows = deps.rows || await loadTdsBook(companyId);
    rows = inDateRange(rows, 'ENT_DATE', p.from, p.to);
    rows = inList(rows, p.byHead ? 'TDSHEAD' : 'PARTY', p.accounts);
    const grouped = groupBy(rows, ['PARTY', 'TDSHEAD', 'YEAR_NO', 'MONTH_NO'], { sum: ['AMOUNT', 'TDS_AMT'], max: ['PANNO', 'MONTH'] })
      .map((r) => ({ ...r, AMOUNT: round(r.AMOUNT), TDS_AMT: round(r.TDS_AMT), QUARTER: quarterOf(r.MONTH_NO) }));
    const n = await settings(companyId, deps);
    return {
      rows: orderRows(grouped, ['PARTY', 'TDSHEAD', { field: 'YEAR_NO', numeric: true }, { field: 'MONTH_NO', numeric: true }]),
      grid: {
        layout: 'RPT_TDS_CERTIFICATE',
        variant: 1,
        groupColumns: ['PARTY'],
        groupDisplays: ['PARTY'],
        captions: {},
        title: 'TDS Certificate',
        period: period(p),
        notice: `PAN: ${n.pan}  TAN: ${n.tan}  CIT: ${n.cit}  Ack Q1: ${n.q[0]}  Q2: ${n.q[1]}  Q3: ${n.q[2]}  Q4: ${n.q[3]}`,
        pageWise: false,
      },
    };
  },
  async options(companyId, deps = {}) {
    const rows = deps.rows || await loadTdsBook(companyId);
    const u = (f) => [...new Set(rows.map((r) => r[f]).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b)));
    return { parties: u('PARTY'), heads: u('TDSHEAD') };
  },
};

const challan = {
  async run(companyId, p = {}, deps = {}) {
    let rows = deps.rows || await loadTdsBook(companyId);
    rows = inDateRange(rows, 'ENT_DATE', p.from, p.to);
    if (p.head) rows = inList(rows, 'TDSHEAD', [p.head]);
    const want = p.company === false ? 'NON-COMP' : 'COMP';
    rows = rows.filter((r) => r.COMP_NON === want);
    const tds = round(rows.reduce((t, r) => t + (Number(r.TDS_AMT) || 0), 0));
    const penalty = round(p.penalty);
    const interest = round(p.interest);
    return {
      rows: orderRows(rows.map((r) => ({ ENT_DATE: r.ENT_DATE, NCBILL_NO: r.NCBILL_NO, PARTY: r.PARTY, PANNO: r.PANNO, AMOUNT: r.AMOUNT, TDS_AMT: r.TDS_AMT })), ['ENT_DATE']),
      grid: {
        layout: 'RPT_TDS_CHALLAN',
        variant: 1,
        groupColumns: [],
        groupDisplays: [],
        captions: {},
        title: `TDS Challan - ${p.head || 'All heads'} (${want === 'COMP' ? 'Company' : 'Non Company'})`,
        period: period(p),
        notice: `TDS: ${tds.toFixed(2)}  Penalty: ${penalty.toFixed(2)}  Interest: ${interest.toFixed(2)}  Total: ${round(tds + penalty + interest).toFixed(2)}  Paid by: ${p.byCheque ? 'Cheque' : 'Cash'}  Bank: ${p.bank || ''}  Chq No: ${p.chqNo || ''}  Date: ${p.chqDate || ''}`,
        pageWise: false,
      },
    };
  },
  async options(companyId, deps = {}) {
    const rows = deps.rows || await loadTdsBook(companyId);
    return { heads: [...new Set(rows.map((r) => r.TDSHEAD).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b))) };
  },
};

module.exports = { certificate, challan };
