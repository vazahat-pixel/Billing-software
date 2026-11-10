import { toIsoDate } from '../winforms.js';

/**
 * JSM: Others Reports › Old Reports › Rec/Pay Register › Sales / Purchase / Process / JobWork.
 * Each bill with the money settled against it, Normal / Party Wise / Broker Wise.
 *
 * Columns are the ones JSM's own temp view selects (BILL_DATE, NCBILL_NO, BILL_AMT, REC_DATE,
 * ADJUST, ADD_LESS, SLR_AMT); the printed layouts are Crystal, so there is no STP_REPORT row.
 */
const COLUMNS = [
  { field: 'BILL_DATE', caption: 'BILL.DATE', kind: 'D', len: 10 },
  { field: 'NCBILL_NO', caption: 'BILL.NO', kind: 'C', len: 10 },
  { field: 'PARTY', caption: 'PARTY', kind: 'C', len: 26 },
  { field: 'BILL_AMT', caption: 'BILL.AMT', kind: 'N', dec: 2, total: true, len: 13 },
  { field: 'REC_DATE', caption: 'REC.DATE', kind: 'D', len: 10 },
  { field: 'ADJUST', caption: 'ADJUST', kind: 'N', dec: 2, total: true, len: 13 },
  { field: 'ADD_LESS', caption: 'ADD/LESS', kind: 'N', dec: 2, total: true, len: 12 },
  { field: 'SLR_AMT', caption: 'RTN.AMT', kind: 'N', dec: 2, total: true, len: 12 },
  { field: 'TOT_BALANCE', caption: 'BALANCE', kind: 'N', dec: 2, total: true, len: 13 },
];

/** One column set, under the name of each of the four views JSM builds. */
const FALLBACKS = {
  JSM_VW_SL_RCPT: COLUMNS,
  JSM_VW_PU_RCPT: COLUMNS,
  JSM_VW_PR_RCPT: COLUMNS,
  JSM_VW_JB_RCPT: COLUMNS,
};

const recPay = (form) => ({
  form,
  lists: { ListView0: 'parties', ListView1: 'brokers' },
  defaults: ({ fyFrom, fyTo }) => ({
    txt_dt_from: fyFrom,
    txt_dt_to: fyTo,
    txt_bill_dt_from: fyFrom,
    txt_bill_dt_to: fyTo,
    Rdbtn_B1: true,
  }),
  toParams: (s) => ({
    from: toIsoDate(s.txt_dt_from || s.txt_bill_dt_from),
    to: toIsoDate(s.txt_dt_to || s.txt_bill_dt_to),
    fromText: s.txt_dt_from || s.txt_bill_dt_from,
    toText: s.txt_dt_to || s.txt_bill_dt_to,
    category: s.Rdbtn_B3 ? 3 : s.Rdbtn_B2 ? 2 : 1,
    parties: s.ListView0 || [],
    brokers: s.ListView1 || [],
  }),
  fallbackColumns: FALLBACKS,
});

export const REC_PAY_REGISTERS = [
  recPay('Rpt_1Sales_Receipt_Reg'),
  recPay('Rpt_1Purchase_Payment_Reg'),
  recPay('Rpt_1Process_Payment_Reg'),
  recPay('Rpt_1Job_Payment_Reg'),
];
