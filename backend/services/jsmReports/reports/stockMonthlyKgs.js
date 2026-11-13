'use strict';

/**
 * JSM: Reports › Inv Stock Ledger › Stock Mts Reports / Stock Mts Reports(Kgs) (Rpt_Stk_Meter_TanusKgs).
 *
 * JSM prints ONE statement "Monthwise Stock Mts Report — Stock As on Date", from the start of the financial
 * year to the As on Date (the printed layout is in D:\JsmReports\Monthwise_Stock_Mts.pdf):
 *
 *   Grey ->       Opening, Purchase, Mill Return, Return, Issue, G.Sales, G.Sales.Rtn, Closing
 *                 CL = OP + Purchase + Mill Return − Return − Issue − G.Sales + G.Sales.Rtn
 *   Mill Grey ->  Opening, Grey Issue, Receipt Mill, Short, Mill Return, Grey Closing
 *                 CL = OP + Grey Issue − Receipt Mill − Short − Mill Return
 *   Mill Rf ->    Refinish Issue, Refinish Receipt Mill, Short, Rf Closing;  Net Closing Stock = Grey + Rf closing
 *   Finish ->     Opening, Refinish Issue, Process, Purchase, Pu.Return, Sales, Sl.Return, Job Issue, Job Receipt,
 *                 Plain Return, Wastage, Sample, Closing
 *                 CL = OP + Process + Purchase + Sl.Return + Job Receipt + Plain Return
 *                      − Pu.Return − Sales − Job Issue − Refinish Issue − Wastage − Sample
 * (checked against JSM's printout: 2482 − 1202 − 2969 = −1689; 1202 − 602 = 600; 602 + 360 − 1880 = −918.)
 * Unit is Mts, or Kgs for the "(Kgs)" menu entry. Receipt Mill is the grey the mills used, Process the finished
 * goods that came back. Refinish, mill grey return, plain return, job and wastage / sample flows that MERN does not
 * record stay 0.
 */
const { round } = require('../jcEngine');
const src = require('../sources/billRegister');
const { loadMillIssueRows } = require('../sources/millIssue');
const { loadProcessStockRows } = require('../sources/processStock');

const bad = (m) => Object.assign(new Error(m), { status: 400 });
const isGrey = (c) => String(c || '').toLowerCase() === 'grey';
const dayKey = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');
const fyStartOf = (iso) => {
  const d = new Date(`${iso}T00:00:00Z`);
  return `${d.getUTCMonth() >= 3 ? d.getUTCFullYear() : d.getUTCFullYear() - 1}-04-01`;
};

async function loadFlows(companyId, kgs) {
  const bill = kgs ? 'IT_KGS' : 'IT_QTY';
  const [pu, sl, slr, pur, millIss, jobIss, millProc, jobProc] = await Promise.all([
    src.loadPurchaseRegisterRows(companyId), src.loadSalesRegisterRows(companyId),
    src.loadReturnRegisterRows(companyId, 'Sales'), src.loadReturnRegisterRows(companyId, 'Purchase'),
    loadMillIssueRows(companyId, 'millIssue'), loadMillIssueRows(companyId, 'jobIssue'),
    loadProcessStockRows(companyId, { kind: 'Mill' }), loadProcessStockRows(companyId, { kind: 'Job' }),
  ]);
  const flows = [];
  const bills = (list, grey, finish) => {
    for (const b of list) for (const l of b._lines || []) {
      flows.push({ date: b.BILL_DATE, [isGrey(l.ITEM_CATEGORY) ? grey : finish]: Number(l[bill] || 0) });
    }
  };
  bills(pu, 'G_PURCHASE', 'F_PURCHASE');
  bills(sl, 'G_SALES', 'F_SALES');
  bills(slr, 'G_SALES_RTN', 'F_SL_RTN');
  bills(pur, 'G_RETURN', 'F_PU_RTN');
  for (const j of millIss) flows.push({ date: j.CHLN_DATE, M_ISSUE: Number(kgs ? j.ISS_KGS : j.ISS_QTY) || 0 });
  const seen = new Set();
  for (const r of millProc) {
    const d = r.REC_BILLDATE || r.BILL_DATE;
    if (!d) continue;
    flows.push({
      date: d, M_RECEIPT: Number(kgs ? r.R_REC_KGS : r.R_GRY_REC_QTY) || 0, PROCESS: Number(kgs ? r.R_REC_KGS : r.R_FNS_REC_QTY) || 0, M_SHORT: Number(r.R_SHORT_QTY) || 0,
    });
    seen.add(r.ENT_NO);
  }
  for (const j of jobIss) flows.push({ date: j.CHLN_DATE, J_ISSUE: Number(kgs ? j.ISS_KGS : j.ISS_QTY) || 0 });
  for (const r of jobProc) {
    const d = r.REC_BILLDATE || r.BILL_DATE;
    if (d) flows.push({ date: d, J_RECEIPT: Number(kgs ? r.R_REC_KGS : r.R_FNS_REC_QTY) || 0 });
  }
  return flows;
}

const sum = (flows, f, from, to) => flows
  .filter((r) => r[f] !== undefined && dayKey(r.date) >= from && dayKey(r.date) <= to)
  .reduce((t, r) => t + r[f], 0);

async function run(companyId, p = {}, deps = {}) {
  if (!p.to) throw bad('As on Date is required');
  const sections = { 1: 'all', 2: 'grey', 3: 'mill', 4: 'finish', 5: 'job' }[Number(String(p.section || '1').split('-')[0])];
  if (!sections) throw bad(`Unknown report: ${p.section}`);
  const kgs = Boolean(p.kgs);
  const flows = deps.flows || await loadFlows(companyId, kgs);
  const start = fyStartOf(p.to);
  const before = new Date(new Date(`${start}T00:00:00Z`).getTime() - 86400000).toISOString().slice(0, 10);
  const cur = (f) => sum(flows, f, start, p.to);
  const prior = (f) => sum(flows, f, '0000-01-01', before);

  const gOp = prior('G_PURCHASE') + prior('G_SALES_RTN') - prior('G_RETURN') - prior('G_SALES') - prior('M_ISSUE');
  const grey = {
    open: gOp, pur: cur('G_PURCHASE'), millRtn: 0, ret: cur('G_RETURN'), issue: cur('M_ISSUE'), sales: cur('G_SALES'), salesRtn: cur('G_SALES_RTN'),
  };
  grey.cl = grey.open + grey.pur + grey.millRtn - grey.ret - grey.issue - grey.sales + grey.salesRtn;

  const mOp = prior('M_ISSUE') - prior('M_RECEIPT') - prior('M_SHORT');
  const mill = { open: mOp, issue: cur('M_ISSUE'), rec: cur('M_RECEIPT'), short: cur('M_SHORT'), rtn: 0 };
  mill.cl = mill.open + mill.issue - mill.rec - mill.short - mill.rtn;
  const rf = { issue: 0, rec: 0, short: 0, cl: 0 };

  const fOp = prior('PROCESS') + prior('F_PURCHASE') + prior('F_SL_RTN') + prior('J_RECEIPT') - prior('F_PU_RTN') - prior('F_SALES') - prior('J_ISSUE');
  const fin = {
    open: fOp, rfIssue: 0, process: cur('PROCESS'), pur: cur('F_PURCHASE'), puRtn: cur('F_PU_RTN'), sales: cur('F_SALES'), slRtn: cur('F_SL_RTN'),
    jobIssue: cur('J_ISSUE'), jobRec: cur('J_RECEIPT'), plain: 0, wastage: 0, sample: 0,
  };
  fin.cl = fin.open + fin.process + fin.pur + fin.slRtn + fin.jobRec + fin.plain - fin.puRtn - fin.sales - fin.jobIssue - fin.rfIssue - fin.wastage - fin.sample;

  const rows = [];
  const add = (section, head, value) => rows.push({ SECTION: section, HEADNAME: head, VALUE: round(value, 2) });
  if (['all', 'grey'].includes(sections)) {
    add('Grey ->', 'Opening Stock', grey.open); add('', 'Purchase', grey.pur); add('', 'Mill Return', grey.millRtn); add('', 'Return', grey.ret);
    add('', 'Issue', grey.issue); add('', 'G.Sales', grey.sales); add('', 'G.Sales.Rtn', grey.salesRtn); add('', 'Closing Stock', grey.cl);
  }
  if (['all', 'mill'].includes(sections)) {
    add('Mill Grey ->', 'Opening Stock', mill.open); add('', 'Grey Issue', mill.issue); add('', 'Receipt Mill', mill.rec); add('', 'Short', mill.short);
    add('', 'Mill Return', mill.rtn); add('', 'Grey Closing Stock', mill.cl);
    add('Mill Rf ->', 'Refinish Issue', rf.issue); add('', 'Refinish Receipt Mill', rf.rec); add('', 'Short', rf.short); add('', 'Rf Closing Stock', rf.cl);
    add('', 'Net Closing Stock', mill.cl + rf.cl);
  }
  if (['all', 'finish', 'job'].includes(sections)) {
    if (sections !== 'job') {
      add('Finish ->', 'Opening Stock', fin.open); add('', 'Refinish Issue', fin.rfIssue); add('', 'Process', fin.process); add('', 'Purchase', fin.pur);
      add('', 'Pu.Return', fin.puRtn); add('', 'Sales', fin.sales); add('', 'Sl.Return', fin.slRtn);
    }
    add(sections === 'job' ? 'Job ->' : '', 'Job Issue', fin.jobIssue); add('', 'Job Receipt', fin.jobRec);
    if (sections !== 'job') {
      add('', 'Plain Return', fin.plain); add('', 'Wastage', fin.wastage); add('', 'Sample', fin.sample); add('', 'Closing Stock', fin.cl);
    }
  }
  return {
    rows,
    grid: {
      layout: 'RPT_STK_METER_STATEMENT',
      variant: 1,
      groupColumns: [],
      groupDisplays: [],
      captions: {},
      title: `Monthwise Stock ${kgs ? 'Kgs' : 'Mts'} Report`,
      period: `Stock As on Date : ${p.toText || p.to}`,
      pageWise: false,
    },
  };
}

async function options() {
  return {};
}

module.exports = { run, options };
