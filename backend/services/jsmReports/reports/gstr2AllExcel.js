'use strict';

/**
 * JSM: Reports › Gst Reports › Gstr-2 Report › Gstr2 Excel Format (Rpt_Jsm_GSTR2_AllExcel).
 * LoadData lists the period's purchases under JSM's seven grids (B2B, B2BUR, CDNR, CDNUR, EXEMP, HSN, RETURN),
 * one row per bill and GST rate, the way JSM's GSTR-2 offline workbook takes them. B2B is the bills whose supplier
 * has a GSTIN, B2BUR the rest; CDNR / CDNUR are the purchase returns split the same way; RETURN is the month totals.
 */
const { inDateRange, round } = require('../jcEngine');
const billSrc = require('../sources/billRegister');

const state = (b) => String(b.STATE || '');
const dateOf = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');
const hasGstin = (b) => String(b.GSTIN_NO || '').trim().length === 15;

/** One row per bill and rate, the amounts split over its lines. */
function byRate(bill) {
  const rates = new Map();
  for (const l of bill._lines || []) {
    const r = round(Number(l.IT_GST_PER || 0));
    const t = rates.get(r) || { rate: r, taxable: 0, igst: 0, cgst: 0, sgst: 0 };
    t.taxable += Number(l.IT_TAXABLE || 0);
    t.igst += Number(l.IT_IGST_A || 0);
    t.cgst += Number(l.IT_CGST_A || 0);
    t.sgst += Number(l.IT_SGST_A || 0);
    rates.set(r, t);
  }
  if (!rates.size) rates.set(0, { rate: 0, taxable: Number(bill.TAXABLE_AMT || 0), igst: bill.IGST_AMT, cgst: bill.CGST_AMT, sgst: bill.SGST_AMT });
  return [...rates.values()].map((t) => ({ ...t, taxable: round(t.taxable), igst: round(t.igst), cgst: round(t.cgst), sgst: round(t.sgst) }));
}

const invoiceRows = (bills, registered) => bills.filter((b) => hasGstin(b) === registered).flatMap((b) => byRate(b).map((t) => ({
  GSTIN_NO: b.GSTIN_NO,
  PARTY: b.PARTY,
  NCBILL_NO: b.NCBILL_NO,
  BILL_DATE: dateOf(b.BILL_DATE),
  INV_AMT: round(b.NET_TOT),
  STATE_NAME: state(b),
  RVRS_CHRG_YN: 'N',
  INV_TYPE: 'Regular',
  SUPPLY_TYPE: t.igst > 0 ? 'Inter State' : 'Intra State',
  TAX_RATE: t.rate,
  TAXABLE_AMT: t.taxable,
  IGST_AMT: t.igst,
  CGST_AMT: t.cgst,
  SGST_AMT: t.sgst,
  CESS: 0,
  E_ITC: 'Inputs',
})));

const noteRows = (bills, registered) => bills.filter((b) => hasGstin(b) === registered).flatMap((b) => byRate(b).map((t) => ({
  GSTIN_NO: b.GSTIN_NO,
  PARTY: b.PARTY,
  NOTE_NO: b.NCBILL_NO,
  NOTE_DATE: dateOf(b.BILL_DATE),
  NOTE_TYPE: 'Debit',
  STATE_NAME: state(b),
  TAX_RATE: t.rate,
  TAXABLE_AMT: t.taxable,
  IGST_AMT: t.igst,
  CGST_AMT: t.cgst,
  SGST_AMT: t.sgst,
  CESS: 0,
  NET_TOT: round(b.NET_TOT),
})));

async function run(companyId, p = {}, deps = {}) {
  if (!p.from || !p.to) throw Object.assign(new Error('From and To dates are required'), { status: 400 });
  const purchases = inDateRange(deps.purchases || await billSrc.loadPurchaseRegisterRows(companyId), 'BILL_DATE', p.from, p.to);
  const returns = inDateRange(deps.purchaseRtn || await billSrc.loadReturnRegisterRows(companyId, 'Purchase'), 'BILL_DATE', p.from, p.to);

  const hsn = new Map();
  const exempt = { 'Inter-State supplies': 0, 'Intra-State supplies': 0 };
  for (const b of purchases) {
    for (const l of b._lines || []) {
      const key = `${l.HSN_CODE || ''}|${l.UNIT_NAME || ''}|${round(Number(l.IT_GST_PER || 0))}`;
      const t = hsn.get(key) || {
        HSN_CODE: l.HSN_CODE || '', UNIT_NAME: l.UNIT_NAME || '', TAX_RATE: round(Number(l.IT_GST_PER || 0)), IT_QTY: 0, VALUE: 0, TAXABLE_AMT: 0, IGST_AMT: 0, CGST_AMT: 0, SGST_AMT: 0,
      };
      t.IT_QTY += Number(l.IT_QTY || 0);
      t.TAXABLE_AMT += Number(l.IT_TAXABLE || 0);
      t.IGST_AMT += Number(l.IT_IGST_A || 0);
      t.CGST_AMT += Number(l.IT_CGST_A || 0);
      t.SGST_AMT += Number(l.IT_SGST_A || 0);
      t.VALUE += Number(l.IT_TAXABLE || 0) + Number(l.IT_GST_AMT || 0);
      hsn.set(key, t);
      if (!Number(l.IT_GST_PER || 0)) exempt[Number(b.IGST_AMT || 0) > 0 ? 'Inter-State supplies' : 'Intra-State supplies'] += Number(l.IT_TAXABLE || 0);
    }
  }
  const months = new Map();
  for (const b of purchases) {
    const k = `${b.YEAR_NO}-${String(b.MONTH_NO).padStart(2, '0')}`;
    const t = months.get(k) || { MONTH: b.MONTH, YEAR_NO: b.YEAR_NO, BILLS: 0, TAXABLE_AMT: 0, IGST_AMT: 0, CGST_AMT: 0, SGST_AMT: 0, NET_TOT: 0 };
    t.BILLS += 1;
    t.TAXABLE_AMT += Number(b.TAXABLE_AMT || 0);
    t.IGST_AMT += Number(b.IGST_AMT || 0);
    t.CGST_AMT += Number(b.CGST_AMT || 0);
    t.SGST_AMT += Number(b.SGST_AMT || 0);
    t.NET_TOT += Number(b.NET_TOT || 0);
    months.set(k, t);
  }
  const fix = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, typeof v === 'number' ? round(v) : v]));

  return {
    rows: [],
    sheets: {
      B2B: invoiceRows(purchases, true),
      B2BUR: invoiceRows(purchases, false),
      CDNR: noteRows(returns, true),
      CDNUR: noteRows(returns, false),
      EXEMP: Object.entries(exempt).map(([DESCRIPTION, NIL_RATED]) => ({ DESCRIPTION, NIL_RATED: round(NIL_RATED), EXEMPTED: 0, NON_GST: 0 })),
      HSN: [...hsn.values()].map(fix),
      RETURN: [...months.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => fix(v)),
    },
    grid: { layout: 'GSTR2_EXCEL', variant: 1, groupColumns: [], groupDisplays: [], captions: {}, title: 'GSTR-2', period: `DATE : FROM ${p.fromText || p.from} TO ${p.toText || p.to}`, pageWise: false },
  };
}

module.exports = { run, options: async () => ({}) };
