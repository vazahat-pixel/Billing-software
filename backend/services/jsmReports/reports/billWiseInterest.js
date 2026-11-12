'use strict';

/**
 * JSM Bill-Wise Interest family (from decompiled Rpt_Sales_Interest, New_Rpt_Sales_Intrest_ZoomIn_New,
 * New_Rpt_Sales_Intrest_ZoomIn):
 *   - Rpt_Sales_Interest                         (Reports › Sales › Sales Bill › Interest Bill Wise (Old))
 *   - New_Rpt_Sales_Intrest_ZoomIn_New_Sales     (Reports › Sales › Sales Bill › Interest Bill Wise New)
 *   - New_Rpt_Sales_Intrest_ZoomIn_New_Purchase  (Reports › Purchase › Purchase Bill › Purchase Bill Wise Interest)
 *   - New_Rpt_Sales_Intrest_ZoomIn               (Reports › Process Reports › Process Bill Wise Interest)
 *
 * Formula matches JSM SQL verbatim:
 *   OS_DAYS  = DATEDIFF(day, BILL_DATE, (status === 'Clear' && R_DATE) ? R_DATE : tillDate)
 *   INT_DAYS = Math.max(0, OS_DAYS - graceDays)
 *   INT_AMT  = round(BASE_AMT * rate / 100 / yearDays * INT_DAYS)
 *   FNL_AMT  = round(NET_TOT + INT_AMT - PAID_INT)
 * PAID_INT comes from PaymentVoucher.againstInvoices.interest (JSM B.AMT_4).
 */
const { loadOutstandingRows } = require('../sources/outstanding');
const { loadSalesRegisterRows, loadPurchaseRegisterRows } = require('../sources/billRegister');
const { loadMillReceiptRows } = require('../sources/millReceipt');
const { orderRows, inList, inDateRange, round } = require('../jcEngine');

function diffDays(fromDate, toDate) {
  if (!fromDate || !toDate) return 0;
  const a = new Date(fromDate);
  const b = new Date(toDate);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 0;
  return Math.max(0, Math.round((Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate())
    - Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate())) / 86400000));
}

async function paidInterestByBill(companyId) {
  const PaymentVoucher = require('../../../models/PaymentVoucher');
  const vouchers = await PaymentVoucher.find({ companyId, status: 'Posted' })
    .select('date againstInvoices')
    .lean();
  const byKey = new Map();
  for (const v of vouchers) {
    for (const a of v.againstInvoices || []) {
      const k = `${String(a.invoiceNo || '').trim()}`;
      const prev = byKey.get(k) || { paidInt: 0, recDate: v.date };
      byKey.set(k, {
        paidInt: round(prev.paidInt + Number(a.interest || 0)),
        recDate: (!prev.recDate || (v.date && new Date(v.date) > new Date(prev.recDate))) ? v.date : prev.recDate,
      });
    }
  }
  return byKey;
}

function buildInterestReport(spec) {
  async function run(companyId, p = {}, deps = {}) {
    const rate = Number(p.rate ?? 0) || 0;
    const graceDays = Number(p.graceDays ?? 0) || 0;
    const yearDays = Number(p.yearDays ?? spec.defaultYearDays ?? 365) || 365;
    const tillDate = p.tillDate || p.to || new Date().toISOString().slice(0, 10);
    const onAmt = String(p.onAmt || 'TaxableAmt').toLowerCase().includes('bill') ? 'BillAmt' : 'TaxableAmt';
    const rawStatus = String(p.status || 'Pending');
    const osStatus = rawStatus.includes('Clear') ? 'Paid' : (rawStatus.includes('All') ? 'All' : 'Pending');

    let bills = deps.rows;
    if (!bills) {
      const [osRows, regRows, intMap] = await Promise.all([
        loadOutstandingRows(companyId, spec.kind, {
          asOn: tillDate,
          status: osStatus,
          includeLastYear: p.withLastYear !== false,
        }),
        spec.loadRegister(companyId),
        paidInterestByBill(companyId),
      ]);
      const taxOf = new Map();
      for (const r of regRows) {
        taxOf.set(`${String(r.NCBILL_NO || '').trim()}|${String(r.PARTY || '').trim()}`, Number(r.TAXABLE_AMT ?? r.NET_TOT ?? 0));
      }
      bills = osRows.map((o) => {
        const key = `${String(o.NCBILL_NO || '').trim()}|${String(o.PARTY || '').trim()}`;
        const tax = taxOf.get(key) ?? Number(o.TAXABLE_AMT ?? o.NET_TOT ?? 0);
        const pv = intMap.get(String(o.NCBILL_NO || '').trim()) || {};
        return {
          ...o,
          TAXABLE_AMT: tax,
          R_AMT: Number(o.ADJUST || 0),
          R_DATE: o.PAID_DATE || pv.recDate || null,
          PAID_INT: Number(o.PAID_INT ?? pv.paidInt ?? 0),
        };
      });
    }

    if (p.from || p.to) bills = inDateRange(bills, 'BILL_DATE', p.from, p.to);
    bills = inList(bills, 'PARTY', p.parties);
    if (p.onlyUnPaidBill) bills = bills.filter((r) => Number(r.R_AMT ?? r.ADJUST ?? 0) === 0);

    const out = bills.map((r) => {
      const recDate = r.R_DATE || r.REC_DATE || r.PAID_DATE || null;
      const endDate = rawStatus.includes('Clear') && recDate ? recDate : tillDate;
      const osDays = r.OS_DAYS != null && deps.rows ? Number(r.OS_DAYS) : diffDays(r.BILL_DATE, endDate);
      const intDays = Math.max(0, osDays - graceDays);
      const taxableAmt = round(r.TAXABLE_AMT ?? r.NET_TOT ?? 0);
      const netTot = round(r.NET_TOT ?? r.BILL_AMT ?? 0);
      const base = onAmt === 'BillAmt' ? netTot : taxableAmt;
      const intAmt = round((base * rate / 100 / yearDays) * intDays);
      const paidInt = round(r.PAID_INT || 0);
      return {
        TYPE: spec.typeCode,
        BILL_NO: r.NCBILL_NO || r.BILL_NO || '',
        NCBILL_NO: r.NCBILL_NO || r.BILL_NO || '',
        BILL_DATE: r.BILL_DATE,
        PARTY_NAME: r.PARTY || r.PARTY_NAME || r.PartyName || '',
        PartyName: r.PARTY || r.PARTY_NAME || r.PartyName || '',
        NET_TOT: netTot,
        TAXABLE_AMT: taxableAmt,
        R_DATE: recDate,
        R_AMT: round(r.R_AMT ?? r.ADJUST ?? 0),
        PAID_INT: paidInt,
        OS_DAYS: osDays,
        GRS_DAY: graceDays,
        INT_DAYS: intDays,
        INT_RATE: rate,
        INT_AMT: intAmt,
        FNL_AMT: round(netTot + intAmt - paidInt),
        _billId: r._billId,
      };
    });

    const orderField = p.orderBy1 === 'None' ? [] : [spec.partyField];
    return {
      rows: orderRows(out, [...orderField, 'BILL_DATE', { field: 'NCBILL_NO', dir: 'asc', numeric: true }]),
      grid: {
        layout: spec.layout,
        variant: 1,
        groupColumns: orderField,
        groupDisplays: orderField,
        primaryDetailColumn: '_billId',
        captions: {},
        title: `${spec.title} (${onAmt === 'BillAmt' ? 'On BillAmt' : 'On Taxable'})`,
        period: `DATE : FROM ${p.fromText || p.from || ''}  TO  ${p.toText || p.to || ''} | Till ${p.tillDateText || tillDate}`,
        pageWise: false,
      },
    };
  }

  async function options(companyId) {
    const rows = await loadOutstandingRows(companyId, spec.kind, {});
    return { parties: [...new Set(rows.map((r) => r.PARTY).filter(Boolean))].sort() };
  }

  return { run, options };
}

module.exports = {
  salesOld: buildInterestReport({
    kind: 'sales',
    typeCode: 'SL',
    layout: 'JSM_VW_INT_WISE_SALES_RPT',
    partyField: 'PartyName',
    defaultYearDays: 365,
    title: 'Sales Bill Wise Interest Report',
    loadRegister: (c) => loadSalesRegisterRows(c),
  }),
  salesNew: buildInterestReport({
    kind: 'sales',
    typeCode: 'SL',
    layout: 'JSM_VW_INT_WISE_SALES_RPT',
    partyField: 'PartyName',
    defaultYearDays: 365,
    title: 'PartyName Wise Sales Intrest Report',
    loadRegister: (c) => loadSalesRegisterRows(c),
  }),
  purchaseNew: buildInterestReport({
    kind: 'purchase',
    typeCode: 'PU',
    layout: 'JSM_VW_INT_WISE_SALES_RPT',
    partyField: 'PartyName',
    defaultYearDays: 365,
    title: 'PartyName Wise Purchase Intrest Report',
    loadRegister: (c) => loadPurchaseRegisterRows(c),
  }),
  processNew: buildInterestReport({
    kind: 'process',
    typeCode: 'JB',
    layout: 'RPT_BILLWISE_DETAIL',
    partyField: 'PartyName',
    defaultYearDays: 360,
    title: 'PartyName Wise Process Intrest Report',
    loadRegister: (c) => loadMillReceiptRows(c),
  }),
};
