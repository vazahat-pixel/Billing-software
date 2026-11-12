'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const reports = require('../../services/jsmReports');

const cid = '507f1f77bcf86cd799439011';

test('Batch 5A: Rpt_Process_Stock_TakaDetail orders taka lines cleanly', async () => {
  const res = await reports.get('Rpt_Process_Stock_TakaDetail').run(cid, {
    from: '2026-07-01', to: '2026-08-31', status: 'Pending', orderBy1: 'Mill_Name',
  }, {
    rows: [
      { ENT_NO: '3', NCCHLN_NO: '3', CHLN_DATE: '2026-07-25', BOOK: 'PROCESS CHARGE', MILL_NAME: 'SHREE LAV', ITEM_NAME: 'DOBBY', ISS_PCS: 12, ISS_QTY: 236, DSR_NO: 2, DISS_QTY: 2, DREC_QTY: 0, DSHORT_QTY: 0, STATUS: 'P' },
      { ENT_NO: '3', NCCHLN_NO: '3', CHLN_DATE: '2026-07-25', BOOK: 'PROCESS CHARGE', MILL_NAME: 'SHREE LAV', ITEM_NAME: 'DOBBY', ISS_PCS: 12, ISS_QTY: 236, DSR_NO: 1, DISS_QTY: 222, DREC_QTY: 0, DSHORT_QTY: 0, STATUS: 'P' },
    ],
  });
  assert.equal(res.grid.layout, 'JSM_VW_PROCESS_STOCK_TAKADETAIL_REPORT');
  assert.deepEqual(res.rows.map((r) => r.DSR_NO), [1, 2]);
});

test('Batch 5A: Zoom_SelectDate_List requires account & wraps ledger mode', async () => {
  await assert.rejects(() => reports.get('Zoom_SelectDate_List').run(cid, {}, {}), { status: 400 });
  const res = await reports.get('Zoom_SelectDate_List').run(cid, { account: 'PARTY A', action: 'Btn_Confirmation' }, {
    ledgerRun: async () => ({ rows: [{ BOOK_name: 'OPENING BALANCE' }], grid: { layout: 'JSM_VW_LEDGER_ACCOUNT', variant: 1 } }),
  });
  assert.equal(res.grid.layout, 'JSM_VW_LEDGER_ACCOUNT');
  assert.match(res.grid.title, /Confirmation Of Account : PARTY A/);
});

test('Batch 5A: Rpt_BrokregReport filters pending/clear & groups by Broker', async () => {
  const res = await reports.get('Rpt_BrokregReport').run(cid, { status: 'Pending', orderBy1: 'Broker' }, {
    rows: [
      { SRAL_NO: '1', REC_DATE: '2026-04-05', BROKER: 'BR1', PARTY: 'P1', BOOK: 'HDFC', REC_PAY: 'R', REC_AMT: 1000, COMMI_PER: 2, COMMI_AMT: 20, EXP_VNO: '', REMARK_1: '', OS_DAYS: 5 },
      { SRAL_NO: '2', REC_DATE: '2026-04-06', BROKER: 'BR1', PARTY: 'P2', BOOK: 'HDFC', REC_PAY: 'R', REC_AMT: 500, COMMI_PER: 2, COMMI_AMT: 10, EXP_VNO: 'EXP1', REMARK_1: '', OS_DAYS: 4 },
    ],
  });
  assert.equal(res.grid.layout, 'JSM_VW_BROKREG_OS');
  assert.equal(res.rows.length, 1);
  assert.equal(res.rows[0].COMMI_AMT, 20);
});

test('Batch 5A: Frm_BillAgistPaidDetail, Rpt_Match8A_Report, Stp_DataBaseFromTo', async () => {
  const paidRes = await reports.get('Frm_BillAgistPaidDetail').run(cid, {}, {
    rows: [{ VOU_TYPE: 'Receipt', VOU_NO: '10', REC_DATE: '2026-04-10', PARTY: 'P1', BOOK: 'HDFC', NCBILL_NO: '1', BILL_AMT: 1000, ADJUST: 1000, RG_AMT: 0, DISCOUNT: 50, TDS_AMT: 0, CLAIM_AMT: 0, NET_PAID: 950 }],
  });
  assert.equal(paidRes.grid.layout, 'JSM_VW_BILL_AGAINST_PAID');
  assert.equal(paidRes.rows[0].NET_PAID, 950);

  const m8 = await reports.get('Rpt_Match8A_Report').run(cid, {
    from: '2026-04-01', to: '2026-04-30',
    portalRows: [{ GSTIN_NO: '24AAAAA0000A1Z5', INV_NO: 'PU-1', INV_AMT: 1050, TAX_AMT: 1000, IGST: 0, CGST: 25, SGST: 25 }],
  }, {
    purchases: [{ BILL_DATE: '2026-04-05', GSTIN_NO: '24AAAAA0000A1Z5', PARTY: 'SUP', BOOK: 'PU', NCBILL_NO: 'PU-1', NET_TOT: 1050, TAXABLE_AMT: 1000 }],
  });
  assert.equal(m8.grid.layout, 'JSM_VW_MATCH8A');
  assert.equal(m8.rows[0].STATUS, 'MATCH');

  const dbRes = await reports.get('Stp_DataBaseFromTo').run(cid, {}, {
    diagnostics: [{ TABLE_NAME: 'Sales', TOTAL_RECORDS: 12, ISSUE_COUNT: 0, STATUS: 'OK', DETAILS: 'OK' }],
  });
  assert.equal(dbRes.grid.layout, 'JSM_VW_DB_REPAIR');
  assert.equal(dbRes.rows[0].STATUS, 'OK');
});
