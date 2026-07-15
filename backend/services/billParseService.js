/**
 * Purchase bill extract:
 * - PDF text + table layer first
 * - PDF → PNG screenshot then OCR (never feed PDF bytes to tesseract — crashes)
 * - Photo → preprocess + item-band OCR
 */
const sharp = require('sharp');
const Tesseract = require('tesseract.js');
const { PDFParse } = require('pdf-parse');
const Party = require('../models/Party');
const Item = require('../models/Item');
const {
  parsePurchaseBillText,
  isBillDraftUseful,
  scoreExtractedText,
} = require('../utils/billParseHelpers');

const isPdf = (mimeType, originalName) => {
  const name = String(originalName || '').toLowerCase();
  const type = String(mimeType || '');
  return type === 'application/pdf' || name.endsWith('.pdf');
};

async function ocrOnce(buffer, psm = '6') {
  // Only PNG/JPEG buffers — never PDF
  try {
    const {
      data: { text },
    } = await Tesseract.recognize(buffer, 'eng', {
      preserve_interword_spaces: '1',
      tessedit_pageseg_mode: String(psm),
    });
    return String(text || '').trim();
  } catch (err) {
    console.warn('[billParse] OCR failed:', err.message);
    return '';
  }
}

async function enhanceFull(buffer) {
  return sharp(buffer)
    .rotate()
    .resize({ width: 2400, height: 3200, fit: 'inside', withoutEnlargement: false })
    .grayscale()
    .normalize()
    .sharpen({ sigma: 1.2 })
    .linear(1.25, -18)
    .png()
    .toBuffer();
}

async function ocrItemBands(pngBuffer) {
  const meta = await sharp(pngBuffer).metadata();
  const w = meta.width || 0;
  const h = meta.height || 0;
  if (!w || !h) return '';

  const bands = [
    [0.3, 0.55],
    [0.35, 0.55],
    [0.32, 0.52],
    [0.28, 0.5],
    [0.38, 0.58],
    [0.33, 0.48],
  ];

  let best = '';
  let bestScore = -1;
  const all = [];

  for (const [t0, t1] of bands) {
    const top = Math.max(0, Math.floor(h * t0));
    const height = Math.max(32, Math.min(h - top, Math.floor(h * (t1 - t0))));
    try {
      const crop = await sharp(pngBuffer)
        .extract({ left: 0, top, width: w, height })
        .resize({ width: 3400, kernel: sharp.kernel.lanczos3 })
        .grayscale()
        .normalize()
        .sharpen({ sigma: 2 })
        .linear(1.45, -22)
        .png()
        .toBuffer();
      const text = await ocrOnce(crop, 6);
      if (!text || text.length < 8) continue;
      all.push(text);
      let s = 0;
      if (/FINISH|BORDER|GREY|FABRIC|CXP|YARN/i.test(text)) s += 4;
      if (/\d{6,8}/.test(text)) s += 3;
      if (/\d+\.\d{3}/.test(text)) s += 2;
      if (/\d{4,}\.\d{2}/.test(text)) s += 2;
      s += Math.min(4, (text.match(/\d+\.\d{2,3}/g) || []).length);
      if (s > bestScore) {
        bestScore = s;
        best = text;
      }
    } catch {
      /* band failed */
    }
  }
  return [best, ...all.filter((t) => t !== best)].filter(Boolean).join('\n');
}

async function ocrPngBest(pngBuffer) {
  let fullText = '';
  try {
    const enhanced = await enhanceFull(pngBuffer);
    fullText = await ocrOnce(enhanced, 6);
    const s4 = await ocrOnce(enhanced, 4);
    if (scoreExtractedText(s4) > scoreExtractedText(fullText)) fullText = s4;
  } catch {
    fullText = await ocrOnce(pngBuffer, 6);
  }
  const bandText = await ocrItemBands(pngBuffer);
  return [fullText, bandText].filter(Boolean).join('\n\n---ITEM_BAND---\n\n');
}

function tablesToText(tableResult) {
  if (!tableResult?.pages?.length) return '';
  const lines = [];
  for (const page of tableResult.pages) {
    for (const table of page.tables || []) {
      for (const row of table) {
        if (Array.isArray(row)) lines.push(row.map((c) => String(c ?? '').trim()).join(' '));
        else if (row != null) lines.push(String(row));
      }
      lines.push('');
    }
  }
  return lines.join('\n').trim();
}

async function extractFromPdf(buffer) {
  const parser = new PDFParse({ data: buffer });
  const parts = [];
  try {
    // 1) Embedded text
    try {
      const textResult = await parser.getText();
      let text = '';
      if (typeof textResult === 'string') text = textResult;
      else if (textResult?.text) text = textResult.text;
      else if (Array.isArray(textResult?.pages)) {
        text = textResult.pages.map((p) => p?.text || '').join('\n');
      }
      text = String(text || '').trim();
      if (text) parts.push(text);
    } catch (e) {
      console.warn('[billParse] PDF getText failed:', e.message);
    }

    // 2) Native table extract (best for digital invoices)
    try {
      const tableResult = await parser.getTable();
      const tableText = tablesToText(tableResult);
      if (tableText) parts.push(`---PDF_TABLE---\n${tableText}`);
    } catch (e) {
      console.warn('[billParse] PDF getTable failed:', e.message);
    }

    const joined = parts.join('\n\n');
    const hasItemRow =
      /FINISH|BORDER|CXP|GREY|FABRIC/i.test(joined) &&
      /\d{6,8}/.test(joined) &&
      /\d+\.\d{2}/.test(joined);

    // 3) If text/table weak on items → render page to PNG and OCR
    if (!hasItemRow || scoreExtractedText(joined) < 8) {
      try {
        const shot = await parser.getScreenshot({
          scale: 2,
          imageBuffer: true,
          imageDataUrl: false,
          first: 1,
        });
        const page0 = shot?.pages?.[0];
        const png =
          page0?.data ||
          page0?.buffer ||
          (Buffer.isBuffer(page0) ? page0 : null);
        if (png && Buffer.isBuffer(png)) {
          const ocrText = await ocrPngBest(png);
          if (ocrText) parts.push(`---PDF_OCR---\n${ocrText}`);
        } else if (typeof page0?.dataUrl === 'string' && page0.dataUrl.includes(',')) {
          const b64 = page0.dataUrl.split(',')[1];
          const pngBuf = Buffer.from(b64, 'base64');
          const ocrText = await ocrPngBest(pngBuf);
          if (ocrText) parts.push(`---PDF_OCR---\n${ocrText}`);
        }
      } catch (e) {
        console.warn('[billParse] PDF screenshot/OCR failed:', e.message);
      }
    }
  } finally {
    try {
      await parser.destroy();
    } catch {
      /* ignore */
    }
  }

  return { text: parts.join('\n\n').trim(), source: 'pdf' };
}

async function extractFromImage(buffer) {
  // Guard: refuse PDF magic bytes
  if (buffer?.length >= 4 && buffer.slice(0, 4).toString() === '%PDF') {
    return extractFromPdf(buffer);
  }
  const text = await ocrPngBest(buffer);
  return { text, source: 'ocr' };
}

async function extractTextFromUpload({ buffer, mimeType, originalName }) {
  if (isPdf(mimeType, originalName)) {
    return extractFromPdf(buffer);
  }
  if (
    String(mimeType || '').startsWith('image/') ||
    /\.(jpe?g|png|webp|bmp|gif)$/i.test(String(originalName || ''))
  ) {
    return extractFromImage(buffer);
  }
  // Unknown — try as image; if PDF magic, route to pdf
  return extractFromImage(buffer);
}

async function parseUploadedBill({ companyId, buffer, mimeType, originalName, pastedText }) {
  let text = String(pastedText || '').trim();
  let source = 'paste';

  if (!text && buffer) {
    const extracted = await extractTextFromUpload({ buffer, mimeType, originalName });
    text = extracted.text;
    source = extracted.source;
  }

  if (!text || text.length < 12) {
    const err = new Error(
      'Could not read bill text. Upload a clear full-page PDF/photo, or paste invoice text.'
    );
    err.statusCode = 422;
    throw err;
  }

  const [parties, items] = await Promise.all([
    Party.find({ companyId }).select('name gstin address city station type').lean(),
    Item.find({ companyId }).select('name itemName hsnCode gstRate purchaseRate unit category').lean(),
  ]);

  const draft = parsePurchaseBillText(text, { parties, items });
  draft.meta = {
    ...draft.meta,
    extractSource: source,
    textLength: text.length,
  };

  if (!isBillDraftUseful(draft)) {
    const err = new Error(
      'Bill was readable but key fields (invoice / items) were not detected. Paste text from PDF or try a clearer scan.'
    );
    err.statusCode = 422;
    err.draft = draft;
    throw err;
  }

  return draft;
}

module.exports = {
  parseUploadedBill,
  extractTextFromUpload,
};
