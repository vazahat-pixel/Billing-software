'use strict';

/**
 * Golden test: JSM's four bill registers against JSM's OWN SQL output on Sanchal Creation's real
 * books (fixture: scripts/golden-master/extractJsmBillRegisters.js, read-only).
 *
 * Every one of JSM's three modes and every Category Wise option is replayed: the same bills go in,
 * and the rows this software produces must come out in the same order, with the same figures and
 * the same grouping, as the SQL the decompiled JSM form builds for that mode.
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const regs = require('../../services/jsmReports/reports/billRegisters');

const fixture = require(path.join(__dirname, 'fixtures', 'jsm_sc27_bill_registers.json'));
const P = fixture.period;
const r2 = (n) => Number(Number(n || 0).toFixed(2));
const day = (d) => (d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10));

const REGISTERS = [
  ['sales', regs.sales],
  ['purchase', regs.purchase],
  ['salesReturn', regs.salesReturn],
  ['purchaseReturn', regs.purchaseReturn],
];

/** JSM returns every figure as text; compare on the numbers, not the formatting. */
const sumRow = (r) => [r.GROUP1 || '', r.GROUP2 || '', r2(r.TO_PCS), r2(r.TO_QTY), r2(r.SUB_TOT), r2(r.T_ADD), r2(r.T_LESS), r2(r.NET_TOT)];
const regRow = (r) => [r.NCBILL_NO || '', day(r.BILL_DATE), r.PARTY || '', r2(r.TO_PCS), r2(r.TO_QTY), r2(r.SUB_TOT), r2(r.T_ADD), r2(r.T_LESS), r2(r.NET_TOT)];
const dtlRow = (r) => [r.NCBILL_NO || '', day(r.BILL_DATE), r.PARTY || '', r.ITEM_NAME || '', r2(r.IT_PCS), r2(r.IT_QTY), r2(r.IT_AMOUNT)];

const jsmSum = (e) => [e.GROUP1 || '', e.GROUP2 || '', r2(e.TO_PCS), r2(e.TO_QTY), r2(e.SUB_TOT), r2(e.T_ADD), r2(e.T_LESS), r2(e.NET_TOT)];
const jsmReg = (e) => [e.NCBILL_NO || '', day(e.BILL_DATE), e.PARTY || '', r2(e.TO_PCS), r2(e.TO_QTY), r2(e.SUB_TOT), r2(e.T_ADD), r2(e.T_LESS), r2(e.NET_TOT)];
const jsmDtl = (e) => [e.NCBILL_NO || '', day(e.BILL_DATE), e.PARTY || '', e.ITEM_NAME || '', r2(e.IT_PCS), r2(e.IT_QTY), r2(e.IT_AMOUNT)];

for (const [key, report] of REGISTERS) {
  const data = fixture.registers[key];

  describe(`JSM golden: ${key} register matches JSM's own SQL`, () => {
    // A company with no such bills can only be checked for "stays empty"; it proves nothing about
    // the grouping, so it is reported as the hole it is rather than as a passing comparison.
    if (!data.rows.length) {
      it('NOT VERIFIED — this company has no bills of this kind', async () => {
        const { rows } = await report.run('jsm', { ...P }, { rows: [] });
        assert.deepEqual(rows, []);
      });
    }

    for (const s of data.rows.length ? data.scenarios : []) {
      it(`${s.mode}, category ${s.category}`, async () => {
        const params = {
          ...P,
          category: `${s.category}-x`,
          detail: s.mode === 'detail',
          summaryReports: s.mode === 'summary',
        };
        const { rows } = await report.run('jsm', params, { rows: data.rows });

        if (s.mode === 'summary') {
          assert.deepEqual(rows.map(sumRow), s.expected.map(jsmSum));
          return;
        }
        // Register and Detail: JSM groups the listing, so the group column must agree row for row
        // as well as the figures themselves.
        const pick = s.mode === 'detail' ? dtlRow : regRow;
        const jsm = s.mode === 'detail' ? jsmDtl : jsmReg;
        assert.deepEqual(rows.map(pick), s.expected.map(jsm));
        assert.deepEqual(rows.map((r) => String(r.XGROUP ?? '')), s.expected.map((e) => String(e.JS_GROUP ?? '')));
      });
    }
  });
}
