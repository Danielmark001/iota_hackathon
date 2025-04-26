/**
 * Validation middleware
 * 
 * Provides request validation helpers.
 */

const logger = require('../utils/logger');

/**
 * Validates that the request body contains the required fields
 * @param {Array} requiredFields - Array of required field names
 * @returns {Function} Middleware function
 */
exports.validateRequest = (requiredFields) => {
  return (req, res, next) => {
    const missingFields = requiredFields.filter(field => !req.body[field]);
    
    if (missingFields.length > 0) {
      logger.warn(`Request validation failed. Missing fields: ${missingFields.join(', ')}`);
      return res.status(400).json({
        error: 'Validation Error',
        message: `Missing required fields: ${missingFields.join(', ')}`
      });
    }
    
    next();
  };
};

/**
 * Validates that the request query params contain the required fields
 * @param {Array} requiredParams - Array of required parameter names
 * @returns {Function} Middleware function
 */
exports.validateQueryParams = (requiredParams) => {
  return (req, res, next) => {
    const missingParams = requiredParams.filter(param => !req.query[param]);
    
    if (missingParams.length > 0) {
      logger.warn(`Query param validation failed. Missing params: ${missingParams.join(', ')}`);
      return res.status(400).json({
        error: 'Validation Error',
        message: `Missing required query parameters: ${missingParams.join(', ')}`
      });
    }
    
    next();
  };
};

/**
 * Validates that the request path params contain the required fields
 * @param {Array} requiredParams - Array of required parameter names
 * @returns {Function} Middleware function
 */
exports.validatePathParams = (requiredParams) => {
  return (req, res, next) => {
    const missingParams = requiredParams.filter(param => !req.params[param]);
    
    if (missingParams.length > 0) {
      logger.warn(`Path param validation failed. Missing params: ${missingParams.join(', ')}`);
      return res.status(400).json({
        error: 'Validation Error',
        message: `Missing required path parameters: ${missingParams.join(', ')}`
      });
    }
    
    next();
  };
};
