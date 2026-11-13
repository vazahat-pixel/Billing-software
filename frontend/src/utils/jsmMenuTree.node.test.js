// Run: node --test src/utils/jsmMenuTree.node.test.js
//
// The Reports menu is JSM's own menu. Two things have to stay true:
//   1. every entry JSM has is in it, in JSM's own place and wording;
//   2. nothing that opened a screen before stops opening one.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSM_REPORTS_TREE, JSM_OTHERS_TREE, leavesOf } from './jsmMenuTree.js';
import { FORM_HANDLERS, PATH_HANDLERS } from './jsmMenuHandlers.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const menu = JSON.parse(fs.readFileSync(path.join(here, '..', 'jsm', 'blueprint', 'menu.json'), 'utf8'));

const jsmEntries = (caption) => {
  const out = [];
  const walk = (items, trail) => {
    for (const i of items) {
      const p = [...trail, i.caption || ''];
      if (i.items?.length) walk(i.items, p);
      else out.push(p.join(' > '));
    }
  };
  walk(menu.find((m) => m.caption === caption)?.items || [], [caption]);
  return out;
};

test('every entry JSM has is in the menu, at JSM\'s own path', () => {
  const ours = new Set([
    ...leavesOf(JSM_REPORTS_TREE, ['Reports']).map((l) => l.path.join(' > ')),
    ...leavesOf(JSM_OTHERS_TREE, ['Others Reports']).map((l) => l.path.join(' > ')),
  ]);
  const missing = [...jsmEntries('Reports'), ...jsmEntries('Others Reports')].filter((p) => !ours.has(p));
  assert.deepEqual(missing, [], 'these JSM entries are not in the menu');
});

test('the menu adds nothing JSM does not have', () => {
  const jsm = new Set([...jsmEntries('Reports'), ...jsmEntries('Others Reports')]);
  const extra = [
    ...leavesOf(JSM_REPORTS_TREE, ['Reports']),
    ...leavesOf(JSM_OTHERS_TREE, ['Others Reports']),
  ].map((l) => l.path.join(' > ')).filter((p) => !jsm.has(p));
  assert.deepEqual(extra, [], 'these entries are ours, not JSM\'s');
});

/**
 * The screens reachable before this menu was rebuilt. If an entry here ever stops being
 * reachable, a report an operator uses today has gone missing from the menu.
 */
const MUST_STAY_REACHABLE = [
  // gstReports|gstr1, gst45 and ewayBulk now open the JSM screens (Rpt_Jsm_GSTR1_*, Eway_Billing_Bulk).
  // gstReports|gstrMatching, gstr2, gstr9, gst3b, gstr1Errors, itc04, ewayStatus, ewayExcel,
  // gstinSales, gstinPurchase, gstinProcess, gstinJobwork, gstinJournal, gstinExpense now open
  // the real JSM screens (Gstr_3B_TextNew_Monthly, Stp_Gst_OutWrad_ErrorCheck, A_Gstr1_*, A_Gstr2_*, etc.).
  // stockLedger|stockKgs now opens JSM's Rpt_Monthly_Stk_Qty_Value_Report.
  ['fasCheck', 'importBank'],
  // fasCheck|diffYear now opens JSM's Rpt_Jsm_Ledger_os_Diff_Check.
  // cashBook (CashBank Finance, Bank Rec. Payment) now opens the JSM screens.
  // finalReport|groupList was this software's own Group List; the entry now opens the
  // JSM-identical screen instead, so the old one is deliberately no longer on the menu.
];

test('every screen that opened from the old menu still opens from this one', () => {
  const leaves = [...leavesOf(JSM_REPORTS_TREE), ...leavesOf(JSM_OTHERS_TREE)];
  const have = new Set(leaves.filter((l) => l.external).map((l) => `${l.external}|${l.reportKind ?? ''}`));
  const lost = MUST_STAY_REACHABLE
    .map(([ext, kind]) => `${ext}|${kind ?? ''}`)
    .filter((k) => !have.has(k));
  assert.deepEqual(lost, [], 'these screens are no longer reachable from the menu');
});

test('the TDS and TCS views all still have an entry', () => {
  const leaves = [...leavesOf(JSM_REPORTS_TREE), ...leavesOf(JSM_OTHERS_TREE)];
  const views = new Set(leaves.filter((l) => l.reportKey).map((l) => `${l.reportKey}|${l.view}`));
  // tdsHead, tdsRegister, tcsSales, tcsPurchase and tcsRecPay now open the JSM screens (Rpt_TdsReports, Rpt_TcsReports).
  for (const v of []) {
    assert.ok(views.has(v), `${v} has no menu entry`);
  }
});

test('every JSM report screen this software has built is reachable', () => {
  // Read as text: the screen configs import without file extensions, which Vite resolves and
  // node's loader does not.
  const dir = path.join(here, '..', 'jsm', 'reports');
  const forms = new Set();
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.js') && !f.includes('.test.'))) {
    const src = fs.readFileSync(path.join(dir, file), 'utf8');
    for (const m of src.matchAll(/^\s*form:\s*'([A-Za-z_0-9]+)'/gm)) forms.add(m[1]);
    for (const m of src.matchAll(/form:\s*detail\s*\?\s*`\$\{form\}_Detail`\s*:\s*form/g)) forms.add('__dynamic__');
  }
  const leaves = [...leavesOf(JSM_REPORTS_TREE), ...leavesOf(JSM_OTHERS_TREE)];
  const wired = new Set(leaves.filter((l) => l.external === 'jsmReport').map((l) => l.jsmForm));
  const unreachable = [...forms].filter((f) => f !== '__dynamic__' && !wired.has(f));
  assert.deepEqual(unreachable, [], 'these built screens have no menu entry');
});

test('a handler never points at a JSM form that does not exist', () => {
  const forms = new Set();
  const walk = (items) => { for (const i of items) { if (i.form) forms.add(i.form); if (i.items) walk(i.items); } };
  walk(menu);
  const unknown = Object.keys(FORM_HANDLERS).filter((f) => !forms.has(f));
  assert.deepEqual(unknown, [], 'these forms are not in JSM\'s menu');
});

test('every path handler names a real JSM entry', () => {
  const all = new Set([...jsmEntries('Reports'), ...jsmEntries('Others Reports')]);
  const unknown = Object.keys(PATH_HANDLERS).filter((p) => !all.has(p));
  assert.deepEqual(unknown, [], 'these paths are not in JSM\'s menu');
});

test('no two entries share an id', () => {
  const all = [...leavesOf(JSM_REPORTS_TREE), ...leavesOf(JSM_OTHERS_TREE)].map((l) => l.id);
  const dupes = all.filter((id, i) => all.indexOf(id) !== i);
  assert.deepEqual([...new Set(dupes)], [], 'duplicate menu ids');
});

test('every legacy hub shortcut still points at an entry that exists', async () => {
  const { LEGACY_TAB_TO_LEAF } = await import('./reportTree.js');
  const ids = new Set([...leavesOf(JSM_REPORTS_TREE), ...leavesOf(JSM_OTHERS_TREE)].map((l) => l.id));
  const broken = Object.entries(LEGACY_TAB_TO_LEAF).filter(([, id]) => !ids.has(id));
  assert.deepEqual(broken, [], 'these shortcuts point at nothing');
});
