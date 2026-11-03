import { toIsoDate } from '../winforms.js';

/**
 * JSM: Reports › Final Reports › Profit & Loss Account (A_Final_ProfitAndLoss).
 * From Date, As On Date, a Closing Stock figure the operator types in (this software has no
 * automatic inventory valuation feeding the Trading Account, same as JSM's own screen requires it
 * typed in), Provisional/Net Sales %/Show % checkboxes — matching the real form's controls
 * (captured blueprint, confirmed against the owner's own screenshot, 03/11/2026).
 *
 * Renders through JsmGridReportsTwoColumn — the backend report returns a pre-built {left,right}
 * line list directly, so there is no fallbackColumns here (same reasoning as Balance Sheet).
 */
export default {
  form: 'A_Final_ProfitAndLoss',
  renderer: 'twoColumn',
  lists: {},
  defaults: ({ fyFrom, fyTo }) => ({
    Txt_FromDate: fyFrom,
    Txt_AsOnDate: fyTo,
    txt_cl_rs: '0',
  }),
  toParams: (s) => ({
    from: toIsoDate(s.Txt_FromDate),
    to: toIsoDate(s.Txt_AsOnDate),
    fromText: s.Txt_FromDate,
    toText: s.Txt_AsOnDate,
    closingStock: Number(String(s.txt_cl_rs || '0').replace(/,/g, '')) || 0,
  }),
};
