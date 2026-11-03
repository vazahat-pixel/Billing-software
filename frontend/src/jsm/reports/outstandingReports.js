import { toIsoDate } from '../winforms.js';

/**
 * JSM's Outstanding family — Debitor O/s (Rpt_Jsm_Os_Sales), Creditor O/s (Rpt_Jsm_Os_Purchase),
 * Process O/s (Rpt_Jsm_Os_Process), Jobwork O/s (Rpt_Jsm_Os_Jobwork) — each with its own Age
 * Analysis screen. Controls read from the owner's own JSM (screen recording 03/11/2026):
 * BillDate / PaidDate range, Status, Category Wise, the checkboxes shown in that recording
 * (New Year Bill, Include Lastyear O/s, With Unadjust Entry, With Address, With Ledger Balance,
 * Grand Total, Linning Party Total, Order By Broker, With Individual Total(Type), Due Days More
 * Than, Only Direct Bill Close List, With Rg Pending, Only Part Received).
 */
function outstandingConfig(form, categories) {
  return {
    form,
    lists: { ListView0: 'parties', ListView1: 'brokers', ListView2: 'stations', ListView3: 'hastes' },
    defaults: ({ fyFrom, fyTo }) => ({
      txt_bill_dt_from: fyFrom,
      txt_bill_dt_to: fyTo,
      txt_rec_dt_from: fyFrom,
      txt_rec_dt_to: fyTo,
      cbo_status: '1-Pending',
      cbo_category: categories[0] === 1 ? '1-Normal' : '2-Party',
      cbo_company: '1-Current Company',
      cbo_book: '1-All',
      CheckBox_NewYear: true,
      CheckBox_LastYear: true,
      CheckBox_Unadjust: true,
      CheckBox_Address: true,
      CheckBox_Ledger: true,
      CheckBox_Total: true,
      CheckBox_Linning: true,
    }),
    toParams: (s) => ({
      from: toIsoDate(s.txt_bill_dt_from),
      to: toIsoDate(s.txt_bill_dt_to),
      fromText: s.txt_bill_dt_from,
      toText: s.txt_bill_dt_to,
      paidFrom: toIsoDate(s.txt_rec_dt_from),
      paidTo: toIsoDate(s.txt_rec_dt_to),
      status: s.cbo_status,
      category: s.cbo_category,
      includeLastYear: Boolean(s.CheckBox_LastYear),
      withLedgerBalance: Boolean(s.CheckBox_Ledger),
      onlyDirectBillClose: Boolean(s.CheckBox_OnlyDirectBillClose),
      onlyPartReceived: Boolean(s.CheckBox_OnlyPart),
      onlyRgPending: Boolean(s.CheckBox_WithRg),
      dueDaysMin: s.txt_Due_Days ? Number(s.txt_Due_Days) : undefined,
      printout: s.cbo_printout,
      parties: s.ListView0 || [],
      brokers: s.ListView1 || [],
      stations: s.ListView2 || [],
      hastes: s.ListView3 || [],
    }),
  };
}

function ageConfig(form, categories) {
  return {
    form,
    lists: { ListView0: 'parties', ListView1: 'brokers' },
    defaults: ({ fyFrom, fyTo }) => ({
      txt_bill_dt_from: fyFrom,
      txt_bill_dt_to: fyTo,
      cbo_status: '1-Pending',
      cbo_category: categories[0] === 1 ? '1-Party' : '1-Party',
      cbo_company: '1-Current Company',
      CheckBox_NewYear: true,
      CheckBox_Total: true,
      CheckBox_Address: true,
      CheckBox_Ledger: true,
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
  };
}

export const osSales = outstandingConfig('Rpt_Jsm_Os_Sales', [1, 2, 3, 4, 5]);
export const osPurchase = outstandingConfig('Rpt_Jsm_Os_Purchase', [1, 2, 3, 4, 5]);
export const osProcess = outstandingConfig('Rpt_Jsm_Os_Process', [1, 2, 3]);
export const osJobwork = outstandingConfig('Rpt_Jsm_Os_Jobwork', [1, 2, 3]);

export const osSalesAge = ageConfig('Rpt_Jsm_Os_Sales_AgeAnalysis', [1, 2]);
export const osPurchaseAge = ageConfig('Rpt_Jsm_Os_Purchase_AgeAnalysis', [1, 2]);
export const osProcessAge = ageConfig('Rpt_Jsm_Os_Process_AgeAnalysis', [1, 2]);
export const osJobworkAge = ageConfig('Rpt_Jsm_Os_Jobwork_AgeAnalysis', [1, 2]);

export const OUTSTANDING_REPORTS = [
  osSales, osPurchase, osProcess, osJobwork,
  osSalesAge, osPurchaseAge, osProcessAge, osJobworkAge,
];
