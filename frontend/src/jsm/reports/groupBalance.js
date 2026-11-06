import { toIsoDate } from '../winforms.js';

/**
 * JSM: Reports › Final Reports › Group List (Rpt_Group_Balance) — one signed balance per account
 * under its head, as on a date. JSM reuses its Trail Balance window for this screen, so the
 * controls are that window's: the As On date, the account and head tick lists, and the With
 * Address / With PanNo / With Broker boxes.
 *
 * No STP_REPORT row backs it; the columns are the ones JSM's own SELECT builds.
 */
export default {
  form: 'Rpt_Group_Balance',
  lists: { lst_vw1: 'accounts', lst_vw2: 'heads' },
  defaults: ({ fyTo }) => ({
    txt_dt_from: fyTo,
    Chk_WithAddress: false,
  }),
  toParams: (s) => ({
    to: toIsoDate(s.txt_dt_from),
    toText: s.txt_dt_from,
    heads: s.lst_vw2 || [],
    withZero: Boolean(s.chk_zero),
    withAddress: Boolean(s.Chk_WithAddress),
  }),
  fallbackColumns: {
    JSM_VW_GROUP_BALANCE: [
      { field: 'AC_NAME', caption: 'Account Name', kind: 'C', len: 32 },
      { field: 'PARTY_CITY', caption: 'City', kind: 'C', len: 16 },
      { field: 'DRCR_BAL1', caption: 'Balance', kind: 'N', dec: 2, total: true, len: 15 },
    ],
  },
};
