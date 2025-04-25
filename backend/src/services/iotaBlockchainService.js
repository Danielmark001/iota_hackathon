/**
 * Enhanced IOTA Blockchain Service
 * 
 * Handles interactions with the IOTA network and its EVM layer
 * Enhanced with resilience features, caching, and comprehensive error handling
 */

const { ethers } = require('ethers');
const Redis = require('ioredis');
const logger = require('../utils/logger');
const config = require('../../config/iota-config');

// Import the enhanced IOTA SDK components
const { 
  createClient, 
  generateAddress, 
  getNetworkInfo, 
  submitBlock,
  monitorTransaction, 
  getAddressTransactions,
  subscribeToEvents,
  withExponentialBackoff,
  NodeManager
} = require('../../iota-sdk/client');

const { 
  createWallet, 
  getOrCreateAccount, 
  generateAddress: generateWalletAddress, 
  sendTokens,
  getBalance,
  getTransactionHistory,
  listenToAccountEvents,
  createTransaction
} = require('../../iota-sdk/wallet');

class IOTABlockchainService {
  constructor() {
    // Initialize Redis for caching if enabled in config
    this.initializeCache();
    
    // Initialize connections to IOTA networks
    this.initialize();
    
    // Track pending transactions for monitoring
    this.pendingTransactions = new Map();
    
    // Track WebSocket subscribers for transaction updates
    this.transactionSubscribers = new Map();
  }

  /**
   * Initialize cache system
   */
  initializeCache() {
    try {
      // Check if caching is enabled in config
      const cacheEnabled = process.env.ENABLE_CACHE === 'true';
      
      if (cacheEnabled) {
        logger.info('Initializing Redis cache for IOTA service');
        
        // Initialize Redis client with configuration
        this.redis = new Redis({
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT) || 6379,
          password: process.env.REDIS_PASSWORD || '',
          db: parseInt(process.env.REDIS_DB) || 0,
          // Handle reconnection
          retryStrategy: (times) => {
            const delay = Math.min(times * 50, 2000);
            return delay;
          }
        });
        
        // Handle Redis connection events
        this.redis.on('connect', () => {
          logger.info('Connected to Redis cache');
        });
        
        this.redis.on('error', (error) => {
          logger.error(`Redis cache error: ${error.message}`);
          this.cacheEnabled = false;
        });
        
        this.cacheEnabled = true;
        this.defaultCacheTTL = parseInt(process.env.CACHE_TTL) || 60; // Default 60 seconds
      } else {
        this.cacheEnabled = false;
        logger.info('Cache disabled for IOTA service');
      }
    } catch (error) {
      logger.error(`Error initializing cache: ${error.message}`);
      this.cacheEnabled = false;
    }
  }

  /**
   * Initialize connections to IOTA networks with enhanced resilience and verification
   */
  async initialize() {
    try {
      logger.info('Initializing IOTA Blockchain Service');
      
      // Initialize clients object to store different network clients
      this.clients = {};
      this.nodeManagers = {};
      this.wallets = {};
      this.accounts = {};
      
      // Track initialization status
      const networkStatus = {
        iota: false,
        shimmer: false,
        testnet: false
      };
      
      // Initialize the main networks (IOTA, Shimmer, Testnet) with parallel initialization
      const initPromises = [
        this.initializeNetwork('iota').then(() => { networkStatus.iota = true; }),
        this.initializeNetwork('shimmer').then(() => { networkStatus.shimmer = true; }),
        this.initializeNetwork('testnet').then(() => { networkStatus.testnet = true; })
      ];
      
      // Wait for all networks to initialize (continue even if some fail)
      await Promise.allSettled(initPromises);
      
      // Log network initialization status
      logger.info(`Network initialization status: IOTA: ${networkStatus.iota ? 'Connected' : 'Failed'}, ` +
                  `Shimmer: ${networkStatus.shimmer ? 'Connected' : 'Failed'}, ` + 
                  `Testnet: ${networkStatus.testnet ? 'Connected' : 'Failed'}`);
      
      // Make sure at least one network is connected
      if (!networkStatus.iota && !networkStatus.shimmer && !networkStatus.testnet) {
        throw new Error('Failed to connect to any IOTA network. Please check your network settings.');
      }
      
      // Initialize contract instances
      await this.initializeContracts();
      
      // Verify services are operational
      await this.verifyServices();
      
      logger.info('IOTA Blockchain Service initialized successfully');
    } catch (error) {
      logger.error(`Error initializing IOTA Blockchain Service: ${error.message}`);
      logger.warn('Continuing with limited functionality. Some features may not be available.');
      // Don't re-throw to allow service to start with limited functionality
    }
  }
  
  /**
   * Verify that essential services are operational
   */
  async verifyServices() {
    logger.info('Verifying IOTA services...');
    
    // Network to test (prefer testnet, then shimmer, then iota)
    const testNetwork = this.clients.testnet ? 'testnet' : 
                       (this.clients.shimmer ? 'shimmer' : 
                       (this.clients.iota ? 'iota' : null));
    
    if (!testNetwork) {
      logger.error('No IOTA networks available for verification');
      return false;
    }
    
    // Verify network info
    try {
      const networkInfo = await this.getNetworkInfo(testNetwork);
      logger.info(`Connected to ${testNetwork} network: ${networkInfo.nodeUrl} (${networkInfo.nodeStatus.healthy ? 'Healthy' : 'Unhealthy'})`);
    } catch (error) {
      logger.error(`Failed to verify network info: ${error.message}`);
    }
    
    // Verify wallet functionality if available
    if (this.wallets[testNetwork] && this.accounts[testNetwork]) {
      try {
        const balance = await this.getBalance(this.accounts[testNetwork], { syncFirst: true });
        logger.info(`Wallet verification successful. Balance: ${balance.formatted.available} ${balance.formatted.tokenSymbol}`);
      } catch (error) {
        logger.error(`Failed to verify wallet functionality: ${error.message}`);
      }
    } else {
      logger.warn(`Wallet functionality not available for ${testNetwork}`);
    }
    
    logger.info('IOTA services verification completed');
  }

  /**
   * Initialize a specific IOTA network with resilience features and health checks
   * @param {string} networkName - Network name: 'iota', 'shimmer', or 'testnet'
   */
  async initializeNetwork(networkName) {
    try {
      logger.info(`Initializing ${networkName} network`);
      
      // Create client with enhanced resilience and timeout
      const clientPromise = withExponentialBackoff(async () => {
        const { client, nodeManager } = await createClient(networkName);
        return { client, nodeManager };
      }, {
        maxRetries: 5,
        initialDelayMs: 1000,
        maxDelayMs: 10000,
        factor: 1.5,
        jitter: true
      });
      
      // Set timeout for client creation
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error(`Timeout initializing ${networkName} network after 30 seconds`)), 30000);
      });
      
      // Race between client creation and timeout
      const { client, nodeManager } = await Promise.race([
        clientPromise,
        timeoutPromise
      ]);
      
      // Store client and node manager
      this.clients[networkName] = client;
      this.nodeManagers[networkName] = nodeManager;
      
      // Get network information with timeout
      const networkInfoPromise = getNetworkInfo(client, nodeManager);
      const networkInfoTimeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Network info timeout')), 10000);
      });
      
      const networkInfo = await Promise.race([
        networkInfoPromise,
        networkInfoTimeoutPromise
      ]);
      
      logger.info(`Connected to ${networkName} network (${networkInfo.bech32Hrp})`);
      logger.info(`Node: ${networkInfo.currentNode} (${networkInfo.isHealthy ? 'Healthy' : 'Unhealthy'})`);
      
      // Initialize wallet if Stronghold password is provided
      if (process.env.STRONGHOLD_PASSWORD) {
        try {
          // Different storage path for each network to avoid conflicts
          const originalStoragePath = process.env.IOTA_STORAGE_PATH;
          process.env.IOTA_STORAGE_PATH = `./wallet-database-${networkName}`;
          
          // Create directory if it doesn't exist
          const fs = require('fs');
          if (!fs.existsSync(process.env.IOTA_STORAGE_PATH)) {
            fs.mkdirSync(process.env.IOTA_STORAGE_PATH, { recursive: true });
            logger.info(`Created storage directory at ${process.env.IOTA_STORAGE_PATH}`);
          }
          
          // Create wallet with enhanced resilience and timeout
          const walletPromise = createWallet(networkName);
          const walletTimeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Wallet creation timeout')), 20000);
          });
          
          const wallet = await Promise.race([
            walletPromise,
            walletTimeoutPromise
          ]);
          
          this.wallets[networkName] = wallet;
          
          // Get or create account with timeout
          const accountPromise = getOrCreateAccount(wallet, `IntelliLend-${networkName}`, {
            syncOnlyBasic: false
          });
          
          const accountTimeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Account creation timeout')), 20000);
          });
          
          const account = await Promise.race([
            accountPromise,
            accountTimeoutPromise
          ]);
          
          this.accounts[networkName] = account;
          
          // Log account information
          const balance = await getBalance(account, { syncFirst: true });
          logger.info(`${networkName} account balance: ${balance.formatted.available} ${balance.formatted.tokenSymbol} available`);
          
          // Restore original storage path
          process.env.IOTA_STORAGE_PATH = originalStoragePath;
        } catch (walletError) {
          logger.error(`Failed to initialize ${networkName} wallet: ${walletError.message}`);
          logger.info(`Continuing with client-only functionality for ${networkName}`);
        }
      } else {
        logger.warn(`No Stronghold password provided for ${networkName}. Wallet functionality disabled.`);
      }
      
      // Initialize EVM provider for this network with timeout
      if (config.networks[networkName]?.evmRpcUrl) {
        try {
          // Create provider with timeout
          const provider = new ethers.providers.JsonRpcProvider(
            config.networks[networkName].evmRpcUrl
          );
          
          // Test provider connection with timeout
          const providerPromise = provider.getNetwork();
          const providerTimeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('EVM provider connection timeout')), 10000);
          });
          
          const network = await Promise.race([
            providerPromise,
            providerTimeoutPromise
          ]);
          
          this[`${networkName}EvmProvider`] = provider;
          
          logger.info(`Connected to ${networkName} EVM network (chainId: ${network.chainId})`);
          
          // Initialize signer if private key is available
          if (process.env.PRIVATE_KEY) {
            this[`${networkName}Signer`] = new ethers.Wallet(
              process.env.PRIVATE_KEY, 
              this[`${networkName}EvmProvider`]
            );
            
            // Verify signer
            const signerAddress = await this[`${networkName}Signer`].getAddress();
            logger.info(`Initialized ${networkName} EVM signer (${signerAddress})`);
          }
        } catch (evmError) {
          logger.error(`Failed to initialize ${networkName} EVM provider: ${evmError.message}`);
        }
      }
      
      // Subscribe to block confirmations for real-time updates
      try {
        const subscriptionId = await subscribeToEvents(client, 'blockConfirmed', (event) => {
          logger.debug(`${networkName} block confirmed: ${event.blockId}`);
        });
        logger.info(`Subscribed to ${networkName} block confirmations (ID: ${subscriptionId})`);
      } catch (subscriptionError) {
        logger.warn(`Failed to subscribe to ${networkName} block confirmations: ${subscriptionError.message}`);
      }
      
      return { client, nodeManager };
    } catch (error) {
      logger.error(`Error initializing ${networkName} network: ${error.message}`);
      // Don't throw to allow other networks to initialize
      return null;
    }
  }

  /**
   * Initialize contract instances with connection pooling
   */
  async initializeContracts() {
    try {
      // Check if signers are available for contract interactions
      if (!this.iotaSigner && !this.shimmerSigner && !this.testnetSigner) {
        logger.warn('No private key provided. Contract interactions will be read-only.');
        return;
      }
      
      // Initialize contract maps for each network
      this.contracts = {};
      this.shimmerContracts = {};
      this.testnetContracts = {};
      
      // Load contract configurations
      const contractConfigs = config.contracts || {};
      
      // Create contracts for IOTA network
      if (this.iotaSigner) {
        await this.initializeNetworkContracts('iota', this.iotaSigner, contractConfigs);
      }
      
      // Create contracts for Shimmer network
      if (this.shimmerSigner) {
        await this.initializeNetworkContracts('shimmer', this.shimmerSigner, contractConfigs);
      }
      
      // Create contracts for Testnet
      if (this.testnetSigner) {
        await this.initializeNetworkContracts('testnet', this.testnetSigner, contractConfigs);
      }
      
      logger.info('Contract instances initialized successfully');
    } catch (error) {
      logger.error(`Error initializing contracts: ${error.message}`);
      throw error;
    }
  }

  /**
   * Initialize contracts for a specific network
   * @param {string} networkName - Network name
   * @param {ethers.Wallet} signer - Ethers signer for the network
   * @param {Object} contractConfigs - Contract configurations
   */
  async initializeNetworkContracts(networkName, signer, contractConfigs) {
    try {
      // Get network-specific contract addresses
      const networkConfig = config.networks[networkName] || {};
      const contractOverrides = networkConfig.contracts || {};
      
      // Map variable names to object references
      const contractMap = {
        'iota': this.contracts,
        'shimmer': this.shimmerContracts,
        'testnet': this.testnetContracts
      };
      
      // Initialize each contract
      for (const [contractName, contractConfig] of Object.entries(contractConfigs)) {
        try {
          // Get network-specific address if available
          const address = contractOverrides[contractName]?.address || contractConfig.address;
          
          // Skip if no address is available
          if (!address) {
            logger.warn(`No address available for ${contractName} on ${networkName}`);
            continue;
          }
          
          // Load ABI
          const abi = contractConfig.abi;
          
          // Create contract instance
          const contract = new ethers.Contract(address, abi, signer);
          
          // Store contract in the appropriate map
          contractMap[networkName][contractName] = contract;
          
          logger.info(`Initialized ${contractName} contract on ${networkName}`);
        } catch (contractError) {
          logger.error(`Error initializing ${contractName} on ${networkName}: ${contractError.message}`);
        }
      }
    } catch (error) {
      logger.error(`Error initializing contracts for ${networkName}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get cached data if available, or fetch and cache
   * @param {string} key - Cache key
   * @param {Function} fetchFunction - Function to fetch data if not cached
   * @param {number} ttl - Time to live in seconds
   * @returns {Promise<any>} - The cached or fetched data
   */
  async getCachedData(key, fetchFunction, ttl = this.defaultCacheTTL) {
    // Return directly from fetch function if caching is disabled
    if (!this.cacheEnabled || !this.redis) {
      return await fetchFunction();
    }
    
    try {
      // Check if data is in cache
      const cachedData = await this.redis.get(key);
      
      if (cachedData) {
        // Parse cached data
        return JSON.parse(cachedData);
      }
      
      // If not in cache, fetch data
      const data = await fetchFunction();
      
      // Cache the data
      await this.redis.set(key, JSON.stringify(data), 'EX', ttl);
      
      return data;
    } catch (error) {
      logger.error(`Cache error for key ${key}: ${error.message}`);
      
      // Fall back to direct fetch if caching fails
      return await fetchFunction();
    }
  }

  /**
   * Clear cache for a specific key or pattern
   * @param {string} keyPattern - Cache key or pattern to clear
   */
  async clearCache(keyPattern) {
    if (!this.cacheEnabled || !this.redis) {
      return;
    }
    
    try {
      // If exact key, delete it
      if (!keyPattern.includes('*')) {
        await this.redis.del(keyPattern);
        logger.debug(`Cleared cache for key: ${keyPattern}`);
        return;
      }
      
      // If pattern, scan and delete matching keys
      const stream = this.redis.scanStream({
        match: keyPattern,
        count: 100
      });
      
      let keysToDelete = [];
      
      stream.on('data', (keys) => {
        keysToDelete = keysToDelete.concat(keys);
      });
      
      stream.on('end', async () => {
        if (keysToDelete.length > 0) {
          await this.redis.del(...keysToDelete);
          logger.debug(`Cleared ${keysToDelete.length} cache keys matching: ${keyPattern}`);
        }
      });
    } catch (error) {
      logger.error(`Error clearing cache for pattern ${keyPattern}: ${error.message}`);
    }
  }

  /**
   * Get information about the IOTA network with caching
   * @param {string} network - Network name: 'iota', 'shimmer', or 'testnet'
   * @returns {Promise<Object>} - Network information
   */
  async getNetworkInfo(network = 'iota') {
    return await this.getCachedData(
      `network_info:${network}`,
      async () => {
        try {
          // Get client and node manager for this network
          const client = this.clients[network];
          const nodeManager = this.nodeManagers[network];
          
          if (!client) {
            throw new Error(`No client available for network: ${network}`);
          }
          
          // Get node info with enhanced error handling
          const info = await withExponentialBackoff(async () => {
            try {
              return await getNetworkInfo(client, nodeManager);
            } catch (error) {
              logger.error(`Error getting network info for ${network}: ${error.message}`);
              
              // If connection issue, try to switch nodes
              if (nodeManager && (
                error.message.includes('connect') || 
                error.message.includes('timeout')
              )) {
                nodeManager.switchToHealthyNode();
              }
              
              throw error;
            }
          });
          
          // Get healthy nodes from node manager
          const healthyNodes = nodeManager ? nodeManager.getHealthyNodes() : [];
          
          // Calculate uptime based on node's start timestamp
          const uptimeMs = Date.now() - (info.nodeInfo?.status?.startTimestamp || Date.now());
          const uptimeHours = (uptimeMs / (1000 * 60 * 60)).toFixed(2);
          
          // Enhance the network information with additional details
          return {
            network,
            networkName: info.networkName,
            nodeUrl: info.currentNode,
            nodeVersion: info.nodeInfo?.version,
            isHealthy: info.isHealthy,
            protocol: info.protocol,
            bech32Hrp: info.bech32Hrp,
            networkId: info.networkId,
            baseToken: info.baseToken,
            // Enhanced information
            nodeStatus: {
              healthy: info.isHealthy,
              uptimeHours: uptimeHours,
              startTime: new Date(info.nodeInfo?.status?.startTimestamp || 0).toISOString()
            },
            connectionStatus: {
              healthyNodeCount: healthyNodes.length,
              totalNodeCount: nodeManager ? nodeManager.nodes.length : 1,
              connectedNode: info.currentNode
            },
            lastChecked: new Date().toISOString()
          };
        } catch (error) {
          logger.error(`Error getting IOTA network info for ${network}: ${error.message}`);
          throw error;
        }
      },
      60 // Cache for 60 seconds
    );
  }

  /**
   * Get EVM block information with caching
   * @param {string} network - Network name: 'iota', 'shimmer', or 'testnet' 
   * @param {string|number} blockNumber - Block number or 'latest'
   * @returns {Promise<Object>} - Block information
   */
  async getBlock(network = 'iota', blockNumber = 'latest') {
    // Skip cache for 'latest' block
    const useCache = blockNumber !== 'latest';
    const cacheKey = `evm_block:${network}:${blockNumber}`;
    
    const fetchBlock = async () => {
      try {
        // Select appropriate provider
        const provider = this[`${network}EvmProvider`];
        
        if (!provider) {
          throw new Error(`No provider available for network: ${network}`);
        }
        
        // Get block information with retry for resilience
        const block = await withExponentialBackoff(async () => {
          return await provider.getBlock(blockNumber);
        });
        
        return {
          network,
          number: block.number,
          hash: block.hash,
          parentHash: block.parentHash,
          timestamp: new Date(block.timestamp * 1000).toISOString(),
          transactions: block.transactions.length,
          gasUsed: block.gasUsed.toString(),
          gasLimit: block.gasLimit.toString(),
          // Enhanced information
          miner: block.miner,
          difficulty: block.difficulty.toString(),
          nonce: block.nonce,
          extraData: block.extraData,
          size: block.size,
          // Calculate age
          age: Math.floor((Date.now() - (block.timestamp * 1000)) / 1000),
          retrieved: new Date().toISOString()
        };
      } catch (error) {
        logger.error(`Error getting block information for ${network}: ${error.message}`);
        throw error;
      }
    };
    
    // Use cache if enabled and not fetching latest block
    if (useCache) {
      return await this.getCachedData(cacheKey, fetchBlock, 3600); // Cache blocks for 1 hour
    } else {
      return await fetchBlock();
    }
  }

  /**
   * Send data to the IOTA Tangle with enhanced error handling and monitoring
   * @param {string} network - Network name: 'iota', 'shimmer', or 'testnet'
   * @param {Object} data - Data to send
   * @param {string} tag - Optional tag
   * @param {boolean} monitor - Whether to monitor the transaction
   * @param {Function} statusCallback - Optional callback for status updates
   * @returns {Promise<Object>} - Submission result
   */
  async sendTangleData(network = 'iota', data, tag = 'IntelliLend', monitor = false, statusCallback = null) {
    try {
      // Get client and node manager for this network
      const client = this.clients[network];
      const nodeManager = this.nodeManagers[network];
      
      if (!client) {
        throw new Error(`No client available for network: ${network}`);
      }
      
      logger.info(`Sending data to ${network} Tangle with tag: ${tag}`);
      
      // Create block payload
      const blockData = {
        payload: {
          type: 1, // Tagged data
          tag: Buffer.from(tag).toString('hex'),
          data: Buffer.from(JSON.stringify(data)).toString('hex')
        }
      };
      
      // Submit block with enhanced error handling and node failover
      const result = await submitBlock(client, blockData, nodeManager);
      
      logger.info(`Data published to ${network} Tangle: ${result.blockId}`);
      
      // Monitor transaction if requested
      if (monitor) {
        logger.info(`Monitoring transaction ${result.blockId}`);
        
        // Start monitoring in background
        monitorTransaction(client, result.blockId, (status) => {
          logger.debug(`Transaction ${result.blockId} status: ${status.status}`);
          
          // Call status callback if provided
          if (statusCallback) {
            statusCallback(status);
          }
          
          // If transaction is confirmed or failed, remove from pending
          if (['confirmed', 'conflicting', 'error'].includes(status.status)) {
            this.pendingTransactions.delete(result.blockId);
          }
        }).catch(error => {
          logger.error(`Error monitoring transaction ${result.blockId}: ${error.message}`);
        });
        
        // Add to pending transactions
        this.pendingTransactions.set(result.blockId, {
          network,
          blockId: result.blockId,
          tag,
          timestamp: Date.now(),
          status: 'pending'
        });
      }
      
      // Check inclusion state if available
      const inclusionStatus = result.inclusion?.state || 'pending';
      
      // Clear related caches
      if (tag) {
        this.clearCache(`tangle_data:${network}:${tag}:*`);
      }
      
      return {
        messageId: result.blockId,
        blockId: result.blockId,
        network,
        timestamp: new Date().toISOString(),
        inclusionStatus,
        monitoring: monitor,
        tag
      };
    } catch (error) {
      logger.error(`Error sending Tangle data: ${error.message}`);
      
      // Provide more context for specific errors
      if (error.message.includes('rejected')) {
        throw new Error(`Block rejected by the node. Verify block structure: ${error.message}`);
      } else if (error.message.includes('timeout')) {
        throw new Error(`Operation timed out. Network may be congested. The block may still be processed.`);
      }
      
      throw error;
    }
  }

  /**
   * Get data from the IOTA Tangle by tag with caching
   * @param {string} network - Network name: 'iota', 'shimmer', or 'testnet'
   * @param {string} tag - Tag to search for
   * @param {number} limit - Maximum number of messages to return
   * @returns {Promise<Object[]>} - Array of messages with extracted data
   */
  async getTangleDataByTag(network = 'iota', tag = 'IntelliLend', limit = 10) {
    return await this.getCachedData(
      `tangle_data:${network}:${tag}:${limit}`,
      async () => {
        try {
          // Get client for this network
          const client = this.clients[network];
          
          if (!client) {
            throw new Error(`No client available for network: ${network}`);
          }
          
          logger.info(`Fetching data from ${network} Tangle with tag: ${tag}`);
          
          // Search for messages with the given tag
          const tagHex = Buffer.from(tag).toString('hex');
          const messages = await client.searchTaggedData(tagHex, limit);
          
          // Process and extract data from each message
          const results = await Promise.all(messages.map(async (messageId) => {
            try {
              // Get message details
              const messageData = await client.getMessage(messageId);
              
              // Extract data if present
              let payload = null;
              if (messageData.payload && messageData.payload.data) {
                try {
                  payload = JSON.parse(Buffer.from(messageData.payload.data, 'hex').toString());
                } catch (e) {
                  payload = Buffer.from(messageData.payload.data, 'hex').toString();
                }
              }
              
              return {
                messageId,
                blockId: messageId,
                network,
                timestamp: messageData.timestamp || new Date().toISOString(),
                tag,
                data: payload
              };
            } catch (messageError) {
              logger.error(`Error getting message ${messageId}: ${messageError.message}`);
              return {
                messageId,
                network,
                error: messageError.message
              };
            }
          }));
          
          return results.filter(result => !result.error);
        } catch (error) {
          logger.error(`Error getting Tangle data by tag: ${error.message}`);
          throw error;
        }
      },
      300 // Cache for 5 minutes
    );
  }

  /**
   * Query the IOTA Tangle with custom search parameters
   * @param {Object} query - Query parameters
   * @param {string} network - Network name: 'iota', 'shimmer', or 'testnet'
   * @returns {Promise<Object[]>} - Query results
   */
  async queryTangle(query, network = 'iota') {
    try {
      // Get client for this network
      const client = this.clients[network];
      
      if (!client) {
        throw new Error(`No client available for network: ${network}`);
      }
      
      logger.info(`Querying ${network} Tangle with criteria: ${JSON.stringify(query)}`);
      
      // Determine appropriate search method based on query
      const results = [];
      
      // Handle different query types
      if (query.type) {
        // If searching by type, convert to tag and search
        const tag = Buffer.from(query.type).toString('hex');
        
        // Set limit
        const limit = query.limit || 50;
        
        // Search by tag
        const messages = await client.searchTaggedData(tag, limit);
        
        // Process each message
        for (const messageId of messages) {
          try {
            // Get message data
            const messageData = await this.getTangleMessage(network, messageId);
            
            // Basic filter by timestamp
            if (query.timestamp && query.timestamp.$lt && 
                messageData.timestamp && new Date(messageData.timestamp).getTime() >= query.timestamp.$lt) {
              continue;
            }
            
            // Simple filter implementation for common fields
            let includeMessage = true;
            
            // Check fields in data
            if (messageData.data) {
              for (const [key, value] of Object.entries(query)) {
                if (key === 'type' || key === 'limit' || key === 'timestamp') {
                  continue; // Skip special fields
                }
                
                if (key === 'participants' && typeof value === 'string') {
                  // Special handling for participants
                  const data = messageData.data;
                  if (!data.participants || 
                     (data.participants.lender !== value && 
                      data.participants.borrower !== value)) {
                    includeMessage = false;
                    break;
                  }
                } else if (messageData.data[key] !== undefined && messageData.data[key] !== value) {
                  includeMessage = false;
                  break;
                }
              }
            }
            
            if (includeMessage) {
              results.push(messageData);
              
              // Break early if we've reached the limit
              if (query.limit && results.length >= query.limit) {
                break;
              }
            }
          } catch (error) {
            logger.warn(`Error processing message ${messageId}: ${error.message}`);
          }
        }
      }
      
      return results;
    } catch (error) {
      logger.error(`Error querying Tangle: ${error.message}`);
      return [];
    }
  }

  /**
   * Get a message from the IOTA Tangle by message ID with caching
   * @param {string} network - Network name: 'iota', 'shimmer', or 'testnet'
   * @param {string} messageId - Message ID
   * @returns {Promise<Object>} - Message data
   */
  async getTangleMessage(network = 'iota', messageId) {
    return await this.getCachedData(
      `tangle_message:${network}:${messageId}`,
      async () => {
        try {
          // Get client for this network
          const client = this.clients[network];
          const nodeManager = this.nodeManagers[network];
          
          if (!client) {
            throw new Error(`No client available for network: ${network}`);
          }
          
          // Get message data with resilience
          const messageData = await withExponentialBackoff(async () => {
            try {
              return await client.getMessage(messageId);
            } catch (error) {
              // If connection issue, try to switch nodes
              if (nodeManager && (
                error.message.includes('connect') || 
                error.message.includes('timeout')
              )) {
                nodeManager.switchToHealthyNode();
                
                // Update client nodes
                client.updateSetting('nodes', nodeManager.getHealthyNodes());
              }
              
              throw error;
            }
          });
          
          // Extract data if present
          let payload = null;
          if (messageData.payload) {
            // For tagged data
            if (messageData.payload.type === 1 && messageData.payload.data) {
              try {
                payload = JSON.parse(Buffer.from(messageData.payload.data, 'hex').toString());
              } catch (e) {
                payload = Buffer.from(messageData.payload.data, 'hex').toString();
              }
            }
            
            // Extract tag if present
            let tag = null;
            if (messageData.payload.tag) {
              try {
                tag = Buffer.from(messageData.payload.tag, 'hex').toString();
              } catch (e) {
                tag = messageData.payload.tag;
              }
            }
            
            return {
              messageId,
              blockId: messageId,
              network,
              timestamp: messageData.timestamp || new Date().toISOString(),
              tag,
              data: payload,
              metadata: messageData.metadata,
              inclusionState: messageData.metadata?.referencedByMilestone
                ? 'confirmed'
                : messageData.metadata?.conflicting
                ? 'conflicting'
                : 'pending'
            };
          }
          
          // If no payload, return basic message data
          return {
            messageId,
            network,
            timestamp: new Date().toISOString(),
            metadata: messageData.metadata,
            raw: messageData
          };
        } catch (error) {
          logger.error(`Error getting Tangle message ${messageId}: ${error.message}`);
          throw error;
        }
      },
      600 // Cache for 10 minutes
    );
  }

  /**
   * Check transaction status on the IOTA Tangle
   * @param {string} network - Network name: 'iota', 'shimmer', or 'testnet'
   * @param {string} transactionId - Transaction/Block ID
   * @returns {Promise<Object>} - Transaction status
   */
  async checkTransactionStatus(network = 'iota', transactionId) {
    try {
      // Get client for this network
      const client = this.clients[network];
      
      if (!client) {
        throw new Error(`No client available for network: ${network}`);
      }
      
      logger.info(`Checking transaction status for ${transactionId} on ${network}`);
      
      // Get transaction metadata
      const metadata = await client.blockMetadata(transactionId);
      
      // Determine status based on metadata
      let status = 'pending';
      if (metadata.referencedByMilestone) {
        status = 'confirmed';
      } else if (metadata.conflicting) {
        status = 'conflicting';
      }
      
      return {
        transactionId,
        blockId: transactionId,
        network,
        status,
        referencedByMilestone: metadata.referencedByMilestone,
        milestoneIndex: metadata.referencedByMilestoneIndex,
        conflicting: metadata.conflicting,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error(`Error checking transaction status: ${error.message}`);
      
      // If transaction not found, return not found status
      if (error.message.includes('not found')) {
        return {
          transactionId,
          network,
          status: 'not_found',
          timestamp: new Date().toISOString(),
          error: 'Transaction not found on the network'
        };
      }
      
      throw error;
    }
  }

  /**
   * Subscribe to transaction updates
   * @param {string} transactionId - Transaction/Block ID
   * @param {Function} callback - Callback function for updates
   * @returns {string} - Subscription ID
   */
  subscribeToTransaction(transactionId, callback) {
    try {
      const subscriptionId = `sub_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
      
      // Get existing subscribers or create new array
      const subscribers = this.transactionSubscribers.get(transactionId) || [];
      
      // Add new subscriber
      subscribers.push({
        id: subscriptionId,
        callback
      });
      
      // Update subscribers map
      this.transactionSubscribers.set(transactionId, subscribers);
      
      logger.debug(`Added subscriber ${subscriptionId} for transaction ${transactionId}`);
      
      // If transaction is already being monitored, we're done
      if (this.pendingTransactions.has(transactionId)) {
        return subscriptionId;
      }
      
      // If not already monitoring, start monitoring this transaction
      // Determine network (use default if not found)
      const pendingData = this.pendingTransactions.get(transactionId);
      const network = pendingData?.network || 'iota';
      
      // Get client for this network
      const client = this.clients[network];
      
      if (client) {
        // Start monitoring
        monitorTransaction(client, transactionId, (status) => {
          logger.debug(`Transaction ${transactionId} status: ${status.status}`);
          
          // Get subscribers
          const subscribers = this.transactionSubscribers.get(transactionId) || [];
          
          // Notify all subscribers
          subscribers.forEach(subscriber => {
            try {
              subscriber.callback(status);
            } catch (error) {
              logger.error(`Error in transaction subscriber callback: ${error.message}`);
            }
          });
          
          // If transaction is confirmed or failed, remove from pending
          if (['confirmed', 'conflicting', 'error'].includes(status.status)) {
            this.pendingTransactions.delete(transactionId);
          }
        }).catch(error => {
          logger.error(`Error monitoring transaction ${transactionId}: ${error.message}`);
        });
        
        // Add to pending transactions
        this.pendingTransactions.set(transactionId, {
          network,
          blockId: transactionId,
          timestamp: Date.now(),
          status: 'pending'
        });
      }
      
      return subscriptionId;
    } catch (error) {
      logger.error(`Error subscribing to transaction: ${error.message}`);
      throw error;
    }
  }

  /**
   * Unsubscribe from transaction updates
   * @param {string} transactionId - Transaction/Block ID
   * @param {string} subscriptionId - Subscription ID
   */
  unsubscribeFromTransaction(transactionId, subscriptionId) {
    try {
      // Get subscribers for this transaction
      const subscribers = this.transactionSubscribers.get(transactionId) || [];
      
      // Filter out the subscription to remove
      const updatedSubscribers = subscribers.filter(sub => sub.id !== subscriptionId);
      
      // Update or remove from map
      if (updatedSubscribers.length > 0) {
        this.transactionSubscribers.set(transactionId, updatedSubscribers);
      } else {
        this.transactionSubscribers.delete(transactionId);
        
        // If no subscribers left, stop monitoring
        // Note: We don't actually stop monitoring since other parts of the
        // system might be interested, but we could implement this if needed
      }
      
      logger.debug(`Removed subscriber ${subscriptionId} for transaction ${transactionId}`);
    } catch (error) {
      logger.error(`Error unsubscribing from transaction: ${error.message}`);
      throw error;
    }
  }

  /**
   * Transfer tokens on IOTA EVM Layer with enhanced error handling
   * @param {string} network - Network name: 'iota', 'shimmer', or 'testnet'
   * @param {string} to - Recipient address
   * @param {string} amount - Amount in ETH format
   * @param {Object} options - Transaction options
   * @returns {Promise<Object>} - Transaction receipt
   */
  async transferEVM(network = 'iota', to, amount, options = {}) {
    try {
      // Select appropriate signer
      const signer = this[`${network}Signer`];
      
      if (!signer) {
        throw new Error(`No signer available for network: ${network}`);
      }
      
      logger.info(`Transferring ${amount} on ${network} EVM to ${to}`);
      
      // Create transaction with resilience
      const tx = await withExponentialBackoff(async () => {
        try {
          return await signer.sendTransaction({
            to,
            value: ethers.utils.parseEther(amount),
            gasLimit: options.gasLimit || config.gas?.limit || 21000,
            gasPrice: options.gasPrice || config.gas?.price || ethers.utils.parseUnits('1.0', 'gwei'),
            nonce: options.nonce // Let ethers determine if not provided
          });
        } catch (error) {
          // Provide better error messages for common issues
          if (error.message.includes('insufficient funds')) {
            throw new Error(`Insufficient funds for transfer: ${error.message}`);
          } else if (error.message.includes('gas')) {
            throw new Error(`Gas error: ${error.message}`);
          } else if (error.message.includes('nonce')) {
            throw new Error(`Nonce error: ${error.message}. Try providing a specific nonce.`);
          }
          
          throw error;
        }
      });
      
      logger.info(`Transaction sent: ${tx.hash}, waiting for confirmation...`);
      
      // Wait for transaction to be mined with timeout
      const receipt = await Promise.race([
        tx.wait(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Transaction confirmation timeout')), 
          options.timeout || 120000) // 2 minutes timeout
        )
      ]);
      
      logger.info(`Transaction confirmed on ${network} EVM: ${receipt.transactionHash}`);
      
      // Clear related caches
      this.clearCache(`evm_balance:${network}:*`);
      
      return {
        hash: receipt.transactionHash,
        from: receipt.from,
        to: receipt.to,
        blockNumber: receipt.blockNumber,
        confirmations: receipt.confirmations,
        status: receipt.status === 1 ? 'confirmed' : 'failed',
        gasUsed: receipt.gasUsed.toString(),
        effectiveGasPrice: receipt.effectiveGasPrice.toString(),
        amount,
        formattedAmount: amount,
        network,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error(`Error transferring on ${network} EVM: ${error.message}`);
      
      // Handle timeout error
      if (error.message.includes('timeout')) {
        throw new Error(`Transaction confirmation timed out. Check the network explorer for transaction status.`);
      }
      
      throw error;
    }
  }

  /**
   * Call a contract method on the IOTA EVM with enhanced resilience
   * @param {string} network - Network name: 'iota', 'shimmer', or 'testnet'
   * @param {string} contractName - Contract name from config
   * @param {string} method - Method name
   * @param {Array} params - Method parameters
   * @param {Object} options - Transaction options
   * @returns {Promise<any>} - Method result or transaction receipt
   */
  async callContract(network = 'iota', contractName, method, params = [], options = {}) {
    // Get contract map for the network
    const contractMapName = `${network}Contracts`;
    const contractMap = network === 'iota' ? this.contracts : this[contractMapName];
    
    if (!contractMap || !contractMap[contractName]) {
      throw new Error(`Contract ${contractName} not available for network: ${network}`);
    }
    
    const contract = contractMap[contractName];
    
    // Check if method exists
    if (typeof contract[method] !== 'function') {
      throw new Error(`Method ${method} does not exist on contract ${contractName}`);
    }
    
    try {
      logger.info(`Calling ${method} on ${contractName} (${network})`);
      
      // Determine if this is a read or write operation
      const methodAbi = contract.interface.functions[
        Object.keys(contract.interface.functions).find(
          f => contract.interface.functions[f].name === method
        )
      ];
      
      const isReadOperation = methodAbi.constant;
      
      // For read operations, potentially use cache
      if (isReadOperation && options.useCache !== false) {
        const cacheKey = `contract:${network}:${contractName}:${method}:${JSON.stringify(params)}`;
        
        return await this.getCachedData(
          cacheKey,
          async () => await contract[method](...params),
          options.cacheTTL || 60 // Default 60 seconds for read operations
        );
      } else if (isReadOperation) {
        // Read operation but skip cache
        return await withExponentialBackoff(async () => {
          return await contract[method](...params);
        });
      } else {
        // Write operation
        logger.info(`Sending transaction to ${method} on ${contractName} (${network})`);
        
        // Send transaction with resilience
        const tx = await withExponentialBackoff(async () => {
          try {
            return await contract[method](...params, {
              gasLimit: options.gasLimit || config.gas?.limit || 3000000,
              gasPrice: options.gasPrice || config.gas?.price || ethers.utils.parseUnits('1.0', 'gwei'),
              value: options.value ? ethers.utils.parseEther(options.value) : 0,
              nonce: options.nonce // Let ethers determine if not provided
            });
          } catch (error) {
            // Provide better error messages for common issues
            if (error.message.includes('insufficient funds')) {
              throw new Error(`Insufficient funds for contract call: ${error.message}`);
            } else if (error.message.includes('gas')) {
              throw new Error(`Gas error: ${error.message}. Try providing a higher gas limit.`);
            } else if (error.message.includes('nonce')) {
              throw new Error(`Nonce error: ${error.message}. Try providing a specific nonce.`);
            }
            
            throw error;
          }
        });
        
        logger.info(`Transaction sent: ${tx.hash}, waiting for confirmation...`);
        
        // Wait for transaction to be mined with timeout
        const receipt = await Promise.race([
          tx.wait(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Transaction confirmation timeout')), 
            options.timeout || 180000) // 3 minutes timeout
          )
        ]);
        
        logger.info(`Transaction confirmed on ${network}: ${receipt.transactionHash}`);
        
        // Clear related caches
        this.clearCache(`contract:${network}:${contractName}:*`);
        
        // Parse events if requested
        let events = [];
        if (options.parseEvents !== false) {
          try {
            events = receipt.logs.map(log => {
              try {
                return contract.interface.parseLog(log);
              } catch (e) {
                return null;
              }
            }).filter(event => event !== null);
          } catch (error) {
            logger.error(`Error parsing events: ${error.message}`);
          }
        }
        
        return {
          hash: receipt.transactionHash,
          from: receipt.from,
          to: receipt.to,
          contractAddress: contract.address,
          method,
          blockNumber: receipt.blockNumber,
          confirmations: receipt.confirmations,
          status: receipt.status === 1 ? 'confirmed' : 'failed',
          gasUsed: receipt.gasUsed.toString(),
          effectiveGasPrice: receipt.effectiveGasPrice.toString(),
          network,
          events,
          timestamp: new Date().toISOString()
        };
      }
    } catch (error) {
      logger.error(`Error calling contract method ${method} on ${contractName}: ${error.message}`);
      
      // Handle timeout error
      if (error.message.includes('timeout')) {
        throw new Error(`Contract operation timed out. Check the network explorer for transaction status.`);
      }
      
      throw error;
    }
  }

  /**
   * Get balance of an address on IOTA EVM with caching
   * @param {string} network - Network name: 'iota', 'shimmer', or 'testnet'
   * @param {string} address - Address to check
   * @returns {Promise<string>} - Balance in ETH format
   */
  async getEVMBalance(network = 'iota', address) {
    return await this.getCachedData(
      `evm_balance:${network}:${address}`,
      async () => {
        try {
          // Select appropriate provider
          const provider = this[`${network}EvmProvider`];
          
          if (!provider) {
            throw new Error(`No provider available for network: ${network}`);
          }
          
          logger.info(`Getting EVM balance for ${address} on ${network}`);
          
          // Get balance with resilience
          const balance = await withExponentialBackoff(async () => {
            return await provider.getBalance(address);
          });
          
          // Format and return with additional info
          const formattedBalance = ethers.utils.formatEther(balance);
          
          return {
            address,
            network,
            balance: formattedBalance,
            rawBalance: balance.toString(),
            timestamp: new Date().toISOString()
          };
        } catch (error) {
          logger.error(`Error getting EVM balance for ${address} on ${network}: ${error.message}`);
          throw error;
        }
      },
      30 // Cache for 30 seconds
    );
  }

  /**
   * Generate a new address for the specified network
   * @param {string} network - Network name: 'iota', 'shimmer', or 'testnet'
   * @param {Object} options - Address generation options
   * @returns {Promise<string>} - Generated address
   */
  async generateAddress(network = 'iota', options = {}) {
    try {
      // Get account for this network
      const account = this.accounts[network];
      
      if (!account) {
        throw new Error(`No account available for network: ${network}`);
      }
      
      logger.info(`Generating new address for ${network}`);
      
      // Generate address with enhanced options
      const address = await generateWalletAddress(account, {
        metadata: options.metadata || `Generated for ${network} by IntelliLend`,
        internal: options.internal === true
      });
      
      logger.info(`Generated address for ${network}: ${address}`);
      
      // Get network information for explorer URL
      const networkInfo = await this.getNetworkInfo(network);
      
      return {
        address,
        network,
        explorerUrl: `${config.getExplorerAddressUrl(address, network)}`,
        bech32Hrp: networkInfo.bech32Hrp,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error(`Error generating address for ${network}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get native token balance for an address with caching
   * @param {string} network - Network name: 'iota', 'shimmer', or 'testnet'
   * @param {string} address - Address to check
   * @returns {Promise<Object>} - Balance information
   */
  async getNativeBalance(network = 'iota', address) {
    return await this.getCachedData(
      `native_balance:${network}:${address}`,
      async () => {
        try {
          // Get client and node manager for this network
          const client = this.clients[network];
          const nodeManager = this.nodeManagers[network];
          
          if (!client) {
            throw new Error(`No client available for network: ${network}`);
          }
          
          logger.info(`Getting native balance for ${address} on ${network}`);
          
          // Get balance with resilience
          const balance = await getBalance(client, address, nodeManager);
          
          // Format for better readability
          const baseAmount = BigInt(balance.baseCoins) / BigInt(1000000);
          
          // Get network information for token symbol
          const networkInfo = await this.getNetworkInfo(network);
          const tokenSymbol = networkInfo.bech32Hrp?.toUpperCase() || 'SMR';
          
          return {
            address,
            network,
            baseCoins: balance.baseCoins,
            baseCoinsFormatted: `${baseAmount.toString()} ${tokenSymbol}`,
            formattedBalance: `${baseAmount.toString()} ${tokenSymbol}`,
            nativeTokens: balance.nativeTokens || [],
            explorerUrl: `${config.getExplorerAddressUrl(address, network)}`,
            timestamp: new Date().toISOString()
          };
        } catch (error) {
          logger.error(`Error getting native balance for ${address} on ${network}: ${error.message}`);
          throw error;
        }
      },
      30 // Cache for 30 seconds
    );
  }

  /**
   * Send native tokens from an account
   * @param {string} network - Network name: 'iota', 'shimmer', or 'testnet'
   * @param {string} to - Recipient address
   * @param {string} amount - Amount to send
   * @param {Object} options - Transaction options
   * @returns {Promise<Object>} - Transaction result
   */
  async sendNativeTokens(network = 'iota', to, amount, options = {}) {
    try {
      // Get account for this network
      const account = this.accounts[network];
      
      if (!account) {
        throw new Error(`No account available for network: ${network}`);
      }
      
      logger.info(`Sending ${amount} native tokens on ${network} to ${to}`);
      
      // Send tokens with enhanced options
      const result = await sendTokens(account, amount, to, {
        tag: options.tag || 'IntelliLend',
        metadata: options.metadata || 'Sent via IntelliLend Platform',
        monitor: options.monitor !== false,
        statusCallback: options.statusCallback,
        syncFirst: true // Always sync account first
      });
      
      logger.info(`Native tokens sent on ${network}: ${result.blockId}`);
      
      // Clear related caches
      this.clearCache(`native_balance:${network}:*`);
      
      return {
        transactionId: result.transactionId,
        blockId: result.blockId,
        amount: result.formattedAmount,
        to,
        network,
        status: 'pending',
        timestamp: new Date(result.timestamp).toISOString(),
        monitoring: result.monitoring
      };
    } catch (error) {
      logger.error(`Error sending native tokens on ${network}: ${error.message}`);
      throw error;
    }
  }
}

module.exports = new IOTABlockchainService();
