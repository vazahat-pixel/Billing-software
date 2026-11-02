'use strict';

/**
 * JSM: Reports › Purchase › Purchase Bill › Summary and Detail (form Rpt_Jsm_Purchase).
 *
 * The report is read-only: it decomposes the footer adjustments a bill was already saved with into
 * JSM's TOT.ADD / TOT.LESS, so SUB_TOT + T_ADD − T_LESS must land back on the stored taxable
 * amount. If that ever drifts, the register stops matching JSM and the bill at the same time.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const report = require('../../services/jsmReports/reports/purchaseRegister');
const { addLessOf } = require('../../services/jsmReports/sources/purchaseRegister');
const jsmReports = require('../../services/jsmReports');
const layouts = require('../../../frontend/src/jsm/blueprint/layouts.json');

const P = { from: '2026-04-01', to: '2027-03-31', fromText: '01/04/2026', toText: '31/03/2027' };

/** Two bills: one plain, one with every footer adjustment JSM would show as Add/Less. */
const ROWS = [
  {
    CO_ENT_NO: 'a', ENT_NO: 'a', SRAL_NO: '1', NCBILL_NO: 'SUP-11', BILL_DATE: new Date('2026-05-10T00:00:00Z'),
    REGISTER: 'PURCHASE', BOOK: 'PURCHASE', PARTY: 'ALPHA TEXTILES', BROKER: 'BRK ONE', STATION: 'SURAT', MAINGROUP: 'SUPPLIER',
    TO_PCS: 10, TO_QTY: 100, SUB_TOT: 1000, T_ADD: 0, T_LESS: 0, TAXABLE_AMT: 1000, GST_AMT: 50, NET_TOT: 1050,
    _lines: [{ ITEM_NAME: 'GREY 60x60', ITEM_GROUP: 'GREY', IT_PCS: 10, IT_QTY: 100, IT_RATE: 10, IT_AMOUNT: 1000 }],
  },
  {
    CO_ENT_NO: 'b', ENT_NO: 'b', SRAL_NO: '2', NCBILL_NO: 'SUP-12', BILL_DATE: new Date('2026-06-02T00:00:00Z'),
    REGISTER: 'PURCHASE', BOOK: 'PURCHASE', PARTY: 'BETA MILLS', BROKER: 'BRK TWO', STATION: 'MUMBAI', MAINGROUP: 'SUPPLIER',
    TO_PCS: 5, TO_QTY: 50, SUB_TOT: 500, T_ADD: 30, T_LESS: 20, TAXABLE_AMT: 510, GST_AMT: 25.5, NET_TOT: 535.5,
    _lines: [{ ITEM_NAME: 'GREY 60x60', ITEM_GROUP: 'GREY', IT_PCS: 3, IT_QTY: 30, IT_RATE: 10, IT_AMOUNT: 300 },
      { ITEM_NAME: 'POPLIN', ITEM_GROUP: 'FINISH', IT_PCS: 2, IT_QTY: 20, IT_RATE: 10, IT_AMOUNT: 200 }],
  },
];

const run = (p) => report.run('c1', { ...P, ...p }, { rows: ROWS });

describe('registration and screens', () => {
  it('is served under its JSM form name', () => {
    assert.equal(typeof jsmReports.get('Rpt_Jsm_Purchase').run, 'function');
  });

  it('Summary and Detail use JSM\'s own captured layouts', async () => {
    const s = await run({});
    const d = await run({ detail: true });
    assert.equal(s.grid.layout, 'JSM_VW_PURCHASE_SMRY_SHORT');
    assert.equal(d.grid.layout, 'JSM_VW_PURCHASE_DTL');
    assert.ok(layouts[s.grid.layout] && layouts[d.grid.layout], 'both layouts must be captured');
  });

  it('"My Format" switches the Summary to JSM\'s full layout', async () => {
    const r = await run({ reportType: '2-My Format' });
    assert.equal(r.grid.layout, 'JSM_VW_PURCHASE_SMRY_FULL');
  });
});

describe('Category Wise is the layout variant', () => {
  const cases = [
    ['1-Register', 1, 'REGISTER', 'PURCHASE'],
    ['2-PartyWise', 2, 'PARTY', 'ALPHA TEXTILES'],
    ['3-BrokerWise', 3, 'BROKER', 'BRK ONE'],
    ['4-CityWise', 4, 'CITY', 'MUMBAI'], // groups are ordered by the group column, so M before S
    ['5-MainGroup', 5, 'MAINGROUP', 'SUPPLIER'],
    ['6-ItemWise', 6, 'ITEM', 'GREY 60x60'],
  ];

  for (const [input, variant, caption, firstGroup] of cases) {
    it(`${input} -> variant ${variant}, grouping column headed ${caption}`, async () => {
      const r = await run({ category: input });
      assert.equal(r.grid.variant, variant);
      assert.equal(r.grid.captions.GROUP2, caption);
      assert.equal(r.rows[0].GROUP2, firstGroup);
    });
  }

  it('an unknown category falls back to Register, as the screen opens', async () => {
    assert.equal((await run({ category: 'nonsense' })).grid.variant, 1);
    assert.equal((await run({})).grid.variant, 1);
  });

  it('JSM\'s layout itself drops TOT.ADD / TOT.LESS on variants 5 and 6', () => {
    const fields = layouts.JSM_VW_PURCHASE_SMRY_SHORT.S;
    const shownIn = (f, v) => Boolean(fields.find((x) => x.field === f)?.variants?.[String(v)]);
    for (const v of [1, 2, 3, 4]) {
      assert.ok(shownIn('T_ADD', v), `T_ADD should show on variant ${v}`);
      assert.ok(shownIn('T_LESS', v), `T_LESS should show on variant ${v}`);
    }
    for (const v of [5, 6]) {
      assert.equal(shownIn('T_ADD', v), false, `T_ADD must be hidden on variant ${v}`);
      assert.equal(shownIn('T_LESS', v), false, `T_LESS must be hidden on variant ${v}`);
    }
  });
});

describe('figures', () => {
  it('Register groups every bill together and sums them', async () => {
    const r = await run({ category: '1-Register' });
    assert.equal(r.rows.length, 1);
    const g = r.rows[0];
    assert.equal(g.TO_PCS, 15);
    assert.equal(g.TO_QTY, 150);
    assert.equal(g.SUB_TOT, 1500);
    assert.equal(g.T_ADD, 30);
    assert.equal(g.T_LESS, 20);
    assert.equal(g.NET_TOT, 1585.5);
  });

  it('SUB_TOT + T_ADD - T_LESS equals the taxable amount the bills were saved with', async () => {
    const r = await run({ category: '1-Register' });
    const g = r.rows[0];
    const expected = ROWS.reduce((s, x) => s + x.TAXABLE_AMT, 0);
    assert.equal(g.SUB_TOT + g.T_ADD - g.T_LESS, expected, 'the register must reconcile to the bills');
    assert.equal(g.TAXABLE_AMT, expected);
  });

  it('PartyWise keeps each party on its own row', async () => {
    const r = await run({ category: '2-PartyWise' });
    assert.deepEqual(r.rows.map((x) => x.GROUP2), ['ALPHA TEXTILES', 'BETA MILLS']);
    assert.equal(r.rows[1].NET_TOT, 535.5);
  });

  it('ItemWise groups the item LINES, so one bill can appear under two items', async () => {
    const r = await run({ category: '6-ItemWise' });
    assert.deepEqual(r.rows.map((x) => x.GROUP2), ['GREY 60x60', 'POPLIN']);
    assert.equal(r.rows[0].TO_QTY, 130, 'both bills contributed grey');
    assert.equal(r.rows[1].TO_QTY, 20);
  });

  it('Detail puts out one row per item line, carrying the bill columns', async () => {
    const r = await run({ detail: true });
    assert.equal(r.rows.length, 3, 'one line + two lines');
    assert.equal(r.grid.primaryDetailColumn, 'CO_ENT_NO', 'so the grid counts a bill once');
    const second = r.rows.filter((x) => x.CO_ENT_NO === 'b');
    assert.deepEqual(second.map((x) => x.ITEM_NAME), ['GREY 60x60', 'POPLIN']);
    assert.ok(second.every((x) => x.NCBILL_NO === 'SUP-12' && x.NET_TOT === 535.5));
  });
});

describe('screen filters', () => {
  it('the date range excludes bills outside it', async () => {
    const r = await run({ from: '2026-06-01', to: '2026-06-30' });
    assert.deepEqual(r.rows.map((x) => x.NET_TOT), [535.5]);
  });

  it('A-Date / B-Bill.No / C-Serial.No pick which number the From/To range applies to', async () => {
    const byBill = await run({ detail: true, orderBy: 'billno', numFrom: 'SUP-12', numTo: 'SUP-12' });
    assert.ok(byBill.rows.every((x) => x.NCBILL_NO === 'SUP-12'));
    const bySr = await run({ detail: true, orderBy: 'srno', numFrom: '1', numTo: '1' });
    assert.ok(bySr.rows.every((x) => x.SRAL_NO === '1'));
  });

  it('tab tick lists filter by party, broker, city, book and item', async () => {
    assert.deepEqual((await run({ parties: ['BETA MILLS'] })).rows.map((x) => x.GROUP2), ['PURCHASE']);
    assert.equal((await run({ category: '2-PartyWise', brokers: ['BRK ONE'] })).rows.length, 1);
    assert.equal((await run({ category: '2-PartyWise', stations: ['MUMBAI'] })).rows[0].GROUP2, 'BETA MILLS');
    assert.equal((await run({ category: '2-PartyWise', books: ['PURCHASE'] })).rows.length, 2);
    const onlyPoplin = await run({ category: '2-PartyWise', items: ['POPLIN'] });
    assert.deepEqual(onlyPoplin.rows.map((x) => x.GROUP2), ['BETA MILLS'], 'only the bill carrying that item');
  });
});

describe('footer adjustments become JSM Add / Less', () => {
  it('a plus-signed adjustment adds, a minus-signed one reduces', () => {
    assert.deepEqual(addLessOf({ addAmt: 50, addSign: '+', lessAmt: 20, lessSign: '-' }), { add: 50, less: 20 });
    assert.deepEqual(addLessOf({ discountAmt: 15, discountSign: '-' }), { add: 0, less: 15 });
    // A discount entered as a plus (JSM allows the sign to be flipped) must add, not reduce.
    assert.deepEqual(addLessOf({ discountAmt: 15, discountSign: '+' }), { add: 15, less: 0 });
  });

  it('round-off always reduces and freight / other charges always add', () => {
    assert.deepEqual(addLessOf({ rdAmt: 3, freightAmount: 100, otherCharges: 7 }), { add: 107, less: 3 });
  });

  it('a bill with no adjustments has none', () => {
    assert.deepEqual(addLessOf({}), { add: 0, less: 0 });
  });
});
