import { toIsoDate } from '../winforms.js';

export default {
  form: 'GstFilingFreezeData',
  method: 'POST',
  runButtons: ['Btn_Freeze_Data'],
  exitButtons: ['Btn_Exit'],
  lists: {},
  defaults: ({ fyFrom, fyTo }) => ({
    txt_dt_from: fyFrom,
    txt_dt_to: fyTo,
    Cbo_Month: fyFrom ? toIsoDate(fyFrom).slice(0, 7) : '',
  }),
  overrides: () => {
    const months = [];
    const now = new Date();
    for (let i = -12; i <= 3; i += 1) {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + i, 1));
      months.push(d.toISOString().slice(0, 7));
    }
    return { Cbo_Month: { items: months } };
  },
  toParams: (s, btnName) => ({
    from: toIsoDate(s.txt_dt_from),
    to: toIsoDate(s.txt_dt_to),
    month: s.Cbo_Month || '',
    action: btnName || '',
  }),
  fallbackColumns: {
    JSM_VW_GST_FREEZE_DATA: [
      { field: 'MONTH', caption: 'MONTH', kind: 'C', len: 10 },
      { field: 'FROM_DATE', caption: 'FROM DATE', kind: 'D', len: 11 },
      { field: 'TO_DATE', caption: 'TO DATE', kind: 'D', len: 11 },
      { field: 'FREEZE', caption: 'FREEZE', kind: 'C', len: 8 },
      { field: 'STATUS', caption: 'STATUS', kind: 'C', len: 10 },
      { field: 'GSTR1_STATUS', caption: 'GSTR-1', kind: 'C', len: 10 },
      { field: 'GSTR3B_STATUS', caption: 'GSTR-3B', kind: 'C', len: 10 },
      { field: 'LAST_UPDATE', caption: 'UPDATED AT', kind: 'D', len: 12 },
    ],
  },
};
