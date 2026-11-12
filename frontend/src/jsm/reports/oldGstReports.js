import { toIsoDate } from '../winforms.js';

const CESS_COLS = [
  { field: 'HEAD', caption: 'SECTION', kind: 'C', len: 28 },
  { field: 'BOOK', caption: 'BOOK / STATE', kind: 'C', len: 26 },
  { field: 'TAXABLE_AMT', caption: 'TAXABLE.VALUE', kind: 'N', dec: 2, total: true, len: 14 },
  { field: 'IGST_AMT', caption: 'IGST', kind: 'N', dec: 2, total: true, len: 12 },
  { field: 'CGST_AMT', caption: 'CGST', kind: 'N', dec: 2, total: true, len: 12 },
  { field: 'SGST_AMT', caption: 'SGST', kind: 'N', dec: 2, total: true, len: 12 },
  { field: 'CESS_AMT', caption: 'CESS', kind: 'N', dec: 2, total: true, len: 10 },
  { field: 'NET_TOT', caption: 'BILL AMT', kind: 'N', dec: 2, total: true, len: 14 },
];

const ZOOM_COLS = [
  { field: 'GRACE_HEAD', caption: 'SECTION', kind: 'C', len: 30 },
  { field: 'BOOK', caption: 'BOOK / STATE', kind: 'C', len: 28 },
  { field: 'TAXABLE_AMT', caption: 'TAXABLE.AMT', kind: 'N', dec: 2, total: true, len: 14 },
  { field: 'IGST_AMT', caption: 'IGST', kind: 'N', dec: 2, total: true, len: 12 },
  { field: 'CGST_AMT', caption: 'CGST', kind: 'N', dec: 2, total: true, len: 12 },
  { field: 'SGST_AMT', caption: 'SGST', kind: 'N', dec: 2, total: true, len: 12 },
];

export const OLD_GST_REPORTS = [
  {
    form: 'Gstr_3B_TextNew_Monthly_Cess',
    lists: {},
    defaults: ({ fyFrom, fyTo }) => ({
      txt_dt_from: fyFrom,
      txt_dt_to: fyTo,
      CheckBox_PR: true,
    }),
    toParams: (s) => ({
      from: toIsoDate(s.txt_dt_from),
      to: toIsoDate(s.txt_dt_to),
      fromText: s.txt_dt_from,
      toText: s.txt_dt_to,
      withPayableRefund: s.CheckBox_PR !== false,
    }),
    runButtons: ['btn_screen'],
    exitButtons: ['Btn_Exit'],
    fallbackColumns: {
      JSM_VW_GSTR3B_CESS: CESS_COLS,
    },
  },
  {
    form: 'Gstr_3BB_Zoomin_Rpt',
    lists: {},
    defaults: ({ fyFrom, fyTo }) => ({
      txt_dt_from: fyFrom,
      txt_dt_to: fyTo,
    }),
    toParams: (s) => ({
      from: toIsoDate(s.txt_dt_from),
      to: toIsoDate(s.txt_dt_to),
      fromText: s.txt_dt_from,
      toText: s.txt_dt_to,
    }),
    runButtons: ['btn_screen'],
    exitButtons: ['Btn_Exit'],
    fallbackColumns: {
      JSM_VW_GSTR_3B_ZOOMIN_RPT: ZOOM_COLS,
    },
  },
];
