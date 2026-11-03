/**
 * JSM: Reports › Final Reports › Trail Balance (Rpt_Trail_Bal_101), B-Single / C-GroupWise —
 * against a real (in-memory) database. Proves the wrapper
 * (services/jsmReports/reports/trialBalance.js) wires correctly into
 * financialReportsService.groupedTrialBalance() — the engine already behind this app's own
 * Trial Balance screen — and that Broker/Job Worker/Supplier/Customer land under the same JSM
 * heads the owner's own JSM printed (03/11/2026): CREDITORS FOR JOBWORK / CREDITORS FOR PROCESS /
 * SUNDRY CREDITORS / SUNDRY DEBTORS.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startMemoryDb, stopMemoryDb } = require('../helpers/memoryDb');

test.describe('JSM Trial Balance on a real database', () => {
  let jsmReports; let ids;

  test.before(async () => {
    await startMemoryDb();
    const mongoose = require('mongoose');
    const Company = require('../../models/Company');
    const Party = require('../../models/Party');
    const LedgerMaster = require('../../models/LedgerMaster');
    const AccountingEntry = require('../../models/AccountingEntry');
    jsmReports = require('../../services/jsmReports');

    const companyId = new mongoose.Types.ObjectId();
    await Company.collection.insertOne({ _id: companyId, name: 'TB CO', coCode: 'TC', createdAt: new Date() });

    const broker = await Party.create({ companyId, name: 'ANIL BROKER', type: 'Broker', group: 'CREDITORS', city: 'SURAT' });
    const worker = await Party.create({ companyId, name: 'SHREE VASUDEV', type: 'Job Worker', group: 'JOBWORKERS', city: 'SURAT' });
    const supplier = await Party.create({ companyId, name: 'LALA SUPPLIER', type: 'Supplier', group: 'CREDITORS', city: 'SURAT' });
    const customer = await Party.create({ companyId, name: 'MAHESH TEX', type: 'Customer', group: 'DEBTORS', city: 'SURAT' });

    const mk = (name, p, accountType = 'Party') => LedgerMaster.create({
      companyId, name, group: 'Liabilities', accountType, linkedPartyId: p?._id,
    });
    const brokerLedger = await mk('ANIL BROKER', broker);
    const workerLedger = await mk('SHREE VASUDEV', worker);
    const supplierLedger = await mk('LALA SUPPLIER', supplier);
    const customerLedger = await LedgerMaster.create({
      companyId, name: 'MAHESH TEX', group: 'Assets', accountType: 'Party', linkedPartyId: customer._id,
    });
    const bank = await LedgerMaster.create({ companyId, name: 'HDFC BANK', group: 'Assets', accountType: 'Bank' });

    const entry = (name, ledger, type, amount, contra) => AccountingEntry.create({
      companyId, entryNo: name, entryDate: new Date('2026-05-10T00:00:00Z'),
      voucherType: 'Journal', refType: 'Journal', refId: new mongoose.Types.ObjectId(), status: 'Posted',
      lines: [
        { ledgerId: ledger._id, ledgerName: ledger.name, type, amount },
        { ledgerId: contra._id, ledgerName: contra.name, type: type === 'Dr' ? 'Cr' : 'Dr', amount },
      ],
    });
    await entry('J1', brokerLedger, 'Cr', 1000, bank);
    await entry('J2', workerLedger, 'Cr', 2000, bank);
    await entry('J3', supplierLedger, 'Cr', 3000, bank);
    await entry('J4', customerLedger, 'Dr', 4000, bank);

    ids = { companyId };
  });

  test.after(async () => { await stopMemoryDb(); });

  test('groups Broker / Job Worker / Supplier / Customer under JSM\'s own heads', async () => {
    const report = jsmReports.get('Rpt_Trail_Bal_101');
    const r = await report.run(String(ids.companyId), { to: '2027-03-31', format: '2', orderBy: '1' });

    const byHead = {};
    for (const row of r.rows) (byHead[row.GROUP1] = byHead[row.GROUP1] || []).push(row.AC_NAME);

    assert.ok(byHead['CREDITORS FOR JOBWORK']?.includes('ANIL BROKER'));
    assert.ok(byHead['CREDITORS FOR PROCESS']?.includes('SHREE VASUDEV'));
    assert.ok(byHead['SUNDRY CREDITORS']?.includes('LALA SUPPLIER'));
    assert.ok(byHead['SUNDRY DEBTORS']?.includes('MAHESH TEX'));
    assert.ok(byHead['BANK BALANCE']?.includes('HDFC BANK'));
  });

  test('refuses an uncaptured B/C layout rather than guessing it', async () => {
    const report = jsmReports.get('Rpt_Trail_Bal_101');
    await assert.rejects(() => report.run(String(ids.companyId), { format: '1', orderBy: '1' }), /not captured/);
  });
});
