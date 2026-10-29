'use strict';
/**
 * Makes a shareable copy of a migration package: company, party and item names, GSTIN, PAN, phones, e-mail,
 * addresses and free text are replaced, amounts / dates / codes / structure stay. Used for the committed test fixture.
 * Usage: node scripts/anonymizeJsmPackage.js <in.ndjson.gz> <out.ndjson.gz>
 */
const fs = require('fs');
const zlib = require('zlib');
const readline = require('readline');

const BLANK = /^(ADD_\d|ADDRESS|FADD_\d|PHONE_[OR]|MOBILE|FMOBILE|FPHONE|EMAIL|WEBSITE|NW_GST_NO|GST_NO|CST_NO|PAN_NO|ADHAR_NO|MSME_NO|CONTACT_PERSON|REMARK_\d|AC_ALIAS|AC_NO_\d|AC_BANK_\d|EWAY_PASS|CHQ_NO|SLIP_NO|LR_NO|MARKA_NO|MASTER_NAME|TRANSPORT|EWAY_NO|IRN|CO_GST_NO|CO_GSTIN|CO_ADD\w*|CO_PHONE\w*|CO_EMAIL|CO_PAN\w*|HASTE|IT_DISC\d|EMB_REM\d|EWAY_PROD_\w+|IT_REMARK_\d|MST_DESC|FDIST|FSTATE|DOB_DATE)$/i;

(async () => {
  const [inFile, outFile] = process.argv.slice(2);
  const rl = readline.createInterface({ input: fs.createReadStream(inFile).pipe(zlib.createGunzip()) });
  const out = [];
  const seq = {};
  const n = (k) => { seq[k] = (seq[k] || 0) + 1; return seq[k]; };
  const acct = new Map(); const items = new Map(); const cos = new Map();
  const nameOf = (map, key, make) => { if (!map.has(key)) map.set(key, make(map.size + 1)); return map.get(key); };
  for await (const line of rl) {
    const o = JSON.parse(line);
    if (o._ === 'header') { o.companies = (o.companies || []).map((c, i) => ({ ...c, name: `TEST COMPANY ${i + 1}`, gstin: '' })); o.db = 'JsmSql2_TEST'; out.push(o); continue; }
    if (o._ !== 'row') { out.push(o); continue; }
    const r = o.r;
    for (const k of Object.keys(r)) if (BLANK.test(k)) r[k] = '';
    if (o.t === 'MST_AC_MAST') {
      const code = r.AC_CODE;
      r.AC_NAME = nameOf(acct, `${code}|${r.AC_NAME}`, (i) => /CASH/i.test(r.AC_NAME) ? `CASH ACCOUNT ${code}` : /BANK/i.test(r.AC_NAME) ? `BANK ACCOUNT ${code}` : /SGST|CGST|IGST/i.test(r.AC_NAME) ? r.AC_NAME : `ACCOUNT ${code}`);
      r.STATE = ''; r.DIST = '';
    } else if (o.t === 'MST_IT_MAST') {
      r.ITEM_NAME = nameOf(items, `${r.ITEM_CODE}`, () => `ITEM ${r.ITEM_CODE}`); r.CHR_CODE = '';
    } else if (o.t === 'J_COMPANY') {
      const keep = new Set(['CO_PATH', 'CO_CODE', 'CO_NAME', 'CO_FR_DATE', 'CO_TO_DATE', 'CO_STATE_CODE', 'LAST_YR_CO_CODE', 'NEXT_YR_CO_CODE', 'CO_YR_CLOSE_YN']);
      for (const k of Object.keys(r)) if (!keep.has(k)) r[k] = '';
      r.CO_NAME = nameOf(cos, r.CO_PATH, (i) => `TEST COMPANY ${i}`);
    }
    out.push(o);
  }
  const gz = zlib.gzipSync(`${out.map((x) => JSON.stringify(x)).join('\n')}\n`);
  fs.writeFileSync(outFile, gz);
  console.log('written', outFile, gz.length, 'bytes', out.length, 'lines');
})();
