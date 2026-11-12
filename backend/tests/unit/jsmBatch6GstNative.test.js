'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const reports = require('../../services/jsmReports');

const cid = '507f1f77bcf86cd799439011';

test('Batch 6 GSTIN Summary: Sales, Purchase, Process, JobWork, Journal, Expense', async () => {
  const sl = [{ BOOK: 'LOCAL', BILL_DATE: '2026-04-05', NCBILL_NO: '1', PARTY: 'P1', GSTIN_NO: '24A', STATE: 'GUJARAT', TAXABLE_AMT: 1000, SGST_AMT: 25, CGST_AMT: 25, IGST_AMT: 0, NET_TOT: 1050, TO_PCS: 10, TO_QTY: 100, GST_RATE: 5 }];
  const s1 = await reports.get('A_Gstr1_SalesInvoiceSummary').run(cid, { summary: false }, { sales: sl });
  assert.equal(s1.grid.layout, 'JSM_VW_GST_SALES_SUMMARY');
  assert.equal(s1.rows[0].TAXABLE_AMT, 1000);

  const sSum = await reports.get('A_Gstr1_SalesInvoiceSummary').run(cid, { summary: true }, { sales: sl });
  assert.equal(sSum.grid.layout, 'JSM_VW_GST_SALES_SMRY_GROUP');
  assert.equal(sSum.rows[0].ZGROUP, 'LOCAL');

  const p1 = await reports.get('A_Gstr2_PurchaseSummary').run(cid, { summary: false }, { purchases: sl });
  assert.equal(p1.grid.layout, 'JSM_VW_GST_PURCHASE_SUMMARY_REPORT');

  const proc = await reports.get('A_Gstr2_ProcessSummary').run(cid, {}, { receipts: [{ BILL_DATE: '2026-04-05', NCBILL_NO: '1', PARTY: 'MILL1', TO_REC_QTY: 50, SUB_TOT: 500, SGST_AMT: 12.5, CGST_AMT: 12.5, IGST_AMT: 0, NET_TOT: 525 }] });
  assert.equal(proc.grid.layout, 'JSM_VW_GST_PROC_DTL');

  const jw = await reports.get('A_Gstr2_JobWorkReceiptSummary').run(cid, { summary: true }, { receipts: [{ BILL_DATE: '2026-04-05', PARTY: 'JW1', TO_REC_QTY: 20, SUB_TOT: 200, SGST_AMT: 0, CGST_AMT: 0, IGST_AMT: 0, NET_TOT: 200 }] });
  assert.equal(jw.grid.layout, 'JSM_VW_GST_PROC_SMRY');

  const jv = await reports.get('Rpt_Journal_Details_Report').run(cid, {}, { rows: [{ BOOK: 'CREDIT NOTE', BILL_DATE: '2026-04-06', NCBILL_NO: 'CN-1', TAXABLE_AMT: 100, NET_TOT: 105 }] });
  assert.equal(jv.grid.layout, 'JSM_VW_JOURNAL_DETAILS_RPT');
});

test('Batch 6 Native GST Tools: HSN All, ErrorCheck, 3B Monthly/Excel, BrokZoom, EwbEinv', async () => {
  const sales = [{
    BOOK: 'SL', BILL_DATE: '2026-04-05', NCBILL_NO: '1', PARTY: 'P1', GSTIN_NO: '99BADGSTIN', TAXABLE_AMT: 1000, SGST_AMT: 0, CGST_AMT: 0, IGST_AMT: 0, NET_TOT: 1000,
    _lines: [{ ITEM_NAME: 'GREY', HSN_CODE: '', UNIT_NAME: 'MTR', IT_PCS: 5, IT_QTY: 100, IT_TAXABLE: 1000, IT_SGST_A: 0, IT_CGST_A: 0, IT_IGST_A: 0, IT_NET_TOT: 1000 }],
  }];
  const hsn = await reports.get('Hsn_Wise_Report_All').run(cid, {}, { sales, salesRtn: [], purchases: [] });
  assert.equal(hsn.grid.layout, 'JSM_VW_HSN_WISE_REPORT_ALL');
  assert.equal(hsn.rows[0].TAXABLE_AMT, 1000);

  const err = await reports.get('Stp_Gst_OutWrad_ErrorCheck').run(cid, {}, { sales, salesRtn: [] });
  assert.equal(err.grid.layout, 'JSM_VW_OUTWARD_ERROR_CHECK');
  assert.ok(err.rows.length >= 3); // missing HSN + zero GST + invalid state

  const g3b = await reports.get('Gstr_3B_TextNew_Monthly').run(cid, {}, { sales, purchases: [], salesRtn: [], purchaseRtn: [], notes: [] });
  assert.equal(g3b.grid.layout, 'JSM_VW_GSTR3B_MONTHLY');

  const g3bEx = await reports.get('Gstr_3BB_TextNew_Excel_Monthly').run(cid, {}, { sales, purchases: [], salesRtn: [], purchaseRtn: [], notes: [] });
  assert.equal(g3bEx.grid.layout, 'JSM_VW_GSTR3B_MONTHLY_EXCEL');

  const ewb = await reports.get('A_All_Ewb_Einv_Rpt').run(cid, {}, { sales });
  assert.equal(ewb.grid.layout, 'JSM_VW_ALL_EWB_EINV_REPORT_MAIN');
  assert.equal(ewb.rows[0].BILL_NO, '1');
});
