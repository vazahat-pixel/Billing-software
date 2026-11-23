/**
 * JSM: Reports › Fas Reports › Bank / Cash Book › Bank Book / Cash Book (Rpt_cashbank1) against a
 * real (in-memory) database — proves services/jsmReports/reports/cashBank.js wires into
 * ledgerEngineService.getStatement() and matches the owner's own two printed Cash_Bank_Report.pdf
 * runs (03/11/2026): the Closing Balance row's Receipt/Payment cells are the period's totals, an
 * inactive side is blank (not "0.00") on a detail row, a bill-settling voucher gets an indented
 * "Bill No.:X" line, and the Z-Dtl+VNo variant adds the voucher's own number as Vno.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startMemoryDb, stopMemoryDb } = require('../helpers/memoryDb');

test.describe('JSM Cash/Bank Report on a real database', () => {
  let jsmReports; let ids;

  test.before(async () => {
    await startMemoryDb();
    const mongoose = require('mongoose');
    const Company = require('../../models/Company');
    const Party = require('../../models/Party');
    const LedgerMaster = require('../../models/LedgerMaster');
    const PaymentVoucher = require('../../models/PaymentVoucher');
    jsmReports = require('../../services/jsmReports');

    const companyId = new mongoose.Types.ObjectId();
    await Company.collection.insertOne({ _id: companyId, name: 'CB CO', coCode: 'CB', createdAt: new Date() });

    const party = await Party.create({ companyId, name: 'MAHESH TEX', type: 'Customer', group: 'DEBTORS', city: 'SURAT' });
    const partyLedger = await LedgerMaster.create({ companyId, name: 'MAHESH TEX', group: 'Assets', accountType: 'Party', linkedPartyId: party._id });
    const cash = await LedgerMaster.create({ companyId, name: 'CASH BOOK', group: 'Assets', accountType: 'Cash' });
    const hdfc = await LedgerMaster.create({ companyId, name: 'HDFC BANK', group: 'Assets', accountType: 'Bank' });

    const saleId = new mongoose.Types.ObjectId();
    // A plain bank-transfer receipt: no bill settled, just moves money — gets the bank-name subline.
    const rv1 = await PaymentVoucher.create({
      companyId, voucherNo: '1', date: new Date('2026-07-22T00:00:00Z'), voucherType: 'Receipt',
      partyLedgerId: hdfc._id, partyName: 'HDFC BANK', bankLedgerId: hdfc._id, bookName: 'ABN AMRO B',
      paymentMode: 'NEFT', amount: 10, status: 'Posted',
    });
    // A bill-settling receipt — gets the "Bill No.:9" subline.
    const rv2 = await PaymentVoucher.create({
      companyId, voucherNo: '2', date: new Date('2026-08-10T00:00:00Z'), voucherType: 'Receipt',
      partyLedgerId: partyLedger._id, partyName: 'MAHESH TEX', bankLedgerId: cash._id,
      paymentMode: 'Cash', amount: 5000, status: 'Posted',
      againstInvoices: [{ invoiceId: saleId, invoiceNo: '9', billAmt: 5000, amount: 5000 }],
    });

    const AccountingEntry = require('../../models/AccountingEntry');
    await AccountingEntry.create({
      companyId, entryNo: rv1.voucherNo, entryDate: rv1.date, voucherType: 'Receipt', refType: 'Receipt', refId: rv1._id, status: 'Posted',
      lines: [
        { ledgerId: cash._id, ledgerName: cash.name, type: 'Dr', amount: 10 },
        { ledgerId: hdfc._id, ledgerName: hdfc.name, type: 'Cr', amount: 10 },
      ],
    });
    await AccountingEntry.create({
      companyId, entryNo: rv2.voucherNo, entryDate: rv2.date, voucherType: 'Receipt', refType: 'Receipt', refId: rv2._id, status: 'Posted',
      lines: [
        { ledgerId: cash._id, ledgerName: cash.name, type: 'Dr', amount: 5000 },
        { ledgerId: partyLedger._id, ledgerName: partyLedger.name, type: 'Cr', amount: 5000 },
      ],
    });

    ids = { companyId };
  });

  test.after(async () => { await stopMemoryDb(); });

  test('Opening + postings + Closing, Closing carrying period totals', async () => {
    const report = jsmReports.get('Rpt_cashbank1');
    const r = await report.run(String(ids.companyId), {
      accounts: ['CASH BOOK'], from: '2026-04-01', to: '2027-03-31',
    });

    assert.equal(r.rows[0].DESCRIPTION, 'Opening Balance :');
    assert.equal(r.rows[0].RECEIPT, '0.00');
    const closing = r.rows[r.rows.length - 1];
    assert.equal(closing.DESCRIPTION, 'Closing Balance :');
    assert.equal(closing.RECEIPT, '5010.00');
    assert.equal(closing.PAYMENT, '0.00');
    assert.equal(closing.BALANCE, '5010.00 Dr');
  });

  test('inactive side is blank on a detail row, not "0.00"', async () => {
    const report = jsmReports.get('Rpt_cashbank1');
    const r = await report.run(String(ids.companyId), { accounts: ['CASH BOOK'], from: '2026-04-01', to: '2027-03-31' });
    const hdfcRow = r.rows.find((row) => row.DESCRIPTION === 'HDFC BANK');
    assert.equal(hdfcRow.RECEIPT, '10.00');
    assert.equal(hdfcRow.PAYMENT, '');
  });

  test('a bill-settling row gets an indented "Bill No.:X" line; a bank transfer gets the bank name', async () => {
    const report = jsmReports.get('Rpt_cashbank1');
    const r = await report.run(String(ids.companyId), { accounts: ['CASH BOOK'], from: '2026-04-01', to: '2027-03-31' });
    const texIdx = r.rows.findIndex((row) => row.DESCRIPTION === 'MAHESH TEX');
    assert.ok(r.rows[texIdx + 1].DESCRIPTION.includes('Bill No.:9'));
    const hdfcIdx = r.rows.findIndex((row) => row.DESCRIPTION === 'HDFC BANK');
    assert.ok(r.rows[hdfcIdx + 1].DESCRIPTION.includes('HDFC BANK'));
  });

  test('Z-Dtl+VNo carries the voucher\'s own number as Vno', async () => {
    const report = jsmReports.get('Rpt_cashbank1');
    const r = await report.run(String(ids.companyId), {
      accounts: ['CASH BOOK'], from: '2026-04-01', to: '2027-03-31', variant: 'dtlvno',
    });
    const texRow = r.rows.find((row) => row.DESCRIPTION === 'MAHESH TEX');
    assert.equal(texRow.VNO, '2');
    assert.equal(r.grid.layout, 'JSM_VW_CASHBANK_DTLVNO');
  });

  test('refuses Y-Summary (not captured)', async () => {
    const report = jsmReports.get('Rpt_cashbank1');
    await assert.rejects(() => report.run(String(ids.companyId), { accounts: ['CASH BOOK'], variant: 'summary' }), /not captured/);
  });
});
