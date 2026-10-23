'use strict';

/**
 * Pure helpers that reproduce what JSM's report screens do in SQL Server against their views:
 * IN-list filters, ORDER BY with SQL Server's case-insensitive collation, and GROUP BY with SUM/AVG/MAX.
 * Rows use JSM's own column names so the result matches JSM's grid column-for-column.
 */

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August',
  'September', 'October', 'November', 'December'];

const round = (n, dp = 2) => Number(Number(n || 0).toFixed(dp));

function isBlank(v) {
  return v === null || v === undefined || (typeof v === 'string' && v.trim() === '');
}

/** SQL Server default collation (Latin1_General_CI_AS): case-insensitive, NULL first, trailing spaces ignored. */
function sqlCompare(a, b) {
  const an = a === null || a === undefined;
  const bn = b === null || b === undefined;
  if (an || bn) return an && bn ? 0 : (an ? -1 : 1);
  if (a instanceof Date || b instanceof Date) return new Date(a).getTime() - new Date(b).getTime();
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  const sa = String(a).replace(/\s+$/, '');
  const sb = String(b).replace(/\s+$/, '');
  const ua = sa.toUpperCase();
  const ub = sb.toUpperCase();
  if (ua < ub) return -1;
  if (ua > ub) return 1;
  return 0;
}

/** ORDER BY a, b DESC … — keys: ['A', { field: 'B', dir: 'desc' }]. Stable like SQL for equal keys. */
function orderRows(rows, keys) {
  const spec = keys.filter(Boolean).map((k) => (typeof k === 'string' ? { field: k, dir: 'asc' } : k));
  return rows
    .map((row, i) => ({ row, i }))
    .sort((x, y) => {
      for (const { field, dir } of spec) {
        const c = sqlCompare(x.row[field], y.row[field]);
        if (c !== 0) return dir === 'desc' ? -c : c;
      }
      return x.i - y.i;
    })
    .map((x) => x.row);
}

/** `A.FIELD IN (…)` when the user ticked names on a tab; no tick means every row (JSM: NOT IN ('X9999')). */
function inList(rows, field, values) {
  if (!Array.isArray(values) || values.length === 0) return rows;
  const set = new Set(values.map((v) => String(v ?? '').trim().toUpperCase()));
  return rows.filter((r) => set.has(String(r[field] ?? '').trim().toUpperCase()));
}

/** Date-only window on a JSM date column, inclusive of both ends (JSM compares dd/MM/yyyy dates). */
function inDateRange(rows, field, from, to) {
  const f = from ? dayKey(from) : null;
  const t = to ? dayKey(to) : null;
  return rows.filter((r) => {
    const d = r[field] ? dayKey(r[field]) : null;
    if (d === null) return false;
    return (f === null || d >= f) && (t === null || d <= t);
  });
}

function dayKey(v) {
  const d = v instanceof Date ? v : new Date(v);
  return d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate();
}

/**
 * GROUP BY groupFields with SUM / AVG / MAX aggregates.
 * AVG follows SQL: mean of the non-null values in the group.
 */
function groupBy(rows, groupFields, { sum = [], avg = [], max = [] } = {}, select = () => ({})) {
  const groups = new Map();
  for (const r of rows) {
    const key = groupFields.map((f) => String(r[f] ?? '').trim().toUpperCase()).join('\u0001');
    if (!groups.has(key)) groups.set(key, { first: r, rows: [] });
    groups.get(key).rows.push(r);
  }
  return [...groups.values()].map(({ first, rows: rs }) => {
    const out = {};
    for (const f of groupFields) out[f] = first[f];
    for (const f of sum) out[f] = rs.reduce((t, r) => t + Number(r[f] || 0), 0);
    for (const f of avg) {
      const vals = rs.map((r) => r[f]).filter((v) => v !== null && v !== undefined);
      out[f] = vals.length ? vals.reduce((t, v) => t + Number(v), 0) / vals.length : null;
    }
    for (const f of max) {
      out[f] = rs.reduce((m, r) => (m === null || sqlCompare(r[f], m) > 0 ? r[f] : m), null);
    }
    return { ...out, ...select(first, rs) };
  });
}

function monthName(date) {
  return MONTHS[new Date(date).getUTCMonth()];
}

module.exports = {
  MONTHS, round, isBlank, sqlCompare, orderRows, inList, inDateRange, dayKey, groupBy, monthName,
};
