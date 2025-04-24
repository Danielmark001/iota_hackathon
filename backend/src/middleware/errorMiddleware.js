/**
 * Error Middleware
 * 
 * Global error handling middleware for the API
 */

const logger = require('../utils/logger');
const { ApiError } = require('../utils/errorHandler');

/**
 * Error handling middleware
 * @param {Error} err - Error object
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const errorMiddleware = (err, req, res, next) => {
  // Default is 500 Internal Server Error
  let statusCode = 500;
  let errorCode = 'INTERNAL_SERVER_ERROR';
  let validationErrors = [];
  let errorMessage = err.message || 'Internal Server Error';
  
  // Determine type of error and set appropriate status code
  if (err instanceof ApiError) {
    statusCode = err.statusCode;
    errorCode = err.errorCode || errorCode;
    
    if (err.errors && Array.isArray(err.errors)) {
      validationErrors = err.errors;
    }
  } else if (err.name === 'ValidationError' && err.errors) {
    // Handle Joi/Express-validator validation errors
    statusCode = 400;
    errorCode = 'VALIDATION_ERROR';
    validationErrors = Object.entries(err.errors).map(([field, error]) => ({
      field,
      message: error.message
    }));
  } else if (err.name === 'SyntaxError') {
    statusCode = 400;
    errorCode = 'INVALID_JSON';
  } else if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    errorCode = 'INVALID_TOKEN';
  } else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    errorCode = 'TOKEN_EXPIRED';
  } else if (err.name === 'CastError') {
    statusCode = 400;
    errorCode = 'INVALID_ID';
  } else if (err.code === 11000) {
    // MongoDB duplicate key error
    statusCode = 409;
    errorCode = 'DUPLICATE_ERROR';
    errorMessage = 'Duplicate key error';
  }
  
  // Log the error (with stack trace for server errors)
  if (statusCode >= 500) {
    logger.error(`[${errorCode}] ${errorMessage}`, { 
      stack: err.stack,
      path: req.path,
      method: req.method,
      ip: req.ip
    });
  } else {
    logger.warn(`[${errorCode}] ${errorMessage}`, { 
      path: req.path,
      method: req.method,
      ip: req.ip
    });
  }
  
  // Prepare response
  const errorResponse = {
    success: false,
    error: errorMessage,
    errorCode,
    path: req.path,
    timestamp: new Date().toISOString()
  };
  
  // Add validation errors if any
  if (validationErrors.length > 0) {
    errorResponse.validationErrors = validationErrors;
  }
  
  // Send the error response
  res.status(statusCode).json(errorResponse);
};

module.exports = {
  errorMiddleware
};
