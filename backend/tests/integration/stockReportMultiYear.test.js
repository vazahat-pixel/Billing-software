/**
 * Stock report for a later financial year opens with the previous years' closing; a single-year report is unchanged.
 * In-memory MongoDB only.
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { bootIsolatedApp } = require('../helpers/isolatedApp');
const { authHeader, unwrapBody } = require('../helpers/setup');

describe('Stock report across financial years (isolated DB)', () => {
  let app; let request; let shutdown; let companyId; let mongoose;
  const rowValue = (report, section, label) => {
    const sec = (report.sections || []).find((s) => s.title === section);
    const r = (sec?.rows || sec?.lines || []).find((x) => (x.label || x[0]) === label);
    return Number(r?.value ?? r?.qty ?? r?.[1]);
  };

  before(async () => {
    ({ app, request, shutdown } = await bootIsolatedApp());
    mongoose = require('mongoose');
    const reg = await request(app).post('/api/auth/register').send({ name: 'Stock Owner', email: `sr-${Date.now()}@example.com`, password: 'TestPass123!', companyName: 'Stock Co' });
    const h = authHeader(reg.body.token);
    companyId = new mongoose.Types.ObjectId(unwrapBody(await request(app).get('/api/auth/me').set(h)).companyId);
    const Item = require('../../models/Item'); const Purchase = require('../../models/Purchase'); const Sales = require('../../models/Sales');
    const Party = require('../../models/Party');
    const sup = await Party.collection.insertOne({ companyId, name: 'S', type: 'Supplier', isDeleted: false });
    const cus = await Party.collection.insertOne({ companyId, name: 'C', type: 'Customer', isDeleted: false });
    const it = await Item.collection.insertOne({ companyId, name: 'GREY X', category: 'Grey', unit: 'MTRS', openingQty: 50, openingStock: 50, isDeleted: false });
    const line = (mts) => [{ itemId: it.insertedId, mts, pcs: 1, rate: 10, amount: mts * 10 }];
    // FY 2024-25: buy 100, sell 30.  FY 2025-26: buy 20, sell 5.
    await Purchase.collection.insertOne({ companyId, supplierId: sup.insertedId, invoiceNo: 'P1', date: new Date('2024-06-10'), items: line(100), status: 'active', netAmount: 1, taxableAmount: 1, isDeleted: false });
    await Sales.collection.insertOne({ companyId, customerId: cus.insertedId, invoiceNo: 'S1', date: new Date('2024-08-10'), items: line(30), status: 'active', netAmount: 1, taxableAmount: 1, gstAmount: 0, isDeleted: false });
    await Purchase.collection.insertOne({ companyId, supplierId: sup.insertedId, invoiceNo: 'P2', date: new Date('2025-06-10'), items: line(20), status: 'active', netAmount: 1, taxableAmount: 1, isDeleted: false });
    await Sales.collection.insertOne({ companyId, customerId: cus.insertedId, invoiceNo: 'S2', date: new Date('2025-08-10'), items: line(5), status: 'active', netAmount: 1, taxableAmount: 1, gstAmount: 0, isDeleted: false });
  });
  after(async () => { if (shutdown) await shutdown(); });

  it('first year: opening is the item master opening (unchanged behaviour)', async () => {
    const { getStockLedgerReport } = require('../../services/stockLedgerReportService');
    const r = await getStockLedgerReport(companyId, { asOn: '2025-03-31' });
    assert.equal(rowValue(r, 'Grey', 'Opening Stock'), 50);
    assert.equal(rowValue(r, 'Grey', 'Closing Stock'), 120); // 50 + 100 - 30
  });

  it('second year: opens with the first year closing, then adds its own flows', async () => {
    const { getStockLedgerReport } = require('../../services/stockLedgerReportService');
    const r = await getStockLedgerReport(companyId, { asOn: '2026-03-31' });
    assert.equal(rowValue(r, 'Grey', 'Opening Stock'), 120);
    assert.equal(rowValue(r, 'Grey', 'Purchase'), 20);
    assert.equal(rowValue(r, 'Grey', 'Closing Stock'), 135); // 120 + 20 - 5
  });

  it('a date inside the second year before any of its documents still opens correctly', async () => {
    const { getStockLedgerReport } = require('../../services/stockLedgerReportService');
    const r = await getStockLedgerReport(companyId, { asOn: '2025-05-01' });
    assert.equal(rowValue(r, 'Grey', 'Opening Stock'), 120);
    assert.equal(rowValue(r, 'Grey', 'Closing Stock'), 120);
  });
});
