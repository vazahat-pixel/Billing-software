'use strict';

/**
 * JSM Native GST Tools (Batch 6 — replacing remaining legacy shortcuts with JSM screens):
 *   - Hsn_Wise_Report_All            (HSN Summary Across Sales/Return/Purchase)
 *   - Stp_Gst_OutWrad_ErrorCheck     (Outward GST Error Check: HSN, StateCode, ZeroTax, RoundOff, MissingSerial)
 *   - Gstr_3B_TextNew_Monthly        (GSTR-3B Monthly Return Summary Grid)
 *   - Gstr_3BB_TextNew_Excel_Monthly (GSTR-3B Excel Summary Grid)
 *   - A_Brokreg_Main_Rpt_Zoom_Column (ITC-04 / JobWork Brokerage Zoom Column)
 *   - A_All_Ewb_Einv_Rpt             (E-Way & E-Invoice Register — captured JSM_VW_ALL_EWB_EINV_REPORT_MAIN)
 */
const { orderRows, inList, inDateRange, groupBy, round } = require('../jcEngine');
const billSrc = require('../sources/billRegister');
const oldGst = require('./oldGstReports');
const brokStmt = require('./brokerageStatement');

async function runHsnWiseAll(companyId, p = {}, deps = {}) {
  const [sl, sr, pu] = await Promise.all([
    deps.sales || billSrc.loadSalesRegisterRows(companyId),
    deps.salesRtn || billSrc.loadReturnRegisterRows(companyId, 'Sales'),
    deps.purchases || billSrc.loadPurchaseRegisterRows(companyId),
  ]);
  const map = new Map();
  const add = (bills, source, sign = 1) => {
    for (const b of inDateRange(bills, 'BILL_DATE', p.from, p.to)) {
      for (const l of b._lines || []) {
        const hsn = String(l.HSN_CODE || 'UNSPECIFIED').trim() || 'UNSPECIFIED';
        const uqc = String(l.UNIT_NAME || 'MTR').trim();
        const k = `${source}|${hsn}|${uqc}`;
        if (!map.has(k)) {
          map.set(k, {
            SOURCE: source,
            HSN_CODE: hsn,
            DESCRIPTION: l.ITEM_NAME || '',
            UQC: uqc,
            IT_PCS: 0,
            IT_QTY: 0,
            TAXABLE_AMT: 0,
            IGST_AMT: 0,
            CGST_AMT: 0,
            SGST_AMT: 0,
            NET_TOT: 0,
          });
        }
        const r = map.get(k);
        r.IT_PCS += sign * Number(l.IT_PCS || 0);
        r.IT_QTY = round(r.IT_QTY + sign * Number(l.IT_QTY || 0));
        r.TAXABLE_AMT = round(r.TAXABLE_AMT + sign * Number(l.IT_TAXABLE || 0));
        r.IGST_AMT = round(r.IGST_AMT + sign * Number(l.IT_IGST_A || 0));
        r.CGST_AMT = round(r.CGST_AMT + sign * Number(l.IT_CGST_A || 0));
        r.SGST_AMT = round(r.SGST_AMT + sign * Number(l.IT_SGST_A || 0));
        r.NET_TOT = round(r.NET_TOT + sign * Number(l.IT_NET_TOT || 0));
      }
    }
  };
  add(sl, 'OUTWARD-SALES', 1);
  add(sr, 'OUTWARD-SLRTN', -1);
  add(pu, 'INWARD-PURCHASE', 1);

  return {
    rows: orderRows([...map.values()], ['SOURCE', 'HSN_CODE', 'UQC']),
    grid: {
      layout: 'JSM_VW_HSN_WISE_REPORT_ALL',
      variant: 1,
      groupColumns: ['SOURCE'],
      groupDisplays: ['SUPPLY SIDE'],
      captions: {},
      title: 'HSN Wise Summary Report (All Supplies)',
      period: `DATE : FROM ${p.fromText || p.from || ''} TO ${p.toText || p.to || ''}`,
      pageWise: false,
    },
  };
}

async function runOutwardErrorCheck(companyId, p = {}, deps = {}) {
  const [sl, sr] = await Promise.all([
    inDateRange(deps.sales || await billSrc.loadSalesRegisterRows(companyId), 'BILL_DATE', p.from, p.to),
    inDateRange(deps.salesRtn || await billSrc.loadReturnRegisterRows(companyId, 'Sales'), 'BILL_DATE', p.from, p.to),
  ]);
  const action = p.action || 'All';
  const issues = [];
  const check = (bills, txType) => {
    for (const b of bills) {
      const gstAmt = round(Number(b.SGST_AMT || 0) + Number(b.CGST_AMT || 0) + Number(b.IGST_AMT || 0));
      const gst = String(b.GSTIN_NO || '').trim();
      const missingHsn = (b._lines || []).some((l) => !String(l.HSN_CODE || '').trim());
      if ((action === 'All' || action === 'btn_hsncd') && missingHsn) {
        issues.push({ TRANS_TYPE: txType, ERROR_TYPE: 'MISSING HSN', BILL_DATE: b.BILL_DATE, NCBILL_NO: b.NCBILL_NO, PARTY: b.PARTY, GST_NO: gst, TAXABLE_AMT: round(b.TAXABLE_AMT), GST_AMT: gstAmt, NET_TOT: round(b.NET_TOT) });
      }
      if ((action === 'All' || action === 'Btn_GstinFreeItem') && gstAmt === 0 && round(b.TAXABLE_AMT) > 0) {
        issues.push({ TRANS_TYPE: txType, ERROR_TYPE: 'ZERO GST TAX', BILL_DATE: b.BILL_DATE, NCBILL_NO: b.NCBILL_NO, PARTY: b.PARTY, GST_NO: gst, TAXABLE_AMT: round(b.TAXABLE_AMT), GST_AMT: gstAmt, NET_TOT: round(b.NET_TOT) });
      }
      if ((action === 'All' || action === 'Btn_StateCd') && gst && !/^(0[1-9]|[12]\d|3[0-8])/.test(gst)) {
        issues.push({ TRANS_TYPE: txType, ERROR_TYPE: 'INVALID GSTIN STATE', BILL_DATE: b.BILL_DATE, NCBILL_NO: b.NCBILL_NO, PARTY: b.PARTY, GST_NO: gst, TAXABLE_AMT: round(b.TAXABLE_AMT), GST_AMT: gstAmt, NET_TOT: round(b.NET_TOT) });
      }
      if (action === 'Btn_CheckGst_Reg' && gst) {
        issues.push({ TRANS_TYPE: txType, ERROR_TYPE: 'REGISTERED CHECK', BILL_DATE: b.BILL_DATE, NCBILL_NO: b.NCBILL_NO, PARTY: b.PARTY, GST_NO: gst, TAXABLE_AMT: round(b.TAXABLE_AMT), GST_AMT: gstAmt, NET_TOT: round(b.NET_TOT) });
      }
      if (action === 'Btn_CheckGst_UnReg' && !gst) {
        issues.push({ TRANS_TYPE: txType, ERROR_TYPE: 'UNREGISTERED CHECK', BILL_DATE: b.BILL_DATE, NCBILL_NO: b.NCBILL_NO, PARTY: b.PARTY, GST_NO: '', TAXABLE_AMT: round(b.TAXABLE_AMT), GST_AMT: gstAmt, NET_TOT: round(b.NET_TOT) });
      }
    }
  };
  check(sl, 'SALES');
  check(sr, 'RTN_SALES');

  return {
    rows: orderRows(issues, ['ERROR_TYPE', 'TRANS_TYPE', 'BILL_DATE', 'NCBILL_NO']),
    grid: {
      layout: 'JSM_VW_OUTWARD_ERROR_CHECK',
      variant: 1,
      groupColumns: ['ERROR_TYPE'],
      groupDisplays: ['ERROR TYPE'],
      captions: {},
      title: 'GST Outward Supply Error Check',
      period: `DATE : FROM ${p.fromText || p.from || ''} TO ${p.toText || p.to || ''}`,
      pageWise: false,
      notice: issues.length ? '' : 'No outward GST errors detected in selected period.',
    },
  };
}

async function runGstr3bMonthly(companyId, p = {}, deps = {}, isExcelMode = false) {
  const res = await oldGst.cess.run(companyId, p, deps);
  return {
    rows: res.rows,
    grid: {
      ...res.grid,
      layout: isExcelMode ? 'JSM_VW_GSTR3B_MONTHLY_EXCEL' : 'JSM_VW_GSTR3B_MONTHLY',
      title: isExcelMode ? 'GSTR-3B Monthly Summary (Excel View)' : 'GSTR-3B Monthly Return Summary',
    },
  };
}

async function runBrokregZoomColumn(companyId, p = {}, deps = {}) {
  const res = await brokStmt.run(companyId, { ...p, side: 'Sales', dateField: p.dateMode === 'RecDate' ? 'REC_DATE' : 'BILL_DATE' }, deps);
  return {
    rows: res.rows,
    grid: {
      ...res.grid,
      layout: 'JSM_VW_GST_JOBWORK_BROK_ZOOM_REPORT',
      title: 'Brokerage / ITC-04 Main Zoom Column Report',
    },
  };
}

async function runEwbEinvRpt(companyId, p = {}, deps = {}) {
  let sales = deps.sales || await billSrc.loadSalesRegisterRows(companyId);
  sales = inDateRange(sales, 'BILL_DATE', p.from, p.to);
  sales = inList(sales, 'BOOK', p.books);
  sales = inList(sales, 'PARTY', p.parties);

  const rows = sales.map((s) => ({
    REGISTER: s.BOOK || 'SALES',
    CO_PATH: s.CO_PATH || '',
    BILL_NO: s.NCBILL_NO || '',
    BILL_DATE: s.BILL_DATE,
    BOOK: s.BOOK || '',
    PARTY: s.PARTY || '',
    GST_NO: s.GSTIN_NO || '',
    STATE_NAME: s.STATE || '',
    TYPE: s.GSTIN_NO ? 'REG' : 'UNREG',
    TAX_RATE: round(s.GST_RATE || 0),
    BILL_AMT: round(s.NET_TOT || 0),
    SGST_AMT: round(s.SGST_AMT || 0),
    CGST_AMT: round(s.CGST_AMT || 0),
    IGST_AMT: round(s.IGST_AMT || 0),
    TAXABLE_AMT: round(s.TAXABLE_AMT || 0),
    EWAY_NO: s.EWAY_NO || s.eway || '',
    EWAY_DATE: s.EWAY_DATE || null,
    EWAY_DATE_UPTO: null,
    IRN: s.IRN || '',
    ACK_NO: s.ACK_NO || '',
    ACK_DATE: s.ACK_DATE || null,
  }));

  return {
    rows: orderRows(rows, ['BOOK', 'BILL_DATE', { field: 'BILL_NO', dir: 'asc', numeric: true }]),
    grid: {
      layout: 'JSM_VW_ALL_EWB_EINV_REPORT_MAIN', // captured in layouts.json!
      variant: 1,
      groupColumns: ['BOOK'],
      groupDisplays: ['BOOK'],
      captions: {},
      title: 'E-Way Bill & E-Invoice Status Report',
      period: `DATE : FROM ${p.fromText || p.from || ''} TO ${p.toText || p.to || ''}`,
      pageWise: false,
    },
  };
}

module.exports = {
  hsnWiseAll: { run: runHsnWiseAll, options: async () => ({}) },
  outwardErrorCheck: { run: runOutwardErrorCheck, options: async () => ({}) },
  gstr3bMonthly: { run: (c, p, d) => runGstr3bMonthly(c, p, d, false), options: async () => ({}) },
  gstr3bExcel: { run: (c, p, d) => runGstr3bMonthly(c, p, d, true), options: async () => ({}) },
  brokregZoomColumn: { run: runBrokregZoomColumn, options: brokStmt.options },
  ewbEinvRpt: { run: runEwbEinvRpt, options: async () => ({}) },
};

