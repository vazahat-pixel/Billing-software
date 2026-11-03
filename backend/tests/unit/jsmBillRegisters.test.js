'use strict';

/**
 * JSM's four bill registers: Sales, Purchase, Sales Return, Purchase Return — each as a Summary
 * and a Detail screen. Read-only reports: they must reconcile to the bills, which is checked here
 * against the REAL sales and purchase totals engines, not against figures the test writes itself.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const regs = require('../../services/jsmReports/reports/billRegisters');
const { purchaseAddLess, salesAddLess, mapBill } = require('../../services/jsmReports/sources/billRegister');
const jsmReports = require('../../services/jsmReports');
const layouts = require('../../../frontend/src/jsm/blueprint/layouts.json');
const forms = require('../../../frontend/src/jsm/blueprint/forms.json');

const P = { from: '2026-04-01', to: '2027-03-31', fromText: '01/04/2026', toText: '31/03/2027' };

/** Two bills: one plain, one with footer adjustments; the second has two item lines. */
const ROWS = [
  {
    CO_ENT_NO: 'a', ENT_NO: 'a', SRAL_NO: '1', NCBILL_NO: 'B-11', BILL_DATE: new Date('2026-05-10T00:00:00Z'),
    REGISTER: 'BOOK A', BOOK: 'BOOK A', PARTY: 'ALPHA TEXTILES', BROKER: 'BRK ONE', STATION: 'SURAT', MAINGROUP: 'TRADERS',
    TO_PCS: 10, TO_QTY: 100, SUB_TOT: 1000, T_ADD: 0, T_LESS: 0, TAXABLE_AMT: 1000, GST_AMT: 50, NET_TOT: 1050,
    _lines: [{ ITEM_NAME: 'GREY 60x60', ITEM_GROUP: 'GREY', IT_PCS: 10, IT_QTY: 100, IT_RATE: 10, IT_AMOUNT: 1000 }],
  },
  {
    CO_ENT_NO: 'b', ENT_NO: 'b', SRAL_NO: '2', NCBILL_NO: 'B-12', BILL_DATE: new Date('2026-06-02T00:00:00Z'),
    REGISTER: 'BOOK A', BOOK: 'BOOK A', PARTY: 'BETA MILLS', BROKER: 'BRK TWO', STATION: 'MUMBAI', MAINGROUP: 'TRADERS',
    TO_PCS: 5, TO_QTY: 50, SUB_TOT: 500, T_ADD: 30, T_LESS: 20, TAXABLE_AMT: 510, GST_AMT: 25.5, NET_TOT: 535.5,
    _lines: [{ ITEM_NAME: 'GREY 60x60', ITEM_GROUP: 'GREY', IT_PCS: 3, IT_QTY: 30, IT_RATE: 10, IT_AMOUNT: 300 },
      { ITEM_NAME: 'POPLIN', ITEM_GROUP: 'FINISH', IT_PCS: 2, IT_QTY: 20, IT_RATE: 10, IT_AMOUNT: 200 }],
  },
];

const REGISTERS = [
  ['Rpt_Jsm_Sales', regs.sales, 'JSM_VW_SALES'],
  ['Rpt_Jsm_Purchase', regs.purchase, 'JSM_VW_PURCHASE'],
  ['Rpt_Jsm_Sales_Return', regs.salesReturn, 'JSM_VW_SALES_RETURN'],
  ['Rpt_Jsm_Purchase_Return', regs.purchaseReturn, 'JSM_VW_PURCHASE_RETURN'],
];

for (const [form, report, view] of REGISTERS) {
  describe(form, () => {
    const run = (p) => report.run('c1', { ...P, ...p }, { rows: ROWS });

    it('is served under its JSM form name, from JSM\'s own captured layouts', async () => {
      assert.equal(jsmReports.get(form), report);
      assert.ok(forms[form], 'blueprint screen must exist');
      for (const suffix of ['_SMRY_SHORT', '_SMRY_FULL', '_DTL']) assert.ok(layouts[view + suffix], `${view}${suffix} captured`);
      assert.equal((await run({})).grid.layout, `${view}_SMRY_SHORT`);
      assert.equal((await run({ reportType: '2-My Format' })).grid.layout, `${view}_SMRY_FULL`);
      assert.equal((await run({ detail: true })).grid.layout, `${view}_DTL`);
    });

    it('Category Wise is the layout variant, and the grouping heading follows it', async () => {
      for (const n of report.categories) {
        const r = await run({ category: `${n}-x` });
        assert.equal(r.grid.variant, n);
        assert.ok(r.grid.captions.GROUP2, 'grouping column relabelled');
      }
    });

    it('Register sums every bill; SUB_TOT + ADD - LESS reconciles to the taxable amount', async () => {
      const g = (await run({ category: '1-Register' })).rows[0];
      assert.equal(g.TO_QTY, 150);
      assert.equal(g.NET_TOT, 1585.5);
      assert.equal(g.SUB_TOT + g.T_ADD - g.T_LESS, g.TAXABLE_AMT);
    });

    it('Detail is one row per item line, the bill counted once', async () => {
      const r = await run({ detail: true });
      assert.equal(r.rows.length, 3);
      assert.equal(r.grid.primaryDetailColumn, 'CO_ENT_NO');
    });
  });
}

describe('screen behaviour', () => {
  const run = (p) => regs.purchase.run('c1', { ...P, ...p }, { rows: ROWS });

  it('ItemWise groups the item LINES, so one bill shows under each of its items', async () => {
    const r = await run({ category: '6-ItemWise' });
    assert.deepEqual(r.rows.map((x) => x.GROUP2), ['GREY 60x60', 'POPLIN']);
    assert.equal(r.rows[0].TO_QTY, 130);
  });

  it('Item+PartyWise (sales only) groups by item and party together', async () => {
    const r = await regs.sales.run('c1', { ...P, category: '7-Item+PartyWise' }, { rows: ROWS });
    assert.deepEqual(r.rows.map((x) => x.GROUP2), ['GREY 60x60 / ALPHA TEXTILES', 'GREY 60x60 / BETA MILLS', 'POPLIN / BETA MILLS']);
  });

  it('a grouping this software does not record (JSM\'s SuitWise) is refused, not faked', async () => {
    await assert.rejects(() => regs.sales.run('c1', { ...P, category: '8-SuitWise' }, { rows: ROWS }), /cannot be grouped/);
    await assert.rejects(() => regs.purchase.run('c1', { ...P, category: '7-Item+PartyWise' }, { rows: ROWS }), /cannot be grouped/);
  });

  it('opens on Register when no category is given', async () => {
    assert.equal((await run({})).grid.variant, 1);
  });

  it('JSM\'s summary layout hides TOT.ADD / TOT.LESS on variants 5 and 6', () => {
    const f = layouts.JSM_VW_PURCHASE_SMRY_SHORT.S;
    const shown = (name, v) => Boolean(f.find((x) => x.field === name)?.variants?.[String(v)]);
    for (const v of [1, 2, 3, 4]) assert.ok(shown('T_ADD', v) && shown('T_LESS', v));
    for (const v of [5, 6]) assert.ok(!shown('T_ADD', v) && !shown('T_LESS', v));
  });

  it('the date range, and the From/To range on the number the radio picks', async () => {
    assert.deepEqual((await run({ from: '2026-06-01', to: '2026-06-30' })).rows.map((x) => x.NET_TOT), [535.5]);
    const byBill = await run({ detail: true, orderBy: 'billno', numFrom: 'B-12', numTo: 'B-12' });
    assert.ok(byBill.rows.length && byBill.rows.every((x) => x.NCBILL_NO === 'B-12'));
    const bySr = await run({ detail: true, orderBy: 'srno', numFrom: '1', numTo: '1' });
    assert.ok(bySr.rows.length && bySr.rows.every((x) => x.SRAL_NO === '1'));
  });

  it('B-Bill.No / C-Serial.No replace the date range, they do not add to it', async () => {
    // JSM swaps the date From/To for the number From/To, so the dates must not filter in this mode.
    const r = await run({ detail: true, orderBy: 'srno', numFrom: '1', numTo: '2', from: '2030-01-01', to: '2030-12-31' });
    assert.equal(new Set(r.rows.map((x) => x.CO_ENT_NO)).size, 2, 'both bills, whatever the hidden dates say');
    assert.match(r.grid.period, /^SR\.NO : FROM 1 {2}TO {2}2$/);
    // ...and in A-Date mode a number typed earlier must not filter.
    const d = await run({ detail: true, orderBy: 'date', numFrom: '2', numTo: '2' });
    assert.equal(new Set(d.rows.map((x) => x.CO_ENT_NO)).size, 2);
    assert.match(d.grid.period, /^DATE : FROM/);
  });

  it('number ranges compare as numbers: 9 is inside 1 to 20', async () => {
    const rows = [9, 10, 25].map((n) => ({ ...ROWS[0], CO_ENT_NO: `n${n}`, SRAL_NO: String(n) }));
    const r = await regs.purchase.run('c1', { ...P, detail: true, orderBy: 'srno', numFrom: '1', numTo: '20' }, { rows });
    assert.deepEqual([...new Set(r.rows.map((x) => x.SRAL_NO))].sort(), ['10', '9']);
  });

  it('these JSM screens have no tick-list tabs', () => {
    for (const [form] of REGISTERS) {
      assert.equal(forms[form].controls.filter((c) => c.type === 'ListView').length, 0, form);
    }
  });
});

describe('Add / Less against the real purchase totals engine', () => {
  const { recalcPurchaseTotals } = require('../../utils/purchaseTotals');
  const items = [
    { itemId: { name: 'GREY' }, pcs: 3, mts: 30, rate: 12, amount: 360, dis1Amt: 10, unit: 'MTRS', gstPer: 5 },
    { itemId: { name: 'POPLIN' }, pcs: 2, mts: 20, rate: 15, amount: 300, addAmt: 5, unit: 'MTRS', gstPer: 5 },
  ];
  const CASES = [
    ['no adjustments', {}],
    ['discount', { discountAmt: 40, discountSign: '-' }],
    ['less', { lessAmt: 25, lessSign: '-' }],
    ['add', { addAmt: 60, addSign: '+' }],
    ['add entered as a minus', { addAmt: 60, addSign: '-' }],
    ['octroi', { octroi: 12, octroiSign: '+' }],
    ['round off', { rdAmt: 7 }],
    ['freight', { freight: 150 }],
    ['everything', { discountAmt: 40, discountSign: '-', lessAmt: 25, lessSign: '-', addAmt: 60, addSign: '+', octroi: 12, octroiSign: '+', rdAmt: 7, freight: 150 }],
  ];

  for (const [label, extras] of CASES) {
    it(`a purchase bill reconciles — ${label}`, () => {
      const t = recalcPurchaseTotals(items, { gstType: 'CGST+SGST', gstRate: 5, extras });
      const bill = { ...extras, freightAmount: extras.freight, items, taxableAmount: t.taxableAmount, netAmount: t.netAmount };
      const row = mapBill(bill, { side: 'purchase', partyPath: 'supplierId', bookName: new Map(), fallbackBook: 'P', coShort: '' });
      assert.equal(Number((row.SUB_TOT + row.T_ADD - row.T_LESS).toFixed(2)), Number(Number(t.taxableAmount).toFixed(2)));
    });
  }

  it('otherCharges is not an Add — that engine leaves it out of the taxable amount', () => {
    assert.deepEqual(purchaseAddLess({ otherCharges: 7 }), { add: 0, less: 0 });
  });
});

describe('Add / Less against the real sales totals engine', () => {
  const { recalcSalesTotals } = require('../../utils/salesTotals');
  const items = [
    { itemId: { name: 'GREY' }, pcs: 3, mts: 30, rate: 12, amount: 360, discount: 10, unit: 'MTRS', gstPer: 5 },
    { itemId: { name: 'POPLIN' }, pcs: 2, mts: 20, rate: 15, amount: 300, unit: 'MTRS', gstPer: 5 },
  ];
  const CASES = [
    ['no adjustments', {}],
    ['freight', { freight: 100 }],
    ['fold less', { foldLess: 5, foldLessSign: '-' }],
    ['R/D as a plus', { rdAmt: 3, rdAmtSign: '+' }],
    ['discount', { discountAmt: 40, discountSign: '-' }],
    ['less', { lessAmt: 25, lessSign: '-' }],
    ['add', { addAmt: 60, addSign: '+' }],
    ['add entered as a minus', { addAmt: 60, addSign: '-' }],
    ['everything', { freight: 100, foldLess: 5, foldLessSign: '-', rdAmt: 3, rdAmtSign: '-', discountAmt: 40, discountSign: '-', lessAmt: 25, lessSign: '-', addAmt: 60, addSign: '+' }],
  ];

  for (const [label, extras] of CASES) {
    it(`a sales bill entered here reconciles — ${label}`, () => {
      const t = recalcSalesTotals(items, { gstType: 'CGST+SGST', gstRate: 5, extras });
      const bill = { ...extras, items, taxableAmount: t.taxableAmount, netAmount: t.netAmount };
      const row = mapBill(bill, { side: 'sales', partyPath: 'customerId', bookName: new Map(), fallbackBook: 'S', coShort: '' });
      assert.equal(Number((row.SUB_TOT + row.T_ADD - row.T_LESS).toFixed(2)), Number(Number(t.taxableAmount).toFixed(2)));
    });
  }

  it('a bill imported from JSM keeps JSM\'s own Add/Less split', () => {
    // The importer writes JSM's AMT_1..7 as totalAdd / totalLess and no signed footer fields.
    assert.deepEqual(salesAddLess({ totalAdd: 120, totalLess: 35 }), { add: 120, less: 35 });
    // ...and that split wins over any loose footer field on the same bill.
    assert.deepEqual(salesAddLess({ totalAdd: 120, totalLess: 35, freight: 999 }), { add: 120, less: 35 });
  });
});

describe('returns', () => {
  it('a return carries no footer adjustments in this software, so its Add/Less is zero', async () => {
    const r = await regs.salesReturn.run('c1', { ...P, category: '1-Register' }, {
      rows: ROWS.map((x) => ({ ...x, T_ADD: 0, T_LESS: 0, TAXABLE_AMT: x.SUB_TOT })),
    });
    assert.equal(r.rows[0].T_ADD, 0);
    assert.equal(r.rows[0].T_LESS, 0);
  });
});
