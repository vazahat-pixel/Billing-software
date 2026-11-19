/**
 * JSM: Reports › Final Reports › BalanceSheet (A_Final_BalanceSheet), Group Wise / Double —
 * against a real (in-memory) database. Proves services/jsmReports/reports/balanceSheet.js wires
 * into financialReportsService.groupedTrialBalance() + profitAndLoss(), and that Liabilities +
 * Net Profit foots to Assets, the way the owner's own printed Balance Sheet did (03/11/2026).
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startMemoryDb, stopMemoryDb } = require('../helpers/memoryDb');

test.describe('JSM Balance Sheet on a real database', () => {
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
    await Company.collection.insertOne({ _id: companyId, name: 'BS CO', coCode: 'BS', createdAt: new Date() });

    const customer = await Party.create({ companyId, name: 'MAHESH TEX', type: 'Customer', group: 'DEBTORS', city: 'SURAT' });
    const supplier = await Party.create({ companyId, name: 'LALA SUPPLIER', type: 'Supplier', group: 'CREDITORS', city: 'SURAT' });

    const bank = await LedgerMaster.create({ companyId, name: 'HDFC BANK', group: 'Assets', accountType: 'Bank' });
    const custLedger = await LedgerMaster.create({ companyId, name: 'MAHESH TEX', group: 'Assets', accountType: 'Party', linkedPartyId: customer._id });
    const suppLedger = await LedgerMaster.create({ companyId, name: 'LALA SUPPLIER', group: 'Liabilities', accountType: 'Party', linkedPartyId: supplier._id });
    const sales = await LedgerMaster.create({ companyId, name: 'Sales A/c', group: 'Income', accountType: 'General', subGroup: 'Direct Income' });
    const purchase = await LedgerMaster.create({ companyId, name: 'Purchase A/c', group: 'Expenses', accountType: 'General', subGroup: 'Direct Expense' });

    const mk = (entryNo, date, lines) => AccountingEntry.create({
      companyId, entryNo, entryDate: date, voucherType: 'Journal', refType: 'Journal',
      refId: new mongoose.Types.ObjectId(), status: 'Posted', lines,
    });
    // A sale: customer owes 10000 (asset), sale recognized 10000 (income).
    await mk('J1', new Date('2026-05-01T00:00:00Z'), [
      { ledgerId: custLedger._id, ledgerName: custLedger.name, type: 'Dr', amount: 10000 },
      { ledgerId: sales._id, ledgerName: sales.name, type: 'Cr', amount: 10000 },
    ]);
    // A purchase: supplier owed 4000 (liability), purchase expense 4000.
    await mk('J2', new Date('2026-05-02T00:00:00Z'), [
      { ledgerId: purchase._id, ledgerName: purchase.name, type: 'Dr', amount: 4000 },
      { ledgerId: suppLedger._id, ledgerName: suppLedger.name, type: 'Cr', amount: 4000 },
    ]);
    // Bank receives 2000 from the customer.
    await mk('J3', new Date('2026-05-03T00:00:00Z'), [
      { ledgerId: bank._id, ledgerName: bank.name, type: 'Dr', amount: 2000 },
      { ledgerId: custLedger._id, ledgerName: custLedger.name, type: 'Cr', amount: 2000 },
    ]);

    ids = { companyId };
  });

  test.after(async () => { await stopMemoryDb(); });

  test('Liabilities + Net Profit foots to Assets', async () => {
    const report = jsmReports.get('A_Final_BalanceSheet');
    const r = await report.run(String(ids.companyId), { to: '2027-03-31', orderBy: 'group', format: 'double' });

    // Assets: bank 2000 Dr + customer (10000-2000=8000 Dr) = 10000. Liabilities: supplier 4000 Cr.
    // Net profit: sales 10000 Cr - purchase 4000 Dr = 6000. 4000 + 6000 = 10000 = Assets. ✓
    const grand = (lines) => lines.filter((l) => l.type === 'grand');
    const leftGrand = grand(r.left.lines);
    const rightGrand = grand(r.right.lines);
    assert.deepEqual(leftGrand.map((l) => l.label), ['NET PROFIT', 'TOTAL']);
    assert.equal(leftGrand[0].value, 6000);
    assert.deepEqual(rightGrand.map((l) => l.label), ['TOTAL']);
    assert.equal(leftGrand[1].value, rightGrand[0].value);
    assert.equal(rightGrand[0].value, 10000);

    const names = (lines) => lines.filter((l) => l.type === 'detail').map((l) => l.label);
    const assetNames = names(r.right.lines);
    assert.ok(assetNames.includes('HDFC BANK'));
    assert.ok(assetNames.includes('MAHESH TEX'));
    const liabNames = names(r.left.lines);
    assert.ok(liabNames.includes('LALA SUPPLIER'));
    // P&L ledgers (Sales/Purchase) must not leak into either Balance Sheet side.
    assert.ok(!assetNames.includes('Sales A/c') && !liabNames.includes('Purchase A/c'));
  });

  test('refuses an uncaptured layout rather than guessing it', async () => {
    const report = jsmReports.get('A_Final_BalanceSheet');
    await assert.rejects(() => report.run(String(ids.companyId), { format: 'single' }), /not captured/);
  });
});
