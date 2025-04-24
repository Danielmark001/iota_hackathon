/**
 * Error Handler Utility
 * 
 * Provides unified error handling for the API
 */

const logger = require('./logger');

// Custom error classes
class ApiError extends Error {
  constructor(message, statusCode, errorCode = null) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends ApiError {
  constructor(message, errors = []) {
    super(message, 400);
    this.errors = errors;
  }
}

class AuthenticationError extends ApiError {
  constructor(message = 'Authentication required') {
    super(message, 401, 'AUTH_REQUIRED');
  }
}

class AuthorizationError extends ApiError {
  constructor(message = 'Permission denied') {
    super(message, 403, 'PERMISSION_DENIED');
  }
}

class NotFoundError extends ApiError {
  constructor(message = 'Resource not found') {
    super(message, 404, 'NOT_FOUND');
  }
}

class BlockchainError extends ApiError {
  constructor(message, errorCode = 'BLOCKCHAIN_ERROR') {
    super(message, 500, errorCode);
  }
}

class BridgeError extends ApiError {
  constructor(message, errorCode = 'BRIDGE_ERROR') {
    super(message, 500, errorCode);
  }
}

/**
 * Handle errors in a consistent way
 * @param {Object} res - Express response object
 * @param {Error} error - Error to handle
 * @returns {Object} - JSON response with error details
 */
const handleError = (res, error) => {
  // Default is 500 Internal Server Error
  let statusCode = 500;
  let errorCode = 'INTERNAL_SERVER_ERROR';
  let validationErrors = [];
  
  // Determine type of error and set appropriate status code
  if (error instanceof ApiError) {
    statusCode = error.statusCode;
    errorCode = error.errorCode || errorCode;
    
    if (error instanceof ValidationError) {
      validationErrors = error.errors;
    }
  } else if (error.name === 'ValidationError' && error.errors) {
    // Handle Joi/Express-validator validation errors
    statusCode = 400;
    errorCode = 'VALIDATION_ERROR';
    validationErrors = Object.entries(error.errors).map(([field, error]) => ({
      field,
      message: error.message
    }));
  } else if (error.name === 'SyntaxError') {
    statusCode = 400;
    errorCode = 'INVALID_JSON';
  } else if (error.name === 'JsonWebTokenError') {
    statusCode = 401;
    errorCode = 'INVALID_TOKEN';
  } else if (error.name === 'TokenExpiredError') {
    statusCode = 401;
    errorCode = 'TOKEN_EXPIRED';
  }
  
  // Log the error (with stack trace for server errors)
  if (statusCode >= 500) {
    logger.error(`[${errorCode}] ${error.message}`, { stack: error.stack });
  } else {
    logger.warn(`[${errorCode}] ${error.message}`);
  }
  
  // Prepare response
  const errorResponse = {
    success: false,
    error: error.message,
    errorCode
  };
  
  // Add validation errors if any
  if (validationErrors.length > 0) {
    errorResponse.validationErrors = validationErrors;
  }
  
  // Return error response
  return res.status(statusCode).json(errorResponse);
};

module.exports = {
  ApiError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  BlockchainError,
  BridgeError,
  handleError
};
