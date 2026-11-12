export default {
  form: 'Stp_DataBaseFromTo',
  runButtons: ['btn_ok', 'Btn_JCompany'],
  exitButtons: ['btn_cancel'],
  lists: {},
  defaults: () => ({}),
  toParams: (_s, btnName) => ({ action: btnName || 'btn_ok' }),
  fallbackColumns: {
    JSM_VW_DB_REPAIR: [
      { field: 'TABLE_NAME', caption: 'COLLECTION / TABLE', kind: 'C', len: 30 },
      { field: 'TOTAL_RECORDS', caption: 'RECORDS', kind: 'N', dec: 0, total: true, len: 12 },
      { field: 'ISSUE_COUNT', caption: 'ISSUES', kind: 'N', dec: 0, total: true, len: 10 },
      { field: 'STATUS', caption: 'STATUS', kind: 'C', len: 10 },
      { field: 'DETAILS', caption: 'DIAGNOSTIC DETAILS', kind: 'C', len: 38 },
    ],
  },
};

