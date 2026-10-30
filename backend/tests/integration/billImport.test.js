/**
 * Old-data import from Excel (Sales / Purchase bills) through the real import routes —
 * in-memory MongoDB only.
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { bootIsolatedApp } = require('../helpers/isolatedApp');
const { authHeader, unwrapBody } = require('../helpers/setup');

describe('Old bill import (isolated DB)', () => {
  let app; let request; let shutdown; let h;

  before(async () => {
    ({ app, request, shutdown } = await bootIsolatedApp());
    const reg = await request(app).post('/api/auth/register').send({
      name: 'Import Owner', email: `imp-${Date.now()}@example.com`, password: 'TestPass123!', companyName: 'Import Co',
    });
    h = authHeader(reg.body.token);
  });
  after(async () => { if (shutdown) await shutdown(); });

  // Typical JSM / Excel export: one row per bill line, Indian dates.
  const purchaseRows = [
    { 'Bill No': 'P-11', Date: '05/04/2024', Party: 'Shree Weavers', Item: 'Grey 60x60', Pcs: 10, Mts: 1000, Rate: 50, Amount: 50000, 'GST %': 5 },
    { 'Bill No': 'P-11', Date: '05/04/2024', Party: 'Shree Weavers', Item: 'Grey Cambric', Pcs: 5, Mts: 500, Rate: 40, Amount: 20000, 'GST %': 5 },
    { 'Bill No': 'P-12', Date: '06/04/2024', Party: 'Ram Textiles', Item: 'Grey 60x60', Pcs: 4, Mts: 400, Rate: 51, 'GST %': 5 },
    { 'Bill No': '', Date: '06/04/2024', Party: 'Ram Textiles', Item: 'Grey 60x60', Pcs: 1, Mts: 1, Rate: 1 },
  ];
  const salesRows = [
    { 'Invoice No': '101', 'Invoice Date': '10/04/2024', Customer: 'Mahesh Fabrics', Item: 'Grey 60x60', Mts: 300, Rate: 70, GST: 5 },
    { 'Invoice No': '102', 'Invoice Date': '11/04/2024', Customer: 'Mahesh Fabrics', Item: 'Grey Cambric', Mts: 100, Rate: 60, GST: 5 },
  ];

  it('master import (parties) still works the old way', async () => {
    const rows = [{ 'Party Name': 'Old Master Party', City: 'Surat', Type: 'Customer' }];
    const sug = unwrapBody(await request(app).post('/api/masters/import/suggest-mappings').set(h).send({ headers: Object.keys(rows[0]), entity: 'auto' }));
    assert.equal(sug.detectedEntity, 'party');
    const res = await request(app).post('/api/masters/import/execute').set(h).send({ entity: 'party', rows, columnMappings: sug.mappings });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(unwrapBody(res).created, 1);
  });

  it('preview: groups lines into bills, flags bad rows and new masters', async () => {
    const res = await request(app).post('/api/masters/import/preview').set(h).send({ entity: 'purchaseBill', rows: purchaseRows });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    const p = unwrapBody(res);
    assert.equal(p.bills, 2);
    assert.equal(p.toImport, 2);
    assert.equal(p.invalidRows, 1); // empty Bill No
    assert.deepEqual(p.newParties.sort(), ['Ram Textiles', 'Shree Weavers']);
    assert.deepEqual(p.newItems.sort(), ['Grey 60x60', 'Grey Cambric']);
  });

  it('purchase bills import with stock, supplier bill no and GST', async () => {
    const res = await request(app).post('/api/masters/import/execute').set(h).send({ entity: 'purchaseBill', rows: purchaseRows });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    const r = unwrapBody(res);
    assert.equal(r.created, 2, JSON.stringify(r.errors));
    assert.equal(r.createdParties, 2);
    assert.equal(r.createdItems, 2);
    const Purchase = require('../../models/Purchase');
    const p11 = await Purchase.findOne({ supplierInvoiceNo: 'P-11' }).lean();
    assert.equal(p11.items.length, 2);
    assert.equal(p11.taxableAmount, 70000);
    assert.equal(p11.gstAmount, 3500);
    assert.equal(new Date(p11.date).toISOString().slice(0, 10), '2024-04-05');
    const p12 = await Purchase.findOne({ supplierInvoiceNo: 'P-12' }).lean();
    assert.equal(p12.taxableAmount, 20400); // amount = mts x rate when no Amount column
    const Item = require('../../models/Item');
    const grey = await Item.findOne({ name: 'Grey 60x60' }).lean();
    const stock = unwrapBody(await request(app).get(`/api/inventory/stock/${grey._id}`).set(h));
    assert.equal(Number(stock.totalMtrs), 1400);
  });

  it('importing the same file again creates nothing new', async () => {
    const res = await request(app).post('/api/masters/import/execute').set(h).send({ entity: 'purchaseBill', rows: purchaseRows });
    const r = unwrapBody(res);
    assert.equal(r.created, 0);
    assert.equal(r.skipped, 2);
    const Purchase = require('../../models/Purchase');
    assert.equal(await Purchase.countDocuments({}), 2);
  });

  it('sales bills keep their invoice numbers and reduce stock', async () => {
    const res = await request(app).post('/api/masters/import/execute').set(h).send({ entity: 'salesBill', rows: salesRows });
    const r = unwrapBody(res);
    assert.equal(r.created, 2, JSON.stringify(r.errors));
    const Sales = require('../../models/Sales');
    const s101 = await Sales.findOne({ invoiceNo: '101' }).lean();
    assert.equal(s101.taxableAmount, 21000);
    assert.equal(s101.gstAmount, 1050);
    const Item = require('../../models/Item');
    const grey = await Item.findOne({ name: 'Grey 60x60' }).lean();
    const stock = unwrapBody(await request(app).get(`/api/inventory/stock/${grey._id}`).set(h));
    assert.equal(Number(stock.totalMtrs), 1100);
    const again = unwrapBody(await request(app).post('/api/masters/import/execute').set(h).send({ entity: 'salesBill', rows: salesRows }));
    assert.equal(again.created, 0);
    assert.equal(await Sales.countDocuments({}), 2);
  });
});
