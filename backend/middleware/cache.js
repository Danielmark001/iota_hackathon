/**
 * Simple memory cache middleware
 */

// In-memory cache
const cache = new Map();

// Cache middleware
const cacheMiddleware = (duration = 60) => {
  return (req, res, next) => {
    // Generate cache key from URL and query params
    const key = req.originalUrl || req.url;
    
    // Check if request is in cache and not expired
    const cachedResponse = cache.get(key);
    
    if (cachedResponse && Date.now() < cachedResponse.expiry) {
      // Return cached response
      return res.json(cachedResponse.data);
    }
    
    // Store original res.json method
    const originalJson = res.json;
    
    // Override res.json method to cache response
    res.json = function(data) {
      // Cache response before sending
      cache.set(key, {
        data,
        expiry: Date.now() + (duration * 1000)
      });
      
      // Call original method
      return originalJson.call(this, data);
    };
    
    next();
  };
};

module.exports = { cacheMiddleware };
