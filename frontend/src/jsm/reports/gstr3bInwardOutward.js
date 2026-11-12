import { toIsoDate } from '../winforms.js';

const GROUPS = ['Book', 'Party', 'State_Name', 'Type', 'TaxRate', 'Month', 'Book(BookWise)', 'Gst_No', 'Head'];
const N = (field, caption, len = 13) => ({ field, caption, kind: 'N', dec: 2, total: true, len });

export default {
  form: 'Gstr_3B_Detail_Inward_Outwardard_supply',
  lists: {
    ListView0: 'books',
    ListView1: 'parties',
    ListView2: 'states',
    ListView3: 'types',
    ListView4: 'taxRates',
    ListView5: 'months',
    ListView6: 'books',
    ListView7: 'gstNos',
  },
  defaults: ({ fyFrom, fyTo }) => ({
    txt_dt_from: fyFrom,
    txt_dt_to: fyTo,
    Cbo_InOut: 'Both',
    Cbo_OrderBy1: 'Book',
    Cbo_OrderBy2: 'None',
    cbo_printout: '1-Continue',
    CheckBox_Summary: false,
  }),
  overrides: () => ({
    Cbo_OrderBy1: { items: GROUPS },
    Cbo_OrderBy2: { items: ['None', ...GROUPS] },
  }),
  toParams: (s) => ({
    from: toIsoDate(s.txt_dt_from),
    to: toIsoDate(s.txt_dt_to),
    fromText: s.txt_dt_from,
    toText: s.txt_dt_to,
    inOut: s.Cbo_InOut || 'Both',
    groupBy1: s.Cbo_OrderBy1 || 'Book',
    groupBy2: s.Cbo_OrderBy2 || 'None',
    printout: s.cbo_printout || '1-Continue',
    summary: Boolean(s.CheckBox_Summary),
    books: s.ListView0 || s.ListView6 || [],
    parties: s.ListView1 || [],
    states: s.ListView2 || [],
    types: s.ListView3 || [],
    taxRates: s.ListView4 || [],
    months: s.ListView5 || [],
    gstNos: s.ListView7 || [],
  }),
  fallbackColumns: {
    RUNTIME_B_SUMMARY_IN_OUT: [
      { field: 'ZGROUP1', caption: 'GROUP1', kind: 'C', len: 18 },
      { field: 'ZGROUP2', caption: 'GROUP2', kind: 'C', len: 22 },
      N('TAXABLE_AMT', 'TAXABLE'),
      N('SGST_AMT', 'SGST', 11),
      N('CGST_AMT', 'CGST', 11),
      N('IGST_AMT', 'IGST', 11),
      N('BILL_AMT', 'NETAMT'),
      { field: 'GST_NO', caption: 'GST.NO', kind: 'C', len: 16 },
      N('TO_PCS', 'PCS', 9),
      N('TO_QTY', 'QTY', 11),
      N('TO_KGS', 'KGS', 11),
    ],
  },
};

