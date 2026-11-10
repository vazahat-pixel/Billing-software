
/**
 * JSM: Others Reports › Master List › Account (Rpt_Account_ReportRpt) and › Item
 * (Rpt_Item_Mst_Report). Each has an Order By that also heads the window, and a tick list.
 *
 * Columns are JSM's own JSM_VW_MASTER_ACCOUNT_REPORT / JSM_VW_MASTER_ITEM_REPORT.
 */
export const masterAccountList = {
  form: 'Rpt_Account_ReportRpt',
  lists: { ListView0: 'accounts', lst_vw1: 'accounts' },
  defaults: () => ({ cbo_orderby: 'Account' }),
  toParams: (s) => ({
    orderBy: s.cbo_orderby || s.Cbo_OrderBy1 || 'Account',
    accounts: s.ListView0 || s.lst_vw1 || [],
    printout: s.cbo_printout,
  }),
  fallbackColumns: {
    JSM_VW_MASTER_ACCOUNT_REPORT: [
      { field: 'ACCOUNT', caption: 'ACCOUNT', kind: 'C', len: 30 },
      { field: 'ACCOUNTHEAD', caption: 'ACCOUNTHEAD', kind: 'C', len: 20 },
      { field: 'ADDRESS', caption: 'ADDRESS', kind: 'C', len: 34 },
      { field: 'STATION', caption: 'STATION', kind: 'C', len: 16 },
      { field: 'PHONENO', caption: 'PHONENO', kind: 'C', len: 14 },
      { field: 'GSTIN_NO', caption: 'GSTIN NO', kind: 'C', len: 18 },
      { field: 'PAN_NO', caption: 'PAN NO', kind: 'C', len: 12 },
    ],
  },
};

export const masterItemList = {
  form: 'Rpt_Item_Mst_Report',
  lists: { ListView0: 'items', lst_vw1: 'items' },
  defaults: () => ({ cbo_orderby: 'Item' }),
  toParams: (s) => ({
    orderBy: s.cbo_orderby || s.Cbo_OrderBy1 || 'Item',
    items: s.ListView0 || s.lst_vw1 || [],
    printout: s.cbo_printout,
  }),
  fallbackColumns: {
    JSM_VW_MASTER_ITEM_REPORT: [
      { field: 'ITEM', caption: 'ITEM', kind: 'C', len: 30 },
      { field: 'CATEGORY', caption: 'CATEGORY', kind: 'C', len: 18 },
      { field: 'UNIT', caption: 'UNIT', kind: 'C', len: 8 },
      { field: 'HSN_CODE', caption: 'HSN', kind: 'C', len: 10 },
      { field: 'TAX_RATE', caption: 'TAX%', kind: 'N', dec: 2, len: 8 },
      { field: 'SL_RATE', caption: 'SL.RATE', kind: 'N', dec: 2, len: 10 },
      { field: 'PU_RATE', caption: 'PU.RATE', kind: 'N', dec: 2, len: 10 },
      { field: 'OP_PCS', caption: 'OP.PCS', kind: 'N', dec: 0, total: true, len: 8 },
      { field: 'OP_QTY', caption: 'OP.QTY', kind: 'N', dec: 2, total: true, len: 12 },
    ],
  },
};

export const MASTER_LISTS = [masterAccountList, masterItemList];
