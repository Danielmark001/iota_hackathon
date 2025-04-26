/**
 * IOTA Query Cache
 * 
 * Implements a caching layer for IOTA queries to reduce network calls
 * and improve performance for commonly accessed data.
 */

const logger = require('./logger');

class IotaCache {
  /**
   * Initialize the cache
   * @param {Object} options - Cache options
   */
  constructor(options = {}) {
    this.options = {
      defaultTTL: options.defaultTTL || 60000, // 1 minute default TTL
      maxSize: options.maxSize || 1000, // Maximum number of items in cache
      cleanupInterval: options.cleanupInterval || 300000, // Cleanup every 5 minutes
      ...options
    };
    
    this.cache = new Map();
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      evictions: 0,
      cleanups: 0
    };
    
    // Start cleanup interval
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, this.options.cleanupInterval);
    
    logger.info(`IOTA Cache initialized with ${this.options.maxSize} items capacity and ${this.options.defaultTTL}ms TTL`);
  }
  
  /**
   * Get an item from cache
   * @param {string} key - Cache key
   * @returns {any} Cached value or undefined if not found
   */
  get(key) {
    const item = this.cache.get(key);
    
    if (!item) {
      this.stats.misses++;
      return undefined;
    }
    
    // Check if item has expired
    if (item.expires && item.expires < Date.now()) {
      this.cache.delete(key);
      this.stats.misses++;
      return undefined;
    }
    
    // Update access time
    item.lastAccessed = Date.now();
    this.stats.hits++;
    
    return item.value;
  }
  
  /**
   * Store an item in cache
   * @param {string} key - Cache key
   * @param {any} value - Value to store
   * @param {number} ttl - Time to live in milliseconds (optional)
   * @returns {boolean} Success status
   */
  set(key, value, ttl = this.options.defaultTTL) {
    // Check if cache is full
    if (this.cache.size >= this.options.maxSize && !this.cache.has(key)) {
      this.evictOne();
    }
    
    const expires = ttl > 0 ? Date.now() + ttl : null;
    
    this.cache.set(key, {
      value,
      expires,
      created: Date.now(),
      lastAccessed: Date.now()
    });
    
    this.stats.sets++;
    return true;
  }
  
  /**
   * Remove an item from cache
   * @param {string} key - Cache key
   * @returns {boolean} True if item was in cache
   */
  delete(key) {
    return this.cache.delete(key);
  }
  
  /**
   * Clear the entire cache
   */
  clear() {
    this.cache.clear();
    logger.info('IOTA Cache cleared');
  }
  
  /**
   * Check if key exists in cache
   * @param {string} key - Cache key
   * @returns {boolean} True if key exists and has not expired
   */
  has(key) {
    const item = this.cache.get(key);
    
    if (!item) {
      return false;
    }
    
    // Check if item has expired
    if (item.expires && item.expires < Date.now()) {
      this.cache.delete(key);
      return false;
    }
    
    return true;
  }
  
  /**
   * Remove expired items from cache
   * @returns {number} Number of items removed
   */
  cleanup() {
    const now = Date.now();
    let removed = 0;
    
    for (const [key, item] of this.cache.entries()) {
      if (item.expires && item.expires < now) {
        this.cache.delete(key);
        removed++;
      }
    }
    
    if (removed > 0) {
      logger.debug(`IOTA Cache cleanup: removed ${removed} expired items`);
    }
    
    this.stats.cleanups++;
    this.stats.evictions += removed;
    
    return removed;
  }
  
  /**
   * Evict one item from cache based on LRU policy
   * @returns {boolean} Success status
   */
  evictOne() {
    // Find least recently used item
    let oldestKey = null;
    let oldestTime = Infinity;
    
    for (const [key, item] of this.cache.entries()) {
      if (item.lastAccessed < oldestTime) {
        oldestKey = key;
        oldestTime = item.lastAccessed;
      }
    }
    
    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.stats.evictions++;
      return true;
    }
    
    return false;
  }
  
  /**
   * Get an item from cache or compute it if not present
   * @param {string} key - Cache key
   * @param {Function} fetcher - Function to fetch/compute value if not in cache
   * @param {number} ttl - Time to live in milliseconds (optional)
   * @returns {Promise<any>} Cached or computed value
   */
  async getOrSet(key, fetcher, ttl = this.options.defaultTTL) {
    const cachedValue = this.get(key);
    
    if (cachedValue !== undefined) {
      return cachedValue;
    }
    
    try {
      const value = await fetcher();
      this.set(key, value, ttl);
      return value;
    } catch (error) {
      logger.error(`Error fetching value for cache key '${key}': ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Refresh an item in cache by fetching it again
   * @param {string} key - Cache key
   * @param {Function} fetcher - Function to fetch/compute value
   * @param {number} ttl - Time to live in milliseconds (optional)
   * @returns {Promise<any>} Refreshed value
   */
  async refresh(key, fetcher, ttl = this.options.defaultTTL) {
    try {
      const value = await fetcher();
      this.set(key, value, ttl);
      return value;
    } catch (error) {
      logger.error(`Error refreshing cache key '${key}': ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Get cache statistics
   * @returns {Object} Cache statistics
   */
  getStats() {
    return {
      ...this.stats,
      size: this.cache.size,
      maxSize: this.options.maxSize,
      hitRate: this.stats.hits / (this.stats.hits + this.stats.misses) || 0
    };
  }
  
  /**
   * Stop the cache cleanup interval
   */
  stop() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

// Create singleton instance
const iotaCache = new IotaCache();

module.exports = iotaCache;
