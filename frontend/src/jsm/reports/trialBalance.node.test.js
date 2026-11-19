// Run: node --test src/jsm/reports/trialBalance.node.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import trialBalance from './trialBalance.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const forms = JSON.parse(fs.readFileSync(path.join(here, '..', 'blueprint', 'forms.json'), 'utf8'));

test('draws a real captured JSM screen', () => {
  assert.ok(forms[trialBalance.form]);
});

test('fallbackColumns carries the owner\'s own printed columns', () => {
  assert.deepEqual(
    trialBalance.fallbackColumns.JSM_VW_TR_BAL.map((c) => c.field),
    ['AC_NAME', 'DR_AMOUNT', 'CR_AMOUNT']
  );
});

test('toParams reads A/B/C and the date range', () => {
  const p = trialBalance.toParams({
    txt_dt_from: '01/04/2026', txt_dt_to: '03/11/2026',
    Rdbtn_Opening: true, Rdbtn_B3: true, Rdbtn_C2: true, chk_zero: true,
  });
  assert.equal(p.opening, true);
  assert.equal(p.format, '3');
  assert.equal(p.orderBy, '2');
  assert.equal(p.withZero, true);
});

test('defaults to Current / Single / GroupWise, as the owner\'s own JSM had it', () => {
  const d = trialBalance.defaults({ fyFrom: '01/04/2026', fyTo: '31/03/2027' });
  assert.equal(d.Rdbtn_Current, true);
  assert.equal(d.Rdbtn_B2, true);
  assert.equal(d.Rdbtn_C1, true);
});
