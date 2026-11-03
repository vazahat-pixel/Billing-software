// Run: node --test src/jsm/reports/billRegisters.node.test.js
//
// JSM's four bill register screens, as the owner's JSM shows them (screen recording of 03/11/2026):
// "Purchase Summary Report" with its "Summary Reports" box, the date / number range swapping on the
// A / B / C radio, and a Category Wise list without the duplicates the blueprint captured.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BILL_REGISTERS } from './billRegisters.js';
import { lastFill } from '../winforms.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const forms = JSON.parse(fs.readFileSync(path.join(here, '..', 'blueprint', 'forms.json'), 'utf8'));
const byKey = Object.fromEntries(BILL_REGISTERS.map((c) => [c.form, c]));

test('eight entries: a Summary and a Detail for each of the four registers', () => {
  assert.deepEqual(Object.keys(byKey).sort(), [
    'Rpt_Jsm_Purchase', 'Rpt_Jsm_Purchase_Detail', 'Rpt_Jsm_Purchase_Return', 'Rpt_Jsm_Purchase_Return_Detail',
    'Rpt_Jsm_Sales', 'Rpt_Jsm_Sales_Detail', 'Rpt_Jsm_Sales_Return', 'Rpt_Jsm_Sales_Return_Detail',
  ]);
  for (const c of BILL_REGISTERS) {
    assert.ok(forms[c.blueprintForm], `${c.form} draws a real JSM screen`);
    assert.equal(c.apiForm, c.blueprintForm);
  }
});

test('window titles as JSM sets them', () => {
  assert.equal(byKey.Rpt_Jsm_Purchase.title, 'Purchase Summary Report'); // seen on the owner's JSM
  assert.equal(byKey.Rpt_Jsm_Purchase_Detail.title, forms.Rpt_Jsm_Purchase.runtimeTitle);
  assert.equal(byKey.Rpt_Jsm_Sales.title, forms.Rpt_Jsm_Sales.title);
  assert.equal(byKey.Rpt_Jsm_Sales_Detail.title, forms.Rpt_Jsm_Sales.runtimeTitle);
  assert.equal(byKey.Rpt_Jsm_Sales_Return_Detail.title, forms.Rpt_Jsm_Sales_Return.runtimeTitle);
  assert.equal(byKey.Rpt_Jsm_Purchase_Return_Detail.title, forms.Rpt_Jsm_Purchase_Return.runtimeTitle);
});

test('"Summary Reports" shows on the Summary entry only', () => {
  assert.equal(byKey.Rpt_Jsm_Purchase.overrides({}).CheckBox_Summary.visible, true);
  assert.equal(byKey.Rpt_Jsm_Purchase_Detail.overrides({}).CheckBox_Summary.visible, false);
});

test('A-Date shows the date range; B-Bill.No and C-Serial.No swap in the number range', () => {
  const o = byKey.Rpt_Jsm_Purchase.overrides;
  assert.deepEqual([o({ radio_button_date: true }).GroupBox_Date.visible, o({ radio_button_date: true }).GroupBox_No.visible], [true, false]);
  assert.deepEqual([o({ radio_button_billno: true }).GroupBox_Date.visible, o({ radio_button_billno: true }).GroupBox_No.visible], [false, true]);
  assert.deepEqual([o({ radio_button_srno: true }).GroupBox_Date.visible, o({ radio_button_srno: true }).GroupBox_No.visible], [false, true]);
  // Both groups really share one spot on JSM's screen.
  const at = (n) => forms.Rpt_Jsm_Purchase.controls.find((c) => c.name === n).y;
  assert.equal(at('GroupBox_Date'), at('GroupBox_No'));
});

test('Category Wise shows the last fill, never duplicates', () => {
  const items = (form) => forms[form].controls.find((c) => c.name === 'cbo_category').runtime.items;
  assert.deepEqual(lastFill(items('Rpt_Jsm_Purchase')),
    ['1-Register', '2-PartyWise', '3-BrokerWise', '4-CityWise', '5-MainGroup', '6-ItemWise']);
  assert.deepEqual(lastFill(items('Rpt_Jsm_Sales')),
    ['1-Register', '2-PartyWise', '3-BrokerWise', '4-CityWise', '5-MainGroup', '6-ItemWise', '7-Item+PartyWise', '8-SuitWise']);
  for (const form of ['Rpt_Jsm_Sales', 'Rpt_Jsm_Purchase', 'Rpt_Jsm_Sales_Return', 'Rpt_Jsm_Purchase_Return']) {
    const l = lastFill(items(form));
    assert.equal(new Set(l).size, l.length, `${form} still has duplicates`);
  }
});

test('lastFill leaves an ordinary list alone', () => {
  assert.deepEqual(lastFill(['Register', 'Party', 'Item']), ['Register', 'Party', 'Item']);
  assert.deepEqual(lastFill(['1-All']), ['1-All']);
  assert.equal(lastFill(undefined), undefined);
});

test('the screen sends the radio mode, the range and the Summary box', () => {
  const p = byKey.Rpt_Jsm_Purchase.toParams({
    txt_dt_from: '01/04/2026', txt_dt_to: '03/11/2026', radio_button_billno: true,
    txt_from: '10', txt_to: '20', cbo_category: '2-PartyWise', CheckBox_Summary: true,
  });
  assert.equal(p.orderBy, 'billno');
  assert.equal(p.numFrom, '10');
  assert.equal(p.numTo, '20');
  assert.equal(p.from, '2026-04-01');
  assert.equal(p.detail, false);
  assert.equal(p.summaryReports, true);
  assert.equal(byKey.Rpt_Jsm_Purchase_Detail.toParams({}).detail, true);
});
