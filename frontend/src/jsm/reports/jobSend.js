import { detailConfig } from './detailConfig';

/** JSM Reports › JobWork Reports › Send (Rpt_Job_IssueReport). */
// Columns come from the captured JSM_VW_JOBWORK_ISSUE_REPORT layout (JSM's own STP_REPORT), so the
// grid shows exactly JSM's seven columns with its captions and widths — no hand-written guess.
export default detailConfig({
  form: 'Rpt_Job_IssueReport',
  lists: { ListView0: 'parties', ListView1: 'brokers', ListView2: 'items', ListView3: 'books' },
});
