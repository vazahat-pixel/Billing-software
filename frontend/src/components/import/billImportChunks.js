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
