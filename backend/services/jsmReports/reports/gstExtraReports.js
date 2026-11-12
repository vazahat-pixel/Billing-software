'use strict';

/**
 * JSM: Reports › Gst Reports › Extra › 1Sales (JS_GSTR1_RPT), 2Purchase (JS_GSTR2_RPT), 3Summary (JS_GSTR3_SMRY).
 * Mirrors JS_GSTR1_RPT, JS_GSTR2_RPT and JS_GSTR3_SMRY SQL queries directly over Sales, Purchase and Returns.
 */
const { orderRows, inDateRange, groupBy, round } = require('../jcEngine');
const billSrc = require('../sources/billRegister');

async function runGstr1(companyId, p = {}, deps = {}) {
  const sales = inDateRange(deps.sales || await billSrc.loadSalesRegisterRows(companyId), 'BILL_DATE', p.from, p.to);
  const raw = [];
  for (const b of sales) {
    for (const l of b._lines || []) {
      raw.push({
        PARTY: b.PARTY || '',
        NCBILL_NO: b.NCBILL_NO || '',
        TOT_GST_P: round(l.IT_GST_PER || 0),
        GSTIN_NO: b.GSTIN_NO || '',
        BILL_DATE: b.BILL_DATE,
        NETTOT: Number(l.IT_TAXABLE || 0) + Number(l.IT_GST_AMT || 0),
        SUBTOT: Number(l.IT_TAXABLE || 0),
        SGST_P: l.IT_SGST_P || 0,
        SGST_A: Number(l.IT_SGST_A || 0),
        CGST_P: l.IT_CGST_P || 0,
        CGST_A: Number(l.IT_CGST_A || 0),
        IGST_P: l.IT_IGST_P || 0,
        IGST_A: Number(l.IT_IGST_A || 0),
      });
    }
  }
  const grouped = groupBy(raw, ['PARTY', 'NCBILL_NO', 'TOT_GST_P'], {
    sum: ['NETTOT', 'SUBTOT', 'SGST_A', 'CGST_A', 'IGST_A'],
  }, (f) => ({
    GSTIN_NO: f.GSTIN_NO, BILL_DATE: f.BILL_DATE, SGST_P: f.SGST_P, CGST_P: f.CGST_P, IGST_P: f.IGST_P,
  }));
  const rows = orderRows(grouped.map((r) => ({
    GSTIN_NO: r.GSTIN_NO, NCBILL_NO: r.NCBILL_NO, BILL_DATE: r.BILL_DATE, PARTY: r.PARTY,
    NETTOT: round(r.NETTOT), SGST_P: round(r.SGST_P), SGST_A: round(r.SGST_A),
    CGST_P: round(r.CGST_P), CGST_A: round(r.CGST_A), IGST_P: round(r.IGST_P), IGST_A: round(r.IGST_A),
    SUBTOT: round(r.SUBTOT),
  })), ['BILL_DATE', 'NCBILL_NO']);
  return {
    rows,
    grid: {
      layout: 'JSM_VW_JS_GSTR1_RPT', variant: 1, groupColumns: [], groupDisplays: [], captions: {},
      title: 'GSTR1 - Sales', period: `DATE : FROM ${p.fromText || p.from || ''} TO ${p.toText || p.to || ''}`, pageWise: false,
    },
  };
}

async function runGstr2(companyId, p = {}, deps = {}) {
  let docs = deps.purchasesRaw;
  if (!docs) {
    const Purchase = require('../../../models/Purchase');
    require('../../../models/Party');
    docs = await Purchase.find({ companyId, status: { $ne: 'cancelled' }, isDeleted: { $ne: true } })
      .populate('supplierId', 'name gstin').lean();
  }
  const rows = orderRows(inDateRange(docs, 'date', p.from, p.to).map((d) => ({
    GSTIN_NO: d.supplierId?.gstin || '', NCBILL_NO: d.supplierInvoiceNo || d.invoiceNo || '',
    BILL_DATE: d.date, PARTY: d.supplierId?.name || '',
    NET_TOT: round(d.netAmount || 0),
    SGST_PER: d.sgst > 0 ? round((d.gstPer || 0) / 2) : 0, SGST_AMT: round(d.sgst || 0),
    CGST_PER: d.cgst > 0 ? round((d.gstPer || 0) / 2) : 0, CGST_AMT: round(d.cgst || 0),
    IGST_PER: d.igst > 0 ? round(d.gstPer || 0) : 0, IGST_AMT: round(d.igst || 0),
    ITC_ELIGIBILITY: d.itcEligibility || 'Inputs',
    ITC_AVAILABLE: String(d.itcEligibility || '').toUpperCase() === 'NONE' ? 0 : round((d.sgst || 0) + (d.cgst || 0) + (d.igst || 0)),
  })), ['BILL_DATE', 'NCBILL_NO']);
  return {
    rows,
    grid: {
      layout: 'JSM_VW_JS_GSTR2_RPT', variant: 1, groupColumns: [], groupDisplays: [], captions: {},
      title: 'GSTR2 - Purchase', period: `DATE : FROM ${p.fromText || p.from || ''} TO ${p.toText || p.to || ''}`, pageWise: false,
    },
  };
}

async function runGstr3Summary(companyId, p = {}, deps = {}) {
  const [sales, purchases, slRtn, puRtn] = await Promise.all([
    deps.sales || billSrc.loadSalesRegisterRows(companyId),
    deps.purchases || billSrc.loadPurchaseRegisterRows(companyId),
    deps.salesRtn || billSrc.loadReturnRegisterRows(companyId, 'Sales'),
    deps.purchaseRtn || billSrc.loadReturnRegisterRows(companyId, 'Purchase'),
  ]);
  const f = (xs) => inDateRange(xs, 'BILL_DATE', p.from, p.to);
  const summarize = (bills, rtns, label) => {
    const byKey = new Map();
    const acc = (b, isRtn) => {
      const k = `${round(b.GST_RATE || 0)}|${b.GSTIN_NO ? 'REG' : 'URP'}`;
      if (!byKey.has(k)) byKey.set(k, { rate: round(b.GST_RATE || 0), reg: b.GSTIN_NO ? 'REGISTERED' : 'UNREGISTERED', gross: 0, tax: 0, sgst: 0, retAmt: 0, net: 0 });
      const e = byKey.get(k);
      if (isRtn) {
        e.retAmt += Number(b.NET_TOT || 0);
        e.net -= Number(b.NET_TOT || 0);
      } else {
        e.gross += Number(b.TAXABLE_AMT || 0);
        e.tax += Number(b.IGST_AMT || 0) + Number(b.CGST_AMT || 0);
        e.sgst += Number(b.SGST_AMT || 0);
        e.net += Number(b.NET_TOT || 0);
      }
    };
    f(bills).forEach((b) => acc(b, false));
    f(rtns).forEach((r) => acc(r, true));
    return [...byKey.values()].sort((a, b) => a.rate - b.rate).map((r) => ({
      DETAILS: `${label} @ ${r.rate}% (${r.reg})`,
      GSTIN_NO: r.reg,
      SUB_TOT: round(r.gross),
      IGST_CGST: round(r.tax),
      SGST_AMT: round(r.sgst),
      RET_AMT: round(r.retAmt),
      NET_AMT: round(r.net),
    }));
  };
  const rows = [
    ...summarize(purchases, puRtn, 'Input (Purchase)'),
    ...summarize(sales, slRtn, 'Output (Sales)'),
  ];
  return {
    rows,
    grid: {
      layout: 'JSM_VW_JS_GSTR3_SMRY', variant: 1, groupColumns: [], groupDisplays: [], captions: {},
      title: 'GSTR1 / GSTR3 Summary', period: `DATE : FROM ${p.fromText || p.from || ''} TO ${p.toText || p.to || ''}`, pageWise: false,
    },
  };
}

const opts = async () => ({});

module.exports = {
  jsGstr1: { run: runGstr1, options: opts },
  jsGstr2: { run: runGstr2, options: opts },
  jsGstr3: { run: runGstr3Summary, options: opts },
};

