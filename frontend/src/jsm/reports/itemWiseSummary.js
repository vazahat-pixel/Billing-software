import { toIsoDate } from '../winforms.js';

/**
 * JSM: Sales/Purchase Bill › Item Wise Summary (Rpt_Jsm_Sales_ItemSummary / _Purchase_ItemSummary).
 * Controls read from the owner's own JSM form: Book, Order By (Name/Value), Report Type, Category
 * Wise, Month Wise, date range (txt_bill_dt_from/to on the real form).
 */
function itemWiseConfig(form) {
  return {
    form,
    lists: { ListView0: 'parties', ListView1: 'brokers', ListView2: 'books', ListView3: 'items' },
    defaults: ({ fyFrom, fyTo }) => ({
      txt_bill_dt_from: fyFrom,
      txt_bill_dt_to: fyTo,
      cbo_category: '1-Normal',
      cbo_OrderBy: '1-Name',
      cbo_report_type: '1-Default',
      cbo_book: '1-All',
      cbo_company: '1-Current Company',
      CheckBox_Month: false,
    }),
    toParams: (s) => ({
      from: toIsoDate(s.txt_bill_dt_from),
      to: toIsoDate(s.txt_bill_dt_to),
      fromText: s.txt_bill_dt_from,
      toText: s.txt_bill_dt_to,
      category: s.cbo_category,
      monthWise: Boolean(s.CheckBox_Month),
      printout: s.cbo_printout,
      parties: s.ListView0 || [],
      brokers: s.ListView1 || [],
      books: s.ListView2 || [],
      items: s.ListView3 || [],
    }),
  };
}

export const salesItemWise = itemWiseConfig('Rpt_Jsm_Sales_ItemSummary');
export const purchaseItemWise = itemWiseConfig('Rpt_Jsm_Purchase_ItemSummary');

export const ITEM_WISE_REPORTS = [salesItemWise, purchaseItemWise];
