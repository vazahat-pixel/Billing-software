import { toIsoDate } from '../winforms';

/**
 * JSM Reports › Purchase › Purchase Bill › Summary and Detail (form Rpt_Jsm_Purchase).
 *
 * One JSM form serves both menu entries, so `detail` is fixed per entry rather than chosen on the
 * screen (JSM's own CheckBox_Summary is hidden on this form). "Category Wise" is the layout variant.
 */
const config = (detail) => ({
  form: 'Rpt_Jsm_Purchase',
  lists: { ListView0: 'parties', ListView1: 'brokers', ListView2: 'books', ListView3: 'stations', ListView4: 'items' },
  defaults: ({ fyFrom, fyTo }) => ({
    txt_dt_from: fyFrom,
    txt_dt_to: fyTo,
    cbo_category: '1-Register',
    cbo_report_type: '1-Default',
    cbo_book: '1-All',
    cbo_company: '1-Current Company',
    radio_button_date: true,
  }),
  toParams: (s) => ({
    from: toIsoDate(s.txt_dt_from),
    to: toIsoDate(s.txt_dt_to),
    fromText: s.txt_dt_from,
    toText: s.txt_dt_to,
    category: s.cbo_category,
    reportType: s.cbo_report_type,
    detail,
    orderBy: s.radio_button_billno ? 'billno' : (s.radio_button_srno ? 'srno' : 'date'),
    numFrom: s.txt_from,
    numTo: s.txt_to,
    parties: s.ListView0 || [],
    brokers: s.ListView1 || [],
    books: s.ListView2 || [],
    stations: s.ListView3 || [],
    items: s.ListView4 || [],
  }),
});

export const purchaseRegisterSummary = config(false);

/**
 * The Detail menu entry draws the same JSM screen and asks the same backend report; only `detail`
 * differs. It is registered under its own key so the menu can point at it.
 */
export const purchaseRegisterDetail = {
  ...config(true),
  form: 'Rpt_Jsm_Purchase_Detail',
  blueprintForm: 'Rpt_Jsm_Purchase',
  apiForm: 'Rpt_Jsm_Purchase',
};

export default purchaseRegisterSummary;
