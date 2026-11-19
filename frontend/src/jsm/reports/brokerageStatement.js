import { toIsoDate } from '../winforms.js';

/**
 * JSM: Others Reports › Brokreg Statment › Sales › Rec.Date Wise / Bill Date Wise and
 * Purchase › Bill Date Wise / Paid Date Wise.
 *
 * One JSM screen (A_BrokregStatment) serves all four entries — the side and the date it works on
 * are what the menu entry chooses — so each is its own config pointing at that screen and at its
 * own report. Its two layouts are built at run time, so the columns are the ones its own view and
 * its commission arithmetic name.
 */
const COLUMNS = [
  { field: 'BILL_DATE', caption: 'BILL.DATE', kind: 'D', len: 10 },
  { field: 'NCBILL_NO', caption: 'BILL.NO', kind: 'C', len: 10 },
  { field: 'PARTY', caption: 'PARTY', kind: 'C', len: 24 },
  { field: 'BILL_AMT', caption: 'BILL.AMT', kind: 'N', dec: 2, total: true, len: 13 },
  { field: 'TAXABLE_AMT', caption: 'TAXABLE', kind: 'N', dec: 2, total: true, len: 13 },
  { field: 'GST_AMT', caption: 'GST', kind: 'N', dec: 2, total: true, len: 12 },
  { field: 'PAID_AMT', caption: 'PAID', kind: 'N', dec: 2, total: true, len: 13 },
  { field: 'REC_DATE', caption: 'REC.DATE', kind: 'D', len: 10 },
  { field: 'BASE_AMT', caption: 'ON.AMT', kind: 'N', dec: 2, total: true, len: 13 },
  { field: 'BROKREG_AMT', caption: 'BROKREG', kind: 'N', dec: 2, total: true, len: 12 },
  { field: 'TDS_AMT', caption: 'TDS', kind: 'N', dec: 2, total: true, len: 11 },
  { field: 'NET_BROKREG', caption: 'NET.BROKREG', kind: 'N', dec: 2, total: true, len: 13 },
];

const SUMMARY_COLUMNS = [
  { field: 'BROKER', caption: 'BROKER', kind: 'C', len: 26 },
  { field: 'BILL_AMT', caption: 'BILL.AMT', kind: 'N', dec: 2, total: true, len: 14 },
  { field: 'PAID_AMT', caption: 'PAID', kind: 'N', dec: 2, total: true, len: 14 },
  { field: 'BASE_AMT', caption: 'ON.AMT', kind: 'N', dec: 2, total: true, len: 14 },
  { field: 'BROKREG_AMT', caption: 'BROKREG', kind: 'N', dec: 2, total: true, len: 13 },
  { field: 'TDS_AMT', caption: 'TDS', kind: 'N', dec: 2, total: true, len: 12 },
  { field: 'NET_BROKREG', caption: 'NET.BROKREG', kind: 'N', dec: 2, total: true, len: 14 },
];

const statement = (side) => ({
  form: `A_BrokregStatment_${side}`,
  blueprintForm: 'A_BrokregStatment',
  apiForm: `A_BrokregStatment_${side}`,
  lists: { ListView_Broker: 'brokers', ListView_Party: 'parties', ListView_Book: 'books' },
  defaults: ({ fyFrom, fyTo }) => ({
    txt_dt_from: fyFrom,
    txt_dt_to: fyTo,
    txt_CommissionPer: '2.00',
    txt_TdsPer: '0.00',
    Rdbtn_OnBill: true,
    Rdbtn_Date: true,
    cbo_status: '1-Pending',
    CheckBox_LastYear: true,
    Chk_GrandTotal: true,
  }),
  toParams: (s) => ({
    from: toIsoDate(s.txt_dt_from),
    to: toIsoDate(s.txt_dt_to),
    fromText: s.txt_dt_from,
    toText: s.txt_dt_to,
    base: s.Rdbtn_Taxable ? 'taxable' : (s.Rdbtn_OnPaid ? 'paid' : 'bill'),
    commissionPer: Number(String(s.txt_CommissionPer ?? '2').replace(/[^0-9.-]/g, '')) || 0,
    tdsPer: Number(String(s.txt_TdsPer ?? '0').replace(/[^0-9.-]/g, '')) || 0,
    gstLess: Boolean(s.CheckBox_GstLess),
    order: s.Rdbtn_Party ? 'Party' : 'Date',
    summary: Boolean(s.CheckBox_Smry),
    status: s.cbo_status,
    includeLastYear: s.CheckBox_LastYear !== false,
    printout: s.cbo_printout,
    brokers: s.ListView_Broker || [],
    parties: s.ListView_Party || [],
    books: s.ListView_Book || [],
  }),
  fallbackColumns: {
    JSM_VW_BROKREG_STATEMENT: COLUMNS,
    JSM_VW_BROKREG_STATEMENT_SUMMARY: SUMMARY_COLUMNS,
  },
});

export const BROKERAGE_STATEMENTS = [
  statement('SalesBillDate'),
  statement('SalesRecDate'),
  statement('PurchaseBillDate'),
  statement('PurchasePaidDate'),
];
