/**
 * IOTA Connection Pool
 * 
 * Manages a pool of IOTA client connections for reduced API latency
 * and improved throughput for high-volume operations.
 */

const logger = require('./logger');
const { createClient } = require('../../iota-sdk/client');

class IotaConnectionPool {
  /**
   * Initialize connection pool
   * @param {Object} options - Pool options
   */
  constructor(options = {}) {
    this.options = {
      minSize: options.minSize || 2, // Minimum pool size
      maxSize: options.maxSize || 5, // Maximum pool size
      idleTimeout: options.idleTimeout || 300000, // 5 minutes idle timeout
      acquireTimeout: options.acquireTimeout || 30000, // 30 seconds acquire timeout
      networkOptions: options.networkOptions || {}, // Network options for clients
      network: options.network || process.env.IOTA_NETWORK || 'testnet', // Network to connect to
      ...options
    };
    
    this.pool = []; // Available connections
    this.busy = new Map(); // Busy connections with acquisition time
    this.creating = 0; // Number of connections being created
    this.pendingAcquisitions = []; // Pending acquisition promises
    this.totalCreated = 0; // Total number of connections created
    this.isShuttingDown = false; // Whether the pool is shutting down
    
    // Stats
    this.stats = {
      created: 0,
      destroyed: 0,
      acquired: 0,
      released: 0,
      timeouts: 0,
      errors: 0,
      maxConcurrent: 0
    };
    
    // Start idle connection cleanup
    this.idleCheckInterval = setInterval(() => {
      this.cleanupIdleConnections();
    }, 60000); // Check every minute
    
    logger.info(`IOTA Connection Pool initialized with ${this.options.minSize}-${this.options.maxSize} connections`);
  }
  
  /**
   * Initialize the pool with minimum connections
   * @returns {Promise<boolean>} Success status
   */
  async initialize() {
    try {
      logger.info(`Initializing IOTA Connection Pool with ${this.options.minSize} connections`);
      
      const initPromises = [];
      
      // Create minimum number of connections
      for (let i = 0; i < this.options.minSize; i++) {
        initPromises.push(this.createConnection());
      }
      
      await Promise.all(initPromises);
      
      logger.info(`IOTA Connection Pool initialized with ${this.pool.length} connections`);
      return true;
    } catch (error) {
      logger.error(`Error initializing connection pool: ${error.message}`);
      this.stats.errors++;
      throw error;
    }
  }
  
  /**
   * Create a new connection
   * @returns {Promise<Object>} Created connection
   */
  async createConnection() {
    this.creating++;
    
    try {
      logger.debug(`Creating new IOTA client connection (${this.totalCreated + 1})`);
      
      // Create client using the client factory
      const { client, nodeManager } = await createClient(
        this.options.network,
        this.options.networkOptions
      );
      
      // Create connection object
      const connection = {
        id: `conn-${++this.totalCreated}`,
        client,
        nodeManager,
        created: Date.now(),
        lastUsed: Date.now(),
        usageCount: 0
      };
      
      // Add to pool
      this.pool.push(connection);
      this.stats.created++;
      
      logger.debug(`Created new IOTA client connection: ${connection.id}`);
      
      return connection;
    } catch (error) {
      logger.error(`Error creating IOTA client connection: ${error.message}`);
      this.stats.errors++;
      throw error;
    } finally {
      this.creating--;
    }
  }
  
  /**
   * Acquire a connection from the pool
   * @param {number} timeout - Acquisition timeout (optional)
   * @returns {Promise<Object>} Acquired connection
   */
  async acquire(timeout = this.options.acquireTimeout) {
    if (this.isShuttingDown) {
      throw new Error('Connection pool is shutting down');
    }
    
    // First, try to get an available connection
    if (this.pool.length > 0) {
      return this.acquireNow();
    }
    
    // If we can create more connections, do it
    if (this.busy.size + this.creating < this.options.maxSize) {
      try {
        const connection = await this.createConnection();
        return this.useConnection(connection);
      } catch (error) {
        logger.error(`Failed to create new connection: ${error.message}`);
        this.stats.errors++;
        // Continue to waiting logic
      }
    }
    
    // Otherwise, wait for a connection to become available
    return new Promise((resolve, reject) => {
      const timeoutId = timeout > 0 ? setTimeout(() => {
        const index = this.pendingAcquisitions.findIndex(p => p.reject === reject);
        if (index !== -1) {
          this.pendingAcquisitions.splice(index, 1);
          this.stats.timeouts++;
          reject(new Error(`Timed out waiting for connection after ${timeout}ms`));
        }
      }, timeout) : null;
      
      this.pendingAcquisitions.push({
        resolve: (connection) => {
          if (timeoutId) clearTimeout(timeoutId);
          resolve(connection);
        },
        reject: (error) => {
          if (timeoutId) clearTimeout(timeoutId);
          reject(error);
        },
        created: Date.now()
      });
    });
  }
  
  /**
   * Immediately acquire an available connection
   * @returns {Object} Acquired connection
   */
  acquireNow() {
    if (this.pool.length === 0) {
      throw new Error('No available connections');
    }
    
    // Sort connections by lastUsed (oldest first)
    this.pool.sort((a, b) => a.lastUsed - b.lastUsed);
    
    // Get the oldest connection
    const connection = this.pool.shift();
    return this.useConnection(connection);
  }
  
  /**
   * Use a connection (mark as busy)
   * @param {Object} connection - Connection to use
   * @returns {Object} Connection with client
   */
  useConnection(connection) {
    connection.lastUsed = Date.now();
    connection.usageCount++;
    
    // Mark as busy
    this.busy.set(connection.id, {
      connection,
      acquired: Date.now()
    });
    
    this.stats.acquired++;
    
    // Track max concurrent connections
    const currentConcurrent = this.busy.size;
    if (currentConcurrent > this.stats.maxConcurrent) {
      this.stats.maxConcurrent = currentConcurrent;
    }
    
    return {
      client: connection.client,
      nodeManager: connection.nodeManager,
      id: connection.id,
      // Add release method
      release: () => this.release(connection.id),
      // Usage info
      usageInfo: {
        usageCount: connection.usageCount,
        created: connection.created,
        id: connection.id
      }
    };
  }
  
  /**
   * Release a connection back to the pool
   * @param {string} connectionId - ID of connection to release
   * @returns {boolean} Success status
   */
  release(connectionId) {
    if (!this.busy.has(connectionId)) {
      logger.warn(`Attempted to release non-busy connection: ${connectionId}`);
      return false;
    }
    
    const { connection } = this.busy.get(connectionId);
    this.busy.delete(connectionId);
    
    connection.lastUsed = Date.now();
    this.stats.released++;
    
    // If we're shutting down, just destroy the connection
    if (this.isShuttingDown) {
      this.destroyConnection(connection);
      return true;
    }
    
    // Check if there are pending acquisitions
    if (this.pendingAcquisitions.length > 0) {
      const nextAcquisition = this.pendingAcquisitions.shift();
      nextAcquisition.resolve(this.useConnection(connection));
      return true;
    }
    
    // Otherwise, return to pool
    this.pool.push(connection);
    
    // If we have too many idle connections, destroy one
    this.cleanupIdleConnections();
    
    return true;
  }
  
  /**
   * Cleanup idle connections
   * @returns {number} Number of connections destroyed
   */
  cleanupIdleConnections() {
    if (this.isShuttingDown || this.pool.length <= this.options.minSize) {
      return 0;
    }
    
    const now = Date.now();
    let destroyed = 0;
    
    // Sort by lastUsed (oldest first)
    this.pool.sort((a, b) => a.lastUsed - b.lastUsed);
    
    // Remove connections that have been idle for too long
    while (this.pool.length > this.options.minSize) {
      const connection = this.pool[0];
      
      // If not idle long enough, stop cleaning
      if (now - connection.lastUsed < this.options.idleTimeout) {
        break;
      }
      
      // Remove from pool
      this.pool.shift();
      this.destroyConnection(connection);
      destroyed++;
    }
    
    if (destroyed > 0) {
      logger.debug(`Cleaned up ${destroyed} idle connections`);
    }
    
    return destroyed;
  }
  
  /**
   * Destroy a connection
   * @param {Object} connection - Connection to destroy
   */
  destroyConnection(connection) {
    try {
      // Nothing special needed for IOTA clients
      logger.debug(`Destroyed IOTA client connection: ${connection.id}`);
      this.stats.destroyed++;
    } catch (error) {
      logger.error(`Error destroying connection ${connection.id}: ${error.message}`);
      this.stats.errors++;
    }
  }
  
  /**
   * Get connection pool statistics
   * @returns {Object} Pool statistics
   */
  getStats() {
    return {
      ...this.stats,
      available: this.pool.length,
      busy: this.busy.size,
      creating: this.creating,
      pending: this.pendingAcquisitions.length,
      total: this.pool.length + this.busy.size + this.creating,
      maxSize: this.options.maxSize,
      minSize: this.options.minSize
    };
  }
  
  /**
   * Gracefully shut down the connection pool
   * @param {number} timeout - Shutdown timeout
   * @returns {Promise<boolean>} Success status
   */
  async shutdown(timeout = 10000) {
    if (this.isShuttingDown) {
      return true;
    }
    
    logger.info('Shutting down IOTA Connection Pool');
    this.isShuttingDown = true;
    
    // Clear idle check interval
    if (this.idleCheckInterval) {
      clearInterval(this.idleCheckInterval);
      this.idleCheckInterval = null;
    }
    
    // Reject all pending acquisitions
    this.pendingAcquisitions.forEach(pending => {
      pending.reject(new Error('Connection pool is shutting down'));
    });
    this.pendingAcquisitions = [];
    
    // Wait for busy connections to be released (with timeout)
    if (this.busy.size > 0) {
      const shutdownTimeout = setTimeout(() => {
        logger.warn(`Shutdown timed out with ${this.busy.size} connections still busy`);
      }, timeout);
      
      try {
        await new Promise((resolve) => {
          const checkInterval = setInterval(() => {
            if (this.busy.size === 0) {
              clearInterval(checkInterval);
              clearTimeout(shutdownTimeout);
              resolve();
            }
          }, 500);
        });
      } catch (error) {
        logger.error(`Error waiting for connections to release: ${error.message}`);
      }
    }
    
    // Destroy all remaining connections
    [...this.pool, ...Array.from(this.busy.values()).map(b => b.connection)].forEach(conn => {
      this.destroyConnection(conn);
    });
    
    this.pool = [];
    this.busy.clear();
    
    logger.info('IOTA Connection Pool shutdown complete');
    return true;
  }
}

// Create a singleton instance
const connectionPool = new IotaConnectionPool();

module.exports = connectionPool;
