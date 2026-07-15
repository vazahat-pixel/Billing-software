/**
 * Extract text from purchase bill files (image OCR + PDF text / OCR fallback).
 * Preprocesses images (upscale + contrast) so Surat textile invoices OCR reliably.
 */

async function loadImageElement(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Could not open image'));
      el.src = url;
    });
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Upscale + grayscale + contrast boost for OCR.
 * Textile invoices are dense tables — larger canvas helps digit/HSN accuracy.
 */
async function preprocessForOcr(fileOrCanvas) {
  let width;
  let height;
  let draw;

  if (fileOrCanvas instanceof HTMLCanvasElement) {
    width = fileOrCanvas.width;
    height = fileOrCanvas.height;
    draw = (ctx, tw, th) => ctx.drawImage(fileOrCanvas, 0, 0, tw, th);
  } else {
    const img = await loadImageElement(fileOrCanvas);
    width = img.naturalWidth || img.width;
    height = img.naturalHeight || img.height;
    draw = (ctx, tw, th) => ctx.drawImage(img, 0, 0, tw, th);
  }

  // Target long edge ~2200px for invoice OCR
  const long = Math.max(width, height);
  const scale = long < 1400 ? 2.6 : long < 2000 ? 1.8 : long < 2800 ? 1.35 : 1;
  const tw = Math.round(width * scale);
  const th = Math.round(height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = tw;
  canvas.height = th;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, tw, th);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  draw(ctx, tw, th);

  const imageData = ctx.getImageData(0, 0, tw, th);
  const d = imageData.data;
  // grayscale + mild contrast stretch
  for (let i = 0; i < d.length; i += 4) {
    const g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    const stretched = Math.min(255, Math.max(0, (g - 28) * 1.35));
    d[i] = d[i + 1] = d[i + 2] = stretched;
  }
  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

async function ocrCanvas(canvas, { psm = '6' } = {}) {
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('eng');
  try {
    await worker.setParameters({
      tessedit_pageseg_mode: psm,
      preserve_interword_spaces: '1',
      tessedit_char_whitelist:
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789/.-:%()#,+&' ",
    });
    const {
      data: { text },
    } = await worker.recognize(canvas);
    return String(text || '').trim();
  } finally {
    await worker.terminate();
  }
}

function scoreOcrText(text) {
  const t = String(text || '');
  let score = 0;
  if (/GSTIN|TAX\s*INVOICE|INVOICE/i.test(t)) score += 3;
  if (/\b\d{2}[A-Z0-9]{13}\b/i.test(t)) score += 3;
  if (/HSN|CGST|SGST|IGST|TAXABLE|NET\s*AMOUNT/i.test(t)) score += 2;
  if (/\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}/.test(t)) score += 1;
  if (/\d+\.\d{2,3}/.test(t)) score += 1;
  score += Math.min(4, Math.floor(t.length / 200));
  return score;
}

async function ocrImageSource(source, onProgress) {
  onProgress?.('Enhancing bill image…');
  const canvas =
    source instanceof HTMLCanvasElement ? source : await preprocessForOcr(source);

  onProgress?.('Reading bill (OCR pass 1)…');
  let best = await ocrCanvas(canvas, { psm: '6' });
  let bestScore = scoreOcrText(best);

  // Second pass if weak — sparse text mode often catches table cells better
  if (bestScore < 6) {
    onProgress?.('Reading bill (OCR pass 2)…');
    const alt = await ocrCanvas(canvas, { psm: '4' });
    const altScore = scoreOcrText(alt);
    if (altScore > bestScore || (altScore === bestScore && alt.length > best.length)) {
      best = alt;
      bestScore = altScore;
    }
  }

  // Third pass without charset whitelist if still weak
  if (bestScore < 5) {
    onProgress?.('Reading bill (OCR pass 3)…');
    const { createWorker } = await import('tesseract.js');
    const worker = await createWorker('eng');
    try {
      await worker.setParameters({ tessedit_pageseg_mode: '3' });
      const {
        data: { text },
      } = await worker.recognize(canvas);
      const alt = String(text || '').trim();
      if (scoreOcrText(alt) > bestScore) best = alt;
    } finally {
      await worker.terminate();
    }
  }

  return best;
}

async function extractPdfText(file, onProgress) {
  const pdfjs = await import('pdfjs-dist');
  try {
    const workerMod = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
    pdfjs.GlobalWorkerOptions.workerSrc = workerMod.default;
  } catch {
    pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version || '4.10.38'}/build/pdf.worker.min.mjs`;
  }
  const buf = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buf }).promise;
  const maxPages = Math.min(doc.numPages, 3);
  const chunks = [];
  for (let i = 1; i <= maxPages; i += 1) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items.map((it) => it.str).join(' ');
    chunks.push(pageText);
  }
  const text = chunks.join('\n').trim();
  if (scoreOcrText(text) >= 5 || text.length >= 80) return text;

  // Scanned PDF — rasterize first page and OCR
  onProgress?.('Scanned PDF — running OCR…');
  const page = await doc.getPage(1);
  const viewport = page.getViewport({ scale: 2.4 });
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext('2d');
  await page.render({ canvasContext: ctx, viewport }).promise;
  const prep = await preprocessForOcr(canvas);
  return ocrImageSource(prep, onProgress);
}

/**
 * @param {File} file
 * @param {(msg: string) => void} [onProgress]
 */
export async function extractBillText(file, onProgress) {
  if (!file) throw new Error('No file selected');
  const type = file.type || '';
  const name = (file.name || '').toLowerCase();

  if (type.startsWith('image/') || /\.(jpe?g|png|webp|bmp|gif)$/i.test(name)) {
    return ocrImageSource(file, onProgress);
  }

  if (type === 'application/pdf' || name.endsWith('.pdf')) {
    onProgress?.('Reading PDF…');
    return extractPdfText(file, onProgress);
  }

  throw new Error('Upload a PDF or image (JPG/PNG) of the supplier bill');
}

export async function fileToDataUrl(file, maxBytes = 800_000) {
  if (!file || file.size > maxBytes) return null;
  if (!String(file.type || '').startsWith('image/')) return null;
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.readAsDataURL(file);
  });
}
