'use strict';

/**
 * Golden test: JSM's Sales Summary / Purchase Summary screens — the ones on the main menu path —
 * against JSM's OWN SQL on Sanchal Creation's real books
 * (fixture: scripts/golden-master/extractJsmRegisterSummary.js, read-only).
 *
 * These group on both Order By combos at once, so what is checked is that the same bills land in
 * the same groups, with the same totals, in the order the screen's own rules give — including
 * the two places Month changes the sort and the Amt Asc / Amt Desc radio.
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const jsmReports = require('../../services/jsmReports');

const fixture = require(path.join(__dirname, 'fixtures', 'jsm_sc27_register_summary.json'));
const P = fixture.period;
const r2 = (n) => Number(Number(n || 0).toFixed(2));

const SCREENS = [
  ['sales', 'Rpt_SalesRegisterSummary_Report'],
  ['purchase', 'Rpt_PurchaseRegisterSummary_Report'],
];

/** Rows gathered by their first group, each run sorted, so an order JSM leaves open is ignored. */
function byGroup1(rows) {
  const runs = new Map();
  for (const r of rows) {
    if (!runs.has(r[0])) runs.set(r[0], []);
    runs.get(r[0]).push(r);
  }
  return [...runs].map(([g, list]) => [g, list.sort((a, b) => (a.join('\u0001') < b.join('\u0001') ? -1 : 1))]);
}

for (const [key, form] of SCREENS) {
  const data = fixture.screens[key];

  describe(`JSM golden: ${key} Summary Report matches JSM's own SQL`, () => {
    for (const s of data.scenarios) {
      const name = `${s.orderBy1} / ${s.orderBy2}${s.sort ? ` sorted ${s.sort}` : ''}`;
      it(name, async () => {
        const { rows } = await jsmReports.get(form).run('jsm', {
          ...P, orderBy1: s.orderBy1, orderBy2: s.orderBy2, sort: s.sort, summaryReports: true,
        }, { rows: data.rows });

        const ours = rows.map((r) => [
          String(r.ZGROUP1 ?? ''), String(r.ZGROUP2 ?? ''),
          r2(r.TO_PCS), r2(r.TO_QTY), r2(r.TO_QTY1), r2(r.SUB_TOT),
          r2(r.TAXABLE_AMT), r2(r.NET_TOT), r2(r.T_ADD), r2(r.T_LESS),
        ]);
        const jsm = s.expected.map((e) => [
          String(e.ZGROUP1 ?? ''), String(e.ZGROUP2 ?? ''),
          r2(e.TO_PCS), r2(e.TO_QTY), r2(e.TO_QTY1), r2(e.SUB_TOT),
          r2(e.TAXABLE_AMT), r2(e.NET_TOT), r2(e.T_ADD), r2(e.T_LESS),
        ]);

        // With Month as the FIRST Order By, JSM sorts `YEAR_NO, MONTH_NO, ZGROUP1` and never
        // names ZGROUP2 — so the rows inside one month come back in an order SQL Server does not
        // promise. Those runs are compared as sets; every other combination, where JSM does sort
        // on ZGROUP2, has to match row for row.
        if (s.orderBy1 === 'Month') {
          assert.deepEqual(byGroup1(ours), byGroup1(jsm));
          return;
        }
        assert.deepEqual(ours, jsm);
      });
    }

    it('the grouped view prints on JSM\'s own summary layout', async () => {
      const { grid } = await jsmReports.get(form).run('jsm', { ...P }, { rows: data.rows });
      assert.equal(grid.layout, 'JSM_VW_REGISTER_SALES_SUMMARY_SUMMARYREPORT');
      assert.match(grid.title, /Register Wise .* Summary Report/);
    });

    it('unticking "Summary Reports" lists the bills themselves', async () => {
      const { rows, grid } = await jsmReports.get(form)
        .run('jsm', { ...P, summaryReports: false }, { rows: data.rows });
      assert.equal(rows.length, data.rows.length);
      assert.match(grid.layout, /_SUMMARY_REPORT$/);
    });

    it('an Order By this software does not record is refused, not guessed', async () => {
      await assert.rejects(
        () => jsmReports.get(form).run('jsm', { ...P, orderBy1: 'SalesMan' }, { rows: data.rows }),
        /does not record SalesMan/
      );
    });
  });
}

// --- the matching "ItemDetail" screens -------------------------------------------------------
const DETAIL_SCREENS = [
  ['salesDetail', 'Rpt_SalesRegisterDetailDigital_Report', 'sales'],
  ['purchaseDetail', 'Rpt_PurchaseRegisterDetail_Report', 'purchase'],
];

for (const [key, form, billsFrom] of DETAIL_SCREENS) {
  const data = fixture.screens[key];
  const rows = data.rows;

  describe(`JSM golden: ${key} matches JSM's own grouped SQL`, () => {
    for (const s of data.scenarios) {
      const name = `${s.groupBy1} / ${s.groupBy2}${s.monthWise ? ' + Month' : ''}${s.sortBy ? ` by ${s.sortBy} ${s.sort}` : ''}`;
      it(name, async () => {
        const { rows: got } = await jsmReports.get(form).run('jsm', {
          ...P,
          groupBy1: s.groupBy1,
          groupBy2: s.groupBy2,
          monthWise: s.monthWise,
          sortBy: s.sortBy,
          sort: s.sort,
          summaryReports: true,
        }, { rows });

        const ours = got.map((r) => [
          String(r.ZGROUP ?? ''), String(r.ZGROUP2 ?? ''), String(r.ZGROUP3 ?? ''),
          r2(r.TOT_PCS), r2(r.TOT_QTY), r2(r.TOT_AMOUNT),
        ]);
        const jsm = s.expected.map((e) => [
          String(e.ZGROUP ?? ''), String(e.ZGROUP2 ?? ''), String(e.ZGROUP3 ?? ''),
          r2(e.TOT_PCS), r2(e.TOT_QTY), r2(e.TOT_AMOUNT),
        ]);
        // Sorting by a total leaves rows that share that total in an order SQL does not promise,
        // and so does Month as the first group; those runs are compared as sets.
        if (s.sortBy || s.groupBy1 === 'Month') {
          assert.deepEqual(byGroup1(ours.map((r) => [r[3 + ['Pcs', 'Qty', 'Amt'].indexOf(s.sortBy || 'Amt')], ...r])),
            byGroup1(jsm.map((r) => [r[3 + ['Pcs', 'Qty', 'Amt'].indexOf(s.sortBy || 'Amt')], ...r])));
          return;
        }
        assert.deepEqual(ours, jsm);
      });
    }

    it('a Group By this software does not record is refused, not guessed', async () => {
      await assert.rejects(
        () => jsmReports.get(form).run('jsm', { ...P, groupBy1: 'Area' }, { rows }),
        /does not record Area/
      );
    });
  });
}
