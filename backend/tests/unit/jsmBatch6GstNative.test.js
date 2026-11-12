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

test('TDS party / monthly report: party groups, month order by number, summary totals', async () => {
  const mk = (n, d, party, m, amt, tds) => ({ ENT_NO: n, SRAL_NO: n, ENT_DATE: new Date(d), YEAR_NO: 2026, MONTH_NO: m, MONTH: m === 7 ? 'July' : 'August', TDSHEAD: '194C', PARTY: party, PANNO: 'AAAPA1234C', AMOUNT: amt, TDS_PER: 2, TDS_AMT: tds });
  const rows = [mk(1, '2026-08-02', 'B', 8, 100, 2), mk(2, '2026-07-02', 'A', 7, 200, 4), mk(3, '2026-07-09', 'A', 7, 300, 6)];
  const rpt = require('../../services/jsmReports').get('Rpt_Tds2_Prty_Mnth_Wise');
  const base = { from: '2026-04-01', to: '2027-03-31' };
  const party = await rpt.run('507f1f77bcf86cd799439011', { ...base, mode: 'P' }, { rows });
  assert.deepEqual(party.rows.map((r) => r.PARTY), ['A', 'A', 'B']);
  const month = await rpt.run('507f1f77bcf86cd799439011', { ...base, mode: 'M', summary: true }, { rows });
  assert.deepEqual(month.rows.map((r) => [r.MONTH, r.TDS_AMT]), [['July', 10], ['August', 2]]);
  const heads = await rpt.run('507f1f77bcf86cd799439011', { ...base, mode: 'P', byHead: true, accounts: ['194C'] }, { rows });
  assert.equal(heads.rows.length, 3);
});

test('Finish At Shop Stock (new): opening = master + earlier movement, Summary keeps CL, Datewise drops nothing but dates', async () => {
  const rows = [
    { ITEM_NAME: 'SILK', GRIT_NAME: 'FINISH', BILLDATE: null, __opening: true, OP: 100 },
    { ITEM_NAME: 'SILK', GRIT_NAME: 'FINISH', BILLDATE: new Date('2026-03-20'), FNS_PU: 50 },
    { ITEM_NAME: 'SILK', GRIT_NAME: 'FINISH', BILLDATE: new Date('2026-05-02'), FNS_SL: 30 },
    { ITEM_NAME: 'SILK', GRIT_NAME: 'FINISH', BILLDATE: new Date('2026-06-02'), FNS_PU: 10 },
    { ITEM_NAME: 'GONE', GRIT_NAME: 'FINISH', BILLDATE: new Date('2026-02-02'), FNS_PU: 5 },
  ];
  const rpt = require('../../services/jsmReports').get('Rpt_Jsm_Stock_Finish_New1');
  const base = { from: '2026-04-01', to: '2027-03-31', unit: '1-Qty', category: '1-Item' };
  const sum = await rpt.run('507f1f77bcf86cd799439011', { ...base, mode: 'summary' }, { rows });
  const silk = sum.rows.find((r) => r.ITEM_NAME === 'SILK');
  assert.equal(silk.OP_QTY, 150);
  assert.equal(silk.FNS_SL_QTY, 30);
  assert.equal(silk.CL_QTY, 130);
  assert.equal(sum.grid.layout, 'JSM_VW_STOCK_FINISH');
  assert.equal(sum.grid.variant, 1);
  const monthly = await rpt.run('507f1f77bcf86cd799439011', { ...base, mode: 'month' }, { rows });
  assert.ok(monthly.rows.some((r) => r.BILLDATE === 'May-2026' && r.FNS_SL_QTY === 30));
  assert.equal(monthly.grid.variant, 4);
  const pcs = await rpt.run('507f1f77bcf86cd799439011', { ...base, unit: '2-Pcs', mode: 'summary' }, { rows });
  assert.equal(pcs.grid.layout, 'JSM_VW_STOCK_FINISH_PCS');
  await assert.rejects(() => rpt.run('507f1f77bcf86cd799439011', { ...base, unit: '9-Bad' }, { rows }), /Unknown Unit/);
});

test('Grey At Mill (Format 1): issue less receipt and shortage; earlier movement rolls into opening', async () => {
  const mk = (ent, chDate, iss, recs) => recs.map((r) => ({ ENT_NO: ent, ITEM_NAME: 'GREY-A', CHLN_DATE: new Date(chDate), ISS_QTY: iss, REC_BILLDATE: new Date(r.d), R_GRY_REC_QTY: r.g, R_SHORT_QTY: r.s }));
  const rows = [...mk('c1', '2026-03-01', 1000, [{ d: '2026-05-10', g: 400, s: 10 }, { d: '2026-06-10', g: 300, s: 0 }]), ...mk('c2', '2026-06-01', 500, [{ d: '2026-06-20', g: 0, s: 0 }])];
  const rpt = require('../../services/jsmReports').get('Rpt_Jsm_Stock_Grey_At_Mill');
  const out = await rpt.run('507f1f77bcf86cd799439011', { from: '2026-04-01', to: '2027-03-31', summary: true }, { rows, items: [] });
  const a = out.rows[0];
  assert.equal(a.OP_QTY, 1000); // issued 1-Mar, before the period
  assert.equal(a.ML_ISS_QTY, 500);
  assert.equal(a.ML_REC_QTY, 700);
  assert.equal(a.ML_SHRT_QTY, 10);
  assert.equal(a.CL_QTY, 790);
  assert.equal(out.grid.layout, 'JSM_VW_STOCK_MILL');
  const dated = await rpt.run('507f1f77bcf86cd799439011', { from: '2026-04-01', to: '2027-03-31' }, { rows, items: [] });
  assert.equal(dated.grid.variant, 3);
  assert.ok(dated.rows.some((r) => r.BILLDATE === '2026-05-10' && r.ML_REC_QTY === 400));
});

test('Stock Ledger New (book-acc): earlier movement and master join OP.STOCK; detail keeps date and book', async () => {
  const rows = [
    { ITEM_NAME: 'A', GRIT_NAME: 'FINISH', BILL_DATE: null, BOOK_NAME: '', OP_STOCK: 100, __master: true },
    { ITEM_NAME: 'A', GRIT_NAME: 'FINISH', BILL_DATE: new Date('2026-03-01'), BOOK_NAME: 'PURCHASE', PURCHASE: 50 },
    { ITEM_NAME: 'A', GRIT_NAME: 'FINISH', BILL_DATE: new Date('2026-05-01'), BOOK_NAME: 'SALES', SALES: 30 },
    { ITEM_NAME: 'A', GRIT_NAME: 'FINISH', BILL_DATE: new Date('2026-05-02'), BOOK_NAME: 'SALES', SL_RTN: 5 },
  ];
  const rpt = require('../../services/jsmReports').get('Rpt_Stock_Acc_Finish_Summary');
  const base = { from: '2026-04-01', to: '2027-03-31', itemBy: '1-Qty', summary: true };
  const sum = await rpt.run('507f1f77bcf86cd799439011', base, { rows });
  assert.equal(sum.rows.length, 1);
  assert.equal(sum.rows[0].OP_STOCK, 150);
  assert.equal(sum.rows[0].SALES, 30);
  assert.equal(sum.rows[0].SL_RTN, 5);
  assert.equal(sum.rows[0].CL_STK, 125);
  const det = await rpt.run('507f1f77bcf86cd799439011', { ...base, summary: false }, { rows });
  assert.ok(det.rows.length >= 3);
  await assert.rejects(() => rpt.run('507f1f77bcf86cd799439011', { ...base, orderBy1: 'Nope' }, { rows }), /Unknown GroupBy/);
});

test('Ledger vs O/s difference: Sales compares debtor ledger with receivables, refuses Process/JobWork', async () => {
  const fas = { diffYear: async () => ({ rows: [
    { partyName: 'B', ledgerDebit: 1000, ledgerCredit: 0, receivable: 900, payable: 0 },
    { partyName: 'A', ledgerDebit: 500, ledgerCredit: 0, receivable: 500, payable: 0 },
    { partyName: 'S', ledgerDebit: 0, ledgerCredit: 700, receivable: 0, payable: 600 },
  ] }) };
  const rpt = require('../../services/jsmReports').get('Rpt_Jsm_Ledger_os_Diff_Check');
  const sales = await rpt.run('507f1f77bcf86cd799439011', { book: 'Sales' }, { fas });
  assert.deepEqual(sales.rows, [{ AC_NAME: 'B', LED_BAL: 1000, OS_BAL: 900, BAL_OS_AMT: 100 }, { AC_NAME: 'S', LED_BAL: -700, OS_BAL: 0, BAL_OS_AMT: -700 }]);
  const purchase = await rpt.run('507f1f77bcf86cd799439011', { book: 'Purchase' }, { fas });
  assert.deepEqual(purchase.rows.map((r) => [r.AC_NAME, r.BAL_OS_AMT]), [['A', -500], ['B', -1000], ['S', 100]]);
  await assert.rejects(() => rpt.run('507f1f77bcf86cd799439011', { book: 'Process' }, { fas }), /not kept/);
});

test('CashBank Finance: only vouchers not wholly adjusted; FINANCE.AMT = REC.AMT - TOT.ADJ', async () => {
  const rows = [
    { ENT_NO: 'a', BOOK: 'BANK', AC_NAME: 'P1', REC_DATE: new Date('2026-05-01'), REC_AMT: 1000, TOT_ADJUST: 1000, FNCE_AMT: 0 },
    { ENT_NO: 'b', BOOK: 'BANK', AC_NAME: 'P2', REC_DATE: new Date('2026-05-02'), REC_AMT: 800, TOT_ADJUST: 300, FNCE_AMT: 500 },
    { ENT_NO: 'c', BOOK: 'CASH', AC_NAME: 'P2', REC_DATE: new Date('2026-05-03'), REC_AMT: 50, TOT_ADJUST: 0, FNCE_AMT: 50 },
  ];
  const rpt = require('../../services/jsmReports').get('Rpt_Cash_Bank_Finance_Report');
  const out = await rpt.run('507f1f77bcf86cd799439011', { from: '2026-04-01', to: '2027-03-31', orderBy1: 'Party' }, { rows });
  assert.deepEqual(out.rows.map((r) => r.ENT_NO), ['b', 'c']);
  assert.equal(out.grid.layout, 'JSM_VW_GST_BC_FINANCE_RPT');
  const cash = await rpt.run('507f1f77bcf86cd799439011', { from: '2026-04-01', to: '2027-03-31', books: ['CASH'] }, { rows });
  assert.deepEqual(cash.rows.map((r) => r.ENT_NO), ['c']);
});

test('Bank month wise: debits and credits of the ticked banks totalled per month, in month order', async () => {
  const banks = [{ _id: 'b1', name: 'HDFC' }, { _id: 'b2', name: 'SBI' }];
  const data = {
    b1: [{ date: new Date('2026-06-05'), debit: 100, credit: 0 }, { date: new Date('2026-05-05'), debit: 0, credit: 40 }],
    b2: [{ date: new Date('2026-05-20'), debit: 10, credit: 5 }],
  };
  const statement = async (l) => ({ statement: data[l._id] });
  const rpt = require('../../services/jsmReports').get('Rpt_BankBookRec_GstMonthWise');
  const all = await rpt.run('507f1f77bcf86cd799439011', { from: '2026-04-01', to: '2027-03-31' }, { banks, statement });
  assert.deepEqual(all.rows.map((r) => [r.MONTH, r.DEBIT, r.CREDIT]), [['May', 10, 45], ['June', 100, 0]]);
  const one = await rpt.run('507f1f77bcf86cd799439011', { from: '2026-04-01', to: '2027-03-31', banks: ['SBI'] }, { banks, statement });
  assert.deepEqual(one.rows.map((r) => [r.MONTH, r.DEBIT]), [['May', 10]]);
});

test('Chek Diff Os.Bill/Op.Balance: opening vs pending old bills, Summary only, Sale/Purchase only', async () => {
  const fas = { diffOpening: async () => ({ rows: [
    { partyName: 'D1', partyType: 'Customer', opening: 1000, openingType: 'Dr', receivable: 900, payable: 0 },
    { partyName: 'C1', partyType: 'Supplier', opening: 500, openingType: 'Cr', receivable: 0, payable: 500 },
  ] }) };
  const rpt = require('../../services/jsmReports').get('Mst1_Check_Diff');
  const sale = await rpt.run('507f1f77bcf86cd799439011', { book: 'Sale' }, { fas });
  assert.deepEqual(sale.rows, [{ AC_NAME: 'D1', OP_BAL: 1000, OS_AMOUNT: 900, DIFF: 100 }]);
  const pur = await rpt.run('507f1f77bcf86cd799439011', { book: 'Purchase' }, { fas });
  assert.deepEqual(pur.rows, [{ AC_NAME: 'C1', OP_BAL: 500, OS_AMOUNT: 500, DIFF: 0 }]);
  await assert.rejects(() => rpt.run('507f1f77bcf86cd799439011', { book: 'Agency' }, { fas }), /not kept/);
  await assert.rejects(() => rpt.run('507f1f77bcf86cd799439011', { book: 'Sale', detail: true }, { fas }), /Detail/);
});

test('Grey At Shop: opening rolls forward, closing = OP + purchase - mill send - sales - returns; month wise groups by month', async () => {
  const rows = [
    { ITEM_NAME: 'G1', GRIT_NAME: 'GREY', BILL_DATE: null, OP_STOCK: 100, __master: true },
    { ITEM_NAME: 'G1', GRIT_NAME: 'GREY', BILL_DATE: new Date('2026-03-01'), PURCHASE: 50 },
    { ITEM_NAME: 'G1', GRIT_NAME: 'GREY', BILL_DATE: new Date('2026-05-03'), PURCHASE: 200 },
    { ITEM_NAME: 'G1', GRIT_NAME: 'GREY', BILL_DATE: new Date('2026-05-09'), MILL_SEND: 120 },
    { ITEM_NAME: 'G1', GRIT_NAME: 'GREY', BILL_DATE: new Date('2026-06-09'), GREY_SL: 30 },
  ];
  const rpt = require('../../services/jsmReports').get('Rpt_Stk_Grey_At_Shop');
  const base = { from: '2026-04-01', to: '2027-03-31' };
  const item = await rpt.run('507f1f77bcf86cd799439011', { ...base, mode: 'item' }, { rows });
  assert.equal(item.rows[0].OP_STOCK, 150);
  assert.equal(item.rows[0].CL_STOCK, 200);
  const month = await rpt.run('507f1f77bcf86cd799439011', { ...base, mode: 'month' }, { rows });
  assert.deepEqual(month.rows.map((r) => r.MONTH), ['April', 'May', 'June']);
});

test('Grey At Mill Format 2: sent, came back, net grey; earlier movement becomes opening', async () => {
  const mk = (ent, ch, pcs, qty, recs) => recs.map((r) => ({ ENT_NO: ent, ITEM_NAME: 'G', CHLN_DATE: new Date(ch), ISS_PCS: pcs, ISS_QTY: qty, REC_BILLDATE: new Date(r.d), R_REC_PCS: r.p, R_FNS_REC_QTY: r.f, R_GRY_REC_QTY: r.g, R_SHORT_QTY: r.s }));
  const rows = [...mk('c1', '2026-03-01', 10, 1000, [{ d: '2026-05-01', p: 4, f: 380, g: 400, s: 5 }]), ...mk('c2', '2026-06-01', 5, 500, [{ d: '2026-06-15', p: 5, f: 480, g: 500, s: 0 }])];
  const rpt = require('../../services/jsmReports').get('Rpt1_Stk_Grey_At_Mill');
  const out = await rpt.run('507f1f77bcf86cd799439011', { from: '2026-04-01', to: '2027-03-31', mode: 'item' }, { rows, items: [] });
  const g = out.rows[0];
  assert.equal(g.OP_MTS, 1000);
  assert.equal(g.ML_SND_MTS, 500);
  assert.equal(g.NET_MTS, 900);
  assert.equal(g.CL_MTS, 600);
  const upto = await rpt.run('507f1f77bcf86cd799439011', { from: '2026-04-01', to: '2027-03-31', mode: 'item', recTo: '2026-05-31' }, { rows, items: [] });
  assert.equal(upto.rows[0].NET_MTS, 400);
});

test('Monthly stock (Kgs): each month carries the previous closing; sections use their own flows', async () => {
  const rows = [
    { date: new Date('2026-03-10'), PURCHASE: 100 },
    { date: new Date('2026-04-10'), PURCHASE: 50 },
    { date: new Date('2026-05-05'), GR_SL: 30 },
    { date: new Date('2026-05-06'), MILL_SEND: 20 },
    { date: new Date('2026-05-07'), FNS_PURCHASE: 7 },
  ];
  const rpt = require('../../services/jsmReports').get('Rpt_Stk_Meter_TanusKgs');
  const grey = await rpt.run('507f1f77bcf86cd799439011', { to: '2026-05-31', section: '2' }, { rows });
  assert.deepEqual(grey.rows.map((r) => [r.MONTH, r.OP_KGS, r.CL_KGS]), [['April', 100, 150], ['May', 150, 100]]);
  const all = await rpt.run('507f1f77bcf86cd799439011', { to: '2026-05-31', section: '1' }, { rows });
  assert.equal(all.rows[1].GREY_CL, 100);
  assert.equal(all.rows[1].FINISH_CL, 7);
  await assert.rejects(() => rpt.run('507f1f77bcf86cd799439011', { to: '2026-05-31', section: '9' }, { rows }), /Unknown report/);
});
