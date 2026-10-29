/**
 * Splits old-bill Excel rows into batches for the import API without ever splitting one bill
 * (Bill No + Party + Date) across two batches — the server skips a bill it already has, so a
 * split bill would lose its later lines.
 */
const BILL_KEY_FIELDS = ['billNo', 'party', 'date'];

export function billKeyOf(row, mappings) {
  const v = {};
  for (const [col, field] of Object.entries(mappings || {})) {
    if (BILL_KEY_FIELDS.includes(field)) v[field] = String(row[col] ?? '').trim().toUpperCase();
  }
  return `${v.billNo || ''}|${v.party || ''}|${v.date || ''}`;
}

export function chunkBillRows(rows, mappings, maxRows = 200) {
  const groups = new Map();
  (rows || []).forEach((row, i) => {
    const k = billKeyOf(row, mappings);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push({ ...row, __row: i + 2 }); // Excel row (header is row 1)
  });
  const chunks = [];
  let cur = [];
  for (const g of groups.values()) {
    if (cur.length && cur.length + g.length > maxRows) {
      chunks.push(cur);
      cur = [];
    }
    cur = cur.concat(g);
  }
  if (cur.length) chunks.push(cur);
  return chunks;
}

/** Adds up the per-batch preview answers into one preview for the screen. */
export function mergeBillPreviews(parts) {
  const out = {
    totalRows: 0, bills: 0, alreadyImported: 0, toImport: 0, validRows: 0, duplicateRows: 0,
    invalidRows: 0, errors: [], newParties: [], newItems: [], sampleBills: [],
  };
  const np = new Set();
  const ni = new Set();
  for (const p of parts) {
    for (const k of ['totalRows', 'bills', 'alreadyImported', 'toImport', 'validRows', 'duplicateRows', 'invalidRows']) {
      out[k] += Number(p[k] || 0);
    }
    out.errors.push(...(p.errors || []));
    (p.newParties || []).forEach((x) => np.add(x));
    (p.newItems || []).forEach((x) => ni.add(x));
    if (out.sampleBills.length < 5) out.sampleBills.push(...(p.sampleBills || []).slice(0, 5 - out.sampleBills.length));
    out.mappings = out.mappings || p.mappings;
    out.entity = out.entity || p.entity;
  }
  out.newParties = [...np];
  out.newItems = [...ni];
  out.errors = out.errors.slice(0, 50);
  return out;
}

export function mergeBillResults(parts) {
  const out = { created: 0, skipped: 0, failed: 0, createdParties: 0, createdItems: 0, bills: 0, errors: [] };
  for (const p of parts) {
    for (const k of ['created', 'skipped', 'failed', 'createdParties', 'createdItems', 'bills']) out[k] += Number(p[k] || 0);
    out.errors.push(...(p.errors || []));
  }
  return out;
}

/** Plain batches of rows (masters need no grouping). */
export function chunkRows(rows, size = 150) {
  const out = [];
  for (let i = 0; i < (rows || []).length; i += size) out.push(rows.slice(i, i + size));
  return out;
}

/**
 * A "." in a column heading is a key separator for MongoDB and the server drops such keys, so
 * "Mobile No." used to vanish from every row. U+2024 looks like a dot and the column matcher ignores it.
 */
export function safeHeaderKey(header) {
  return String(header ?? '').replace(/\./g, '․').replace(/^\$/, '＄');
}

/** Row numbers inside a batch -> row numbers of the whole sheet (header row is row 1 in Excel). */
function shiftRows(list, offset) {
  return (list || []).map((e) => (e.row ? { ...e, row: e.row + offset } : e));
}

/** Adds up the answers of master-import preview batches. */
export function mergeMasterPreviews(parts, sizes) {
  const warnGroups = new Map();
  const out = { totalRows: 0, validRows: 0, duplicateRows: 0, invalidRows: 0, sampleRows: [], errors: [], warnings: [] };
  let offset = 1; // +1: the heading row is Excel row 1
  parts.forEach((p, i) => {
    out.entity = out.entity || p.entity;
    ['totalRows', 'validRows', 'duplicateRows', 'invalidRows'].forEach((k) => { out[k] += Number(p[k] || 0); });
    if (out.sampleRows.length < 10) out.sampleRows.push(...(p.sampleRows || []).slice(0, 10 - out.sampleRows.length));
    out.errors.push(...shiftRows(p.errors, offset));
    for (const w of p.warnings || []) {
      const g = warnGroups.get(w.message) || { message: w.message, count: 0, rows: [] };
      g.count += Number(w.count || 1);
      for (const r of w.rows || []) if (g.rows.length < 5) g.rows.push(r + offset);
      warnGroups.set(w.message, g);
    }
    offset += sizes[i];
  });
  out.errors = out.errors.slice(0, 50);
  out.warnings = [...warnGroups.values()];
  return out;
}

/** Adds up the answers of master-import execute batches. */
export function mergeMasterResults(parts, sizes) {
  const out = { total: 0, created: 0, skipped: 0, failed: 0, errors: [] };
  let offset = 1; // +1: the heading row is Excel row 1
  parts.forEach((p, i) => {
    out.entity = out.entity || p.entity;
    ['total', 'created', 'skipped', 'failed'].forEach((k) => { out[k] += Number(p[k] || 0); });
    out.errors.push(...shiftRows(p.errors, offset));
    offset += sizes[i];
  });
  return out;
}
