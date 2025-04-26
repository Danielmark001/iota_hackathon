/**
 * IOTA SDK Client Wrapper
 * 
 * This file provides a simplified interface to the IOTA SDK Client functionality.
 * Enhanced with node failover, exponential backoff, and resilience features.
 */

const { Client, initLogger } = require('@iota/sdk');
const logger = require('./utils/logger');
const config = require('./config');
const { CircuitBreaker } = require('./utils/circuit-breaker');

// Initialize logging for better debugging
initLogger({
  name: 'IntelliLend-IOTA-Client',
  levelFilter: 'info', // Options: trace, debug, info, warn, error
  targetExclusions: ['sync']
});

// Simple in-memory cache for queries to reduce network calls
const queryCache = new Map();
const CACHE_TTL = parseInt(process.env.CACHE_TTL || '300') * 1000; // 5 minutes in ms default
const CACHE_ENABLED = process.env.CACHE_ENABLED !== 'false'; // Enable caching by default

/**
 * Generic cache function for any async operation
 * @param {string} key - Cache key
 * @param {Function} asyncFn - Async function to cache
 * @param {Object} options - Cache options
 * @returns {Promise<any>} - Result of the async function
 */
async function withCache(key, asyncFn, options = {}) {
  // Default options
  const useCache = options.useCache !== false && CACHE_ENABLED;
  const cacheTTL = options.cacheTTL || CACHE_TTL;
  
  // Check cache first if enabled
  if (useCache && queryCache.has(key)) {
    const cachedData = queryCache.get(key);
    if (Date.now() - cachedData.timestamp < cacheTTL) {
      logger.debug(`Cache hit for key: ${key}`);
      return cachedData.data;
    } else {
      // Cache expired
      logger.debug(`Cache expired for key: ${key}`);
      queryCache.delete(key);
    }
  }
  
  // Execute the function
  const result = await asyncFn();
  
  // Store in cache if caching is enabled
  if (useCache) {
    queryCache.set(key, {
      data: result,
      timestamp: Date.now()
    });
    logger.debug(`Cached result for key: ${key}`);
  }
  
  return result;
}

/**
 * Node Manager for handling node failover and health checks
 */
class NodeManager {
  constructor(nodes, healthCheckInterval = config.CONNECTION_RESILIENCE.healthCheckIntervalMs) {
    this.nodes = nodes.map(url => ({
      url,
      healthy: true,
      lastCheckTime: Date.now(),
      failureCount: 0,
      responseTime: 0
    }));
    this.currentNodeIndex = 0;
    this.healthCheckInterval = healthCheckInterval;
    this.lastHealthCheck = Date.now();
    
    // Start periodic health checks
    this.startHealthChecks();
  }
  
  /**
   * Get the current active node
   * @returns {string} URL of the current node
   */
  getCurrentNode() {
    return this.nodes[this.currentNodeIndex].url;
  }
  
  /**
   * Get all healthy nodes
   * @returns {string[]} Array of healthy node URLs
   */
  getHealthyNodes() {
    return this.nodes
      .filter(node => node.healthy)
      .map(node => node.url);
  }
  
  /**
   * Mark a node as unhealthy and switch to another healthy node
   * @param {number} index - Index of the node to mark unhealthy
   * @param {Error} error - The error that occurred with this node
   */
  markNodeUnhealthy(index, error) {
    const node = this.nodes[index];
    node.healthy = false;
    node.lastCheckTime = Date.now();
    node.failureCount++;
    
    logger.warn(`Marked node ${node.url} as unhealthy: ${error.message}`);
    
    // Switch to another healthy node
    this.switchToHealthyNode();
  }
  
  /**
   * Mark the current node as unhealthy and switch to another
   * @param {Error} error - The error that occurred
   */
  markCurrentNodeUnhealthy(error) {
    this.markNodeUnhealthy(this.currentNodeIndex, error);
  }
  
  /**
   * Switch to the next healthy node
   * @returns {string} URL of the selected node
   */
  switchToHealthyNode() {
    const healthyNodes = this.nodes.filter(node => node.healthy);
    
    // If no healthy nodes left, reset all nodes to healthy
    if (healthyNodes.length === 0) {
      logger.warn('No healthy nodes available, resetting all nodes to healthy state');
      this.nodes.forEach(node => {
        node.healthy = true;
        node.failureCount = 0;
      });
    }
    
    // Find next healthy node sorted by failure count (prefer nodes with fewer failures)
    const sortedNodes = [...this.nodes]
      .filter(node => node.healthy)
      .sort((a, b) => a.failureCount - b.failureCount || a.responseTime - b.responseTime);
    
    if (sortedNodes.length > 0) {
      // Find the index of the selected node in the original array
      const selectedNode = sortedNodes[0];
      this.currentNodeIndex = this.nodes.findIndex(node => node.url === selectedNode.url);
      logger.info(`Switched to node: ${this.getCurrentNode()}`);
    } else {
      // If no healthy node (should not happen due to reset above), use the next node
      this.currentNodeIndex = (this.currentNodeIndex + 1) % this.nodes.length;
      logger.warn(`No optimal node found, using next node: ${this.getCurrentNode()}`);
    }
    
    return this.getCurrentNode();
  }
  
  /**
   * Start periodic health checks on all nodes
   */
  startHealthChecks() {
    // Don't use setInterval to avoid overlapping checks if they take too long
    const runHealthCheck = async () => {
      // Only check if sufficient time has passed since the last check
      if (Date.now() - this.lastHealthCheck >= this.healthCheckInterval) {
        try {
          await this.checkAllNodesHealth();
          this.lastHealthCheck = Date.now();
        } catch (error) {
          logger.error(`Error during health check: ${error.message}`);
        }
      }
      
      // Schedule next check
      setTimeout(runHealthCheck, Math.max(1000, this.healthCheckInterval / 10));
    };
    
    // Start the health check loop
    runHealthCheck();
  }
  
  /**
   * Check the health of all nodes
   */
  async checkAllNodesHealth() {
    logger.debug('Running health check on all nodes');
    
    // Check each node with a simple getInfo request
    const checkPromises = this.nodes.map(async (node, index) => {
      // Skip recently checked unhealthy nodes
      const unhealthyRecoveryTime = config.CONNECTION_RESILIENCE.nodeRecoveryTimeMs;
      if (!node.healthy && (Date.now() - node.lastCheckTime < unhealthyRecoveryTime)) {
        return;
      }
      
      try {
        // Create a temporary client for health check
        const client = new Client({ nodes: [node.url] });
        
        const startTime = Date.now();
        const info = await withTimeout(
          client.getInfo(),
          5000 // Short timeout for health checks
        );
        const endTime = Date.now();
        
        // Update node health status
        node.healthy = info.nodeInfo.status.isHealthy;
        node.lastCheckTime = Date.now();
        node.responseTime = endTime - startTime;
        
        if (node.failureCount > 0) node.failureCount--;
        
        logger.debug(`Node ${node.url} health check: ${node.healthy ? 'healthy' : 'unhealthy'} (${node.responseTime}ms)`);
      } catch (error) {
        // Mark node as potentially unhealthy, but only fully mark as unhealthy
        // after consecutive failures (configured in nodeUnhealthyThreshold)
        node.failureCount++;
        node.lastCheckTime = Date.now();
        
        if (node.failureCount >= config.CONNECTION_RESILIENCE.nodeUnhealthyThreshold) {
          node.healthy = false;
          logger.warn(`Node ${node.url} marked unhealthy after ${node.failureCount} failures: ${error.message}`);
        } else {
          logger.debug(`Node ${node.url} health check failed (${node.failureCount}/${config.CONNECTION_RESILIENCE.nodeUnhealthyThreshold}): ${error.message}`);
        }
      }
    });
    
    // Wait for all checks to complete
    await Promise.all(checkPromises);
    
    // Make sure current node is healthy
    if (this.nodes[this.currentNodeIndex] && !this.nodes[this.currentNodeIndex].healthy) {
      this.switchToHealthyNode();
    }
    
    // Log node status summary
    const healthySummary = this.nodes
      .map(n => `${n.url}: ${n.healthy ? 'healthy' : 'unhealthy'}`)
      .join(', ');
    logger.debug(`Node health summary: ${healthySummary}`);
  }
}

/**
 * Execute a function with timeout
 * @param {Promise} promise - The promise to execute
 * @param {number} timeoutMs - Timeout in milliseconds
 * @returns {Promise} Promise with timeout
 */
async function withTimeout(promise, timeoutMs) {
  return Promise.race([
    promise,
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error(`Operation timed out after ${timeoutMs}ms`)), timeoutMs)
    )
  ]);
}

/**
 * Execute a function with exponential backoff retry
 * @param {Function} operation - Function to execute that returns a promise
 * @param {Object} options - Retry options
 * @returns {Promise} Result of operation
 */
async function withExponentialBackoff(operation, options = {}) {
  const {
    maxRetries = config.CONNECTION_RESILIENCE.maxRetries,
    initialDelayMs = config.CONNECTION_RESILIENCE.initialDelayMs,
    maxDelayMs = config.CONNECTION_RESILIENCE.maxDelayMs,
    factor = 2,
    jitter = true,
  } = options;
  
  let attempt = 0;
  let lastError;
  
  while (attempt <= maxRetries) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      attempt++;
      
      if (attempt > maxRetries) {
        break;
      }
      
      // Calculate delay with exponential backoff
      let delay = initialDelayMs * Math.pow(factor, attempt - 1);
      
      // Apply maximum delay limit
      delay = Math.min(delay, maxDelayMs);
      
      // Add jitter to prevent thundering herd problem
      if (jitter) {
        delay = delay * (0.5 + Math.random() / 2); // Random between 50-100% of delay
      }
      
      logger.debug(`Retrying operation (attempt ${attempt}/${maxRetries}) after ${delay.toFixed(0)}ms delay: ${error.message}`);
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  // If we get here, all retries failed
  logger.error(`All ${maxRetries} retry attempts failed`);
  throw lastError;
}

// Store node managers for different networks to avoid recreation
const nodeManagers = {};

// Store circuit breakers for different operations
const circuitBreakers = {
  getInfo: new CircuitBreaker({
    failureThreshold: 3,
    resetTimeout: 10000,
    fallbackFunction: () => ({ 
      nodeInfo: { 
        status: { isHealthy: false }, 
        name: 'Offline', 
        version: 'Unknown'
      }
    })
  }),
  getBalance: new CircuitBreaker({
    failureThreshold: 3,
    resetTimeout: 15000
  }),
  submitBlock: new CircuitBreaker({
    failureThreshold: 4,
    resetTimeout: 20000
  }),
  getTransactions: new CircuitBreaker({
    failureThreshold: 3,
    resetTimeout: 15000,
    fallbackFunction: () => []
  })
};

/**
 * Create an IOTA Client instance with enhanced resilience
 * @param {string} network - The network to connect to (mainnet/testnet)
 * @returns {Promise<{client: Client, nodeManager: NodeManager, circuitBreakers: Object}>} The IOTA Client instance, node manager, and circuit breakers
 */
async function createClient(network = config.DEFAULT_NETWORK) {
  try {
    logger.info(`Creating IOTA client for network: ${network}`);
    
    // Get client options from config
    const clientOptions = config.getClientOptions(network);
    
    // Create or retrieve the node manager for this network
    if (!nodeManagers[network]) {
      nodeManagers[network] = new NodeManager(
        clientOptions.nodes,
        config.CONNECTION_RESILIENCE.healthCheckIntervalMs
      );
      logger.info(`Created new node manager for network ${network} with ${clientOptions.nodes.length} nodes`);
    }
    
    const nodeManager = nodeManagers[network];
    
    // Get healthy nodes from node manager
    const healthyNodes = nodeManager.getHealthyNodes();
    
    // Enhanced client options with healthy nodes
    const enhancedOptions = {
      ...clientOptions,
      nodes: healthyNodes.length > 0 ? healthyNodes : [nodeManager.getCurrentNode()],
      ignoreNodeHealth: false,
      nodeSyncEnabled: true,
      quorumSize: Math.min(healthyNodes.length, config.CONNECTION_RESILIENCE.quorumMinNodes),
      minPowScore: clientOptions.minPowScore || 1000,
      fallbackToLocalPow: true,
      localPow: true,
      maxApiRequestsPerSecond: 20 // Rate limit API requests
    };
    
    // Create client instance with retry and error handling
    const client = await withExponentialBackoff(async () => {
      try {
        const client = new Client(enhancedOptions);
        return client;
      } catch (error) {
        logger.error(`Failed to initialize IOTA Client: ${error.message}`);
        
        if (error.message && error.message.includes('connect')) {
          // Mark current node as unhealthy and try another one
          nodeManager.markCurrentNodeUnhealthy(error);
          throw new Error(`Connection error to network ${network}: ${error.message}`);
        } else {
          throw error;
        }
      }
    });
    
    // Test connection with timeout and retry
    try {
      // Use withExponentialBackoff to retry the getInfo call if it fails
      const info = await withExponentialBackoff(async () => {
        try {
          return await withTimeout(
            client.getInfo(),
            config.CONNECTION_RESILIENCE.timeoutMs
          );
        } catch (error) {
          // Mark current node as unhealthy and try another one
          nodeManager.markCurrentNodeUnhealthy(error);
          
          // Update client nodes with new healthy nodes
          client.updateSetting('nodes', nodeManager.getHealthyNodes());
          
          throw error; // Rethrow to trigger retry
        }
      });
      
      // Log node information
      logger.info(`Connected to IOTA node: ${info.nodeInfo.name} (${info.nodeInfo.version})`);
      logger.info(`Node health: ${info.nodeInfo.status.isHealthy ? 'Healthy' : 'Unhealthy'}`);
      logger.info(`Protocol version: ${info.nodeInfo.protocol.version}`);
      logger.info(`Network: ${info.nodeInfo.protocol.networkName || network}`);
      
      // Create monitoring function that updates client nodes if needed
      const monitorClientNodes = () => {
        setTimeout(async () => {
          try {
            // Get current healthy nodes
            const healthyNodes = nodeManager.getHealthyNodes();
            
            // Update client nodes if they've changed
            if (JSON.stringify(client.getSettings().nodes) !== JSON.stringify(healthyNodes)) {
              client.updateSetting('nodes', healthyNodes);
              logger.debug(`Updated client nodes with ${healthyNodes.length} healthy nodes`);
            }
            
            // Continue monitoring
            monitorClientNodes();
          } catch (error) {
            logger.error(`Error in node monitoring: ${error.message}`);
            // Continue monitoring despite errors
            monitorClientNodes();
          }
        }, config.CONNECTION_RESILIENCE.healthCheckIntervalMs);
      };
      
      // Start monitoring
      monitorClientNodes();
      
      return { client, nodeManager, circuitBreakers };
    } catch (error) {
      logger.error(`Error connecting to IOTA node: ${error.message}`);
      throw new Error(`Failed to connect to IOTA network ${network}: ${error.message}`);
    }
  } catch (error) {
    logger.error(`Error creating IOTA client: ${error.message}`);
    throw error;
  }
}

/**
 * Generate a Bech32 address for the given account and address indices
 * @param {Client} client - The IOTA client instance
 * @param {number} accountIndex - Account index
 * @param {number} addressIndex - Address index
 * @param {string} network - Network to use (for determining bech32Hrp)
 * @returns {Promise<string>} The Bech32 address
 */
async function generateAddress(client, accountIndex = 0, addressIndex = 0, network = config.DEFAULT_NETWORK) {
  // Get network configuration
  const networkConfig = config.NETWORKS[network];
  if (!networkConfig) {
    throw new Error(`Network '${network}' not found in configuration.`);
  }
  
  return await withExponentialBackoff(async () => {
    try {
      // Input validation
      if (accountIndex < 0 || addressIndex < 0) {
        throw new Error('Account and address indices must be non-negative');
      }
      
      // Get secret manager from the client's configuration
      const secretManager = client.getSecretManager();
      
      // Generate Bech32 address with proper parameters
      const addressOptions = {
        coinType: networkConfig.coinType || 4219, // Shimmer coin type
        accountIndex,
        addressIndex,
        bech32Hrp: networkConfig.protocol?.bech32Hrp || 'smr', // Human-readable part
        includeInternal: false // External address
      };
      
      const addressObject = await client.generateBech32Address(secretManager, addressOptions);
      logger.info(`Generated address: ${addressObject}`);
      
      return addressObject;
    } catch (error) {
      logger.error(`Error generating address: ${error.message}`);
      
      // Enhance error message for common issues
      if (error.message && error.message.includes('seed')) {
        throw new Error('Seed access error: Check stronghold configuration');
      } else if (error.message && error.message.includes('stronghold')) {
        throw new Error('Stronghold error: Password may be incorrect or stronghold file is corrupted');
      }
      
      throw error;
    }
  });
}

/**
 * Get balance for a Bech32 address with enhanced resilience and caching
 * @param {Client} client - The IOTA client instance
 * @param {string} address - The Bech32 address
 * @param {NodeManager} nodeManager - Optional node manager for failover
 * @param {Object} options - Additional options (useCache, cacheTTL)
 * @returns {Promise<object>} The balance of the address
 */
async function getBalance(client, address, nodeManager = null, options = {}) {
  // Generate cache key
  const cacheKey = `balance-${address}`;
  
  // Use withCache to handle caching logic
  return await withCache(cacheKey, async () => {
    return await withExponentialBackoff(async () => {
      try {
        // Input validation with proper handling for different networks
        if (!address) {
          throw new Error('Address is required');
        }
        
        // Determine valid prefix based on the client's network
        const settings = client.getSettings();
        const networkInfo = settings.networkInfo || {};
        const validPrefix = networkInfo.bech32Hrp || 'smr';
        
        if (!address.startsWith(`${validPrefix}1`)) {
          throw new Error(`Invalid address format: must be a valid ${validPrefix.toUpperCase()} address starting with ${validPrefix}1`);
        }
        
        // Query balance
        const balance = await client.getAddressBalance(address);
        
        // Format for better readability
        const baseAmount = BigInt(balance.baseCoins) / BigInt(1000000);
        logger.info(`Balance for ${address}: ${baseAmount} ${validPrefix.toUpperCase()}`);
        
        // Add additional token information if present
        if (balance.nativeTokens && balance.nativeTokens.length > 0) {
          logger.info('Native tokens:');
          balance.nativeTokens.forEach(token => {
            logger.info(`- Token ID: ${token.id.slice(0, 10)}...`);
            logger.info(`  Amount: ${token.amount}`);
          });
        }
        
        return balance;
      } catch (error) {
        logger.error(`Error getting balance for ${address}: ${error.message}`);
        
        // Handle node errors with failover if node manager is provided
        if (nodeManager && error.message && (
          error.message.includes('connect') ||
          error.message.includes('timeout') ||
          error.message.includes('ECONNREFUSED') ||
          error.message.includes('503')
        )) {
          // Mark current node as unhealthy
          nodeManager.markCurrentNodeUnhealthy(error);
          
          // Update client nodes
          client.updateSetting('nodes', nodeManager.getHealthyNodes());
        }
        
        // Provide more helpful error messages
        if (error.message && error.message.includes('not found')) {
          throw new Error('Address not found on the network or has no transactions');
        }
        
        throw error;
      }
    });
  }, options);
}

/**
 * Submit a block to the IOTA network with enhanced resilience
 * @param {Client} client - The IOTA client instance
 * @param {object} blockData - The block data to submit
 * @param {NodeManager} nodeManager - Optional node manager for failover
 * @returns {Promise<object>} The block ID and metadata
 */
async function submitBlock(client, blockData, nodeManager = null) {
  return await withExponentialBackoff(async () => {
    try {
      // Input validation
      if (!blockData || typeof blockData !== 'object') {
        throw new Error('Invalid block data: must be a valid object');
      }
      
      // Enhance block with appropriate options if not provided
      const enhancedBlock = {
        ...blockData,
        // Add defaults if not specified
        parents: blockData.parents || null, // Use null to let the node choose parents
        payload: blockData.payload || null,
        tag: blockData.tag || null
      };
      
      // Submit with error handling
      const result = await client.submitBlock(enhancedBlock);
      
      // Log successful submission
      logger.info(`Block submitted successfully with ID: ${result.blockId}`);
      
      // Check block inclusion with timeout
      let inclusion = null;
      try {
        inclusion = await withTimeout(
          client.checkBlockInclusion(result.blockId),
          10000 // 10 second timeout for inclusion check
        );
        logger.info(`Block inclusion state: ${inclusion.state}`);
      } catch (inclusionError) {
        logger.warn(`Block inclusion check timed out: ${inclusionError.message}`);
        // Don't fail the operation, but provide the information
        inclusion = { state: 'unknown', error: inclusionError.message };
      }
      
      return {
        ...result,
        inclusion
      };
    } catch (error) {
      logger.error(`Error submitting block: ${error.message}`);
      
      // Handle node errors with failover if node manager is provided
      if (nodeManager && error.message && (
        error.message.includes('connect') ||
        error.message.includes('timeout') ||
        error.message.includes('ECONNREFUSED') ||
        error.message.includes('503')
      )) {
        // Mark current node as unhealthy
        nodeManager.markCurrentNodeUnhealthy(error);
        
        // Update client nodes
        client.updateSetting('nodes', nodeManager.getHealthyNodes());
      }
      
      // Provide detailed error information based on common issues
      if (error.message && error.message.includes('rejected')) {
        throw new Error('Block rejected by the node. Verify block structure.');
      } else if (error.message && error.message.includes('timeout')) {
        throw new Error('Block submission timed out. The network may be congested. The block may still be processed.');
      }
      
      throw error;
    }
  });
}

/**
 * Monitor a transaction for confirmation status changes
 * @param {Client} client - The IOTA client instance
 * @param {string} blockId - The block ID to monitor
 * @param {Function} statusCallback - Callback function for status updates
 * @param {Object} options - Monitoring options
 * @returns {Promise<object>} Final confirmation status
 */
async function monitorTransaction(client, blockId, statusCallback, options = {}) {
  const {
    maxDuration = 300000, // 5 minutes
    checkInterval = 10000, // 10 seconds
    maxRetries = 5
  } = options;
  
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    let retries = 0;
    let lastStatus = null;
    
    // Function to check confirmation status
    const checkStatus = async () => {
      try {
        // Check if max duration has been exceeded
        if (Date.now() - startTime > maxDuration) {
          statusCallback({
            status: 'timeout',
            message: `Monitoring timed out after ${maxDuration/1000} seconds`,
            blockId
          });
          return resolve({ status: 'timeout', blockId });
        }
        
        // Check block inclusion - use cache with short TTL for frequent checks
        const inclusionCacheKey = `inclusion-${blockId}`;
        const inclusion = await withCache(inclusionCacheKey, async () => {
          return await client.checkBlockInclusion(blockId);
        }, { cacheTTL: Math.min(checkInterval/2, 5000) }); // Cache for half the check interval or 5 seconds, whichever is less
        
        // If status has changed, call the callback
        if (!lastStatus || lastStatus.state !== inclusion.state) {
          lastStatus = inclusion;
          statusCallback({
            status: inclusion.state,
            message: `Block ${blockId} is ${inclusion.state}`,
            blockId,
            inclusion
          });
        }
        
        // If confirmed or conflicting, we're done
        if (inclusion.state === 'included' || inclusion.state === 'conflicting') {
          return resolve({ status: inclusion.state, blockId, inclusion });
        }
        
        // Schedule next check
        setTimeout(checkStatus, checkInterval);
      } catch (error) {
        retries++;
        logger.error(`Error checking transaction status (retry ${retries}/${maxRetries}): ${error.message}`);
        
        if (retries >= maxRetries) {
          statusCallback({
            status: 'error',
            message: `Error monitoring transaction: ${error.message}`,
            blockId
          });
          return reject(error);
        }
        
        // Retry with exponential backoff
        setTimeout(checkStatus, checkInterval * Math.pow(2, retries));
      }
    };
    
    // Start checking status
    checkStatus();
  });
}

/**
 * Get network information with enhanced resilience and caching
 * @param {Client} client - The IOTA client instance
 * @param {NodeManager} nodeManager - Optional node manager for failover
 * @param {Object} options - Additional options (useCache, cacheTTL)
 * @returns {Promise<object>} Network information
 */
async function getNetworkInfo(client, nodeManager = null, options = {}) {
  // Generate cache key
  const cacheKey = 'network-info';
  
  // Use withCache to handle caching logic
  return await withCache(cacheKey, async () => {
    return await withExponentialBackoff(async () => {
      try {
        const info = await client.getInfo();
        const protocol = await client.getProtocolParameters();
        
        // Combine relevant information
        return {
          nodeInfo: info.nodeInfo,
          protocol: protocol,
          baseToken: protocol.baseToken,
          networkName: protocol.networkName,
          bech32Hrp: protocol.bech32Hrp,
          networkId: protocol.networkId,
          // Add additional useful information
          isHealthy: info.nodeInfo.status.isHealthy,
          currentNode: client.getSettings().nodes[0],
          currentTime: new Date().toISOString()
        };
      } catch (error) {
        logger.error(`Error getting network information: ${error.message}`);
        
        // Handle node errors with failover if node manager is provided
        if (nodeManager && error.message && (
          error.message.includes('connect') ||
          error.message.includes('timeout') ||
          error.message.includes('ECONNREFUSED') ||
          error.message.includes('503')
        )) {
          // Mark current node as unhealthy
          nodeManager.markCurrentNodeUnhealthy(error);
          
          // Update client nodes
          client.updateSetting('nodes', nodeManager.getHealthyNodes());
        }
        
        throw error;
      }
    });
  }, options);
}

/**
 * Get tips from the network with enhanced resilience
 * @param {Client} client - The IOTA client instance
 * @param {NodeManager} nodeManager - Optional node manager for failover
 * @returns {Promise<string[]>} Block IDs of tips
 */
async function getTips(client, nodeManager = null) {
  return await withExponentialBackoff(async () => {
    try {
      return await client.getTips();
    } catch (error) {
      logger.error(`Error getting tips: ${error.message}`);
      
      // Handle node errors with failover if node manager is provided
      if (nodeManager && error.message && (
        error.message.includes('connect') ||
        error.message.includes('timeout') ||
        error.message.includes('ECONNREFUSED') ||
        error.message.includes('503')
      )) {
        // Mark current node as unhealthy
        nodeManager.markCurrentNodeUnhealthy(error);
        
        // Update client nodes
        client.updateSetting('nodes', nodeManager.getHealthyNodes());
      }
      
      throw error;
    }
  });
}

/**
 * Get transactions by address with enhanced resilience and caching
 * @param {Client} client - The IOTA client instance
 * @param {string} address - Bech32 address to query
 * @param {NodeManager} nodeManager - Optional node manager for failover
 * @param {Object} options - Additional options (useCache, cacheTTL)
 * @returns {Promise<object[]>} Transactions for the address
 */
async function getAddressTransactions(client, address, nodeManager = null, options = {}) {
  // Generate cache key
  const cacheKey = `transactions-${address}`;
  
  // Use withCache to handle caching logic
  return await withCache(cacheKey, async () => {
    return await withExponentialBackoff(async () => {
      try {
        // Input validation
        if (!address) {
          throw new Error('Address is required');
        }
        
        // Use client to get transactions
        const transactions = await client.getAddressOutputs(address);
        
        logger.info(`Found ${transactions.length} transactions for address ${address}`);
        return transactions;
      } catch (error) {
        logger.error(`Error getting transactions for ${address}: ${error.message}`);
        
        // Handle node errors with failover if node manager is provided
        if (nodeManager && error.message && (
          error.message.includes('connect') ||
          error.message.includes('timeout') ||
          error.message.includes('ECONNREFUSED') ||
          error.message.includes('503')
        )) {
          // Mark current node as unhealthy
          nodeManager.markCurrentNodeUnhealthy(error);
          
          // Update client nodes
          client.updateSetting('nodes', nodeManager.getHealthyNodes());
        }
        
        throw error;
      }
    });
  }, options);
}

/**
 * Subscribe to events from the IOTA network
 * @param {Client} client - The IOTA client instance
 * @param {string} eventType - Type of event to subscribe to
 * @param {Function} callback - Callback function for events
 * @returns {Promise<number>} Subscription ID
 */
async function subscribeToEvents(client, eventType, callback) {
  try {
    // Simple validation
    if (!eventType || typeof callback !== 'function') {
      throw new Error('Event type and callback function are required');
    }
    
    logger.info(`Subscribing to ${eventType} events`);
    
    // Subscribe to events
    const subscriptionId = await client.subscribe(eventType, (event) => {
      try {
        callback(event);
      } catch (callbackError) {
        logger.error(`Error in event callback: ${callbackError.message}`);
      }
    });
    
    logger.info(`Successfully subscribed to ${eventType} events with ID ${subscriptionId}`);
    return subscriptionId;
  } catch (error) {
    logger.error(`Error subscribing to ${eventType} events: ${error.message}`);
    throw error;
  }
}

/**
 * Unsubscribe from events
 * @param {Client} client - The IOTA client instance
 * @param {number} subscriptionId - Subscription ID to unsubscribe
 * @returns {Promise<boolean>} Success result
 */
async function unsubscribeFromEvents(client, subscriptionId) {
  try {
    logger.info(`Unsubscribing from events with ID ${subscriptionId}`);
    await client.unsubscribe(subscriptionId);
    logger.info(`Successfully unsubscribed from events with ID ${subscriptionId}`);
    return true;
  } catch (error) {
    logger.error(`Error unsubscribing from events: ${error.message}`);
    throw error;
  }
}

/**
 * Submit transactions in batches to optimize throughput
 * @param {Client} client - The IOTA client instance
 * @param {Array} transactions - Array of transaction objects to submit
 * @param {Object} options - Batch options
 * @returns {Promise<Array>} Results of transactions
 */
async function submitTransactionBatch(client, transactions, options = {}) {
  // Default options
  const batchSize = options.batchSize || 10;
  const concurrentBatches = options.concurrentBatches || 2;
  const delayBetweenBatches = options.delayBetweenBatches || 1000; // ms
  
  logger.info(`Submitting ${transactions.length} transactions in batches of ${batchSize}`);
  
  // Split transactions into batches
  const batches = [];
  for (let i = 0; i < transactions.length; i += batchSize) {
    batches.push(transactions.slice(i, i + batchSize));
  }
  
  // Process batches with controlled concurrency
  const results = [];
  for (let i = 0; i < batches.length; i += concurrentBatches) {
    const currentBatches = batches.slice(i, i + concurrentBatches);
    
    // Process current batches concurrently
    const batchPromises = currentBatches.map(async (batch) => {
      const batchResults = [];
      
      for (const tx of batch) {
        try {
          const result = await submitBlock(client, tx);
          batchResults.push({ success: true, blockId: result.blockId, tx });
        } catch (error) {
          logger.error(`Error submitting transaction: ${error.message}`);
          batchResults.push({ success: false, error: error.message, tx });
        }
      }
      
      return batchResults;
    });
    
    // Wait for all current batches to complete
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults.flat());
    
    // Delay between batch groups to avoid rate limiting
    if (i + concurrentBatches < batches.length) {
      await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
    }
  }
  
  // Return summary
  const successCount = results.filter(r => r.success).length;
  logger.info(`Batch submission complete: ${successCount}/${transactions.length} successful`);
  
  return results;
}

/**
 * Clear the query cache or specific keys
 * @param {string|string[]} keys - Optional specific keys to clear, or all if not specified
 * @returns {number} Number of cache entries cleared
 */
function clearCache(keys = null) {
  if (!keys) {
    // Clear all cache
    const count = queryCache.size;
    queryCache.clear();
    logger.info(`Cleared entire query cache (${count} entries)`);
    return count;
  } else if (Array.isArray(keys)) {
    // Clear specific keys
    let count = 0;
    for (const key of keys) {
      if (queryCache.has(key)) {
        queryCache.delete(key);
        count++;
      }
    }
    logger.info(`Cleared ${count} entries from query cache`);
    return count;
  } else if (typeof keys === 'string') {
    // Clear a single key
    const deleted = queryCache.delete(keys);
    logger.info(`Cleared cache entry for key: ${keys}`);
    return deleted ? 1 : 0;
  }
  
  return 0;
}

/**
 * Get cache statistics
 * @returns {Object} Cache statistics
 */
function getCacheStats() {
  const stats = {
    size: queryCache.size,
    keys: Array.from(queryCache.keys()),
    averageAge: 0,
    oldestEntry: null,
    newestEntry: null
  };
  
  if (queryCache.size > 0) {
    let totalAge = 0;
    let oldest = Date.now();
    let newest = 0;
    
    for (const [key, entry] of queryCache.entries()) {
      const age = Date.now() - entry.timestamp;
      totalAge += age;
      
      if (entry.timestamp < oldest) {
        oldest = entry.timestamp;
        stats.oldestEntry = { key, age: age / 1000 };
      }
      
      if (entry.timestamp > newest) {
        newest = entry.timestamp;
        stats.newestEntry = { key, age: age / 1000 };
      }
    }
    
    stats.averageAge = queryCache.size > 0 ? (totalAge / queryCache.size) / 1000 : 0;
  }
  
  return stats;
}

module.exports = {
  // Core client functionality
  createClient,
  generateAddress,
  getBalance,
  submitBlock,
  getNetworkInfo,
  getTips,
  
  // Enhanced transaction monitoring
  monitorTransaction,
  getAddressTransactions,
  
  // Performance optimization
  submitTransactionBatch,
  withCache,
  clearCache,
  getCacheStats,
  
  // Event subscriptions
  subscribeToEvents,
  unsubscribeFromEvents,
  
  // Utility functions exposed for use in other modules
  withExponentialBackoff,
  withTimeout,
  
  // Node management
  NodeManager
};
