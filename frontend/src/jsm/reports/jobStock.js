import { toIsoDate } from '../winforms';

/**
 * JSM Reports › JobWork Reports › Jobwork Stock/Pending Report (Rpt_JobWork_Stock_Report):
 * each job work challan with its receipts and the balance still with the job worker.
 * Tabs: Party, Broker, Item, Book, Range. Its controls differ from Process Stock — two GroupBy
 * combos only, a Unit combo, TXT_UPTO_REC_DATE and chk_lst_yr.
 */
export default {
  form: 'Rpt_JobWork_Stock_Report',
  lists: {
    ListView0: 'parties', ListView1: 'brokers', ListView2: 'items', ListView3: 'books', ListView4: 'ranges',
  },
  defaults: ({ fyFrom, fyTo }) => ({
    txt_dt_from: fyFrom,
    txt_dt_to: fyTo,
    TXT_UPTO_REC_DATE: fyTo,
    Cbo_OrderBy1: 'Register',
    Cbo_OrderBy2: 'None',
    Cbo_Company: 'Current',
    cbo_status: 'Pending',
    cbo_Unit: 'Pcs',
    cbo_printout: '1-Continue',
    chk_lst_yr: true,
  }),
  toParams: (s) => ({
    from: toIsoDate(s.txt_dt_from),
    to: toIsoDate(s.txt_dt_to),
    recTo: toIsoDate(s.TXT_UPTO_REC_DATE),
    fromText: s.txt_dt_from,
    toText: s.txt_dt_to,
    includeLastYear: Boolean(s.chk_lst_yr),
    status: s.cbo_status,
    unit: s.cbo_Unit,
    printout: s.cbo_printout,
    orderBy1: s.Cbo_OrderBy1,
    orderBy2: s.Cbo_OrderBy2,
    parties: s.ListView0 || [],
    brokers: s.ListView1 || [],
    items: s.ListView2 || [],
    books: s.ListView3 || [],
    ranges: s.ListView4 || [],
  }),
};
