'use strict';

// Tests use a made-up package built here. A real export (company names, GSTIN, bills) must never be
// committed; point JSM_DEMO_PACKAGE at a local export to also check real volumes (skipped when unset).

const { describe, it, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');
const { scanPackage, loadPackage, PackageError } = require('../../services/migration/packageReader');

const tmp = [];
const tmpFile = (name) => { const p = path.join(os.tmpdir(), `pkg_${process.pid}_${Date.now()}_${name}`); tmp.push(p); return p; };
const gzipLines = (lines) => zlib.gzipSync(`${lines.map((l) => JSON.stringify(l)).join('\n')}\n`);

/** A complete, valid package with invented rows. */
function goodPackageLines() {
  const rows = [
    { _: 'row', t: 'T_SALES', k: 'ZZ27:T_SALES', r: { CO_PATH: 'ZZ27', ENT_NO: '1', NCBILL_NO: '1', NET_TOT: '295.00' } },
    { _: 'row', t: 'T_SALES', k: 'ZZ27:T_SALES', r: { CO_PATH: 'ZZ27', ENT_NO: '2', NCBILL_NO: '2', NET_TOT: '105.00' } },
    { _: 'row', t: 'MST_AC_MAST', k: 'ZZ27:MST_AC_MAST', r: { CO_PATH: 'ZZ27', AC_CODE: '105', AC_NAME: 'TEST PARTY' } },
  ];
  return [
    { _: 'header', format: 'mern-migration-package', version: 1, source: 'JSM', companies: [{ coPath: 'ZZ27' }] },
    ...rows,
    { _: 'trailer', tables: { T_SALES: 2, MST_AC_MAST: 1 }, totalRows: 3 },
  ];
}

describe('migration package reader', () => {
  after(() => tmp.forEach((p) => { try { fs.unlinkSync(p); } catch { /* gone */ } }));

  it('reads a complete package and every table count matches the trailer', async () => {
    const f = tmpFile('good.gz');
    fs.writeFileSync(f, gzipLines(goodPackageLines()));
    const pkg = await loadPackage(f);
    assert.equal(pkg.header.format, 'mern-migration-package');
    assert.equal(pkg.header.source, 'JSM');
    assert.equal(pkg.tables.T_SALES.length, 2);
    assert.equal(pkg.tables.T_SALES[0].NET_TOT, '295.00');
    assert.equal(pkg.tables.MST_AC_MAST[0].AC_NAME, 'TEST PARTY');
    assert.equal(pkg.trailer.totalRows, 3);
  });

  it('a package cut off before its trailer is refused', async () => {
    const f = tmpFile('cut.gz');
    fs.writeFileSync(f, gzipLines(goodPackageLines().slice(0, 3)));
    const res = await scanPackage(f);
    assert.ok(res.problems.some((p) => /trailer is missing/.test(p)), res.problems.join(' | '));
    await assert.rejects(() => loadPackage(f), PackageError);
  });

  it('a half-uploaded (truncated gzip) file is refused', async () => {
    const whole = gzipLines(goodPackageLines());
    const f = tmpFile('trunc.gz');
    fs.writeFileSync(f, whole.subarray(0, Math.floor(whole.length / 2)));
    const res = await scanPackage(f);
    assert.ok(res.problems.length > 0);
  });

  it('missing rows, wrong totals and foreign files are reported', async () => {
    const lines = [
      { _: 'header', format: 'mern-migration-package', version: 1 },
      { _: 'row', t: 'A', k: 'x', r: {} },
      { _: 'trailer', tables: { A: 2, B: 1 }, totalRows: 3 },
    ];
    const f = tmpFile('short.gz');
    fs.writeFileSync(f, gzipLines(lines));
    const res = await scanPackage(f);
    assert.ok(res.problems.some((p) => /table A: 1 rows read, 2 exported/.test(p)));
    assert.ok(res.problems.some((p) => /table B: 0 rows read, 1 exported/.test(p)));
    assert.ok(res.problems.some((p) => /1 rows read, 3 exported/.test(p)));

    const other = tmpFile('other.gz');
    fs.writeFileSync(other, gzipLines([{ _: 'header', format: 'something-else', version: 9 }, { _: 'trailer', tables: {}, totalRows: 0 }]));
    const r2 = await scanPackage(other);
    assert.ok(r2.problems.some((p) => /not a mern-migration-package/.test(p)));
    assert.ok(r2.problems.some((p) => /version 9 is not supported/.test(p)));
  });

  it('local real export (JSM_DEMO_PACKAGE): complete, with the volumes checked by hand against JSM', { skip: !process.env.JSM_DEMO_PACKAGE }, async () => {
    const pkg = await loadPackage(process.env.JSM_DEMO_PACKAGE);
    assert.equal(pkg.header.companies.length, 3);
    assert.equal(pkg.tables.T_SALES.length, 26);
    assert.equal(pkg.tables.T_PURCHASE.length, 32);
    assert.equal(pkg.tables.T_SL_DT.length, 60);
    assert.equal(pkg.tables.T_TRANDATA.length, 409);
    assert.equal(pkg.tables.I_MILL_CH.length, 26);
    assert.equal(pkg.tables.T_CASH_MN.length, 27);
  });
});
