/**
 * Request Validation Middleware
 * 
 * This middleware validates API request data before processing.
 */

const { ethers } = require('ethers');
const logger = require('../utils/logger');

/**
 * Validate required fields in request body
 * @param {Array<string>} fields - Required field names
 * @returns {Function} Express middleware
 */
const validateRequest = (fields = []) => {
  return (req, res, next) => {
    try {
      // Check if required fields are present
      const missingFields = fields.filter(field => !req.body[field]);
      
      if (missingFields.length > 0) {
        return res.status(400).json({
          error: 'Missing required fields',
          fields: missingFields
        });
      }
      
      // Validate specific fields if needed
      if (req.body.address && !ethers.utils.isAddress(req.body.address)) {
        return res.status(400).json({ error: 'Invalid Ethereum address' });
      }
      
      if (req.body.score !== undefined) {
        const score = parseInt(req.body.score);
        if (isNaN(score) || score < 0 || score > 100) {
          return res.status(400).json({ error: 'Score must be between 0 and 100' });
        }
      }
      
      next();
    } catch (error) {
      logger.error('Validation error:', error);
      res.status(400).json({ error: 'Validation error', message: error.message });
    }
  };
};

/**
 * Validate Ethereum address parameter
 * @param {string} paramName - Parameter name
 * @returns {Function} Express middleware
 */
const validateEthAddress = (paramName = 'address') => {
  return (req, res, next) => {
    try {
      const address = req.params[paramName];
      
      if (!address) {
        return res.status(400).json({ error: `Missing ${paramName} parameter` });
      }
      
      if (!ethers.utils.isAddress(address)) {
        return res.status(400).json({ error: 'Invalid Ethereum address' });
      }
      
      next();
    } catch (error) {
      logger.error('Address validation error:', error);
      res.status(400).json({ error: 'Address validation error', message: error.message });
    }
  };
};

module.exports = {
  validateRequest,
  validateEthAddress
};
