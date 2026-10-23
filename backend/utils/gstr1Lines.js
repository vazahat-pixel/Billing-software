'use strict';

const { lineQty, lineAmount, lineTaxable } = require('./salesTotals');

const round2 = (n) => Number(Number(n || 0).toFixed(2));

const UQC_LABELS = {
  MTR: 'METERS', PCS: 'PIECES', KGS: 'KILOGRAMS', NOS: 'NUMBERS', YDS: 'YARDS', SET: 'SETS',
  BOX: 'BOX', BDL: 'BUNDLES', BAL: 'BALE', ROL: 'ROLLS', DOZ: 'DOZENS', PAC: 'PACKS',
  LTR: 'LITRES', GMS: 'GRAMMES', SQM: 'SQUARE METERS', TON: 'TONNES', QTL: 'QUINTAL',
  THD: 'THOUSANDS', UNT: 'UNITS', OTH: 'OTHERS',
};

const UQC_SYNONYMS = {
  MTR: ['MTR', 'MTRS', 'MTS', 'MT', 'M', 'METER', 'METERS', 'METRE', 'METRES', 'QTY', 'NETQTY'],
  PCS: ['PCS', 'PC', 'PIECE', 'PIECES'],
  KGS: ['KGS', 'KG', 'KILO', 'KILOS', 'KILOGRAM', 'KILOGRAMS'],
  NOS: ['NOS', 'NO', 'NUMBER', 'NUMBERS'],
  YDS: ['YDS', 'YD', 'YARD', 'YARDS'],
  SET: ['SET', 'SETS'],
  ROL: ['ROL', 'ROLL', 'ROLLS'],
  BAL: ['BAL', 'BALE', 'BALES'],
  DOZ: ['DOZ', 'DOZEN', 'DOZENS'],
};

const SYNONYM_TO_UQC = Object.entries(UQC_SYNONYMS).reduce((acc, [code, names]) => {
  for (const n of names) acc[n] = code;
  return acc;
}, {});

/** Line unit name (MTRS, PCS, KG, "MTR-METERS"…) → GST UQC code. Unknown units file as OTH. */
function toUqc(unit) {
  const raw = String(unit || '').trim().toUpperCase();
  if (!raw) return 'OTH';
  const code = raw.includes('-') ? raw.split('-')[0] : raw;
  if (UQC_LABELS[code]) return code;
  return SYNONYM_TO_UQC[code] || 'OTH';
}

/** Offline-utility style label, as JSM prints it: "MTR-METERS". */
function uqcLabel(code) {
  return `${code}-${UQC_LABELS[code] || 'OTHERS'}`;
}

function lineRate(line, fallbackRate) {
  const candidates = [line.gstPer, line.gstRate, line.itemId?.gstRate, fallbackRate];
  for (const raw of candidates) {
    if (raw === undefined || raw === null || raw === '') continue;
    const n = Number(raw);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 0;
}

const FOLD_UNITS = new Set(['QTY', 'PCS', 'PC', 'MTRS', 'MTS']);
const PCS_UNITS = new Set(['PCS', 'PC', 'NOS', 'NO']);

/**
 * Fold-less the sales screen deducts from a QTY/PCS/MTRS line (gross × (100 − fold%)), positive = less.
 * The screen totals these into the footer foldLess, so they are only applied back to lines when they add up to it.
 */
function lineFoldLess(line) {
  const unit = String(line.unit || 'MTRS').toUpperCase();
  const fold = Number(line.fold || 0);
  if (!FOLD_UNITS.has(unit) || !(fold > 0) || fold >= 100) return 0;
  return round2((lineAmount(line) * (100 - fold)) / 100);
}

/** JSM HSN quantity: pieces for piece units, otherwise the net-of-fold quantity (IT_QTY1). */
function lineNetQty(line) {
  const unit = String(line.unit || 'MTRS').toUpperCase();
  const qty = Number(lineQty(line) || 0);
  if (PCS_UNITS.has(unit)) return round2(qty);
  const fold = Number(line.fold || 0);
  return round2(fold > 0 && fold !== 100 ? (qty * fold) / 100 : qty);
}

function baseTaxable(line) {
  if (line.taxableAmount !== undefined && line.taxableAmount !== null && Number.isFinite(Number(line.taxableAmount))) {
    return round2(line.taxableAmount);
  }
  return round2(lineTaxable({ ...line, amount: lineAmount(line) }));
}

function allocateByWeight(total, weights) {
  const sumW = weights.reduce((s, w) => s + w, 0);
  const out = new Array(weights.length).fill(0);
  if (!weights.length) return out;
  let used = 0;
  let lastIdx = weights.length - 1;
  while (lastIdx > 0 && !(weights[lastIdx] > 0)) lastIdx -= 1;
  for (let i = 0; i < weights.length; i += 1) {
    if (i === lastIdx) { out[i] = round2(total - used); continue; }
    if (i > lastIdx) continue;
    out[i] = sumW > 0 ? round2((total * weights[i]) / sumW) : 0;
    used = round2(used + out[i]);
  }
  return out;
}

/**
 * Splits one saved invoice into per-line GST rows so GSTR-1 can be built rate-wise,
 * the way JSM's GSTR-1 does (T_SL_ITEM: amount − fold − dis1 − dis2 − rd + add, at the line's own rate).
 *
 * Footer adjustments (freight/add/less on the header) are handled two ways:
 *  - taxed footer (MERN computes tax on it): taxable is spread across lines so the rows add up to the saved
 *    header taxable and tax exactly;
 *  - untaxed footer (header tax equals line tax, as in JSM's fold/T_ADD): the footer is not a GST supply,
 *    so rows carry line taxable only — JSM reports it the same way.
 * Tax always sums to the saved header tax.
 */
function allocateInvoiceLines(doc, header) {
  let lines = (doc.items || [])
    .map((line) => ({ line, base: baseTaxable(line), fold: lineFoldLess(line), rate: lineRate(line, header.taxRate) }));
  const foldOnLines = round2(lines.reduce((t, l) => t + l.fold, 0));
  const footerFold = Number(doc.foldLess || 0) * (doc.foldLessSign === '+' ? -1 : 1);
  if (foldOnLines >= 0.01 && Math.abs(foldOnLines - footerFold) <= 0.05 + 0.01 * lines.length) {
    lines = lines.map((l) => ({ ...l, base: round2(l.base - l.fold) }));
  }
  lines = lines.filter((l) => l.base > 0);

  if (!lines.length) {
    return [{
      line: null, rate: Number(header.taxRate || 0), txval: header.taxable,
      iamt: header.igst, camt: header.cgst, samt: header.sgst, csamt: header.cess,
      qty: 0, hsn: '', desc: '', uqc: 'OTH',
    }];
  }

  const baseSum = round2(lines.reduce((s, l) => s + l.base, 0));
  const footer = round2(header.taxable - baseSum);
  const headerTax = round2(header.cgst + header.sgst + header.igst);
  const lineTax = round2(lines.reduce((s, l) => s + round2((l.base * l.rate) / 100), 0));
  const tolerance = Math.max(0.05, 0.01 * lines.length);
  const avgRate = baseSum > 0 ? lines.reduce((s, l) => s + l.base * l.rate, 0) / baseSum : 0;
  const footerTaxIfTaxed = Math.abs(footer) * avgRate / 100;
  const footerUntaxed = Math.abs(footer) >= 0.01
    && footerTaxIfTaxed > tolerance
    && Math.abs(headerTax - lineTax) <= tolerance;

  const targetTaxable = footerUntaxed ? baseSum : header.taxable;
  const txvals = allocateByWeight(targetTaxable, lines.map((l) => l.base));
  const taxWeights = lines.map((l, i) => txvals[i] * (l.rate || 0));
  const useWeights = taxWeights.some((w) => w > 0) ? taxWeights : txvals;
  const iamt = allocateByWeight(header.igst, useWeights);
  const camt = allocateByWeight(header.cgst, useWeights);
  const samt = allocateByWeight(header.sgst, useWeights);
  const csamt = allocateByWeight(header.cess, useWeights);

  return lines.map((l, i) => ({
    line: l.line,
    rate: l.rate,
    txval: txvals[i],
    iamt: iamt[i],
    camt: camt[i],
    samt: samt[i],
    csamt: csamt[i],
    qty: lineNetQty(l.line),
    hsn: String(l.line.hsnCode || l.line.itemId?.hsnCode || '').trim(),
    desc: l.line.itemId?.name || l.line.description || l.line.desc || '',
    uqc: toUqc(l.line.unit || l.line.itemId?.unit),
  }));
}

/** Groups allocated rows by GST rate (portal itms / JSM rate-wise rows). */
function groupByRate(rows) {
  const buckets = new Map();
  for (const r of rows) {
    const key = Number(r.rate || 0).toFixed(2);
    if (!buckets.has(key)) buckets.set(key, { rt: Number(key), txval: 0, iamt: 0, camt: 0, samt: 0, csamt: 0 });
    const b = buckets.get(key);
    b.txval = round2(b.txval + r.txval);
    b.iamt = round2(b.iamt + r.iamt);
    b.camt = round2(b.camt + r.camt);
    b.samt = round2(b.samt + r.samt);
    b.csamt = round2(b.csamt + r.csamt);
  }
  return [...buckets.values()];
}

/** "INV-2026-27-0012" → { prefix: 'INV-2026-27-', num: 12 }; non-numeric tails return num null. */
function splitDocNo(no) {
  const s = String(no || '').trim();
  const m = s.match(/^(.*?)(\d+)$/);
  if (!m) return { prefix: s, num: null };
  return { prefix: m[1], num: Number(m[2]) };
}

function naturalCompare(a, b) {
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
}

/**
 * GSTR-1 Table 13 rows, one per document series (book + number prefix), as JSM lists them.
 * When a series is purely numeric, missing numbers inside the range count as cancelled — JSM's rule.
 */
function buildDocSeries(active, cancelled, docType) {
  const groups = new Map();
  const add = (doc, isCancelled) => {
    if (!doc.invoiceNo) return;
    const { prefix, num } = splitDocNo(doc.invoiceNo);
    const key = `${doc.bookId || ''}|${prefix}`;
    if (!groups.has(key)) groups.set(key, { nos: [], nums: [], active: 0, cancelled: 0, allNumeric: true });
    const g = groups.get(key);
    g.nos.push(doc.invoiceNo);
    if (num === null) g.allNumeric = false; else g.nums.push(num);
    if (isCancelled) g.cancelled += 1; else g.active += 1;
  };
  active.forEach((d) => add(d, false));
  cancelled.forEach((d) => add(d, true));

  return [...groups.values()]
    .map((g) => {
      const sorted = [...g.nos].sort(naturalCompare);
      const recorded = g.active + g.cancelled;
      let totnum = recorded;
      if (g.allNumeric && g.nums.length) {
        const span = Math.max(...g.nums) - Math.min(...g.nums) + 1;
        if (span >= recorded) totnum = span;
      }
      const cancel = totnum - g.active;
      return {
        docType,
        from: sorted[0],
        to: sorted[sorted.length - 1],
        totnum,
        cancel,
        net_issue: totnum - cancel,
      };
    })
    .sort((a, b) => naturalCompare(a.from, b.from));
}

module.exports = {
  toUqc,
  uqcLabel,
  lineRate,
  allocateInvoiceLines,
  groupByRate,
  buildDocSeries,
  naturalCompare,
};
