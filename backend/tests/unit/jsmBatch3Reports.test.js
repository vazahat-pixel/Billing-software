'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const reports = require('../../services/jsmReports');

test('Debitors Age, Excel Age Analysis, and Os New Format Testing compute exact buckets', async () => {
  const r1 = await reports.get('Rpt_Outstating_Age_Report').run('c1', { cutoffDays: 90 }, {
    rows: [
      { PARTY: 'ALPHA', BROKER: 'B1', BAL_AMT1: 100, BAL_AMT2: 200, BAL_AMT3: 50, BAL_AMT4: 400, BAL_UNADJ: 0 },
    ],
  });
  assert.equal(r1.rows[0].BEFORE_DAYS, 350);
  assert.equal(r1.rows[0].AFTER_DAYS, 400);
  assert.equal(r1.rows[0].TOT_BALANCE, 750);

  const r2 = await reports.get('A_Jsm_Os_Sales_Age_Analysys_Updated').run('c1', { day1: 30, day2: 60, day3: 90, day4: 120 }, {
    rows: [
      { PARTY: 'ALPHA', OS_DAYS: 20, TOT_BALANCE: 100 },
      { PARTY: 'ALPHA', OS_DAYS: 135, TOT_BALANCE: 500 },
    ],
  });
  assert.equal(r2.rows[0].BAL_AMT1, 100);
  assert.equal(r2.rows[0].BAL_AMT5, 500);
  assert.equal(r2.rows[0].TOT_BALANCE, 600);

  const r3 = await reports.get('Rpt_Outstating_ReportSales').run('c1', { summary: true, orderBy1: 'Party' }, {
    rows: [
      { NCBILL_NO: '1', BILL_DATE: '2026-04-01', PARTY: 'ALPHA', NET_TOT: 1000, ADJUST: 400, TOT_BALANCE: 600 },
      { NCBILL_NO: '2', BILL_DATE: '2026-04-05', PARTY: 'ALPHA', NET_TOT: 500, ADJUST: 0, TOT_BALANCE: 500 },
    ],
  });
  assert.equal(r3.grid.layout, 'RPT_OSSALES_SUMMARY');
  assert.equal(r3.rows[0].BAL_AMT, 1100);
});

test('Bill-wise interest applies exact OS_DAYS, graceDays, and yearDays math', async () => {
  const res = await reports.get('New_Rpt_Sales_Intrest_ZoomIn_New_Sales').run('c1', {
    rate: 12,
    graceDays: 10,
    yearDays: 365,
    tillDate: '2026-05-11',
    onAmt: 'TaxableAmt',
    status: 'Pending',
  }, {
    rows: [
      { NCBILL_NO: '101', BILL_DATE: '2026-04-01', PARTY: 'BETA', NET_TOT: 1050, TAXABLE_AMT: 1000, PAID_INT: 5 },
    ],
  });
  // 2026-04-01 to 2026-05-11 = 40 days; grace 10 -> 30 days; 1000 * 12% / 365 * 30 = 9.86
  assert.equal(res.rows[0].OS_DAYS, 40);
  assert.equal(res.rows[0].INT_DAYS, 30);
  assert.equal(res.rows[0].INT_AMT, 9.86);
  assert.equal(res.rows[0].FNL_AMT, 1054.86);
});

test('Bank reconciliation, OD interest, and Bank voucher print compute running balances', async () => {
  const recon = await reports.get('Rpt_CB1_Reconsilation').run('c1', { bankName: 'HDFC' }, {
    bookBalance: 10000,
    rows: [
      { ENT_DATE: '2026-04-02', CHQ_DD_NO: '11', BOOK: 'A', DEPOSITS: 2000, WITHDRAWAL: 0, CLEAR_DATE: null },
      { ENT_DATE: '2026-04-03', CHQ_DD_NO: '12', BOOK: 'B', DEPOSITS: 0, WITHDRAWAL: 500, CLEAR_DATE: '2026-04-05' },
    ],
  });
  assert.equal(recon.rows[1].BAL_AMT, 1500);
  assert.match(recon.grid.notice, /Bank Statement Bal: 8000\.00/);

  const od = await reports.get('A_CashBankLedgerSingleSide').run('c1', { mode: 'Interest', interestRate: 10, yearDays: 360, to: '2026-04-11' }, {
    accounts: [{
      ledgerName: 'OD A/C',
      openingBalance: 0,
      openingBalanceType: 'Dr',
      statement: [{ date: '2026-04-01', particulars: 'Withdrawal', debit: 0, credit: 36000 }],
    }],
  });
  // 36000 * 10% / 360 * 10 days = 100.00
  assert.equal(od.rows[0].DAYS, 10);
  assert.equal(od.rows[0].INT_AMT, 100);

  const vp = await reports.get('A_Bank_Receipt_Bill_Os_Details').run('c1', {}, {
    rows: [{ SRAL_NO: 'R1', REC_DATE: '2026-04-05', BANK: 'HDFC', PARTY: 'P1', NCBILL_NO: 'B1', BILL_AMT: 500, ADJUST: 500 }],
  });
  assert.equal(vp.rows.length, 1);
});

test('Job brokerage, Brokreg statement all, Profit register, Stock value, Yarn kgs stock', async () => {
  const jb = await reports.get('Rpt_Job_Brokerage').run('c1', { base: 'bill', commissionPer: 2 }, {
    rows: [{ BOOK: 'DYEING', BROKER: 'BR1', PARTY: 'MILL1', NCBILL_NO: '9', BILL_DATE: '2026-04-04', NET_TOT: 1000, TDS_AMT: 100, ADJUST: 900 }],
  });
  assert.equal(jb.rows[0].BROKERAGE, 18); // (1000 - 100) * 2%

  const brokAll = await reports.get('A_Jsm_Brokreg_Statement_Report').run('c1', { reportType: 'JobWork', commissionPer: 2 }, {
    rows: [{ BOOK: 'DYEING', BROKER: 'BR1', PARTY: 'MILL1', NCBILL_NO: '9', BILL_DATE: '2026-04-04', NET_TOT: 1000, TDS_AMT: 0, ADJUST: 1000 }],
  });
  assert.equal(brokAll.rows[0].BROKERAGE, 20);

  const gp = await reports.get('Rpt_Sales_Pump_Profit').run('c1', { from: '2026-04-01', to: '2026-04-30' }, {
    items: [{ name: 'SAREE', openingQty: 10, openingRate: 100, openingValue: 1000 }],
    purchases: [{ BILL_DATE: '2026-04-02', _lines: [{ ITEM_NAME: 'SAREE', IT_QTY: 10, IT_AMT: 1200 }] }],
    sales: [{ BILL_DATE: '2026-04-10', _lines: [{ ITEM_NAME: 'SAREE', IT_QTY: 5, IT_AMT: 1000 }] }],
    slReturns: [],
    puReturns: [],
  });
  assert.equal(gp.rows[0].CL_QTY, 15);
  assert.equal(gp.rows[0].GP_AMT, 600); // 1000 + (15*120=1800) - (1000+1200)

  const sv = await reports.get('A_StockValueReport').run('c1', { from: '2026-04-01', to: '2026-04-30' }, {
    items: [{ name: 'SAREE', openingQty: 10, openingRate: 100, openingValue: 1000 }],
    purchases: [], sales: [], slReturns: [], puReturns: [],
  });
  assert.equal(sv.rows[0].CL_VALUE, 1000);

  const yarn = await reports.get('A_ReportYarnStock').run('c1', { from: '2026-04-01', to: '2026-04-30' }, {
    purchases: [{ BOOK: 'YARN PURCHASE', BILL_DATE: '2026-04-01', _lines: [{ ITEM_NAME: 'YARN 30', IT_KGS: 250 }] }],
    issues: [{ PARTY: 'WEAVER A', CHLN_DATE: '2026-04-05', ISS_KGS: 100 }],
    receipts: [{ PARTY: 'WEAVER A', BILL_DATE: '2026-04-15', REC_KGS: 40 }],
  });
  const shopRow = yarn.rows.find((r) => r.STOCK_AT === 'YARN STOCK AT SHOP');
  assert.equal(shopRow.BAL_KGS, 150);
});
