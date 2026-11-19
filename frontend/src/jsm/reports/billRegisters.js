import { toIsoDate } from '../winforms.js';

/**
 * JSM's four bill registers (Rpt_Jsm_Sales / _Purchase / _Sales_Return / _Purchase_Return).
 *
 * Their screens have no tick-list tabs: just the date range, the A-Date / B-Bill.No / C-Serial.No
 * radio with its From/To, Book, Company, Report Type and Category Wise. One JSM form serves both the
 * Summary and the Detail menu entry (its CheckBox_Summary is hidden), so each entry is its own
 * config pointing at the same screen and the same backend report.
 */
/**
 * The window title JSM sets for each entry. The Detail titles are JSM's own runtime titles from the
 * blueprint; "Purchase Summary Report" was seen on the owner's JSM, and the other Summary titles
 * follow the same wording ("Sales Summary Report" is also that form's own title).
 */
const TITLES = {
  Rpt_Jsm_Sales: { summary: 'Sales Summary Report', detail: 'Sales Detail Report' },
  Rpt_Jsm_Purchase: { summary: 'Purchase Summary Report', detail: 'Purchase Detail Report' },
  Rpt_Jsm_Sales_Return: { summary: 'Sale Return Summary Report', detail: 'Sale Return Detail Report' },
  Rpt_Jsm_Purchase_Return: { summary: 'Purchase Return Summary Report', detail: 'Purchase Return Detail Report' },
};

const numberMode = (s) => Boolean(s.radio_button_billno || s.radio_button_srno);

function register(form, { detail }) {
  return {
    form: detail ? `${form}_Detail` : form,
    blueprintForm: form,
    apiForm: form,
    title: TITLES[form][detail ? 'detail' : 'summary'],
    lists: {},
    /**
     * As JSM shows the screen: the "Summary Reports" box is there on the Summary entry only (the
     * blueprint captured the Detail entry, where it is hidden), and the date From/To and the number
     * From/To share one spot — A-Date shows the dates, B-Bill.No / C-Serial.No swap in the numbers.
     */
    overrides: (s) => ({
      CheckBox_Summary: { visible: !detail },
      GroupBox_Date: { visible: !numberMode(s) },
      GroupBox_No: { visible: numberMode(s) },
    }),
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
      summaryReports: Boolean(s.CheckBox_Summary),
      numFrom: s.txt_from,
      numTo: s.txt_to,
    }),
  };
}

const FORMS = ['Rpt_Jsm_Sales', 'Rpt_Jsm_Purchase', 'Rpt_Jsm_Sales_Return', 'Rpt_Jsm_Purchase_Return'];

export const BILL_REGISTERS = FORMS.flatMap((f) => [register(f, { detail: false }), register(f, { detail: true })]);
