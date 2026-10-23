/**
 * Read-only: exports JSM's report grid layouts (JsmSet_*.dbo.STP_REPORT) to JSON.
 *   node extractLayouts.js --server .\JSMR2 --db JsmSet_Demo2026 --out <file>
 */
const { execFileSync } = require('child_process');
const fs = require('fs');

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > -1 ? process.argv[i + 1] : d; };
const SERVER = arg('server', '.\\JSMR2');
const DB = arg('db', 'JsmSet_Demo2026');
const OUT = arg('out', 'jsm_layouts.json');
const SEP = '\u0001';
const V = 16;

const cols = ['RPT_NAME', 'RPT_SMR_DTL', 'SRNO', 'N_C_D', 'FLD_NAME', 'DSP_NAME', 'R_TOT_YN', 'R_LEN', 'R_DEC', 'R_SPACE', 'YESNO', 'FLD_ORDER', 'RESET_NO'];
for (let v = 1; v <= V; v += 1) cols.push(`R_LEN_${v}`, `R_DEC_${v}`, `R_SPACE_${v}`, `R_YESNO_${v}`, `R_ORDER_${v}`, `R_GROUP_ONE_${v}`, `R_GROUP_TWO_${v}`, `R_GROUP_THR_${v}`);
const select = cols.map((c) => `ISNULL(CONVERT(varchar(200), ${c}), '')`).join(', ');
const out = execFileSync('sqlcmd', ['-S', SERVER, '-E', '-d', DB, '-h', '-1', '-W', '-s', SEP, '-Q',
  `SET NOCOUNT ON; SELECT ${select} FROM STP_REPORT ORDER BY RPT_NAME, RPT_SMR_DTL, SRNO`], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

const num = (s) => (s === '' ? 0 : Number(s));
const layouts = {};
for (const line of out.split(/\r?\n/)) {
  if (!line.includes(SEP)) continue;
  const c = line.split(SEP);
  const r = Object.fromEntries(cols.map((k, i) => [k, (c[i] || '').trim()]));
  const rpt = (layouts[r.RPT_NAME] = layouts[r.RPT_NAME] || {});
  const mode = r.RPT_SMR_DTL || 'S';
  (rpt[mode] = rpt[mode] || []).push({
    srNo: num(r.SRNO),
    field: r.FLD_NAME,
    caption: r.DSP_NAME,
    kind: r.N_C_D,
    total: r.R_TOT_YN === '1',
    len: num(r.R_LEN),
    dec: num(r.R_DEC),
    show: r.YESNO === '1',
    order: num(r.FLD_ORDER),
    variants: Array.from({ length: V }, (_, k) => {
      const v = k + 1;
      return {
        show: r[`R_YESNO_${v}`] === '1',
        order: num(r[`R_ORDER_${v}`]),
        len: num(r[`R_LEN_${v}`]),
        dec: num(r[`R_DEC_${v}`]),
        space: num(r[`R_SPACE_${v}`]),
        groups: [r[`R_GROUP_ONE_${v}`], r[`R_GROUP_TWO_${v}`], r[`R_GROUP_THR_${v}`]],
      };
    }),
  });
}
fs.writeFileSync(OUT, `${JSON.stringify(layouts)}\n`);
console.log(`wrote ${OUT}: ${Object.keys(layouts).length} report layouts`);
