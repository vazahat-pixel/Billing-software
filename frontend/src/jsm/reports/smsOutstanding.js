import { toIsoDate } from '../winforms.js';

/**
 * JSM: Others Reports › Outstanding › Sms Days Wise (Rpt_Sms_OsReports, "Outstanding Sms").
 *
 * The parties whose bills are older than the Days box, with the reminder JSM composes for each.
 * JSM shows the composed script in its own text box rather than a grid, so the message and its
 * length are columns here; the Dongle and Send Thru Web buttons need an SMS gateway this software
 * does not have, so nothing is sent.
 */
const COLUMNS = [
  { field: 'PARTY', caption: 'PARTY', kind: 'C', len: 26 },
  { field: 'PARTY_MOBILE', caption: 'MOBILE', kind: 'C', len: 13 },
  { field: 'BILL_COUNT', caption: 'BILLS', kind: 'N', dec: 0, len: 7 },
  { field: 'TOT_BALANCE', caption: 'BALANCE', kind: 'N', dec: 2, total: true, len: 14 },
  { field: 'OS_DAYS', caption: 'DAYS', kind: 'N', dec: 0, len: 7 },
  { field: 'MESSAGE', caption: 'SMS SCRIPT', kind: 'C', len: 60 },
  { field: 'MSG_LENTH', caption: 'LENTH', kind: 'N', dec: 0, len: 7 },
];

export default {
  form: 'Rpt_Sms_OsReports',
  lists: { lst_vw1: 'parties' },
  defaults: ({ today }) => ({ txt_OsDaysDate: today, txt_osdays: '90' }),
  toParams: (s) => ({
    asOn: toIsoDate(s.txt_OsDaysDate),
    asOnText: s.txt_OsDaysDate,
    osDays: Number(String(s.txt_osdays ?? '90').replace(/[^0-9.-]/g, '')) || 0,
    withNameAndDate: Boolean(s.Chk_Ac_Name_Date),
    parties: s.lst_vw1 || [],
  }),
  fallbackColumns: { JSM_VW_SMS_OS: COLUMNS },
};
