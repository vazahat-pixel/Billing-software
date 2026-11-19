// Run: node --test src/jsm/JsmImportBankScreen.node.test.js
// The screen file imports JSX, so the statement parser is exercised through its source text.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.join(here, 'JsmImportBankScreen.jsx'), 'utf8');
const start = src.indexOf('const norm =');
const end = src.indexOf('let blueprintPromise');
// eslint-disable-next-line no-new-func
const { parseBankStatement } = new Function(`${src.slice(start, end).replace('export function', 'function')}; return { parseBankStatement };`)();

test('reads dated lines under the header row; withdrawal is a payment, deposit a receipt', () => {
  const aoa = [
    ['ACME BANK STATEMENT'],
    ['Date', 'Narration', 'Chq/Ref No', 'Withdrawal Amt', 'Deposit Amt', 'Closing Balance'],
    ['05/07/2026', 'NEFT FROM A', 'UTR1', '', '10,000.00', '110,000.00'],
    ['06-07-2026', 'CHQ 123', '123', '2,500.50', '', '107,499.50'],
    ['', 'no date', '', '5', '', ''],
  ];
  const rows = parseBankStatement(aoa);
  assert.equal(rows.length, 2);
  assert.deepEqual([rows[0].REC_DATE, rows[0].REC_PAY, rows[0].REC_AMT], ['2026-07-05', 'R', 10000]);
  assert.deepEqual([rows[1].REC_DATE, rows[1].REC_PAY, rows[1].REC_AMT, rows[1].CHQ_NO], ['2026-07-06', 'P', 2500.5, '123']);
  assert.throws(() => parseBankStatement([['x', 'y']]), /Header row not found/);
});
