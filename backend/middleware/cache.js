/**
 * Caching Middleware
 * 
 * This middleware provides in-memory caching for API responses.
 */

const logger = require('../utils/logger');

// Simple in-memory cache
const cache = new Map();

/**
 * Cache middleware for API responses
 * @param {number} duration - Cache duration in seconds
 * @returns {Function} Express middleware
 */
const cacheMiddleware = (duration = 60) => {
  return (req, res, next) => {
    // Skip caching for non-GET requests
    if (req.method !== 'GET') {
      return next();
    }
    
    // Create cache key from URL
    const cacheKey = req.originalUrl || req.url;
    
    // Check if we have a cached response
    const cachedResponse = cache.get(cacheKey);
    
    if (cachedResponse && cachedResponse.expiry > Date.now()) {
      // Return cached response
      logger.debug(`Cache hit for ${cacheKey}`);
      return res.json(cachedResponse.data);
    }
    
    // Cache miss, continue to handler
    logger.debug(`Cache miss for ${cacheKey}`);
    
    // Store original json method
    const originalJson = res.json;
    
    // Override json method to cache the response
    res.json = function(data) {
      // Store in cache
      cache.set(cacheKey, {
        data,
        expiry: Date.now() + (duration * 1000)
      });
      
      // Call original json method
      return originalJson.call(this, data);
    };
    
    next();
  };
};

/**
 * Clear cache for a specific key or all cache
 * @param {string|null} key - Cache key to clear (null for all)
 */
const clearCache = (key = null) => {
  if (key) {
    logger.debug(`Clearing cache for ${key}`);
    cache.delete(key);
  } else {
    logger.debug('Clearing all cache');
    cache.clear();
  }
};

/**
 * Get cache stats
 * @returns {Object} Cache statistics
 */
const getCacheStats = () => {
  const stats = {
    size: cache.size,
    keys: [],
    memoryUsage: 0
  };
  
  // Get keys and estimate memory usage
  for (const [key, value] of cache.entries()) {
    stats.keys.push(key);
    
    // Rough estimate of memory usage
    const jsonSize = JSON.stringify(value.data).length;
    stats.memoryUsage += jsonSize;
  }
  
  return stats;
};

module.exports = {
  cacheMiddleware,
  clearCache,
  getCacheStats
};
