'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const reports = require('../../services/jsmReports');

const cid = '507f1f77bcf86cd799439011';

test('Batch 4 GST Old: Gstr_3B_TextNew_Monthly_Cess & Gstr_3BB_Zoomin_Rpt', async () => {
  const deps = {
    sales: [
      { BOOK: 'SALES GST', BILL_DATE: '2026-04-05', GSTIN_NO: '24AAAAA0000A1Z5', TAXABLE_AMT: 1000, SGST_AMT: 25, CGST_AMT: 25, IGST_AMT: 0, CESS_AMT: 10, NET_TOT: 1060, STATE: 'GUJARAT' },
      { BOOK: 'SALES GST', BILL_DATE: '2026-04-06', GSTIN_NO: '', TAXABLE_AMT: 500, SGST_AMT: 0, CGST_AMT: 12.5, IGST_AMT: 12.5, CESS_AMT: 0, NET_TOT: 525, STATE: 'MAHARASHTRA' },
      { BOOK: 'EXEMPT SALES', BILL_DATE: '2026-04-07', GSTIN_NO: '', TAXABLE_AMT: 200, SGST_AMT: 0, CGST_AMT: 0, IGST_AMT: 0, CESS_AMT: 0, NET_TOT: 200, STATE: 'GUJARAT' },
    ],
    purchases: [
      { BOOK: 'PURCHASE', BILL_DATE: '2026-04-08', TAXABLE_AMT: 400, SGST_AMT: 10, CGST_AMT: 10, IGST_AMT: 0, CESS_AMT: 0, NET_TOT: 420 },
    ],
    salesRtn: [
      { BOOK: 'SALES RETURN', BILL_DATE: '2026-04-09', TAXABLE_AMT: 100, SGST_AMT: 2.5, CGST_AMT: 2.5, IGST_AMT: 0, CESS_AMT: 0, NET_TOT: 105 },
    ],
    purchaseRtn: [],
    notes: [
      { ENT_NO: '1', BILL_DATE: '2026-04-10', NOTE_TYPE: 'Credit', BOOK: 'CN', TAXABLE_AMT: 50, IGST_AMT: 2.5, CGST_AMT: 0, SGST_AMT: 0, CESS_AMT: 0, NET_TOT: 52.5 },
      { ENT_NO: '2', BILL_DATE: '2026-04-10', NOTE_TYPE: 'Debit', BOOK: 'DN', TAXABLE_AMT: 30, IGST_AMT: 1.5, CGST_AMT: 0, SGST_AMT: 0, CESS_AMT: 0, NET_TOT: 31.5 },
    ],
  };

  const cessRes = await reports.get('Gstr_3B_TextNew_Monthly_Cess').run(cid, { from: '2026-04-01', to: '2026-04-30' }, deps);
  assert.equal(cessRes.grid.layout, 'JSM_VW_GSTR3B_CESS');
  const regRow = cessRes.rows.find((r) => r.HEAD.startsWith('SALES (Outward taxable'));
  assert.equal(regRow.CESS_AMT, 10);
  const srRow = cessRes.rows.find((r) => r.HEAD.startsWith('SALES RETURN'));
  assert.equal(srRow.TAXABLE_AMT, -100);
  const dnRow = cessRes.rows.find((r) => r.HEAD.startsWith('DEBIT NOTE'));
  assert.equal(dnRow.TAXABLE_AMT, 30);

  const zoomRes = await reports.get('Gstr_3BB_Zoomin_Rpt').run(cid, { from: '2026-04-01', to: '2026-04-30' }, deps);
  assert.equal(zoomRes.grid.layout, 'JSM_VW_GSTR_3B_ZOOMIN_RPT');
  assert.equal(zoomRes.rows.find((r) => r.GRACE_HEAD === 'SALES REGISTRED').TAXABLE_AMT, 1000);
  assert.equal(zoomRes.rows.find((r) => r.GRACE_HEAD === 'CREDIT NOTE').TAXABLE_AMT, -50);
});

test('Batch 4 Stock Old: Rpt_Stock_Share, Rpt_StockSizeWise, Rpt_Stk_Grey_At_Shop_DateWise', async () => {
  const deps = {
    items: [
      { ITEM_NAME: 'COTTON GREY', GRIT_NAME: 'GREY', PU_RATE: 80, OP_QTY: 100, OP_VAL: 8000, CATEGORY: 'Grey', SIZE: '58' },
    ],
    purchases: [
      { BILL_DATE: '2026-04-05', _lines: [{ ITEM_NAME: 'COTTON GREY', IT_QTY: 50, IT_PCS: 2, IT_TAXABLE: 4000, SIZE: '58' }] },
    ],
    sales: [
      { BILL_DATE: '2026-04-06', _lines: [{ ITEM_NAME: 'COTTON GREY', IT_QTY: 30, IT_PCS: 1, IT_TAXABLE: 3000, SIZE: '58' }] },
    ],
    millIssue: [
      { CHLN_DATE: '2026-04-07', ITEM: 'COTTON GREY', ISS_QTY: 40 },
    ],
    millReceipt: [
      { BILL_DATE: '2026-04-08', _lines: [{ ITEM_NAME: 'COTTON GREY', GREY_RTN_QTY: 5 }] },
    ],
    purchaseRtn: [],
  };

  const share = await reports.get('Rpt_Stock_Share').run(cid, { from: '2026-04-01', to: '2026-04-30' }, deps);
  assert.equal(share.grid.layout, 'JSM_VW_RUNTIME_ITEM_CAT_RPT');
  assert.equal(share.rows[0].BAL_QTY, 120);
  assert.equal(share.rows[0].BAL_VAL, 9000);

  const sz = await reports.get('Rpt_StockSizeWise').run(cid, { from: '2026-04-01', to: '2026-04-30', orderBy1: 'Item' }, deps);
  assert.equal(sz.grid.layout, 'JSM_VW_STOCK_SIZEWISE');
  assert.equal(sz.rows[0].SIZECHART, '58');
  assert.equal(sz.rows[0].CLS_QTY, 20);
  assert.equal(sz.rows[0].CLS_PCS, 1);

  const grey = await reports.get('Rpt_Stk_Grey_At_Shop_DateWise').run(cid, { from: '2026-04-01', to: '2026-04-30' }, deps);
  assert.equal(grey.grid.layout, 'JSM_VW_GREY_STK_DATE');
  const netBal = grey.rows.reduce((s, r) => s + r.BAL_QTY, 0);
  assert.equal(netBal, 85); // 100 + 50 + 5 - 40 - 30
});

test('Batch 4 Misc Old: Rpt_Jsm_SalesPurchaseVat, ZOld_Rpt_Os_Sales, Rpt_Account_List_Print_Old', async () => {
  const sl = [
    { BOOK: 'LOCAL SALES', BILL_DATE: '2026-04-03', NCBILL_NO: '2', PARTY: 'ALPHA', GSTIN_NO: '24A', TAXABLE_AMT: 100, GST_RATE: 5, CGST_AMT: 2.5, SGST_AMT: 2.5, IGST_AMT: 0, NET_TOT: 105 },
  ];
  const bookRes = await reports.get('Rpt_Jsm_SalesPurchaseVat').run(cid, { mode: 'Sales', from: '2026-04-01', to: '2026-04-30' }, { sales: sl });
  assert.equal(bookRes.grid.layout, 'JSM_VW_BOOK_PRINT_SLPU');
  assert.equal(bookRes.rows[0].VAT_AMT, 5);

  const jvRes = await reports.get('Rpt_Jsm_SalesPurchaseVat').run(cid, { mode: 'JvBook', from: '2026-04-01', to: '2026-04-30' }, {
    jvEntries: [{ _id: 'j1', entryDate: '2026-04-04', entryNo: 'JV-1', narration: 'Adj', lines: [{ ledgerId: { name: 'A' }, debit: 500 }, { ledgerId: { name: 'B' }, credit: 500 }] }],
  });
  assert.equal(jvRes.grid.layout, 'JSM_VW_BOOK_PRINT_JV');
  assert.equal(jvRes.rows[0].AMOUNT, 500);

  const osRes = await reports.get('ZOld_Rpt_Os_Sales').run(cid, { category: 3 }, {
    rows: [{ PARTY: 'P1', BROKER: 'BR1', STATION: 'SURAT', MAINGROUP: 'SUNDRY', BOOK: 'SL', BILL_DATE: '2026-04-02', NCBILL_NO: '1', NET_TOT: 1000, ADJUST: 200, GOODS_RTN: 0, TOT_BALANCE: 800, OS_DAYS: 15 }],
  });
  assert.equal(osRes.grid.layout, 'JSM_VW_OS_SALES_OLD');
  assert.equal(osRes.rows[0].JS_GROUP, 'BR1');
  assert.equal(osRes.rows[0].TOT_BALANCE, 800);

  const listRes = await reports.get('Rpt_Account_List_Print_Old').run(cid, { mode: 3 }, {
    items: [{ itemGroupId: { name: 'FINISH' }, name: 'SAREE', itemCode: 'S1', unit: 'PCS', hsnCode: '5407', salesRate: 450 }],
  });
  assert.equal(listRes.grid.layout, 'JSM_VW_LIST_PRINT_OLD');
  assert.equal(listRes.rows[0].RATE, 450);
});

test('Batch 4 Bank Old: Tran_BankDetail & Frm_TabReport', async () => {
  const ledgers = [
    { AC_NAME: 'HDFC BANK', GROUP_NAME: 'Bank', KIND: 'BANK', OPBAL: 1000, DRAMT: 500, CRAMT: 200, CLBAL: 1300, CLR_DR: 400, CLR_CR: 200, CLEAR_BAL: 1200, UNCLEAR_BAL: 100 },
    { AC_NAME: 'PETTY CASH', GROUP_NAME: 'Cash', KIND: 'CASH', OPBAL: 200, DRAMT: 100, CRAMT: 50, CLBAL: 250, CLR_DR: 100, CLR_CR: 50, CLEAR_BAL: 250, UNCLEAR_BAL: 0 },
  ];

  const bankRes = await reports.get('Tran_BankDetail').run(cid, { mode: 'BankBalance' }, { ledgers });
  assert.equal(bankRes.grid.layout, 'JSM_VW_TRAN_BANK_DETAIL');
  assert.equal(bankRes.rows.length, 1);
  assert.equal(bankRes.rows[0].BANK_BAL, 1300);

  const cashRes = await reports.get('Tran_BankDetail').run(cid, { mode: 'CashOnly' }, { ledgers });
  assert.equal(cashRes.rows.length, 1);
  assert.equal(cashRes.rows[0].BANK_NAME, 'PETTY CASH');

  const tabRes = await reports.get('Frm_TabReport').run(cid, {}, { ledgers });
  assert.equal(tabRes.grid.layout, 'JSM_VW_FRM_TAB_REPORT');
  assert.equal(tabRes.rows.length, 2);
});
