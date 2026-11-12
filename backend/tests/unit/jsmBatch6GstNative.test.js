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


test('Eway_Billing_Bulk: one row per item line in JSM column names, Check Error lists missing NIC values', async () => {
  const bills = [{
    _id: 'b1', invoiceNo: '12', date: new Date('2026-07-05'), bookId: 'x', __book: 'SALES', gstType: 'CGST+SGST', netAmount: 1050,
    transport: 'RAMESH TRANSPORT', lrNo: 'LR9', lrDate: new Date('2026-07-06'),
    __company: { legalName: 'ACME', gstin: '24AAAAA0000A1Z5', address: 'Ring Road', city: 'Surat', pincode: '395002', state: 'GUJARAT' },
    customerId: { name: 'BUYER', gstin: '27BBBBB0000B1Z5', address: 'Mumbai', city: 'Mumbai', pincode: '400001', state: 'MAHARASHTRA' },
    items: [{ itemId: { name: 'CLOTH', hsnCode: '5407', unit: 'MTRS' }, mts: 100, amount: 1000, gstPer: 5, gstAmt: 50 }],
  }];
  const rpt = require('../../services/jsmReports').get('Eway_Billing_Bulk');
  const out = await rpt.run('507f1f77bcf86cd799439011', { from: '2026-07-01', to: '2026-07-31', checkError: true }, { bills });
  assert.equal(out.rows.length, 1);
  const r = out.rows[0];
  assert.equal(r.DOC_NO, '12');
  assert.equal(r.DOC_DATE, '05/07/2026');
  assert.equal(r.FRM_ACT_STATE_CODE, 24);
  assert.equal(r.TO_ACT_STATE_CODE, 27);
  assert.equal(r.CGST_AMT, 25);
  assert.equal(r.SGST_AMT, 25);
  assert.equal(r.TOT_INV_VALUE, 1050);
  assert.equal(r.TRAN_NAME, 'RAMESH TRANSPORT');
  // no distance is recorded on a bill, so NIC would reject it
  assert.match(out.errors[0].ERROR, /DISTANCE/);
  const none = await rpt.run('507f1f77bcf86cd799439011', { from: '2026-08-01', to: '2026-08-31' }, { bills });
  assert.equal(none.rows.length, 0);
});

test('TDS book: summary groups by the Report Type, detail orders Month by year+month number', async () => {
  const rows = [
    { ENT_NO: 1, SRAL_NO: 1, ENT_DATE: new Date('2026-08-24'), YEAR_NO: 2026, MONTH_NO: 8, MONTH: 'August', TDSHEAD: '194C', PARTY: 'B', PANNO: 'AAACB1234C', AMOUNT: 28025, TDS_PER: 5, TDS_AMT: 1401, COMP_NON: 'COMP', COMPANY: 'X' },
    { ENT_NO: 2, SRAL_NO: 2, ENT_DATE: new Date('2026-07-22'), YEAR_NO: 2026, MONTH_NO: 7, MONTH: 'July', TDSHEAD: '194C', PARTY: 'A', PANNO: 'AAAPA1234C', AMOUNT: 1164, TDS_PER: 2, TDS_AMT: 23, COMP_NON: 'NON-COMP', COMPANY: 'X' },
    { ENT_NO: 3, SRAL_NO: 3, ENT_DATE: new Date('2026-07-30'), YEAR_NO: 2026, MONTH_NO: 7, MONTH: 'July', TDSHEAD: '194C', PARTY: 'A', PANNO: 'AAAPA1234C', AMOUNT: 1000, TDS_PER: 2, TDS_AMT: 20, COMP_NON: 'NON-COMP', COMPANY: 'X' },
  ];
  const rpt = require('../../services/jsmReports').get('Rpt_TdsReports');
  const det = await rpt.run('507f1f77bcf86cd799439011', { from: '2026-04-01', to: '2027-03-31', group: 'Month+TdsHead+Party' }, { rows });
  assert.deepEqual(det.rows.map((r) => r.MONTH), ['July', 'July', 'August']); // July before August, not A..Z
  assert.equal(det.grid.layout, 'JSM_VW_TDS_BOOK_DETAILREPORT');
  const sum = await rpt.run('507f1f77bcf86cd799439011', { from: '2026-04-01', to: '2027-03-31', group: 'Month+TdsHead+Party', summary: true }, { rows });
  assert.equal(sum.rows.length, 2);
  assert.equal(sum.rows[0].TDS_AMT, 43);
  assert.equal(sum.rows[0].AMOUNT, 2164);
  assert.equal(sum.grid.layout, 'JSM_VW_TDS_BOOK_SUMMARYREPORT');
  await assert.rejects(() => rpt.run('507f1f77bcf86cd799439011', { group: 'Nope' }, { rows }), /Unknown Report Type/);
});

test('TCS registers: summary sums per month/party; sales returns carry negative TCS', async () => {
  const rows = [
    { COMPANY: 'X', TCSHEAD: 'TCS', PARTY: 'P', PANNO: 'AAAPA1234C', YEAR_NO: 2026, MONTH_NO: 7, MONTH: 'July', TCS_PER: 0.1, TCS_AMT: 100, TAXABLE_AMT: 100000, NET_TOT: 105100, BILL_DATE: new Date('2026-07-05'), NCBILL_NO: '1', ENT_NO: 1, T_TDS_PER: 0, T_TDS_AMT: 0 },
    { COMPANY: 'X', TCSHEAD: 'TCS', PARTY: 'P', PANNO: 'AAAPA1234C', YEAR_NO: 2026, MONTH_NO: 7, MONTH: 'July', TCS_PER: 0.1, TCS_AMT: 50, TAXABLE_AMT: 50000, NET_TOT: 52550, BILL_DATE: new Date('2026-07-09'), NCBILL_NO: '2', ENT_NO: 2, T_TDS_PER: 0, T_TDS_AMT: 0 },
    { COMPANY: 'X', TCSHEAD: 'TCS', PARTY: 'P', PANNO: 'AAAPA1234C', YEAR_NO: 2026, MONTH_NO: 7, MONTH: 'July', TCS_PER: -0.1, TCS_AMT: -10, TAXABLE_AMT: -10000, NET_TOT: -10510, BILL_DATE: new Date('2026-07-12'), NCBILL_NO: 'R1', ENT_NO: 3, T_TDS_PER: 0, T_TDS_AMT: 0 },
  ];
  const rpt = require('../../services/jsmReports').get('Rpt_TcsSalesRegister');
  const det = await rpt.run('507f1f77bcf86cd799439011', { from: '2026-04-01', to: '2027-03-31' }, { rows });
  assert.equal(det.rows.length, 3);
  assert.equal(det.grid.layout, 'TCS_DETAILREPORT');
  const sum = await rpt.run('507f1f77bcf86cd799439011', { from: '2026-04-01', to: '2027-03-31', summary: true }, { rows });
  assert.equal(sum.rows.length, 2); // TCS_PER 0.1 and -0.1 are separate group keys, as in JSM's GROUP BY
  assert.equal(sum.rows.find((r) => r.TCS_PER === 0.1).TCS_AMT, 150);
});

test('Tcs Rec/Pay: opening from 1 April, TCS only on the part above 50 lakh, Pay looks at creditors', async () => {
  const v = (type, date, amt, name, debtor) => ({ REC_PAY: type, REC_DATE: new Date(date), REC_AMT: amt, AC_NAME: name, PAN_NO: 'AAAPA1234C', DEBTOR: debtor, CREDITOR: !debtor });
  const vouchers = [
    v('R', '2026-05-10', 4000000, 'BIG', true), // opening (before From, same year)
    v('R', '2026-03-10', 9000000, 'BIG', true), // last year: not counted
    v('R', '2026-08-05', 2000000, 'BIG', true), // current -> total 60L, 10L applicable
    v('R', '2026-08-06', 100000, 'SMALL', true),
    v('P', '2026-08-07', 7000000, 'SUPP', false),
  ];
  const rpt = require('../../services/jsmReports').get('Rpt_Tcs');
  const out = await rpt.run('507f1f77bcf86cd799439011', { from: '2026-08-01', to: '2026-08-31', head: 'Receipt' }, { vouchers });
  const big = out.rows.find((r) => r.AC_NAME === 'BIG');
  assert.equal(big.OP_RECEIPT, 4000000);
  assert.equal(big.CUR_RECEIPT, 2000000);
  assert.equal(big.APPLICABLE_VALUE, 1000000);
  assert.equal(big.TCS_PER, 0.1);
  assert.equal(big.TCS_AMT, 1000);
  assert.equal(out.rows.find((r) => r.AC_NAME === 'SMALL').TCS_AMT, 0);
  assert.ok(!out.rows.some((r) => r.AC_NAME === 'SUPP'));
  const only = await rpt.run('507f1f77bcf86cd799439011', { from: '2026-08-01', to: '2026-08-31', head: 'Receipt', applicableOnly: true }, { vouchers });
  assert.deepEqual(only.rows.map((r) => r.AC_NAME), ['BIG']);
  const pay = await rpt.run('507f1f77bcf86cd799439011', { from: '2026-08-01', to: '2026-08-31', head: 'Pay' }, { vouchers });
  assert.equal(pay.rows[0].AC_NAME, 'SUPP');
  assert.equal(pay.rows[0].BOOK, 'Payment For TCS');
  assert.equal(pay.rows[0].TCS_AMT, 2000);
});
