/**
 * Parsers for values typed or exported into import sheets (Excel / old software).
 * Pure functions, no database.
 */

/** "1,50,000", "₹ 2,500.50", "(500)", "500-", -12 -> number; anything unreadable -> null. */
function parseNumber(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  let s = String(value).trim();
  if (!s) return null;
  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }
  s = s.replace(/^(rs\.?|inr|₹|\$)/i, '').replace(/[,\s₹$]/g, '');
  if (s.endsWith('-')) {
    negative = true;
    s = s.slice(0, -1);
  }
  if (s.startsWith('-')) {
    negative = !negative;
    s = s.slice(1);
  }
  if (!/^\d*\.?\d+$|^\d+\.$/.test(s)) return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return negative ? -n : n;
}

/**
 * An amount that may carry its Dr/Cr side: "1,50,000 Cr", "5000 Dr.", "2500 C".
 * Returns { amount (always >= 0 or null), side: 'Dr' | 'Cr' | null, negative }.
 */
function parseAmountWithSide(value) {
  if (value === null || value === undefined || value === '') return { amount: null, side: null, negative: false };
  if (typeof value === 'number') {
    return Number.isFinite(value)
      ? { amount: Math.abs(value), side: null, negative: value < 0 }
      : { amount: null, side: null, negative: false };
  }
  let s = String(value).trim();
  let side = null;
  const m = s.match(/^(.*?)[\s]*(dr|cr|d|c)\.?$/i);
  if (m && m[1].trim() !== '') {
    side = m[2].toLowerCase().startsWith('c') ? 'Cr' : 'Dr';
    s = m[1];
  }
  const n = parseNumber(s);
  if (n === null) return { amount: null, side, negative: false };
  return { amount: Math.abs(n), side, negative: n < 0 };
}

/** 'Dr' / 'Cr' from a type column ("Cr", "CREDIT", "C", "Dr."); null when unclear. */
function parseSide(value) {
  const s = String(value ?? '').trim().toUpperCase().replace(/\./g, '');
  if (!s) return null;
  if (s === 'CR' || s === 'C' || s.startsWith('CREDIT')) return 'Cr';
  if (s === 'DR' || s === 'D' || s.startsWith('DEBIT')) return 'Dr';
  return null;
}

/**
 * GST rate from "12%", "GST 18 %", "IGST @ 5", 5, 0.05 (Excel percent cell), "Exempt".
 * Blank or unreadable -> `fallback`.
 */
function parseGstRate(value, fallback = 5) {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return fallback;
    return value > 0 && value < 1 ? Number((value * 100).toFixed(4)) : value;
  }
  const s = String(value).trim();
  if (!s) return fallback;
  if (/^(exempt|exempted|nil|nil rated|nil-rated|zero|zero rated|free|gst free)$/i.test(s)) return 0;
  const m = s.match(/(\d+(?:\.\d+)?)/);
  if (!m) return fallback;
  const n = Number(m[1]);
  if (!Number.isFinite(n)) return fallback;
  return n > 0 && n < 1 && !s.includes('%') ? Number((n * 100).toFixed(4)) : n;
}

/**
 * Header text that is safe to send as an object key: a "." is a key separator for MongoDB, and the
 * server's input sanitizer drops such keys, so "Mobile No." used to vanish from every row.
 * U+2024 looks like a dot; the column matcher ignores punctuation anyway.
 */
function safeHeaderKey(header) {
  return String(header ?? '').replace(/\./g, '․').replace(/^\$/, '＄');
}

module.exports = { parseNumber, parseAmountWithSide, parseSide, parseGstRate, safeHeaderKey };
