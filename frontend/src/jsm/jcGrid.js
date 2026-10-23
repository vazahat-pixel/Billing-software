/**
 * JSM's report grid (AA_Rpt_GridReport_JC.XDataFill_On_DridView) as a pure function.
 * Builds the visible columns from an STP_REPORT layout variant and turns query rows into grid lines:
 * group headers, group totals, detail rows and GRAND TOTAL, with JSM's colors and number/date formats.
 */

export const MAX_COLUMNS = 16;
const AVERAGED = new Set(['RATE', 'SHTG']);

/** Columns of `layoutName` shown in `variant`, in JSM order (max 16). */
export function layoutColumns(layouts, layoutName, variant, opts = {}) {
  const cols = variantColumns(layouts, layoutName, variant, opts);
  // An unconfigured variant shows no columns in JSM until "Z-Set Column" is used; show variant 1's instead.
  if (!cols.length && variant !== 1) return variantColumns(layouts, layoutName, 1, opts);
  return cols;
}

function variantColumns(layouts, layoutName, variant, { captions = {}, fallback } = {}) {
  const modes = layouts?.[layoutName];
  let cols = [];
  if (modes) {
    for (const [mode, fields] of Object.entries(modes)) {
      for (const f of fields) {
        const v = f.variants?.[variant];
        if (!v) continue;
        cols.push({
          field: f.field,
          caption: captions[f.field] ?? f.caption ?? f.field,
          kind: f.kind || 'C',
          total: Boolean(f.total),
          dec: v.dec ?? f.dec ?? 0,
          len: v.len ?? f.len ?? 0,
          order: v.order ?? 99,
          mode,
        });
      }
    }
    cols.sort((a, b) => a.order - b.order);
  }
  if (!cols.length && fallback) {
    cols = fallback.map((f, i) => ({
      total: false, dec: 0, len: 10, mode: 'S', ...f, caption: captions[f.field] ?? f.caption, order: i,
    }));
  }
  return cols.slice(0, MAX_COLUMNS);
}

/** VB Strings.Format(x, "#0.00") — no grouping separators. */
export function formatNumber(value, dec) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '';
  return n.toFixed(Math.max(0, dec || 0));
}

export function formatDate(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${dd}-${mm}-${d.getUTCFullYear()}`;
}

function cellText(col, value) {
  if (value === null || value === undefined) return '';
  if (col.kind === 'N') return formatNumber(value, col.dec);
  if (col.kind === 'D') return formatDate(value);
  return String(value);
}

/**
 * @returns {Array<{type:'header'|'total'|'detail'|'grand', level?:number, cells:string[], style?:object}>}
 */
export function buildGridLines(rows, columns, grid) {
  const groups = (grid.groupColumns || []).slice(0, 3);
  const displays = grid.groupDisplays || [];
  const primary = grid.primaryDetailColumn || 'XNOTHING';
  const n = columns.length;
  const lines = [];
  const blank = () => new Array(n).fill('');
  const acc = [new Array(n).fill(0), new Array(n).fill(0), new Array(n).fill(0), new Array(n).fill(0)];
  const counts = [0, 0];
  const totalLine = (label, arr, rowsCount, style, level, type = 'total') => {
    const cells = blank();
    cells[0] = label;
    columns.forEach((c, i) => {
      if (c.kind !== 'N' || !c.total || (i === 0)) return;
      const v = AVERAGED.has(String(c.field).toUpperCase()) && rowsCount ? arr[i] / rowsCount : arr[i];
      cells[i] = formatNumber(v, c.dec);
    });
    lines.push({ type, level, cells, style });
  };

  let prev = ['\u0000', '\u0000', '\u0000'];
  let open2 = true;
  let open3 = true;
  let prevPrimary = null;

  rows.forEach((row, j) => {
    const val = (k) => String(row[groups[k]] ?? '').trim();
    let first = 1;
    if (primary === 'XNOTHING') first = 1;
    else {
      const p = String(row[primary] ?? '');
      first = prevPrimary !== p ? 1 : 2;
      prevPrimary = p;
    }

    if (j !== 0) {
      const t1 = val(0);
      if (groups[1]) {
        const t2 = val(1);
        if (t1 !== prev[0] || t2 !== prev[1]) { open2 = true; open3 = true; }
      }
      if (groups[2]) {
        const t3 = val(2);
        if (val(1) !== prev[1] || t3 !== prev[2]) open3 = true;
      }
      if (groups[2] && open3) {
        totalLine(`${displays[2] || ''}-TOTAL`, acc[3], 0, { background: 'azure', fontWeight: 700 }, 3);
        acc[3] = new Array(n).fill(0);
      }
      if (groups[1] && open2) {
        totalLine(`${displays[1] || ''}-TOTAL`, acc[2], 0, { background: 'white', fontWeight: 700 }, 2);
        acc[2] = new Array(n).fill(0);
      }
      if (t1 !== prev[0]) {
        totalLine(`${displays[0] || ''}-TOTAL`, acc[1], counts[0], { background: 'white', fontWeight: 700 }, 1);
        acc[1] = new Array(n).fill(0);
        counts[0] = 0;
      }
    }

    if (groups[0] !== undefined) {
      const t1 = val(0);
      if (t1 !== prev[0]) {
        prev[0] = t1;
        const cells = blank();
        cells[0] = `${displays[0] || ''} - ${t1}`;
        lines.push({ type: 'header', level: 1, cells, style: { background: 'wheat', fontWeight: 700 } });
      }
    }
    if (groups[1]) {
      const t2 = val(1);
      if (open2) {
        prev[1] = t2;
        const cells = blank();
        cells[0] = `${displays[1] || ''} - ${t2}`;
        lines.push({ type: 'header', level: 2, cells, firstCellStyle: { background: 'beige' } });
        open2 = false;
      }
    }
    if (groups[2]) {
      const t3 = val(2);
      if (open3) {
        prev[2] = t3;
        const cells = blank();
        cells[0] = `${displays[2] || ''} - ${t3}`;
        lines.push({ type: 'header', level: 3, cells, style: { background: 'aqua', fontWeight: 700 } });
        open3 = false;
      }
    }

    counts[0] += 1;
    counts[1] += 1;
    const cells = columns.map((c) => {
      if (first === 1 || c.mode === 'D') return cellText(c, row[c.field]);
      return '';
    });
    lines.push({ type: 'detail', cells, row });
    columns.forEach((c, i) => {
      if (c.kind !== 'N' || !c.total) return;
      if ((c.mode === 'S' && first === 1) || c.mode === 'D') {
        const v = Number(row[c.field] || 0);
        for (let k = 0; k < 4; k += 1) acc[k][i] += v;
      }
    });
  });

  if (rows.length) {
    if (groups[2]) totalLine(`${displays[2] || ''}-TOTAL`, acc[3], 0, { background: 'aqua', fontWeight: 700 }, 3);
    if (groups[1]) totalLine(`${displays[1] || ''}-TOTAL`, acc[2], 0, { background: 'peachpuff', fontWeight: 700 }, 2);
    totalLine(`${displays[0] || ''}-TOTAL`, acc[1], counts[0], { color: 'green' }, 1);
    totalLine('GRAND TOTAL', acc[0], counts[1], { fontWeight: 700 }, 0, 'grand');
  }
  return lines;
}
