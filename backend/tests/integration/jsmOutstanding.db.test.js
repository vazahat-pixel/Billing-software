/**
 * JSM's Outstanding family against a real (in-memory) database: proves the presentation layer
 * (services/jsmReports/outstandingReport.js) wires correctly into the real, already-proven
 * reportService.getOutstanding() engine — not just against stubbed rows.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startMemoryDb, stopMemoryDb } = require('../helpers/memoryDb');

test.describe('JSM Outstanding on a real database', () => {
  let jsmReports; let ids;

  test.before(async () => {
    await startMemoryDb();
    const mongoose = require('mongoose');
    const Company = require('../../models/Company');
    const Party = require('../../models/Party');
    const Item = require('../../models/Item');
    const Book = require('../../models/Book');
    const outstandingEngine = require('../../services/outstandingEngineService');
    jsmReports = require('../../services/jsmReports');

    const companyId = new mongoose.Types.ObjectId();
    await Company.collection.insertOne({ _id: companyId, name: 'OS CO', coCode: 'OC', createdAt: new Date() });
    const cust = await Party.create({ companyId, name: 'ZETA FABRICS', type: 'Customer', group: 'DEBTORS', city: 'SURAT' });
    const worker = await Party.create({ companyId, name: 'ETA JOBWORKER', type: 'Job Worker', group: 'JOBWORKERS', city: 'ICHALKARANJI' });
    const item = await Item.create({ companyId, name: 'POLY 90', group: 'GREY', category: 'Grey' });
    const sBook = await Book.create({ companyId, name: 'SALES MAIN', code: 'SM', module: 'sales' });
    ids = { companyId, custId: cust._id, workerId: worker._id };

    // A sale, partially paid — a real BillSettlement row via the real sync path.
    const mongooseDb = mongoose.connection.db;
    const saleId = new mongoose.Types.ObjectId();
    const sale = {
      _id: saleId, companyId, customerId: cust._id, bookId: sBook._id, invoiceNo: '501',
      date: new Date('2026-08-01T00:00:00Z'), status: 'active',
      items: [{ itemId: item._id, pcs: 5, mts: 50, rate: 20, amount: 1000, unit: 'MTRS', gstPer: 5 }],
      taxableAmount: 1000, gstAmount: 50, netAmount: 1050, paidAmount: 400,
      createdAt: new Date(), updatedAt: new Date(),
    };
    await mongooseDb.collection('sales').insertOne(sale);
    await outstandingEngine.syncBillFromSales(companyId, sale);

    // Outstanding's `paid` comes from posted PaymentVoucher.againstInvoices, not from the bill's own
    // paidAmount field (that field is informational — see reportService.js's settlementsByBill).
    const PaymentVoucher = require('../../models/PaymentVoucher');
    const LedgerMaster = require('../../models/LedgerMaster');
    const partyLedger = await LedgerMaster.create({ companyId, name: 'ZETA FABRICS', group: 'Assets', accountType: 'Party' });
    const cashLedger = await LedgerMaster.create({ companyId, name: 'CASH BOOK TEST', group: 'Assets', accountType: 'Cash' });
    await PaymentVoucher.create({
      companyId, voucherNo: 'RC-1', date: new Date('2026-08-10T00:00:00Z'), voucherType: 'Receipt',
      partyLedgerId: partyLedger._id, partyName: 'ZETA FABRICS', bankLedgerId: cashLedger._id,
      paymentMode: 'Cash', amount: 400, status: 'Posted',
      againstInvoices: [{ invoiceId: saleId, invoiceNo: '501', billAmt: 1050, amount: 400 }],
    });

    // A job work challan with a process bill, partially paid — the Job-based outstanding path.
    const Job = require('../../models/Job');
    await Job.create({
      companyId, workerId: worker._id, workKind: 'Job', processType: 'Job Work',
      jobCardNo: 'JC-1', challanNo: 'JW-77', lotId: new mongoose.Types.ObjectId(),
      issueDate: new Date('2026-08-05T00:00:00Z'), receiveDate: new Date('2026-08-12T00:00:00Z'),
      issueQty: 50, issuePcs: 5, receivedQty: 48, receivedPcs: 5, status: 'Received',
      processBillNo: 'JW-77', processBillDate: new Date('2026-08-12T00:00:00Z'),
      processCharges: 500, processGstAmount: 25, chargesPaidAmount: 200,
    });
  });

  test.after(async () => { await stopMemoryDb(); });

  const P = { from: '2026-04-01', to: '2027-03-31' };

  test.it('Debitor O/s shows the real BillSettlement outstanding, not a recomputation', async () => {
    const r = await jsmReports.get('Rpt_Jsm_Os_Sales').run(ids.companyId, P);
    assert.equal(r.rows.length, 1);
    const row = r.rows[0];
    assert.equal(row.PARTY, 'ZETA FABRICS');
    assert.equal(row.NCBILL_NO, '501');
    assert.equal(row.NET_TOT, 1050);
    assert.equal(row.ADJUST, 400);
    assert.equal(row.TOT_BALANCE, 650, '1050 billed - 400 paid, exactly what BillSettlement holds');
  });

  test.it('Jobwork O/s reads Job.processCharges/chargesPaidAmount, the same figures reportService already uses', async () => {
    const r = await jsmReports.get('Rpt_Jsm_Os_Jobwork').run(ids.companyId, P);
    assert.equal(r.rows.length, 1);
    const row = r.rows[0];
    assert.equal(row.PARTY, 'ETA JOBWORKER');
    assert.equal(row.NCBILL_NO, 'JW-77');
    assert.equal(row.NET_TOT, 525, '500 charges + 25 GST');
    assert.equal(row.ADJUST, 200);
    assert.equal(row.TOT_BALANCE, 325);
  });

  test.it('Sales Age Analysis bucket matches the bill\'s own age', async () => {
    const r = await jsmReports.get('Rpt_Jsm_Os_Sales_AgeAnalysis').run(ids.companyId, { ...P, asOn: '2026-08-20' });
    assert.equal(r.rows.length, 1);
    const row = r.rows[0];
    // 2026-08-01 to 2026-08-20 = 19 days -> bucket 0-30
    assert.equal(row.BAL_AMT1, 650);
    assert.equal(row.BAL_AMT2 + row.BAL_AMT3 + row.BAL_AMT4, 0);
    assert.equal(row.TOT_BALANCE, 650);
  });

  test.it('options lists come from the real parties on this database', async () => {
    const o = await jsmReports.get('Rpt_Jsm_Os_Sales').options(ids.companyId);
    assert.deepEqual(o.parties, ['ZETA FABRICS']);
  });
});
