import { toIsoDate } from '../winforms.js';

const N = (field, caption, len = 12, dec = 2) => ({ field, caption, kind: 'N', dec, total: true, len });

export default {
  form: 'Rpt_BrokregReport',
  lists: {
    ListView1: 'brokers',
    ListView2: 'parties',
  },
  defaults: ({ fyFrom, fyTo }) => ({
    txt_dt_from: fyFrom,
    txt_dt_to: fyTo,
    Cbo_Status: 'Pending',
    Cbo_OrderBy1: 'Broker',
    Cbo_OrderBy2: 'None',
    cbo_printout: '1-Continue',
    CheckBox_LastYear: true,
  }),
  overrides: () => ({
    Cbo_Status: { items: ['Pending', 'Clear', 'All'] },
    Cbo_OrderBy1: { items: ['Broker', 'Party', 'None'] },
    Cbo_OrderBy2: { items: ['None', 'Broker', 'Party'] },
    cbo_printout: { items: ['1-Continue', '2-PageWise'] },
  }),
  toParams: (s) => ({
    from: toIsoDate(s.txt_dt_from),
    to: toIsoDate(s.txt_dt_to),
    fromText: s.txt_dt_from,
    toText: s.txt_dt_to,
    status: s.Cbo_Status || 'Pending',
    orderBy1: s.Cbo_OrderBy1 || 'Broker',
    orderBy2: s.Cbo_OrderBy2 || 'None',
    printout: s.cbo_printout || '1-Continue',
    includeLastYear: Boolean(s.CheckBox_LastYear),
    brokers: s.ListView1 || [],
    parties: s.ListView2 || [],
  }),
  fallbackColumns: {
    JSM_VW_BROKREG_OS: [
      { field: 'SRAL_NO', caption: 'SRALNO', kind: 'C', len: 10 },
      { field: 'REC_DATE', caption: 'REC DATE', kind: 'D', len: 10 },
      { field: 'BROKER', caption: 'BROKER', kind: 'C', len: 22 },
      { field: 'PARTY', caption: 'PARTY', kind: 'C', len: 22 },
      { field: 'BOOK', caption: 'BOOK', kind: 'C', len: 16 },
      { field: 'REC_PAY', caption: 'REC/PAY', kind: 'C', len: 8 },
      N('REC_AMT', 'REC.AMT'),
      N('COMMI_PER', 'COMMI%', 9),
      N('COMMI_AMT', 'COMMIAMT'),
      { field: 'EXP_VNO', caption: 'EXP_VNO', kind: 'C', len: 10 },
      { field: 'REMARK_1', caption: 'REMARK 1', kind: 'C', len: 20 },
      { field: 'OS_DAYS', caption: 'DUE.DYS', kind: 'N', dec: 0, total: false, len: 8 },
    ],
  },
};

