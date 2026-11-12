'use strict';

/**
 * JSM: Others Reports > Old Reports > Extra Reports > Import Sales (Frm_Import_SalesJsm)
 * Compares uploaded external Sales rows (`importRows`) against MERN `Sales` register by bill no.
 */
const { orderRows, inDateRange, round } = require('../jcEngine');
const billSrc = require('../sources/billRegister');

const norm = (v) => String(v ?? '').trim().toUpperCase();
const eqAmt = (a, b) => Math.abs(round(a) - round(b)) <= 0.5;

async function run(companyId, p = {}, deps = {}) {
  const sales = inDateRange(deps.sales || await billSrc.loadSalesRegisterRows(companyId), 'BILL_DATE', p.from, p.to);
  const imported = Array.isArray(p.importRows) ? p.importRows : [];

  const byBill = new Map(sales.map((s) => [norm(s.NCBILL_NO), s]));
  const matched = new Set();
  const rows = [];

  for (const ext of imported) {
    const billNo = norm(ext.NCBILL_NO || ext.billNo);
    const local = byBill.get(billNo);
    if (local) matched.add(billNo);
    const gstOk = local ? norm(ext.GST_NO || ext.gstin) === norm(local.GSTIN_NO) : false;
    const taxOk = local ? eqAmt(ext.TAXABLE_AMT ?? ext.taxable, local.TAXABLE_AMT) : false;
    const netOk = local ? eqAmt(ext.NET_TOT ?? ext.netAmount, local.NET_TOT) : false;

    rows.push({
      SRC_BILLNO: ext.NCBILL_NO || ext.billNo || '',
      JSM_BILLNO: local ? local.NCBILL_NO : '',
      BILLNO_MATCHING: local ? 'MATCH' : 'NOT MATCH',
      SRC_GST: ext.GST_NO || ext.gstin || '',
      JSM_GST: local ? local.GSTIN_NO : '',
      GSTNO_MATCHING: gstOk ? 'MATCH' : 'NOT MATCH',
      SRC_TAXABLE: round(ext.TAXABLE_AMT ?? ext.taxable ?? 0),
      JSM_TAXABLE: local ? round(local.TAXABLE_AMT) : 0,
      TAXABLE_MATCHING: taxOk ? 'MATCH' : 'NOT MATCH',
      SRC_NET: round(ext.NET_TOT ?? ext.netAmount ?? 0),
      JSM_NET: local ? round(local.NET_TOT) : 0,
      NETTOT_MATCHING: netOk ? 'MATCH' : 'NOT MATCH',
    });
  }

  for (const s of sales) {
    if (matched.has(norm(s.NCBILL_NO))) continue;
    rows.push({
      SRC_BILLNO: '',
      JSM_BILLNO: s.NCBILL_NO,
      BILLNO_MATCHING: imported.length ? 'NOT IN IMPORT' : 'BOOKS ONLY',
      SRC_GST: '',
      JSM_GST: s.GSTIN_NO || '',
      GSTNO_MATCHING: imported.length ? 'NOT MATCH' : '-',
      SRC_TAXABLE: 0,
      JSM_TAXABLE: round(s.TAXABLE_AMT),
      TAXABLE_MATCHING: imported.length ? 'NOT MATCH' : '-',
      SRC_NET: 0,
      JSM_NET: round(s.NET_TOT),
      NETTOT_MATCHING: imported.length ? 'NOT MATCH' : '-',
    });
  }

  return {
    rows: orderRows(rows, ['BILLNO_MATCHING', 'JSM_BILLNO', 'SRC_BILLNO']),
    grid: {
      layout: 'JSM_VW_IMPORT_SALES_MATCH',
      variant: 1,
      groupColumns: [],
      groupDisplays: [],
      captions: {},
      title: 'Import Sales Reconciliation (External vs Books)',
      period: `DATE : FROM ${p.fromText || p.from || ''}  TO  ${p.toText || p.to || ''}`,
      pageWise: false,
      notice: imported.length ? '' : 'No external sales file uploaded yet — showing current period Sales. Click Browse to upload JSON/Excel to compare.',
    },
  };
}

module.exports = { run, options: async () => ({}) };

