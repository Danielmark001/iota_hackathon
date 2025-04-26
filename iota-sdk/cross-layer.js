/**
 * IOTA Cross-Layer Aggregator
 * 
 * Handles cross-layer communication between IOTA L1 (Move) and L2 (EVM).
 * Provides a unified interface for transmitting data across the layers.
 */

const logger = require('./utils/logger');
const { withExponentialBackoff, withCache } = require('./client');
const { ethers } = require('ethers');

// Bridge ABI for cross-layer communication
const BRIDGE_ABI = [
  // Basic bridge functions
  "function sendMessageToL1(address targetAddress, string messageType, bytes payload) external returns (uint256 messageId)",
  "function sendMessageToL2(address targetAddress, string messageType, bytes payload) external returns (uint256 messageId)",
  "function getMessageStatus(uint256 messageId) external view returns (uint8 status, uint16 confirmations, uint256 timestamp)",
  "function getMessageIds(address user) external view returns (uint256[] memory messageIds)",
  "function getMessageDetails(uint256 messageId) external view returns (address sender, address targetAddress, string messageType, uint8 status, uint8 direction, uint256 timestamp, bytes payload)"
];

class CrossLayerAggregator {
  constructor(options = {}) {
    this.client = options.client;
    this.bridgeAddress = options.bridgeAddress;
    this.l1NetworkType = options.l1NetworkType || 'iota';
    this.l2NetworkType = options.l2NetworkType || 'evm';
    this.privateKey = options.privateKey;
    this.provider = options.provider || (options.l2NetworkType === 'evm' ? 'https://api.shimmer.network/evm' : null);
    this.streamsService = options.streamsService;
    this.evmProvider = null;
    this.bridge = null;
    this.wallet = null;
    
    // In-memory cache for cross-layer message status
    this.messageStatusCache = new Map();
    
    // Initialize connector
    this.initialize();
    
    logger.info('Cross-Layer Aggregator initialized');
  }
  
  /**
   * Initialize connector and establish connections
   */
  async initialize() {
    try {
      // Initialize EVM provider
      if (this.provider) {
        this.evmProvider = new ethers.providers.JsonRpcProvider(this.provider);
        logger.info(`Connected to L2 provider at ${this.provider}`);
      }
      
      // Initialize wallet if private key is provided
      if (this.privateKey && this.evmProvider) {
        this.wallet = new ethers.Wallet(this.privateKey, this.evmProvider);
        logger.info('Wallet initialized for cross-layer operations');
      }
      
      // Initialize bridge contract if address is provided
      if (this.bridgeAddress && this.evmProvider) {
        // Use wallet if available, otherwise read-only
        const bridgeConnection = this.wallet || this.evmProvider;
        this.bridge = new ethers.Contract(this.bridgeAddress, BRIDGE_ABI, bridgeConnection);
        logger.info(`Bridge contract initialized at ${this.bridgeAddress}`);
      }
    } catch (error) {
      logger.error(`Error initializing cross-layer connector: ${error.message}`);
    }
  }
  
  /**
   * Set wallet for signing transactions
   * @param {string} privateKey - Private key for wallet
   */
  setWallet(privateKey) {
    try {
      if (!this.evmProvider) {
        throw new Error('EVM provider not initialized');
      }
      
      this.privateKey = privateKey;
      this.wallet = new ethers.Wallet(privateKey, this.evmProvider);
      
      // Reconnect bridge with wallet
      if (this.bridgeAddress) {
        this.bridge = new ethers.Contract(this.bridgeAddress, BRIDGE_ABI, this.wallet);
      }
      
      logger.info('Wallet initialized for cross-layer operations');
    } catch (error) {
      logger.error(`Error setting wallet: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Send a message from L2 (EVM) to L1 (IOTA)
   * @param {Object} options - Message options
   * @returns {Promise<Object>} Message result
   */
  async sendMessageToL1(options) {
    try {
      const { targetAddress, messageType, payload, sender, useBridge = true, useStreams = false } = options;
      
      if (!targetAddress) {
        throw new Error('Target address is required');
      }
      
      if (!messageType) {
        throw new Error('Message type is required');
      }
      
      logger.info(`Sending message to L1: ${messageType}`);
      
      // Track delivery status
      const delivery = {
        messageId: null,
        bridgeStatus: 'not_attempted',
        streamsStatus: 'not_attempted',
        timestamp: Date.now()
      };
      
      // Send via bridge if enabled
      if (useBridge) {
        try {
          if (!this.bridge) {
            throw new Error('Bridge not initialized');
          }
          
          if (!this.wallet) {
            throw new Error('Wallet not initialized for sending transactions');
          }
          
          // Convert payload to bytes if needed
          const payloadBytes = typeof payload === 'string' 
            ? ethers.utils.toUtf8Bytes(payload)
            : ethers.utils.toUtf8Bytes(JSON.stringify(payload));
          
          // Send message via bridge
          const tx = await this.bridge.sendMessageToL1(
            targetAddress,
            messageType,
            payloadBytes
          );
          
          // Wait for transaction to be mined
          const receipt = await tx.wait();
          
          // Extract messageId from events
          const messageIdEvent = receipt.events?.find(e => e.event === 'MessageSent');
          const messageId = messageIdEvent?.args?.messageId?.toString() || null;
          
          delivery.messageId = messageId;
          delivery.bridgeStatus = 'sent';
          delivery.transactionHash = receipt.transactionHash;
          
          logger.info(`Message sent via bridge with ID ${messageId}`);
        } catch (bridgeError) {
          logger.error(`Error sending message via bridge: ${bridgeError.message}`);
          delivery.bridgeStatus = 'failed';
          delivery.bridgeError = bridgeError.message;
          
          // Only throw if streams is not enabled as fallback
          if (!useStreams) {
            throw bridgeError;
          }
        }
      }
      
      // Send via streams if enabled
      if (useStreams) {
        try {
          if (!this.streamsService) {
            throw new Error('Streams service not initialized');
          }
          
          // Format message
          const message = {
            type: 'CROSS_LAYER_MESSAGE',
            messageType,
            targetAddress,
            payload,
            sender: sender || (this.wallet ? this.wallet.address : 'unknown'),
            timestamp: Date.now(),
            messageId: delivery.messageId // Include bridge messageId if available
          };
          
          // Send message via streams
          const result = await this.streamsService.sendMessage(message);
          
          delivery.streamsStatus = 'sent';
          delivery.streamsTxId = result.messageId;
          
          logger.info(`Message sent via streams with ID ${result.messageId}`);
          
          // If bridge failed, use streams messageId
          if (delivery.bridgeStatus === 'failed' && !delivery.messageId) {
            delivery.messageId = result.messageId;
          }
        } catch (streamsError) {
          logger.error(`Error sending message via streams: ${streamsError.message}`);
          delivery.streamsStatus = 'failed';
          delivery.streamsError = streamsError.message;
          
          // Only throw if bridge also failed or was not attempted
          if (delivery.bridgeStatus !== 'sent') {
            throw streamsError;
          }
        }
      }
      
      // If neither bridge nor streams succeeded
      if (delivery.bridgeStatus !== 'sent' && delivery.streamsStatus !== 'sent') {
        throw new Error('Failed to send message via any channel');
      }
      
      // Generate a messageId if none exists
      if (!delivery.messageId) {
        delivery.messageId = `msg-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
      }
      
      // Cache message status
      this.messageStatusCache.set(delivery.messageId.toString(), {
        status: 'pending',
        bridgeStatus: delivery.bridgeStatus,
        streamsStatus: delivery.streamsStatus,
        timestamp: Date.now()
      });
      
      return delivery;
    } catch (error) {
      logger.error(`Error sending cross-layer message: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Get status of a cross-layer message
   * @param {string} messageId - Message ID
   * @returns {Promise<Object>} Message status
   */
  async getMessageStatus(messageId) {
    try {
      if (!messageId) {
        throw new Error('Message ID is required');
      }
      
      logger.info(`Getting status for message: ${messageId}`);
      
      // Check cache first
      const cacheKey = `message-status-${messageId}`;
      
      return await withCache(cacheKey, async () => {
        let bridgeStatus = null;
        let streamsStatus = null;
        
        // Check bridge status if available
        if (this.bridge) {
          try {
            const status = await this.bridge.getMessageStatus(messageId);
            
            bridgeStatus = {
              status: ['Pending', 'Processed', 'Failed', 'Canceled'][status.status] || 'Unknown',
              confirmations: status.confirmations.toNumber(),
              timestamp: status.timestamp.toNumber() * 1000 // Convert to JS timestamp
            };
          } catch (bridgeError) {
            logger.debug(`Error getting bridge status: ${bridgeError.message}`);
            // Not found in bridge, could be streams-only message
          }
        }
        
        // Check streams status if available
        if (this.streamsService) {
          try {
            const messages = await this.streamsService.getMessages({
              filter: {
                messageId
              }
            });
            
            if (messages && messages.length > 0) {
              const message = messages[0];
              
              streamsStatus = {
                status: message.confirmed ? 'Confirmed' : 'Pending',
                timestamp: message.timestamp
              };
            }
          } catch (streamsError) {
            logger.debug(`Error getting streams status: ${streamsError.message}`);
            // Not found in streams, could be bridge-only message
          }
        }
        
        // Check in-memory cache as fallback
        let cachedStatus = null;
        if (this.messageStatusCache.has(messageId.toString())) {
          cachedStatus = this.messageStatusCache.get(messageId.toString());
        }
        
        // Combine statuses
        let status;
        if (bridgeStatus) {
          status = bridgeStatus.status;
        } else if (streamsStatus) {
          status = streamsStatus.status;
        } else if (cachedStatus) {
          status = cachedStatus.status;
        } else {
          return null; // Message not found
        }
        
        return {
          messageId,
          status,
          bridgeStatus,
          streamsStatus,
          confirmations: bridgeStatus ? bridgeStatus.confirmations : 0,
          timestamp: bridgeStatus?.timestamp || streamsStatus?.timestamp || cachedStatus?.timestamp || Date.now()
        };
      }, { cacheTTL: 10000 }); // 10 second cache for status
    } catch (error) {
      logger.error(`Error getting message status: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Get user messages across all channels
   * @param {string} address - User address
   * @returns {Promise<Array>} User messages
   */
  async getUserMessages(address) {
    try {
      if (!address) {
        throw new Error('Address is required');
      }
      
      logger.info(`Getting messages for user: ${address}`);
      
      // Use caching for better performance
      const cacheKey = `user-messages-${address}`;
      
      return await withCache(cacheKey, async () => {
        const messages = [];
        
        // Get bridge messages if available
        if (this.bridge) {
          try {
            const messageIds = await this.bridge.getMessageIds(address);
            
            // Get details for each message
            for (const id of messageIds) {
              try {
                const details = await this.bridge.getMessageDetails(id);
                
                // Convert to readable format
                messages.push({
                  messageId: id.toString(),
                  sender: details.sender,
                  targetAddress: details.targetAddress,
                  messageType: details.messageType,
                  status: ['Pending', 'Processed', 'Failed', 'Canceled'][details.status] || 'Unknown',
                  direction: details.direction === 0 ? 'L2ToL1' : 'L1ToL2',
                  timestamp: details.timestamp.toNumber() * 1000, // Convert to JS timestamp
                  payload: details.payload ? ethers.utils.toUtf8String(details.payload) : '',
                  source: 'bridge'
                });
              } catch (detailsError) {
                logger.error(`Error getting details for message ${id}: ${detailsError.message}`);
              }
            }
          } catch (bridgeError) {
            logger.error(`Error getting bridge messages: ${bridgeError.message}`);
          }
        }
        
        // Get streams messages if available
        if (this.streamsService) {
          try {
            const streamsMessages = await this.streamsService.getMessages({
              filter: {
                type: 'CROSS_LAYER_MESSAGE',
                userAddress: address
              }
            });
            
            // Add streams messages
            for (const msg of streamsMessages) {
              // Check if message already exists from bridge
              const existingIndex = messages.findIndex(m => 
                m.messageId === msg.messageId || 
                (m.messageType === msg.messageType && 
                 m.timestamp === msg.timestamp && 
                 m.targetAddress === msg.targetAddress)
              );
              
              if (existingIndex >= 0) {
                // Update existing message with streams info
                messages[existingIndex].streamsConfirmed = msg.confirmed;
                messages[existingIndex].streamsTxId = msg.id;
              } else {
                // Add as new message
                messages.push({
                  messageId: msg.messageId || msg.id,
                  sender: msg.sender,
                  targetAddress: msg.targetAddress,
                  messageType: msg.messageType,
                  status: msg.confirmed ? 'Confirmed' : 'Pending',
                  timestamp: msg.timestamp,
                  payload: msg.payload || msg.content,
                  source: 'streams',
                  streamsTxId: msg.id
                });
              }
            }
          } catch (streamsError) {
            logger.error(`Error getting streams messages: ${streamsError.message}`);
          }
        }
        
        // Sort by timestamp, newest first
        messages.sort((a, b) => b.timestamp - a.timestamp);
        
        return messages;
      }, { cacheTTL: 60000 }); // 1 minute cache
    } catch (error) {
      logger.error(`Error getting user messages: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Get user data from both L1 and L2
   * @param {string} address - User address
   * @returns {Promise<Object>} User data from both layers
   */
  async getUserData(address) {
    try {
      if (!address) {
        throw new Error('Address is required');
      }
      
      logger.info(`Getting cross-layer data for user: ${address}`);
      
      // Use caching for better performance
      const cacheKey = `user-data-${address}`;
      
      return await withCache(cacheKey, async () => {
        // Get messages for activity data
        const messages = await this.getUserMessages(address);
        
        // Get L1 data
        let l1Data = null;
        if (this.client) {
          try {
            // Derive IOTA address from Ethereum address (simplified)
            // In a real implementation, this would use a proper derivation
            const iotaAddress = await this.deriveIotaAddress(address);
            
            // Get transaction data
            const txData = await this.client.getAddressOutputs(iotaAddress);
            
            l1Data = {
              address: iotaAddress,
              transactionCount: txData.length,
              lastUpdated: Date.now()
            };
          } catch (l1Error) {
            logger.error(`Error getting L1 data: ${l1Error.message}`);
          }
        }
        
        // Get L2 data
        let l2Data = null;
        if (this.evmProvider) {
          try {
            // Get basic account data
            const balance = await this.evmProvider.getBalance(address);
            const txCount = await this.evmProvider.getTransactionCount(address);
            
            l2Data = {
              address: address,
              balance: ethers.utils.formatEther(balance),
              transactionCount: txCount,
              lastUpdated: Date.now()
            };
          } catch (l2Error) {
            logger.error(`Error getting L2 data: ${l2Error.message}`);
          }
        }
        
        return {
          crossLayerEnabled: true,
          address,
          l1Data,
          l2Data,
          bridgeMessages: messages,
          messageCount: messages.length,
          lastActivity: messages.length > 0 ? messages[0].timestamp : null,
          lastUpdated: Date.now()
        };
      }, { cacheTTL: 120000 }); // 2 minute cache
    } catch (error) {
      logger.error(`Error getting user data: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Derive IOTA address from Ethereum address
   * @param {string} ethAddress - Ethereum address
   * @returns {Promise<string>} IOTA address
   */
  async deriveIotaAddress(ethAddress) {
    try {
      // This is a simplified implementation
      // In a real application, this would use proper derivation
      
      // For now, we'll mock this by hashing the Ethereum address
      const hash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(ethAddress));
      const addressSeed = hash.slice(0, 32);
      
      // Request address from client if available
      if (this.client) {
        try {
          const seedBuffer = Buffer.from(addressSeed.slice(2), 'hex');
          const iotaAddress = await this.client.getAddressFromSeed(seedBuffer);
          return iotaAddress;
        } catch (clientError) {
          logger.error(`Error getting address from client: ${clientError.message}`);
        }
      }
      
      // Fallback: Generate a mock IOTA address
      // In production, use proper address generation
      const network = this.client 
        ? this.client.getSettings().networkInfo.bech32Hrp 
        : 'smr';
      
      return `${network}1${hash.slice(2, 58)}`;
    } catch (error) {
      logger.error(`Error deriving IOTA address: ${error.message}`);
      throw error;
    }
  }
}

/**
 * Create a Cross-Layer Aggregator
 * @param {Object} client - IOTA client
 * @param {Object} options - Aggregator options
 * @returns {Promise<CrossLayerAggregator>} The aggregator instance
 */
async function createAggregator(client, options = {}) {
  try {
    logger.info('Creating Cross-Layer Aggregator...');
    
    // Combine options with client
    const aggregatorOptions = {
      ...options,
      client
    };
    
    // Create aggregator
    const aggregator = new CrossLayerAggregator(aggregatorOptions);
    
    return aggregator;
  } catch (error) {
    logger.error(`Error creating Cross-Layer Aggregator: ${error.message}`);
    throw error;
  }
}

module.exports = {
  CrossLayerAggregator,
  createAggregator
};