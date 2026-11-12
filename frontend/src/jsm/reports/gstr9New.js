import * as XLSX from 'xlsx';
import { toIsoDate } from '../winforms.js';

const N = (field, caption, len = 12) => ({ field, caption, kind: 'N', dec: 2, total: true, len });

function exportGstr9NewExcel(result, state, companyName) {
  const wb = XLSX.utils.book_new();
  const bySheet = {};
  for (const r of result?.rows || []) {
    (bySheet[r.SHEET || 'Data'] ||= []).push(r);
  }
  const names = Object.keys(bySheet);
  if (!names.length) names.push('SalesMonth');
  for (const s of names) {
    const ws = XLSX.utils.json_to_sheet(bySheet[s] || []);
    XLSX.utils.book_append_sheet(wb, ws, s.slice(0, 31));
  }
  const safe = String(companyName || 'Company').replace(/[^\w ]+/g, '').trim() || 'Company';
  XLSX.writeFile(wb, `${safe}_GSTR_9New_${state?.txt_dt_from || ''}.xlsx`);
}

export default {
  form: 'Rpt_Jsm_GSTR9_New',
  runButtons: ['Btn_LoadData'],
  excelButtons: ['Btn_Excel'],
  onExcel: exportGstr9NewExcel,
  lists: {},
  defaults: ({ fyFrom, fyTo }) => ({ txt_dt_from: fyFrom, txt_dt_to: fyTo }),
  toParams: (s) => ({
    from: toIsoDate(s.txt_dt_from),
    to: toIsoDate(s.txt_dt_to),
    fromText: s.txt_dt_from,
    toText: s.txt_dt_to,
  }),
  fallbackColumns: {
    JSM_VW_GSTR9_NEW: [
      { field: 'TYPE', caption: 'TYPE', kind: 'C', len: 18 },
      { field: 'BOOK', caption: 'BOOK', kind: 'C', len: 15 },
      { field: 'MONTH_NAME', caption: 'MONTH', kind: 'C', len: 11 },
      { field: 'GSTIN_NO', caption: 'GSTIN', kind: 'C', len: 16 },
      { field: 'HSN_CODE', caption: 'HSN', kind: 'C', len: 10 },
      { field: 'TOT_GST_P', caption: 'RATE%', kind: 'N', dec: 2, len: 7 },
      N('QTY', 'QTY', 10),
      N('PCS', 'PCS', 8),
      N('KGS', 'KGS', 10),
      N('TAXABLE', 'TAXABLE AMT', 13),
      N('SGST', 'SGST AMT', 11),
      N('CGST', 'CGST AMT', 11),
      N('IGST', 'IGST AMT', 11),
      N('NET_AMT', 'NET AMT', 13),
    ],
  },
};

