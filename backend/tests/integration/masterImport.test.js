/**
 * Excel import of masters (parties, items, opening stock lots) through the real routes —
 * in-memory MongoDB only. Covers the defects that made the import look dead:
 * values (1,50,000 Cr / 12% / Excel percent cells), unmapped columns, duplicates inside the file,
 * GSTIN clashes, opening stock (one lot, no double counting), preview == execute.
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { bootIsolatedApp } = require('../helpers/isolatedApp');
const { authHeader, unwrapBody } = require('../helpers/setup');
const { safeHeaderKey } = require('../../utils/importParsers');

describe('Master import (isolated DB)', () => {
  let app; let request; let shutdown; let h;
  const post = (path, body) => request(app).post(path).set(h).send(body);
  const suggest = async (rows, entity) => unwrapBody(await post('/api/masters/import/suggest-mappings', { headers: Object.keys(rows[0]), entity })).mappings;

  before(async () => {
    ({ app, request, shutdown } = await bootIsolatedApp());
    const reg = await request(app).post('/api/auth/register').send({
      name: 'Import Owner', email: `mi-${Date.now()}@example.com`, password: 'TestPass123!', companyName: 'Master Import Co',
    });
    h = authHeader(reg.body.token);
  });
  after(async () => { if (shutdown) await shutdown(); });

  const dotted = safeHeaderKey('Mobile No.'); // what the screen sends for "Mobile No."
  const partyRows = [
    { 'Party Name': 'Alpha Traders', Group: 'Sundry Debtors', 'GST No': '24AAAAA0000A1Z5', 'Opening Balance': '1,50,000 Cr', [dotted]: '+91 98765 43210', City: 'Surat', 'Junk Col': 'DROP TABLE' },
    { 'Party Name': 'alpha traders', Group: 'Sundry Debtors' },
    { 'Party Name': 'Beta Mills', Group: 'Sundry Creditors', 'Opening Balance': 2500 },
    { 'Party Name': 'Gamma', 'GST No': '24AAAAA0000A1Z5' },
    { 'Party Name': '' },
  ];

  it('party: preview and execute agree; values, sides and duplicates are right', async () => {
    const mappings = await suggest(partyRows, 'party');
    assert.equal(mappings['Party Name'], 'name');
    assert.equal(mappings['Opening Balance'], 'openingBalance');
    assert.equal(mappings[dotted], 'mobile');
    assert.equal(mappings['Junk Col'], '');

    const pv = unwrapBody(await post('/api/masters/import/preview', { entity: 'party', rows: partyRows, columnMappings: mappings }));
    assert.deepEqual([pv.validRows, pv.duplicateRows, pv.invalidRows], [2, 1, 2]);
    assert.ok(pv.errors.some((e) => /GSTIN 24AAAAA0000A1Z5 is already used by "Alpha Traders"/.test(e.message)), JSON.stringify(pv.errors));
    assert.ok(pv.errors.some((e) => /Party Name is required/.test(e.message)));

    const ex = unwrapBody(await post('/api/masters/import/execute', { entity: 'party', rows: partyRows, columnMappings: mappings }));
    assert.deepEqual([ex.created, ex.skipped, ex.failed], [2, 1, 2], JSON.stringify(ex.errors));
    assert.deepEqual(ex.errors.map((e) => e.row).sort(), [4, 5]);

    const Party = require('../../models/Party');
    const alpha = await Party.findOne({ name: 'Alpha Traders' }).lean();
    assert.equal(alpha.openingBalance, 150000);
    assert.equal(alpha.openingBalanceType, 'Cr');
    assert.equal(alpha.mobile, '9876543210');
    assert.equal(alpha.type, 'Customer');
    assert.equal(alpha.group, 'SUNDRY DEBTORS');
    assert.equal(alpha.city, 'Surat');
    assert.equal(alpha['Junk Col'], undefined);
    assert.equal(alpha.junkCol, undefined);
    const beta = await Party.findOne({ name: 'Beta Mills' }).lean();
    assert.equal(beta.type, 'Supplier');
    assert.equal(beta.openingBalance, 2500);
    assert.equal(beta.openingBalanceType, 'Cr'); // no side given -> a supplier's natural side
    assert.equal(await Party.countDocuments({}), 2);

    // second run: nothing new
    const again = unwrapBody(await post('/api/masters/import/execute', { entity: 'party', rows: partyRows, columnMappings: mappings }));
    assert.deepEqual([again.created, again.skipped], [0, 3]);
  });

  const itemRows = [
    { 'Item Name': 'Cotton 60x60', 'HSN Code': '5208', 'GST %': '12%', 'Opening Stock': '1,200', Unit: 'Meters', 'Opening Pcs': 12 },
    { 'Item Name': 'Poly Satin', 'GST %': 0.05 },
    { 'Item Name': 'Plain Grey' },
    { 'Item Name': 'Exempt Cloth', 'GST %': 'Exempt' },
  ];

  it('item: GST from 12% / Excel 0.05 / blank / Exempt; opening stock becomes one lot', async () => {
    const mappings = await suggest(itemRows, 'item');
    const pv = unwrapBody(await post('/api/masters/import/preview', { entity: 'item', rows: itemRows, columnMappings: mappings }));
    assert.deepEqual([pv.validRows, pv.duplicateRows, pv.invalidRows], [4, 0, 0]);
    assert.ok(pv.warnings.some((w) => /GST rate blank/.test(w.message)));

    const ex = unwrapBody(await post('/api/masters/import/execute', { entity: 'item', rows: itemRows, columnMappings: mappings }));
    assert.deepEqual([ex.created, ex.failed], [4, 0], JSON.stringify(ex.errors));

    const Item = require('../../models/Item');
    const rate = async (n) => (await Item.findOne({ name: n }).lean()).gstRate;
    assert.equal(await rate('Cotton 60x60'), 12);
    assert.equal(await rate('Poly Satin'), 5);
    assert.equal(await rate('Plain Grey'), 5);
    assert.equal(await rate('Exempt Cloth'), 0);
    const cotton = await Item.findOne({ name: 'Cotton 60x60' }).lean();
    assert.equal(cotton.unit, 'MTRS');
    assert.equal(cotton.openingStock, 1200);
    const InventoryLot = require('../../models/InventoryLot');
    const lots = await InventoryLot.find({ itemId: cotton._id }).lean();
    assert.equal(lots.length, 1);
    assert.equal(lots[0].totalMtrs, 1200);
    assert.equal(lots[0].totalPcs, 12);
    assert.equal(lots[0].source, 'opening');
  });

  it('opening stock lots: item must exist, same lot is not added twice, item opening follows the lots', async () => {
    const rows = [
      { Item: 'Poly Satin', 'Lot No': 'L-100', Meters: 300, Pcs: 3, Rate: 40 },
      { Item: 'No Such Item', 'Lot No': 'L-101', Meters: 10 },
    ];
    const mappings = await suggest(rows, 'openingStock');
    const pv = unwrapBody(await post('/api/masters/import/preview', { entity: 'openingStock', rows, columnMappings: mappings }));
    assert.deepEqual([pv.validRows, pv.invalidRows], [1, 1]);
    assert.ok(pv.errors[0].message.includes('not found'));

    const ex = unwrapBody(await post('/api/masters/import/execute', { entity: 'openingStock', rows, columnMappings: mappings }));
    assert.deepEqual([ex.created, ex.failed], [1, 1]);
    const Item = require('../../models/Item');
    const satin = await Item.findOne({ name: 'Poly Satin' }).lean();
    assert.equal(satin.openingStock, 300);
    assert.equal(satin.openingQty, 300);
    assert.equal(satin.openingPcs, 3);

    const again = unwrapBody(await post('/api/masters/import/execute', { entity: 'openingStock', rows, columnMappings: mappings }));
    assert.deepEqual([again.created, again.skipped], [0, 1]);
    assert.equal((await Item.findOne({ name: 'Poly Satin' }).lean()).openingQty, 300); // not doubled
  });

  it('a clash on item code is reported with the reason', async () => {
    const rows = [{ 'Item Name': 'Coded One', 'Item Code': 'C-1' }, { 'Item Name': 'Coded Two', 'Item Code': 'c-1' }];
    const mappings = await suggest(rows, 'item');
    const pv = unwrapBody(await post('/api/masters/import/preview', { entity: 'item', rows, columnMappings: mappings }));
    assert.deepEqual([pv.validRows, pv.invalidRows], [1, 1]);
    assert.match(pv.errors[0].message, /Item code c-1 is already used by "Coded One"/);
  });
});
