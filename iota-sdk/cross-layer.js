/**
 * IOTA Cross-Layer Communication Module
 * 
 * This module provides functionality for cross-layer communication
 * between IOTA L1 (Tangle) and L2 (EVM), including atomic swaps and
 * message passing.
 */

const { ethers } = require('ethers');
const { submitBlock, monitorTransaction, getAddressTransactions, withExponentialBackoff } = require('./client');
const { sendTokens, monitorTransaction: monitorWalletTransaction } = require('./wallet');
const { CircuitBreaker } = require('./utils/circuit-breaker');
const logger = require('./utils/logger');
const config = require('./config');

// ABI for bridge contract
const BRIDGE_ABI = [
  "function sendMessage(address _to, bytes calldata _data) external payable returns (bytes32)",
  "function getMessageIds(address _address) external view returns (bytes32[])",
  "function getMessageStatus(bytes32 _messageId) external view returns (uint8)",
  "function relayMessage(bytes32 _messageId, address _from, address _to, bytes calldata _data) external",
  "function atomicSwap(address _recipient, uint256 _amount, uint256 _timelock) external payable returns (bytes32)",
  "function completeSwap(bytes32 _swapId) external",
  "function cancelSwap(bytes32 _swapId) external"
];

/**
 * Cross-Layer Aggregator for communication between L1 and L2
 */
class CrossLayerAggregator {
  /**
   * Create a new Cross-Layer Aggregator
   * @param {Object} client - IOTA client
   * @param {Object} options - Configuration options
   */
  constructor(client, options = {}) {
    this.client = client;
    this.wallet = options.wallet || null;
    this.account = options.account || null;
    this.evmProvider = options.evmProvider || null;
    this.bridgeAddress = options.bridgeAddress || null;
    this.privateKey = options.privateKey || null;
    this.bridgeContract = null;
    this.signer = null;
    this.l1NetworkType = options.l1NetworkType || 'iota';
    this.l2NetworkType = options.l2NetworkType || 'evm';
    
    // Initialize circuit breakers
    this.circuitBreaker = {
      l1ToL2: new CircuitBreaker({
        failureThreshold: 3,
        resetTimeout: 30000,
        fallbackFunction: () => ({ 
          messageId: null,
          error: 'Circuit open: L1 to L2 messaging is currently unavailable'
        })
      }),
      l2ToL1: new CircuitBreaker({
        failureThreshold: 3,
        resetTimeout: 30000,
        fallbackFunction: () => ({ 
          messageId: null,
          error: 'Circuit open: L2 to L1 messaging is currently unavailable'
        })
      }),
      atomicSwap: new CircuitBreaker({
        failureThreshold: 3,
        resetTimeout: 60000
      })
    };
    
    // Message ID cache to avoid duplication
    this.messageCache = new Map();
    
    // Initialize bridge contract if options are provided
    if (this.bridgeAddress && (this.evmProvider || this.privateKey)) {
      this.initializeBridge();
    }
    
    logger.info(`Cross-Layer Aggregator initialized for ${this.l1NetworkType} and ${this.l2NetworkType}`);
  }
  
  /**
   * Initialize bridge contract connection
   */
  async initializeBridge() {
    try {
      // Initialize EVM provider if not provided
      if (!this.evmProvider) {
        const network = process.env.IOTA_NETWORK || config.DEFAULT_NETWORK;
        const networkConfig = config.NETWORKS[network];
        
        if (!networkConfig || !networkConfig.evmRpcUrl) {
          throw new Error(`No EVM RPC URL configured for network: ${network}`);
        }
        
        this.evmProvider = new ethers.providers.JsonRpcProvider(networkConfig.evmRpcUrl);
        logger.info(`Connected to EVM RPC: ${networkConfig.evmRpcUrl}`);
      }
      
      // Initialize signer if private key is provided
      if (this.privateKey) {
        this.signer = new ethers.Wallet(this.privateKey, this.evmProvider);
        logger.info('Initialized EVM signer from private key');
      }
      
      // Use provider as signer fallback
      const contractSigner = this.signer || this.evmProvider;
      
      // Connect to bridge contract
      this.bridgeContract = new ethers.Contract(this.bridgeAddress, BRIDGE_ABI, contractSigner);
      logger.info(`Connected to bridge contract at ${this.bridgeAddress}`);
      
      return true;
    } catch (error) {
      logger.error(`Error initializing bridge: ${error.message}`);
      throw new Error(`Failed to initialize bridge: ${error.message}`);
    }
  }
  
  /**
   * Set bridge address and reinitialize bridge
   * @param {string} bridgeAddress - Bridge contract address
   */
  async setBridgeAddress(bridgeAddress) {
    this.bridgeAddress = bridgeAddress;
    return this.initializeBridge();
  }
  
  /**
   * Set EVM provider and reinitialize bridge
   * @param {Object} evmProvider - EVM provider
   */
  async setEvmProvider(evmProvider) {
    this.evmProvider = evmProvider;
    return this.initializeBridge();
  }
  
  /**
   * Set private key and reinitialize bridge
   * @param {string} privateKey - Private key for EVM transactions
   */
  async setPrivateKey(privateKey) {
    this.privateKey = privateKey;
    return this.initializeBridge();
  }
  
  /**
   * Set wallet account
   * @param {Object} account - IOTA wallet account
   */
  setAccount(account) {
    this.account = account;
    logger.info('IOTA wallet account set');
  }
  
  /**
   * Generate a unique message ID
   * @param {Object} message - Message object
   * @returns {string} Message ID
   */
  generateMessageId(message) {
    // Create a deterministic ID based on message content and timestamp
    const content = JSON.stringify(message) + Date.now().toString();
    const hash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(content));
    return hash;
  }
  
  /**
   * Send a message from L1 (IOTA) to L2 (EVM)
   * @param {Object} message - Message to send
   * @param {Object} options - Message options
   * @returns {Promise<Object>} Message result
   */
  async sendMessageToL2(message, options = {}) {
    return this.circuitBreaker.l1ToL2.execute(async () => {
      try {
        logger.info(`Sending message from L1 to L2: ${JSON.stringify(message)}`);
        
        // Validate message
        if (!message.targetAddress || !ethers.utils.isAddress(message.targetAddress)) {
          throw new Error('Invalid target address for L2 message');
        }
        
        if (!message.payload) {
          throw new Error('Message payload is required');
        }
        
        // Use bridge contract if available
        if (this.bridgeContract && this.signer) {
          // Encode message data
          const encodedData = ethers.utils.defaultAbiCoder.encode(
            ['bytes'],
            [ethers.utils.toUtf8Bytes(JSON.stringify(message.payload))]
          );
          
          // Send message through bridge
          const tx = await this.bridgeContract.sendMessage(
            message.targetAddress,
            encodedData,
            { gasLimit: options.gasLimit || 500000 }
          );
          
          logger.info(`Message sent to L2, waiting for confirmation: ${tx.hash}`);
          
          // Wait for confirmation
          const receipt = await tx.wait();
          
          // Extract message ID from events
          let messageId = null;
          if (receipt.events && receipt.events.length > 0) {
            const event = receipt.events.find(e => e.event === 'MessageSent');
            if (event && event.args && event.args.messageId) {
              messageId = event.args.messageId;
            }
          }
          
          // If messageId not found, use a generated ID
          if (!messageId) {
            messageId = this.generateMessageId(message);
          }
          
          // Cache message
          this.messageCache.set(messageId, {
            ...message,
            direction: 'L1ToL2',
            timestamp: Date.now(),
            transactionHash: receipt.transactionHash
          });
          
          logger.info(`Message confirmed on L2, message ID: ${messageId}`);
          
          return {
            messageId,
            transactionHash: receipt.transactionHash,
            blockNumber: receipt.blockNumber,
            status: 'confirmed',
            timestamp: Date.now()
          };
        } else {
          // Fallback to IOTA Tangle for message storage
          // Generate message ID
          const messageId = this.generateMessageId(message);
          
          // Create message object
          const messageData = {
            id: messageId,
            targetAddress: message.targetAddress,
            payload: message.payload,
            sender: options.sender || 'unknown',
            direction: 'L1ToL2',
            timestamp: Date.now(),
            status: 'pending'
          };
          
          // Submit to IOTA Tangle as tagged data
          const blockData = {
            payload: {
              type: 1, // Tagged data
              tag: Buffer.from('CROSS_LAYER_MESSAGE').toString('hex'),
              data: Buffer.from(JSON.stringify(messageData)).toString('hex')
            }
          };
          
          // Submit block
          const result = await submitBlock(this.client, blockData);
          
          // Cache message
          this.messageCache.set(messageId, {
            ...messageData,
            blockId: result.blockId
          });
          
          logger.info(`Message stored on L1, message ID: ${messageId}, block ID: ${result.blockId}`);
          
          return {
            messageId,
            blockId: result.blockId,
            status: 'pending',
            timestamp: Date.now()
          };
        }
      } catch (error) {
        logger.error(`Error sending message from L1 to L2: ${error.message}`);
        throw new Error(`Failed to send message from L1 to L2: ${error.message}`);
      }
    });
  }
  
  /**
   * Send a message from L2 (EVM) to L1 (IOTA)
   * @param {Object} message - Message to send
   * @param {Object} options - Message options
   * @returns {Promise<Object>} Message result
   */
  async sendMessageToL1(message, options = {}) {
    return this.circuitBreaker.l2ToL1.execute(async () => {
      try {
        logger.info(`Sending message from L2 to L1: ${JSON.stringify(message)}`);
        
        // Validate message
        if (!message.targetAddress) {
          throw new Error('Target address is required for L1 message');
        }
        
        if (!message.payload) {
          throw new Error('Message payload is required');
        }
        
        // Use bridge and streams for redundancy
        const useBridge = options.useBridge !== false;
        const useStreams = options.useStreams !== false;
        
        // Generate message ID
        const messageId = this.generateMessageId(message);
        
        // Create message object
        const messageData = {
          id: messageId,
          targetAddress: message.targetAddress,
          payload: message.payload,
          sender: options.sender || 'unknown',
          direction: 'L2ToL1',
          timestamp: Date.now(),
          status: 'pending'
        };
        
        // Bridge result (if used)
        let bridgeResult = null;
        
        // If using bridge and account is available, send a message through bridge
        if (useBridge && this.account) {
          try {
            // Submit the message data to the Tangle for bridge pickup
            const blockData = {
              payload: {
                type: 1, // Tagged data
                tag: Buffer.from('BRIDGE_MESSAGE').toString('hex'),
                data: Buffer.from(JSON.stringify(messageData)).toString('hex')
              }
            };
            
            // Submit block
            bridgeResult = await submitBlock(this.client, blockData);
            logger.info(`Bridge message stored on Tangle, block ID: ${bridgeResult.blockId}`);
          } catch (bridgeError) {
            logger.error(`Bridge message failed: ${bridgeError.message}`);
            bridgeResult = { error: bridgeError.message };
          }
        }
        
        // Streams result (if used)
        let streamsResult = null;
        
        // If using streams and streams service is available
        if (useStreams && options.streamsService) {
          try {
            // Send through streams
            streamsResult = await options.streamsService.sendMessage({
              type: 'CROSS_LAYER_MESSAGE',
              data: messageData
            });
            logger.info(`Message sent through streams, stream ID: ${streamsResult.messageId}`);
          } catch (streamsError) {
            logger.error(`Streams message failed: ${streamsError.message}`);
            streamsResult = { error: streamsError.message };
          }
        }
        
        // Submit message to Tangle as well for redundancy
        const blockData = {
          payload: {
            type: 1, // Tagged data
            tag: Buffer.from('CROSS_LAYER_MESSAGE').toString('hex'),
            data: Buffer.from(JSON.stringify(messageData)).toString('hex')
          }
        };
        
        // Submit block
        const result = await submitBlock(this.client, blockData);
        
        // Cache message
        this.messageCache.set(messageId, {
          ...messageData,
          blockId: result.blockId,
          bridgeResult,
          streamsResult
        });
        
        logger.info(`Message stored on Tangle, message ID: ${messageId}, block ID: ${result.blockId}`);
        
        return {
          messageId,
          blockId: result.blockId,
          bridgeStatus: bridgeResult ? 'sent' : 'not_used',
          streamsStatus: streamsResult ? 'sent' : 'not_used',
          status: 'pending',
          timestamp: Date.now()
        };
      } catch (error) {
        logger.error(`Error sending message from L2 to L1: ${error.message}`);
        throw new Error(`Failed to send message from L2 to L1: ${error.message}`);
      }
    });
  }
  
  /**
   * Get message status
   * @param {string} messageId - Message ID to check
   * @returns {Promise<Object>} Message status
   */
  async getMessageStatus(messageId) {
    try {
      logger.info(`Getting status for message: ${messageId}`);
      
      // Check cache first
      const cachedMessage = this.messageCache.get(messageId);
      
      // If bridge contract is available and messageId looks like a hash, try to get status from bridge
      if (this.bridgeContract && messageId.startsWith('0x')) {
        try {
          const statusCode = await this.bridgeContract.getMessageStatus(messageId);
          
          // Convert status code to string
          const statusMap = {
            0: 'pending',
            1: 'processing',
            2: 'confirmed',
            3: 'failed'
          };
          
          const status = statusMap[statusCode] || 'unknown';
          
          logger.info(`Message ${messageId} status from bridge: ${status}`);
          
          // Update cache if message exists
          if (cachedMessage) {
            cachedMessage.status = status;
            cachedMessage.lastChecked = Date.now();
            this.messageCache.set(messageId, cachedMessage);
          }
          
          return {
            messageId,
            status,
            source: 'bridge',
            lastChecked: Date.now(),
            ...(cachedMessage || {})
          };
        } catch (bridgeError) {
          logger.warn(`Error getting message status from bridge: ${bridgeError.message}`);
          // Continue to check Tangle if bridge fails
        }
      }
      
      // Check on Tangle if message is cached with a blockId
      if (cachedMessage && cachedMessage.blockId) {
        try {
          // Get the block metadata
          const metadata = await this.client.blockMetadata(cachedMessage.blockId);
          
          let status = 'pending';
          if (metadata.milestone_timestamp_booked) {
            status = 'confirmed';
          } else if (metadata.is_conflicting) {
            status = 'conflicting';
          }
          
          logger.info(`Message ${messageId} status from Tangle: ${status}`);
          
          // Update cache
          cachedMessage.status = status;
          cachedMessage.lastChecked = Date.now();
          cachedMessage.metadata = metadata;
          this.messageCache.set(messageId, cachedMessage);
          
          return {
            messageId,
            status,
            source: 'tangle',
            lastChecked: Date.now(),
            ...cachedMessage
          };
        } catch (tangleError) {
          logger.warn(`Error getting message status from Tangle: ${tangleError.message}`);
        }
      }
      
      // If we still have cachedMessage but couldn't get updated status
      if (cachedMessage) {
        return {
          messageId,
          status: cachedMessage.status || 'unknown',
          source: 'cache',
          lastChecked: Date.now(),
          ...cachedMessage
        };
      }
      
      // If we reach here, the message wasn't found
      logger.warn(`Message ${messageId} not found in cache or on-chain`);
      throw new Error(`Message ${messageId} not found`);
    } catch (error) {
      logger.error(`Error getting message status: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Get all messages for a user
   * @param {string} address - User address (IOTA or EVM)
   * @returns {Promise<Object[]>} Array of messages
   */
  async getUserMessages(address) {
    try {
      logger.info(`Getting messages for user: ${address}`);
      
      const messages = [];
      
      // Check bridge contract if available
      if (this.bridgeContract && ethers.utils.isAddress(address)) {
        try {
          const messageIds = await this.bridgeContract.getMessageIds(address);
          
          // Get details for each message ID
          for (const messageId of messageIds) {
            try {
              const status = await this.getMessageStatus(messageId);
              messages.push(status);
            } catch (statusError) {
              logger.warn(`Error getting status for message ${messageId}: ${statusError.message}`);
              // Add basic info
              messages.push({
                messageId,
                status: 'unknown',
                source: 'bridge',
                error: statusError.message
              });
            }
          }
        } catch (bridgeError) {
          logger.warn(`Error getting messages from bridge: ${bridgeError.message}`);
        }
      }
      
      // Check Tangle for messages
      try {
        // Get all transactions with the CROSS_LAYER_MESSAGE tag
        const tag = Buffer.from('CROSS_LAYER_MESSAGE').toString('hex');
        
        // Query for messages with this tag
        const tangleMessages = await getAddressTransactions(this.client, tag);
        
        // Process each message
        for (const message of tangleMessages) {
          try {
            // Parse the message data
            const messageData = JSON.parse(Buffer.from(message.data, 'hex').toString());
            
            // Check if this message is for the specified address
            if (
              messageData.targetAddress === address ||
              messageData.sender === address
            ) {
              // Check if this message is already in the results
              const existing = messages.find(m => m.messageId === messageData.id);
              
              if (!existing) {
                // Add message to results
                messages.push({
                  messageId: messageData.id,
                  blockId: message.blockId,
                  status: messageData.status || 'unknown',
                  source: 'tangle',
                  ...messageData
                });
              }
            }
          } catch (parseError) {
            logger.warn(`Error parsing message data: ${parseError.message}`);
            // Skip invalid messages
          }
        }
      } catch (tangleError) {
        logger.warn(`Error getting messages from Tangle: ${tangleError.message}`);
      }
      
      // Sort messages by timestamp (newest first)
      messages.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      
      return messages;
    } catch (error) {
      logger.error(`Error getting user messages: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Perform an atomic swap between L1 and L2
   * @param {Object} params - Swap parameters
   * @returns {Promise<Object>} Swap result
   */
  async atomicSwap(params) {
    return this.circuitBreaker.atomicSwap.execute(async () => {
      try {
        logger.info(`Initiating atomic swap: ${JSON.stringify(params)}`);
        
        // Validate parameters
        if (!params.amountL1 || !params.recipientL1) {
          throw new Error('L1 amount and recipient are required');
        }
        
        if (!params.amountL2 || !params.recipientL2) {
          throw new Error('L2 amount and recipient are required');
        }
        
        if (!params.timelock) {
          // Default timelock is 1 hour from now
          params.timelock = Math.floor(Date.now() / 1000) + 3600;
        }
        
        // Generate a unique swap ID
        const swapContent = JSON.stringify(params) + Date.now().toString();
        const swapId = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(swapContent));
        
        let l1Transaction = null;
        let l2Transaction = null;
        
        // Phase 1: Initialize swap on L2 if bridge contract is available
        if (this.bridgeContract && this.signer) {
          try {
            // Convert amount to wei
            const amountInWei = ethers.utils.parseEther(params.amountL2.toString());
            
            // Send transaction to bridge contract
            const tx = await this.bridgeContract.atomicSwap(
              params.recipientL2,
              amountInWei,
              params.timelock,
              { 
                value: amountInWei, 
                gasLimit: params.gasLimit || 500000 
              }
            );
            
            logger.info(`L2 swap initiated, waiting for confirmation: ${tx.hash}`);
            
            // Wait for confirmation
            const receipt = await tx.wait();
            
            logger.info(`L2 swap confirmed: ${receipt.transactionHash}`);
            
            l2Transaction = {
              transactionHash: receipt.transactionHash,
              blockNumber: receipt.blockNumber,
              status: 'confirmed'
            };
          } catch (l2Error) {
            logger.error(`Error initializing L2 swap: ${l2Error.message}`);
            throw new Error(`L2 swap failed: ${l2Error.message}`);
          }
        } else {
          logger.warn('No bridge contract available for L2 swap, skipping L2 phase');
        }
        
        // Phase 2: Send IOTA tokens for L1 part of the swap
        if (this.account) {
          try {
            // Send tokens with the swap ID in metadata
            const result = await sendTokens(
              this.account,
              params.amountL1,
              params.recipientL1,
              {
                tag: 'ATOMIC_SWAP',
                metadata: JSON.stringify({
                  swapId,
                  recipientL2: params.recipientL2,
                  amountL2: params.amountL2,
                  timelock: params.timelock
                }),
                monitor: true
              }
            );
            
            logger.info(`L1 swap initiated, block ID: ${result.blockId}`);
            
            l1Transaction = {
              blockId: result.blockId,
              status: 'pending'
            };
            
            // Start monitoring transaction
            monitorWalletTransaction(this.account, result.blockId, (status) => {
              if (status.status === 'confirmed') {
                logger.info(`L1 swap confirmed: ${result.blockId}`);
                l1Transaction.status = 'confirmed';
                
                // If L2 is also confirmed, we can consider the swap complete
                if (l2Transaction && l2Transaction.status === 'confirmed') {
                  logger.info(`Atomic swap ${swapId} completed successfully`);
                  
                  // Store the completed swap status on Tangle
                  this.storeSwapStatus(swapId, 'completed');
                }
              }
            });
          } catch (l1Error) {
            logger.error(`Error initializing L1 swap: ${l1Error.message}`);
            
            // If L2 transaction was successful but L1 failed, we need to cancel the L2 transaction
            if (l2Transaction && l2Transaction.status === 'confirmed' && this.bridgeContract) {
              try {
                logger.info(`Cancelling L2 swap due to L1 failure: ${swapId}`);
                const tx = await this.bridgeContract.cancelSwap(swapId);
                await tx.wait();
                logger.info(`L2 swap cancelled: ${tx.hash}`);
              } catch (cancelError) {
                logger.error(`Error cancelling L2 swap: ${cancelError.message}`);
              }
            }
            
            throw new Error(`L1 swap failed: ${l1Error.message}`);
          }
        } else {
          logger.warn('No account available for L1 swap, skipping L1 phase');
        }
        
        // Store swap info on Tangle for tracking
        await this.storeSwapStatus(swapId, 'initiated');
        
        return {
          swapId,
          l1Transaction,
          l2Transaction,
          params,
          status: 'initiated',
          timestamp: Date.now()
        };
      } catch (error) {
        logger.error(`Error performing atomic swap: ${error.message}`);
        throw error;
      }
    });
  }
  
  /**
   * Store swap status on Tangle
   * @param {string} swapId - Swap ID
   * @param {string} status - Swap status
   * @returns {Promise<Object>} Result of storage operation
   */
  async storeSwapStatus(swapId, status) {
    try {
      // Create swap status object
      const swapStatus = {
        swapId,
        status,
        timestamp: Date.now()
      };
      
      // Submit to IOTA Tangle as tagged data
      const blockData = {
        payload: {
          type: 1, // Tagged data
          tag: Buffer.from('ATOMIC_SWAP_STATUS').toString('hex'),
          data: Buffer.from(JSON.stringify(swapStatus)).toString('hex')
        }
      };
      
      // Submit block
      const result = await submitBlock(this.client, blockData);
      
      logger.info(`Swap status stored on Tangle, swap ID: ${swapId}, status: ${status}, block ID: ${result.blockId}`);
      
      return {
        ...swapStatus,
        blockId: result.blockId
      };
    } catch (error) {
      logger.error(`Error storing swap status: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Get swap status
   * @param {string} swapId - Swap ID to check
   * @returns {Promise<Object>} Swap status
   */
  async getSwapStatus(swapId) {
    try {
      logger.info(`Getting status for swap: ${swapId}`);
      
      // Check bridge contract for L2 status if available
      let l2Status = 'unknown';
      
      if (this.bridgeContract) {
        try {
          const statusCode = await this.bridgeContract.getSwapStatus(swapId);
          
          // Convert status code to string
          const statusMap = {
            0: 'not_found',
            1: 'pending',
            2: 'completed',
            3: 'cancelled',
            4: 'expired'
          };
          
          l2Status = statusMap[statusCode] || 'unknown';
          
          logger.info(`Swap ${swapId} L2 status: ${l2Status}`);
        } catch (bridgeError) {
          logger.warn(`Error getting swap L2 status: ${bridgeError.message}`);
        }
      }
      
      // Check Tangle for latest swap status
      let l1Status = 'unknown';
      let statusHistory = [];
      
      try {
        // Get all transactions with the ATOMIC_SWAP_STATUS tag
        const tag = Buffer.from('ATOMIC_SWAP_STATUS').toString('hex');
        
        // Query for messages with this tag
        const statusMessages = await getAddressTransactions(this.client, tag);
        
        // Process each message to find the latest status
        for (const message of statusMessages) {
          try {
            // Parse the status data
            const statusData = JSON.parse(Buffer.from(message.data, 'hex').toString());
            
            // Check if this status is for the specified swap
            if (statusData.swapId === swapId) {
              // Add to history
              statusHistory.push({
                ...statusData,
                blockId: message.blockId
              });
            }
          } catch (parseError) {
            logger.warn(`Error parsing swap status data: ${parseError.message}`);
            // Skip invalid messages
          }
        }
        
        // Sort history by timestamp (newest first)
        statusHistory.sort((a, b) => b.timestamp - a.timestamp);
        
        // Get latest status
        if (statusHistory.length > 0) {
          l1Status = statusHistory[0].status;
          logger.info(`Swap ${swapId} L1 status: ${l1Status}`);
        }
      } catch (tangleError) {
        logger.warn(`Error getting swap L1 status: ${tangleError.message}`);
      }
      
      // Determine overall status
      let overallStatus = 'unknown';
      
      if (l1Status === 'completed' && l2Status === 'completed') {
        overallStatus = 'completed';
      } else if (l1Status === 'cancelled' || l2Status === 'cancelled') {
        overallStatus = 'cancelled';
      } else if (l1Status === 'expired' || l2Status === 'expired') {
        overallStatus = 'expired';
      } else if (l1Status === 'initiated' || l2Status === 'pending') {
        overallStatus = 'pending';
      }
      
      return {
        swapId,
        status: overallStatus,
        l1Status,
        l2Status,
        statusHistory,
        lastChecked: Date.now()
      };
    } catch (error) {
      logger.error(`Error getting swap status: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Synchronize data between L1 and L2
   * @param {Object} data - Data to synchronize
   * @param {Object} options - Synchronization options
   * @returns {Promise<Object>} Synchronization result
   */
  async syncData(data, options = {}) {
    try {
      logger.info(`Synchronizing data between L1 and L2: ${JSON.stringify(data)}`);
      
      // Generate a unique sync ID
      const syncId = this.generateMessageId(data);
      
      // Create messages for both directions
      const messages = [];
      
      // L1 to L2 message
      if (options.l2Address) {
        const l1ToL2Message = await this.sendMessageToL2({
          targetAddress: options.l2Address,
          payload: {
            type: 'SYNC_DATA',
            data,
            syncId,
            timestamp: Date.now()
          }
        });
        
        messages.push({
          direction: 'L1ToL2',
          messageId: l1ToL2Message.messageId,
          status: l1ToL2Message.status
        });
      }
      
      // L2 to L1 message
      if (options.l1Address) {
        const l2ToL1Message = await this.sendMessageToL1({
          targetAddress: options.l1Address,
          payload: {
            type: 'SYNC_DATA',
            data,
            syncId,
            timestamp: Date.now()
          }
        });
        
        messages.push({
          direction: 'L2ToL1',
          messageId: l2ToL1Message.messageId,
          status: l2ToL1Message.status
        });
      }
      
      return {
        syncId,
        messages,
        data,
        timestamp: Date.now()
      };
    } catch (error) {
      logger.error(`Error synchronizing data: ${error.message}`);
      throw error;
    }
  }
}

/**
 * Create a Cross-Layer Aggregator instance
 * @param {Object} client - IOTA client
 * @param {Object} options - Configuration options
 * @returns {Promise<CrossLayerAggregator>} The Cross-Layer Aggregator instance
 */
async function createAggregator(client, options = {}) {
  try {
    logger.info('Creating Cross-Layer Aggregator');
    
    const aggregator = new CrossLayerAggregator(client, options);
    
    // Initialize bridge if address is provided
    if (options.bridgeAddress) {
      await aggregator.setBridgeAddress(options.bridgeAddress);
    }
    
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
