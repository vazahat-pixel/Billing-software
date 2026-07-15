/**
 * Cost allocation notes — Sprint 2.6
 *
 * Current behaviour (already in engines):
 * - Purchase lot.rate from purchase line
 * - Job receive finishedRate = (grey material cost + process charges) / receivedQty
 * - Inventory engine weightedAvg valuation API
 *
 * Deferred (document for later stages):
 * - Freight / insurance landed cost split across GRN lines into lot.rate
 * - Multi-process cumulative cost rollup beyond single job receive
 * - Statutory P&L snapshots (ProfitSnapshot is estimated only)
 *
 * Extension point: businessAutomationService — add allocateLandedCost(grnId) when 2.6+ costing expands.
 */
module.exports = {
  documentOnly: true,
  status: 'deferred_landed_cost',
};
