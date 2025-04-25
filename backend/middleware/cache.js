/**
 * Simple in-memory cache middleware
 */

// In-memory cache store
const cache = new Map();

// Cache middleware with TTL
const cacheMiddleware = (ttlSeconds) => {
  return (req, res, next) => {
    // Skip caching for non-GET requests
    if (req.method !== 'GET') {
      return next();
    }
    
    // Create a cache key from the full URL
    const key = req.originalUrl || req.url;
    
    // Check if we have a cached response
    const cachedResponse = cache.get(key);
    
    if (cachedResponse && cachedResponse.expiry > Date.now()) {
      // Return cached response
      return res.json(cachedResponse.data);
    }
    
    // Store the original json method
    const originalJson = res.json;
    
    // Override json method to cache the response
    res.json = function(data) {
      // Store in cache
      cache.set(key, {
        data,
        expiry: Date.now() + (ttlSeconds * 1000)
      });
      
      // Call the original json method
      return originalJson.call(this, data);
    };
    
    next();
  };
};

module.exports = { cacheMiddleware };
