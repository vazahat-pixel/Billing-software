import { toIsoDate } from '../winforms';

/**
 * JSM Reports › Process Reports › Process Stock (Rpt_Process_Stock_New_Gst): each mill challan with its receipts and
 * the balance still at the mill. Tabs: Mill, Item, PurParty, Master, MainGroup, Broker, Book, Transport.
 */
export default {
  form: 'Rpt_Process_Stock_New_Gst',
  lists: {
    ListView0: 'mills', ListView1: 'items', ListView2: 'purParties', ListView3: 'masters',
    ListView4: 'mainGroups', ListView5: 'brokers', ListView6: 'books', ListView7: 'transports',
  },
  defaults: ({ fyFrom, fyTo }) => ({
    txt_dt_from: fyFrom,
    txt_dt_to: fyTo,
    txt_Recdt_to: fyTo,
    Cbo_OrderBy1: 'Mill',
    Cbo_OrderBy2: 'None',
    Cbo_OrderBy3: 'None',
    Cbo_Company: 'Current',
    cbo_status: '1-Pending',
    cbo_process_type: '1-All',
    cbo_printout: '1-Continue',
    CheckBox_LastYear: true,
    Radio_button_date: true,
  }),
  toParams: (s) => ({
    from: toIsoDate(s.txt_dt_from),
    to: toIsoDate(s.txt_dt_to),
    recTo: toIsoDate(s.txt_Recdt_to),
    fromText: s.txt_dt_from,
    toText: s.txt_dt_to,
    includeLastYear: Boolean(s.CheckBox_LastYear),
    status: s.cbo_status,
    processType: s.cbo_process_type,
    printout: s.cbo_printout,
    orderBy1: s.Cbo_OrderBy1,
    orderBy2: s.Cbo_OrderBy2,
    orderBy3: s.Cbo_OrderBy3,
    chFrom: s.Radio_button_challan ? s.txt_from : '',
    chTo: s.Radio_button_challan ? s.txt_to : '',
    mills: s.ListView0 || [],
    items: s.ListView1 || [],
    purParties: s.ListView2 || [],
    masters: s.ListView3 || [],
    mainGroups: s.ListView4 || [],
    brokers: s.ListView5 || [],
    books: s.ListView6 || [],
    transports: s.ListView7 || [],
  }),
};
