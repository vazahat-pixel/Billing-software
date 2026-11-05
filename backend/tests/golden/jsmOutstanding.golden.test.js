'use strict';

/**
 * Golden test: JSM's Outstanding family against JSM's OWN SQL on Sanchal Creation's real books
 * (fixture: scripts/golden-master/extractJsmOutstanding.js, read-only).
 *
 * The figures on these screens come from reportService.getOutstanding(), which its own tests
 * cover; what is proved here is the part JSM's decompiled form decides — which rows are listed,
 * in what order, under which group header, for every Category Wise option. 1-Normal in
 * particular is a flat ungrouped list on JSM, not a party grouping.
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const jsmReports = require('../../services/jsmReports');

const fixture = require(path.join(__dirname, 'fixtures', 'jsm_sc27_outstanding.json'));
const P = { from: '2000-01-01', to: '2099-12-31' };
const r2 = (n) => Number(Number(n || 0).toFixed(2));
const day = (d) => (d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10));

const KINDS = [
  ['sales', 'Rpt_Jsm_Os_Sales', 'Sales', true],
  ['purchase', 'Rpt_Jsm_Os_Purchase', 'Purchase', false],
];

/**
 * Rows that land on the same group, Q_TYPE and bill date are compared as a set rather than a
 * sequence, for two reasons JSM itself creates:
 *   - a bill and an adjustment booked against it tie on every key, and SQL Server then returns
 *     them in an order it does not promise;
 *   - JSM breaks the remaining ties on T_SALES.BILL_NO, an internal sequence that is not the bill
 *     number anyone sees (bill "12" can precede bill "2"), and which this software does not have.
 * Everything between distinct keys — the grouping and the date order — still has to match JSM
 * exactly.
 */
function canonical(list, keyOf, rowOf) {
  const out = [];
  let run = [];
  let key = null;
  const flush = () => { out.push(...run.sort((a, b) => (a.join('\u0001') < b.join('\u0001') ? -1 : 1))); run = []; };
  for (const item of list) {
    const k = keyOf(item).join('\u0001');
    if (k !== key) { flush(); key = k; }
    run.push(rowOf(item));
  }
  flush();
  return out;
}
const TITLES = { 1: 'Outstanding {n} Report', 2: 'Party Wise ', 3: 'Broker Wise ', 4: 'City Wise ', 5: 'MainGroup Wise ' };

for (const [key, form, noun, nounFirst] of KINDS) {
  const data = fixture.kinds[key];

  describe(`JSM golden: ${key} Outstanding matches JSM's own listing`, () => {
    for (const s of data.scenarios) {
      it(`category ${s.category}: same bills, same order, same grouping`, async () => {
        const { rows, grid } = await jsmReports.get(form)
          .run('jsm', { ...P, category: `${s.category}-x` }, { rows: data.rows });

        const tieKey = (r) => [String(r.XGROUP ?? r.JS_GROUP ?? ''), String(r.Q_TYPE ?? ''), day(r.BILL_DATE)];
        const shown = (r) => [String(r.XGROUP ?? r.JS_GROUP ?? ''), r.NCBILL_NO || '', day(r.BILL_DATE), r.PARTY || '', String(r2(r.TOT_BALANCE))];
        assert.deepEqual(
          canonical(rows, tieKey, shown),
          canonical(s.expected, tieKey, shown)
        );
        // JSM's 1-Normal selects '' AS JS_GROUP — a flat list, so no group header column.
        assert.deepEqual(grid.groupColumns, s.category === 1 ? [] : ['XGROUP']);
      });
    }

    it('window titles are JSM\'s own', async () => {
      for (const cat of data.scenarios.map((s) => s.category)) {
        const { grid } = await jsmReports.get(form).run('jsm', { ...P, category: `${cat}-x` }, { rows: data.rows });
        const want = cat === 1
          ? `Outstanding ${noun} Report`
          : (nounFirst ? `${TITLES[cat]}${noun} Outstanding Report` : `${TITLES[cat]}Outstanding ${noun} Report`);
        assert.equal(grid.title, want, `category ${cat}`);
      }
    });
  });
}
