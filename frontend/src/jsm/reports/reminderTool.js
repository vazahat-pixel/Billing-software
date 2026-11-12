import { toIsoDate } from '../winforms.js';

function frequencyFrom(s) {
  if (s.Rdo_Daily) return 'Daily';
  if (s.Rdo_Quaterly) return 'Quarterly';
  if (s.Rdo_Yearly) return 'Yearly';
  if (s.Rdo_Half_Yearly) return 'Half Yearly';
  return 'Monthly';
}

export default {
  form: 'FrmReminder_All_Details',
  method: 'POST',
  runButtons: ['btn_Save', 'Btn_Delete', 'btn_New'],
  exitButtons: ['btn_Exit', 'btn_cancel'],
  lists: {},
  defaults: ({ today }) => ({
    TXT_ID: '',
    txt_dt: today,
    txt_desc: '',
    txt_amt: '0',
    txt_b_remind_days: '1',
    CheckBox1: true,
    Rdo_Monthly: true,
  }),
  toParams: (s, btnName) => ({
    action: btnName || 'list',
    id: String(s.TXT_ID || '').trim(),
    date: toIsoDate(s.txt_dt),
    description: s.txt_desc || '',
    amount: Number(s.txt_amt || 0),
    beforeRemindDays: Number(s.txt_b_remind_days || 0),
    isActive: Boolean(s.CheckBox1),
    reminderFor: frequencyFrom(s),
  }),
  fallbackColumns: {
    JSM_VW_REMINDER_DETAILS: [
      { field: 'ID', caption: 'ID', kind: 'C', len: 24 },
      { field: 'DATE', caption: 'DATE', kind: 'D', len: 11 },
      { field: 'DESCRIPTION', caption: 'DESCRIPTION', kind: 'C', len: 30 },
      { field: 'AMOUNT', caption: 'AMOUNT', kind: 'N', dec: 2, total: true, len: 12 },
      { field: 'BEFORE_REMIND_DAYS', caption: 'DAYS', kind: 'N', dec: 0, total: false, len: 7 },
      { field: 'REMINDER_FOR', caption: 'FREQUENCY', kind: 'C', len: 12 },
      { field: 'IS_ACTIVE', caption: 'ACTIVE', kind: 'C', len: 7 },
    ],
  },
};
