/**
 * Request validation middleware
 */

const validateRequest = (requiredFields) => {
  return (req, res, next) => {
    // Check if all required fields are present in the request body
    const missingFields = requiredFields.filter(field => !req.body[field]);
    
    if (missingFields.length > 0) {
      return res.status(400).json({
        error: 'Missing required fields',
        missingFields
      });
    }
    
    next();
  };
};

module.exports = { validateRequest };
