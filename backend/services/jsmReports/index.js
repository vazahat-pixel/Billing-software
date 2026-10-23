'use strict';

/** JSM-identical reports, keyed by the JSM form that defines them. */
const REPORTS = {
  Rpt_Process_Issue_Report: require('./reports/processSend'),
};

function get(reportId) {
  const report = REPORTS[reportId];
  if (!report) {
    const err = new Error(`Unknown JSM report: ${reportId}`);
    err.status = 404;
    throw err;
  }
  return report;
}

module.exports = { get, ids: () => Object.keys(REPORTS) };
