import { toIsoDate } from '../winforms';

/**
 * JSM's four bill registers (Rpt_Jsm_Sales / _Purchase / _Sales_Return / _Purchase_Return).
 *
 * Their screens have no tick-list tabs: just the date range, the A-Date / B-Bill.No / C-Serial.No
 * radio with its From/To, Book, Company, Report Type and Category Wise. One JSM form serves both the
 * Summary and the Detail menu entry (its CheckBox_Summary is hidden), so each entry is its own
 * config pointing at the same screen and the same backend report.
 */
function register(form, { detail }) {
  return {
    form: detail ? `${form}_Detail` : form,
    blueprintForm: form,
    apiForm: form,
    lists: {},
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
    }),
  };
}

const FORMS = ['Rpt_Jsm_Sales', 'Rpt_Jsm_Purchase', 'Rpt_Jsm_Sales_Return', 'Rpt_Jsm_Purchase_Return'];

export const BILL_REGISTERS = FORMS.flatMap((f) => [register(f, { detail: false }), register(f, { detail: true })]);
