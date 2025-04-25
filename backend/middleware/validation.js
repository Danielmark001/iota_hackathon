/**
 * Request validation middleware
 */

// Validate request body
const validateRequest = (requiredFields) => {
  return (req, res, next) => {
    // Check if request body exists
    if (!req.body) {
      return res.status(400).json({
        error: 'Request body is required'
      });
    }
    
    // Check if all required fields are present
    const missingFields = requiredFields.filter(field => !req.body[field]);
    
    if (missingFields.length > 0) {
      return res.status(400).json({
        error: `Missing required fields: ${missingFields.join(', ')}`
      });
    }
    
    next();
  };
};

module.exports = { validateRequest };
