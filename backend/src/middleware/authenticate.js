/**
 * Authentication middleware
 * 
 * Provides request authentication.
 */

const logger = require('../utils/logger');
const jwt = require('jsonwebtoken');

/**
 * Basic authentication middleware
 * Verifies JWT token in Authorization header
 */
const authenticate = (req, res, next) => {
  // For development mode, bypass authentication
  if (process.env.NODE_ENV === 'development' && process.env.BYPASS_AUTH === 'true') {
    logger.warn('DEVELOPMENT MODE: Authentication bypassed');
    return next();
  }
  
  try {
    // Get authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Authentication Error',
        message: 'Missing or invalid Authorization header'
      });
    }
    
    // Extract token
    const token = authHeader.split(' ')[1];
    
    // Verify JWT token
    const secret = process.env.JWT_SECRET || 'intellilend-secret-key';
    const decoded = jwt.verify(token, secret);
    
    // Attach user data to request
    req.user = decoded;
    
    next();
  } catch (error) {
    logger.error(`Authentication error: ${error.message}`);
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Authentication Error',
        message: 'Token expired'
      });
    }
    
    return res.status(401).json({
      error: 'Authentication Error',
      message: 'Invalid token'
    });
  }
};

module.exports = authenticate;
