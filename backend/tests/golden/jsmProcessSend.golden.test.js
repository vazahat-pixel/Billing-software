'use strict';

/**
 * Golden test: Reports › Process Reports › Send against JSM's own SQL output on Sanchal Creation's
 * mill challans (fixture: scripts/golden-master/extractJsmProcessSend.js, read-only).
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const processSend = require('../../services/jsmReports/reports/processSend');

const fixture = require(path.join(__dirname, 'fixtures', 'jsm_sc27_process_send.json'));
const NUM = ['MONTH_NO', 'YEAR_NO', 'CHLN_NO', 'ISS_PCS', 'ISS_QTY', 'ISS_KGS', 'PU_RATE', 'PU_AMOUNT'];
const r2 = (n) => Number(Number(n || 0).toFixed(2));

const rows = fixture.rows.map((r) => {
  const out = { ...r, CHLN_DATE: new Date(`${r.CHLN_DATE}T00:00:00.000Z`) };
  for (const f of NUM) out[f] = Number(r[f] || 0);
  out.CO_ENT_NO = `${r.NCCHLN_NO}-${r.CHLN_DATE}`;
  return out;
});

const day = (d) => new Date(d).toISOString().slice(0, 10);

describe('JSM golden: Process › Send matches JSM (Sanchal Creation mill challans)', () => {
  for (const s of fixture.scenarios) {
    it(s.name, async () => {
      if (s.expectedError) {
        await assert.rejects(processSend.run('jsm', s.params, { rows }), { message: s.expectedError });
        return;
      }
      const { rows: got } = await processSend.run('jsm', s.params, { rows });
      if (s.params.summary) {
        const actual = got.map((r) => ({
          ZGROUP: r.ZGROUP, ZGROUP2: r.ZGROUP2, ISS_PCS: r2(r.ISS_PCS), ISS_QTY: r2(r.ISS_QTY), PU_AMOUNT: r2(r.PU_AMOUNT), AVG_PU_RATE: r2(r.AVG_PU_RATE),
        }));
        const expected = s.expected.map((r) => ({
          ZGROUP: r.ZGROUP, ZGROUP2: r.ZGROUP2, ISS_PCS: r2(r.ISS_PCS), ISS_QTY: r2(r.ISS_QTY), PU_AMOUNT: r2(r.PU_AMOUNT), AVG_PU_RATE: r2(r.AVG_PU_RATE),
        }));
        assert.deepEqual(actual, expected);
      } else {
        const actual = got.map((r) => [r.NCCHLN_NO, day(r.CHLN_DATE), r.MILL, r.ITEM, r.PURPARTY, r2(r.ISS_PCS), r2(r.ISS_QTY)]);
        const expected = s.expected.map((r) => [r.NCCHLN_NO, r.CHLN_DATE, r.MILL, r.ITEM, r.PURPARTY, r2(r.ISS_PCS), r2(r.ISS_QTY)]);
        assert.deepEqual(actual, expected, 'same rows in the same order as JSM');
      }
    });
  }

  it('hands the grid JSM\'s layout, variant and grouping', async () => {
    const detail = await processSend.run('jsm', { from: '2026-04-01', to: '2027-03-31', orderBy1: 'Mill', orderBy2: 'Item' }, { rows });
    assert.equal(detail.grid.layout, 'JSM_VW_PROCESS_ISSUE_REPORT');
    assert.equal(detail.grid.variant, 2);
    assert.deepEqual(detail.grid.groupColumns, ['XMILL', 'XITEM']);
    assert.deepEqual(detail.grid.groupDisplays, ['MILL', 'ITEM']);
    assert.equal(detail.grid.title, 'Mill Wise Mill Report');
    const summary = await processSend.run('jsm', { from: '2026-04-01', to: '2027-03-31', orderBy1: 'Item', summary: true }, { rows });
    assert.equal(summary.grid.layout, 'JSM_VW_PROCESS_ISSUE_SUM_REPORT');
    assert.equal(summary.grid.variant, 1);
    assert.deepEqual(summary.grid.captions, { ZGROUP2: 'Item' });
  });
});
