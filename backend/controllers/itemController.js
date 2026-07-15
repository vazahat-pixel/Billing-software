const itemService = require('../services/itemService');
const asyncHandler = require('../utils/asyncHandler');
const { ok, created } = require('../utils/apiResponse');
const AppError = require('../utils/AppError');

exports.createItem = asyncHandler(async (req, res) => {
  if (!req.companyId) throw AppError.forbidden('No company context');
  const item = await itemService.createItem({ ...req.body, companyId: req.companyId });
  return created(res, item, 'Item created');
});

exports.getItems = asyncHandler(async (req, res) => {
  if (!req.companyId) throw AppError.forbidden('No company context');
  const items = await itemService.getItems(req.companyId);
  return ok(res, items);
});

exports.searchItems = asyncHandler(async (req, res) => {
  if (!req.companyId) throw AppError.forbidden('No company context');
  const items = await itemService.searchItems(req.query.q, req.companyId);
  return ok(res, items);
});

exports.getItem = asyncHandler(async (req, res) => {
  if (!req.companyId) throw AppError.forbidden('No company context');
  const item = await itemService.getItemById(req.params.id, req.companyId);
  if (!item) throw AppError.notFound('Item not found');
  return ok(res, item);
});

exports.updateItem = asyncHandler(async (req, res) => {
  if (!req.companyId) throw AppError.forbidden('No company context');
  const item = await itemService.updateItem(req.params.id, req.companyId, {
    ...req.body,
    companyId: req.companyId,
  });
  return ok(res, item, 'Item updated');
});

exports.deleteItem = asyncHandler(async (req, res) => {
  if (!req.companyId) throw AppError.forbidden('No company context');
  await itemService.deleteItem(req.params.id, req.companyId);
  return ok(res, null, 'Item deleted');
});
