const AppError = require('../utils/AppError');

/**
 * Lightweight field validator — Sprint 1.3 can swap for Joi/Zod without changing call sites.
 * rules: { field: { required, type: 'string'|'number'|'objectId'|'email'|'date'|'boolean', enum, min, max } }
 */
const isObjectId = (v) => typeof v === 'string' && /^[a-fA-F0-9]{24}$/.test(v);

const validateBody = (rules) => (req, res, next) => {
  const errors = [];
  const body = req.body || {};

  for (const [field, rule] of Object.entries(rules || {})) {
    const value = body[field];
    const present = value !== undefined && value !== null && value !== '';

    if (rule.required && !present) {
      errors.push({ field, message: `${field} is required` });
      continue;
    }
    if (!present) continue;

    if (rule.type === 'string' && typeof value !== 'string') {
      errors.push({ field, message: `${field} must be a string` });
    }
    if (rule.type === 'number' && Number.isNaN(Number(value))) {
      errors.push({ field, message: `${field} must be a number` });
    }
    if (rule.type === 'boolean' && typeof value !== 'boolean') {
      errors.push({ field, message: `${field} must be boolean` });
    }
    if (rule.type === 'objectId' && !isObjectId(String(value))) {
      errors.push({ field, message: `${field} must be a valid ObjectId` });
    }
    if (rule.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value))) {
      errors.push({ field, message: `${field} must be a valid email` });
    }
    if (rule.type === 'date' && Number.isNaN(Date.parse(value))) {
      errors.push({ field, message: `${field} must be a valid date` });
    }
    if (rule.enum && !rule.enum.includes(value)) {
      errors.push({ field, message: `${field} must be one of: ${rule.enum.join(', ')}` });
    }
    if (rule.min != null && Number(value) < rule.min) {
      errors.push({ field, message: `${field} must be >= ${rule.min}` });
    }
    if (rule.max != null && Number(value) > rule.max) {
      errors.push({ field, message: `${field} must be <= ${rule.max}` });
    }
  }

  if (errors.length) {
    return next(AppError.badRequest('Validation failed', errors));
  }
  return next();
};

const validateObjectIdParam = (paramName = 'id') => (req, res, next) => {
  const value = req.params[paramName];
  if (!isObjectId(String(value))) {
    return next(AppError.badRequest(`Invalid ${paramName}`, [{ field: paramName, message: 'Must be ObjectId' }]));
  }
  return next();
};

module.exports = { validateBody, validateObjectIdParam, isObjectId };
