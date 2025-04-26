/**
 * Simple in-memory cache utility
 * 
 * Provides caching functionality for the application
 */

class Cache {
  constructor(options = {}) {
    this.ttl = options.ttl || 60; // Default TTL in seconds
    this.checkPeriod = options.checkPeriod || 600; // Default check period in seconds
    this.maxSize = options.maxSize || 100; // Default max size
    this.data = new Map();
    
    // Setup periodic cleanup
    this.interval = setInterval(() => this.cleanup(), this.checkPeriod * 1000);
  }
  
  /**
   * Set a value in the cache
   * @param {string} key - Cache key
   * @param {any} value - Value to store
   * @param {number} ttl - TTL in seconds (optional, defaults to cache-wide TTL)
   * @returns {boolean} - Success
   */
  set(key, value, ttl = this.ttl) {
    // Check if cache is full
    if (this.data.size >= this.maxSize && !this.data.has(key)) {
      // If cache is full, delete the oldest entry
      const oldest = [...this.data.entries()].sort((a, b) => a[1].created - b[1].created)[0];
      if (oldest) {
        this.data.delete(oldest[0]);
      }
    }
    
    // Set value with expiry
    this.data.set(key, {
      value,
      expiry: Date.now() + (ttl * 1000),
      created: Date.now()
    });
    
    return true;
  }
  
  /**
   * Get a value from the cache
   * @param {string} key - Cache key
   * @returns {any} - Cached value or undefined if not found or expired
   */
  get(key) {
    const item = this.data.get(key);
    
    // Check if item exists and is not expired
    if (item && item.expiry > Date.now()) {
      return item.value;
    }
    
    // Delete expired item
    if (item) {
      this.data.delete(key);
    }
    
    return undefined;
  }
  
  /**
   * Get or set a value in the cache
   * @param {string} key - Cache key
   * @param {Function} getter - Function to get value if not in cache
   * @param {number} ttl - TTL in seconds (optional)
   * @returns {Promise<any>} - Value from cache or getter
   */
  async getOrSet(key, getter, ttl = this.ttl) {
    // Check if value is in cache
    const cachedValue = this.get(key);
    
    if (cachedValue !== undefined) {
      return cachedValue;
    }
    
    // Get value from getter function
    const value = await getter();
    
    // Set value in cache
    this.set(key, value, ttl);
    
    return value;
  }
  
  /**
   * Delete a value from the cache
   * @param {string} key - Cache key
   * @returns {boolean} - Success
   */
  delete(key) {
    return this.data.delete(key);
  }
  
  /**
   * Clear the entire cache
   * @returns {void}
   */
  clear() {
    this.data.clear();
  }
  
  /**
   * Remove expired items from the cache
   * @returns {number} - Number of items removed
   */
  cleanup() {
    const now = Date.now();
    let count = 0;
    
    for (const [key, item] of this.data.entries()) {
      if (item.expiry <= now) {
        this.data.delete(key);
        count++;
      }
    }
    
    return count;
  }
  
  /**
   * Get stats about the cache
   * @returns {Object} - Cache stats
   */
  stats() {
    return {
      size: this.data.size,
      maxSize: this.maxSize,
      ttl: this.ttl,
      checkPeriod: this.checkPeriod
    };
  }
  
  /**
   * Stop the periodic cleanup
   */
  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }
}

// Create a shared cache instance
const sharedCache = new Cache();

module.exports = {
  Cache,
  cache: sharedCache
};