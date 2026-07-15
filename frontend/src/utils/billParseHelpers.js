/**
 * Heuristic parser for Indian GST / Surat textile tax invoices (OCR or PDF text).
 * Hardened for noisy OCR: broken GSTIN, comma amounts, multi-line item rows.
 */

const GSTIN_STRICT =
  /\b([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z])\b/gi;
const GSTIN_LOOSE =
  /\b([0-9O]{2}[A-Z0-9]{10}[A-Z0-9]Z[A-Z0-9])\b/gi;

/** Demo / fake GSTINs that must never fill as supplier */
const BLOCKED_GSTINS = new Set([
  '24AABCM1234D1Z5',
  '27AABCU9603R1ZM',
  '29AABCT1332L1ZV',
]);

export function isGarbageName(name) {
  const s = String(name || '').trim();
  if (s.length < 3) return true;
  if (/(.)\1{4,}/.test(s.replace(/\s/g, ''))) return true;
  if (/^(E|G|S|\s|\.){6,}$/i.test(s)) return true;
  const letters = (s.match(/[A-Za-z]/g) || []).length;
  if (letters < 3) return true;
  return false;
}

export function scoreExtractedText(text) {
  const t = String(text || '');
  if (!t.trim()) return 0;
  const compact = t.replace(/\s+/g, '');
  if (/(.)\1{8,}/.test(compact)) return 0;
  if (/^(E|G|S|\s|\.){10,}$/i.test(compact.slice(0, 40))) return 0;
  let score = 0;
  if (/TAX\s*INVOICE|INVOICE\s*NO|GSTIN/i.test(t)) score += 3;
  const strictHits = [...t.toUpperCase().matchAll(GSTIN_STRICT)]
    .map((m) => normalizeGstinCandidate(m[1]))
    .filter(Boolean);
  if (strictHits.length) score += 3;
  if (/HSN|CGST|SGST|TAXABLE|NET\s*AMOUNT/i.test(t)) score += 2;
  if (/\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}/.test(t)) score += 1;
  if (/\d+\.\d{2,3}/.test(t)) score += 1;
  score += Math.min(4, Math.floor(t.length / 250));
  return score;
}

/** Normalize OCR GSTIN → closest valid shape */
export function normalizeGstinCandidate(raw) {
  if (!raw) return '';
  let g = String(raw)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
  if (g.length < 14) return '';
  g = g.slice(0, 15);
  // Position fixes: digits vs letters expectations
  const chars = g.split('');
  for (let i = 0; i < chars.length; i += 1) {
    const c = chars[i];
    if (i < 2 || (i >= 7 && i <= 10)) {
      if (c === 'O') chars[i] = '0';
      if (c === 'I' || c === 'L') chars[i] = '1';
      if (c === 'S') chars[i] = '5';
      if (c === 'B') chars[i] = '8';
    }
    if (i === 12 && (c === '0' || c === 'O')) chars[i] = 'Z';
  }
  const out = chars.join('').slice(0, 15);
  if (BLOCKED_GSTINS.has(out)) return '';
  return out;
}

function parseAmount(raw) {
  if (raw == null || raw === '') return 0;
  const cleaned = String(raw).replace(/,/g, '').replace(/[^\d.-]/g, '');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function normalizeDate(raw) {
  if (!raw) return '';
  const parts = String(raw).trim().split(/[\/\-\.]/);
  if (parts.length !== 3) return '';
  let [a, b, c] = parts.map((p) => p.trim());
  if (a.length === 4) {
    return `${a}-${b.padStart(2, '0')}-${c.padStart(2, '0')}`;
  }
  let d = a;
  let m = b;
  let y = c;
  if (y.length === 2) y = `20${y}`;
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

function fuzzyScore(a, b) {
  const x = String(a || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
  const y = String(b || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
  if (!x || !y) return 0;
  if (x === y) return 1;
  if (x.includes(y) || y.includes(x)) return 0.9;
  let hits = 0;
  const shorter = x.length < y.length ? x : y;
  const longer = x.length < y.length ? y : x;
  for (let i = 0; i < shorter.length; i += 1) {
    if (longer.includes(shorter[i])) hits += 1;
  }
  return hits / Math.max(longer.length, 1);
}

function gstinDistance(a, b) {
  const x = normalizeGstinCandidate(a);
  const y = normalizeGstinCandidate(b);
  if (!x || !y) return 99;
  if (x === y) return 0;
  let d = 0;
  const n = Math.max(x.length, y.length);
  for (let i = 0; i < n; i += 1) {
    if (x[i] !== y[i]) d += 1;
  }
  return d;
}

function findBestParty(parties, { gstin, name }) {
  const list = parties || [];
  if (gstin) {
    const g = normalizeGstinCandidate(gstin);
    let best = null;
    let dist = 99;
    for (const p of list) {
      const pg = String(p.gstin || '').toUpperCase();
      if (!pg) continue;
      if (pg === g) return p;
      const d = gstinDistance(pg, g);
      if (d < dist) {
        dist = d;
        best = p;
      }
    }
    // Allow 1–2 OCR typos on GSTIN
    if (best && dist <= 2) return best;
  }
  if (!name || isGarbageName(name)) return null;
  let best = null;
  let score = 0;
  for (const p of list) {
    const s = fuzzyScore(p.name, name);
    if (s > score) {
      score = s;
      best = p;
    }
  }
  return score >= 0.45 ? best : null;
}

function findBestItem(items, { name, hsn }) {
  const list = items || [];
  if (hsn) {
    const h = String(hsn).replace(/\D/g, '');
    const byHsn = list.find(
      (it) => String(it.hsnCode || it.hsn || '').replace(/\D/g, '') === h
    );
    if (byHsn) return byHsn;
  }
  if (!name || isGarbageName(name)) return null;
  let best = null;
  let score = 0;
  for (const it of list) {
    const label = it.itemName || it.name || '';
    const s = fuzzyScore(label, name);
    if (s > score) {
      score = s;
      best = it;
    }
  }
  return score >= 0.4 ? best : null;
}

function extractSupplierGstin(text) {
  const upper = String(text || '').toUpperCase();
  const billedIdx = upper.search(
    /BILLED\s*TO|BILL\s*TO|BUYER|CUSTOMER\s*NAME|DELIVERY\s*ADDRESS|SANCHAL/
  );
  const searchZone =
    billedIdx > 0 ? upper.slice(0, billedIdx) : upper.slice(0, Math.min(1200, upper.length));

  let matches = [...searchZone.matchAll(GSTIN_STRICT)].map((m) => m[1]);
  if (!matches.length) {
    matches = [...searchZone.matchAll(GSTIN_LOOSE)]
      .map((m) => normalizeGstinCandidate(m[1]))
      .filter((g) => g.length === 15);
  }
  if (matches.length) return normalizeGstinCandidate(matches[0]);

  const allStrict = [...upper.matchAll(GSTIN_STRICT)].map((m) => m[1]);
  if (allStrict.length) return normalizeGstinCandidate(allStrict[0]);

  const allLoose = [...upper.matchAll(GSTIN_LOOSE)]
    .map((m) => normalizeGstinCandidate(m[1]))
    .filter((g) => g.length === 15);
  return allLoose[0] || '';
}

function extractSupplierName(text) {
  const raw = String(text || '');
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  for (let i = 0; i < Math.min(lines.length, 15); i += 1) {
    const line = lines[i];
    if (
      /TAX\s*INVOICE|ORIGINAL|DUPLICATE|TRIPLICATE|GSTIN|PLACE\s*OF\s*SUPPLY|INVOICE\s*NO|BILLED\s*TO/i.test(
        line
      )
    ) {
      continue;
    }
    // Allow soft OCR noise: mostly caps company names
    const cleaned = line.replace(/[^A-Za-z0-9 &\.\-]/g, ' ').replace(/\s+/g, ' ').trim();
    if (isGarbageName(cleaned)) continue;
    if (
      cleaned.length >= 5 &&
      cleaned.length <= 60 &&
      /[A-Za-z]{3,}/.test(cleaned) &&
      !/SURAT|GUJARAT|ROAD|SHOP|FLOOR|PHONE|PARVAT|CREATION|AXIS|BANK|MAHAVEER/i.test(cleaned)
    ) {
      // Prefer textile-ish seller names
      if (/TEX|FAB|MILL|SILK|FASHION|TREND|PROCESS|DYE/i.test(cleaned) || /^[A-Z0-9 &\.\-]{5,}$/.test(cleaned)) {
        return cleaned.toUpperCase();
      }
    }
  }

  // Known pattern: HARSHIKA TEX FAB style near top
  const named = raw.match(/\b([A-Z][A-Z0-9 &\.\-]{2,40}(?:TEX|FAB|MILL|PROCESS)[A-Z0-9 &\.\-]{0,20})\b/);
  if (named && !isGarbageName(named[1])) return named[1].replace(/\s+/g, ' ').trim();

  const ms = raw.match(/(?:M\/s\.?|Messrs\.?)\s*([A-Za-z0-9 &.\-]{3,50})/i);
  return ms?.[1] && !isGarbageName(ms[1]) ? ms[1].trim().toUpperCase() : '';
}

function extractInvoiceNo(text) {
  const patterns = [
    /Invoice\s*No\.?\s*[:.\-]?\s*([A-Z0-9]+(?:\s*\/\s*[A-Z0-9]+)?)/i,
    /Inv\.?\s*No\.?\s*[:.\-]?\s*([A-Z0-9]+(?:\s*\/\s*[A-Z0-9]+)?)/i,
    /Bill\s*No\.?\s*[:.\-]?\s*([A-Z0-9]+(?:\s*\/\s*[A-Z0-9]+)?)/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m?.[1] && !/date|due|challan|order/i.test(m[1])) {
      return m[1].replace(/\s+/g, '').trim();
    }
  }
  // OCR: "Invoice No. : 1/118" sometimes as "1 / 118"
  const loose = text.match(/Invoice[^\d]{0,20}(\d{1,4})\s*\/\s*(\d{1,6})/i);
  if (loose) return `${loose[1]}/${loose[2]}`;
  return '';
}

function extractInvoiceDate(text) {
  const patterns = [
    /Invoice\s*Date\s*[:.\-]?\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
    /Bill\s*Date\s*[:.\-]?\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m?.[1]) return normalizeDate(m[1]);
  }
  // Prefer date near "Invoice" and not "Due Date"
  const withoutDue = String(text).replace(/Due\s*Date\s*[:.\-]?\s*\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}/gi, '');
  const early = withoutDue.slice(0, 1400);
  const dm = early.match(/(\d{1,2}[-\/.]\d{1,2}[-\/.]\d{4})/);
  return dm ? normalizeDate(dm[1]) : '';
}

function extractRoundOff(text) {
  const m = text.match(/Round\s*off[^\d\-]*(-?\d+(?:\.\d+)?)/i)
    || text.match(/\(ed\s*off\)[^\d\-]*(-?\d+(?:\.\d+)?)/i)
    || text.match(/ed\s*off[^\d\-]*(-?\d+(?:\.\d+)?)/i);
  return m ? Number(m[1]) : 0;
}

function extractNetAmount(text) {
  const m =
    text.match(/Net\s*Amount[^\d]*([\d,]+\.\d{2})/i) ||
    text.match(/Net\s*Amt[^\d]*([\d,]+\.\d{2})/i);
  return m ? parseAmount(m[1]) : 0;
}

function extractGstPercent(text) {
  const cgst = text.match(/CGST[^\d%]*(\d+(?:\.\d+)?)\s*%/i);
  const sgst = text.match(/(?:UT\/)?SGST[^\d%]*(\d+(?:\.\d+)?)\s*%/i);
  if (cgst && sgst) return Number(cgst[1]) + Number(sgst[1]);
  const taxRow = text.match(/Tax\s*\(%\)\s*[^\n]*?(\d+(?:\.\d+)?)/i);
  if (taxRow) return Number(taxRow[1]);
  const ig = text.match(/IGST[^\d%]*(\d+(?:\.\d+)?)\s*%/i);
  if (ig && !/CGST/i.test(text)) return Number(ig[1]);
  return 5;
}

/**
 * Extract line items — robust for OCR joining/splitting columns.
 * Target: Name  HSN  Pcs  Kgs  Rate  Amount
 */
function extractLineItems(text) {
  const blob = String(text || '').replace(/\r/g, '\n');
  const lines = blob
    .split(/\n/)
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  const items = [];
  const skipLine =
    /^(gstin|invoice|bill|total|taxable|cgst|sgst|igst|ut\/sgst|grand|amount\s*in|bank|ifsc|page|tax\s*\(%\)|description of goods|sr\.?$|net amount|round|place of supply|billed to|delivery|payment|terms|original|authori)/i;

  const pushItem = (rawName, hsn, pcs, qty, rate, amount) => {
    const name = String(rawName || '')
      .replace(/^\d+[\.\)]\s*/, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (name.length < 2 || isGarbageName(name)) return;
    if (/taxable|total|amount|cgst|sgst|harshika|sanchal|invoice|bank|axis|mahabeer|mahaveer/i.test(name)) return;
    items.push({
      rawName: name,
      hsn: String(hsn || '').replace(/\D/g, '').slice(0, 8),
      pcs: Number(pcs) || 0,
      mts: parseAmount(qty),
      rate: parseAmount(rate),
      amount: parseAmount(amount),
      qtyUnit: 'kgs',
      gstPer: 5,
    });
  };

  for (const line of lines) {
    if (skipLine.test(line)) continue;
    if (/total\s*(pcs|kgs|amount)|sub[\s-]*total|thirty|thousand|authorized|net amount/i.test(line)) {
      continue;
    }

    // Full row: Name HSN Pcs Qty Rate Amount (commas optional)
    let m = line.match(
      /^(?:\d+\s+)?([A-Za-z][A-Za-z0-9 &\.\-\/]{2,50}?)\s+(\d{4,8})\s+(\d+)\s+([\d,]+\.?\d*)\s+([\d,]+\.?\d*)\s+([\d,]+\.?\d*)\s*$/
    );
    if (m) {
      pushItem(m[1], m[2], m[3], m[4], m[5], m[6]);
      continue;
    }

    // OCR often drops spaces: FINISHCXPBORDER 60069000 6 137.820 245.00 33765.90
    m = line.match(
      /([A-Za-z][A-Za-z0-9 &\.\-\/]{2,50}?)\s+(\d{4,8})\s+(\d{1,4})\s+([\d,]+\.\d{2,3})\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})/
    );
    if (m) {
      pushItem(m[1], m[2], m[3], m[4], m[5], m[6]);
    }
  }

  // Join adjacent lines when Description and numbers split
  if (!items.length) {
    for (let i = 0; i < lines.length - 1; i += 1) {
      const joined = `${lines[i]} ${lines[i + 1]}`;
      const m = joined.match(
        /([A-Za-z][A-Za-z0-9 &\.\-\/]{2,50}?)\s+(\d{4,8})\s+(\d{1,4})\s+([\d,]+\.?\d*)\s+([\d,]+\.?\d*)\s+([\d,]+\.?\d*)/
      );
      if (m) pushItem(m[1], m[2], m[3], m[4], m[5], m[6]);
    }
  }

  // Full blob fallback
  if (!items.length) {
    const flat = blob.replace(/\s+/g, ' ');
    const re =
      /([A-Z][A-Z0-9 &\.\-\/]{2,40})\s+(\d{4,8})\s+(\d{1,4})\s+([\d,]+\.\d{2,3})\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})/g;
    let hit;
    while ((hit = re.exec(flat)) && items.length < 40) {
      pushItem(hit[1], hit[2], hit[3], hit[4], hit[5], hit[6]);
    }
  }

  // Validate: amount ≈ qty * rate (within 5%) else fix amount
  return items.slice(0, 40).map((it) => {
    const expected = Number((it.mts * it.rate).toFixed(2));
    if (it.amount <= 0 && expected > 0) it.amount = expected;
    else if (expected > 0 && Math.abs(it.amount - expected) / expected > 0.08) {
      // Prefer qty*rate when OCR amount suspicious
      if (it.mts > 0 && it.rate > 0) it.amount = expected;
    }
    return it;
  });
}

/**
 * @param {string} text OCR / PDF text
 * @param {{ parties?: any[], items?: any[] }} masters
 */
export function parsePurchaseBillText(text, masters = {}) {
  const raw = String(text || '');
  const upper = raw.toUpperCase();
  const textScore = scoreExtractedText(raw);

  const gstin = extractSupplierGstin(raw);
  const allGstins = [
    ...[...upper.matchAll(GSTIN_STRICT)].map((m) => normalizeGstinCandidate(m[1])),
    ...[...upper.matchAll(GSTIN_LOOSE)].map((m) => normalizeGstinCandidate(m[1])),
  ].filter(Boolean);

  let billNo = extractInvoiceNo(raw);
  let billDate = extractInvoiceDate(raw);
  let supplierName = extractSupplierName(raw);
  const roundOff = extractRoundOff(raw);
  const defaultGst = extractGstPercent(raw);
  const netAmount = extractNetAmount(raw);

  const igstHint = /IGST\s*[1-9]|OUT\s*OF\s*STATE/i.test(raw) && !/CGST/i.test(raw);
  const hasCgst = /CGST/i.test(raw);
  const type = igstHint && !hasCgst ? 'INVOICE OUT OF STATE' : 'INVOICE IN STATE';

  const party = findBestParty(masters.parties, { gstin, name: supplierName });

  // If party matched, prefer master name/gstin for form sync
  if (party) {
    supplierName = party.name || supplierName;
  }

  const lineDrafts = extractLineItems(raw).map((row) => {
    const matched = findBestItem(masters.items, { name: row.rawName, hsn: row.hsn });
    const mts = row.mts || 0;
    const rate = row.rate || matched?.purchaseRate || matched?.purRate || 0;
    const amount =
      row.amount != null && row.amount > 0 ? row.amount : Number((mts * rate).toFixed(2));
    const gstPer = matched?.gstRate || row.gstPer || defaultGst || 5;
    const descParts = [row.rawName];
    if (row.hsn) descParts.push(`HSN ${row.hsn}`);
    if (row.qtyUnit === 'kgs') descParts.push('(qty in Kgs)');
    return {
      itemId: matched?._id || matched?.id || '',
      itemName: matched?.itemName || matched?.name || row.rawName,
      desc: descParts.join(' · '),
      fold: 0,
      cut: 0,
      pcs: row.pcs || 0,
      mts,
      rate,
      amount,
      dis1Per: 0,
      dis1Amt: 0,
      dis2Per: 0,
      dis2Amt: 0,
      gstPer,
      gstAmt: Number(((amount * gstPer) / 100).toFixed(2)),
      unmatched: !matched,
      hsn: row.hsn || '',
    };
  });

  const cleanSupplier = isGarbageName(supplierName) ? '' : supplierName;

  return {
    header: {
      party: party?._id || party?.id || '',
      gstin: party?.gstin || gstin || '',
      city: party?.station || party?.city || '',
      add: party?.address || '',
      billNo,
      billDate: billDate || '',
      type,
      gstType: type === 'INVOICE OUT OF STATE' ? 'IGST' : 'CGST+SGST',
    },
    footer: {
      roundOff,
    },
    items: lineDrafts,
    meta: {
      gstins: allGstins,
      supplierName: cleanSupplier,
      supplierGstin: gstin,
      netAmount,
      textScore,
      note: 'Supplier = seller on bill (not Billed To). Kgs → Mts qty.',
      confidence: {
        party: party ? 'matched' : gstin || cleanSupplier ? 'partial' : 'none',
        items: lineDrafts.length
          ? lineDrafts.every((i) => i.itemId)
            ? 'matched'
            : 'partial'
          : 'none',
        ocr: textScore >= 6 ? 'ok' : textScore >= 3 ? 'weak' : 'poor',
      },
      rawPreview: raw.slice(0, 1600),
      suggestedParty:
        !party && cleanSupplier
          ? { name: cleanSupplier, gstin, group: 'SUNDRY CREDITORS', type: 'Supplier' }
          : null,
      suggestedItems: lineDrafts
        .filter((r) => !r.itemId && r.itemName && !isGarbageName(r.itemName))
        .map((r) => ({
          itemName: r.itemName,
          name: r.itemName,
          hsnCode: r.hsn,
          gstRate: r.gstPer || 5,
          purchaseRate: r.rate,
          category: 'Finished',
          unit: 'KGS',
        })),
    },
  };
}

export function applyBillDraftToGrid(draftItems) {
  if (!draftItems?.length) {
    return [
      {
        id: 1,
        itemId: '',
        itemName: '',
        desc: '',
        fold: 0,
        cut: 0,
        pcs: 0,
        mts: 0,
        rate: 0,
        amount: 0,
        dis1Per: 0,
        dis1Amt: 0,
        dis2Per: 0,
        dis2Amt: 0,
        gstPer: 5,
        gstAmt: 0,
      },
    ];
  }
  return draftItems.map((row, idx) => ({
    id: idx + 1,
    itemId: row.itemId || '',
    itemName: row.itemName || '',
    desc: row.desc || '',
    fold: Number(row.fold || 0),
    cut: Number(row.cut || 0),
    pcs: Number(row.pcs || 0),
    mts: Number(row.mts || 0),
    rate: Number(row.rate || 0),
    amount: Number(row.amount || 0),
    dis1Per: Number(row.dis1Per || 0),
    dis1Amt: Number(row.dis1Amt || 0),
    dis2Per: Number(row.dis2Per || 0),
    dis2Amt: Number(row.dis2Amt || 0),
    gstPer: Number(row.gstPer || 5),
    gstAmt: Number(row.gstAmt || 0),
  }));
}

/** True when draft has enough data to push into the form */
export function isBillDraftUseful(draft) {
  if (!draft?.header) return false;
  const h = draft.header;
  if ((draft.meta?.textScore || 0) < 2 && !(draft.items || []).length) return false;
  const name = draft.meta?.supplierName;
  return !!(
    h.billNo ||
    h.gstin ||
    h.party ||
    (draft.items || []).length ||
    (name && !isGarbageName(name))
  );
}
