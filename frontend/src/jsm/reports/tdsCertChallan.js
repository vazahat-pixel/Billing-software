import { toIsoDate } from '../winforms.js';

/**
 * JSM: Reports › Tds Reports › Certificate (Rpt_Tds5_Certi) and Tax Challan (Rpt_Tds4_Challan).
 * JSM prints both from Crystal templates; these carry the same figures as a grid.
 */
const N = (field, caption, len = 12) => ({ field, caption, kind: 'N', dec: 2, total: true, len });

const certificate = {
  form: 'Rpt_Tds5_Certi',
  lists: {},
  dynamicLists: (s, o) => ({ lst_vw1: s.Rdbtn_A2 ? (o.heads || []) : (o.parties || []) }),
  runButtons: ['btn_screen', 'btn_print', 'btn_word'],
  defaults: ({ fyFrom, fyTo, today }) => ({ txt_dt_from: fyFrom, txt_dt_to: fyTo, txt_prn_dt: today, Rdbtn_A1: true, Rdbtn_B1: true }),
  toParams: (s) => ({
    from: toIsoDate(s.txt_dt_from), to: toIsoDate(s.txt_dt_to), fromText: s.txt_dt_from, toText: s.txt_dt_to,
    byHead: Boolean(s.Rdbtn_A2), accounts: s.lst_vw1 || [],
  }),
  fallbackColumns: {
    RPT_TDS_CERTIFICATE: [
      { field: 'PARTY', caption: 'PARTY', kind: 'C', len: 24 },
      { field: 'PANNO', caption: 'PAN NO', kind: 'C', len: 11 },
      { field: 'TDSHEAD', caption: 'TDS HEAD', kind: 'C', len: 16 },
      { field: 'MONTH', caption: 'MONTH', kind: 'C', len: 10 },
      { field: 'QUARTER', caption: 'QTR', kind: 'C', len: 4 },
      N('AMOUNT', 'AMOUNT PAID'),
      N('TDS_AMT', 'TDS DEDUCTED'),
    ],
  },
};

const challan = {
  form: 'Rpt_Tds4_Challan',
  lists: {},
  runButtons: ['btn_screen', 'btn_print', 'btn_word'],
  defaults: ({ fyFrom, fyTo }) => ({
    txt_dt_from: fyFrom, txt_dt_to: fyTo, Rdbtn_B1: true, Rdbtn_A1: true, txt_tds_amt: '0.00', txt_penalty: '0.00', txt_int: '0.00',
  }),
  toParams: (s) => ({
    from: toIsoDate(s.txt_dt_from), to: toIsoDate(s.txt_dt_to), fromText: s.txt_dt_from, toText: s.txt_dt_to,
    head: (s.txt_hdname || '').trim(), company: !s.Rdbtn_B2,
    penalty: Number(s.txt_penalty) || 0, interest: Number(s.txt_int) || 0,
    byCheque: Boolean(s.Rdbtn_A2), bank: s.txt_bank || '', chqNo: s.txt_chq_no || '', chqDate: s.txt_ddate || '',
  }),
  fallbackColumns: {
    RPT_TDS_CHALLAN: [
      { field: 'ENT_DATE', caption: 'DATE', kind: 'D', len: 10 },
      { field: 'NCBILL_NO', caption: 'BILL.NO', kind: 'C', len: 10 },
      { field: 'PARTY', caption: 'PARTY', kind: 'C', len: 24 },
      { field: 'PANNO', caption: 'PAN NO', kind: 'C', len: 11 },
      N('AMOUNT', 'AMOUNT'),
      N('TDS_AMT', 'TDS.AMT'),
    ],
  },
};

export const TDS_CERT_CHALLAN = [certificate, challan];
