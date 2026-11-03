/**
 * JSM: Reports › Fas Reports › Ledger (A_AccountLedgerSingleSide) against a real (in-memory)
 * database: proves the wrapper (services/jsmReports/reports/ledger.js) wires correctly into the
 * software's own ledgerEngineService.getStatement() — the same engine behind the app's Ledger
 * Statement screen — not just against stubbed rows.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startMemoryDb, stopMemoryDb } = require('../helpers/memoryDb');

test.describe('JSM Ledger on a real database', () => {
  let jsmReports; let ids;

  test.before(async () => {
    await startMemoryDb();
    const mongoose = require('mongoose');
    const Company = require('../../models/Company');
    const LedgerMaster = require('../../models/LedgerMaster');
    const AccountingEntry = require('../../models/AccountingEntry');
    jsmReports = require('../../services/jsmReports');

    const companyId = new mongoose.Types.ObjectId();
    await Company.collection.insertOne({ _id: companyId, name: 'LEDGER CO', coCode: 'LC', createdAt: new Date() });

    const partyLedger = await LedgerMaster.create({
      companyId, name: 'OMKAR TEX', group: 'Assets', accountType: 'Party', openingBalance: 1000, openingBalanceType: 'Dr',
    });
    const salesLedger = await LedgerMaster.create({ companyId, name: 'Sales A/c', group: 'Income', accountType: 'General' });
    const cashLedger = await LedgerMaster.create({ companyId, name: 'CASH', group: 'Assets', accountType: 'Cash' });

    await AccountingEntry.create({
      companyId, entryNo: 'SL-1', entryDate: new Date('2026-05-10T00:00:00Z'),
      voucherType: 'Sales', refType: 'SalesInvoice', refId: new mongoose.Types.ObjectId(), status: 'Posted',
      lines: [
        { ledgerId: partyLedger._id, ledgerName: partyLedger.name, type: 'Dr', amount: 5000 },
        { ledgerId: salesLedger._id, ledgerName: salesLedger.name, type: 'Cr', amount: 5000 },
      ],
    });
    await AccountingEntry.create({
      companyId, entryNo: 'RC-1', entryDate: new Date('2026-05-20T00:00:00Z'),
      voucherType: 'Receipt', refType: 'Receipt', refId: new mongoose.Types.ObjectId(), status: 'Posted',
      lines: [
        { ledgerId: cashLedger._id, ledgerName: cashLedger.name, type: 'Dr', amount: 3000 },
        { ledgerId: partyLedger._id, ledgerName: partyLedger.name, type: 'Cr', amount: 3000 },
      ],
    });

    ids = { companyId, partyLedgerId: partyLedger._id };
  });

  test.after(async () => { await stopMemoryDb(); });

  test('shows opening, both postings and closing, matching ledgerEngineService exactly', async () => {
    const report = jsmReports.get('A_AccountLedgerSingleSide');
    const direct = await require('../../services/ledgerEngineService').getStatement(
      String(ids.companyId), 'OMKAR TEX', { from: '2026-04-01', to: '2027-03-31' }
    );

    const r = await report.run(String(ids.companyId), {
      ledgers: ['OMKAR TEX'], from: '2026-04-01', to: '2027-03-31',
    });

    assert.equal(r.rows.length, direct.statement.length + 2, 'opening + each posting + closing');
    const opening = r.rows[0];
    const closing = r.rows[r.rows.length - 1];
    assert.equal(opening.BOOK_name, 'OPENING BALANCE');
    assert.equal(opening.DR_AMOUNT, direct.openingBalance);
    assert.equal(opening.CLOSING_DRCR, direct.openingBalanceType);
    assert.equal(closing.BOOK_name, 'CLOSING BALANCE');
    assert.equal(closing.CLOSING_BAL, direct.closingBalance);
    assert.equal(closing.CLOSING_DRCR, direct.closingBalanceType);

    // 1000 Dr opening + 5000 Dr sale - 3000 Cr receipt = 3000 Dr
    assert.equal(direct.closingBalance, 3000);
    assert.equal(direct.closingBalanceType, 'Dr');

    const sale = r.rows[1];
    assert.equal(sale.DR_AMOUNT, 5000);
    assert.equal(sale.BOOK_name, 'SALES BOOK');
    const receipt = r.rows[2];
    assert.equal(receipt.CR_AMOUNT, 3000);

    assert.equal(r.grid.layout, 'JSM_VW_LEDGER_ACCOUNT');
  });

  test('refuses to run with no account selected', async () => {
    const report = jsmReports.get('A_AccountLedgerSingleSide');
    await assert.rejects(() => report.run(String(ids.companyId), { ledgers: [] }), /Select at least one account/);
  });

  test('A_AccountLedgerDoubleSide (T-Format / Confirmation) shares the same engine', async () => {
    const report = jsmReports.get('A_AccountLedgerDoubleSide');
    const r = await report.run(String(ids.companyId), { ledgers: ['OMKAR TEX'], from: '2026-04-01', to: '2027-03-31' });
    assert.equal(r.rows[r.rows.length - 1].CLOSING_BAL, 3000);
  });
});
