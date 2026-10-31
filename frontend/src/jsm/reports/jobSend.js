import { detailConfig } from './detailConfig';

/** JSM Reports › JobWork Reports › Send (Rpt_Job_IssueReport). */
export default {
  ...detailConfig({
    form: 'Rpt_Job_IssueReport',
    lists: { ListView0: 'parties', ListView1: 'brokers', ListView2: 'items', ListView3: 'books' },
  }),
  // STP_REPORT has no row for JSM_VW_JOBWORK_ISSUE_REPORT, so JSM builds its columns at run time
  // (StpInsert_Column) exactly as it does for the process Send summary. Without this the grid came
  // up with no columns at all. Same column set and widths as JSM_VW_PROCESS_ISSUE_REPORT, with the
  // job worker as PARTY and the job rate added.
  fallbackColumns: {
    JSM_VW_JOBWORK_ISSUE_REPORT: [
      { field: 'NCCHLN_NO', caption: 'CH.NO', kind: 'C', len: 5 },
      { field: 'CHLN_DATE', caption: 'CH.DATE', kind: 'D', len: 10 },
      { field: 'PARTY', caption: 'PARTY NAME', kind: 'C', len: 20 },
      { field: 'ITEM', caption: 'ITEM NAME', kind: 'C', len: 18 },
      { field: 'ISS_PCS', caption: 'PCS', kind: 'N', dec: 0, total: true, len: 5 },
      { field: 'ISS_QTY', caption: 'MTS', kind: 'N', dec: 2, total: true, len: 10 },
      { field: 'JOB_RATE', caption: 'J.RATE', kind: 'N', dec: 2, len: 9 },
      { field: 'LOT_NO', caption: 'LOTNO', kind: 'C', len: 6 },
      { field: 'REMARK_1', caption: 'REMARK1', kind: 'C', len: 8 },
      { field: 'PURPARTY', caption: 'PUR.PARTY', kind: 'C', len: 15 },
      { field: 'PU_BILLNO', caption: 'PUR.BILLNO', kind: 'C', len: 10 },
    ],
  },
};
