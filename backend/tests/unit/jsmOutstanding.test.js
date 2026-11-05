'use strict';

/**
 * JSM's Outstanding family (Debitor/Creditor/Process/Jobwork O/s + Age Analysis), from
 * services/jsmReports/outstandingReport.js. The balance figures themselves are never computed
 * here — they come from reportService.getOutstanding(), already proven by the existing (non-JSM)
 * Outstanding report. These tests cover only the JSM presentation: grouping, captions, and that
 * SUM(bill balances) reproduces the party total getOutstanding already computed.
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const jsmReports = require('../../services/jsmReports');
const layouts = require('../../../frontend/src/jsm/blueprint/layouts.json');

const P = { from: '2026-04-01', to: '2027-03-11', fromText: '01/04/2026', toText: '11/03/2027' };

/** Two parties, each with two bills, matching the row shape sources/outstanding.js produces. */
const ROWS = [
  { PARTY: 'ADDU CUSTOMER', BROKER: 'BRK ONE', STATION: 'UJJAIN', MAINGROUP: 'DEBTORS', BOOK: 'SALES',
    BILL_DATE: new Date('2026-09-05T00:00:00Z'), NCBILL_NO: '1104', NET_TOT: 7692, PAID_DATE: null,
    ADJUST: 0, GOODS_RTN: 0, TOT_DISC: 0, TOT_BALANCE: 7692, OS_DAYS: 39, _billId: 'b1' },
  { PARTY: 'ADDU CUSTOMER', BROKER: 'BRK ONE', STATION: 'UJJAIN', MAINGROUP: 'DEBTORS', BOOK: 'SALES',
    BILL_DATE: new Date('2026-10-03T00:00:00Z'), NCBILL_NO: '1106', NET_TOT: 37333, PAID_DATE: null,
    ADJUST: 0, GOODS_RTN: 0, TOT_DISC: 0, TOT_BALANCE: 37333, OS_DAYS: 31, _billId: 'b2' },
  { PARTY: 'MAHESH TEX', BROKER: 'BRK TWO', STATION: 'SURAT', MAINGROUP: 'DEBTORS', BOOK: 'SALES',
    BILL_DATE: new Date('2026-08-07T00:00:00Z'), NCBILL_NO: '4', NET_TOT: 93563, PAID_DATE: new Date('2026-08-11T00:00:00Z'),
    ADJUST: 2000, GOODS_RTN: 0, TOT_DISC: 8477, TOT_BALANCE: 83086, OS_DAYS: 96, _billId: 'b3' },
];

const AGE_ROWS = [
  { PARTY: 'ADDU CUSTOMER', BROKER: 'BRK ONE', STATION: 'UJJAIN', MAINGROUP: 'DEBTORS', TOT_BALANCE: 45025, BAL_AMT1: 45025, BAL_AMT2: 0, BAL_AMT3: 0, BAL_AMT4: 0, BAL_UNADJ: 0 },
  { PARTY: 'MAHESH TEX', BROKER: 'BRK TWO', STATION: 'SURAT', MAINGROUP: 'DEBTORS', TOT_BALANCE: 83086, BAL_AMT1: 0, BAL_AMT2: 0, BAL_AMT3: 83086, BAL_AMT4: 0, BAL_UNADJ: 0 },
];

const FORMS = [
  ['Rpt_Jsm_Os_Sales', 'JSM_VW_OS_SALES', 'JSM_VW_OS_SALES_AGEANALYSIS'],
  ['Rpt_Jsm_Os_Purchase', 'JSM_VW_OS_PURCHASE', 'JSM_VW_OS_PURCHASE_AGEANALYSIS'],
  ['Rpt_Jsm_Os_Process', 'JSM_VW_OS_PROCESS', 'JSM_VW_OS_PROCESS_AGEANALYSIS'],
  ['Rpt_Jsm_Os_Jobwork', 'JSM_VW_OS_JOBWORK', 'JSM_VW_OS_JOBWORK_AGEANALYSIS'],
];

for (const [form, view, ageView] of FORMS) {
  describe(form, () => {
    const report = jsmReports.get(form);
    const ageForm = `${form}_AgeAnalysis`;
    const ageReport = jsmReports.get(ageForm);

    it('is served under its JSM form name, from JSM\'s own captured layout', async () => {
      assert.ok(layouts[view], `${view} must be captured`);
      assert.ok(layouts[ageView], `${ageView} must be captured`);
      const r = await report.run('c1', P, { rows: ROWS });
      assert.equal(r.grid.layout, view);
      const a = await ageReport.run('c1', P, { rows: AGE_ROWS });
      assert.equal(a.grid.layout, ageView);
    });

    it('groups by party (Category Wise 1/2) and totals reconcile to getOutstanding\'s own figures', async () => {
      const r = await report.run('c1', { ...P, category: '2-Party' }, { rows: ROWS });
      const addu = r.rows.filter((x) => x.PARTY === 'ADDU CUSTOMER');
      assert.equal(addu.length, 2);
      const sumBalance = addu.reduce((s, x) => s + x.TOT_BALANCE, 0);
      assert.equal(sumBalance, 7692 + 37333, 'party total must equal the sum of its own bills');
    });

    it('Broker / City / MainGroup groupings relabel the heading (sales/purchase only go to 5)', async () => {
      const r = await report.run('c1', { ...P, category: '3-Broker' }, { rows: ROWS });
      assert.equal(r.grid.captions.GROUP2, 'BROKER');
      assert.deepEqual([...new Set(r.rows.map((x) => x.XGROUP))].sort(), ['BRK ONE', 'BRK TWO']);
    });

    it('Age Analysis party totals equal the sum of its own buckets', async () => {
      const a = await ageReport.run('c1', { ...P, category: '1-Party' }, { rows: AGE_ROWS });
      for (const row of a.rows) {
        const sum = row.BAL_AMT1 + row.BAL_AMT2 + row.BAL_AMT3 + row.BAL_AMT4 + row.BAL_UNADJ;
        assert.equal(sum, row.TOT_BALANCE, `${row.GROUP2 || row.PARTY}: buckets must add up to the balance`);
      }
    });
  });
}

describe('process and jobwork only offer Normal/Party/Broker', () => {
  it('a City or MainGroup request falls back to 1-Normal, JSM\'s own flat ungrouped list', async () => {
    const r = await jsmReports.get('Rpt_Jsm_Os_Process').run('c1', { ...P, category: '4-CityWise' }, { rows: ROWS });
    assert.deepEqual(r.grid.groupColumns, []);
    assert.equal(r.grid.title, 'Outstanding Process Report');
  });

  it('Party Wise still groups, and is captioned as JSM captions it', async () => {
    const r = await jsmReports.get('Rpt_Jsm_Os_Process').run('c1', { ...P, category: '2-Party' }, { rows: ROWS });
    assert.deepEqual(r.grid.groupColumns, ['XGROUP']);
    assert.equal(r.grid.captions.GROUP2, 'PARTY');
    assert.equal(r.grid.title, 'Party Wise Outstanding Process Report');
  });
});

describe('grid primaryDetailColumn points at the bill, not the party', () => {
  it('so JSM counts each bill once even though it repeats the party columns', async () => {
    const r = await jsmReports.get('Rpt_Jsm_Os_Sales').run('c1', P, { rows: ROWS });
    assert.equal(r.grid.primaryDetailColumn, '_billId');
  });
});

describe('Age Analysis follows the screen\'s own Day 1-4 boxes', () => {
  const AGE_ROWS = [
    { PARTY: 'ALPHA', BROKER: 'B1', TOT_BALANCE: 300, BAL_AMT1: 100, BAL_AMT2: 100, BAL_AMT3: 100, BAL_AMT4: 0, BAL_UNADJ: 0 },
  ];

  it('captions the buckets from the days given, the way JSM labels them', async () => {
    const r = await jsmReports.get('Rpt_Jsm_Os_Sales_AgeAnalysis')
      .run('c1', { ...P, ageDay1: 15, ageDay2: 45, ageDay3: 75 }, { rows: AGE_ROWS });
    assert.equal(r.grid.captions.BAL_AMT1, '0-15');
    assert.equal(r.grid.captions.BAL_AMT2, '16-45');
    assert.equal(r.grid.captions.BAL_AMT3, '46-75');
    assert.equal(r.grid.captions.BAL_AMT4, '76&Above');
  });

  it('keeps JSM\'s own 0-30 / 31-60 / 61-90 / 91&Above when the boxes are untouched', async () => {
    const r = await jsmReports.get('Rpt_Jsm_Os_Sales_AgeAnalysis').run('c1', P, { rows: AGE_ROWS });
    assert.deepEqual(
      [r.grid.captions.BAL_AMT1, r.grid.captions.BAL_AMT2, r.grid.captions.BAL_AMT3, r.grid.captions.BAL_AMT4],
      ['0-30', '31-60', '61-90', '91&Above']
    );
  });

  it('1-Normal and 2-Party both list a row per party; 3-Broker gathers them', async () => {
    const party = await jsmReports.get('Rpt_Jsm_Os_Sales_AgeAnalysis').run('c1', { ...P, category: '2-Party' }, { rows: AGE_ROWS });
    assert.equal(party.grid.captions.GROUP2, 'PARTY');
    assert.deepEqual(party.rows.map((x) => x.GROUP2), ['ALPHA']);
    const broker = await jsmReports.get('Rpt_Jsm_Os_Sales_AgeAnalysis').run('c1', { ...P, category: '3-Broker' }, { rows: AGE_ROWS });
    assert.equal(broker.grid.captions.GROUP2, 'BROKER');
    assert.deepEqual(broker.rows.map((x) => x.GROUP2), ['B1']);
  });
});
