const asyncHandler = require('../utils/asyncHandler');
const { ok, created } = require('../utils/apiResponse');
const businessAutomationService = require('../services/businessAutomationService');

exports.pipeline = asyncHandler(async (req, res) => {
  return ok(res, await businessAutomationService.pipeline(req.companyId));
});

exports.seedDefaults = asyncHandler(async (req, res) => {
  return ok(res, await businessAutomationService.seedDefaults(req.companyId), 'Defaults seeded');
});

exports.listRules = asyncHandler(async (req, res) => {
  return ok(res, await businessAutomationService.listRules(req.companyId));
});

exports.upsertRule = asyncHandler(async (req, res) => {
  return ok(res, await businessAutomationService.upsertRule(req.companyId, req.body), 'Rule saved');
});

exports.evaluateApproval = asyncHandler(async (req, res) => {
  return ok(
    res,
    await businessAutomationService.evaluateApproval(req.companyId, {
      module: req.body.module || req.query.module,
      amount: req.body.amount ?? req.query.amount,
    })
  );
});

exports.checkDuplicates = asyncHandler(async (req, res) => {
  return ok(
    res,
    await businessAutomationService.checkDuplicates(req.companyId, req.body.module || 'sales', req.body)
  );
});

exports.listSeries = asyncHandler(async (req, res) => {
  return ok(res, await businessAutomationService.listSeries(req.companyId, req.query.module));
});

exports.allocateNumber = asyncHandler(async (req, res) => {
  return ok(
    res,
    await businessAutomationService.allocateNumber(req.companyId, req.body.module || req.query.module, {
      seriesId: req.body.seriesId,
    })
  );
});

exports.listNotifications = asyncHandler(async (req, res) => {
  return ok(
    res,
    await businessAutomationService.listNotifications(req.companyId, {
      status: req.query.status,
      limit: req.query.limit,
    })
  );
});

exports.markRead = asyncHandler(async (req, res) => {
  return ok(res, await businessAutomationService.markNotificationRead(req.companyId, req.params.id), 'Marked read');
});

exports.getOutstanding = asyncHandler(async (req, res) => {
  return ok(res, await businessAutomationService.getOutstanding(req.companyId, req.query.partyId));
});

exports.runLowStock = asyncHandler(async (req, res) => {
  return ok(res, await businessAutomationService.runLowStockScan(req.companyId), 'Low stock scan done');
});

exports.runOverdue = asyncHandler(async (req, res) => {
  return ok(res, await businessAutomationService.runOverdueScan(req.companyId), 'Overdue scan done');
});

exports.createProfitSnapshot = asyncHandler(async (req, res) => {
  return created(res, await businessAutomationService.createProfitSnapshot(req.companyId, req.body));
});

exports.listProfitSnapshots = asyncHandler(async (req, res) => {
  return ok(res, await businessAutomationService.listProfitSnapshots(req.companyId));
});
