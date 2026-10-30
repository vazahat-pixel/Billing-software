/**
 * Process Stock (JSM Rpt_Process_Stock_New_Gst): filters and grouping on rows shaped like JSM_VW_PROCESS_STOCK_DTL.
 * (Figures against JSM itself are checked with the local JSM database; see the import's golden script.)
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const processStock = require('../../services/jsmReports/reports/processStock');

const row = (o) => ({
  CO_ENT_NO: o.id, ENT_NO: o.id, NCCHLN_NO: o.ch, CHLN_NO: Number(o.ch), CHLN_DATE: new Date(o.date), MILL_NAME: o.mill, ITEM_NAME: o.item || 'GREY',
  PURCHASE_PARTY: '', MASTER_NAME: '', MAINGROUP: '', BROKER: '', REGISTER: 'MILL ISSUE', TRANSPORT: '', RE_FINISH: o.rf || 'F',
  ISS_QTY: o.iss, TOT_GRY_REC_QTY: o.rec, TOT_BAL_QTY: o.iss - o.rec, PENDING: o.iss - o.rec > 0.005 ? 'PENDING' : 'CLEAR', BILL_DATE: null, SRAL_NO: 0,
});
const ROWS = [
  row({ id: 'a', ch: '1', date: '2026-05-01', mill: 'B MILL', iss: 100, rec: 100 }),
  row({ id: 'b', ch: '2', date: '2026-06-01', mill: 'A MILL', iss: 50, rec: 20 }),
  row({ id: 'c', ch: '3', date: '2022-11-25', mill: 'A MILL', iss: 134, rec: 0 }), // carried in from an earlier year
  row({ id: 'd', ch: '4', date: '2026-07-01', mill: 'B MILL', iss: 10, rec: 0, rf: 'R' }),
];
const run = (p) => processStock.run('co', { from: '2026-04-01', to: '2027-03-31', ...p }, { rows: ROWS });

describe('JSM Process Stock report', () => {
  it('Pending lists challans with a balance; Clear the fully received ones; All both', async () => {
    assert.deepEqual((await run({ status: '1-Pending' })).rows.map((r) => r.NCCHLN_NO).sort(), ['2', '4']);
    assert.deepEqual((await run({ status: '2-Clear' })).rows.map((r) => r.NCCHLN_NO), ['1']);
    assert.equal((await run({ status: '3-All' })).rows.length, 3);
  });

  it('"Including Last Year" adds the challans issued before the period', async () => {
    const r = await run({ status: '1-Pending', includeLastYear: true });
    assert.ok(r.rows.some((x) => x.NCCHLN_NO === '3'));
  });

  it('Mill wise: grouped by mill (JSM layout variant 2), challans in date order', async () => {
    const r = await run({ status: '3-All', orderBy1: 'Mill' });
    assert.equal(r.grid.layout, 'JSM_VW_PROCESS_STOCK_DTL');
    assert.equal(r.grid.variant, 2);
    assert.deepEqual(r.grid.groupColumns, ['XMILL']);
    assert.deepEqual(r.rows.map((x) => `${x.XMILL}:${x.NCCHLN_NO}`), ['A MILL:2', 'B MILL:1', 'B MILL:4']);
  });

  it('Process type Re-Finish keeps only re-finish challans', async () => {
    assert.deepEqual((await run({ status: '3-All', processType: '3-Re-Finish' })).rows.map((r) => r.NCCHLN_NO), ['4']);
  });

  it('the same column twice in GroupBy is refused as JSM does', async () => {
    await assert.rejects(run({ orderBy1: 'Mill', orderBy2: 'Mill' }), /more than once/);
  });
});
