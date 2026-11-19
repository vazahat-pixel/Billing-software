import { toIsoDate } from '../winforms.js';
import { downloadGstr9TemplateWorkbook } from '../../utils/gstr9TemplateExport.js';

/**
 * JSM: Reports › Gst Reports › Gstr-9 › Gstr-9 Old (Rpt_Jsm_GSTR9_Excel, "GSTR - 9").
 *
 * JSM's screen is a date range, the unit radio and a Load Data button over a stack of grids, one
 * per working sheet. All the sheets are shown here in one grid, grouped under the sheet's own
 * name; each row uses the columns of its sheet, so the grid carries their union. The columns are
 * the headers of the real GSTR_9.xlsx sheets. The layout is built at run time in JSM.
 */
const N = (field, caption, len = 13) => ({ field, caption, kind: 'N', dec: 2, total: true, len });
const COLUMNS = [
  { field: 'TYPE', caption: 'TYPE', kind: 'C', len: 14 },
  { field: 'BOOK', caption: 'BOOK NAME', kind: 'C', len: 16 },
  { field: 'PARTY', caption: 'PARTY NAME', kind: 'C', len: 22 },
  { field: 'NCBILL_NO', caption: 'NC BILL.NO', kind: 'C', len: 10 },
  { field: 'BILL_DATE', caption: 'BILL.DATE', kind: 'D', len: 10 },
  { field: 'MONTH_NAME', caption: 'MONTH NAME', kind: 'C', len: 11 },
  { field: 'HSN_CODE', caption: 'HSN CODE', kind: 'C', len: 10 },
  { field: 'QUC', caption: 'QUC', kind: 'C', len: 6 },
  N('NET_QTY', 'NET QTY', 11),
  { field: 'TAX_RATE', caption: 'TAX RATE', kind: 'N', dec: 2, len: 8 },
  N('NET_TOT', 'NET TOTAL'),
  N('TAXABLE_AMT', 'TAXABLE AMT'),
  N('IGST_AMT', 'IGST AMT', 11),
  N('CGST_AMT', 'CGST AMT', 11),
  N('SGST_AMT', 'SGST AMT', 11),
  N('CESS_AMT', 'CESS AMT', 10),
  N('BILL_AMOUNT', 'BILL AMOUNT'),
  N('BILL_AMT', 'BILL AMT'),
  N('NET_AMOUNT', 'NET AMOUNT'),
];

export default {
  form: 'Rpt_Jsm_GSTR9_Excel',
  runButtons: ['Btn_LoadData'],
  excelButtons: ['Js1_Button1'],
  onExcel: (result, state, companyName) => {
    downloadGstr9TemplateWorkbook(result?.rows || [], 'gstr9', companyName || state?.companyName);
  },
  lists: {},
  defaults: ({ fyFrom, fyTo }) => ({ txt_dt_from: fyFrom, txt_dt_to: fyTo, RdBtn_UnitWise: true }),
  toParams: (s) => ({
    from: toIsoDate(s.txt_dt_from),
    to: toIsoDate(s.txt_dt_to),
    fromText: s.txt_dt_from,
    toText: s.txt_dt_to,
  }),
  fallbackColumns: { JSM_VW_GSTR9_OLD: COLUMNS },
};
