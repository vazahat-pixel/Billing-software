import { toIsoDate } from '../winforms.js';
import accFinish from './stockAccFinish.js';

/**
 * JSM: Rpt_Stk_Acc_Finish_Summary ("Summary - Stock Reports") — Acc Stock Reports › Stock Ledger.
 * Dates, W-Item / X-Category list, 1-Qty / 2-Pcs / 3-Kgs (4-All is not produced), and A-Normal /
 * B-Date Wise / C-Month Wise. Same stock books as Stock Ledger New, so it reads that report;
 * JSM prints this one from a Crystal template and this is the same figures as a grid.
 */
export default {
  ...accFinish,
  form: 'Rpt_Stk_Acc_Finish_Summary',
  blueprintForm: 'Rpt_Stk_Acc_Finish_Summary',
  apiForm: 'Rpt_Stock_Acc_Finish_Summary',
  lists: {},
  runButtons: ['btn_screen', 'btn_print', 'btn_word'],
  dynamicLists: (s, o) => ({ lst_vw1: s.Rdbtn_A2 ? (o.categories || []) : (o.items || []) }),
  defaults: ({ fyFrom, fyTo }) => ({ txt_dt_from: fyFrom, txt_dt_to: fyTo, Rdbtn_A1: true, Rdbtn_B1: true, Rdbtn_C1: true, Rdbtn_D1: true }),
  toParams: (s) => {
    const base = {
      from: toIsoDate(s.txt_dt_from),
      to: toIsoDate(s.txt_dt_to),
      fromText: s.txt_dt_from,
      toText: s.txt_dt_to,
      itemBy: s.Rdbtn_B4 ? '4-All' : s.Rdbtn_B3 ? '3-Kgs' : s.Rdbtn_B2 ? '2-Pcs' : '1-Qty',
      orderBy1: s.Rdbtn_A2 ? 'Category' : 'Item',
    };
    const picked = s.lst_vw1 || [];
    const lists = s.Rdbtn_A2 ? { categories: picked } : { items: picked };
    if (s.Rdbtn_C3) return { ...base, ...lists, summary: true, orderBy2: 'Month' };
    if (s.Rdbtn_C2) return { ...base, ...lists, summary: false, orderBy2: 'None' };
    return { ...base, ...lists, summary: true, orderBy2: 'None' };
  },
};
