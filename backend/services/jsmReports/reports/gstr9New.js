'use strict';

/**
 * JSM: Reports › Gst Reports › Gstr-9 › Gstr-9 & 9C (Rpt_Jsm_GSTR9_New, GSTR_9New.xlsx).
 *
 * Covers the register-backed working tabs of GSTR_9New.xlsx (SalesMonth, SalesHsn, SalesTaxrate,
 * PurchaseMonth, PurchaseHsn, InputTaxrate, Exporter, PartyGstRt) plus Purchase ITC/RCM rows when
 * recorded on purchases, while cleanly flagging JV-only RCM/ITC heads when absent in MERN.
 */
const { orderRows, inDateRange, groupBy, round, MONTHS } = require('../jcEngine');
const src = require('../sources/billRegister');
const mrSrc = require('../sources/millReceipt');

const SHEETS = ['SalesMonth', 'SalesHsn', 'SalesTaxrate', 'PurchaseMonth', 'PurchaseHsn', 'InputTaxrate', 'Exporter', 'PartyGstRt'];
const UNAVAILABLE = ['Rcm', 'Itc'];

const monthOf = (b) => {
  const d = b.BILL_DATE ? new Date(b.BILL_DATE) : null;
  return d && !Number.isNaN(d.getTime())
    ? { YEAR_NO: d.getUTCFullYear(), MONTH_NO: d.getUTCMonth() + 1, MONTH_NAME: MONTHS[d.getUTCMonth()] }
    : { YEAR_NO: 0, MONTH_NO: 0, MONTH_NAME: '' };
};

const hasGst = (b) => Math.abs(Number(b.SGST_AMT || 0)) + Math.abs(Number(b.CGST_AMT || 0)) + Math.abs(Number(b.IGST_AMT || 0)) > 0.004;

function toLines(bills, label) {
  const out = [];
  for (const b of bills) {
    for (const l of b._lines || []) {
      out.push({
        TYPE: label, HSN_CODE: l.HSN_CODE || '', TOT_GST_P: round(l.IT_GST_PER || 0),
        TAXABLE: Number(l.IT_TAXABLE || 0), SGST: Number(l.IT_SGST_A || 0),
        CGST: Number(l.IT_CGST_A || 0), IGST: Number(l.IT_IGST_A || 0),
        NET_AMT: Number(l.IT_TAXABLE || 0) + Number(l.IT_GST_AMT || 0),
        QTY: Number(l.IT_QTY || 0), PCS: Number(l.IT_PCS || 0), KGS: Number(l.IT_KGS || 0),
      });
    }
  }
  return out;
}

async function run(companyId, p = {}, deps = {}) {
  const wanted = p.sheets?.length ? p.sheets : SHEETS;
  const bad = wanted.filter((s) => UNAVAILABLE.includes(s));
  if (bad.length) {
    const err = new Error(`${bad.join(', ')}: JV RCM & JV ITC heads (T_JV_GST) are not recorded in MERN`);
    err.status = 400;
    throw err;
  }

  const [sales, purchases, slRtn, puRtn, mill, job] = await Promise.all([
    deps.sales || src.loadSalesRegisterRows(companyId),
    deps.purchases || src.loadPurchaseRegisterRows(companyId),
    deps.salesRtn || src.loadReturnRegisterRows(companyId, 'Sales'),
    deps.purchaseRtn || src.loadReturnRegisterRows(companyId, 'Purchase'),
    deps.mill || mrSrc.loadMillReceiptRows(companyId),
    deps.job || mrSrc.loadJobReceiptRows(companyId),
  ]);
  const w = (xs) => inDateRange(xs, 'BILL_DATE', p.from, p.to);
  const sl = w(sales);
  const pu = w(purchases);
  const sr = w(slRtn);
  const pr = w(puRtn);
  const ml = w(mill);
  const jb = w(job);

  const monthSum = (xs, typeLabel) => orderRows(
    groupBy(xs.map((r) => ({ ...r, ...monthOf(r), BOOK: r.BOOK || typeLabel })), ['YEAR_NO', 'MONTH_NO', 'MONTH_NAME', 'BOOK'], {
      sum: ['TAXABLE_AMT', 'SGST_AMT', 'CGST_AMT', 'IGST_AMT', 'NET_TOT'],
    }).map((r) => ({
      TYPE: typeLabel, BOOK: r.BOOK, MONTH_NAME: r.MONTH_NAME,
      TAXABLE: round(r.TAXABLE_AMT), SGST: round(r.SGST_AMT), CGST: round(r.CGST_AMT), IGST: round(r.IGST_AMT), NET_AMT: round(r.NET_TOT),
      YEAR_NO: r.YEAR_NO, MONTH_NO: r.MONTH_NO,
    })),
    [{ field: 'YEAR_NO', numeric: true }, { field: 'MONTH_NO', numeric: true }, 'BOOK'],
  );

  const hsnSum = (lines) => orderRows(
    groupBy(lines, ['TYPE', 'HSN_CODE'], { sum: ['TAXABLE', 'SGST', 'CGST', 'IGST', 'NET_AMT', 'QTY', 'PCS', 'KGS'] })
      .map((r) => ({ ...r, TAXABLE: round(r.TAXABLE), SGST: round(r.SGST), CGST: round(r.CGST), IGST: round(r.IGST), NET_AMT: round(r.NET_AMT), QTY: round(r.QTY), KGS: round(r.KGS) })),
    ['TYPE', 'HSN_CODE'],
  );

  const rateSum = (lines) => orderRows(
    groupBy(lines, ['TYPE', 'TOT_GST_P'], { sum: ['TAXABLE', 'SGST', 'CGST', 'IGST', 'NET_AMT', 'QTY', 'PCS', 'KGS'] })
      .map((r) => ({ ...r, TAXABLE: round(r.TAXABLE), SGST: round(r.SGST), CGST: round(r.CGST), IGST: round(r.IGST), NET_AMT: round(r.NET_AMT), QTY: round(r.QTY), KGS: round(r.KGS) })),
    ['TYPE', { field: 'TOT_GST_P', numeric: true }],
  );

  const slReg = sl.filter((b) => String(b.GSTIN_NO || '').trim());
  const slB2c = sl.filter((b) => !String(b.GSTIN_NO || '').trim());

  const bySheet = {
    SalesMonth: [
      ...monthSum(slReg, 'SALES B2B'),
      ...monthSum(slB2c, 'SALES B2C'),
      ...monthSum(sr.filter((b) => String(b.GSTIN_NO || '').trim()), 'SALES RTN B2B'),
      ...monthSum(sr.filter((b) => !String(b.GSTIN_NO || '').trim()), 'SALES RTN B2C'),
    ],
    SalesHsn: [
      ...hsnSum(toLines(sl, 'SALES HSN')),
      ...hsnSum(toLines(sr, 'SALES RTN HSN')),
    ],
    SalesTaxrate: [
      ...rateSum(toLines(sl, 'SALES TAX.RATE')),
      ...rateSum(toLines(sr, 'SALES RTN TAX.RATE')),
    ],
    PurchaseMonth: [
      ...monthSum(pu.filter(hasGst), 'PURCHASE'),
      ...monthSum(pr.filter(hasGst), 'PURCHASE RTN'),
      ...monthSum(ml.filter(hasGst), 'MILL'),
      ...monthSum(jb.filter(hasGst), 'JOBWORK'),
    ],
    PurchaseHsn: [
      ...hsnSum(toLines(pu, 'PURCHASE HSN')),
      ...hsnSum(toLines(pr, 'PURCHASE RTN HSN')),
    ],
    InputTaxrate: [
      ...rateSum(toLines(pu, 'PURCHASE TAX.RATE')),
      ...rateSum(toLines(pr, 'PURCHASE RTN TAX.RATE')),
    ],
    Exporter: monthSum(sl.filter((b) => String(b.TYPE || '').toUpperCase().includes('EXP')), 'SALES EXPORTER'),
    PartyGstRt: orderRows(
      groupBy(
        pu.flatMap((b) => (b._lines || []).map((l) => ({
          GSTIN_NO: b.GSTIN_NO || '',
          PARTY: b.PARTY || '',
          TOT_GST_P: round(l.IT_GST_PER || 0),
          TAXABLE: Number(l.IT_TAXABLE || 0),
          IGST: Number(l.IT_IGST_A || 0),
          CGST: Number(l.IT_CGST_A || 0),
          SGST: Number(l.IT_SGST_A || 0),
        }))),
        ['GSTIN_NO', 'TOT_GST_P'],
        { sum: ['TAXABLE', 'IGST', 'CGST', 'SGST'] },
        (f) => ({ PARTY: f.PARTY }),
      ).map((r) => ({ ...r, TAXABLE: round(r.TAXABLE), IGST: round(r.IGST), CGST: round(r.CGST), SGST: round(r.SGST) })),
      ['GSTIN_NO', { field: 'TOT_GST_P', numeric: true }],
    ),
  };

  const rows = [];
  for (const s of wanted) {
    for (const r of bySheet[s] || []) rows.push({ SHEET: s, ...r });
  }

  return {
    rows,
    grid: {
      layout: 'JSM_VW_GSTR9_NEW', variant: 1,
      groupColumns: ['SHEET'], groupDisplays: ['SHEET'], captions: {},
      title: 'Gstr-9 & 9C New Working Sheets',
      period: `DATE : FROM ${p.fromText || p.from || ''} TO ${p.toText || p.to || ''}`,
      pageWise: false,
      notice: `Skipped (not in MERN): ${UNAVAILABLE.join(', ')} (JV RCM/ITC journal heads)`,
    },
  };
}

async function options() { return { sheets: SHEETS, unavailable: UNAVAILABLE }; }

module.exports = { run, options, SHEETS, UNAVAILABLE };

