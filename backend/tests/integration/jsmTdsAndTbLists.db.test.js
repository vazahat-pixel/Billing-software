/**
 * Tick-lists on the JSM Trial Balance and TDS screens, against an in-memory database:
 *  - Trial Balance lists every account and narrows the report to the ticked ones;
 *  - the TDS screens list every party (and TDS section) on the masters even when no TDS entry exists yet.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startMemoryDb, stopMemoryDb } = require('../helpers/memoryDb');

test.describe('JSM tick-lists on a real database', () => {
  let jsmReports; let companyId;

  test.before(async () => {
    await startMemoryDb();
    const mongoose = require('mongoose');
    const Company = require('../../models/Company');
    const Party = require('../../models/Party');
    const LedgerMaster = require('../../models/LedgerMaster');
    jsmReports = require('../../services/jsmReports');
    companyId = new mongoose.Types.ObjectId();
    await Company.collection.insertOne({ _id: companyId, name: 'LIST CO', coCode: 'LC', createdAt: new Date() });
    await Party.create({ companyId, name: 'MAHESH TEX', type: 'Customer', group: 'DEBTORS', city: 'SURAT', tdsSection: '194C' });
    await Party.create({ companyId, name: 'LALA SUPPLIER', type: 'Supplier', group: 'CREDITORS', city: 'SURAT', tdsSection: '194Q' });
    await LedgerMaster.create({ companyId, name: 'HDFC BANK', group: 'Assets', accountType: 'Bank' });
  });
  test.after(async () => { await stopMemoryDb(); });

  test('Trial Balance options list the accounts', async () => {
    const o = await jsmReports.get('Rpt_Trail_Bal_101').options(companyId);
    assert.ok(Array.isArray(o.accounts));
  });

  test('Trial Balance narrows to ticked accounts', async () => {
    const run = (accounts) => jsmReports.get('Rpt_Trail_Bal_101').run(companyId, {
      from: '2026-04-01', to: '2027-03-31', format: '2', orderBy: '1', withZero: true, accounts,
    });
    const all = await run([]);
    assert.ok(all.rows.length >= 1);
    const one = await run([all.rows[0].AC_NAME]);
    assert.equal(one.rows.length, 1);
  });

  for (const form of ['Rpt_TdsReports', 'Rpt_Tds2_Prty_Mnth_Wise', 'Rpt_Tds5_Certi']) {
    test(`${form} lists master parties with an empty TDS book`, async () => {
      const o = await jsmReports.get(form).options(companyId);
      assert.ok(o.parties.includes('MAHESH TEX') && o.parties.includes('LALA SUPPLIER'));
      assert.ok(o.heads.includes('194C'));
    });
  }

  test('TDS reports run on an empty book', async () => {
    for (const [form, p] of [
      ['Rpt_TdsReports', { group: 'Month+TdsHead+Party', from: '2026-04-01', to: '2027-03-31' }],
      ['Rpt_Tds2_Prty_Mnth_Wise', { mode: 'P', from: '2026-04-01', to: '2027-03-31', accounts: [] }],
      ['Rpt_Tds5_Certi', { from: '2026-04-01', to: '2027-03-31', accounts: [] }],
    ]) {
      const r = await jsmReports.get(form).run(companyId, p);
      assert.deepEqual(r.rows, [], form);
    }
  });

  test('Above/Below lists the party master and accepts ticked accounts', async () => {
    const o = await jsmReports.get('Rpt_Above_Below').options(companyId);
    assert.deepEqual(o.accounts, ['LALA SUPPLIER', 'MAHESH TEX']);
    const r = await jsmReports.get('Rpt_Above_Below').run(companyId, {
      source: 1, direction: 'A', amount: 0, from: '2026-04-01', to: '2027-03-31', accounts: ['MAHESH TEX'],
    });
    assert.deepEqual(r.rows, []);
  });

  test('TDS Challan lists TDS heads from the masters and filters by ticked heads', async () => {
    const o = await jsmReports.get('Rpt_Tds4_Challan').options(companyId);
    assert.deepEqual(o.heads, ['194C', '194Q']);
    const r = await jsmReports.get('Rpt_Tds4_Challan').run(companyId, { from: '2026-04-01', to: '2027-03-31', heads: ['194Q'], company: true });
    assert.deepEqual(r.rows, []);
    assert.match(r.grid.title, /194Q/);
  });
});
