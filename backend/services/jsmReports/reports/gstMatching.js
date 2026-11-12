'use strict';

/**
 * JSM GST Portal Reconciliation (Matching) reports:
 *   - Rpt_Jsm_Gstr1_Match        (Gstr-1 Matching Reconcial)
 *   - Rpt_Jsm_GSTR1_Json_Match   (Gstr-1 JSON Matching)
 *   - Rpt_Match2B_Report         (Gstr-2B Matching Old & Gst 4.5 > 2B)
 *   - Rpt_Match2B_Report_Tejas   (Gstr-2B Matching New, with MATCH AMT DIFF)
 *   - Rpt_Match4A_Report_New     (Gstr-4A Matching)
 *   - Rpt_Match2A                (Gstr-2A Matching, with udf_GetNumeric option)
 *
 * Matches uploaded government portal rows (`params.portalRows` or `deps.portalRows`) against MERN's
 * stored book registers without modifying or guessing any ledger/tax figure.
 */
const { orderRows, inDateRange, groupBy, round } = require('../jcEngine');
const billSrc = require('../sources/billRegister');
const mrSrc = require('../sources/millReceipt');

const normStr = (v) => String(v ?? '').trim().toUpperCase();
const digitsOnly = (v) => String(v ?? '').replace(/\D+/g, '');

const STATUS_ALIASES = {
  MATCH: 'MATCH',
  'ABSENT IN GSTR1': 'ABSENT IN Gstr1',
  'ABSENT IN G1': 'ABSENT IN Gstr1',
  'ABSENT IN 2A': 'ABSENT IN 2A',
  'ABSENT IN 4A': 'ABSENT IN 2A',
  'ABSENT IN JSM': 'ABSENT IN JSM',
  'MATCH AMT DIFF': 'MATCH AMT DIFF',
};

function matchesStatusFilter(rowStatus, wanted) {
  const w = normStr(wanted);
  if (!w || w === 'ALL') return true;
  if (w === 'ABSENT IN JSM+GSTR1' || w === 'ABSENT IN JSM+2A' || w === 'ABSENT IN JSM+4A') {
    return rowStatus === 'ABSENT IN JSM' || rowStatus.startsWith('ABSENT IN ');
  }
  return normStr(rowStatus) === normStr(STATUS_ALIASES[w] || wanted);
}

async function loadSalesForMatch(companyId, p, deps) {
  const [sales, salesRtn] = await Promise.all([
    deps.sales || billSrc.loadSalesRegisterRows(companyId),
    deps.salesRtn || billSrc.loadReturnRegisterRows(companyId, 'Sales'),
  ]);
  let notes = deps.salesNotes;
  if (!notes) {
    const DebitCreditNote = require('../../../models/DebitCreditNote');
    const docs = await DebitCreditNote.find({ companyId, noteType: 'Credit' }).lean();
    notes = docs.map((n) => ({
      ENT_NO: String(n._id), CO_PATH: '', BILL_DATE: n.date, NCBILL_NO: n.vNo || n.billNo || '',
      BOOK: 'CREDIT NOTE', PARTY: n.partyName || '', GSTIN_NO: n.partyGstin || '',
      TAX_RATE: round(n.gstRate || 0), NET_TOT: -Number(n.netAmount ?? n.amount ?? 0),
      TAXABLE_AMT: -Number(n.taxableAmount || 0), IGST_AMT: -Number(n.igst || 0),
      CGST_AMT: -Number(n.cgst || 0), SGST_AMT: -Number(n.sgst || 0), SL_TYPE: 'CRNOTE',
    }));
  }
  const out = [];
  for (const b of inDateRange(sales, 'BILL_DATE', p.from, p.to)) {
    const gst = normStr(b.GSTIN_NO);
    if (!gst || gst === 'URP') continue;
    const byRate = groupBy((b._lines || []).map((l) => ({
      rate: round(l.IT_GST_PER || 0),
      taxable: Number(l.IT_TAXABLE || 0),
      sgst: Number(l.IT_SGST_A || 0),
      cgst: Number(l.IT_CGST_A || 0),
      igst: Number(l.IT_IGST_A || 0),
      totGst: Number(l.IT_GST_AMT || 0),
    })), ['rate'], { sum: ['taxable', 'sgst', 'cgst', 'igst', 'totGst'] });
    for (const r of byRate) {
      if (Math.abs(r.totGst) <= 0.004) continue;
      out.push({
        ENT_NO: b.ENT_NO, CO_PATH: b.CO_PATH, BILL_DATE: b.BILL_DATE, NCBILL_NO: b.NCBILL_NO,
        BOOK: b.BOOK, PARTY: b.PARTY, GSTIN_NO: b.GSTIN_NO, TAX_RATE: round(r.rate),
        BILL_AMT: round(b.NET_TOT), TAXABLE_AMT: round(r.taxable),
        SGST_AMT: round(r.sgst), CGST_AMT: round(r.cgst), IGST_AMT: round(r.igst), SL_TYPE: 'SL',
      });
    }
  }
  for (const r of inDateRange(salesRtn, 'BILL_DATE', p.from, p.to)) {
    if (!normStr(r.GSTIN_NO)) continue;
    out.push({
      ENT_NO: r.ENT_NO, CO_PATH: r.CO_PATH, BILL_DATE: r.BILL_DATE, NCBILL_NO: `${r.SRAL_NO || r.NCBILL_NO}SR`,
      BOOK: r.BOOK, PARTY: r.PARTY, GSTIN_NO: r.GSTIN_NO, TAX_RATE: round(r.GST_RATE || 0),
      BILL_AMT: round(r.NET_TOT), TAXABLE_AMT: -round(r.TAXABLE_AMT),
      SGST_AMT: -round(r.SGST_AMT), CGST_AMT: -round(r.CGST_AMT), IGST_AMT: -round(r.IGST_AMT), SL_TYPE: 'SLRTN',
    });
  }
  for (const n of inDateRange(notes, 'BILL_DATE', p.from, p.to)) {
    if (normStr(n.GSTIN_NO)) out.push(n);
  }
  return out;
}

async function loadPurchasesForMatch(companyId, p, deps) {
  const [pu, puRtn, mill, job] = await Promise.all([
    deps.purchases || billSrc.loadPurchaseRegisterRows(companyId),
    deps.purchaseRtn || billSrc.loadReturnRegisterRows(companyId, 'Purchase'),
    deps.millReceipts || mrSrc.loadMillReceiptRows(companyId),
    deps.jobReceipts || mrSrc.loadJobReceiptRows(companyId),
  ]);
  let notes = deps.purchaseNotes;
  if (!notes) {
    const DebitCreditNote = require('../../../models/DebitCreditNote');
    const docs = await DebitCreditNote.find({ companyId, noteType: 'Debit' }).lean();
    notes = docs.map((n) => ({
      ENT_NO: String(n._id), CO_PATH: '', BILL_DATE: n.date, NCBILL_NO: `D${n.vNo || n.billNo || ''}`,
      MATCH_NO: `DN-${n.vNo || n.billNo || ''}`, BOOK: n.accountHeadName || 'DEBIT NOTE',
      PARTY: n.partyName || '', GSTIN_NO: n.partyGstin || '', TAX_RATE: round(n.gstRate || 0),
      BILL_AMT: -round(n.netAmount ?? n.amount ?? 0), TAXABLE_AMT: -round(n.taxableAmount || 0),
      SGST_AMT: -round(n.sgst || 0), CGST_AMT: -round(n.cgst || 0), IGST_AMT: -round(n.igst || 0),
      PU_TYPE: 'DBNOTE', INV_TYPE: 'CDNR', RVRS_CHRG_YN: n.reverseCharge ? 'Yes' : 'No',
    }));
  }
  const hasGst = (r) => Math.abs(Number(r.SGST_AMT || 0)) + Math.abs(Number(r.CGST_AMT || 0)) + Math.abs(Number(r.IGST_AMT || 0)) > 0.004;
  const rows = [
    ...inDateRange(pu, 'BILL_DATE', p.from, p.to).filter(hasGst).map((r) => ({
      ENT_NO: r.ENT_NO, CO_PATH: r.CO_PATH, BILL_DATE: r.BILL_DATE, NCBILL_NO: r.NCBILL_NO,
      MATCH_NO: `PU-${r.NCBILL_NO}`, BOOK: r.BOOK, PARTY: r.PARTY, GSTIN_NO: r.GSTIN_NO,
      TAX_RATE: round(r.GST_RATE || 0), BILL_AMT: round(r.NET_TOT), TAXABLE_AMT: round(r.TAXABLE_AMT),
      SGST_AMT: round(r.SGST_AMT), CGST_AMT: round(r.CGST_AMT), IGST_AMT: round(r.IGST_AMT),
      PU_TYPE: 'PU', INV_TYPE: 'B2B', RVRS_CHRG_YN: r.RVRS_CHRG_YN || 'No', R_CON_DATE: null,
    })),
    ...inDateRange(mill, 'BILL_DATE', p.from, p.to).filter(hasGst).map((r) => ({
      ENT_NO: r.ENT_NO, CO_PATH: r.CO_PATH, BILL_DATE: r.BILL_DATE, NCBILL_NO: r.NCBILL_NO || r.CHALLAN_NO,
      MATCH_NO: `PU-${r.NCBILL_NO || r.CHALLAN_NO}`, BOOK: 'MILL', PARTY: r.PARTY, GSTIN_NO: r.GSTIN_NO || '',
      TAX_RATE: round(r.TAX_RATE || 0), BILL_AMT: round(r.NET_TOT), TAXABLE_AMT: round(r.TAXABLE_AMT || r.SUB_TOT),
      SGST_AMT: round(r.SGST_AMT), CGST_AMT: round(r.CGST_AMT), IGST_AMT: round(r.IGST_AMT),
      PU_TYPE: 'ML', INV_TYPE: 'B2B', RVRS_CHRG_YN: 'No', R_CON_DATE: null,
    })),
    ...inDateRange(job, 'BILL_DATE', p.from, p.to).filter(hasGst).map((r) => ({
      ENT_NO: r.ENT_NO, CO_PATH: r.CO_PATH, BILL_DATE: r.BILL_DATE, NCBILL_NO: r.NCBILL_NO || r.CHALLAN_NO,
      MATCH_NO: `PU-${r.NCBILL_NO || r.CHALLAN_NO}`, BOOK: 'WORK', PARTY: r.PARTY, GSTIN_NO: r.GSTIN_NO || '',
      TAX_RATE: round(r.TAX_RATE || 0), BILL_AMT: round(r.NET_TOT), TAXABLE_AMT: round(r.TAXABLE_AMT || r.SUB_TOT),
      SGST_AMT: round(r.SGST_AMT), CGST_AMT: round(r.CGST_AMT), IGST_AMT: round(r.IGST_AMT),
      PU_TYPE: 'WK', INV_TYPE: 'B2B', RVRS_CHRG_YN: 'No', R_CON_DATE: null,
    })),
    ...inDateRange(puRtn, 'BILL_DATE', p.from, p.to).filter(hasGst).map((r) => ({
      ENT_NO: r.ENT_NO, CO_PATH: r.CO_PATH, BILL_DATE: r.BILL_DATE, NCBILL_NO: r.SRAL_NO || r.NCBILL_NO,
      MATCH_NO: `DN-${r.SRAL_NO || r.NCBILL_NO}`, BOOK: r.BOOK, PARTY: r.PARTY, GSTIN_NO: r.GSTIN_NO,
      TAX_RATE: round(r.GST_RATE || 0), BILL_AMT: -round(r.NET_TOT), TAXABLE_AMT: -round(r.TAXABLE_AMT),
      SGST_AMT: -round(r.SGST_AMT), CGST_AMT: -round(r.CGST_AMT), IGST_AMT: -round(r.IGST_AMT),
      PU_TYPE: 'PURTN', INV_TYPE: 'CDNR', RVRS_CHRG_YN: 'No', R_CON_DATE: null,
    })),
    ...inDateRange(notes, 'BILL_DATE', p.from, p.to).filter(hasGst),
  ];
  return p.withRcm ? rows : rows.filter((r) => r.RVRS_CHRG_YN !== 'Yes');
}

function groupByKey(groupByOpt) {
  if (groupByOpt === 'Party') return 'PARTY';
  if (groupByOpt === 'Book') return 'BOOK';
  return 'GSTIN_No';
}

async function runGstr1Match(companyId, p = {}, deps = {}) {
  const books = await loadSalesForMatch(companyId, p, deps);
  const portal = deps.portalRows || p.portalRows || [];
  const keyOf = (gstin, inv, rate) => `${normStr(gstin)}|${normStr(inv)}|${round(rate)}`;
  const pMap = new Map();
  for (const x of portal) pMap.set(keyOf(x.GSTIN_NO, x.INV_NO, x.GST_PER), x);

  const matchedPortal = new Set();
  const out = [];
  const gCol = groupByKey(p.groupBy1);

  for (const b of books) {
    const k = keyOf(b.GSTIN_NO, b.NCBILL_NO, b.TAX_RATE);
    const x = pMap.get(k);
    if (x) matchedPortal.add(k);
    const status = x ? 'MATCH' : 'ABSENT IN G1';
    const row = {
      GSTIN_No: b.GSTIN_NO, Party: b.PARTY, BOOK: b.BOOK,
      Jsm_BillNO: b.NCBILL_NO, Jsm_Bill_Date: b.BILL_DATE, Jsm_Bill_Amt: round(b.BILL_AMT),
      Jsm_Taxable_Amt: round(b.TAXABLE_AMT), Jsm_Igst: round(b.IGST_AMT), Jsm_Sgst: round(b.SGST_AMT), Jsm_Cgst: round(b.CGST_AMT),
      G1_BillNo: x ? x.INV_NO : '', G1_Bill_Date: x ? (x.INV_DT || b.BILL_DATE) : null,
      G1_Bill_Amt: x ? round(x.INV_AMT) : 0, G1_Taxable_Amt: x ? round(x.TAX_AMT) : 0,
      G1_Igst: x ? round(x.IGST) : 0, G1_Sgst: x ? round(x.SGST) : 0, G1_Cgst: x ? round(x.CGST) : 0,
      STATUS: status, SL_Type: b.SL_TYPE,
    };
    row.ZGROUP = row[gCol === 'GSTIN_No' ? 'GSTIN_No' : (gCol === 'PARTY' ? 'Party' : 'BOOK')] || '';
    out.push(row);
  }
  for (const x of portal) {
    const k = keyOf(x.GSTIN_NO, x.INV_NO, x.GST_PER);
    if (matchedPortal.has(k)) continue;
    const row = {
      GSTIN_No: x.GSTIN_NO, Party: x.AC_NAME || '----', BOOK: 'Book Not Found',
      Jsm_BillNO: '', Jsm_Bill_Date: null, Jsm_Bill_Amt: 0, Jsm_Taxable_Amt: 0, Jsm_Igst: 0, Jsm_Sgst: 0, Jsm_Cgst: 0,
      G1_BillNo: x.INV_NO, G1_Bill_Date: x.INV_DT || null, G1_Bill_Amt: round(x.INV_AMT), G1_Taxable_Amt: round(x.TAX_AMT),
      G1_Igst: round(x.IGST), G1_Sgst: round(x.SGST), G1_Cgst: round(x.CGST),
      STATUS: 'ABSENT IN JSM', SL_Type: x.SL_TYPE || 'B2B',
    };
    row.ZGROUP = row[gCol === 'GSTIN_No' ? 'GSTIN_No' : (gCol === 'PARTY' ? 'Party' : 'BOOK')] || '';
    out.push(row);
  }
  const filtered = orderRows(out.filter((r) => matchesStatusFilter(r.STATUS, p.status)), ['ZGROUP', 'STATUS', 'Jsm_Bill_Date', 'Jsm_BillNO']);
  return {
    rows: filtered,
    grid: {
      layout: 'RUNTIME_GSTR1_Compare_RPT', variant: 1,
      groupColumns: ['ZGROUP'], groupDisplays: ['ZGROUP'], captions: {},
      title: 'Gstr 1 Matching (Re-Conci)',
      period: `DATE : FROM ${p.fromText || p.from || ''} TO ${p.toText || p.to || ''}`,
      pageWise: false,
      notice: portal.length ? '' : 'No portal Excel uploaded — showing JSM books as ABSENT IN G1 (upload file via Browse to match).',
    },
  };
}

async function runGstr1JsonMatch(companyId, p = {}, deps = {}) {
  const books = inDateRange(deps.sales || await billSrc.loadSalesRegisterRows(companyId), 'BILL_DATE', p.from, p.to);
  const portal = deps.portalRows || p.portalRows || [];
  const sMap = new Map(books.map((s) => [normStr(s.NCBILL_NO), s]));
  const seen = new Set();
  const rows = [];
  for (const g of portal) {
    const k = normStr(g.INV_NO);
    const s = sMap.get(k);
    if (s) seen.add(k);
    rows.push({
      STATUS: s ? 'MATCH' : 'Missing in SALES',
      TYPE: g.SL_TYPE || 'B2B',
      INV_NO: g.INV_NO, INV_DATE: g.INV_DT, INV_VALUE: round(g.INV_AMT), TAXABLE_VAL: round(g.TAX_AMT),
      SGST: round(g.SGST), CGST: round(g.CGST), IGST: round(g.IGST),
      NCBILL_NO: s ? s.NCBILL_NO : '', BILL_DATE: s ? s.BILL_DATE : null,
      NET_TOT: s ? round(s.NET_TOT) : 0, TAXABLE_AMT: s ? round(s.TAXABLE_AMT) : 0,
      SGST_AMT: s ? round(s.SGST_AMT) : 0, CGST_AMT: s ? round(s.CGST_AMT) : 0, IGST_AMT: s ? round(s.IGST_AMT) : 0,
      DIFF_NETVALUE: round((g.INV_AMT || 0) - (s?.NET_TOT || 0)),
      DIFF_TAXABLE: round((g.TAX_AMT || 0) - (s?.TAXABLE_AMT || 0)),
      DIFF_SGT: round((g.SGST || 0) - (s?.SGST_AMT || 0)),
      DIFF_CGT: round((g.CGST || 0) - (s?.CGST_AMT || 0)),
      DIFF_IGT: round((g.IGST || 0) - (s?.IGST_AMT || 0)),
    });
  }
  for (const s of books) {
    if (seen.has(normStr(s.NCBILL_NO))) continue;
    rows.push({
      STATUS: 'Missing in GSTR',
      TYPE: '', INV_NO: '', INV_DATE: null, INV_VALUE: 0, TAXABLE_VAL: 0, SGST: 0, CGST: 0, IGST: 0,
      NCBILL_NO: s.NCBILL_NO, BILL_DATE: s.BILL_DATE, NET_TOT: round(s.NET_TOT), TAXABLE_AMT: round(s.TAXABLE_AMT),
      SGST_AMT: round(s.SGST_AMT), CGST_AMT: round(s.CGST_AMT), IGST_AMT: round(s.IGST_AMT),
      DIFF_NETVALUE: round(-s.NET_TOT), DIFF_TAXABLE: round(-s.TAXABLE_AMT),
      DIFF_SGT: round(-s.SGST_AMT), DIFF_CGT: round(-s.CGST_AMT), DIFF_IGT: round(-s.IGST_AMT),
    });
  }
  return {
    rows: orderRows(rows, ['STATUS', 'BILL_DATE', 'NCBILL_NO']),
    grid: {
      layout: 'RUNTIME_GSTR1_JSON_MATCH', variant: 1, groupColumns: [], groupDisplays: [], captions: {},
      title: 'Gstr 1 JSON Matching',
      period: `DATE : FROM ${p.fromText || p.from || ''} TO ${p.toText || p.to || ''}`,
      pageWise: false,
      notice: portal.length ? '' : 'No GSTR-1 JSON uploaded — showing sales as Missing in GSTR (click Browse to load .json).',
    },
  };
}

async function runGstr2Match(companyId, p = {}, deps = {}, mode = '2B') {
  const books = await loadPurchasesForMatch(companyId, p, deps);
  const portal = deps.portalRows || p.portalRows || [];
  const absentLabel = mode === '4A' ? 'ABSENT IN 4A' : 'ABSENT IN 2A';
  const useXBill = mode === '2B';
  const billKey = (inv, pref = 'PU') => (p.removeChar ? digitsOnly(inv) : normStr(useXBill ? (String(inv).includes('-') ? inv : `${pref}-${inv}`) : inv));
  const keyOf = (gstin, inv, pref) => `${normStr(gstin)}|${billKey(inv, pref)}`;

  if (p.summary && mode === '2B') {
    const map = new Map();
    const gField = p.groupBy1 === 'Party' ? 'PARTY' : (p.groupBy1 === 'Book' ? 'BOOK' : 'GSTNO');
    const bump = (key, rec, isPortal) => {
      if (!map.has(key)) map.set(key, { ZGROUP1: '', ZGROUP2: key, E_TAXABLE_AMT: 0, E_NET_AMT: 0, E_SGST: 0, E_CGST: 0, E_IGST: 0, J_TAXABLE_AMT: 0, J_NET_AMT: 0, J_SGST: 0, J_CGST: 0, J_IGST: 0, RVRS_CHRG_YN: rec.RVRS_CHRG_YN || '' });
      const a = map.get(key);
      if (isPortal) {
        a.E_TAXABLE_AMT += Number(rec.TAX_AMT || 0); a.E_NET_AMT += Number(rec.INV_AMT || 0);
        a.E_SGST += Number(rec.SGST || 0); a.E_CGST += Number(rec.CGST || 0); a.E_IGST += Number(rec.IGST || 0);
      } else {
        a.J_TAXABLE_AMT += Number(rec.TAXABLE_AMT || 0); a.J_NET_AMT += Number(rec.BILL_AMT || 0);
        a.J_SGST += Number(rec.SGST_AMT || 0); a.J_CGST += Number(rec.CGST_AMT || 0); a.J_IGST += Number(rec.IGST_AMT || 0);
      }
    };
    for (const b of books) bump(b[gField === 'GSTNO' ? 'GSTIN_NO' : gField] || '', b, false);
    for (const x of portal) bump((gField === 'GSTNO' ? x.GSTIN_NO : (gField === 'PARTY' ? x.AC_NAME : '')) || '', x, true);
    const sumRows = orderRows([...map.values()].map((r) => ({
      ...r, E_TAXABLE_AMT: round(r.E_TAXABLE_AMT), E_NET_AMT: round(r.E_NET_AMT), E_SGST: round(r.E_SGST), E_CGST: round(r.E_CGST), E_IGST: round(r.E_IGST),
      J_TAXABLE_AMT: round(r.J_TAXABLE_AMT), J_NET_AMT: round(r.J_NET_AMT), J_SGST: round(r.J_SGST), J_CGST: round(r.J_CGST), J_IGST: round(r.J_IGST),
    })), ['ZGROUP2']);
    return {
      rows: sumRows,
      grid: {
        layout: 'RUNTIME_2B_SUMMARY', variant: 1, groupColumns: [], groupDisplays: [], captions: {},
        title: `${mode} Matching Summary`,
        period: `DATE : FROM ${p.fromText || p.from || ''} TO ${p.toText || p.to || ''}`,
        pageWise: false,
      },
    };
  }

  const pMap = new Map();
  for (const x of portal) {
    const k = keyOf(x.GSTIN_NO, x.XINV_NO || x.INV_NO, x.SL_TYPE === 'CDNR' ? 'DN' : 'PU');
    pMap.set(k, x);
  }
  const matched = new Set();
  const approxDiff = Number(p.approxDiff ?? 1);
  const out = [];
  const gCol = groupByKey(p.groupBy1);

  for (const b of books) {
    const k = keyOf(b.GSTIN_NO, useXBill ? (b.MATCH_NO || b.NCBILL_NO) : b.NCBILL_NO);
    const x = pMap.get(k);
    if (x) matched.add(k);
    let status = x ? 'MATCH' : absentLabel;
    if (x && mode === '2B' && Math.abs(Number(b.BILL_AMT || 0) - Number(x.INV_AMT || 0)) > approxDiff) {
      status = 'MATCH AMT DIFF';
    }
    const row = {
      GSTIN_No: b.GSTIN_NO, Party: b.PARTY, BOOK: b.BOOK,
      Jsm_BillNO: b.NCBILL_NO, Jsm_Bill_Date: b.BILL_DATE, Jsm_Bill_Amt: round(b.BILL_AMT),
      Jsm_Taxable_Amt: round(b.TAXABLE_AMT), Jsm_Igst: round(b.IGST_AMT), Jsm_Sgst: round(b.SGST_AMT), Jsm_Cgst: round(b.CGST_AMT),
      A2_BillNo: x ? x.INV_NO : '', A2_Bill_Date: x ? (x.INV_DT || b.BILL_DATE) : null,
      A2_Bill_Amt: x ? round(x.INV_AMT) : 0, A2_Taxable_Amt: x ? round(x.TAX_AMT) : 0,
      A2_Igst: x ? round(x.IGST) : 0, A2_Sgst: x ? round(x.SGST) : 0, A2_Cgst: x ? round(x.CGST) : 0,
      STATUS: status, RCon_date: b.R_CON_DATE, Pu_Type: b.PU_TYPE, RVRS_CHRG_YN: b.RVRS_CHRG_YN,
    };
    row.ZGROUP = row[gCol === 'GSTIN_No' ? 'GSTIN_No' : (gCol === 'PARTY' ? 'Party' : 'BOOK')] || '';
    out.push(row);
  }
  for (const x of portal) {
    const k = keyOf(x.GSTIN_NO, x.XINV_NO || x.INV_NO, x.SL_TYPE === 'CDNR' ? 'DN' : 'PU');
    if (matched.has(k)) continue;
    const row = {
      GSTIN_No: x.GSTIN_NO, Party: x.AC_NAME || '----', BOOK: 'Book Not Found',
      Jsm_BillNO: '', Jsm_Bill_Date: null, Jsm_Bill_Amt: 0, Jsm_Taxable_Amt: 0, Jsm_Igst: 0, Jsm_Sgst: 0, Jsm_Cgst: 0,
      A2_BillNo: x.INV_NO, A2_Bill_Date: x.INV_DT || null, A2_Bill_Amt: round(x.INV_AMT), A2_Taxable_Amt: round(x.TAX_AMT),
      A2_Igst: round(x.IGST), A2_Sgst: round(x.SGST), A2_Cgst: round(x.CGST),
      STATUS: 'ABSENT IN JSM', RCon_date: null, Pu_Type: x.SL_TYPE || 'B2B', RVRS_CHRG_YN: 'No',
    };
    row.ZGROUP = row[gCol === 'GSTIN_No' ? 'GSTIN_No' : (gCol === 'PARTY' ? 'Party' : 'BOOK')] || '';
    out.push(row);
  }

  const filtered = orderRows(out.filter((r) => matchesStatusFilter(r.STATUS, p.status)), ['ZGROUP', 'STATUS', 'Jsm_Bill_Date', 'Jsm_BillNO']);
  return {
    rows: filtered,
    grid: {
      layout: 'RUNTIME_2A_Compare_RPT', variant: 1,
      groupColumns: ['ZGROUP'], groupDisplays: ['ZGROUP'], captions: {},
      title: `${mode} Matching (Re-Conciliation)`,
      period: `DATE : FROM ${p.fromText || p.from || ''} TO ${p.toText || p.to || ''}`,
      pageWise: false,
      notice: portal.length ? '' : `No ${mode} Excel uploaded — showing JSM purchase/jobwork bills as ${absentLabel} (click Browse to upload portal Excel).`,
    },
  };
}

async function options() {
  return {
    groups: ['GstNo', 'Party', 'Book'],
    companies: ['Current', 'All'],
  };
}

module.exports = {
  gstr1Match: { run: runGstr1Match, options },
  gstr1JsonMatch: { run: runGstr1JsonMatch, options },
  match2b: { run: (c, p, d) => runGstr2Match(c, p, d, '2B'), options },
  match4a: { run: (c, p, d) => runGstr2Match(c, p, d, '4A'), options },
  match2a: { run: (c, p, d) => runGstr2Match(c, p, d, '2A'), options },
};

