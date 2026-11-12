import { toIsoDate } from '../winforms.js';

const N = (field, caption, dec = 2, len = 12) => ({ field, caption, kind: 'N', dec, total: true, len });

const G3B_COLS = [
  { field: 'HEAD', caption: 'GSTR-3B TABLE HEAD', kind: 'C', len: 30 },
  { field: 'BOOK', caption: 'BOOK / STATE', kind: 'C', len: 22 },
  N('TAXABLE_AMT', 'TAXABLE VALUE', 2, 14),
  N('IGST_AMT', 'IGST'),
  N('CGST_AMT', 'CGST'),
  N('SGST_AMT', 'SGST'),
  N('CESS_AMT', 'CESS', 2, 10),
  N('NET_TOT', 'TOTAL', 2, 14),
];

export const GST_NATIVE_TOOLS = [
  {
    form: 'Hsn_Wise_Report_All',
    runButtons: ['Btn_LoadData'],
    excelButtons: ['btn_excel_data'],
    lists: {},
    defaults: ({ fyFrom, fyTo }) => ({ txt_dt_from: fyFrom, txt_dt_to: fyTo }),
    toParams: (s) => ({ from: toIsoDate(s.txt_dt_from), to: toIsoDate(s.txt_dt_to), fromText: s.txt_dt_from, toText: s.txt_dt_to }),
    fallbackColumns: {
      JSM_VW_HSN_WISE_REPORT_ALL: [
        { field: 'SOURCE', caption: 'SIDE', kind: 'C', len: 16 },
        { field: 'HSN_CODE', caption: 'HSN CODE', kind: 'C', len: 11 },
        { field: 'DESCRIPTION', caption: 'ITEM DESCRIPTION', kind: 'C', len: 24 },
        { field: 'UQC', caption: 'UQC', kind: 'C', len: 8 },
        N('IT_PCS', 'PCS', 0, 8),
        N('IT_QTY', 'QTY', 2, 11),
        N('TAXABLE_AMT', 'TAXABLE VALUE', 2, 14),
        N('IGST_AMT', 'IGST'),
        N('CGST_AMT', 'CGST'),
        N('SGST_AMT', 'SGST'),
        N('NET_TOT', 'TOTAL VALUE', 2, 14),
      ],
    },
  },
  {
    form: 'Stp_Gst_OutWrad_ErrorCheck',
    runButtons: ['btn_hsncd', 'Btn_GstinFreeItem', 'Btn_StateCd', 'Btn_CheckGst_Reg', 'Btn_CheckGst_UnReg'],
    lists: {},
    defaults: ({ fyFrom, fyTo }) => ({ txt_dt_from: fyFrom, txt_dt_to: fyTo }),
    toParams: (s, btnName) => ({
      from: toIsoDate(s.txt_dt_from), to: toIsoDate(s.txt_dt_to),
      fromText: s.txt_dt_from, toText: s.txt_dt_to,
      action: btnName || 'All',
    }),
    fallbackColumns: {
      JSM_VW_OUTWARD_ERROR_CHECK: [
        { field: 'ERROR_TYPE', caption: 'ERROR TYPE', kind: 'C', len: 18 },
        { field: 'TRANS_TYPE', caption: 'TYPE', kind: 'C', len: 10 },
        { field: 'BILL_DATE', caption: 'BILL DT', kind: 'D', len: 10 },
        { field: 'NCBILL_NO', caption: 'BILL NO', kind: 'C', len: 11 },
        { field: 'PARTY', caption: 'PARTY', kind: 'C', len: 24 },
        { field: 'GST_NO', caption: 'GSTIN', kind: 'C', len: 16 },
        N('TAXABLE_AMT', 'TAXABLE'),
        N('GST_AMT', 'GST AMT', 2, 10),
        N('NET_TOT', 'NET AMT'),
      ],
    },
  },
  {
    form: 'Gstr_3B_TextNew_Monthly',
    runButtons: ['btn_screen'],
    excelButtons: ['Btn_Excel'],
    exitButtons: ['Btn_Exit'],
    lists: {},
    defaults: ({ fyFrom, fyTo }) => ({ txt_dt_from: fyFrom, txt_dt_to: fyTo, Chk_WithRcm: false }),
    toParams: (s) => ({ from: toIsoDate(s.txt_dt_from), to: toIsoDate(s.txt_dt_to), fromText: s.txt_dt_from, toText: s.txt_dt_to, withRcm: Boolean(s.Chk_WithRcm) }),
    fallbackColumns: { JSM_VW_GSTR3B_MONTHLY: G3B_COLS },
  },
  {
    form: 'Gstr_3BB_TextNew_Excel_Monthly',
    runButtons: ['btn_screen'],
    excelButtons: ['Btn_Excel'],
    exitButtons: ['Btn_Exit'],
    lists: {},
    defaults: ({ fyFrom, fyTo }) => ({ txt_dt_from: fyFrom, txt_dt_to: fyTo }),
    toParams: (s) => ({ from: toIsoDate(s.txt_dt_from), to: toIsoDate(s.txt_dt_to), fromText: s.txt_dt_from, toText: s.txt_dt_to }),
    fallbackColumns: { JSM_VW_GSTR3B_MONTHLY_EXCEL: G3B_COLS },
  },
  {
    form: 'A_Brokreg_Main_Rpt_Zoom_Column',
    lists: { ListView_Broker: 'brokers', ListView_Party: 'parties', ListView_Book: 'books' },
    defaults: ({ fyFrom, fyTo }) => ({ txt_dt_from: fyFrom, txt_dt_to: fyTo, txt_CommissionPer: '2.00', txt_TdsPer: '0.00' }),
    toParams: (s) => ({
      from: toIsoDate(s.txt_dt_from), to: toIsoDate(s.txt_dt_to), fromText: s.txt_dt_from, toText: s.txt_dt_to,
      commissionPer: Number(s.txt_CommissionPer || 2), tdsPer: Number(s.txt_TdsPer || 0),
      brokers: s.ListView_Broker || [], parties: s.ListView_Party || [], books: s.ListView_Book || [],
    }),
    fallbackColumns: {
      JSM_VW_GST_JOBWORK_BROK_ZOOM_REPORT: [
        { field: 'BILL_DATE', caption: 'BILL.DT', kind: 'D', len: 10 },
        { field: 'NCBILL_NO', caption: 'BILL.NO', kind: 'C', len: 10 },
        { field: 'PARTY', caption: 'PARTY', kind: 'C', len: 24 },
        N('BILL_AMT', 'BILL.AMT'), N('TAXABLE_AMT', 'TAXABLE'), N('PAID_AMT', 'PAID.AMT'),
        N('BROKREG_AMT', 'BROKREG'), N('TDS_AMT', 'TDS', 2, 10), N('NET_BROKREG', 'NET.BROK'),
      ],
    },
  },
  // JSM_VW_ALL_EWB_EINV_REPORT_MAIN is CAPTURED in layouts.json — no fallbackColumns!
  {
    form: 'A_All_Ewb_Einv_Rpt',
    lists: { ListView0: 'books', ListView1: 'parties' },
    defaults: ({ fyFrom, fyTo }) => ({ txt_dt_from: fyFrom, txt_dt_to: fyTo }),
    toParams: (s) => ({
      from: toIsoDate(s.txt_dt_from), to: toIsoDate(s.txt_dt_to), fromText: s.txt_dt_from, toText: s.txt_dt_to,
      books: s.ListView0 || [], parties: s.ListView1 || [],
    }),
  },
];
