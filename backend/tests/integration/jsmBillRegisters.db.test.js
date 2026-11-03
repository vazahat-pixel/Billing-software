/**
 * The JSM bill registers against a real (in-memory) database: the loaders' queries, populate paths
 * and status filters, end to end, rather than rows handed to the report.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startMemoryDb, stopMemoryDb } = require('../helpers/memoryDb');

test.describe('JSM bill registers on a real database', () => {
  let regs; let ids;

  test.before(async () => {
    await startMemoryDb();
    const mongoose = require('mongoose');
    const Company = require('../../models/Company');
    const Party = require('../../models/Party');
    const Item = require('../../models/Item');
    const Book = require('../../models/Book');
    regs = require('../../services/jsmReports/reports/billRegisters');

    const companyId = new mongoose.Types.ObjectId();
    await Company.collection.insertOne({ _id: companyId, name: 'REG CO', coCode: 'RC', createdAt: new Date() });
    const cust = await Party.create({ companyId, name: 'GAMMA FABRICS', type: 'Customer', group: 'DEBTORS', city: 'SURAT' });
    const supp = await Party.create({ companyId, name: 'DELTA WEAVERS', type: 'Supplier', group: 'CREDITORS', city: 'BHIWANDI' });
    const brk = await Party.create({ companyId, name: 'EPSILON BROKER', type: 'Broker' });
    const item = await Item.create({ companyId, name: 'RAYON 92', group: 'GREY', category: 'Grey' });
    const sBook = await Book.create({ companyId, name: 'SALES MAIN', code: 'SM', module: 'sales' });
    const pBook = await Book.create({ companyId, name: 'PURCHASE MAIN', code: 'PM', module: 'purchase' });
    ids = { companyId };

    const line = { itemId: item._id, pcs: 4, mts: 40, rate: 25, amount: 1000, unit: 'MTRS', gstPer: 5 };
    const db = mongoose.connection.db;
    const base = { companyId, date: new Date('2026-07-01T00:00:00Z'), items: [line], createdAt: new Date(), updatedAt: new Date() };

    await db.collection('sales').insertMany([
      { ...base, _id: new mongoose.Types.ObjectId(), invoiceNo: '101', customerId: cust._id, brokerId: brk._id, bookId: sBook._id, station: 'RING ROAD',
        status: 'active', taxableAmount: 1080, gstAmount: 54, netAmount: 1134, totalAdd: 100, totalLess: 20 },
      // cancelled — must not appear
      { ...base, _id: new mongoose.Types.ObjectId(), invoiceNo: '102', customerId: cust._id, bookId: sBook._id,
        status: 'cancelled', taxableAmount: 1000, gstAmount: 50, netAmount: 1050 },
    ]);
    await db.collection('purchases').insertMany([
      { ...base, _id: new mongoose.Types.ObjectId(), invoiceNo: '7', supplierInvoiceNo: 'DW/55', supplierId: supp._id, bookId: pBook._id,
        status: 'active', freightAmount: 50, discountAmt: 30, discountSign: '-', taxableAmount: 1020, gstAmount: 51, netAmount: 1071 },
      // soft-deleted — must not appear
      { ...base, _id: new mongoose.Types.ObjectId(), invoiceNo: '8', supplierId: supp._id, bookId: pBook._id,
        status: 'active', isDeleted: true, taxableAmount: 1000, gstAmount: 50, netAmount: 1050 },
    ]);
    await db.collection('returninvoices').insertMany([
      { ...base, _id: new mongoose.Types.ObjectId(), returnType: 'Sales', invoiceNo: 'SR-1', partyId: cust._id, taxableAmount: 1000, gstAmount: 50, netAmount: 1050 },
      { ...base, _id: new mongoose.Types.ObjectId(), returnType: 'Purchase', invoiceNo: 'PR-1', partyId: supp._id, taxableAmount: 1000, gstAmount: 50, netAmount: 1050 },
    ]);
  });

  test.after(async () => { await stopMemoryDb(); });

  const P = { from: '2026-04-01', to: '2027-03-31' };

  test.it('sales register reads the bill, party, broker, book and keeps JSM\'s Add/Less split', async () => {
    const r = await regs.sales.run(ids.companyId, { ...P, detail: true });
    assert.equal(r.rows.length, 1, 'the cancelled bill is left out');
    const row = r.rows[0];
    assert.equal(row.PARTY, 'GAMMA FABRICS');
    assert.equal(row.BROKER, 'EPSILON BROKER');
    assert.equal(row.REGISTER, 'SALES MAIN');
    assert.equal(row.STATION, 'SURAT');
    assert.equal(row.MAINGROUP, 'DEBTORS');
    assert.equal(row.DELIVERY, 'RING ROAD');
    assert.equal(row.NCBILL_NO, '101');
    assert.equal(row.ITEM_NAME, 'RAYON 92');
    assert.equal(row.T_ADD, 100);
    assert.equal(row.T_LESS, 20);
    assert.equal(row.SUB_TOT + row.T_ADD - row.T_LESS, row.TAXABLE_AMT, 'reconciles to the stored taxable');
  });

  test.it('purchase register: supplier\'s own bill number, signed footer split, soft-deleted left out', async () => {
    const r = await regs.purchase.run(ids.companyId, { ...P, detail: true });
    assert.equal(r.rows.length, 1);
    const row = r.rows[0];
    assert.equal(row.SRAL_NO, '7');
    assert.equal(row.NCBILL_NO, 'DW/55');
    assert.equal(row.PARTY, 'DELTA WEAVERS');
    assert.equal(row.T_ADD, 50, 'freight');
    assert.equal(row.T_LESS, 30, 'discount');
    assert.equal(row.SUB_TOT + row.T_ADD - row.T_LESS, row.TAXABLE_AMT);
  });

  test.it('each return register sees only its own return type', async () => {
    const s = await regs.salesReturn.run(ids.companyId, { ...P, detail: true });
    const p = await regs.purchaseReturn.run(ids.companyId, { ...P, detail: true });
    assert.deepEqual(s.rows.map((x) => x.NCBILL_NO), ['SR-1']);
    assert.deepEqual(p.rows.map((x) => x.NCBILL_NO), ['PR-1']);
    assert.equal(s.rows[0].PARTY, 'GAMMA FABRICS');
  });

  test.it('summary groups and the options lists come from the same data', async () => {
    const r = await regs.sales.run(ids.companyId, { ...P, category: '2-PartyWise' });
    assert.deepEqual(r.rows.map((x) => x.GROUP2), ['GAMMA FABRICS']);
    assert.equal(r.rows[0].NET_TOT, 1134);
    const o = await regs.purchase.options(ids.companyId);
    assert.deepEqual(o.parties, ['DELTA WEAVERS']);
    assert.deepEqual(o.items, ['RAYON 92']);
  });
});
