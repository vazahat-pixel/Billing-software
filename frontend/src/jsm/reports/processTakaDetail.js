import { toIsoDate } from '../winforms.js';

/**
 * JSM: Reports > Process Reports > TakaWise Stock Detail (Rpt_Process_Stock_TakaDetail)
 * Layout JSM_VW_PROCESS_STOCK_TAKADETAIL_REPORT is captured in layouts.json.
 */
export default {
  form: 'Rpt_Process_Stock_TakaDetail',
  lists: {
    ListView1: 'mills',
    ListView2: 'items',
    ListView3: 'purParties',
  },
  defaults: ({ fyFrom, fyTo }) => ({
    txt_bill_dt_from: fyFrom,
    txt_dt_to: fyTo,
    cbo_status: 'Pending',
    Cbo_OrderBy1: 'Register',
    Cbo_OrderBy2: 'None',
    cbo_printout: '1-Continue',
  }),
  overrides: () => ({
    cbo_status: { items: ['Pending', 'Clear', 'All'] },
    Cbo_OrderBy1: { items: ['Register', 'Mill_Name', 'Item_Name'] },
    Cbo_OrderBy2: { items: ['None', 'Register', 'Mill_Name', 'Item_Name'] },
    cbo_printout: { items: ['1-Continue', '2-PageWise'] },
  }),
  toParams: (s) => ({
    from: toIsoDate(s.txt_bill_dt_from),
    to: toIsoDate(s.txt_dt_to),
    fromText: s.txt_bill_dt_from,
    toText: s.txt_dt_to,
    status: s.cbo_status || 'Pending',
    orderBy1: s.Cbo_OrderBy1 || 'Register',
    orderBy2: s.Cbo_OrderBy2 || 'None',
    printout: s.cbo_printout || '1-Continue',
    mills: s.ListView1 || [],
    items: s.ListView2 || [],
    purParties: s.ListView3 || [],
  }),
};
