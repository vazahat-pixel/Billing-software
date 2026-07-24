/**
 * Global error middleware — single exit for AppError, Mongoose, JWT, etc.
 */
const AppError = require('../utils/AppError');
const ErrorCodes = require('../constants/errorCodes');
const logger = require('../utils/logger');

const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal server error';
  let errorCode = err.errorCode || ErrorCodes.INTERNAL;
  let errors = err.errors || [];

  if (err.name === 'ValidationError' && err.errors) {
    statusCode = 400;
    errorCode = ErrorCodes.VALIDATION_ERROR;
    errors = Object.values(err.errors).map((e) => ({
      field: e.path,
      message: e.message,
    }));
    message = 'Validation failed';
  } else if (err.code === 11000) {
    statusCode = 409;
    errorCode = ErrorCodes.CONFLICT;
    const fields = Object.keys(err.keyPattern || {});
    const field = fields[0] || '';
    const dupValue = err.keyValue ? err.keyValue[field] : null;
    const path = String(req.originalUrl || '');

    if (field === 'invoiceNo' || fields.includes('invoiceNo')) {
      const no = dupValue != null ? ` "${dupValue}"` : '';
      if (path.includes('purchase')) {
        message = `This purchase bill number${no} is already saved. Click New and try again — a new voucher number will be created.`;
      } else if (path.includes('sales') || path.includes('sale')) {
        message = `This sales bill number${no} is already saved. Click New and try again — a new bill number will be created.`;
      } else {
        message = `This voucher number${no} already exists. Please use a new number or click New.`;
      }
    } else if (field === 'lotId' || fields.includes('lotId')) {
      message = 'Stock lot conflict while saving. Please click Save once more.';
    } else if (field === 'idempotencyKey' || fields.includes('idempotencyKey')) {
      message = 'This entry was already processed. Refresh the list, or click New for a fresh bill.';
    } else if (field === 'code' || fields.includes('code')) {
      message = dupValue != null
        ? `Code "${dupValue}" already exists. Please use a different code.`
        : 'This code already exists. Please use a different code.';
    } else if (field === 'name' || fields.includes('name')) {
      message = dupValue != null
        ? `"${dupValue}" already exists. Please use a different name.`
        : 'This name already exists. Please use a different name.';
    } else if (field === 'gstin' || fields.includes('gstin')) {
      message = 'This GSTIN is already registered for another party.';
    } else {
      message = 'This record already exists (duplicate). Please change the details or open a new entry.';
    }
    errors = [{ field: field || 'unknown', message }];
  } else if (err.name === 'CastError') {
    statusCode = 400;
    errorCode = ErrorCodes.VALIDATION_ERROR;
    message = 'Invalid reference selected. Please refresh and choose again.';
  } else if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    errorCode = ErrorCodes.AUTH_INVALID;
    message = 'Your session is invalid. Please sign in again.';
  } else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    errorCode = ErrorCodes.AUTH_INVALID;
    message = 'Your session expired. Please sign in again.';
  }

  // Never leak internal jargon to clients in production-facing message
  if (/E11000|MongoServerError|Cast to ObjectId/i.test(String(message))) {
    message = statusCode === 409
      ? 'This record already exists. Please use different details or click New.'
      : 'Something went wrong while saving. Please try again.';
  }

  if (!(err instanceof AppError) || !err.isOperational) {
    logger.error(message, {
      requestId: req.requestId,
      path: req.originalUrl,
      method: req.method,
      companyId: req.companyId?.toString?.() || req.companyId,
      stack: process.env.NODE_ENV === 'production' ? undefined : err.stack,
    });
  } else {
    logger.warn(message, {
      requestId: req.requestId,
      path: req.originalUrl,
      errorCode,
      statusCode,
    });
  }

  res.status(statusCode).json({
    success: false,
    message,
    errorCode,
    errors,
    data: null,
    meta: {
      requestId: req.requestId || null,
    },
    ...(process.env.NODE_ENV === 'production' ? {} : { stack: err.stack }),
  });
};

module.exports = errorHandler;
