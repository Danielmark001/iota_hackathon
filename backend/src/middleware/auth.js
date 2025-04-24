/**
 * Authentication Middleware
 * 
 * Handles user authentication and authorization
 */

const jwt = require('jsonwebtoken');
const ethers = require('ethers');
const { AuthenticationError, AuthorizationError } = require('../utils/errorHandler');
const config = require('../config');
const logger = require('../utils/logger');

/**
 * Verify JWT token
 * @param {string} token - JWT token
 * @returns {Object} - Decoded token payload
 */
const verifyToken = (token) => {
  try {
    return jwt.verify(token, config.jwt.secret);
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new AuthenticationError('Token expired');
    }
    throw new AuthenticationError('Invalid token');
  }
};

/**
 * Verify Ethereum signature
 * @param {string} address - Ethereum address
 * @param {string} message - Original message
 * @param {string} signature - Signature to verify
 * @returns {boolean} - Whether signature is valid
 */
const verifySignature = (address, message, signature) => {
  try {
    // Recover signer address from signature
    const messageHash = ethers.utils.hashMessage(message);
    const recoveredAddress = ethers.utils.recoverAddress(messageHash, signature);
    
    // Check if recovered address matches claimed address
    return recoveredAddress.toLowerCase() === address.toLowerCase();
  } catch (error) {
    logger.error(`Signature verification error: ${error.message}`);
    return false;
  }
};

/**
 * Generate a nonce for address authentication
 * @param {string} address - Ethereum address
 * @returns {string} - Nonce
 */
const generateNonce = (address) => {
  // In a real application, you'd store this nonce in a database
  // For simplicity, we'll just generate a random string
  const timestamp = Date.now();
  const randomPart = Math.random().toString(36).substring(2, 15);
  
  return `Sign this message to authenticate with IntelliLend: ${randomPart}-${timestamp}`;
};

/**
 * Authentication middleware
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const authenticate = (req, res, next) => {
  try {
    // Get authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      throw new AuthenticationError('Authorization header missing');
    }
    
    // Check if it's a JWT or signature-based authentication
    if (authHeader.startsWith('Bearer ')) {
      // JWT authentication
      const token = authHeader.substring(7);
      const decoded = verifyToken(token);
      
      // Attach user to request
      req.user = decoded;
      next();
    } else if (authHeader.startsWith('Signature ')) {
      // Signature-based authentication
      const parts = authHeader.substring(10).split(':');
      
      if (parts.length !== 3) {
        throw new AuthenticationError('Invalid signature format');
      }
      
      const [address, message, signature] = parts;
      
      // Verify signature
      if (!verifySignature(address, message, signature)) {
        throw new AuthenticationError('Invalid signature');
      }
      
      // Check if nonce is valid and not expired
      // In a real application, you'd verify the nonce from a database
      // For simplicity, we'll just check if the message contains our prefix
      if (!message.startsWith('Sign this message to authenticate with IntelliLend:')) {
        throw new AuthenticationError('Invalid nonce');
      }
      
      // Attach user to request
      req.user = {
        address,
        authenticationType: 'signature'
      };
      
      next();
    } else {
      throw new AuthenticationError('Unsupported authentication method');
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Authorization middleware for admin access
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const authorizeAdmin = (req, res, next) => {
  try {
    // Check if user is authenticated
    if (!req.user) {
      throw new AuthenticationError('Authentication required');
    }
    
    // Check if user is an admin
    if (!req.user.isAdmin) {
      throw new AuthorizationError('Admin privileges required');
    }
    
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Middleware to validate the address in the request matches the authenticated user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const validateAddress = (req, res, next) => {
  try {
    // Check if user is authenticated
    if (!req.user) {
      throw new AuthenticationError('Authentication required');
    }
    
    // Get address from request body or params
    const requestAddress = req.body.address || req.params.address;
    
    if (!requestAddress) {
      throw new AuthorizationError('Address not provided');
    }
    
    // Normalize addresses for comparison
    const normalizedUserAddress = req.user.address.toLowerCase();
    const normalizedRequestAddress = requestAddress.toLowerCase();
    
    // Check if addresses match
    if (normalizedUserAddress !== normalizedRequestAddress) {
      throw new AuthorizationError('Address does not match authenticated user');
    }
    
    next();
  } catch (error) {
    next(error);
  }
};

module.exports = {
  authenticate,
  authorizeAdmin,
  validateAddress,
  generateNonce,
  verifySignature
};
