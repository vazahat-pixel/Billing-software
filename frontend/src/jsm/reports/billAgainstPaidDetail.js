import { toIsoDate } from '../winforms.js';

const N = (field, caption, len = 12) => ({ field, caption, kind: 'N', dec: 2, total: true, len });

export default {
  form: 'Frm_BillAgistPaidDetail',
  lists: {},
  defaults: ({ fyFrom, fyTo }) => ({ txt_dt_from: fyFrom, txt_dt_to: fyTo }),
  toParams: (s) => ({
    from: toIsoDate(s.txt_dt_from),
    to: toIsoDate(s.txt_dt_to),
    fromText: s.txt_dt_from,
    toText: s.txt_dt_to,
  }),
  fallbackColumns: {
    JSM_VW_BILL_AGAINST_PAID: [
      { field: 'VOU_TYPE', caption: 'TYPE', kind: 'C', len: 9 },
      { field: 'VOU_NO', caption: 'VOU.NO', kind: 'C', len: 10 },
      { field: 'REC_DATE', caption: 'VOU.DATE', kind: 'D', len: 10 },
      { field: 'PARTY', caption: 'PARTY', kind: 'C', len: 24 },
      { field: 'BOOK', caption: 'BANK/CASH', kind: 'C', len: 18 },
      { field: 'NCBILL_NO', caption: 'BILL.NO', kind: 'C', len: 12 },
      { field: 'BILL_DATE', caption: 'BILL.DATE', kind: 'D', len: 10 },
      N('BILL_AMT', 'BILL.AMT'),
      N('ADJUST', 'ADJUST'),
      N('RG_AMT', 'GOODS.RTN'),
      N('DISCOUNT', 'DISCOUNT'),
      N('TDS_AMT', 'TDS'),
      N('CLAIM_AMT', 'CLAIM'),
      N('NET_PAID', 'NET.PAID'),
    ],
  },
};

