'use strict';

/**
 * JSM: Sales/Purchase Item Wise Summary (Rpt_Jsm_Sales_ItemSummary / _Purchase_ItemSummary).
 * Category 2-Item is cross-checked against JSM's own JSM_VW_PURCHASE_SMRY_SHORT_ITEMWISE_RUNTIME,
 * read directly off the owner's JSM on 03/11/2026 while running this exact screen:
 *   SELECT '' AS GROUP1, A.ITEM_NAME AS GROUP2, ... SUM(IT_PCS), SUM(IT_QTY), SUM(IT_AMOUNT) ...
 *   GROUP BY A.ITEM_NAME
 * i.e. category 2 groups purely by item name and sums pcs/qty/amount — exactly what this test pins.
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const jsmReports = require('../../services/jsmReports');
const layouts = require('../../../frontend/src/jsm/blueprint/layouts.json');

const P = { from: '2026-04-01', to: '2027-03-11' };

const ROWS = [
  { CO_ENT_NO: 'a', BILL_DATE: new Date('2026-05-10T00:00:00Z'), PARTY: 'ALPHA', BROKER: 'BRK1', BOOK: 'BOOK A', STATION: 'SURAT',
    _lines: [{ ITEM_NAME: 'GREY 60x60', IT_PCS: 10, IT_QTY: 100, IT_AMOUNT: 1000 }] },
  { CO_ENT_NO: 'b', BILL_DATE: new Date('2026-06-02T00:00:00Z'), PARTY: 'BETA', BROKER: 'BRK2', BOOK: 'BOOK A', STATION: 'MUMBAI',
    _lines: [{ ITEM_NAME: 'GREY 60x60', IT_PCS: 3, IT_QTY: 30, IT_AMOUNT: 300 }, { ITEM_NAME: 'POPLIN', IT_PCS: 2, IT_QTY: 20, IT_AMOUNT: 200 }] },
];

for (const [form, view] of [['Rpt_Jsm_Sales_ItemSummary', 'JSM_VW_SALES_SMRY_SHORT_ITEMWISE'], ['Rpt_Jsm_Purchase_ItemSummary', 'JSM_VW_PURCHASE_SMRY_SHORT_ITEMWISE']]) {
  describe(form, () => {
    const report = jsmReports.get(form);
    const run = (p) => report.run('c1', { ...P, ...p }, { rows: ROWS });

    it('is served from JSM\'s own captured layout', async () => {
      assert.ok(layouts[view]);
      assert.equal((await run({ category: '2-Item' })).grid.layout, view);
    });

    it('2-Item groups by item name alone and sums pcs/qty/amount — matches JSM\'s own RUNTIME view', async () => {
      const r = await run({ category: '2-Item' });
      assert.deepEqual(r.rows.map((x) => x.GROUP2).sort(), ['GREY 60x60', 'POPLIN']);
      const grey = r.rows.find((x) => x.GROUP2 === 'GREY 60x60');
      assert.equal(grey.IT_PCS, 13);
      assert.equal(grey.IT_QTY, 130);
      assert.equal(grey.IT_AMOUNT, 1300, '1000 + 300, from two different bills');
    });

    it('AVG.RATE is amount / qty, the column JSM\'s layout adds beyond the RUNTIME view', async () => {
      const r = await run({ category: '2-Item' });
      const grey = r.rows.find((x) => x.GROUP2 === 'GREY 60x60');
      assert.equal(grey.AVG_RATE, 10, '1300 / 130');
    });

    it('sum of every item group equals the sum of every bill line — nothing lost or doubled', async () => {
      const r = await run({ category: '2-Item' });
      const total = r.rows.reduce((s, x) => s + x.IT_AMOUNT, 0);
      const expected = ROWS.flatMap((b) => b._lines).reduce((s, l) => s + l.IT_AMOUNT, 0);
      assert.equal(total, expected);
    });
  });
}

describe('categories beyond what JSM\'s layout disambiguates', () => {
  it('Item+PartyWise (3) groups by the composite, same as the bill register\'s own category', async () => {
    const r = await jsmReports.get('Rpt_Jsm_Sales_ItemSummary').run('c1', { ...P, category: '3-Party+Item' }, { rows: ROWS });
    assert.deepEqual(r.rows.map((x) => x.GROUP2).sort(), ['GREY 60x60 / ALPHA', 'GREY 60x60 / BETA', 'POPLIN / BETA']);
  });

  it('an unknown category falls back to 1 rather than guessing', async () => {
    const r = await jsmReports.get('Rpt_Jsm_Purchase_ItemSummary').run('c1', { ...P, category: '99-nonsense' }, { rows: ROWS });
    assert.equal(r.grid.variant, 1);
  });
});

describe('Month Wise', () => {
  it('splits one item\'s total across the months its bills fell in', async () => {
    const r = await jsmReports.get('Rpt_Jsm_Sales_ItemSummary').run('c1', { ...P, category: '2-Item', monthWise: true }, { rows: ROWS });
    const months = [...new Set(r.rows.filter((x) => x.GROUP2 === 'GREY 60x60').map((x) => x.GROUP3))].sort();
    assert.deepEqual(months, ['June', 'May']);
  });
});
