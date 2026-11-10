import { toIsoDate } from '../winforms.js';

/**
 * JSM: Others Reports › Outstanding › Debitors / Creditors › Detail
 * (Rpt_Jsm_Os_Sales_Detail / Rpt_Jsm_Os_Purchase_Detail) — the outstanding listing with each
 * bill's item lines under it. Same controls as the Normal screen it sits beside.
 */
const detail = (form) => ({
  form,
  lists: { ListView0: 'parties', ListView1: 'brokers' },
  defaults: ({ fyFrom, fyTo }) => ({
    txt_bill_dt_from: fyFrom,
    txt_bill_dt_to: fyTo,
    cbo_status: '1-Pending',
    cbo_category: '1-Normal',
  }),
  toParams: (s) => ({
    from: toIsoDate(s.txt_bill_dt_from),
    to: toIsoDate(s.txt_bill_dt_to),
    fromText: s.txt_bill_dt_from,
    toText: s.txt_bill_dt_to,
    status: s.cbo_status,
    category: s.cbo_category,
    printout: s.cbo_printout,
    parties: s.ListView0 || [],
    brokers: s.ListView1 || [],
  }),
});

export const osSalesDetail = detail('Rpt_Jsm_Os_Sales_Detail');
export const osPurchaseDetail = detail('Rpt_Jsm_Os_Purchase_Detail');
export const OUTSTANDING_DETAILS = [osSalesDetail, osPurchaseDetail];
