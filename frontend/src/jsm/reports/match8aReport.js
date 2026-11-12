import { toIsoDate } from '../winforms.js';
import { parseGstr2bExcel } from '../../utils/gstPortalParser.js';

const N = (field, caption, len = 12) => ({ field, caption, kind: 'N', dec: 2, total: true, len });

export default {
  form: 'Rpt_Match8A_Report',
  browseButtons: ['btn_brow'],
  browseAccept: '.xlsx,.xlsm,.xls',
  onBrowseFile: async (file) => {
    const portalRows = parseGstr2bExcel(await file.arrayBuffer());
    return { txt_brows: `${file.name} (${portalRows.length} rows)`, __portalRows: portalRows };
  },
  lists: {},
  defaults: ({ fyFrom, fyTo }) => ({
    txt_dt_from: fyFrom,
    txt_dt_to: fyTo,
    Cbo_ExcelFormatType: 'Portal Excel (.xlsx)',
    Cbo_Status: 'ALL',
    Cbo_OrderBy1: 'GstNo',
    txt_brows: '',
    CheckBox_RemoveChar: false,
    chk_summary_rpt: false,
  }),
  overrides: () => ({
    Cbo_Status: { items: ['ALL', 'MATCH', 'MATCH AMT DIFF', 'ABSENT IN 8A', 'ABSENT IN JSM'] },
    Cbo_OrderBy1: { items: ['GstNo', 'Party', 'Book'] },
  }),
  toParams: (s) => ({
    from: toIsoDate(s.txt_dt_from),
    to: toIsoDate(s.txt_dt_to),
    fromText: s.txt_dt_from,
    toText: s.txt_dt_to,
    status: s.Cbo_Status || 'ALL',
    groupBy1: s.Cbo_OrderBy1 || 'GstNo',
    removeChar: Boolean(s.CheckBox_RemoveChar),
    summary: Boolean(s.chk_summary_rpt),
    portalRows: s.__portalRows || [],
  }),
  fallbackColumns: {
    JSM_VW_MATCH8A: [
      { field: 'GSTIN_No', caption: 'GSTIN', kind: 'C', len: 16 },
      { field: 'Party', caption: 'PARTY', kind: 'C', len: 22 },
      { field: 'Jsm_BillNO', caption: 'BOOKS BILLNO', kind: 'C', len: 12 },
      { field: 'A8_BillNo', caption: '8A BILLNO', kind: 'C', len: 12 },
      { field: 'Jsm_Bill_Date', caption: 'BILL DATE', kind: 'D', len: 10 },
      N('Jsm_Bill_Amt', 'BOOKS AMT'),
      N('A8_Bill_Amt', '8A AMT'),
      N('Jsm_Taxable_Amt', 'BOOKS TAXABLE'),
      N('A8_Taxable_Amt', '8A TAXABLE'),
      N('A8_Igst', '8A IGST', 10),
      N('A8_Sgst', '8A SGST', 10),
      N('A8_Cgst', '8A CGST', 10),
      { field: 'STATUS', caption: 'STATUS', kind: 'C', len: 14 },
    ],
  },
};
