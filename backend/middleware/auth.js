/**
 * Authentication Middleware
 * 
 * This middleware handles authentication for protected API endpoints.
 */

const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

/**
 * Authenticate requests using JWT
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Next middleware function
 */
const authenticate = (req, res, next) => {
  try {
    // Get authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    // Check if it's a Bearer token
    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Invalid authentication format' });
    }
    
    // Extract token
    const token = authHeader.split(' ')[1];
    
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'intellilend-dev-secret');
    
    // Add user data to request
    req.user = decoded;
    
    // Check if user has admin permissions
    if (req.path.startsWith('/api/admin') && !decoded.isAdmin) {
      return res.status(403).json({ error: 'Admin privileges required' });
    }
    
    next();
  } catch (error) {
    logger.error('Authentication error:', error);
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    
    res.status(500).json({ error: 'Authentication error', message: error.message });
  }
};

/**
 * Generate JWT token for a user
 * @param {Object} user - User data
 * @param {string} expiresIn - Token expiration (default: 24h)
 * @returns {string} JWT token
 */
const generateToken = (user, expiresIn = '24h') => {
  return jwt.sign(
    {
      address: user.address,
      isAdmin: user.isAdmin || false
    },
    process.env.JWT_SECRET || 'intellilend-dev-secret',
    { expiresIn }
  );
};

module.exports = {
  authenticate,
  generateToken
};
