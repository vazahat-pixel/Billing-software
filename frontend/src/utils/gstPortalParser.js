import * as XLSX from 'xlsx';

/**
 * Browser-side GST portal Excel / JSON parsers matching JSM's btn_brow_Click logic
 * for GSTR-1 Matching (Excel + JSON), GSTR-2A / 2B Matching, and GSTR-4A Matching.
 */
const num = (v) => Number(String(v ?? 0).replace(/,/g, '')) || 0;
const str = (v) => String(v ?? '').trim();

function parsePortalDate(v) {
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v.toISOString().slice(0, 10);
  if (typeof v === 'number' && v > 20000) {
    const d = new Date(Date.UTC(1899, 11, 30) + v * 86400000);
    return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
  }
  const s = str(v);
  if (!s) return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const MON = { jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12' };
  const m1 = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})/);
  if (m1) {
    const y = m1[3].length === 2 ? `20${m1[3]}` : m1[3];
    return `${y}-${m1[2].padStart(2, '0')}-${m1[1].padStart(2, '0')}`;
  }
  const m2 = s.match(/^(\d{1,2})[-/]([a-zA-Z]{3})[-/](\d{2,4})/);
  if (m2 && MON[m2[2].toLowerCase()]) {
    const y = m2[3].length === 2 ? `20${m2[3]}` : m2[3];
    return `${y}-${MON[m2[2].toLowerCase()]}-${m2[1].padStart(2, '0')}`;
  }
  return '';
}

function sheetRowsWithHeader(wb, names, headerMatcher) {
  for (const name of wb.SheetNames) {
    if (!names.some((n) => n.toLowerCase() === name.toLowerCase())) continue;
    const aoa = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: '' });
    const hIdx = aoa.findIndex((r) => headerMatcher(r.map((c) => str(c).toLowerCase())));
    if (hIdx < 0) continue;
    const hdr = aoa[hIdx].map((c) => str(c));
    const out = [];
    for (let i = hIdx + 1; i < aoa.length; i++) {
      const r = aoa[i];
      if (!r || !r.some((c) => str(c) !== '')) continue;
      if (str(r[0]).toLowerCase().includes('total')) continue;
      const obj = {};
      hdr.forEach((h, k) => { if (h) obj[h] = r[k]; });
      out.push({ sheet: name, obj, raw: r });
    }
    return { sheet: name, rows: out };
  }
  return null;
}

const pick = (obj, ...keys) => {
  const lower = Object.fromEntries(Object.entries(obj).map(([k, v]) => [k.toLowerCase().replace(/[^a-z0-9]/g, ''), v]));
  for (const k of keys) {
    const nk = k.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (nk in lower && lower[nk] !== '') return lower[nk];
  }
  return '';
};

export function parseGstr1Json(text) {
  const json = typeof text === 'string' ? JSON.parse(text) : text;
  const rows = [];
  for (const party of json.b2b || []) {
    const ctin = str(party.ctin);
    for (const inv of party.inv || []) {
      const itms = inv.itms || [];
      let txval = 0; let iamt = 0; let camt = 0; let samt = 0; let rate = 0;
      for (const it of itms) {
        const d = it.itm_det || it;
        txval += num(d.txval);
        iamt += num(d.iamt);
        camt += num(d.camt);
        samt += num(d.samt);
        rate = rate || num(d.rt);
      }
      rows.push({
        GSTIN_NO: ctin, AC_NAME: '', INV_NO: str(inv.inum), INV_DT: parsePortalDate(inv.idt),
        INV_AMT: num(inv.val), TAX_AMT: txval, IGST: iamt, CGST: camt, SGST: samt, GST_PER: rate, SL_TYPE: 'B2B',
      });
    }
  }
  for (const party of json.cdnr || []) {
    const ctin = str(party.ctin);
    for (const nt of party.nt || []) {
      let txval = 0; let iamt = 0; let camt = 0; let samt = 0; let rate = 0;
      for (const it of nt.itms || []) {
        const d = it.itm_det || it;
        txval += num(d.txval);
        iamt += num(d.iamt);
        camt += num(d.camt);
        samt += num(d.samt);
        rate = rate || num(d.rt);
      }
      rows.push({
        GSTIN_NO: ctin, AC_NAME: '', INV_NO: str(nt.nt_num || nt.ntnum), INV_DT: parsePortalDate(nt.nt_dt),
        INV_AMT: num(nt.val), TAX_AMT: txval, IGST: iamt, CGST: camt, SGST: samt, GST_PER: rate, SL_TYPE: 'CDNR',
      });
    }
  }
  return rows;
}

export function parseGstr1Excel(data) {
  const wb = XLSX.read(data);
  const rows = [];
  const b2b = sheetRowsWithHeader(wb, ['b2b, sez, de', 'b2b,sez,de', 'b2b'], (h) => h.some((c) => c.includes('gstin')) && h.some((c) => c.includes('invoice')));
  if (b2b) {
    for (const { obj } of b2b.rows) {
      const gstin = str(pick(obj, 'GSTIN/UIN of Recipient', 'GSTIN'));
      const invNo = str(pick(obj, 'Invoice Number', 'Invoice No'));
      if (!gstin || !invNo) continue;
      rows.push({
        GSTIN_NO: gstin, AC_NAME: str(pick(obj, 'Receiver Name', 'Trade/Legal name')),
        INV_NO: invNo, INV_DT: parsePortalDate(pick(obj, 'Invoice date', 'Invoice Date')),
        INV_AMT: num(pick(obj, 'Invoice Value')), TAX_AMT: num(pick(obj, 'Taxable Value')),
        IGST: num(pick(obj, 'Integrated Tax', 'IGST')), CGST: num(pick(obj, 'Central Tax', 'CGST')), SGST: num(pick(obj, 'State/UT Tax', 'SGST')),
        GST_PER: num(pick(obj, 'Rate')), SL_TYPE: 'B2B',
      });
    }
  }
  const cdnr = sheetRowsWithHeader(wb, ['cdnr'], (h) => h.some((c) => c.includes('gstin')) && h.some((c) => c.includes('note')));
  if (cdnr) {
    for (const { obj } of cdnr.rows) {
      const gstin = str(pick(obj, 'GSTIN/UIN of Recipient', 'GSTIN'));
      const invNo = str(pick(obj, 'Note Number', 'Note/Refund Voucher Number'));
      if (!gstin || !invNo) continue;
      rows.push({
        GSTIN_NO: gstin, AC_NAME: str(pick(obj, 'Receiver Name')),
        INV_NO: invNo, INV_DT: parsePortalDate(pick(obj, 'Note Date', 'Note/Refund Voucher Date')),
        INV_AMT: num(pick(obj, 'Note Value')), TAX_AMT: num(pick(obj, 'Taxable Value')),
        IGST: num(pick(obj, 'Integrated Tax', 'IGST')), CGST: num(pick(obj, 'Central Tax', 'CGST')), SGST: num(pick(obj, 'State/UT Tax', 'SGST')),
        GST_PER: num(pick(obj, 'Rate')), SL_TYPE: 'CDNR',
      });
    }
  }
  return rows;
}

export function parseGstr2bExcel(data) {
  const wb = XLSX.read(data);
  const rows = [];
  const parseSheet = (sheetCandidates, slType, prefix) => {
    const res = sheetRowsWithHeader(wb, sheetCandidates, (h) => h.some((c) => c.includes('gstin')) && h.some((c) => c.includes('invoice') || c.includes('note')));
    if (!res) return;
    for (const { obj } of res.rows) {
      const gstin = str(pick(obj, 'GSTIN of supplier', 'GSTIN/UIN of Supplier', 'GSTIN'));
      const invNo = str(pick(obj, 'Invoice number', 'Invoice Number', 'Note number', 'Note Number'));
      if (!gstin || !invNo) continue;
      rows.push({
        GSTIN_NO: gstin,
        AC_NAME: str(pick(obj, 'Trade/Legal name', 'Trade Name', 'Supplier Name')),
        INV_NO: invNo,
        XINV_NO: `${prefix}-${invNo}`,
        INV_DT: parsePortalDate(pick(obj, 'Invoice Date', 'Invoice date', 'Note date', 'Note Date')),
        INV_AMT: num(pick(obj, 'Invoice Value', 'Note Value')),
        TAX_AMT: num(pick(obj, 'Taxable Value')),
        IGST: num(pick(obj, 'Integrated Tax', 'IGST')),
        CGST: num(pick(obj, 'Central Tax', 'CGST')),
        SGST: num(pick(obj, 'State/UT Tax', 'SGST')),
        GST_PER: num(pick(obj, 'Rate')),
        SL_TYPE: slType,
      });
    }
  };
  parseSheet(['B2B', 'GSTR4A', 'Sheet1'], 'B2B', 'PU');
  parseSheet(['B2BA'], 'B2BA', 'PU');
  parseSheet(['B2B-CDNR', 'CDNR'], 'CDNR', 'DN');
  return rows;
}

