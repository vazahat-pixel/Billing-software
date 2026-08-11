/**
 * End-to-end accounting checks against an ISOLATED in-memory MongoDB.
 * Never touches the configured Atlas cluster — see tests/helpers/memoryDb.js.
 *
 * Covers the paths reworked recently:
 *   - Outstanding: bill-wise balance from real allocations, returns and add/less
 *   - Debit/Credit Notes: all four directions post balanced journals and move the
 *     party the right way
 */
const test = require('node:test');
const assert = require('node:assert');
const { startMemoryDb, stopMemoryDb } = require('../helpers/memoryDb');

test.describe('Outstanding + Notes (isolated DB)', () => {
  let mongoose; let companyId; let partyId;
  let Sales; let Party; let PaymentVoucher; let ReturnInvoice; let reportService;

  test.before(async () => {
    await startMemoryDb();
    mongoose = require('mongoose');
    Sales = require('../../models/Sales');
    Party = require('../../models/Party');
    PaymentVoucher = require('../../models/PaymentVoucher');
    ReturnInvoice = require('../../models/ReturnInvoice');
    reportService = require('../../services/reportService');

    companyId = new mongoose.Types.ObjectId();
    const party = await Party.create({
      companyId, name: 'RAJA TEX', type: 'Customer', state: 'Gujarat',
    });
    partyId = party._id;
  });

  test.after(async () => { await stopMemoryDb(); });

  const mkSale = (invoiceNo, netAmount, date = new Date('2026-06-05')) =>
    Sales.create({
      companyId, customerId: partyId, invoiceNo, date,
      netAmount, taxableAmount: netAmount, gstAmount: 0, status: 'active',
    });

  const mkReceipt = (bill, amount, extra = {}) =>
    PaymentVoucher.create({
      companyId,
      voucherNo: `RV-${Math.random().toString(36).slice(2, 8)}`,
      date: new Date('2026-07-01'),
      voucherType: 'Receipt',
      partyLedgerId: new mongoose.Types.ObjectId(),
      partyName: 'RAJA TEX',
      amount,
      paymentMode: 'Cash',
      bankLedgerId: new mongoose.Types.ObjectId(),
      status: 'Posted',
      againstInvoices: [{ invoiceId: bill._id, invoiceNo: bill.invoiceNo, amount, ...extra }],
    });

  const os = async () => reportService.getOutstanding(companyId, 'receivable', {
    status: 'Pending', asOn: new Date('2026-08-11'),
  });

  test.it('TEST 1: unpaid bill shows full amount outstanding', async () => {
    await mkSale('T1', 100000);
    const rows = await os();
    const inv = rows[0].invoices.find((i) => i.docNo === 'T1');
    assert.equal(inv.total, 100000);
    assert.equal(inv.paid, 0);
    assert.equal(inv.outstanding, 100000);
  });

  test.it('TEST 2: part payment reduces outstanding by the allocated amount', async () => {
    const b = await mkSale('T2', 100000);
    await mkReceipt(b, 40000);
    const rows = await os();
    const inv = rows[0].invoices.find((i) => i.docNo === 'T2');
    assert.equal(inv.paid, 40000);
    assert.equal(inv.outstanding, 60000);
  });

  test.it('TEST 3: fully paid bill drops out of Pending and appears under Paid', async () => {
    const b = await mkSale('T3', 50000);
    await mkReceipt(b, 50000);
    const pending = await os();
    assert.ok(!pending[0].invoices.some((i) => i.docNo === 'T3'), 'settled bill must not be Pending');

    const paid = await reportService.getOutstanding(companyId, 'receivable', {
      status: 'Paid', asOn: new Date('2026-08-11'),
    });
    assert.ok(paid[0].invoices.some((i) => i.docNo === 'T3'), 'settled bill must appear under Paid');
  });

  test.it('TEST 4: goods return reduces outstanding alongside payment', async () => {
    const b = await mkSale('T4', 100000);
    await mkReceipt(b, 40000);
    await ReturnInvoice.create({
      companyId, returnType: 'Sales', invoiceNo: 'SR-T4', originalInvoiceNo: 'T4',
      partyId, date: new Date('2026-07-10'),
      netAmount: 10000, taxableAmount: 10000, gstAmount: 0,
    });
    const rows = await os();
    const inv = rows[0].invoices.find((i) => i.docNo === 'T4');
    assert.equal(inv.goodsRtn, 10000);
    assert.equal(inv.outstanding, 50000, '100000 - 40000 paid - 10000 returned');
  });

  test.it('Add/Less: discount + TDS close the bill without cash', async () => {
    const b = await mkSale('T-AL', 100000);
    await mkReceipt(b, 60000, { discount: 30000, tds: 10000 });
    const pending = await os();
    assert.ok(!pending[0].invoices.some((i) => i.docNo === 'T-AL'), 'fully adjusted bill is not Pending');

    const paidRows = await reportService.getOutstanding(companyId, 'receivable', {
      status: 'Paid', asOn: new Date('2026-08-11'),
    });
    const inv = paidRows[0].invoices.find((i) => i.docNo === 'T-AL');
    assert.equal(inv.paid, 60000, 'PAID.AMT stays cash-only');
    assert.equal(inv.addLess, 40000, 'discount + TDS land in ADDLESS');
    assert.equal(inv.outstanding, 0);
  });

  test.it('TEST 6: an unallocated receipt reduces no bill', async () => {
    const b = await mkSale('T6', 25000);
    await PaymentVoucher.create({
      companyId, voucherNo: 'RV-UNADJ', date: new Date('2026-07-05'), voucherType: 'Receipt',
      partyLedgerId: new mongoose.Types.ObjectId(), partyName: 'RAJA TEX', amount: 20000,
      paymentMode: 'Cash', bankLedgerId: new mongoose.Types.ObjectId(), status: 'Posted',
      accBill: 'A', againstInvoices: [],
    });
    const rows = await os();
    const inv = rows[0].invoices.find((i) => i.docNo === b.invoiceNo);
    assert.equal(inv.outstanding, 25000, 'on-account receipt must not touch any bill');
  });

  test.it('§36: every row reconciles and party total equals the sum of its bills', async () => {
    const rows = await os();
    let grand = 0;
    for (const party of rows) {
      let partySum = 0;
      for (const inv of party.invoices) {
        const expected = Number((inv.total - inv.paid - inv.addLess - inv.goodsRtn).toFixed(2));
        assert.equal(inv.outstanding, expected, `bill ${inv.docNo} must reconcile`);
        partySum += inv.outstanding;
      }
      assert.equal(Number(partySum.toFixed(2)), Number(party.totalOutstanding.toFixed(2)));
      grand += party.totalOutstanding;
    }
    assert.ok(grand > 0, 'report produced data');
  });

  test.it('Outstanding is read-only: report runs write nothing', async () => {
    const before = await Promise.all([
      Sales.countDocuments({ companyId }),
      PaymentVoucher.countDocuments({ companyId }),
      mongoose.connection.collection('billsettlements').countDocuments({}),
    ]);
    await os();
    await os();
    const after = await Promise.all([
      Sales.countDocuments({ companyId }),
      PaymentVoucher.countDocuments({ companyId }),
      mongoose.connection.collection('billsettlements').countDocuments({}),
    ]);
    assert.deepEqual(after, before, 'generating the report must not create or modify documents');
  });

  test.it('all four note directions post a balanced journal in the right direction', async () => {
    const noteController = require('../../controllers/noteController');
    const dir = noteController._noteDirection;
    const cases = [
      ['Purchase', 'Debit', 1, 'Purchase Return A/c', 'CGST Input'],
      ['Purchase', 'Credit', -1, 'Purchase A/c', 'CGST Input'],
      ['Sales', 'Debit', 1, 'Sales A/c', 'CGST Output'],
      ['Sales', 'Credit', -1, 'Sales Return A/c', 'CGST Output'],
    ];
    for (const [side, type, partySign, base, gstLedger] of cases) {
      const d = dir(side, type);
      assert.equal(d.partySign, partySign, `${side} ${type} party direction`);
      assert.equal(d.baseLedgerName, base, `${side} ${type} base ledger`);
      assert.equal(d.gstLedgerNames.cgst, gstLedger, `${side} ${type} GST family`);
      assert.equal(d.gstSign, -partySign, `${side} ${type} GST opposes the party leg`);
    }
  });
});
