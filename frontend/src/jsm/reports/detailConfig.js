import { toIsoDate } from '../winforms';

/** Config for a JSM detail-register screen: date range, tab ListViews → filter params, GroupBy 1/2. */
export function detailConfig({ form, lists, defaults = {} }) {
  return {
    form,
    lists: Object.fromEntries(Object.entries(lists).map(([lv, param]) => [lv, param])),
    defaults: ({ fyFrom, fyTo }) => ({
      txt_dt_from: fyFrom,
      txt_dt_to: fyTo,
      Cbo_OrderBy1: 'Register',
      Cbo_OrderBy2: 'None',
      Cbo_Company: 'Current',
      cbo_printout: '1-Continue',
      ...defaults,
    }),
    toParams: (s) => ({
      from: toIsoDate(s.txt_dt_from),
      to: toIsoDate(s.txt_dt_to),
      fromText: s.txt_dt_from,
      toText: s.txt_dt_to,
      orderBy1: s.Cbo_OrderBy1,
      orderBy2: s.Cbo_OrderBy2,
      printout: s.cbo_printout,
      ...Object.fromEntries(Object.entries(lists).map(([lv, param]) => [param, s[lv] || []])),
    }),
  };
}
