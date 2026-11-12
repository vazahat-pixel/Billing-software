import * as XLSX from 'xlsx';
import { toIsoDate } from '../winforms.js';

const N = (field, caption, len = 12) => ({ field, caption, kind: 'N', dec: 2, total: true, len });

function exportRowsExcel(title, result, state) {
  const rows = result?.rows || [];
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows.map((r) => {
    const out = { ...r };
    delete out._lines;
    return out;
  }));
  XLSX.utils.book_append_sheet(wb, ws, title);
  XLSX.writeFile(wb, `${title}_${state?.txt_dt_from || 'export'}.xlsx`);
}

export const JS_GSTR_REPORTS = [
  {
    form: 'JS_GSTR1_RPT',
    runButtons: ['Btn_ReFresh'],
    excelButtons: ['Btn_Excel'],
    exitButtons: ['btn_exit', 'Btn_Exit'],
    onExcel: (res, st) => exportRowsExcel('JS_GSTR1', res, st),
    lists: {},
    defaults: ({ fyFrom, fyTo }) => ({ txt_dt_from: fyFrom, txt_dt_to: fyTo }),
    toParams: (s) => ({ from: toIsoDate(s.txt_dt_from), to: toIsoDate(s.txt_dt_to), fromText: s.txt_dt_from, toText: s.txt_dt_to }),
    fallbackColumns: {
      JSM_VW_JS_GSTR1_RPT: [
        { field: 'GSTIN_NO', caption: 'GSTIN', kind: 'C', len: 16 },
        { field: 'NCBILL_NO', caption: 'Invoice No', kind: 'C', len: 12 },
        { field: 'BILL_DATE', caption: 'InvoiceDate', kind: 'D', len: 10 },
        { field: 'PARTY', caption: 'Party', kind: 'C', len: 22 },
        N('NETTOT', 'Value', 13),
        { field: 'SGST_P', caption: 'SGST%', kind: 'N', dec: 2, len: 7 },
        N('SGST_A', 'SGSTAmt'),
        { field: 'CGST_P', caption: 'CGST%', kind: 'N', dec: 2, len: 7 },
        N('CGST_A', 'CGSTAmt'),
        { field: 'IGST_P', caption: 'IGST%', kind: 'N', dec: 2, len: 7 },
        N('IGST_A', 'IGSTAmt'),
        N('SUBTOT', 'Taxable Amount', 13),
      ],
    },
  },
  {
    form: 'JS_GSTR2_RPT',
    runButtons: ['Btn_ReFresh'],
    excelButtons: ['Btn_Excel'],
    exitButtons: ['btn_exit', 'Btn_Exit'],
    onExcel: (res, st) => exportRowsExcel('JS_GSTR2', res, st),
    lists: {},
    defaults: ({ fyFrom, fyTo }) => ({ txt_dt_from: fyFrom, txt_dt_to: fyTo }),
    toParams: (s) => ({ from: toIsoDate(s.txt_dt_from), to: toIsoDate(s.txt_dt_to), fromText: s.txt_dt_from, toText: s.txt_dt_to }),
    fallbackColumns: {
      JSM_VW_JS_GSTR2_RPT: [
        { field: 'GSTIN_NO', caption: 'GSTIN', kind: 'C', len: 16 },
        { field: 'NCBILL_NO', caption: 'Invoice No', kind: 'C', len: 12 },
        { field: 'BILL_DATE', caption: 'InvoiceDate', kind: 'D', len: 10 },
        { field: 'PARTY', caption: 'Party', kind: 'C', len: 22 },
        N('NET_TOT', 'Value', 13),
        { field: 'SGST_PER', caption: 'SGST%', kind: 'N', dec: 2, len: 7 },
        N('SGST_AMT', 'SGSTAmt'),
        { field: 'CGST_PER', caption: 'CGST%', kind: 'N', dec: 2, len: 7 },
        N('CGST_AMT', 'CGSTAmt'),
        { field: 'IGST_PER', caption: 'IGST%', kind: 'N', dec: 2, len: 7 },
        N('IGST_AMT', 'IGSTAmt'),
        { field: 'ITC_ELIGIBILITY', caption: 'ITC Eligibility', kind: 'C', len: 14 },
        N('ITC_AVAILABLE', 'ITC Available', 13),
      ],
    },
  },
  {
    form: 'JS_GSTR3_SMRY',
    runButtons: ['Btn_ReFresh'],
    excelButtons: ['Btn_Excel'],
    exitButtons: ['btn_exit', 'Btn_Exit'],
    onExcel: (res, st) => exportRowsExcel('JS_GSTR3_SMRY', res, st),
    lists: {},
    defaults: ({ fyFrom, fyTo }) => ({ txt_dt_from: fyFrom, txt_dt_to: fyTo }),
    toParams: (s) => ({ from: toIsoDate(s.txt_dt_from), to: toIsoDate(s.txt_dt_to), fromText: s.txt_dt_from, toText: s.txt_dt_to }),
    fallbackColumns: {
      JSM_VW_JS_GSTR3_SMRY: [
        { field: 'DETAILS', caption: 'Details', kind: 'C', len: 30 },
        { field: 'GSTIN_NO', caption: 'GSTIN/Reg', kind: 'C', len: 15 },
        N('SUB_TOT', 'Sales/Pur Amt', 14),
        N('IGST_CGST', 'IGST/CGST', 13),
        N('SGST_AMT', 'SGST', 12),
        N('RET_AMT', 'Ret. Amt', 12),
        N('NET_AMT', 'NetAmount', 14),
      ],
    },
  },
];
