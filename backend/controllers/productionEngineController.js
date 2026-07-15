const asyncHandler = require('../utils/asyncHandler');
const { ok, created } = require('../utils/apiResponse');
const productionEngineService = require('../services/productionEngineService');

exports.pipeline = asyncHandler(async (req, res) => {
  return ok(res, await productionEngineService.pipeline(req.companyId));
});

exports.statusBoard = asyncHandler(async (req, res) => {
  return ok(res, await productionEngineService.statusBoard(req.companyId));
});

exports.listJobs = asyncHandler(async (req, res) => {
  return ok(res, await productionEngineService.listJobs(req.companyId, { status: req.query.status }));
});

exports.listChains = asyncHandler(async (req, res) => {
  return ok(res, await productionEngineService.listChainTemplates(req.companyId));
});

exports.createChain = asyncHandler(async (req, res) => {
  return created(res, await productionEngineService.createChainTemplate(req.companyId, req.body));
});

exports.listMappings = asyncHandler(async (req, res) => {
  return ok(
    res,
    await productionEngineService.listItemMappings(req.companyId, { inputItemId: req.query.inputItemId })
  );
});

exports.createMapping = asyncHandler(async (req, res) => {
  return created(res, await productionEngineService.createItemMapping(req.companyId, req.body));
});

exports.resolveMapping = asyncHandler(async (req, res) => {
  return ok(
    res,
    await productionEngineService.resolveMapping(
      req.companyId,
      req.query.inputItemId,
      req.query.processName
    )
  );
});

exports.listProcesses = asyncHandler(async (req, res) => {
  return ok(res, await productionEngineService.listProcesses(req.companyId));
});

exports.issue = asyncHandler(async (req, res) => {
  return created(res, await productionEngineService.issueWithChain(req.companyId, req.body));
});

exports.receive = asyncHandler(async (req, res) => {
  return ok(res, await productionEngineService.receiveFinished(req.companyId, req.body), 'Job received');
});

exports.advanceStep = asyncHandler(async (req, res) => {
  return ok(res, await productionEngineService.advanceStep(req.companyId, req.params.id, req.body), 'Step advanced');
});

exports.performQc = asyncHandler(async (req, res) => {
  return ok(res, await productionEngineService.performQc(req.companyId, req.params.id, req.body), 'QC recorded');
});
