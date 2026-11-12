import { toIsoDate } from '../winforms.js';
import { downloadGstr9TemplateWorkbook } from '../../utils/gstr9TemplateExport.js';

const N = (field, caption, len = 13) => ({ field, caption, kind: 'N', dec: 2, total: true, len });
const COLUMNS = [
  { field: 'BOOK', caption: 'BOOK / TYPE', kind: 'C', len: 16 },
  { field: 'MONTH_NAME', caption: 'MONTH', kind: 'C', len: 11 },
  { field: 'TYPE', caption: 'TYPE', kind: 'C', len: 14 },
  { field: 'HSN_CODE', caption: 'HSN CODE', kind: 'C', len: 10 },
  { field: 'QUC', caption: 'QUC', kind: 'C', len: 6 },
  N('NET_QTY', 'NET QTY', 11),
  { field: 'TAX_RATE', caption: 'TAX RATE', kind: 'N', dec: 2, len: 8 },
  N('TAXABLE_AMT', 'TAXABLE AMT'),
  N('IGST_AMT', 'IGST AMT', 11),
  N('CGST_AMT', 'CGST AMT', 11),
  N('SGST_AMT', 'SGST AMT', 11),
  N('CESS', 'CESS', 9),
  N('NET_TOT', 'NET AMT'),
  N('NET_AMOUNT', 'NET AMOUNT'),
];

export default {
  form: 'xOld_Rpt_Jsm_GSTR9_All_Excel_Report',
  runButtons: ['Btn_LoadData'],
  excelButtons: ['Js1_Button1'],
  onExcel: (result, state, companyName) => {
    downloadGstr9TemplateWorkbook(result?.rows || [], 'gstr9c', companyName || state?.companyName);
  },
  lists: {},
  defaults: ({ fyFrom, fyTo }) => ({ txt_dt_from: fyFrom, txt_dt_to: fyTo, RdBtn_UnitWise: true }),
  toParams: (s) => ({
    from: toIsoDate(s.txt_dt_from),
    to: toIsoDate(s.txt_dt_to),
    fromText: s.txt_dt_from,
    toText: s.txt_dt_to,
  }),
  fallbackColumns: { JSM_VW_GSTR9C_OLD: COLUMNS },
};
