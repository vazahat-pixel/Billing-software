'use strict';

/**
 * JSM Old GST Reports:
 *   - Gstr_3B_TextNew_Monthly_Cess (Others Reports > Old Reports > Extra Reports > 3B Cess)
 *   - Gstr_3BB_Zoomin_Rpt          (Others Reports > Old Reports > Extra Reports > 3B Zoom)
 *
 * Uses stored bill/return/note figures only (no tax recomputation).
 */
const { orderRows, inDateRange, groupBy, round } = require('../jcEngine');
const billSrc = require('../sources/billRegister');

const hasGst = (b) => Math.abs(Number(b.SGST_AMT || 0)) + Math.abs(Number(b.CGST_AMT || 0)) + Math.abs(Number(b.IGST_AMT || 0)) > 0.004;
const isReg = (b) => String(b.GSTIN_NO || '').trim() !== '';

async function loadNotes(companyId) {
  const DebitCreditNote = require('../../../models/DebitCreditNote');
  const notes = await DebitCreditNote.find({ companyId }).lean();
  return notes.map((n) => ({
    ENT_NO: String(n._id),
    BILL_DATE: n.date,
    NOTE_TYPE: n.noteType, // 'Credit' | 'Debit'
    BOOK: n.accountHeadName || (n.noteType === 'Credit' ? 'CREDIT NOTE' : 'DEBIT NOTE'),
    TAXABLE_AMT: round(n.taxableAmount || 0),
    IGST_AMT: round(n.igst || 0),
    CGST_AMT: round(n.cgst || 0),
    SGST_AMT: round(n.sgst || 0),
    CESS_AMT: round(n.cess || 0),
    NET_TOT: round(n.netAmount ?? n.totalAmount ?? n.amount ?? 0),
  }));
}

async function loadAll(companyId, p, deps) {
  const [sl, pu, sr, pr, nt] = await Promise.all([
    deps.sales || billSrc.loadSalesRegisterRows(companyId),
    deps.purchases || billSrc.loadPurchaseRegisterRows(companyId),
    deps.salesRtn || billSrc.loadReturnRegisterRows(companyId, 'Sales'),
    deps.purchaseRtn || billSrc.loadReturnRegisterRows(companyId, 'Purchase'),
    deps.notes || loadNotes(companyId),
  ]);
  const f = (xs) => inDateRange(xs, 'BILL_DATE', p.from, p.to);
  return { sl: f(sl), pu: f(pu), sr: f(sr), pr: f(pr), nt: f(nt) };
}

function sumByBook(rows, headLabel, sign = 1) {
  return groupBy(rows, ['BOOK'], { sum: ['TAXABLE_AMT', 'IGST_AMT', 'CGST_AMT', 'SGST_AMT', 'CESS_AMT', 'NET_TOT'] })
    .map((r) => ({
      HEAD: headLabel,
      BOOK: r.BOOK || headLabel,
      TAXABLE_AMT: round(sign * r.TAXABLE_AMT),
      IGST_AMT: round(sign * r.IGST_AMT),
      CGST_AMT: round(sign * r.CGST_AMT),
      SGST_AMT: round(sign * r.SGST_AMT),
      CESS_AMT: round(sign * (r.CESS_AMT || 0)),
      NET_TOT: round(sign * r.NET_TOT),
    }));
}

/** Gstr_3B_TextNew_Monthly_Cess */
async function runCess(companyId, p = {}, deps = {}) {
  const { sl, pu, sr, pr, nt } = await loadAll(companyId, p, deps);
  const outReg = sl.filter((b) => isReg(b) && hasGst(b) && String(b.BOOK || '').toUpperCase() !== 'DELIVERY CHALLAN');
  const outNil = sl.filter((b) => !hasGst(b));
  const outUnreg = sl.filter((b) => !isReg(b) && hasGst(b));
  const crNotes = nt.filter((n) => n.NOTE_TYPE === 'Credit');
  const dbNotes = nt.filter((n) => n.NOTE_TYPE === 'Debit');

  const rows = [
    ...sumByBook(outReg, 'SALES (Outward taxable supplies)', 1),
    ...sumByBook(outNil, 'SALES (Nil rated, exempted)', 1),
    ...groupBy(outUnreg, ['STATE'], { sum: ['TAXABLE_AMT', 'IGST_AMT', 'CGST_AMT', 'SGST_AMT', 'CESS_AMT', 'NET_TOT'] })
      .map((r) => ({
        HEAD: 'STATEWISE - UNREGISTERED & COMP.',
        BOOK: r.STATE || 'UNREGISTERED',
        TAXABLE_AMT: round(r.TAXABLE_AMT),
        IGST_AMT: round(r.IGST_AMT),
        CGST_AMT: round(r.CGST_AMT),
        SGST_AMT: round(r.SGST_AMT),
        CESS_AMT: round(r.CESS_AMT || 0),
        NET_TOT: round(r.NET_TOT),
      })),
    ...sumByBook(sr, 'SALES RETURN ( - )', -1),
    ...sumByBook(crNotes, 'CREDIT NOTE ( - )', -1),
    ...sumByBook(pu, 'PURCHASE (ALL)', 1),
    ...sumByBook(pr, 'PURCHASE RETURN ( - )', -1),
    ...sumByBook(dbNotes, 'DEBIT NOTE ( + )', 1),
  ];

  return {
    rows: orderRows(rows, ['HEAD', 'BOOK']),
    grid: {
      layout: 'JSM_VW_GSTR3B_CESS',
      variant: 1,
      groupColumns: ['HEAD'],
      groupDisplays: ['HEAD'],
      captions: {},
      title: 'GSTR-3B Monthly Return (with Cess)',
      period: `DATE : FROM ${p.fromText || p.from || ''}  TO  ${p.toText || p.to || ''}`,
      pageWise: false,
    },
  };
}

/** Gstr_3BB_Zoomin_Rpt */
async function runZoom(companyId, p = {}, deps = {}) {
  const { sl, sr, nt } = await loadAll(companyId, p, deps);
  const outReg = sl.filter((b) => isReg(b) && hasGst(b) && String(b.BOOK || '').toUpperCase() !== 'DELIVERY CHALLAN');
  const outNil = sl.filter((b) => !hasGst(b));
  const outUnreg = sl.filter((b) => !isReg(b) && hasGst(b));
  const crNotes = nt.filter((n) => n.NOTE_TYPE === 'Credit');

  const mk = (rs, graceHead, sign = 1) => groupBy(rs, ['BOOK'], { sum: ['TAXABLE_AMT', 'IGST_AMT', 'CGST_AMT', 'SGST_AMT'] })
    .map((r) => ({
      GRACE_HEAD: graceHead,
      BOOK: r.BOOK || graceHead,
      TAXABLE_AMT: round(sign * r.TAXABLE_AMT),
      IGST_AMT: round(sign * r.IGST_AMT),
      CGST_AMT: round(sign * r.CGST_AMT),
      SGST_AMT: round(sign * r.SGST_AMT),
    }));

  const stateUnreg = groupBy(outUnreg, ['STATE'], { sum: ['TAXABLE_AMT', 'IGST_AMT', 'CGST_AMT', 'SGST_AMT'] })
    .map((r) => ({
      GRACE_HEAD: 'STATEWISE - UNREGISTERED AND COMPOSITION SCHEME',
      BOOK: r.STATE || 'UNREGISTERED',
      TAXABLE_AMT: round(r.TAXABLE_AMT),
      IGST_AMT: round(r.IGST_AMT),
      CGST_AMT: round(r.CGST_AMT),
      SGST_AMT: round(r.SGST_AMT),
    }));

  const rows = [
    ...mk(outReg, 'SALES REGISTRED', 1),
    ...mk(outNil, 'NILL RATED & EXEMPTED', 1),
    ...stateUnreg,
    ...mk(sr, 'SALES RETURN', -1),
    ...mk(crNotes, 'CREDIT NOTE', -1),
  ];

  return {
    rows,
    grid: {
      layout: 'JSM_VW_GSTR_3B_ZOOMIN_RPT',
      variant: 1,
      groupColumns: ['GRACE_HEAD'],
      groupDisplays: ['GRACE_HEAD'],
      captions: {},
      title: 'GSTR-3B Zoomin Report',
      period: `3B REPORT AS ON MONTH : FROM ${p.fromText || p.from || ''}  TO  ${p.toText || p.to || ''}`,
      pageWise: false,
    },
  };
}

const opts = async () => ({});

module.exports = {
  cess: { run: runCess, options: opts },
  zoom: { run: runZoom, options: opts },
};

