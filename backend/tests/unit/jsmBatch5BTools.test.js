'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const reports = require('../../services/jsmReports');

const cid = '507f1f77bcf86cd799439011';

test('Batch 5B: GstFilingFreezeData toggles lock state on GstPeriod', async () => {
  const store = [];
  const GstPeriod = {
    findOne: async ({ period }) => store.find((d) => d.period === period) || null,
    create: async (doc) => { const d = { ...doc, save: async () => d }; store.push(d); return d; },
    find: () => ({ lean: async () => store }),
  };

  const r1 = await reports.get('GstFilingFreezeData').run(cid, { month: '2026-07', action: 'Btn_Freeze_Data' }, { GstPeriod });
  assert.equal(r1.grid.layout, 'JSM_VW_GST_FREEZE_DATA');
  assert.equal(r1.rows[0].FREEZE, 'Y');

  const r2 = await reports.get('GstFilingFreezeData').run(cid, { month: '2026-07', action: 'Btn_Freeze_Data' }, { GstPeriod });
  assert.equal(r2.rows[0].FREEZE, 'N');
});

test('Batch 5B: Rpt_Update_Lot_Status & Rpt_Jsm_Os_Update sync mismatched statuses', async () => {
  const updates = [];
  const lotRes = await reports.get('Rpt_Update_Lot_Status').run(cid, { action: 'btn_update' }, {
    jobs: [{ _id: 'j1', jobCardNo: '10', workKind: '', processType: 'Dyeing', issueQty: 100, receivedGreyQty: 100, status: 'Issued', workerId: { name: 'MILL 1' } }],
    onUpdate: async (id, st) => updates.push([id, st]),
  });
  assert.equal(lotRes.grid.layout, 'JSM_VW_UPDATE_LOT_STATUS');
  assert.deepEqual(updates, [['j1', 'Received']]);

  const osUpdates = [];
  const osRes = await reports.get('Rpt_Jsm_Os_Update').run(cid, { action: 'btn_update' }, {
    salesOs: [{ ENT_NO: 's1', PARTY: 'P1', NCBILL_NO: '1', NET_TOT: 500, ADJUST: 500, GOODS_RTN: 0, TOT_BALANCE: 0, PEND: 'P' }],
    puOs: [],
    onUpdate: async (t, id, st) => osUpdates.push([t, id, st]),
  });
  assert.equal(osRes.grid.layout, 'JSM_VW_OS_UPDATE');
  assert.deepEqual(osUpdates, [['1SL', 's1', 'paid']]);
});

test('Batch 5B: Eway_No_Upload_Offline & Frm_Import_SalesJsm', async () => {
  const updatedBills = [];
  const Sales = {
    updateOne: async (q, u) => { updatedBills.push([q.invoiceNo, u.$set.eway]); return { modifiedCount: 1 }; },
  };
  const ewRes = await reports.get('Eway_No_Upload_Offline').run(cid, {
    action: 'btn_Export_data_Sales',
    ewayRows: [{ docNo: 'S-1', ewbNo: '141000000111' }],
  }, { Sales });
  assert.equal(ewRes.grid.layout, 'JSM_VW_EWAY_UPLOAD');
  assert.equal(ewRes.rows[0].EWB_STATUS, 'UPDATED');
  assert.deepEqual(updatedBills, [['S-1', '141000000111']]);

  const impRes = await reports.get('Frm_Import_SalesJsm').run(cid, {
    importRows: [{ NCBILL_NO: '1', GST_NO: '24A', TAXABLE_AMT: 1000, NET_TOT: 1050 }],
  }, {
    sales: [{ BILL_DATE: '2026-04-05', NCBILL_NO: '1', GSTIN_NO: '24A', TAXABLE_AMT: 1000, NET_TOT: 1050 }],
  });
  assert.equal(impRes.grid.layout, 'JSM_VW_IMPORT_SALES_MATCH');
  assert.equal(impRes.rows[0].BILLNO_MATCHING, 'MATCH');
  assert.equal(impRes.rows[0].NETTOT_MATCHING, 'MATCH');
});

test('Batch 5B: FrmReminder_All_Details, Brokerage Tools, Frm_Investment_Raju', async () => {
  const remStore = [];
  const Reminder = {
    create: async (d) => remStore.push({ _id: 'r1', ...d }),
    updateOne: async () => {},
    deleteOne: async () => { remStore.length = 0; },
    find: () => ({ sort: () => ({ lean: async () => remStore }) }),
  };
  const rem1 = await reports.get('FrmReminder_All_Details').run(cid, { action: 'btn_Save', description: 'GSTR-3B Due', amount: 0, beforeRemindDays: 3, reminderFor: 'Monthly' }, { Reminder });
  assert.equal(rem1.grid.layout, 'JSM_VW_REMINDER_DETAILS');
  assert.equal(rem1.rows[0].DESCRIPTION, 'GSTR-3B Due');

  const bvStore = [];
  const BrokerageVoucher = {
    findOneAndUpdate: async (_q, doc) => bvStore.push(doc),
    deleteOne: async () => {},
    find: () => ({ sort: () => ({ lean: async () => bvStore }) }),
  };
  const trRes = await reports.get('Tran_TradingBrokregEntry').run(cid, {
    action: 'btn_sv', voucherNo: 'BV-1', broker: 'BR1', commiPer: 2,
  }, {
    BrokerageVoucher,
    osRows: [{ BILL_DATE: '2026-04-05', NCBILL_NO: '1', PARTY: 'P1', BROKER: 'BR1', NET_TOT: 1000 }],
  });
  assert.equal(trRes.grid.layout, 'JSM_VW_TRADING_BROKREG');
  assert.equal(trRes.rows[0].COMMI_AMT, 20);
  assert.equal(bvStore[0].commiAmt, 20);

  const btiRes = await reports.get('Broker_commision_check').run(cid, {
    action: 'btn_sv', billNo: 'BT-1', commiPer: 2, sgstPer: 9, cgstPer: 9,
  }, {
    BrokerageVoucher,
    vouchers: [{ voucherNo: 'V1', date: '2026-04-06', partyName: 'P1', bookName: 'HDFC', voucherType: 'Receipt', amount: 5000 }],
  });
  assert.equal(btiRes.grid.layout, 'JSM_VW_BROKER_TAX_INVOICE');
  assert.equal(btiRes.rows[0].COMMI_AMT, 100);
  assert.equal(btiRes.rows[0].NET_AMT, 118);

  const invRes = await reports.get('Frm_Investment_Raju').run(cid, {}, {
    entries: [{ folioNo: 'F1', scheme: 'NIFTY 50', investor: 'RAJU', tranType: 'BUY', tranMode: 'SIP', date: '2026-01-01', unit: 10, nav: 100, amount: 1000, curNav: 120, curAmount: 1200, divAmount: 50 }],
  });
  assert.equal(invRes.grid.layout, 'RPT_INVESTMENT_RAJUBHAI');
  assert.equal(invRes.rows[0].PROFIT_AMT, 200);
  assert.equal(invRes.rows[0].LOSS_AMT, 0);
});
