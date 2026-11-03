// Run: node --test src/jsm/reports/outstandingReports.node.test.js
//
// JSM's Outstanding family screen configs. Checked against the owner's own JSM (screen recording
// 03/11/2026): Debitor O/s shows BillDate + PaidDate ranges, Status, Category Wise, and the
// checkboxes that recording had ticked by default (New Year Bill, Include Lastyear O/s, With
// Unadjust Entry, With Address, With Ledger Balance, Grand Total, Linning Party Total).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { OUTSTANDING_REPORTS, osSales, osSalesAge } from './outstandingReports.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const forms = JSON.parse(fs.readFileSync(path.join(here, '..', 'blueprint', 'forms.json'), 'utf8'));
const layouts = JSON.parse(fs.readFileSync(path.join(here, '..', 'blueprint', 'layouts.json'), 'utf8'));

test('eight entries: four Outstanding screens and their Age Analysis', () => {
  assert.deepEqual(OUTSTANDING_REPORTS.map((c) => c.form).sort(), [
    'Rpt_Jsm_Os_Jobwork', 'Rpt_Jsm_Os_Jobwork_AgeAnalysis',
    'Rpt_Jsm_Os_Process', 'Rpt_Jsm_Os_Process_AgeAnalysis',
    'Rpt_Jsm_Os_Purchase', 'Rpt_Jsm_Os_Purchase_AgeAnalysis',
    'Rpt_Jsm_Os_Sales', 'Rpt_Jsm_Os_Sales_AgeAnalysis',
  ]);
  for (const c of OUTSTANDING_REPORTS) {
    assert.ok(forms[c.form], `${c.form} draws a real JSM screen`);
  }
});

test('every screen\'s captured layout is captured, not guessed', () => {
  const views = {
    Rpt_Jsm_Os_Sales: 'JSM_VW_OS_SALES', Rpt_Jsm_Os_Purchase: 'JSM_VW_OS_PURCHASE',
    Rpt_Jsm_Os_Process: 'JSM_VW_OS_PROCESS', Rpt_Jsm_Os_Jobwork: 'JSM_VW_OS_JOBWORK',
    Rpt_Jsm_Os_Sales_AgeAnalysis: 'JSM_VW_OS_SALES_AGEANALYSIS', Rpt_Jsm_Os_Purchase_AgeAnalysis: 'JSM_VW_OS_PURCHASE_AGEANALYSIS',
    Rpt_Jsm_Os_Process_AgeAnalysis: 'JSM_VW_OS_PROCESS_AGEANALYSIS', Rpt_Jsm_Os_Jobwork_AgeAnalysis: 'JSM_VW_OS_JOBWORK_AGEANALYSIS',
  };
  for (const [form, view] of Object.entries(views)) assert.ok(layouts[view], `${view} for ${form}`);
});

test('defaults match what the owner\'s JSM had ticked', () => {
  const d = osSales.defaults({ fyFrom: '01/04/2026', fyTo: '03/11/2026' });
  assert.equal(d.CheckBox_NewYear, true);
  assert.equal(d.CheckBox_LastYear, true);
  assert.equal(d.CheckBox_Unadjust, true);
  assert.equal(d.CheckBox_Address, true);
  assert.equal(d.CheckBox_Ledger, true);
  assert.equal(d.CheckBox_Total, true);
  assert.equal(d.CheckBox_Linning, true);
  assert.equal(d.cbo_status, '1-Pending');
});

test('toParams sends the date/paid-date range, status, category and checkbox state', () => {
  const p = osSales.toParams({
    txt_bill_dt_from: '01/04/2026', txt_bill_dt_to: '03/11/2026',
    txt_rec_dt_from: '01/04/2026', txt_rec_dt_to: '03/11/2026',
    cbo_status: '3-All', cbo_category: '3-Broker',
    CheckBox_Ledger: true, CheckBox_WithRg: true, txt_Due_Days: '30',
  });
  assert.equal(p.from, '2026-04-01');
  assert.equal(p.paidFrom, '2026-04-01');
  assert.equal(p.status, '3-All');
  assert.equal(p.category, '3-Broker');
  assert.equal(p.withLedgerBalance, true);
  assert.equal(p.onlyRgPending, true);
  assert.equal(p.dueDaysMin, 30);
});

test('Age Analysis sends its own narrower param set', () => {
  const p = osSalesAge.toParams({ txt_bill_dt_from: '01/04/2026', txt_bill_dt_to: '03/11/2026', cbo_category: '1-Party' });
  assert.equal(p.category, '1-Party');
  assert.equal(p.from, '2026-04-01');
});
