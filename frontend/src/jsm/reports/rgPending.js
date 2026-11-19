import { toIsoDate } from '../winforms.js';

/**
 * JSM: Reports › Sales › Sales Bill › Rg Pending (Rpt_Sales_Rg_Pend).
 *
 * A bill-date range, a "Rec Date as on" date, the ticked parties and cities, and the four prints
 * — Normal, Party, Broker, City. All four go through Crystal, so there is no STP_REPORT layout
 * and the columns are the ones JSM's own view selects.
 */
const COLUMNS = [
  { field: 'BILL_DATE', caption: 'BILL.DATE', kind: 'D', len: 10 },
  { field: 'INVOICE', caption: 'BILL.NO', kind: 'C', len: 10 },
  { field: 'PARTY', caption: 'PARTY', kind: 'C', len: 26 },
  { field: 'ST_NAME', caption: 'CITY', kind: 'C', len: 14 },
  { field: 'BROKER', caption: 'BROKER', kind: 'C', len: 18 },
  { field: 'BILL_AMT', caption: 'BILL.AMT', kind: 'N', dec: 2, total: true, len: 13 },
  { field: 'RG_AMT', caption: 'RG.AMT', kind: 'N', dec: 2, total: true, len: 12 },
  { field: 'REC_RG_TOT', caption: 'REC.RG', kind: 'N', dec: 2, total: true, len: 12 },
  { field: 'RG_PEND', caption: 'RG.PEND', kind: 'N', dec: 2, total: true, len: 12 },
  { field: 'REC_DATE', caption: 'REC.DATE', kind: 'D', len: 10 },
  { field: 'DAY', caption: 'DAYS', kind: 'N', dec: 0, len: 7 },
];

export default {
  form: 'Rpt_Sales_Rg_Pend',
  lists: { lst_vw1: 'parties', lst_vw2: 'stations' },
  defaults: ({ fyFrom, fyTo, today }) => ({
    txt_dt_from: fyFrom,
    txt_dt_to: fyTo,
    txt_r_dt1: fyFrom,
    txt_r_dt2: today,
    Rdbtn_B1: true,
  }),
  toParams: (s) => ({
    from: toIsoDate(s.txt_dt_from),
    to: toIsoDate(s.txt_dt_to),
    fromText: s.txt_dt_from,
    toText: s.txt_dt_to,
    asOn: toIsoDate(s.txt_r_dt2),
    asOnText: s.txt_r_dt2,
    category: s.Rdbtn_B4 ? '4-City' : (s.Rdbtn_B3 ? '3-Broker' : (s.Rdbtn_B2 ? '2-Party' : '1-Normal')),
    parties: s.lst_vw1 || [],
    stations: s.lst_vw2 || [],
  }),
  fallbackColumns: { JSM_VW_RG_PEND: COLUMNS },
};
