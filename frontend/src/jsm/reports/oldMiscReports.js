import { toIsoDate } from '../winforms.js';

const BOOK_SLPU_COLS = [
  { field: 'JS_GROUP', caption: 'BOOK', kind: 'C', len: 18 },
  { field: 'BILL_DATE', caption: 'DATE', kind: 'D', len: 11 },
  { field: 'NCBILL_NO', caption: 'INV.NO', kind: 'C', len: 12 },
  { field: 'PARTY', caption: 'NAME OF PARTY', kind: 'C', len: 26 },
  { field: 'GST_NO', caption: 'GSTIN', kind: 'C', len: 16 },
  { field: 'TAXABLE_AMT', caption: 'AMOUNT', kind: 'N', dec: 2, total: true, len: 13 },
  { field: 'VAT_PER', caption: 'TAX%', kind: 'N', dec: 2, len: 7 },
  { field: 'VAT_AMT', caption: 'CGST+SGST', kind: 'N', dec: 2, total: true, len: 12 },
  { field: 'CST_AMT', caption: 'IGST AMT', kind: 'N', dec: 2, total: true, len: 12 },
  { field: 'NET_TOT', caption: 'NET AMOUNT', kind: 'N', dec: 2, total: true, len: 14 },
];

const BOOK_JV_COLS = [
  { field: 'ENT_DATE', caption: 'DATE', kind: 'D', len: 11 },
  { field: 'ENT_NO', caption: 'VOU.NO', kind: 'C', len: 11 },
  { field: 'AC_NAME1', caption: 'DEBIT A/C', kind: 'C', len: 26 },
  { field: 'AC_NAME2', caption: 'CREDIT A/C', kind: 'C', len: 26 },
  { field: 'AMOUNT', caption: 'AMOUNT', kind: 'N', dec: 2, total: true, len: 13 },
  { field: 'REMARK_1', caption: 'REMARK', kind: 'C', len: 26 },
];

const OS_OLD_COLS = [
  { field: 'PARTY', caption: 'PARTY', kind: 'C', len: 26 },
  { field: 'BROKER', caption: 'BROKER', kind: 'C', len: 18 },
  { field: 'STATION', caption: 'CITY', kind: 'C', len: 14 },
  { field: 'BILL_DATE', caption: 'BILL.DT', kind: 'D', len: 11 },
  { field: 'NCBILL_NO', caption: 'BILL.NO', kind: 'C', len: 11 },
  { field: 'BILL_AMT', caption: 'BILL AMT', kind: 'N', dec: 2, total: true, len: 13 },
  { field: 'ADJUST', caption: 'REC AMT', kind: 'N', dec: 2, total: true, len: 13 },
  { field: 'TOT_BALANCE', caption: 'BALANCE', kind: 'N', dec: 2, total: true, len: 13 },
  { field: 'OS_DAY', caption: 'DAYS', kind: 'N', dec: 0, len: 7 },
];

const LIST_OLD_COLS = [
  { field: 'GROUP_NAME', caption: 'GROUP', kind: 'C', len: 20 },
  { field: 'NAME', caption: 'NAME', kind: 'C', len: 28 },
  { field: 'CITY', caption: 'CITY / UNIT', kind: 'C', len: 14 },
  { field: 'ADDRESS', caption: 'ADDRESS / HSN', kind: 'C', len: 28 },
  { field: 'MOBILE', caption: 'MOBILE', kind: 'C', len: 14 },
  { field: 'GSTIN', caption: 'GSTIN', kind: 'C', len: 17 },
];

export const OLD_MISC_REPORTS = [
  {
    form: 'Rpt_Jsm_SalesPurchaseVat',
    lists: {},
    defaults: ({ fyFrom, fyTo }) => ({
      txt_dt_from: fyFrom,
      txt_dt_to: fyTo,
      Radio_Sales: true,
      cbo_book: '1-All',
    }),
    toParams: (s) => ({
      from: toIsoDate(s.txt_dt_from),
      to: toIsoDate(s.txt_dt_to),
      fromText: s.txt_dt_from,
      toText: s.txt_dt_to,
      mode: s.Radio_JvBook ? 'JvBook' : (s.Radio_Purchase ? 'Purchase' : 'Sales'),
    }),
    fallbackColumns: {
      JSM_VW_BOOK_PRINT_SLPU: BOOK_SLPU_COLS,
      JSM_VW_BOOK_PRINT_JV: BOOK_JV_COLS,
    },
  },
  {
    form: 'ZOld_Rpt_Os_Sales',
    lists: { lst_vw2: 'parties', lst_vw3: 'stations', lst_vw1: 'brokers' },
    defaults: ({ fyFrom, fyTo }) => ({
      txt_dt_from: fyFrom,
      txt_dt_to: fyTo,
      txt_r_dt1: fyFrom,
      txt_r_dt2: fyTo,
      Rdbtn_B1: true,
      Rdbtn_C2: true,
      txt_Due_Days: '0',
      txt_1: 'N',
      txt_2: 'N',
      txt_3: 'N',
      txt_4: 'Y',
      txt_5: 'Y',
      txt_6: 'R',
      lst_vw1: [],
      lst_vw2: [],
      lst_vw3: [],
    }),
    toParams: (s) => {
      const cat = s.Rdbtn_Mn_Grp ? 5 : (s.Rdbtn_B4 ? 4 : (s.Rdbtn_B3 ? 3 : (s.Rdbtn_B2 ? 2 : 1)));
      return {
        from: toIsoDate(s.txt_dt_from),
        to: toIsoDate(s.txt_dt_to),
        fromText: s.txt_dt_from,
        toText: s.txt_dt_to,
        recFrom: toIsoDate(s.txt_r_dt1),
        recTo: toIsoDate(s.txt_r_dt2),
        category: cat,
        printout: s.Rdbtn_C1 ? 'Y' : 'X',
        dueDays: Number(s.txt_Due_Days || 0) || 0,
        withOnAc: s.txt_chk_diff || '',
        withLastYear: s.txt_4 || 'Y',
        brokers: s.lst_vw1 || [],
        parties: s.lst_vw2 || [],
        stations: s.lst_vw3 || [],
      };
    },
    fallbackColumns: {
      JSM_VW_OS_SALES_OLD: OS_OLD_COLS,
    },
  },
  {
    form: 'Rpt_Account_List_Print_Old',
    lists: { lst_vw2: 'parties' },
    defaults: () => ({
      Rdbtn_A2: true,
      grp2_List: true,
      txt_copy: '1',
      lst_vw2: [],
    }),
    toParams: (s) => {
      const mode = s.Rdbtn_A6 ? 6 : (s.Rdbtn_A5 ? 5 : (s.Rdbtn_A4 ? 4 : (s.Rdbtn_A3 ? 3 : (s.Rdbtn_A1 ? 1 : 2))));
      const printFormat = s.grp2_Envelope ? 'Envelope' : (s.grp2_Label ? 'Label' : 'List');
      return {
        mode,
        printFormat,
        copies: Number(s.txt_copy || 1) || 1,
        selected: s.lst_vw2 || [],
      };
    },
    fallbackColumns: {
      JSM_VW_LIST_PRINT_OLD: LIST_OLD_COLS,
    },
  },
];
