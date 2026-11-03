'use strict';

/**
 * JSM: Reports › Sales › Sales Bill › Haste/Transport (Rpt_Sales_Haste).
 *
 * B: Packers is cross-checked against TMP_VW_PACKERS, the transient view JSM itself built for
 * this screen on the owner's JSM (03/11/2026): it groups by T_SL_ITEM.IT_DISC1 — this software's
 * item line `desc`, exposed here as IT_DISC1.
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const haste = require('../../services/jsmReports/reports/salesHaste');

const P = { from: '2026-04-01', to: '2027-03-11' };

const ROWS = [
  { NCBILL_NO: '2', BILL_DATE: new Date('2026-05-06T00:00:00Z'), PARTY: 'RAJA TEX', HASTE: 'X', TRANSPORT: 'GATI',
    _lines: [{ ITEM_NAME: 'BLOUSE', IT_PCS: 5, IT_QTY: 50, IT_RATE: 50, IT_AMOUNT: 250, IT_DISC1: 'PACKERS' }] },
  { NCBILL_NO: '909', BILL_DATE: new Date('2026-06-16T00:00:00Z'), PARTY: 'NAVKAR TEX', HASTE: 'B', TRANSPORT: 'VRL',
    _lines: [
      { ITEM_NAME: 'BLOUSE', IT_PCS: 500, IT_QTY: 25000, IT_RATE: 50, IT_AMOUNT: 25000, IT_DISC1: 'PACKERS' },
      { ITEM_NAME: 'DOBBY', IT_PCS: 6, IT_QTY: 48, IT_RATE: 8, IT_AMOUNT: 48, IT_DISC1: '' },
    ] },
];

const run = (p) => haste.run('c1', { ...P, ...p }, { rows: ROWS });

describe('mode A — Haste (the screen\'s own default)', () => {
  it('groups by the bill\'s own haste field', async () => {
    const r = await run({ mode: 'A' });
    assert.deepEqual([...new Set(r.rows.map((x) => x.GROUP2))].sort(), ['B', 'X']);
    assert.equal(r.grid.groupDisplays[0], 'HASTE');
  });

  it('defaults to Haste when no mode is given', async () => {
    const r = await run({});
    assert.equal(r.grid.title, 'Haste wise Sales Report');
  });
});

describe('mode B — Packers, confirmed against JSM\'s own TMP_VW_PACKERS', () => {
  it('groups by the ITEM LINE\'s IT_DISC1, not a header field', async () => {
    const r = await run({ mode: 'B' });
    assert.deepEqual([...new Set(r.rows.map((x) => x.GROUP2))].sort(), ['', 'PACKERS']);
    const packers = r.rows.filter((x) => x.GROUP2 === 'PACKERS');
    assert.equal(packers.length, 2, 'one line from each bill carries PACKERS');
    const total = packers.reduce((s, x) => s + x.IT_AMOUNT, 0);
    assert.equal(total, 250 + 25000);
  });

  it('a bill with mixed lines appears under both its groups, split by line', async () => {
    const r = await run({ mode: 'B' });
    const billLines = r.rows.filter((x) => x.NCBILL_NO === '909');
    assert.equal(billLines.length, 2);
    assert.deepEqual(billLines.map((x) => x.GROUP2).sort(), ['', 'PACKERS']);
  });
});

describe('mode C — Transport', () => {
  it('groups by the bill\'s own transport field', async () => {
    const r = await run({ mode: 'C' });
    assert.deepEqual([...new Set(r.rows.map((x) => x.GROUP2))].sort(), ['GATI', 'VRL']);
  });
});

describe('mode D — Lr Dispatch has no backing field', () => {
  it('is refused rather than grouping under the wrong thing', async () => {
    await assert.rejects(() => run({ mode: 'D' }), /Lr Dispatch/);
  });
});

describe('figures reconcile', () => {
  it('sum across every group in any mode equals the sum of every bill line', async () => {
    const expected = ROWS.flatMap((b) => b._lines).reduce((s, l) => s + l.IT_AMOUNT, 0);
    for (const mode of ['A', 'B', 'C']) {
      const r = await run({ mode });
      const total = r.rows.reduce((s, x) => s + x.IT_AMOUNT, 0);
      assert.equal(total, expected, `mode ${mode}`);
    }
  });
});
