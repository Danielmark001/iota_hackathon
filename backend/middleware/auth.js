/**
 * Authentication middleware for protected routes
 */

const authenticate = (req, res, next) => {
  // For development purposes, bypass authentication
  // In production, this would verify JWT tokens or API keys
  next();
};

module.exports = { authenticate };
