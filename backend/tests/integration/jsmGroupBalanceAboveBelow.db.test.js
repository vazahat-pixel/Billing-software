/**
 * JSM: Reports › Final Reports › Group List (Rpt_Group_Balance) and
 *      Reports › Fas Reports › Above Below Rs. (Rpt_Above_Below)
 * against a real (in-memory) database.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startMemoryDb, stopMemoryDb } = require('../helpers/memoryDb');

test.describe('JSM Group List and Above/Below on a real database', () => {
  let jsmReports; let companyId;

  test.before(async () => {
    await startMemoryDb();
    const mongoose = require('mongoose');
    const Company = require('../../models/Company');
    const Party = require('../../models/Party');
    const LedgerMaster = require('../../models/LedgerMaster');
    const AccountingEntry = require('../../models/AccountingEntry');
    const PaymentVoucher = require('../../models/PaymentVoucher');
    jsmReports = require('../../services/jsmReports');

    companyId = new mongoose.Types.ObjectId();
    await Company.collection.insertOne({ _id: companyId, name: 'GB CO', coCode: 'GB', createdAt: new Date() });

    const cust = await Party.create({ companyId, name: 'MAHESH TEX', type: 'Customer', group: 'DEBTORS', city: 'SURAT' });
    const custLedger = await LedgerMaster.create({ companyId, name: 'MAHESH TEX', group: 'Assets', accountType: 'Party', linkedPartyId: cust._id });
    const bank = await LedgerMaster.create({ companyId, name: 'HDFC BANK', group: 'Assets', accountType: 'Bank' });

    await AccountingEntry.create({
      companyId, entryNo: 'J1', entryDate: new Date('2026-05-10T00:00:00Z'),
      voucherType: 'Journal', refType: 'Journal', refId: new mongoose.Types.ObjectId(), status: 'Posted',
      lines: [
        { ledgerId: custLedger._id, ledgerName: custLedger.name, type: 'Dr', amount: 7000 },
        { ledgerId: bank._id, ledgerName: bank.name, type: 'Cr', amount: 7000 },
      ],
    });

    await PaymentVoucher.create({
      companyId, voucherNo: 'RC-1', date: new Date('2026-06-01T00:00:00Z'), voucherType: 'Receipt',
      partyLedgerId: custLedger._id, partyName: 'MAHESH TEX', bankLedgerId: bank._id,
      paymentMode: 'Cash', amount: 2500, status: 'Posted',
    });
    await PaymentVoucher.create({
      companyId, voucherNo: 'RC-2', date: new Date('2026-06-02T00:00:00Z'), voucherType: 'Receipt',
      partyLedgerId: custLedger._id, partyName: 'SMALL PARTY', bankLedgerId: bank._id,
      paymentMode: 'Cash', amount: 100, status: 'Posted',
    });
  });

  test.after(async () => { await stopMemoryDb(); });

  test('Group List shows one signed balance per account, under its head', async () => {
    const r = await jsmReports.get('Rpt_Group_Balance').run(String(companyId), { to: '2027-03-31', toText: '31/03/2027' });
    const mahesh = r.rows.find((x) => x.AC_NAME === 'MAHESH TEX');
    assert.ok(mahesh);
    assert.equal(mahesh.DRCR_BAL1, 7000);
    assert.equal(mahesh.GRAC_HEAD, 'SUNDRY DEBTORS');
    const hdfc = r.rows.find((x) => x.AC_NAME === 'HDFC BANK');
    assert.equal(hdfc.DRCR_BAL1, -7000, 'a credit balance comes back negative, as JSM\'s DR−CR does');
    assert.deepEqual(r.grid.groupColumns, ['GRAC_HEAD']);
    assert.match(r.grid.title, /^Group List Balance {2}As On Date /);
  });

  test('Group List can be narrowed to chosen heads', async () => {
    const r = await jsmReports.get('Rpt_Group_Balance')
      .run(String(companyId), { to: '2027-03-31', heads: ['SUNDRY DEBTORS'] });
    assert.deepEqual([...new Set(r.rows.map((x) => x.GRAC_HEAD))], ['SUNDRY DEBTORS']);
  });

  test('Above/Below lists the cash receipts over an amount, and under it', async () => {
    const above = await jsmReports.get('Rpt_Above_Below')
      .run(String(companyId), { source: 5, direction: 'A', amount: 1000, from: '2026-04-01', to: '2027-03-31' });
    assert.deepEqual(above.rows.map((x) => [x.AC_NAME, x.AC_TOTAL]), [['MAHESH TEX', 2500]]);

    const below = await jsmReports.get('Rpt_Above_Below')
      .run(String(companyId), { source: 5, direction: 'B', amount: 1000, from: '2026-04-01', to: '2027-03-31' });
    assert.deepEqual(below.rows.map((x) => [x.AC_NAME, x.AC_TOTAL]), [['SMALL PARTY', 100]]);
  });

  test('Above/Below refuses the sources whose totals are not wired yet', async () => {
    for (const source of [3, 4]) {
      await assert.rejects(
        () => jsmReports.get('Rpt_Above_Below').run(String(companyId), { source }),
        /not wired into this report yet/
      );
    }
  });
});

test.describe('JSM Voucher Book on a real database', () => {
  let jsmReports; let companyId;

  test.before(async () => {
    await startMemoryDb();
    const mongoose = require('mongoose');
    const Company = require('../../models/Company');
    const LedgerMaster = require('../../models/LedgerMaster');
    const AccountingEntry = require('../../models/AccountingEntry');
    jsmReports = require('../../services/jsmReports');

    companyId = new mongoose.Types.ObjectId();
    await Company.collection.insertOne({ _id: companyId, name: 'JV CO', coCode: 'JV', createdAt: new Date() });
    const a = await LedgerMaster.create({ companyId, name: 'RENT', group: 'Expenses', accountType: 'General' });
    const b = await LedgerMaster.create({ companyId, name: 'CASH', group: 'Assets', accountType: 'Cash' });

    await AccountingEntry.create({
      companyId, entryNo: '1', entryDate: new Date('2026-05-05T00:00:00Z'),
      voucherType: 'Journal', refType: 'Journal', refId: new mongoose.Types.ObjectId(), status: 'Posted',
      lines: [
        { ledgerId: a._id, ledgerName: 'RENT', type: 'Dr', amount: 5000 },
        { ledgerId: b._id, ledgerName: 'CASH', type: 'Cr', amount: 5000 },
      ],
    });
  });

  test.after(async () => { await stopMemoryDb(); });

  test('Detail lists a row per journal line, with its own Dr/Cr side', async () => {
    const r = await jsmReports.get('Rpt_JvBook1')
      .run(String(companyId), { voucherType: 'JV', from: '2026-04-01', to: '2027-03-31' });
    assert.deepEqual(
      r.rows.map((x) => [x.SRAL_NO, x.J_NAME, x.R_P, x.AMOUNT]),
      [['1', 'CASH', 'C', 5000], ['1', 'RENT', 'D', 5000]]
    );
    assert.equal(r.grid.title, 'Journal Voucher Book');
  });

  test('Summary totals each account instead', async () => {
    const r = await jsmReports.get('Rpt_JvBook1')
      .run(String(companyId), { voucherType: 'JV', summary: true, from: '2026-04-01', to: '2027-03-31' });
    assert.deepEqual(r.rows.map((x) => [x.J_NAME, x.AMOUNT]), [['CASH', 5000], ['RENT', 5000]]);
    assert.match(r.grid.title, /\[Summary\]$/);
  });

  test('an unknown voucher type is refused', async () => {
    await assert.rejects(
      () => jsmReports.get('Rpt_JvBook1').run(String(companyId), { voucherType: 'XX' }),
      /Unknown voucher type/
    );
  });
});
