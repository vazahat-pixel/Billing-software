const N = (field, caption, dec = 2, len = 11) => ({ field, caption, kind: 'N', dec, total: true, len });

export const UPDATE_STATUS_TOOLS = [
  {
    form: 'Rpt_Update_Lot_Status',
    method: 'POST',
    runButtons: ['btn_update', 'Btn_Workupdate'],
    exitButtons: ['btn_cn'],
    lists: {},
    defaults: () => ({
      Rdbtn_qty: true,
      rda_btn1: true,
    }),
    toParams: (s, btnName) => ({
      mode: s.rda_btn2 ? 'Job' : 'Mill',
      byPcs: Boolean(s.Rdbtn_pcs),
      action: btnName || 'preview',
    }),
    fallbackColumns: {
      JSM_VW_UPDATE_LOT_STATUS: [
        { field: 'CHLN_DATE', caption: 'CH.DATE', kind: 'D', len: 10 },
        { field: 'NCCHLN_NO', caption: 'CH.NO', kind: 'C', len: 10 },
        { field: 'PARTY', caption: 'MILL / PARTY', kind: 'C', len: 24 },
        N('ISS_PCS', 'ISS.PCS', 0, 9),
        N('REC_PCS', 'REC.PCS', 0, 9),
        N('DIFF_PCS', 'DIFF.PCS', 0, 9),
        N('ISS_QTY', 'ISS.QTY'),
        N('REC_QTY', 'REC.QTY'),
        N('DIFF_QTY', 'DIFF.QTY'),
        { field: 'CURR_STATUS', caption: 'CURR', kind: 'C', len: 10 },
        { field: 'NEW_STATUS', caption: 'TARGET', kind: 'C', len: 10 },
      ],
    },
  },
  {
    form: 'Rpt_Jsm_Os_Update',
    method: 'POST',
    runButtons: ['btn_update'],
    exitButtons: ['btn_cn'],
    lists: {},
    defaults: () => ({}),
    toParams: (_s, btnName) => ({ action: btnName || 'preview' }),
    fallbackColumns: {
      JSM_VW_OS_UPDATE: [
        { field: 'SP_TYPE', caption: 'TYPE', kind: 'C', len: 7 },
        { field: 'AC_NAME', caption: 'ACCOUNT NAME', kind: 'C', len: 26 },
        { field: 'BILL_DATE', caption: 'BILL DATE', kind: 'D', len: 10 },
        { field: 'NCBILL_NO', caption: 'BILL NO', kind: 'C', len: 11 },
        N('BILL_AMT', 'BILL AMT'),
        N('TOTAL_RECAMT', 'REC/PAID AMT'),
        N('DIFF_AMOUNT', 'BALANCE'),
        { field: 'PEND', caption: 'CP', kind: 'C', len: 6 },
        { field: 'TARGET_STATUS', caption: 'NEW STATUS', kind: 'C', len: 12 },
      ],
    },
  },
];
