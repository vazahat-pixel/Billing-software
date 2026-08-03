const asyncHandler = require('../utils/asyncHandler');
const { ok, created } = require('../utils/apiResponse');
const tdsTcsService = require('../services/tdsTcsService');

const uid = (req) => req.user?._id || req.user?.id || null;
const companyId = (req) => req.companyId || req.query.companyId;

exports.sections = asyncHandler(async (req, res) => {
  return ok(res, tdsTcsService.sections());
});

exports.postTds = asyncHandler(async (req, res) => {
  const doc = await tdsTcsService.postTds(companyId(req), req.body, uid(req));
  return created(res, doc);
});

exports.postTcs = asyncHandler(async (req, res) => {
  const doc = await tdsTcsService.postTcs(companyId(req), req.body, uid(req));
  return created(res, doc);
});

exports.list = asyncHandler(async (req, res) => {
  return ok(res, await tdsTcsService.list(companyId(req), req.query));
});

exports.report = asyncHandler(async (req, res) => {
  return ok(res, await tdsTcsService.report(companyId(req), req.query));
});

exports.issueCertificate = asyncHandler(async (req, res) => {
  return ok(res, await tdsTcsService.issueCertificate(companyId(req), req.params.id, uid(req)));
});
