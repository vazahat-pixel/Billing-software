/**
 * Read-only golden data for JSM detail-register reports: the view's rows for one company plus the output
 * of JSM's own ORDER BY / filters for a few settings. One fixture per report in tests/golden/fixtures.
 *   node scripts/golden-master/extractJsmDetailReports.js --server .\JSMR2 --db JsmSql2_DEMO2026 --co SC27
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > -1 ? process.argv[i + 1] : d; };
const SERVER = arg('server', '.\\JSMR2');
const DB = arg('db', 'JsmSql2_DEMO2026');
const CO = arg('co', 'SC27');
const SEP = '\u0001';
if (!/^[A-Za-z0-9_]+$/.test(CO)) throw new Error('--co must be alphanumeric');

const REPORTS = {
  processReceiptDetail: {
    view: 'JSM_VW_PROCESS_RECEIPT_DETAIL',
    date: 'BILL_DATE',
    cols: ['BOOK', 'MILL', 'GREYITEM', 'FINISHITEM', 'IT_RATE', 'IT_DESC1', 'SRAL_NO', 'NCBILL_NO', 'BILL_DATE', 'REC_QTY'],
    key: ['NCBILL_NO', 'BILL_DATE', 'MILL', 'GREYITEM', 'REC_QTY'],
    fix: 'BOOK AS XREGISTER, MILL AS XMILL, GREYITEM AS XGREYITEM, FINISHITEM AS XFINISHITEM, IT_RATE AS XRATE, IT_DESC1 AS XIT_DESC1',
    filters: { mills: 'MILL', greyItems: 'GREYITEM', finishItems: 'FINISHITEM' },
    x: { Register: 'XREGISTER', Mill: 'XMILL', GreyItem: 'XGREYITEM', FinishItem: 'XFINISHITEM', Rate: 'XRATE' },
    tieBreak: 'BILL_DATE,SRAL_NO,NCBILL_NO',
    scenarios: [
      { name: 'register', params: { orderBy1: 'Register' } },
      { name: 'mill + greyitem', params: { orderBy1: 'Mill', orderBy2: 'GreyItem' } },
      { name: 'rate', params: { orderBy1: 'Rate' } },
    ],
  },
  jobSend: {
    view: 'JSM_VW_JOBWORK_ISSUE',
    date: 'CHLN_DATE',
    cols: ['BOOK', 'PARTY', 'BROKER', 'ITEM', 'NCCHLN_NO', 'CHLN_NO', 'CHLN_DATE', 'ISS_PCS', 'ISS_QTY'],
    key: ['NCCHLN_NO', 'CHLN_DATE', 'PARTY', 'ITEM', 'ISS_QTY'],
    fix: 'BOOK AS XREGISTER, PARTY AS XPARTY, BROKER AS XBROKER, ITEM AS XITEM, BOOK AS XBOOK',
    filters: { parties: 'PARTY', brokers: 'BROKER', items: 'ITEM', books: 'BOOK' },
    x: { Register: 'XREGISTER', Party: 'XPARTY', Broker: 'XBROKER', Item: 'XITEM', Book: 'XBOOK' },
    tieBreak: 'CHLN_DATE,CHLN_NO,NCCHLN_NO',
    scenarios: [
      { name: 'register', params: { orderBy1: 'Register' } },
      { name: 'party + item', params: { orderBy1: 'Party', orderBy2: 'Item' } },
      { name: 'item, one party', params: { orderBy1: 'Item', parties: ['__FIRST_PARTY__'] } },
    ],
  },
};

function query(sql, cols) {
  const out = execFileSync('sqlcmd', ['-S', SERVER, '-E', '-d', DB, '-h', '-1', '-W', '-s', SEP, '-Q', `SET NOCOUNT ON; ${sql}`],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (/^Msg \d+/m.test(out)) throw new Error(out.split(/\r?\n/).filter(Boolean).pop());
  return out.split(/\r?\n/).filter((l) => l.includes(SEP)).map((line) => {
    const c = line.split(SEP);
    return Object.fromEntries(cols.map((k, i) => [k, (c[i] ?? '').trim()]));
  });
}
const sel = (c, date) => (c === date ? `CONVERT(varchar(10), ${c}, 120)` : `ISNULL(CONVERT(varchar(100), ${c}), '')`);
const q = (s) => `'${String(s).replace(/'/g, "''")}'`;

for (const [name, r] of Object.entries(REPORTS)) {
  const rows = query(`SELECT ${r.cols.map((c) => sel(c, r.date)).join(', ')} FROM ${r.view} WHERE CO_PATH='${CO}'`, r.cols);
  const firstParty = rows[0]?.PARTY;
  for (const row of rows) if ('SRAL_NO' in row) row.SRAL_NO = row.SRAL_NO;
  const scenarios = r.scenarios.map((s) => {
    const p = { from: '2026-04-01', to: '2027-03-31', orderBy2: 'None', ...s.params };
    for (const k of Object.keys(p)) if (Array.isArray(p[k])) p[k] = p[k].map((v) => (v === '__FIRST_PARTY__' ? firstParty : v));
    const where = [`A.CO_PATH IN ('${CO}')`, `(A.${r.date} >='${p.from}' AND A.${r.date} <='${p.to}')`,
      ...Object.entries(r.filters).map(([param, f]) => (p[param]?.length ? `A.${f} IN (${p[param].map(q).join(',')})` : `A.${f} NOT IN ('X9999')`))];
    const order = [r.x[p.orderBy1], p.orderBy2 !== 'None' ? r.x[p.orderBy2] : null, r.tieBreak].filter(Boolean).join(',');
    try {
      const expected = query(`SELECT ${r.key.map((c) => sel(c, r.date)).join(', ')}, ${r.fix} FROM ${r.view} A WHERE ${where.join(' AND ')} ORDER BY ${order}`, r.key);
      return { name: s.name, params: p, expected };
    } catch (e) {
      return { name: s.name, params: p, expectedError: e.message };
    }
  });
  const out = path.join(__dirname, '../../tests/golden/fixtures', `jsm_${CO.toLowerCase()}_${name}.json`);
  fs.writeFileSync(out, `${JSON.stringify({ report: name, key: r.key, dateField: r.date, rows, scenarios }, null, 1)}\n`);
  console.log(`wrote ${out}: ${rows.length} rows, ${scenarios.length} scenarios`);
}
