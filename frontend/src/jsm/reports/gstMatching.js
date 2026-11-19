import { toIsoDate } from '../winforms.js';
import { parseGstr1Excel, parseGstr1Json, parseGstr2bExcel } from '../../utils/gstPortalParser.js';

const N = (field, caption, len = 12) => ({ field, caption, kind: 'N', dec: 2, total: true, len });
const GROUPS = ['GstNo', 'Party', 'Book'];

function fileHandler(parser) {
  return async (file) => {
    if (parser === parseGstr1Json) {
      const portalRows = parseGstr1Json(await file.text());
      return { txt_brows: `${file.name} (${portalRows.length} rows)`, __portalRows: portalRows };
    }
    const buf = await file.arrayBuffer();
    const portalRows = parser(buf);
    return { txt_brows: `${file.name} (${portalRows.length} rows)`, __portalRows: portalRows };
  };
}

const commonMatchToParams = (s) => ({
  from: toIsoDate(s.txt_dt_from),
  to: toIsoDate(s.txt_dt_to),
  fromText: s.txt_dt_from,
  toText: s.txt_dt_to,
  status: s.Cbo_Status || 'ALL',
  groupBy1: s.Cbo_OrderBy1 || 'GstNo',
  summary: Boolean(s.CheckBox_Summary),
  withRcm: Boolean(s.Chk_WithRcm),
  removeChar: Boolean(s.CheckBox_RemoveChar),
  portalRows: s.__portalRows || [],
});

export const GST_MATCHING_REPORTS = [
  {
    form: 'Rpt_Jsm_Gstr1_Match',
    browseButtons: ['btn_brow'],
    browseAccept: '.xlsx,.xlsm,.xls',
    onBrowseFile: fileHandler(parseGstr1Excel),
    lists: {},
    defaults: ({ fyFrom, fyTo }) => ({ txt_dt_from: fyFrom, txt_dt_to: fyTo, Cbo_Status: 'ALL', Cbo_OrderBy1: 'GstNo', txt_brows: '' }),
    overrides: () => ({ Cbo_OrderBy1: { items: GROUPS } }),
    toParams: commonMatchToParams,
    fallbackColumns: {
      RUNTIME_GSTR1_Compare_RPT: [
        { field: 'GSTIN_No', caption: 'Gst.No', kind: 'C', len: 16 },
        { field: 'Party', caption: 'PartyName', kind: 'C', len: 22 },
        { field: 'Jsm_BillNO', caption: 'Jsm.BillNo', kind: 'C', len: 12 },
        { field: 'G1_BillNo', caption: 'GSTR1.BillNo', kind: 'C', len: 12 },
        { field: 'Jsm_Bill_Date', caption: 'Jsm.BillDate', kind: 'D', len: 10 },
        { field: 'G1_Bill_Date', caption: 'GSTR1.BillDate', kind: 'D', len: 10 },
        N('Jsm_Bill_Amt', 'Jsm.BillAmt'), N('G1_Bill_Amt', 'GSTR1.BillAmt'),
        N('Jsm_Taxable_Amt', 'Jsm.TaxableAmt'), N('G1_Taxable_Amt', 'GSTR1.TaxableAmt'),
        N('Jsm_Igst', 'Jsm.Igst', 10), N('G1_Igst', 'Gstr1.Igst', 10),
        N('Jsm_Sgst', 'Jsm.Sgst', 10), N('G1_Sgst', 'Gstr1.Sgst', 10),
        N('Jsm_Cgst', 'Jsm.Cgst', 10), N('G1_Cgst', 'Gstr1.Cgst', 10),
        { field: 'STATUS', caption: 'StatusGst', kind: 'C', len: 14 },
        { field: 'SL_Type', caption: 'SlType', kind: 'C', len: 8 },
      ],
    },
  },
  {
    form: 'Rpt_Jsm_GSTR1_Json_Match',
    runButtons: ['Js1_Button1'],
    exitButtons: ['BtnExit'],
    browseButtons: ['Btn_Browse'],
    browseAccept: '.json,.txt',
    onBrowseFile: fileHandler(parseGstr1Json),
    lists: {},
    defaults: ({ fyFrom, fyTo }) => ({ txt_dt_from: fyFrom, txt_dt_to: fyTo, txt_brows: '' }),
    toParams: commonMatchToParams,
    fallbackColumns: {
      RUNTIME_GSTR1_JSON_MATCH: [
        { field: 'STATUS', caption: 'Status', kind: 'C', len: 16 },
        { field: 'TYPE', caption: 'Type', kind: 'C', len: 7 },
        { field: 'INV_NO', caption: 'GSTR BillNo', kind: 'C', len: 12 },
        { field: 'INV_DATE', caption: 'GSTR Date', kind: 'D', len: 10 },
        N('INV_VALUE', 'GSTR Val'), N('TAXABLE_VAL', 'GSTR Taxable'),
        N('SGST', 'GSTR SGST', 10), N('CGST', 'GSTR CGST', 10), N('IGST', 'GSTR IGST', 10),
        { field: 'NCBILL_NO', caption: 'Sales BillNo', kind: 'C', len: 12 },
        { field: 'BILL_DATE', caption: 'Sales Date', kind: 'D', len: 10 },
        N('NET_TOT', 'Sales Val'), N('TAXABLE_AMT', 'Sales Taxable'),
        N('SGST_AMT', 'Sales SGST', 10), N('CGST_AMT', 'Sales CGST', 10), N('IGST_AMT', 'Sales IGST', 10),
        N('DIFF_NETVALUE', 'Diff Val', 10), N('DIFF_TAXABLE', 'Diff Tax', 10),
      ],
    },
  },
  {
    form: 'Rpt_Match2B_Report',
    browseButtons: ['btn_brow'],
    browseAccept: '.xlsx,.xlsm,.xls',
    onBrowseFile: fileHandler(parseGstr2bExcel),
    lists: {},
    defaults: ({ fyFrom, fyTo }) => ({ txt_dt_from: fyFrom, txt_dt_to: fyTo, Cbo_Status: 'ALL', Cbo_OrderBy1: 'GstNo', CheckBox_Summary: false, Chk_WithRcm: false, txt_brows: '' }),
    overrides: () => ({ Cbo_OrderBy1: { items: GROUPS } }),
    toParams: commonMatchToParams,
  },
  {
    form: 'Rpt_Match2B_x1_ReportNew',
    apiForm: 'Rpt_Match2B_Report',
    blueprintForm: 'Rpt_Match2B_x1_ReportNew',
    browseButtons: ['btn_brow'],
    browseAccept: '.xlsx,.xlsm,.xls',
    onBrowseFile: fileHandler(parseGstr2bExcel),
    lists: {},
    defaults: ({ fyFrom, fyTo }) => ({ txt_dt_from: fyFrom, txt_dt_to: fyTo, Cbo_Status: 'ALL', Cbo_OrderBy1: 'GstNo', CheckBox_Summary: false, Chk_WithRcm: false, txt_brows: '' }),
    overrides: () => ({ Cbo_OrderBy1: { items: GROUPS } }),
    toParams: commonMatchToParams,
  },
  {
    form: 'Rpt_Match2B_Report_Tejas',
    apiForm: 'Rpt_Match2B_Report',
    blueprintForm: 'Rpt_Match2B_Report_Tejas',
    browseButtons: ['btn_NewBrows'],
    browseAccept: '.xlsx,.xlsm,.xls',
    onBrowseFile: fileHandler(parseGstr2bExcel),
    lists: {},
    defaults: ({ fyFrom, fyTo }) => ({ txt_dt_from: fyFrom, txt_dt_to: fyTo, Cbo_Status: 'ALL', Cbo_OrderBy1: 'GstNo', CheckBox_Summary: false, Chk_WithRcm: false, txt_brows: '' }),
    overrides: () => ({ Cbo_OrderBy1: { items: GROUPS } }),
    toParams: commonMatchToParams,
  },
  {
    form: 'Rpt_Match4A_Report_New',
    browseButtons: ['btn_brow'],
    browseAccept: '.xlsx,.xlsm,.xls',
    onBrowseFile: fileHandler(parseGstr2bExcel),
    lists: {},
    defaults: ({ fyFrom, fyTo }) => ({ txt_dt_from: fyFrom, txt_dt_to: fyTo, Cbo_Status: 'ALL', Cbo_OrderBy1: 'GstNo', Chk_WithRcm: false, txt_brows: '' }),
    overrides: () => ({ Cbo_OrderBy1: { items: GROUPS } }),
    toParams: commonMatchToParams,
  },
  {
    form: 'Rpt_Match2A',
    browseButtons: ['btn_brow'],
    browseAccept: '.xlsx,.xlsm,.xls',
    onBrowseFile: fileHandler(parseGstr2bExcel),
    lists: {},
    defaults: ({ fyFrom, fyTo }) => ({ txt_dt_from: fyFrom, txt_dt_to: fyTo, Cbo_Status: 'ALL', Cbo_OrderBy1: 'GstNo', CheckBox_RemoveChar: false, txt_brows: '' }),
    overrides: () => ({ Cbo_OrderBy1: { items: GROUPS } }),
    toParams: commonMatchToParams,
  },
];

