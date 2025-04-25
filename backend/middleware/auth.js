/**
 * Authentication middleware
 */

const jwt = require('jsonwebtoken');
const { ethers } = require('ethers');

// Authentication middleware
const authenticate = (req, res, next) => {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const token = authHeader.split(' ')[1];
    
    // For demo purposes, we'll also accept a demo admin token from .env
    if (token === process.env.ADMIN_TOKEN) {
      req.user = { isAdmin: true };
      return next();
    }
    
    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'intellilend-secret');
    
    // Attach user info to request
    req.user = decoded;
    
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid authentication token' });
  }
};

module.exports = { authenticate };
