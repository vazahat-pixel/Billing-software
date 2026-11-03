'use strict';

/**
 * JSM's Outstanding family — Debitor/Creditor/Process/Jobwork O/s and their Age Analysis screens.
 *   Reports › Sales › Sales Bill › Sales Outstanding            Rpt_Jsm_Os_Sales
 *   Reports › Purchase › Purchase Bill › Purchase Outstanding   Rpt_Jsm_Os_Purchase
 *   Others Reports › Outstanding (+ Outstanding Zoom)           all four, + AgeAnalysis
 * See outstandingReport.js for how the screen's controls map onto these rows; the balance and
 * aging figures are reportService.getOutstanding(), never recomputed here.
 */
const { outstandingReport } = require('../outstandingReport');

const SPECS = {
  sales: { kind: 'sales', view: 'JSM_VW_OS_SALES', ageView: 'JSM_VW_OS_SALES_AGEANALYSIS', categories: [1, 2, 3, 4, 5], noun: 'Debitor' },
  purchase: { kind: 'purchase', view: 'JSM_VW_OS_PURCHASE', ageView: 'JSM_VW_OS_PURCHASE_AGEANALYSIS', categories: [1, 2, 3, 4, 5], noun: 'Creditor' },
  process: { kind: 'process', view: 'JSM_VW_OS_PROCESS', ageView: 'JSM_VW_OS_PROCESS_AGEANALYSIS', categories: [1, 2, 3], noun: 'Process' },
  jobwork: { kind: 'jobwork', view: 'JSM_VW_OS_JOBWORK', ageView: 'JSM_VW_OS_JOBWORK_AGEANALYSIS', categories: [1, 2, 3], noun: 'Jobwork' },
};

const builders = Object.fromEntries(Object.entries(SPECS).map(([k, spec]) => [k, outstandingReport(spec)]));

/** Wrap a builder's `run`/`runAge` as the {run, options} shape the report registry expects. */
const asReport = (builder, which) => ({
  run: which === 'age' ? builder.runAge : builder.run,
  options: builder.options,
});

module.exports = {
  os: Object.fromEntries(Object.entries(builders).map(([k, b]) => [k, asReport(b, 'main')])),
  osAge: Object.fromEntries(Object.entries(builders).map(([k, b]) => [k, asReport(b, 'age')])),
};
