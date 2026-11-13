// Run: node --test src/jsm/reports/layoutCoverage.node.test.js
//
// Every JSM report must end up with columns on screen.
//
// STP_REPORT (captured as blueprint/layouts.json) does not hold a row for every view — JSM creates
// those at run time via StpInsert_Column. When a report names a layout that is not captured AND the
// screen config supplies no fallbackColumns, the grid renders with zero columns: the report opens,
// finds its rows, and shows an empty table. That is what happened to the JobWork Send report.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const layouts = JSON.parse(fs.readFileSync(path.join(here, '..', 'blueprint', 'layouts.json'), 'utf8'));

/**
 * Layout names each backend report declares, read from the source so the test cannot drift.
 *
 * Any JSM_VW_… string in a report file counts, not only `layout: '…'` — some reports pick their
 * layout from a `views: { summary, bills }` block, and those were slipping past this check.
 */
function declaredLayouts() {
  const dir = path.resolve(here, '..', '..', '..', '..', 'backend', 'services', 'jsmReports', 'reports');
  const out = [];
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.js'))) {
    const src = fs.readFileSync(path.join(dir, file), 'utf8');
    // JSM_VW_… is its usual naming, but a few of its runtime tables are named RPT_… instead
    // (the Cash/Bank Register's two), and those must be covered by this check just the same.
    for (const m of src.matchAll(/'((?:JSM_VW|RPT)_[A-Z0-9_]+)'/g)) {
      out.push({ report: file.replace(/\.js$/, ''), layout: m[1] });
    }
  }
  return out;
}

/** fallbackColumns keys declared by the matching frontend screen config, read as text. */
function fallbacksFor(report) {
  const file = path.join(here, `${report}.js`);
  if (!fs.existsSync(file)) return new Set();
  const src = fs.readFileSync(file, 'utf8');
  const block = src.indexOf('fallbackColumns');
  if (block < 0) return new Set();
  // A column set is written inline (`NAME: [ … ]`) or shared under a name (`NAME: COLUMNS`).
  return new Set([...src.matchAll(/([A-Z][A-Z0-9_]{6,}):\s*(?:\[|[A-Z][A-Za-z0-9_]*\s*[,}\r\n])/g)].map((m) => m[1]));
}

test('every layout a report declares is either captured or has fallback columns', () => {
  const missing = [];
  for (const { report, layout } of declaredLayouts()) {
    if (Object.prototype.hasOwnProperty.call(layouts, layout)) continue;
    if (fallbacksFor(report).has(layout)) continue;
    missing.push(`${report} -> ${layout}`);
  }
  assert.deepEqual(missing, [], `these reports would render an empty grid:\n  ${missing.join('\n  ')}`);
});

test('only the known no-layout screens are uncaptured, and each has fallback columns', () => {
  const uncaptured = declaredLayouts()
    .filter(({ layout }) => !Object.prototype.hasOwnProperty.call(layouts, layout))
    .map(({ layout }) => layout);

  assert.deepEqual(
    [...new Set(uncaptured)].sort(),
    [
      'JSM_VW_ACC_STOCK', 'JSM_VW_ACC_STOCK_DETAIL', 'JSM_VW_ALL_INWARD_SUPPLY_PURCHASE_DET',
      'JSM_VW_ALL_INWARD_SUPPLY_PURCHASE_SUM', 'JSM_VW_ALL_OUTWARD_SUPPLY_SALES_DET',
      'JSM_VW_ALL_OUTWARD_SUPPLY_SALES_SUM', 'JSM_VW_BILL_AGAINST_PAID', 'JSM_VW_BOOK_PRINT_JV', 'JSM_VW_BOOK_PRINT_SLPU', 'JSM_VW_BOX_STOCK', 'JSM_VW_BOX_STOCK_VALUE',
      'JSM_VW_BROKER_TAX_INVOICE', 'JSM_VW_BROKREG_OS', 'JSM_VW_BROKREG_STATEMENT', 'JSM_VW_BROKREG_STATEMENT_SUMMARY', 'JSM_VW_CASHBANK_DETAIL',
      'JSM_VW_CASHBANK_DTLVNO', 'JSM_VW_CHEQ_IN_HAND', 'JSM_VW_CUTTING_CLEAR',
      'JSM_VW_CUTTING_PENDING', 'JSM_VW_CUTTING_STK', 'JSM_VW_DAILY_TRANS',
      'JSM_VW_DAILY_TRANS_SUMMARY', 'JSM_VW_DB_REPAIR', 'JSM_VW_EWAY_UPLOAD', 'JSM_VW_FINISH_STOCK_SUMMARY_REPORT', 'JSM_VW_FRM_TAB_REPORT', 'JSM_VW_GRATER_OR_LESS', 'JSM_VW_GREY_STK_DATE', 'JSM_VW_GROUP_BALANCE',
      'JSM_VW_GSTR3B_CESS', 'JSM_VW_GSTR3B_MONTHLY', 'JSM_VW_GSTR3B_MONTHLY_EXCEL', 'JSM_VW_GSTR9C_OLD', 'JSM_VW_GSTR9_NEW', 'JSM_VW_GSTR9_OLD', 'JSM_VW_GSTR_3B_ZOOMIN_RPT', 'JSM_VW_GST_FREEZE_DATA', 'JSM_VW_GST_JOBWORK_BROK_ZOOM_REPORT', 'JSM_VW_GST_PROC_DTL', 'JSM_VW_GST_PROC_SMRY', 'JSM_VW_GST_PURCHASE_GSTR2_REPORT',
      'JSM_VW_GST_PURCHASE_GSTR2_SLAB_REPORT', 'JSM_VW_GST_PURCHASE_GSTR2_SLAB_SUMMARY',
      'JSM_VW_GST_PURCHASE_RTN_GSTR2_REPORT', 'JSM_VW_GST_PURCHASE_RTN_GSTR2_SLAB_REPORT',
      'JSM_VW_GST_PURCHASE_RTN_GSTR2_SLAB_SUMMARY', 'JSM_VW_GST_PU_SMRY_GROUP', 'JSM_VW_GST_SALES_GSTR1_REPORT',
      'JSM_VW_GST_SALES_GSTR1_SLAB_REPORT', 'JSM_VW_GST_SALES_GSTR1_SLAB_SUMMARY',
      'JSM_VW_GST_SALES_RTN_GSTR1_REPORT', 'JSM_VW_GST_SALES_RTN_GSTR1_SLAB_REPORT',
      'JSM_VW_GST_SALES_RTN_GSTR1_SLAB_SUMMARY', 'JSM_VW_GST_SALES_SMRY_GROUP', 'JSM_VW_GST_SALES_SUMMARY', 'JSM_VW_HSN_WISE_REPORT_ALL', 'JSM_VW_IMPORT_SALES_MATCH', 'JSM_VW_INT_WISE_SALES_RPT', 'JSM_VW_JB_RCPT', 'JSM_VW_JOB_BROK_STATE_RPT',
      'JSM_VW_JOB_CHALLAN_STATUS', 'JSM_VW_JOB_PROFIT_REG', 'JSM_VW_JOB_PROFIT_REG_PCS', 'JSM_VW_JOURNAL_DETAILS_RPT', 'JSM_VW_JS_GSTR1_RPT',
      'JSM_VW_JS_GSTR2_RPT', 'JSM_VW_JS_GSTR3_SMRY', 'JSM_VW_JV_BOOK',
      'JSM_VW_JV_BOOK_SUMMARY', 'JSM_VW_KGS_STOCK', 'JSM_VW_LIST_PRINT', 'JSM_VW_LIST_PRINT_OLD',
      'JSM_VW_LOT_COSTING', 'JSM_VW_LOT_COSTING_KGS', 'JSM_VW_MASTER_ITEM_REPORT', 'JSM_VW_MATCH8A',
      'JSM_VW_MILL_RTN_TO_SEND', 'JSM_VW_OS_90DAYS', 'JSM_VW_OS_PURCHASE_SUMMARY',
      'JSM_VW_OS_SALES_OLD', 'JSM_VW_OS_SALES_SUMMARY', 'JSM_VW_OS_UPDATE', 'JSM_VW_OS_ZOOM', 'JSM_VW_OS_ZOOM_SUMMARY', 'JSM_VW_OUTWARD_ERROR_CHECK',
      'JSM_VW_PROCESS_ISSUE_SUM_REPORT', 'JSM_VW_PR_RCPT',
      'JSM_VW_PURCHASE_ORDER_STATUS_REPORT', 'JSM_VW_PURCHASE_STOCK_GODOWN',
      'JSM_VW_PURCHASE_STOCK_LRWISE_REPORT', 'JSM_VW_PUR_STK', 'JSM_VW_PU_RCPT', 'JSM_VW_REC_TCS1', 'JSM_VW_REMINDER_DETAILS',
      'JSM_VW_RG_PEND', 'JSM_VW_ROW_FINISH_STOCK', 'JSM_VW_RUNTIME_ITEM_CAT_RPT', 'JSM_VW_SALES_CHALLAN_DTL_REPORT',
      'JSM_VW_SALES_DETAIL_SUM_REPORT', 'JSM_VW_SALES_HASTE_REPORT',
      'JSM_VW_SALES_ORDER_DETAILED_REPORT', 'JSM_VW_SALES_SLIP_REGISTER',
      'JSM_VW_SL_RCPT', 'JSM_VW_SMS_OS', 'JSM_VW_STOCK_FINISH__KGS', 'JSM_VW_STOCK_SIZEWISE', 'JSM_VW_STOCK_WITH_VALUE_REGISTER', 'JSM_VW_TDS_BOOK_DETAILREPORT',
      'JSM_VW_TRADING_BROKREG', 'JSM_VW_TRAN_BANK_DETAIL', 'JSM_VW_TR_BAL', 'JSM_VW_T_CASHBANK_MONTH_WISE', 'JSM_VW_UPDATE_LOT_STATUS',
      'RPT_BILLWISE_DETAIL', 'RPT_CASHBANK_DETAIL', 'RPT_CASHBANK_SUMMARY', 'RPT_CHK_DIFF_LASTYEAR', 'RPT_GREY_AT_MILL_REGISTER', 'RPT_GREY_AT_SHOP',
      'RPT_INVESTMENT_RAJUBHAI', 'RPT_OSSALES_DETAIL', 'RPT_SALES_SLIP_DETAIL_REPORT', 'RPT_SALES_SLIP_SUMMARY_REPORT', 'RPT_STK_METER_STATEMENT', 'RPT_STOCK_QTY_VALUE', 'RPT_STOCK_WITH_VALUE', 'RPT_TDS_CERTIFICATE', 'RPT_TDS_CHALLAN', 'RPT_TDS_PARTY_MONTH',
    ],
    'a newly uncaptured layout appeared — give it fallbackColumns or capture it from STP_REPORT'
  );
  assert.ok(fallbacksFor('processSend').has('JSM_VW_PROCESS_ISSUE_SUM_REPORT'));
  // Rpt_Sales_Haste has no STP_REPORT row at all — its columns come from the owner's printed output.
  assert.ok(fallbacksFor('salesHaste').has('JSM_VW_SALES_HASTE_REPORT'));
});

test('JobWork Send uses JSM\'s own captured columns, not a hand-written list', () => {
  assert.ok(layouts.JSM_VW_JOBWORK_ISSUE_REPORT, 'layout must be captured');
  assert.equal(fallbacksFor('jobSend').size, 0, 'a guessed column list would hide JSM\'s real one');

  const shown = layouts.JSM_VW_JOBWORK_ISSUE_REPORT.S
    .filter((f) => f.variants && f.variants['1'])
    .sort((a, b) => a.variants['1'].order - b.variants['1'].order)
    .map((f) => f.field);
  assert.deepEqual(shown, ['NCCHLN_NO', 'CHLN_DATE', 'PARTY', 'ITEM', 'ISS_PCS', 'ISS_QTY', 'REMARK_1']);
});

test('captured jobwork and process layouts expose columns for their variants', () => {
  const variants = (name) => {
    const vs = new Set();
    for (const fields of Object.values(layouts[name])) {
      for (const f of fields) for (const v of Object.keys(f.variants || {})) vs.add(v);
    }
    return vs;
  };
  for (const name of ['JSM_VW_JOBWORK_STOCK_REPORT', 'JSM_VW_JOBWORK_RECEIPT_DETAIL', 'JSM_VW_PROCESS_STOCK_DTL']) {
    assert.ok(layouts[name], `${name} must be captured`);
    assert.ok(variants(name).size > 0, `${name} has no variant columns`);
  }
});
