'use strict';

/** Golden: JSM detail-register reports vs JSM's own SQL output (fixtures from extractJsmDetailReports.js). */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const REPORTS = {
  jobSend: require('../../services/jsmReports/reports/jobSend'),
  processReceiptDetail: require('../../services/jsmReports/reports/processReceiptDetail'),
};
const dir = path.join(__dirname, 'fixtures');
const r2 = (v) => (/^-?\d+(\.\d+)?$/.test(String(v)) ? Number(Number(v).toFixed(2)) : String(v));
const day = (d) => (d instanceof Date ? d.toISOString().slice(0, 10) : d);

for (const file of fs.readdirSync(dir).filter((f) => REPORTS[(f.match(/^jsm_[a-z0-9]+_(\w+)\.json$/) || [])[1]])) {
  const fx = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
  const report = REPORTS[fx.report];
  const rows = fx.rows.map((r, i) => ({
    ...r,
    [fx.dateField]: new Date(`${r[fx.dateField]}T00:00:00Z`),
    CHLN_NO: Number(r.CHLN_NO || 0),
    IT_RATE: r.IT_RATE === undefined ? undefined : Number(r.IT_RATE),
    SRAL_NO: r.SRAL_NO,
    CO_ENT_NO: String(i),
  }));
  describe(`JSM golden: ${fx.report} (${file})`, () => {
    for (const s of fx.scenarios) {
      it(s.name, async () => {
        if (s.expectedError) {
          await assert.rejects(report.run('jsm', s.params, { rows }));
          return;
        }
        const { rows: got } = await report.run('jsm', s.params, { rows });
        assert.deepEqual(
          got.map((r) => fx.key.map((k) => r2(day(r[k])))),
          s.expected.map((r) => fx.key.map((k) => r2(r[k]))),
        );
      });
    }
  });
}
