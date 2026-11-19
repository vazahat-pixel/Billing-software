// Run: node --test src/jsm/reports/ledger.node.test.js
//
// JSM: Reports › Fas Reports › Ledger / Ledger T-Format / Confirmation. One real JSM screen
// (A_AccountLedgerSingleSide for Ledger, A_AccountLedgerDoubleSide for the other two) backs three
// menu entries, so each gets its own synthetic `form` key pointing at the same blueprintForm/apiForm.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LEDGER_REPORTS, ledger, ledgerTFormat, ledgerConfirmation } from './ledger.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const forms = JSON.parse(fs.readFileSync(path.join(here, '..', 'blueprint', 'forms.json'), 'utf8'));
const layouts = JSON.parse(fs.readFileSync(path.join(here, '..', 'blueprint', 'layouts.json'), 'utf8'));

test('three entries, each drawing a real captured JSM screen', () => {
  assert.deepEqual(LEDGER_REPORTS.map((c) => c.form).sort(), [
    'A_AccountLedgerDoubleSide_Confirmation', 'A_AccountLedgerDoubleSide_TFormat', 'A_AccountLedgerSingleSide',
  ]);
  for (const c of LEDGER_REPORTS) assert.ok(forms[c.blueprintForm], `${c.blueprintForm} draws a real JSM screen`);
});

test('the captured layout exists for every variant', () => {
  assert.ok(layouts.JSM_VW_LEDGER_ACCOUNT);
});

test('apiForm points at the backend report for both screens', () => {
  assert.equal(ledger.apiForm, 'A_AccountLedgerSingleSide');
  assert.equal(ledgerTFormat.apiForm, 'A_AccountLedgerDoubleSide');
  assert.equal(ledgerConfirmation.apiForm, 'A_AccountLedgerDoubleSide');
});

test('toParams reads the tick-list and the narration checkboxes', () => {
  const p = ledger.toParams({
    ListView_Party: ['OMKAR TEX', 'ZETA FABRICS'],
    txt_dt_from: '01/04/2026',
    txt_dt_to: '31/03/2027',
    CheckBox_Remark1: true,
    CheckBox_Remark2: false,
  });
  assert.deepEqual(p.ledgers, ['OMKAR TEX', 'ZETA FABRICS']);
  assert.equal(p.withNarration1, true);
  assert.equal(p.withNarration2, false);
});

test('distinct titles per menu entry sharing one screen', () => {
  assert.equal(ledger.title, 'Account Ledger');
  assert.equal(ledgerTFormat.title, 'Ledger T-Format');
  assert.equal(ledgerConfirmation.title, 'Confirmation');
});
