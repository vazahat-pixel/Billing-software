'use strict';

/**
 * Golden test: JSM's Item Wise Summary screens (Rpt_Jsm_Sales_ItemSummary /
 * Rpt_Jsm_Purchase_ItemSummary) against JSM's OWN grouped SQL on Sanchal Creation's real books
 * (fixture: scripts/golden-master/extractJsmBillRegisters.js, read-only).
 *
 * Checks every Category Wise option: the same groups, at the same levels (JSM groups on up to
 * three — GROUP1 heads the block, GROUP2/GROUP3 are the row), with the same totals and the same
 * average rate, which JSM works out on the summed row and not per line.
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const jsmReports = require('../../services/jsmReports');

const fixture = require(path.join(__dirname, 'fixtures', 'jsm_sc27_bill_registers.json'));
const P = fixture.period;
const r2 = (n) => Number(Number(n || 0).toFixed(2));

const SCREENS = [['sales', 'Rpt_Jsm_Sales_ItemSummary'], ['purchase', 'Rpt_Jsm_Purchase_ItemSummary']];

for (const [key, form] of SCREENS) {
  const data = fixture.registers[key];

  describe(`JSM golden: ${key} Item Wise Summary matches JSM's own SQL`, () => {
    for (const s of data.itemScenarios || []) {
      it(`category ${s.category}: same groups, totals and average rate`, async () => {
        const { rows } = await jsmReports.get(form)
          .run('jsm', { ...P, category: `${s.category}-x` }, { rows: data.rows });

        const ours = rows.map((r) => [
          String(r.GROUP1 ?? ''), String(r.GROUP2 ?? ''), String(r.GROUP3 ?? ''),
          r2(r.IT_PCS), r2(r.IT_QTY), r2(r.IT_AMOUNT), r2(r.AVG_RATE),
        ]);
        const jsm = s.expected.map((e) => [
          String(e.GROUP1 ?? ''), String(e.GROUP2 ?? ''), String(e.GROUP3 ?? ''),
          r2(e.IT_PCS), r2(e.IT_QTY), r2(e.IT_AMOUNT), r2(e.AVG_RATE),
        ]);
        assert.deepEqual(ours, jsm);
      });
    }
  });
}
