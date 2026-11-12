/**
 * JSM: Others Reports › Master List › Envelope / Label Printing (Rpt_Account_List_Print).
 *
 * One JSM screen serves both entries — the stationery is what differs, its envelope layout or its
 * 4x3 label one — so each is its own config pointing at that screen and at the same report, one
 * with the label flag set. Both print through Crystal, so the columns are the ones JSM's own view
 * selects: the name, two address lines and the city.
 */
const COLUMNS = [
  { field: 'AC_NAME', caption: 'NAME', kind: 'C', len: 30 },
  { field: 'ADD_1', caption: 'ADDRESS 1', kind: 'C', len: 30 },
  { field: 'ADD_2', caption: 'ADDRESS 2', kind: 'C', len: 30 },
  { field: 'ST_NAME', caption: 'CITY', kind: 'C', len: 16 },
  { field: 'PIN_CODE', caption: 'PIN', kind: 'C', len: 8 },
  { field: 'MOBILE', caption: 'MOBILE', kind: 'C', len: 13 },
  { field: 'COPY_NO', caption: 'COPY', kind: 'N', dec: 0, len: 6 },
];

const print = (side, label) => ({
  form: `Rpt_Account_List_Print_${side}`,
  blueprintForm: 'Rpt_Account_List_Print',
  apiForm: 'Rpt_Account_List_Print',
  lists: { lst_vw1: 'accounts', ListView1: 'items' },
  defaults: () => ({ txt_copy: '1' }),
  toParams: (s) => ({
    copies: Number(String(s.txt_copy ?? '1').replace(/[^0-9]/g, '')) || 1,
    label,
    accounts: s.lst_vw1 || [],
    items: s.ListView1 || [],
  }),
  fallbackColumns: { JSM_VW_LIST_PRINT: COLUMNS },
});

export const LIST_PRINTS = [print('Envelope', false), print('Label', true)];
