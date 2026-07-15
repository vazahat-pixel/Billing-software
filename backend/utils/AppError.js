/**
 * Application error — throw from services; global error middleware formats response.
 */
const ErrorCodes = require('../constants/errorCodes');

class AppError extends Error {
  constructor(message, { statusCode = 400, errorCode = ErrorCodes.INTERNAL, errors = [], isOperational = true } = {}) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.errors = Array.isArray(errors) ? errors : [];
    this.isOperational = isOperational;
    Error.captureStackTrace?.(this, this.constructor);
  }

  static badRequest(message, errors = []) {
    return new AppError(message, { statusCode: 400, errorCode: ErrorCodes.VALIDATION_ERROR, errors });
  }

  static unauthorized(message = 'Authentication required') {
    return new AppError(message, { statusCode: 401, errorCode: ErrorCodes.AUTH_REQUIRED });
  }

  static forbidden(message = 'Forbidden', errorCode = ErrorCodes.FORBIDDEN) {
    return new AppError(message, { statusCode: 403, errorCode });
  }

  static notFound(message = 'Resource not found') {
    return new AppError(message, { statusCode: 404, errorCode: ErrorCodes.NOT_FOUND });
  }

  static conflict(message = 'Conflict') {
    return new AppError(message, { statusCode: 409, errorCode: ErrorCodes.CONFLICT });
  }

  static paymentRequired(message = 'Subscription inactive') {
    return new AppError(message, { statusCode: 402, errorCode: ErrorCodes.SUBSCRIPTION_INACTIVE });
  }
}

module.exports = AppError;
