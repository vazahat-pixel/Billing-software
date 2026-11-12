'use strict';

/**
 * JSM: Reports > Gst Reports > Gstr Matching > Gstr-8 Match (Rpt_Match8A_Report)
 * Note: JSM's decompiled Rpt_Match8A_Report contains 0 methods; this screen provides the
 * portal upload matching workflow (matching uploaded GSTR-8A / TCS rows vs books).
 */
const { orderRows, inDateRange, round } = require('../jcEngine');
const billSrc = require('../sources/billRegister');

const norm = (v) => String(v ?? '').trim().toUpperCase();
const cleanBill = (v, strip) => {
  const s = norm(v);
  return strip ? s.replace(/\D+/g, '') : s;
};

async function run(companyId, p = {}, deps = {}) {
  const purchases = inDateRange(deps.purchases || await billSrc.loadPurchaseRegisterRows(companyId), 'BILL_DATE', p.from, p.to);
  const strip = Boolean(p.removeChar);
  const portal = Array.isArray(p.portalRows) ? p.portalRows : [];
  const pMap = new Map();
  for (const x of portal) {
    const k = `${norm(x.GSTIN_NO || x.gstin)}|${cleanBill(x.INV_NO || x.billNo, strip)}`;
    pMap.set(k, x);
  }

  const matched = new Set();
  const out = [];
  for (const b of purchases) {
    const gst = norm(b.GSTIN_NO);
    if (!gst) continue;
    const k = `${gst}|${cleanBill(b.NCBILL_NO, strip)}`;
    const x = pMap.get(k);
    if (x) matched.add(k);
    const status = x
      ? (Math.abs(round(b.NET_TOT) - round(x.INV_AMT ?? x.billAmt ?? 0)) > 1 ? 'MATCH AMT DIFF' : 'MATCH')
      : 'ABSENT IN 8A';
    out.push({
      GSTIN_No: b.GSTIN_NO,
      Party: b.PARTY || '',
      BOOK: b.BOOK || '',
      Jsm_BillNO: b.NCBILL_NO || '',
      Jsm_Bill_Date: b.BILL_DATE,
      Jsm_Bill_Amt: round(b.NET_TOT),
      Jsm_Taxable_Amt: round(b.TAXABLE_AMT),
      A8_BillNo: x ? (x.INV_NO || x.billNo || '') : '',
      A8_Bill_Amt: x ? round(x.INV_AMT ?? x.billAmt ?? 0) : 0,
      A8_Taxable_Amt: x ? round(x.TAX_AMT ?? x.taxable ?? 0) : 0,
      A8_Igst: x ? round(x.IGST || 0) : 0,
      A8_Sgst: x ? round(x.SGST || 0) : 0,
      A8_Cgst: x ? round(x.CGST || 0) : 0,
      STATUS: status,
    });
  }

  for (const x of portal) {
    const k = `${norm(x.GSTIN_NO || x.gstin)}|${cleanBill(x.INV_NO || x.billNo, strip)}`;
    if (matched.has(k)) continue;
    out.push({
      GSTIN_No: x.GSTIN_NO || x.gstin || '',
      Party: x.AC_NAME || x.partyName || '----',
      BOOK: 'Not in Books',
      Jsm_BillNO: '',
      Jsm_Bill_Date: null,
      Jsm_Bill_Amt: 0,
      Jsm_Taxable_Amt: 0,
      A8_BillNo: x.INV_NO || x.billNo || '',
      A8_Bill_Amt: round(x.INV_AMT ?? x.billAmt ?? 0),
      A8_Taxable_Amt: round(x.TAX_AMT ?? x.taxable ?? 0),
      A8_Igst: round(x.IGST || 0),
      A8_Sgst: round(x.SGST || 0),
      A8_Cgst: round(x.CGST || 0),
      STATUS: 'ABSENT IN JSM',
    });
  }

  const wanted = norm(p.status);
  const filtered = wanted && wanted !== 'ALL' ? out.filter((r) => norm(r.STATUS) === wanted) : out;
  const gField = p.groupBy1 === 'Party' ? 'Party' : (p.groupBy1 === 'Book' ? 'BOOK' : 'GSTIN_No');

  return {
    rows: orderRows(filtered, [gField, 'STATUS', 'Jsm_Bill_Date', 'Jsm_BillNO']),
    grid: {
      layout: 'JSM_VW_MATCH8A',
      variant: 1,
      groupColumns: [gField],
      groupDisplays: [p.groupBy1 || 'GstNo'],
      captions: {},
      title: 'GSTR-8A Matching (Re-Conciliation)',
      period: `DATE : FROM ${p.fromText || p.from || ''} TO ${p.toText || p.to || ''}`,
      pageWise: false,
      notice: portal.length ? '' : 'No 8A Excel uploaded — showing books purchase bills as ABSENT IN 8A. Click Browse to upload portal Excel.',
    },
  };
}

module.exports = { run, options: async () => ({}) };

