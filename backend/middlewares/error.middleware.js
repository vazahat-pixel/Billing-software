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
    message = 'Duplicate key conflict';
    errors = [{ field: Object.keys(err.keyPattern || {})[0] || 'unknown', message: 'Already exists' }];
  } else if (err.name === 'CastError') {
    statusCode = 400;
    errorCode = ErrorCodes.VALIDATION_ERROR;
    message = `Invalid ${err.path || 'id'}`;
  } else if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    errorCode = ErrorCodes.AUTH_INVALID;
    message = 'Invalid token';
  } else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    errorCode = ErrorCodes.AUTH_INVALID;
    message = 'Token expired';
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
