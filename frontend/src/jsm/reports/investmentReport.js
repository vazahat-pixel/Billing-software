import { toIsoDate } from '../winforms.js';

const N = (field, caption, dec = 2, len = 11, total = true) => ({ field, caption, kind: 'N', dec, total, len });

export default {
  form: 'Frm_Investment_Raju',
  lists: {
    ListView0: 'schemes',
    ListView1: 'investors',
    ListView2: 'tranTypes',
    ListView3: 'tranModes',
  },
  defaults: ({ fyFrom, fyTo }) => ({
    txt_dt_from: fyFrom,
    txt_dt_to: fyTo,
    Cbo_OrderBy1: 'Scheme',
    Cbo_OrderBy2: 'None',
    CheckBox_Summary: false,
  }),
  overrides: () => ({
    Cbo_OrderBy1: { items: ['Scheme', 'Investor', 'Tran_Type', 'Tran_Mode', 'None'] },
    Cbo_OrderBy2: { items: ['None', 'Scheme', 'Investor', 'Tran_Type', 'Tran_Mode'] },
  }),
  toParams: (s) => ({
    from: toIsoDate(s.txt_dt_from),
    to: toIsoDate(s.txt_dt_to),
    fromText: s.txt_dt_from,
    toText: s.txt_dt_to,
    orderBy1: s.Cbo_OrderBy1 || 'Scheme',
    orderBy2: s.Cbo_OrderBy2 || 'None',
    summary: Boolean(s.CheckBox_Summary),
    schemes: s.ListView0 || [],
    investors: s.ListView1 || [],
    tranTypes: s.ListView2 || [],
    tranModes: s.ListView3 || [],
  }),
  fallbackColumns: {
    RPT_INVESTMENT_RAJUBHAI: [
      { field: 'FOLIO_NO', caption: 'FOLIO NO', kind: 'C', len: 12 },
      { field: 'SCHEME', caption: 'SCHEME', kind: 'C', len: 24 },
      { field: 'INVESTOR', caption: 'INVESTOR', kind: 'C', len: 18 },
      { field: 'Tran_Type', caption: 'TRAN TYPE', kind: 'C', len: 10 },
      { field: 'Tran_Mode', caption: 'TRAN MODE', kind: 'C', len: 10 },
      { field: 'DATE', caption: 'DATE', kind: 'D', len: 10 },
      N('UNIT', 'UNIT', 3, 10),
      N('NAV', 'NAV', 3, 9, false),
      N('AMOUNT', 'AMOUNT', 2, 12),
      N('CUR_NAV', 'CUR.NAV', 3, 9, false),
      N('CUR_AMOUNT', 'CUR.AMOUNT', 2, 12),
      N('DIV_AMOUNT', 'DIV.AMOUNT', 2, 11),
      N('PROFIT_AMT', 'PROFIT', 2, 11),
      N('LOSS_AMT', 'LOSS', 2, 11),
      { field: 'TRAN_DAYS', caption: 'TRAN.DAYS', kind: 'N', dec: 0, total: false, len: 9 },
    ],
  },
};
