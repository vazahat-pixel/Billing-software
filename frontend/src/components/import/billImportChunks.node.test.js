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
