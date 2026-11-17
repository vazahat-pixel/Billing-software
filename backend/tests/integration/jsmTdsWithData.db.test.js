const test = require('node:test');
const assert = require('node:assert/strict');
const { startMemoryDb, stopMemoryDb } = require('../helpers/memoryDb');

test.describe('TDS reports with real entries', () => {
  let jsm; let companyId;
  test.before(async () => {
    await startMemoryDb();
    const mongoose = require('mongoose');
    const Company = require('../../models/Company');
    const Party = require('../../models/Party');
    const Purchase = require('../../models/Purchase');
    const TaxDeduction = require('../../models/TaxDeduction');
    jsm = require('../../services/jsmReports');
    companyId = new mongoose.Types.ObjectId();
    await Company.collection.insertOne({ _id: companyId, name: 'T CO', coCode: 'T', createdAt: new Date() });
    const sup = await Party.create({ companyId, name: 'SUP ONE', type: 'Supplier', group: 'CREDITORS', city: 'SURAT', pan: 'ABCDE1234F', tdsSection: '194C', tdsPer: 1 });
    await TaxDeduction.create({ companyId, deductionType: 'TDS', section: '194C', partyId: sup._id, partyName: 'SUP ONE', pan: 'ABCDE1234F', transactionDate: new Date('2026-06-10'), taxableAmount: 10000, rate: 1, deductedAmount: 100 });
    const Job = require('../../models/Job');
    await Job.collection.insertOne({ companyId, workerId: sup._id, jobCardNo: 'J1', status: 'Received', receiveDate: new Date('2026-07-05'), billGpNo: 'MB-9', workKind: 'Mill', receiveTdsBase: 20000, receiveTdsPercent: 2, receiveTdsAmount: 400, isDeleted: false, version: 1 });
  });
  test.after(async () => { await stopMemoryDb(); });

  const range = { from: '2026-04-01', to: '2027-03-31', fromText: '01/04/2026', toText: '31/03/2027' };
  test('Head wise / Register', async () => {
    const r = await jsm.get('Rpt_TdsReports').run(companyId, { ...range, group: 'Month+TdsHead+Party', parties: [], heads: [], pers: [] });
    assert.equal(r.rows.length, 2);
    assert.ok(r.rows.some((x) => x.NCBILL_NO === 'MB-9' && x.TDS_AMT === 400));
  });
  test('Party wise', async () => {
    const r = await jsm.get('Rpt_Tds2_Prty_Mnth_Wise').run(companyId, { ...range, mode: 'P', accounts: [] });
    assert.equal(r.rows.length, 2);
    assert.ok(r.rows.some((x) => x.NCBILL_NO === 'MB-9' && x.TDS_AMT === 400));
  });
  test('Certificate + Challan', async () => {
    const c = await jsm.get('Rpt_Tds5_Certi').run(companyId, { ...range, accounts: [] });
    assert.equal(c.rows.length, 2); // one per month
    assert.equal(c.rows.reduce((s, r) => s + r.TDS_AMT, 0), 500);
    const ch = await jsm.get('Rpt_Tds4_Challan').run(companyId, { ...range, company: false, heads: [] });
    assert.equal(ch.rows.length, 2);
  });
});
