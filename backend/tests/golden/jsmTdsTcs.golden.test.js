'use strict';

/**
 * TDS / TCS registers against JSM's live SC27 views: the engine is fed the rows of JSM_VW_TDS_BOOK /
 * JSM_VW_TCS_BOOK(_PURCHASE) and its summary must equal the result of JSM's own GROUP BY over the same rows.
 * (SC27 holds 3 TDS entries and no TCS amounts, so the TCS check is that JSM's "TCS_AMT<>0 OR T_TDS_AMT<>0"
 * filter empties the register exactly as it does in JSM.)
 * Regenerate: node scripts/golden-master/extractJsmTdsTcs.js
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const reports = require('../../services/jsmReports');

const fx = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'jsm_sc27_tds_tcs.json'), 'utf8'));
const CID = '507f1f77bcf86cd799439011';
const num = (v) => Number(v);
const compNon = (pan) => (String(pan || '').charAt(3).toUpperCase() === 'C' ? 'COMP' : 'NON-COMP');

const tdsRows = fx.tds.rows.map((r) => ({
  ...r, YEAR_NO: num(r.YEAR_NO), MONTH_NO: num(r.MONTH_NO), ENT_DATE: new Date(r.ENT_DATE), AMOUNT: num(r.AMOUNT),
  TDS_PER: num(r.TDS_PER), TDS_AMT: num(r.TDS_AMT), ENT_NO: num(r.ENT_NO), SRAL_NO: num(r.SRAL_NO), COMP_NON: compNon(r.PANNO),
  TDS_P_COMP_NON: `${num(r.TDS_PER).toFixed(2)} / ${compNon(r.PANNO)}`, COMPANY: 'SC27',
}));
const key = (r) => [r.MONTH, r.TDSHEAD, r.PARTY, Number(r.TDS_PER).toFixed(2)].join('|');

test('TDS summary Month+TdsHead+Party equals JSM GROUP BY over JSM_VW_TDS_BOOK', async () => {
  const out = await reports.get('Rpt_TdsReports').run(CID, { from: '2026-04-01', to: '2027-03-31', group: 'Month+TdsHead+Party', summary: true }, { rows: tdsRows });
  const ours = out.rows.map((r) => [key(r), r.AMOUNT, r.TDS_AMT]).sort((a, b) => a[0].localeCompare(b[0]));
  const theirs = fx.tds.summary.map((r) => [key(r), num(r.AMOUNT), num(r.TDS_AMT)]).sort((a, b) => a[0].localeCompare(b[0]));
  assert.deepEqual(ours, theirs);
});

test('TDS detail lists every JSM entry, July before August', async () => {
  const out = await reports.get('Rpt_TdsReports').run(CID, { from: '2026-04-01', to: '2027-03-31', group: 'Month+TdsHead+Party' }, { rows: tdsRows });
  assert.equal(out.rows.length, fx.tds.rows.length);
  assert.deepEqual(out.rows.map((r) => r.MONTH), ['July', 'August', 'August']);
});

for (const [name, form, data] of [['sales', 'Rpt_TcsSalesRegister', fx.tcsSales], ['purchase', 'Rpt_TcsPurchaseRegister', fx.tcsPurchase]]) {
  test(`TCS ${name} register: JSM's TCS_AMT<>0 filter gives the same (empty) summary as JSM`, async () => {
    const rows = data.rows.map((r) => ({
      ...r, YEAR_NO: num(r.YEAR_NO), MONTH_NO: num(r.MONTH_NO), TCS_PER: num(r.TCS_PER), TCS_AMT: num(r.TCS_AMT), TAXABLE_AMT: num(r.TAXABLE_AMT),
      NET_TOT: num(r.NET_TOT), BILL_DATE: new Date(r.BILL_DATE), ENT_NO: num(r.ENT_NO), T_TDS_PER: num(r.T_TDS_PER), T_TDS_AMT: num(r.T_TDS_AMT), TCSHEAD: 'TCS', COMPANY: 'SC27',
    })).filter((r) => r.TCS_AMT !== 0 || r.T_TDS_AMT !== 0);
    const out = await reports.get(form).run(CID, { from: '2026-04-01', to: '2027-03-31', summary: true }, { rows });
    assert.equal(out.rows.length, data.summary.length);
  });
}
