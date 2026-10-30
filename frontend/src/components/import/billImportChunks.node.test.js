// Run: node --test src/components/import/billImportChunks.node.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chunkBillRows, mergeBillPreviews, mergeBillResults } from './billImportChunks.js';

const mappings = { 'Bill No': 'billNo', Party: 'party', Date: 'date', Item: 'item', Mts: 'mts' };
const row = (b, p, d, item = 'X') => ({ 'Bill No': b, Party: p, Date: d, Item: item, Mts: 1 });

test('a bill is never split across batches, rows keep their Excel row number', () => {
  // bill 1 has lines at rows 2 and 5 (not next to each other in the sheet)
  const rows = [row('1', 'A', '01/04/2024'), row('2', 'A', '01/04/2024'), row('3', 'B', '02/04/2024'), row('1', 'a', '01/04/2024', 'Y')];
  const chunks = chunkBillRows(rows, mappings, 2);
  const where = {};
  chunks.forEach((c, i) => c.forEach((r) => { (where[r['Bill No']] ||= new Set()).add(i); }));
  for (const b of Object.keys(where)) assert.equal(where[b].size, 1, `bill ${b} split`);
  assert.equal(chunks.flat().length, 4);
  const bill1 = chunks.flat().filter((r) => r['Bill No'] === '1').map((r) => r.__row);
  assert.deepEqual(bill1, [2, 5]);
});

test('a bill larger than the batch size still goes whole in its own batch', () => {
  const rows = [row('9', 'A', 'd'), row('9', 'A', 'd'), row('9', 'A', 'd'), row('10', 'A', 'd')];
  const chunks = chunkBillRows(rows, mappings, 2);
  assert.deepEqual(chunks.map((c) => c.length), [3, 1]);
});

test('batch answers add up', () => {
  const p = mergeBillPreviews([
    { totalRows: 3, bills: 2, toImport: 1, validRows: 1, alreadyImported: 1, duplicateRows: 1, invalidRows: 1, errors: [{ row: 7, error: 'x' }], newParties: ['A'], newItems: ['I'], sampleBills: [{ billNo: '1' }] },
    { totalRows: 2, bills: 1, toImport: 1, validRows: 1, newParties: ['A', 'B'], newItems: [], sampleBills: [{ billNo: '2' }] },
  ]);
  assert.equal(p.totalRows, 5);
  assert.equal(p.bills, 3);
  assert.equal(p.validRows, 2);
  assert.equal(p.duplicateRows, 1);
  assert.deepEqual(p.newParties, ['A', 'B']);
  assert.deepEqual(p.errors, [{ row: 7, error: 'x' }]);
  assert.equal(p.sampleBills.length, 2);
  const r = mergeBillResults([{ created: 2, skipped: 1, failed: 0, errors: [] }, { created: 1, failed: 1, errors: [{ bill: '5', error: 'y' }] }]);
  assert.deepEqual([r.created, r.skipped, r.failed, r.errors.length], [3, 1, 1, 1]);
});

import { chunkRows, safeHeaderKey, mergeMasterPreviews, mergeMasterResults } from './billImportChunks.js';

test('master rows go in plain batches', () => {
  const rows = Array.from({ length: 7 }, (_, i) => ({ i }));
  assert.deepEqual(chunkRows(rows, 3).map((c) => c.length), [3, 3, 1]);
  assert.deepEqual(chunkRows([], 3), []);
});

test('a heading with a dot is sent without the dot MongoDB would strip', () => {
  assert.ok(!safeHeaderKey('Mobile No.').includes('.'));
  assert.ok(!safeHeaderKey('$ Amount').startsWith('$'));
  assert.equal(safeHeaderKey('Party Name'), 'Party Name');
});

test('master batch answers add up and row numbers point to the right sheet row', () => {
  const p = mergeMasterPreviews([
    { entity: 'party', totalRows: 3, validRows: 2, duplicateRows: 0, invalidRows: 1, sampleRows: [{ name: 'A' }], errors: [{ row: 2, message: 'x' }], warnings: [] },
    { entity: 'party', totalRows: 2, validRows: 1, duplicateRows: 1, invalidRows: 0, sampleRows: [{ name: 'B' }], errors: [], warnings: [{ message: 'w', count: 2, rows: [1, 2] }] },
    { entity: 'party', totalRows: 1, validRows: 1, duplicateRows: 0, invalidRows: 0, sampleRows: [], errors: [], warnings: [{ message: 'w', count: 1, rows: [1] }] },
  ], [3, 2, 1]);
  assert.deepEqual([p.totalRows, p.validRows, p.duplicateRows, p.invalidRows], [6, 4, 1, 1]);
  assert.equal(p.sampleRows.length, 2);
  assert.deepEqual(p.errors, [{ row: 3, message: 'x' }]); // sheet row = batch row + 1 (heading row)
  assert.deepEqual(p.warnings, [{ message: 'w', count: 3, rows: [5, 6, 7] }]); // same note from two batches is one line
  const r = mergeMasterResults([
    { total: 3, created: 2, skipped: 0, failed: 1, errors: [{ row: 3, error: 'a' }] },
    { total: 2, created: 1, skipped: 1, failed: 0, errors: [] },
  ], [3, 2]);
  assert.deepEqual([r.total, r.created, r.skipped, r.failed], [5, 3, 1, 1]);
  assert.deepEqual(r.errors, [{ row: 4, error: 'a' }]);
});
