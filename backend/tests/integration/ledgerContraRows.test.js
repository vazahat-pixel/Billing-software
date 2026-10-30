/**
 * Ledger statement rows of a voucher where the party has a bank line and a discount line (as JSM records a receipt
 * with discount): one row per party line, labelled with its own opposite account — not every line split across
 * every opposite account.
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { bootIsolatedApp } = require('../helpers/isolatedApp');

describe('ledger statement: one row per line, with its own opposite account (isolated DB)', () => {
  let shutdown; let engine; let companyId; let party; let bank; let disc;

  before(async () => {
    ({ shutdown } = await bootIsolatedApp());
    engine = require('../../services/ledgerEngineService');
    const LedgerMaster = require('../../models/LedgerMaster');
    const AccountingEntry = require('../../models/AccountingEntry');
    companyId = new mongoose.Types.ObjectId();
    const mk = (name, accountType, group) => ({ _id: new mongoose.Types.ObjectId(), companyId, name, accountType, group, openingBalance: 0, openingBalanceType: 'Dr', isActive: true, isDeleted: false });
    [party, bank, disc] = [mk('NABARIA TEXTILE', 'Party', 'Assets'), mk('KOTAK BANK', 'Bank', 'Assets'), mk('DISCOUNT ACCOUNT', 'General', 'Expenses')];
    await LedgerMaster.collection.insertMany([party, bank, disc]);
    const base = { companyId, voucherType: 'Receipt', refType: 'Receipt', status: 'Posted', isReversed: false, isDeleted: false, entryDate: new Date('2026-05-29'), createdAt: new Date('2026-05-29') };
    const line = (l, type, amount, extra = {}) => ({ ledgerId: l._id, ledgerName: l.name, type, amount, ...extra });
    await AccountingEntry.collection.insertMany([
      // imported: each line names its opposite account
      { ...base, entryNo: 'JSM-1', lines: [line(bank, 'Dr', 26550.53, { contraName: 'NABARIA TEXTILE' }), line(party, 'Cr', 26550.53, { contraName: 'KOTAK BANK' }), line(disc, 'Dr', 1421.47, { contraName: 'NABARIA TEXTILE' }), line(party, 'Cr', 1421.47, { contraName: 'DISCOUNT ACCOUNT' })], totalDebit: 27972, totalCredit: 27972 },
      // imported earlier, without the opposite account on the lines: paired by equal amount
      { ...base, entryNo: 'JSM-2', lines: [line(bank, 'Dr', 900), line(party, 'Cr', 900), line(disc, 'Dr', 100), line(party, 'Cr', 100)], totalDebit: 1000, totalCredit: 1000 },
      // made in the app: one party line against bank + discount -> still split (unchanged)
      { ...base, entryNo: 'RCT-3', lines: [line(bank, 'Dr', 450), line(disc, 'Dr', 50), line(party, 'Cr', 500)], totalDebit: 500, totalCredit: 500 },
    ]);
  });
  after(async () => { if (shutdown) await shutdown(); });

  it('two party lines -> two rows, Bank and Discount, amounts unchanged', async () => {
    const st = await engine.getStatement(companyId, party._id, {});
    const rows = (st.statement || st.rows || st).filter((r) => r.voucherNo === 'JSM-1').map((r) => `${r.particulars}:${r.credit}`);
    assert.deepEqual(rows, ['KOTAK BANK:26550.53', 'DISCOUNT ACCOUNT:1421.47']);
    const rows2 = (st.statement || st.rows || st).filter((r) => r.voucherNo === 'JSM-2').map((r) => `${r.particulars}:${r.credit}`);
    assert.deepEqual(rows2, ['KOTAK BANK:900', 'DISCOUNT ACCOUNT:100']);
  });

  it('a voucher made in the app (one party line) is shown as before', async () => {
    const st = await engine.getStatement(companyId, party._id, {});
    const rows = (st.statement || st.rows || st).filter((r) => r.voucherNo === 'RCT-3').map((r) => `${r.particulars}:${r.credit}`);
    assert.deepEqual(rows, ['KOTAK BANK:450', 'DISCOUNT ACCOUNT:50']);
  });
});
