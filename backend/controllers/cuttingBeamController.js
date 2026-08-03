const asyncHandler = require('../utils/asyncHandler');
const { ok, created } = require('../utils/apiResponse');
const cuttingBeamService = require('../services/cuttingBeamService');

const companyId = (req) => req.companyId || req.query.companyId;
const uid = (req) => req.user?._id || req.user?.id || null;

exports.createCutting = asyncHandler(async (req, res) => {
  const entry = await cuttingBeamService.createCuttingEntry(companyId(req), req.body, uid(req));
  return created(res, entry);
});

exports.listCutting = asyncHandler(async (req, res) => {
  return ok(res, await cuttingBeamService.listCuttingEntries(companyId(req), req.query));
});

exports.createBeam = asyncHandler(async (req, res) => {
  const entry = await cuttingBeamService.createBeamEntry(companyId(req), req.body, uid(req));
  return created(res, entry);
});

exports.listBeam = asyncHandler(async (req, res) => {
  return ok(res, await cuttingBeamService.listBeamEntries(companyId(req), req.query));
});
