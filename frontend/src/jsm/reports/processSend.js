import { toIsoDate } from '../winforms';

/** JSM Reports › Process Reports › Send (Rpt_Process_Issue_Report). Behaviour from its Form1_Load / btn_screen_Click. */
export default {
  form: 'Rpt_Process_Issue_Report',
  lists: { ListView0: 'mills', ListView1: 'purParties', ListView2: 'items', ListView3: 'remark1', ListView4: 'remark2' },
  defaults: ({ fyFrom, fyTo }) => ({
    txt_dt_from: fyFrom,
    txt_dt_to: fyTo,
    Cbo_OrderBy1: 'Register',
    Cbo_OrderBy2: 'None',
    Cbo_Company: 'Current',
    cbo_printout: '1-Continue',
    cbo_process_type: '1-All',
    CheckBox_Summary: false,
    ChkBox_OnlyUnadjust: false,
  }),
  toParams: (s) => ({
    from: toIsoDate(s.txt_dt_from),
    to: toIsoDate(s.txt_dt_to),
    fromText: s.txt_dt_from,
    toText: s.txt_dt_to,
    orderBy1: s.Cbo_OrderBy1,
    orderBy2: s.Cbo_OrderBy2,
    summary: Boolean(s.CheckBox_Summary),
    onlyUnadjust: Boolean(s.ChkBox_OnlyUnadjust),
    processType: s.cbo_process_type,
    printout: s.cbo_printout,
    mills: s.ListView0 || [],
    purParties: s.ListView1 || [],
    items: s.ListView2 || [],
    remark1: s.ListView3 || [],
    remark2: s.ListView4 || [],
  }),
  // JSM creates JSM_VW_PROCESS_ISSUE_SUM_REPORT at run time (StpInsert_Column) when STP_REPORT lacks it.
  fallbackColumns: {
    JSM_VW_PROCESS_ISSUE_SUM_REPORT: [
      { field: 'ZGROUP2', caption: 'Group', kind: 'C', mode: 'D' },
      { field: 'ISS_PCS', caption: 'ISS.PCS', kind: 'N', dec: 0, total: true, mode: 'D' },
      { field: 'ISS_QTY', caption: 'ISS.QTY', kind: 'N', dec: 2, total: true, mode: 'D' },
      { field: 'ISS_KGS', caption: 'ISS.KGS', kind: 'N', dec: 3, total: true, mode: 'D' },
      { field: 'AVG_PU_RATE', caption: 'AVG.RATE', kind: 'N', dec: 2, mode: 'D' },
      { field: 'PU_AMOUNT', caption: 'IT.AMOUNT', kind: 'N', dec: 2, total: true, mode: 'D' },
    ],
  },
};
