import * as XLSX from 'xlsx';

async function parseImportFile(file) {
  let raw = [];
  if (file.name.toLowerCase().endsWith('.json')) {
    const p = JSON.parse(await file.text());
    raw = Array.isArray(p) ? p : (p.rows || p.data || []);
  } else {
    const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
    raw = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
  }
  return {
    txt_haste: `${file.name} (${raw.length} rows)`,
    __importRows: raw.map((r) => ({
      NCBILL_NO: r.NCBILL_NO || r.BILL_NO || r.billNo || r['Bill No'] || '',
      GST_NO: r.GST_NO || r.GSTIN || r.gstin || '',
      TAXABLE_AMT: Number(r.TAXABLE_AMT ?? r.taxable ?? r.Taxable ?? 0),
      NET_TOT: Number(r.NET_TOT ?? r.netAmount ?? r['Net Amount'] ?? 0),
    })),
  };
}

export default {
  form: 'Frm_Import_SalesJsm',
  method: 'POST',
  runButtons: ['Btn_Matching', 'Btn_ImportData'],
  exitButtons: ['Btn_Exit'],
  browseButtons: ['Btn_ImportData'],
  browseAccept: '.xlsx,.xls,.csv,.json',
  onBrowseFile: parseImportFile,
  lists: {},
  defaults: () => ({ txt_haste: '', Cbo_Month: '' }),
  toParams: (s, btnName) => ({
    action: btnName || 'Btn_Matching',
    importRows: s.__importRows || [],
  }),
  fallbackColumns: {
    JSM_VW_IMPORT_SALES_MATCH: [
      { field: 'SRC_BILLNO', caption: 'EXT.BILL NO', kind: 'C', len: 12 },
      { field: 'JSM_BILLNO', caption: 'BOOKS BILL NO', kind: 'C', len: 12 },
      { field: 'BILLNO_MATCHING', caption: 'BILL MATCH', kind: 'C', len: 12 },
      { field: 'SRC_GST', caption: 'EXT.GSTIN', kind: 'C', len: 16 },
      { field: 'JSM_GST', caption: 'BOOKS GSTIN', kind: 'C', len: 16 },
      { field: 'GSTNO_MATCHING', caption: 'GST MATCH', kind: 'C', len: 11 },
      { field: 'SRC_TAXABLE', caption: 'EXT.TAXABLE', kind: 'N', dec: 2, total: true, len: 12 },
      { field: 'JSM_TAXABLE', caption: 'BOOKS TAXABLE', kind: 'N', dec: 2, total: true, len: 12 },
      { field: 'TAXABLE_MATCHING', caption: 'TAX MATCH', kind: 'C', len: 11 },
      { field: 'SRC_NET', caption: 'EXT.NET', kind: 'N', dec: 2, total: true, len: 12 },
      { field: 'JSM_NET', caption: 'BOOKS NET', kind: 'N', dec: 2, total: true, len: 12 },
      { field: 'NETTOT_MATCHING', caption: 'NET MATCH', kind: 'C', len: 11 },
    ],
  },
};

