import { toIsoDate } from '../winforms.js';

/**
 * JSM: Reports › Fas Reports › Ledger (A_AccountLedgerSingleSide) and Ledger T-Format /
 * Confirmation (A_AccountLedgerDoubleSide — same screen, two more menu entries onto it).
 * Date range, tick-list of accounts (ListView_Party), "With Narration 1/2" / "With Book (Print)"
 * checkboxes — matching the real form's controls (captured blueprint).
 *
 * "Ledger Interest" also opens A_AccountLedgerDoubleSide on real JSM but adds an interest
 * calculation this software has no engine for yet, so it is intentionally not wired here rather
 * than showing a ledger with a silently-missing interest column.
 */
function register(form, blueprintForm, title) {
  return {
    form,
    blueprintForm,
    apiForm: blueprintForm,
    title,
    lists: { ListView_Party: 'parties' },
    defaults: ({ fyFrom, fyTo }) => ({
      txt_dt_from: fyFrom,
      txt_dt_to: fyTo,
      Check_HeadWise: true,
      CheckBox_Remark1: true,
      CheckBox_Remark2: true,
      CheckBox_WithBook_Print: true,
      Rdbtn_OrderAccont: true,
    }),
    toParams: (s) => ({
      ledgers: s.ListView_Party || [],
      from: toIsoDate(s.txt_dt_from),
      to: toIsoDate(s.txt_dt_to),
      fromText: s.txt_dt_from,
      toText: s.txt_dt_to,
      withNarration1: Boolean(s.CheckBox_Remark1),
      withNarration2: Boolean(s.CheckBox_Remark2),
    }),
  };
}

export const ledger = register('A_AccountLedgerSingleSide', 'A_AccountLedgerSingleSide', 'Account Ledger');
export const ledgerTFormat = register('A_AccountLedgerDoubleSide_TFormat', 'A_AccountLedgerDoubleSide', 'Ledger T-Format');
export const ledgerConfirmation = register('A_AccountLedgerDoubleSide_Confirmation', 'A_AccountLedgerDoubleSide', 'Confirmation');

export const LEDGER_REPORTS = [ledger, ledgerTFormat, ledgerConfirmation];
