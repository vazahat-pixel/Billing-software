const partyService = require('../services/partyService');
const asyncHandler = require('../utils/asyncHandler');
const { ok, created } = require('../utils/apiResponse');
const AppError = require('../utils/AppError');

exports.createParty = asyncHandler(async (req, res) => {
  if (!req.companyId) throw AppError.forbidden('No company context. Log in with a company user account.');
  const party = await partyService.createParty({ ...req.body, companyId: req.companyId });
  return created(res, party, 'Party created');
});

exports.getParties = asyncHandler(async (req, res) => {
  if (!req.companyId) throw AppError.forbidden('No company context');
  const parties = await partyService.getParties(req.companyId);
  return ok(res, parties);
});

exports.searchParties = asyncHandler(async (req, res) => {
  if (!req.companyId) throw AppError.forbidden('No company context');
  const parties = await partyService.searchParties(req.query.q, req.companyId);
  return ok(res, parties);
});

exports.getParty = asyncHandler(async (req, res) => {
  if (!req.companyId) throw AppError.forbidden('No company context');
  const party = await partyService.getPartyById(req.params.id, req.companyId);
  if (!party) throw AppError.notFound('Party not found');
  return ok(res, party);
});

exports.updateParty = asyncHandler(async (req, res) => {
  if (!req.companyId) throw AppError.forbidden('No company context');
  const party = await partyService.updateParty(req.params.id, req.companyId, {
    ...req.body,
    companyId: req.companyId,
  });
  return ok(res, party, 'Party updated');
});

exports.deleteParty = asyncHandler(async (req, res) => {
  if (!req.companyId) throw AppError.forbidden('No company context');
  await partyService.deleteParty(req.params.id, req.companyId);
  return ok(res, null, 'Party deleted');
});
