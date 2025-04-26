/**
 * IntelliLend Backend Server
 * 
 * This server provides APIs for the IntelliLend protocol, handling AI risk assessment,
 * cross-chain operations, and interacting with IOTA smart contracts.
 */

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { ethers } = require('ethers');
const morgan = require('morgan');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

// Load environment variables
dotenv.config();

// IOTA SDK Enhanced Integration
const iotaSDK = require('../iota-sdk');
const logger = require('../iota-sdk/utils/logger');

// IOTA Identity and Streams Integration
const iotaIdentity = require('../iota-sdk/identity');
const iotaStreams = require('../iota-sdk/streams');
const iotaCrossLayer = require('../iota-sdk/cross-layer');

// Configure logger for IOTA integration
logger.configure({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  enableConsole: true,
  enableFile: true,
  logDir: 'logs',
  logFilename: 'iota-integration.log',
  format: 'text',
  colorize: true
});

// Import specific components from the enhanced IOTA SDK
const { 
  createClient, 
  generateAddress, 
  getNetworkInfo, 
  submitBlock,
  monitorTransaction, 
  getAddressTransactions,
  subscribeToEvents,
  withExponentialBackoff
} = require('../iota-sdk/client');

const { 
  createWallet, 
  getOrCreateAccount, 
  generateAddress: generateWalletAddress, 
  sendTokens,
  getBalance,
  getTransactionHistory,
  listenToAccountEvents
} = require('../iota-sdk/wallet');

logger.info('Initializing enhanced IOTA SDK integration...');

// Connect to IOTA client with resilience
let iotaClient, iotaNodeManager, iotaWallet, iotaAccount;
let iotaIdentityService, iotaStreamsService, iotaCrossLayerAggregator;
let liquidationService, crossLayerMonitor;
let transactionSubscribers = new Map(); // To store WebSocket subscribers for transaction updates

async function initializeIotaSdk() {
  try {
    // Get network from environment or default to testnet
    const network = process.env.IOTA_NETWORK || 'testnet';
    logger.info(`Connecting to IOTA ${network}...`);
    
    // Initialize IOTA client with enhanced resilience
    const { client, nodeManager } = await createClient(network);
    iotaClient = client;
    iotaNodeManager = nodeManager;
    
    logger.info('IOTA client connected successfully');
    
    // Initialize IOTA Identity service
    logger.info('Initializing IOTA Identity service...');
    try {
        iotaIdentityService = await iotaIdentity.createIdentityService(client, {
            network: network,
            useLocalProofOfWork: true,
            permanode: process.env.IOTA_PERMANODE_URL || undefined
        });
        logger.info('IOTA Identity service initialized successfully');
    } catch (identityError) {
        logger.error(`Failed to initialize IOTA Identity service: ${identityError.message}`);
        logger.info('Continuing with limited identity functionality');
    }
    
    // Initialize IOTA Streams service
    logger.info('Initializing IOTA Streams service...');
    try {
        iotaStreamsService = await iotaStreams.createStreamsService(client, {
            seed: process.env.STREAMS_SEED || undefined,
            permanode: process.env.IOTA_PERMANODE_URL || undefined
        });
        logger.info('IOTA Streams service initialized successfully');
    } catch (streamsError) {
        logger.error(`Failed to initialize IOTA Streams service: ${streamsError.message}`);
        logger.info('Continuing with limited streams functionality');
    }
    
    // Initialize Cross-Layer Aggregator
    logger.info('Initializing Cross-Layer Aggregator...');
    try {
        iotaCrossLayerAggregator = await iotaCrossLayer.createAggregator(client, {
            bridgeAddress: process.env.BRIDGE_ADDRESS,
            l1NetworkType: 'iota',
            l2NetworkType: 'evm',
            privateKey: process.env.AGGREGATOR_PRIVATE_KEY || undefined
        });
        logger.info('Cross-Layer Aggregator initialized successfully');
    } catch (aggregatorError) {
        logger.error(`Failed to initialize Cross-Layer Aggregator: ${aggregatorError.message}`);
        logger.info('Continuing with limited cross-layer functionality');
    }
    
    // Get network information with retry
    const networkInfo = await getNetworkInfo(iotaClient, iotaNodeManager);
    logger.info(`Connected to ${networkInfo.networkName}`);
    logger.info(`Bech32 HRP: ${networkInfo.bech32Hrp}`);
    logger.info(`Using node: ${networkInfo.currentNode}`);
    
    // Initialize wallet if stronghold password is set
    if (process.env.STRONGHOLD_PASSWORD) {
      try {
        // Create wallet with enhanced resilience
        iotaWallet = await createWallet(network);
        
        // Get or create account with enhanced options
        iotaAccount = await getOrCreateAccount(iotaWallet, 'IntelliLend', {
          syncOnlyBasic: false, // Get full account data
          allowReattachment: true // Allow reattachment for stuck transactions
        });
        
        logger.info('IOTA wallet initialized successfully');
        
        // Log account information with enhanced balance details
        const balance = await getBalance(iotaAccount, { syncFirst: true });
        logger.info(`Account balance: ${balance.formatted.available} ${balance.formatted.tokenSymbol} available of ${balance.formatted.total} ${balance.formatted.tokenSymbol} total`);
        
        // Generate a new address if needed
        if (!process.env.IOTA_PLATFORM_ADDRESS) {
          try {
            const newAddress = await generateWalletAddress(iotaAccount, {
              metadata: 'IntelliLend Platform Address'
            });
            logger.info(`Generated new platform address: ${newAddress}`);
            
            // Store address in memory for use in the application
            process.env.IOTA_PLATFORM_ADDRESS = newAddress;
          } catch (addrError) {
            logger.error(`Error generating new address: ${addrError.message}`);
          }
        }
        
        // Set up account event listener for real-time updates
        listenToAccountEvents(iotaAccount, (event) => {
          logger.info(`Account event received: ${event.type}`);
          
          // Notify transaction subscribers if this is a transaction confirmation
          if (event.type === 'transactionConfirmed' && transactionSubscribers.has(event.transactionId)) {
            const subscribers = transactionSubscribers.get(event.transactionId);
            subscribers.forEach(socket => {
              try {
                socket.send(JSON.stringify({
                  type: 'transaction_update',
                  status: 'confirmed',
                  transactionId: event.transactionId,
                  blockId: event.blockId,
                  timestamp: event.timestamp
                }));
              } catch (socketError) {
                logger.error(`Error sending to WebSocket: ${socketError.message}`);
              }
            });
          }
        });
      } catch (walletError) {
        logger.error(`Failed to initialize IOTA wallet: ${walletError.message}`);
        logger.info('Continuing with client-only functionality');
      }
    } else {
      logger.warn('Stronghold password not set, wallet features disabled');
      logger.warn('Set STRONGHOLD_PASSWORD in your .env file to enable full wallet functionality');
    }
    
    // Subscribe to block confirmations
    try {
      await subscribeToEvents(iotaClient, 'blockConfirmed', (event) => {
        logger.debug(`Block confirmed: ${event.blockId}`);
        
        // This could be extended to update UI or notify users of relevant confirmations
      });
      logger.info('Successfully subscribed to block confirmations');
    } catch (subscriptionError) {
      logger.error(`Error subscribing to block confirmations: ${subscriptionError.message}`);
    }
    
    // Initialize Liquidation Service
    logger.info('Initializing Automated Liquidation Service...');
    try {
        const LiquidationService = require('../ai-model/services/liquidation_service');
        liquidationService = new LiquidationService({
            lendingPoolAddress: process.env.LENDING_POOL_ADDRESS,
            liquidationAuctionAddress: process.env.LIQUIDATION_AUCTION_ADDRESS,
            provider: process.env.IOTA_EVM_RPC_URL,
            privateKey: process.env.LIQUIDATOR_PRIVATE_KEY || undefined,
            iotaClient: client,
            iotaStreams: iotaStreamsService,
            checkInterval: 120000 // 2 minutes
        });
        await liquidationService.start();
        logger.info('Automated Liquidation Service initialized successfully');
    } catch (liquidationError) {
        logger.error(`Failed to initialize Liquidation Service: ${liquidationError.message}`);
        logger.info('Continuing with manual liquidation functionality only');
    }
    
    // Initialize Cross-Layer Monitor
    logger.info('Initializing Cross-Layer Monitor...');
    try {
        const CrossLayerMonitor = require('../ai-model/services/cross_layer_monitor');
        crossLayerMonitor = new CrossLayerMonitor({
            bridgeAddress: process.env.BRIDGE_ADDRESS,
            provider: process.env.IOTA_EVM_RPC_URL,
            iotaClient: client,
            iotaStreams: iotaStreamsService,
            iotaCrossLayer: iotaCrossLayerAggregator,
            checkInterval: 60000 // 1 minute
        });
        await crossLayerMonitor.start();
        logger.info('Cross-Layer Monitor initialized successfully');
    } catch (monitorError) {
        logger.error(`Failed to initialize Cross-Layer Monitor: ${monitorError.message}`);
        logger.info('Continuing with limited cross-layer monitoring functionality');
    }
    
    return {
      client: iotaClient,
      nodeManager: iotaNodeManager,
      wallet: iotaWallet,
      account: iotaAccount,
      identityService: iotaIdentityService,
      streamsService: iotaStreamsService,
      crossLayerAggregator: iotaCrossLayerAggregator,
      liquidationService: liquidationService,
      crossLayerMonitor: crossLayerMonitor
    };
  } catch (error) {
    logger.error(`Failed to initialize IOTA SDK: ${error.message}`);
    // Throw a more descriptive error to help with debugging
    throw new Error(`IOTA SDK initialization failed: ${error.message}`);
  }
}

/**
 * Verify IOTA Node Connection
 * @param {Client} client - IOTA client
 * @returns {Promise<boolean>} - Connection status
 */
async function verifyIotaConnection(client) {
  try {
    // Attempt to get node info with timeout
    const info = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Connection verification timed out after 10 seconds'));
      }, 10000);
      
      client.getInfo()
        .then(result => {
          clearTimeout(timeout);
          resolve(result);
        })
        .catch(err => {
          clearTimeout(timeout);
          reject(err);
        });
    });
    
    // Check if node is healthy
    if (!info.nodeInfo.status.isHealthy) {
      logger.warn(`Connected to IOTA node, but node reports unhealthy status: ${JSON.stringify(info.nodeInfo.status)}`);
      return false;
    }
    
    // Log successful connection
    logger.info(`Connected to IOTA node: ${info.nodeInfo.name} (${info.nodeInfo.version})`);
    logger.info(`Network: ${info.nodeInfo.protocol.networkName}`);
    logger.info(`Status: ${info.nodeInfo.status.isHealthy ? 'Healthy' : 'Unhealthy'}`);
    
    return true;
  } catch (error) {
    logger.error(`Failed to verify IOTA connection: ${error.message}`);
    return false;
  }
}

// Initialize IOTA SDK asynchronously with enhanced verification
async function initializeWithVerification() {
  try {
    const iotaInstance = await initializeIotaSdk();
    
    // Verify connection to IOTA network
    if (iotaInstance && iotaInstance.client) {
      const isConnected = await verifyIotaConnection(iotaInstance.client);
      
      if (isConnected) {
        logger.info('✅ IOTA connection verified successfully');
      } else {
        logger.error('❌ IOTA connection could not be verified, functionality may be limited');
      }
    }
    
    return iotaInstance;
  } catch (error) {
    logger.error(`IOTA SDK initialization failed: ${error.message}`);
    throw error;
  }
}

// Initialize IOTA SDK with robust retry and fallback
withExponentialBackoff(async () => {
  const iotaComponents = await initializeWithVerification();
  
  // Set global variables with IOTA components if available
  if (iotaComponents) {
    iotaClient = iotaComponents.client;
    iotaNodeManager = iotaComponents.nodeManager;
    iotaWallet = iotaComponents.wallet;
    iotaAccount = iotaComponents.account;
    iotaIdentityService = iotaComponents.identityService;
    iotaStreamsService = iotaComponents.streamsService;
    iotaCrossLayerAggregator = iotaComponents.crossLayerAggregator;
    liquidationService = iotaComponents.liquidationService;
    crossLayerMonitor = iotaComponents.crossLayerMonitor;
    
    // Initialize IOTA Identity Bridge if not available
    if (!iotaIdentityBridge && iotaClient && iotaIdentityService) {
      logger.info('Initializing IOTA Identity Bridge...');
      try {
        const { createIdentityBridge } = require('../iota-sdk/identity-bridge');
        iotaIdentityBridge = await createIdentityBridge(process.env.IOTA_NETWORK || 'testnet', {
          evmRpcUrl: process.env.IOTA_EVM_RPC_URL,
          walletOptions: {
            accountName: 'IdentityBridge',
            strongholdPassword: process.env.STRONGHOLD_PASSWORD
          }
        });
        logger.info('IOTA Identity Bridge initialized successfully');
      } catch (bridgeError) {
        logger.error(`Failed to initialize IOTA Identity Bridge: ${bridgeError.message}`);
      }
    }
    
    logger.info('IOTA components initialized successfully');
  }
}, {
  maxRetries: 7,
  initialDelayMs: 2000,
  factor: 1.5,
  jitter: true
}).catch(error => {
  logger.error(`IOTA SDK initialization failed after multiple attempts: ${error.message}`);
  logger.warn('Continuing with limited functionality. Some IOTA features may not be available.');
});

// Use real AI integration - no mocks in production
const AIIntegration = require('../ai-model/api/ai_integration');
console.log('Using REAL AI integration');

// Load utilities and middleware
const { authenticate } = require('./middleware/auth');
const { validateRequest } = require('./middleware/validation');
const { cacheMiddleware } = require('./middleware/cache');
const logger = require('./utils/logger');

// Initialize express app
const app = express();
const PORT = process.env.PORT || 3002; // Changed from 3001 to avoid conflicts

// Security and performance middleware
app.use(helmet());
app.use(compression());
app.use(cors());
app.use(morgan('combined'));
app.use(bodyParser.json());

// Apply general rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later'
});
app.use('/api/', apiLimiter);

// Enhanced rate limiting configuration for IOTA-specific endpoints
const iotaLimiterOptions = {
  windowMs: 5 * 60 * 1000,  // 5 minutes
  max: 30,  // 30 requests per window
  message: {
    status: 429,
    error: 'Too many IOTA requests',
    message: 'Too many IOTA API requests. Please try again later.',
    retryAfter: 300 // seconds
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Add response headers for better client handling
  headerName: 'X-IOTA-Rate-Limit',
  // Track IPs properly with appropriate headers for proxies
  keyGenerator: (req) => {
    return req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  },
  // Skip rate limit for health checks
  skip: (req) => req.path === '/health',
  // Add headers to show remaining quota
  handler: (req, res, next, options) => {
    res.status(options.statusCode || 429).json(options.message);
  }
};

// Apply rate limiting with options
const iotaLimiter = rateLimit(iotaLimiterOptions);
app.use('/api/iota/', iotaLimiter);

// Special rate limiter for address generation (high-security operation)
const addressGenerationLimiter = rateLimit({
  ...iotaLimiterOptions,
  windowMs: 60 * 60 * 1000,  // 1 hour
  max: 10,  // 10 requests per hour
  message: {
    status: 429,
    error: 'Address generation rate limit exceeded',
    message: 'You have exceeded the rate limit for generating IOTA addresses. Please try again later.',
    retryAfter: 3600 // seconds
  }
});
app.use('/api/iota/address', addressGenerationLimiter);

// Special rate limiter for transactions
const transactionLimiter = rateLimit({
  ...iotaLimiterOptions,
  windowMs: 10 * 60 * 1000,  // 10 minutes
  max: 15,  // 15 requests per 10 minutes
  message: {
    status: 429,
    error: 'Transaction rate limit exceeded',
    message: 'You have exceeded the rate limit for IOTA transactions. Please try again later.',
    retryAfter: 600 // seconds
  }
});
app.use('/api/iota/send', transactionLimiter);

// Special rate limiter for Tangle data submission
const tangleSubmitLimiter = rateLimit({
  ...iotaLimiterOptions,
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 20,  // 20 requests per 15 minutes
  message: {
    status: 429,
    error: 'Tangle submission rate limit exceeded',
    message: 'You have exceeded the rate limit for submitting data to the IOTA Tangle. Please try again later.',
    retryAfter: 900 // seconds
  }
});
app.use('/api/iota/submit', tangleSubmitLimiter);

// Initialize AI Integration with real IOTA connection
const aiConfig = {
  provider: process.env.IOTA_EVM_RPC_URL || 'https://api.testnet.shimmer.network/evm',
  lendingPoolAddress: process.env.LENDING_POOL_ADDRESS,
  zkVerifierAddress: process.env.ZK_VERIFIER_ADDRESS,
  zkBridgeAddress: process.env.ZK_BRIDGE_ADDRESS,
  modelPath: process.env.AI_MODEL_PATH || '../ai-model/models',
  useLocalModel: process.env.USE_LOCAL_MODEL === 'true',
  apiUrl: process.env.AI_API_URL || 'http://localhost:5000',
  enableCrossLayer: process.env.ENABLE_CROSS_LAYER === 'true',
  iotaClient: null // Will be set after initialization
};

const aiIntegration = new AIIntegration(aiConfig);

// Set IOTA client after initialization
(async () => {
  try {
    // Wait for IOTA SDK to initialize
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    if (iotaClient) {
      aiIntegration.setIotaClient(iotaClient);
      console.log('IOTA client set in AI integration');
    }
    
    if (iotaAccount) {
      aiIntegration.setIotaAccount(iotaAccount);
      console.log('IOTA account set in AI integration');
    }
  } catch (error) {
    console.error('Error setting IOTA client in AI integration:', error);
  }
})();

// If admin private key is provided, set wallet for transactions
if (process.env.PRIVATE_KEY) {
  try {
    aiIntegration.setWallet(process.env.PRIVATE_KEY);
    logger.info('Admin wallet connected for backend operations');
  } catch (error) {
    logger.error('Error connecting admin wallet:', error);
  }
}

// API Routes

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    // Check IOTA connection
    let iotaStatus = 'disconnected';
    if (iotaClient) {
      try {
        const networkInfo = await getNetworkInfo(iotaClient);
        iotaStatus = networkInfo.nodeInfo.status.isHealthy ? 'healthy' : 'unhealthy';
      } catch (error) {
        iotaStatus = 'error';
      }
    }
    
    res.status(200).json({ 
      status: 'ok', 
      timestamp: Date.now(),
      iota: {
        status: iotaStatus,
        network: process.env.IOTA_NETWORK || 'testnet',
        wallet: iotaWallet ? 'connected' : 'disconnected'
      }
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// Enhanced IOTA specific endpoints with better error handling,
// transaction monitoring, and resilience features

/**
 * Generate a new IOTA address
 * @route GET /api/iota/address
 * @security JWT
 * @returns {object} 200 - Address successfully generated
 * @returns {object} 400 - Bad request error
 * @returns {object} 500 - Server error
 * @returns {object} 503 - IOTA wallet not initialized
 */
app.get('/api/iota/address', authenticate, async (req, res) => {
  try {
    if (!iotaAccount) {
      return res.status(503).json({ 
        error: 'IOTA wallet not initialized',
        details: 'Wallet features are currently unavailable. Please check server logs or try again later.'
      });
    }
    
    logger.info('Generating new IOTA address');
    
    // Generate address with metadata
    const metadata = req.query.label || 'Generated via IntelliLend API';
    const address = await generateWalletAddress(iotaAccount, {
      metadata: metadata
    });
    
    logger.info(`Successfully generated address: ${address}`);
    
    // Return address with network information
    const networkInfo = await getNetworkInfo(iotaClient, iotaNodeManager);
    
    res.json({
      success: true,
      address,
      network: networkInfo.networkName,
      bech32Hrp: networkInfo.bech32Hrp,
      explorerUrl: `${config.getExplorerAddressUrl(address, process.env.IOTA_NETWORK || 'testnet')}`,
      metadata: metadata,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error(`Error generating IOTA address: ${error.message}`);
    
    // Provide appropriate error response based on the error type
    if (error.message && error.message.includes('stronghold')) {
      return res.status(500).json({ 
        error: 'Stronghold error',
        message: 'Error accessing secure storage. Please contact support.',
        requestId: req.id
      });
    } else if (error.message && error.message.includes('timeout')) {
      return res.status(504).json({ 
        error: 'Request timeout',
        message: 'The operation timed out. The network may be congested. Please try again later.',
        requestId: req.id
      });
    }
    
    res.status(500).json({ 
      error: 'Error generating address', 
      message: error.message,
      requestId: req.id
    });
  }
});

/**
 * Get IOTA balance for an address
 * @route GET /api/iota/balance/:address
 * @param {string} address.path.required - The IOTA address
 * @returns {object} 200 - Balance successfully retrieved
 * @returns {object} 400 - Bad request error
 * @returns {object} 500 - Server error
 * @returns {object} 503 - IOTA client not initialized
 */
app.get('/api/iota/balance/:address', cacheMiddleware(30), async (req, res) => {
  try {
    const { address } = req.params;
    
    if (!iotaClient) {
      return res.status(503).json({ 
        error: 'IOTA client not initialized',
        details: 'IOTA services are currently unavailable. Please try again later.'
      });
    }
    
    logger.info(`Getting balance for address: ${address}`);
    
    // Validate address format
    const networkInfo = await getNetworkInfo(iotaClient, iotaNodeManager);
    const validPrefix = networkInfo.bech32Hrp || 'smr';
    
    if (!address.startsWith(`${validPrefix}1`)) {
      return res.status(400).json({ 
        error: 'Invalid address format',
        message: `Address must be a valid ${validPrefix.toUpperCase()} address starting with ${validPrefix}1`
      });
    }
    
    // Get balance with resilience
    const balance = await withExponentialBackoff(async () => {
      return await getBalance(iotaClient, address, iotaNodeManager);
    });
    
    // Get transactions for this address (optional, controlled by query param)
    let transactions = [];
    if (req.query.includeTransactions === 'true') {
      transactions = await getAddressTransactions(iotaClient, address, iotaNodeManager);
    }
    
    // Format balance for better readability and include more information
    const formattedBalance = {
      address,
      network: networkInfo.networkName,
      baseCoins: balance.baseCoins,
      baseCoinsFormatted: `${BigInt(balance.baseCoins) / BigInt(1000000)} ${validPrefix.toUpperCase()}`,
      nativeTokens: balance.nativeTokens || [],
      explorerUrl: `${config.getExplorerAddressUrl(address, process.env.IOTA_NETWORK || 'testnet')}`,
      lastUpdated: new Date().toISOString(),
      transactions: transactions.length > 0 ? transactions : undefined
    };
    
    res.json(formattedBalance);
  } catch (error) {
    logger.error(`Error getting IOTA balance for ${req.params.address}: ${error.message}`);
    
    // Provide appropriate error response based on the error type
    if (error.message && error.message.includes('not found')) {
      return res.status(404).json({ 
        error: 'Address not found',
        message: 'The address was not found on the network or has no transactions',
        address: req.params.address
      });
    } else if (error.message && error.message.includes('timeout')) {
      return res.status(504).json({ 
        error: 'Request timeout',
        message: 'The operation timed out. The network may be congested. Please try again later.',
        address: req.params.address
      });
    }
    
    res.status(500).json({ 
      error: 'Error getting balance', 
      message: error.message,
      address: req.params.address
    });
  }
});

/**
 * Send IOTA tokens
 * @route POST /api/iota/send
 * @security JWT
 * @param {object} request.body.required - Transaction details
 * @param {string} request.body.address - Recipient address
 * @param {string} request.body.amount - Amount to send
 * @param {string} request.body.tag - Optional tag
 * @param {string} request.body.message - Optional message
 * @returns {object} 200 - Transaction successfully sent
 * @returns {object} 400 - Bad request error
 * @returns {object} 500 - Server error
 * @returns {object} 503 - IOTA wallet not initialized
 */
app.post('/api/iota/send', authenticate, validateRequest(['address', 'amount']), async (req, res) => {
  try {
    const { address, amount, tag, message } = req.body;
    
    if (!iotaAccount) {
      return res.status(503).json({ 
        error: 'IOTA wallet not initialized',
        details: 'Wallet features are currently unavailable. Please check server logs or try again later.'
      });
    }
    
    logger.info(`Sending ${amount} to ${address}`);
    
    // Add WebSocket for real-time transaction updates if client wants to listen
    let transactionId;
    if (req.headers['accept'] && req.headers['accept'].includes('text/event-stream')) {
      // Set headers for SSE
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      
      // Send initial message
      res.write(`data: ${JSON.stringify({ status: 'processing', message: 'Transaction is being processed' })}\n\n`);
      
      // Send tokens with transaction monitoring
      sendTokens(iotaAccount, amount, address, {
        tag: tag || 'IntelliLend',
        metadata: message || 'Sent via IntelliLend Platform',
        monitor: true,
        statusCallback: (status) => {
          // Send status update to client
          res.write(`data: ${JSON.stringify(status)}\n\n`);
          
          // If final status, end the response
          if (status.status === 'confirmed' || status.status === 'error') {
            res.end();
          }
          
          // Store transaction ID for monitoring
          if (status.transactionId && !transactionId) {
            transactionId = status.transactionId;
          }
        }
      }).catch(error => {
        // Send error to client and end the response
        res.write(`data: ${JSON.stringify({ 
          status: 'error', 
          message: error.message 
        })}\n\n`);
        res.end();
      });
    } else {
      // Regular JSON response for non-streaming clients
      // Send tokens
      const result = await sendTokens(iotaAccount, amount, address, {
        tag: tag || 'IntelliLend',
        metadata: message || 'Sent via IntelliLend Platform',
        monitor: true
      });
      
      // Store transaction ID
      transactionId = result.transactionId;
      
      // If socket server is available, generate a transaction monitoring ID
      const monitoringId = crypto.randomBytes(16).toString('hex');
      
      res.json({
        success: true,
        transactionId: result.transactionId,
        blockId: result.blockId,
        amount: result.formattedAmount,
        recipient: address,
        timestamp: new Date(result.timestamp).toISOString(),
        status: 'pending',
        monitoringEndpoint: `/api/iota/transaction/${result.transactionId}/status`,
        monitoringId: monitoringId
      });
    }
  } catch (error) {
    logger.error(`Error sending IOTA tokens to ${req.body.address}: ${error.message}`);
    
    // Provide appropriate error response based on the error type
    if (error.message && error.message.includes('insufficient funds')) {
      return res.status(400).json({ 
        error: 'Insufficient funds',
        message: 'There are not enough funds to complete this transaction',
        details: error.message
      });
    } else if (error.message && error.message.includes('timeout')) {
      return res.status(504).json({ 
        error: 'Transaction timeout',
        message: 'The transaction timed out. The network may be congested. Please check explorer to see if it was confirmed.',
        details: error.message
      });
    }
    
    res.status(500).json({ 
      error: 'Error sending tokens', 
      message: error.message 
    });
  }
});

/**
 * Check transaction status
 * @route GET /api/iota/transaction/:transactionId/status
 * @param {string} transactionId.path.required - Transaction ID
 * @returns {object} 200 - Transaction status
 * @returns {object} 404 - Transaction not found
 * @returns {object} 500 - Server error
 */
app.get('/api/iota/transaction/:transactionId/status', async (req, res) => {
  try {
    const { transactionId } = req.params;
    
    if (!iotaClient) {
      return res.status(503).json({ 
        error: 'IOTA client not initialized',
        details: 'IOTA services are currently unavailable. Please try again later.'
      });
    }
    
    logger.info(`Checking transaction status for: ${transactionId}`);
    
    // Check transaction status
    try {
      const metadata = await iotaClient.blockMetadata(transactionId);
      
      // Determine status based on metadata
      let status = 'pending';
      if (metadata.milestone_timestamp_booked) {
        status = 'confirmed';
      } else if (metadata.is_conflicting) {
        status = 'conflicting';
      }
      
      res.json({
        transactionId,
        status,
        metadata,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      // If not found, check if it's a transaction ID instead of block ID
      if (error.message && error.message.includes('not found')) {
        // Try looking up in account history
        if (iotaAccount) {
          try {
            const transactions = await getTransactionHistory(iotaAccount, {
              limit: 50
            });
            
            const transaction = transactions.find(tx => tx.id === transactionId);
            
            if (transaction) {
              return res.json({
                transactionId,
                status: transaction.confirmed ? 'confirmed' : 'pending',
                blockId: transaction.blockId,
                timestamp: transaction.timestamp
              });
            }
          } catch (historyError) {
            logger.error(`Error checking transaction history: ${historyError.message}`);
          }
        }
        
        return res.status(404).json({ 
          error: 'Transaction not found',
          message: 'The specified transaction ID was not found on the network',
          transactionId
        });
      }
      
      throw error;
    }
  } catch (error) {
    logger.error(`Error checking transaction status for ${req.params.transactionId}: ${error.message}`);
    res.status(500).json({ 
      error: 'Error checking transaction status', 
      message: error.message,
      transactionId: req.params.transactionId
    });
  }
});

/**
 * Submit data to IOTA Tangle
 * @route POST /api/iota/submit
 * @param {object} request.body.required - Data to submit
 * @param {object} request.body.data - Data object to store on the Tangle
 * @param {string} request.body.tag - Optional tag
 * @returns {object} 200 - Data successfully submitted
 * @returns {object} 400 - Bad request error
 * @returns {object} 500 - Server error
 * @returns {object} 503 - IOTA client not initialized
 */
app.post('/api/iota/submit', validateRequest(['data']), async (req, res) => {
  try {
    const { data, tag } = req.body;
    
    if (!iotaClient) {
      return res.status(503).json({ 
        error: 'IOTA client not initialized',
        details: 'IOTA services are currently unavailable. Please try again later.'
      });
    }
    
    logger.info(`Submitting data to IOTA Tangle with tag: ${tag || 'IntelliLend'}`);
    
    // Create block with data payload
    const blockData = {
      payload: {
        type: 1, // Tagged data
        tag: Buffer.from(tag || 'IntelliLend').toString('hex'),
        data: Buffer.from(JSON.stringify(data)).toString('hex')
      }
    };
    
    // Submit block with enhanced error handling and monitoring
    const result = await submitBlock(iotaClient, blockData, iotaNodeManager);
    
    // Monitor block for confirmation if requested
    let monitoringUrl;
    if (req.query.monitor === 'true') {
      monitoringUrl = `/api/iota/transaction/${result.blockId}/status`;
      
      // Start monitoring in the background
      monitorTransaction(iotaClient, result.blockId, (status) => {
        logger.info(`Block ${result.blockId} status update: ${status.status}`);
      }, {
        maxDuration: 300000 // 5 minutes
      }).catch(error => {
        logger.error(`Error monitoring block: ${error.message}`);
      });
    }
    
    res.json({
      success: true,
      blockId: result.blockId,
      timestamp: new Date().toISOString(),
      monitoringUrl,
      inclusionStatus: result.inclusion?.state || 'pending'
    });
  } catch (error) {
    logger.error(`Error submitting data to IOTA Tangle: ${error.message}`);
    
    // Provide appropriate error response based on the error type
    if (error.message && error.message.includes('rejected')) {
      return res.status(400).json({ 
        error: 'Block rejected',
        message: 'The block was rejected by the network. Verify block structure.',
        details: error.message
      });
    } else if (error.message && error.message.includes('timeout')) {
      return res.status(504).json({ 
        error: 'Submission timeout',
        message: 'The submission timed out. The network may be congested. The block may still be processed.',
        details: error.message
      });
    }
    
    res.status(500).json({ 
      error: 'Error submitting data', 
      message: error.message 
    });
  }
});

/**
 * Get IOTA network information
 * @route GET /api/iota/network
 * @returns {object} 200 - Network information
 * @returns {object} 500 - Server error
 * @returns {object} 503 - IOTA client not initialized
 */
app.get('/api/iota/network', cacheMiddleware(60), async (req, res) => {
  try {
    if (!iotaClient) {
      return res.status(503).json({ 
        error: 'IOTA client not initialized',
        details: 'IOTA services are currently unavailable. Please try again later.'
      });
    }
    
    logger.info('Getting IOTA network information');
    
    // Get network information with enhanced details
    const networkInfo = await getNetworkInfo(iotaClient, iotaNodeManager);
    
    // Get healthy nodes from node manager
    const healthyNodes = iotaNodeManager.getHealthyNodes();
    
    res.json({
      network: networkInfo.networkName,
      protocol: {
        version: networkInfo.protocol?.version,
        networkName: networkInfo.protocol?.networkName,
        bech32Hrp: networkInfo.bech32Hrp
      },
      nodeInfo: {
        url: networkInfo.currentNode,
        version: networkInfo.nodeInfo?.version,
        healthy: networkInfo.isHealthy,
        uptimePercentage: ((Date.now() - networkInfo.nodeInfo?.status?.startTimestamp || 0) / 60000).toFixed(2)
      },
      connectionStatus: {
        healthyNodes: healthyNodes.length,
        connectedNode: networkInfo.currentNode,
        lastUpdated: networkInfo.currentTime
      }
    });
  } catch (error) {
    logger.error(`Error getting IOTA network information: ${error.message}`);
    res.status(500).json({ 
      error: 'Error getting network information', 
      message: error.message 
    });
  }
});

/**
 * Get account transaction history
 * @route GET /api/iota/transactions
 * @security JWT
 * @returns {object} 200 - Transaction history
 * @returns {object} 500 - Server error
 * @returns {object} 503 - IOTA wallet not initialized
 */
app.get('/api/iota/transactions', authenticate, cacheMiddleware(30), async (req, res) => {
  try {
    if (!iotaAccount) {
      return res.status(503).json({ 
        error: 'IOTA wallet not initialized',
        details: 'Wallet features are currently unavailable. Please check server logs or try again later.'
      });
    }
    
    logger.info('Getting account transaction history');
    
    // Parse query parameters
    const limit = parseInt(req.query.limit) || 50;
    const type = parseInt(req.query.type) || 0; // 0: all, 1: received, 2: sent
    
    // Get transaction history with improved formatting
    const transactions = await getTransactionHistory(iotaAccount, {
      syncFirst: true,
      limit,
      type,
      from: req.query.from,
      to: req.query.to,
      minValue: req.query.minValue,
      tag: req.query.tag
    });
    
    res.json({
      transactions,
      count: transactions.length,
      lastUpdated: new Date().toISOString()
    });
  } catch (error) {
    logger.error(`Error getting transaction history: ${error.message}`);
    res.status(500).json({ 
      error: 'Error getting transaction history', 
      message: error.message 
    });
  }
});

// Original endpoints from server.js

// User profile endpoint
app.get('/api/user/:address', cacheMiddleware(60), async (req, res) => {
  try {
    const { address } = req.params;
    
    // Validate Ethereum address
    if (!ethers.utils.isAddress(address)) {
      return res.status(400).json({ error: 'Invalid Ethereum address' });
    }
    
    // Fetch user data
    const userData = await aiIntegration.fetchUserData(address);
    
    // Calculate health factor
    const liquidationThreshold = 0.83; // 83%
    const collateralValue = parseFloat(userData.collaterals);
    const borrowValue = parseFloat(userData.borrows);
    
    const healthFactor = borrowValue > 0 
      ? (collateralValue * liquidationThreshold) / borrowValue 
      : 999;
    
    // Calculate interest rate
    const baseRate = 3;
    const riskPremium = Math.floor(userData.riskScore / 10);
    const interestRate = baseRate + riskPremium;
    
    // Return user stats
    res.json({
      address,
      deposits: parseFloat(userData.deposits),
      borrows: parseFloat(userData.borrows),
      collateral: parseFloat(userData.collaterals),
      riskScore: userData.riskScore,
      interestRate,
      healthFactor,
      identityVerified: userData.identityVerified || false,
      lastUpdated: userData.timestamp || Date.now()
    });
  } catch (error) {
    logger.error(`Error fetching user ${req.params.address}:`, error);
    res.status(500).json({ error: 'Error fetching user data', message: error.message });
  }
});

/**
 * Verify user identity with IOTA Identity
 * @route POST /api/iota/identity/verify
 * @param {object} request.body.required - Verification details
 * @param {string} request.body.did - User's DID
 * @param {object} request.body.credential - Verifiable credential
 * @param {string} request.body.ethereumAddress - User's Ethereum address
 * @returns {object} 200 - Verification successful
 * @returns {object} 400 - Bad request error
 * @returns {object} 500 - Server error
 */
app.post('/api/iota/identity/verify', validateRequest(['did', 'credential', 'ethereumAddress']), async (req, res) => {
    try {
        const { did, credential, ethereumAddress } = req.body;
        
        if (!iotaIdentityService) {
            return res.status(503).json({ 
                error: 'IOTA Identity service not initialized',
                details: 'Identity services are currently unavailable. Please try again later.'
            });
        }
        
        logger.info(`Verifying identity for DID: ${did} and Ethereum address: ${ethereumAddress}`);
        
        // Verify DID and credential
        const verificationResult = await iotaIdentityService.verifyCredential(
            did, 
            credential
        );
        
        if (!verificationResult.isValid) {
            return res.status(400).json({
                error: 'Identity verification failed',
                reason: verificationResult.reason || 'Invalid credential'
            });
        }
        
        // Associate DID with Ethereum address
        await iotaIdentityService.associateAddress(did, ethereumAddress);
        
        // Get credential details
        const credentialDetails = await iotaIdentityService.getCredentialDetails(credential);
        
        // If we have a lending pool contract and AI integration, update risk score
        if (aiIntegration && aiIntegration.lendingPool) {
            try {
                // Improve risk score based on verified identity
                const currentScore = await aiIntegration.lendingPool.riskScores(ethereumAddress);
                const newScore = currentScore > 15 ? currentScore - 15 : 0;
                
                await aiIntegration.lendingPool.updateRiskScore(ethereumAddress, newScore);
                logger.info(`Updated risk score for ${ethereumAddress} to ${newScore} based on identity verification`);
            } catch (scoreError) {
                logger.error(`Error updating risk score: ${scoreError.message}`);
            }
        }
        
        // Send verification event to IOTA Streams if available
        if (iotaStreamsService) {
            try {
                await iotaStreamsService.sendMessage({
                    type: 'IDENTITY_VERIFIED',
                    did: did,
                    ethereumAddress: ethereumAddress,
                    timestamp: Date.now()
                });
            } catch (streamError) {
                logger.error(`Error sending to Streams: ${streamError.message}`);
            }
        }
        
        res.json({
            success: true,
            did: did,
            ethereumAddress: ethereumAddress,
            timestamp: Date.now(),
            expiration: credentialDetails.expirationDate,
            trustLevel: credentialDetails.trustLevel || 'verified'
        });
    } catch (error) {
        logger.error(`Error verifying identity: ${error.message}`);
        res.status(500).json({ 
            error: 'Error verifying identity', 
            message: error.message 
        });
    }
});

/**
 * Create a new DID for a user
 * @route POST /api/iota/identity/create
 * @param {object} request.body.required - Creation details
 * @param {string} request.body.ethereumAddress - User's Ethereum address
 * @returns {object} 200 - DID created successfully
 * @returns {object} 500 - Server error
 */
app.post('/api/iota/identity/create', validateRequest(['ethereumAddress']), async (req, res) => {
    try {
        const { ethereumAddress } = req.body;
        
        if (!iotaIdentityService) {
            return res.status(503).json({ 
                error: 'IOTA Identity service not initialized',
                details: 'Identity services are currently unavailable. Please try again later.'
            });
        }
        
        logger.info(`Creating new DID for Ethereum address: ${ethereumAddress}`);
        
        // Create new DID
        const result = await iotaIdentityService.createIdentity({
            controller: ethereumAddress,
            metadata: {
                ethereumAddress: ethereumAddress,
                platform: 'IntelliLend',
                createdAt: new Date().toISOString()
            }
        });
        
        // Associate DID with Ethereum address
        await iotaIdentityService.associateAddress(result.did, ethereumAddress);
        
        // Send creation event to IOTA Streams if available
        if (iotaStreamsService) {
            try {
                await iotaStreamsService.sendMessage({
                    type: 'IDENTITY_CREATED',
                    did: result.did,
                    ethereumAddress: ethereumAddress,
                    timestamp: Date.now()
                });
            } catch (streamError) {
                logger.error(`Error sending to Streams: ${streamError.message}`);
            }
        }
        
        res.json({
            success: true,
            did: result.did,
            document: result.document,
            address: result.address,
            explorerLink: `${result.explorerUrl}/${result.address}`,
            ethereumAddress: ethereumAddress
        });
    } catch (error) {
        logger.error(`Error creating identity: ${error.message}`);
        res.status(500).json({ 
            error: 'Error creating identity', 
            message: error.message 
        });
    }
});

// Market data endpoint
app.get('/api/market', cacheMiddleware(300), async (req, res) => {
  try {
    // Try to fetch real data from the contracts if they're deployed
    let totalDeposits, totalBorrows, totalCollateral;
    
    if (aiIntegration.lendingPool && typeof aiIntegration.lendingPool.totalDeposits === 'function') {
      try {
        // Fetch real data from contract
        [totalDeposits, totalBorrows, totalCollateral] = await Promise.all([
          aiIntegration.lendingPool.totalDeposits().then(val => ethers.utils.formatEther(val)),
          aiIntegration.lendingPool.totalBorrows().then(val => ethers.utils.formatEther(val)),
          aiIntegration.lendingPool.totalCollateral().then(val => ethers.utils.formatEther(val))
        ]);
      } catch (contractError) {
        logger.warn('Error fetching data from contract, using fallback values:', contractError);
        // Fallback to simulated data
        totalDeposits = 500000;
        totalBorrows = 350000;
        totalCollateral = 750000;
      }
    } else {
      // Fallback to simulated data
      totalDeposits = 500000;
      totalBorrows = 350000;
      totalCollateral = 750000;
    }
    
    const utilizationRate = Math.round((totalBorrows / totalDeposits) * 100);
    
    res.json({
      totalDeposits,
      totalBorrows,
      totalCollateral,
      utilizationRate,
      lastUpdated: Date.now()
    });
  } catch (error) {
    logger.error('Error fetching market data:', error);
    res.status(500).json({ error: 'Error fetching market data', message: error.message });
  }
});

// Historical data endpoint
app.get('/api/history/:address', cacheMiddleware(600), async (req, res) => {
  try {
    const { address } = req.params;
    
    // Validate Ethereum address
    if (!ethers.utils.isAddress(address)) {
      return res.status(400).json({ error: 'Invalid Ethereum address' });
    }
    
    // Generate chart data
    // In a production environment, this would fetch historical data from a database
    
    // Generate 30 days of history
    const days = 30;
    const labels = [];
    const deposits = [];
    const borrows = [];
    const riskScores = [];
    
    for (let i = days; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      labels.push(date.toLocaleDateString());
      
      // Generate simulated data with realistic trends
      const baseDeposit = 100 + Math.random() * 50;
      const baseBorrow = 50 + Math.random() * 30;
      const baseRisk = 30 + Math.random() * 20;
      
      // Add some trend (increasing deposits, fluctuating borrows)
      const deposit = baseDeposit + (days - i) * 2;
      const borrow = baseBorrow + Math.sin(i / 5) * 15;
      const risk = baseRisk - Math.cos(i / 7) * 10;
      
      deposits.push(deposit);
      borrows.push(borrow);
      riskScores.push(risk);
    }
    
    // Format for Chart.js
    res.json({
      labels,
      datasets: [
        {
          label: 'Deposits',
          data: deposits,
          borderColor: '#4caf50',
          backgroundColor: 'rgba(76, 175, 80, 0.1)',
          fill: true
        },
        {
          label: 'Borrows',
          data: borrows,
          borderColor: '#2196f3',
          backgroundColor: 'rgba(33, 150, 243, 0.1)',
          fill: true
        },
        {
          label: 'Risk Score',
          data: riskScores,
          borderColor: '#f44336',
          backgroundColor: 'rgba(244, 67, 54, 0.1)',
          fill: true,
          yAxisID: 'y2'
        }
      ]
    });
  } catch (error) {
    logger.error(`Error fetching history for ${req.params.address}:`, error);
    res.status(500).json({ error: 'Error fetching historical data', message: error.message });
  }
});

// Risk assessment endpoint
app.post('/api/risk-assessment', validateRequest(['address']), async (req, res) => {
  try {
    const { address, onChainData } = req.body;
    
    // Validate Ethereum address
    if (!ethers.utils.isAddress(address)) {
      return res.status(400).json({ error: 'Invalid Ethereum address' });
    }
    
    // Use provided on-chain data or fetch it
    const userData = onChainData || await aiIntegration.fetchUserData(address, false);
    
    // Generate risk assessment
    const riskAssessment = await aiIntegration.assessRisk(address, {
      updateOnChain: false, // Don't update on-chain from API request
      useCachedData: true,
      generateZkProof: false
    });
    
    // Return risk assessment with recommendations
    res.json({
      address,
      riskScore: riskAssessment.riskScore,
      confidence: riskAssessment.confidence || 0.85,
      recommendations: riskAssessment.recommendations || [],
      topFactors: riskAssessment.factors || [],
      analysisTimestamp: Date.now()
    });
  } catch (error) {
    logger.error(`Error assessing risk for ${req.body.address}:`, error);
    res.status(500).json({ error: 'Error processing risk assessment', message: error.message });
  }
});

// Get AI recommendations
app.get('/api/recommendations/:address', cacheMiddleware(1800), async (req, res) => {
  try {
    const { address } = req.params;
    
    // Validate Ethereum address
    if (!ethers.utils.isAddress(address)) {
      return res.status(400).json({ error: 'Invalid Ethereum address' });
    }
    
    // Get recommendations from AI
    const recommendations = await aiIntegration.getRecommendations(address);
    
    res.json(recommendations);
  } catch (error) {
    logger.error(`Error getting recommendations for ${req.params.address}:`, error);
    res.status(500).json({ error: 'Error fetching recommendations', message: error.message });
  }
});

/**
 * Create a new IOTA Streams channel
 * @route POST /api/iota/streams/channel
 * @security JWT
 * @param {object} request.body - Channel details
 * @param {string} request.body.name - Channel name
 * @param {string} request.body.description - Channel description
 * @returns {object} 200 - Channel created successfully
 * @returns {object} 500 - Server error
 */
app.post('/api/iota/streams/channel', authenticate, async (req, res) => {
    try {
        const { name, description } = req.body;
        
        if (!iotaStreamsService) {
            return res.status(503).json({ 
                error: 'IOTA Streams service not initialized',
                details: 'Streams services are currently unavailable. Please try again later.'
            });
        }
        
        logger.info(`Creating new Streams channel: ${name}`);
        
        // Create new channel
        const channel = await iotaStreamsService.createChannel({
            name: name || 'IntelliLend Channel',
            description: description || 'IntelliLend secure messaging channel',
            metadata: {
                creator: req.user.address,
                createdAt: new Date().toISOString()
            }
        });
        
        res.json({
            success: true,
            channelId: channel.id,
            channelAddress: channel.address,
            announcementLink: channel.announcementLink,
            seed: channel.seed, // Only share with the owner
            presharedKey: channel.presharedKey // Only share with the owner
        });
    } catch (error) {
        logger.error(`Error creating Streams channel: ${error.message}`);
        res.status(500).json({ 
            error: 'Error creating Streams channel', 
            message: error.message 
        });
    }
});

/**
 * Send a message to an IOTA Streams channel
 * @route POST /api/iota/streams/message
 * @security JWT
 * @param {object} request.body.required - Message details
 * @param {string} request.body.channelId - Channel ID
 * @param {string} request.body.messageType - Message type
 * @param {object} request.body.content - Message content
 * @returns {object} 200 - Message sent successfully
 * @returns {object} 500 - Server error
 */
app.post('/api/iota/streams/message', authenticate, validateRequest(['channelId', 'messageType', 'content']), async (req, res) => {
    try {
        const { channelId, messageType, content } = req.body;
        
        if (!iotaStreamsService) {
            return res.status(503).json({ 
                error: 'IOTA Streams service not initialized',
                details: 'Streams services are currently unavailable. Please try again later.'
            });
        }
        
        logger.info(`Sending message to channel ${channelId} of type ${messageType}`);
        
        // Send message
        const result = await iotaStreamsService.sendMessage({
            channelId: channelId,
            messageType: messageType,
            content: content,
            sender: req.user.address,
            timestamp: Date.now()
        });
        
        res.json({
            success: true,
            messageId: result.messageId,
            channelId: channelId,
            messageType: messageType,
            timestamp: result.timestamp
        });
    } catch (error) {
        logger.error(`Error sending Streams message: ${error.message}`);
        res.status(500).json({ 
            error: 'Error sending Streams message', 
            message: error.message 
        });
    }
});

/**
 * Get messages from an IOTA Streams channel
 * @route GET /api/iota/streams/messages/:channelId
 * @security JWT
 * @param {string} channelId.path.required - Channel ID
 * @returns {object} 200 - Messages retrieved successfully
 * @returns {object} 500 - Server error
 */
app.get('/api/iota/streams/messages/:channelId', authenticate, async (req, res) => {
    try {
        const { channelId } = req.params;
        
        if (!iotaStreamsService) {
            return res.status(503).json({ 
                error: 'IOTA Streams service not initialized',
                details: 'Streams services are currently unavailable. Please try again later.'
            });
        }
        
        logger.info(`Fetching messages from channel ${channelId}`);
        
        // Get messages
        const messages = await iotaStreamsService.getMessages({
            channelId: channelId,
            limit: parseInt(req.query.limit) || 50,
            fromTimestamp: req.query.fromTimestamp ? parseInt(req.query.fromTimestamp) : undefined
        });
        
        res.json({
            channelId: channelId,
            messages: messages,
            count: messages.length,
            lastFetched: Date.now()
        });
    } catch (error) {
        logger.error(`Error fetching Streams messages: ${error.message}`);
        res.status(500).json({ 
            error: 'Error fetching Streams messages', 
            message: error.message,
            channelId: req.params.channelId
        });
    }
});

// Bridge messages endpoint - now using real IOTA bridge when available
app.get('/api/bridge/messages/:address', async (req, res) => {
  try {
    const { address } = req.params;
    
    // Validate Ethereum address
    if (!ethers.utils.isAddress(address)) {
      return res.status(400).json({ error: 'Invalid Ethereum address' });
    }
    
    // Try to fetch real bridge messages from the contract
    let messages = [];
    
    if (aiIntegration.zkBridge && typeof aiIntegration.zkBridge.getMessageIds === 'function') {
      try {
        // Get message IDs for this address
        const messageIds = await aiIntegration.zkBridge.getMessageIds(address);
        
        // Fetch detailed information for each message
        const messagePromises = messageIds.map(async (id) => {
          const details = await aiIntegration.zkBridge.getMessageDetails(id);
          return {
            messageId: id,
            messageType: details.messageType,
            status: ['Pending', 'Processed', 'Failed', 'Canceled'][details.status], // Convert enum to string
            timestamp: details.timestamp.toNumber() * 1000, // Convert to JS timestamp
            sender: details.sender,
            targetAddress: details.targetAddress,
            direction: details.direction === 0 ? 'L2ToL1' : 'L1ToL2'
          };
        });
        
        messages = await Promise.all(messagePromises);
        
        // Sort by timestamp, newest first
        messages.sort((a, b) => b.timestamp - a.timestamp);
      } catch (bridgeError) {
        logger.warn('Error fetching from bridge, using fallback data:', bridgeError);
        // Fall back to simulated data
        messages = generateSimulatedBridgeMessages(address);
      }
    } else {
      // Fall back to simulated data
      messages = generateSimulatedBridgeMessages(address);
    }
    
    res.json({ messages, count: messages.length });
  } catch (error) {
    logger.error(`Error fetching bridge messages for ${req.params.address}:`, error);
    res.status(500).json({ error: 'Error fetching bridge messages', message: error.message });
  }
});

// Helper function to generate simulated bridge messages
function generateSimulatedBridgeMessages(address) {
  const messageTypes = ['RISK_SCORE_UPDATE', 'COLLATERAL_CHANGE', 'CROSS_CHAIN_TRANSFER', 'IDENTITY_VERIFICATION'];
  const statuses = ['Pending', 'Processed', 'Failed'];
  
  const messages = [];
  const count = 3 + Math.floor(Math.random() * 5);
  
  for (let i = 0; i < count; i++) {
    const messageType = messageTypes[Math.floor(Math.random() * messageTypes.length)];
    const status = statuses[Math.floor(Math.random() * statuses.length)];
    const timestamp = Date.now() - Math.floor(Math.random() * 7 * 86400 * 1000); // Up to 7 days ago
    
    messages.push({
      messageId: `0x${Math.random().toString(16).slice(2, 10)}`,
      messageType,
      status,
      timestamp,
      sender: address,
      targetAddress: `0x${Math.random().toString(16).slice(2, 42)}`,
      direction: Math.random() > 0.5 ? 'L2ToL1' : 'L1ToL2'
    });
  }
  
  // Sort by timestamp, newest first
  messages.sort((a, b) => b.timestamp - a.timestamp);
  
  return messages;
}

/**
 * Send a cross-layer message from L2 to L1
 * @route POST /api/cross-layer/send
 * @security JWT
 * @param {object} request.body.required - Message details
 * @param {string} request.body.targetAddress - Target address in Move (L1)
 * @param {string} request.body.messageType - Message type
 * @param {object} request.body.payload - Message payload
 * @returns {object} 200 - Message sent successfully
 * @returns {object} 500 - Server error
 */
app.post('/api/cross-layer/send', authenticate, validateRequest(['targetAddress', 'messageType', 'payload']), async (req, res) => {
    try {
        const { targetAddress, messageType, payload } = req.body;
        
        if (!iotaCrossLayerAggregator) {
            return res.status(503).json({ 
                error: 'Cross-Layer Aggregator not initialized',
                details: 'Cross-layer services are currently unavailable. Please try again later.'
            });
        }
        
        logger.info(`Sending cross-layer message to ${targetAddress} of type ${messageType}`);
        
        // Send message with both bridge and streams for redundancy
        const result = await iotaCrossLayerAggregator.sendMessageToL1({
            targetAddress: targetAddress,
            messageType: messageType,
            payload: payload,
            sender: req.user.address,
            useBridge: true,
            useStreams: true
        });
        
        res.json({
            success: true,
            messageId: result.messageId,
            targetAddress: targetAddress,
            messageType: messageType,
            bridgeStatus: result.bridgeStatus,
            streamsStatus: result.streamsStatus,
            timestamp: Date.now(),
            monitoringLink: `/api/cross-layer/status/${result.messageId}`
        });
    } catch (error) {
        logger.error(`Error sending cross-layer message: ${error.message}`);
        res.status(500).json({ 
            error: 'Error sending cross-layer message', 
            message: error.message 
        });
    }
});

/**
 * Check the status of a cross-layer message
 * @route GET /api/cross-layer/status/:messageId
 * @param {string} messageId.path.required - Message ID
 * @returns {object} 200 - Message status
 * @returns {object} 404 - Message not found
 * @returns {object} 500 - Server error
 */
app.get('/api/cross-layer/status/:messageId', async (req, res) => {
    try {
        const { messageId } = req.params;
        
        if (!iotaCrossLayerAggregator) {
            return res.status(503).json({ 
                error: 'Cross-Layer Aggregator not initialized',
                details: 'Cross-layer services are currently unavailable. Please try again later.'
            });
        }
        
        logger.info(`Checking cross-layer message status for ${messageId}`);
        
        // Get message status
        const status = await iotaCrossLayerAggregator.getMessageStatus(messageId);
        
        if (!status) {
            return res.status(404).json({
                error: 'Message not found',
                messageId: messageId
            });
        }
        
        res.json({
            messageId: messageId,
            status: status.status,
            bridgeStatus: status.bridgeStatus,
            streamsStatus: status.streamsStatus,
            confirmations: status.confirmations,
            timestamp: status.timestamp,
            updatedAt: Date.now()
        });
    } catch (error) {
        logger.error(`Error checking cross-layer message status: ${error.message}`);
        res.status(500).json({ 
            error: 'Error checking message status', 
            message: error.message,
            messageId: req.params.messageId
        });
    }
});

/**
 * Get cross-layer messages for a user
 * @route GET /api/cross-layer/messages/:address
 * @param {string} address.path.required - User address
 * @returns {object} 200 - Messages retrieved successfully
 * @returns {object} 500 - Server error
 */
app.get('/api/cross-layer/messages/:address', async (req, res) => {
    try {
        const { address } = req.params;
        
        if (!iotaCrossLayerAggregator) {
            return res.status(503).json({ 
                error: 'Cross-Layer Aggregator not initialized',
                details: 'Cross-layer services are currently unavailable. Please try again later.'
            });
        }
        
        logger.info(`Fetching cross-layer messages for ${address}`);
        
        // Get messages
        const messages = await iotaCrossLayerAggregator.getUserMessages(address);
        
        res.json({
            address: address,
            messages: messages,
            count: messages.length,
            lastFetched: Date.now()
        });
    } catch (error) {
        logger.error(`Error fetching cross-layer messages: ${error.message}`);
        res.status(500).json({ 
            error: 'Error fetching cross-layer messages', 
            message: error.message,
            address: req.params.address
        });
    }
});

// Add model validation endpoint
app.get('/api/model/performance', authenticate, async (req, res) => {
  try {
    // Get model performance metrics
    const performanceMetrics = await aiIntegration.getModelPerformanceMetrics();
    
    // Calculate key metrics
    const accuracy = performanceMetrics.correctPredictions / performanceMetrics.totalPredictions;
    const precision = performanceMetrics.truePositives / (performanceMetrics.truePositives + performanceMetrics.falsePositives);
    const recall = performanceMetrics.truePositives / (performanceMetrics.truePositives + performanceMetrics.falseNegatives);
    const f1Score = 2 * (precision * recall) / (precision + recall);
    
    res.json({
      accuracy,
      precision,
      recall,
      f1Score,
      confusionMatrix: performanceMetrics.confusionMatrix,
      riskBucketAccuracy: performanceMetrics.riskBucketAccuracy,
      lastUpdate: performanceMetrics.lastUpdate
    });
  } catch (error) {
    console.error('Error fetching model performance:', error);
    res.status(500).json({ error: 'Error fetching model performance' });
  }
});

// Add model validation with time period
app.get('/api/model/performance/:period', authenticate, async (req, res) => {
  try {
    const { period } = req.params;
    let timeRange;
    
    // Set time range based on period
    switch(period) {
      case 'week':
        timeRange = 7 * 24 * 60 * 60 * 1000; // 7 days in ms
        break;
      case 'month':
        timeRange = 30 * 24 * 60 * 60 * 1000; // 30 days in ms
        break;
      case 'quarter':
        timeRange = 90 * 24 * 60 * 60 * 1000; // 90 days in ms
        break;
      default:
        timeRange = null; // All time
    }
    
    // Get model performance metrics
    const performanceMetrics = await aiIntegration.getModelPerformanceMetrics(timeRange);
    
    // Calculate key metrics
    const accuracy = performanceMetrics.correctPredictions / performanceMetrics.totalPredictions;
    const precision = performanceMetrics.truePositives / (performanceMetrics.truePositives + performanceMetrics.falsePositives);
    const recall = performanceMetrics.truePositives / (performanceMetrics.truePositives + performanceMetrics.falseNegatives);
    const f1Score = 2 * (precision * recall) / (precision + recall);
    
    res.json({
      period,
      accuracy,
      precision,
      recall,
      f1Score,
      confusionMatrix: performanceMetrics.confusionMatrix,
      riskBucketAccuracy: performanceMetrics.riskBucketAccuracy,
      defaultRate: performanceMetrics.defaultRate,
      riskBins: performanceMetrics.riskBins,
      totalSamples: performanceMetrics.totalPredictions,
      lastUpdate: performanceMetrics.lastUpdate
    });
  } catch (error) {
    console.error(`Error fetching model performance for period ${req.params.period}:`, error);
    res.status(500).json({ error: 'Error fetching model performance' });
  }
});

// Add feature importance endpoint
app.get('/api/model/feature-importance', authenticate, async (req, res) => {
  try {
    // Get feature importance from AI model
    const featureImportance = await aiIntegration.getFeatureImportance();
    
    // Sort features by importance
    const sortedFeatures = featureImportance.sort((a, b) => b.importance - a.importance);
    
    res.json({
      features: sortedFeatures,
      lastUpdate: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching feature importance:', error);
    res.status(500).json({ error: 'Error fetching feature importance' });
  }
});

// Add model validation for specific address
app.get('/api/model/validation/:address', authenticate, async (req, res) => {
  try {
    const { address } = req.params;
    
    // Validate Ethereum address
    if (!ethers.utils.isAddress(address)) {
      return res.status(400).json({ error: 'Invalid Ethereum address' });
    }
    
    // Get validation data for this specific address
    const validationData = await aiIntegration.validateAddressPredictions(address);
    
    res.json({
      address,
      predictions: validationData.predictions,
      actuals: validationData.actuals,
      accuracy: validationData.accuracy,
      discrepancy: validationData.discrepancy,
      lastUpdate: validationData.lastUpdate
    });
  } catch (error) {
    console.error(`Error validating predictions for ${req.params.address}:`, error);
    res.status(500).json({ error: 'Error validating predictions' });
  }
});

// Admin routes (protected)
app.post('/api/admin/update-risk-score', authenticate, validateRequest(['address', 'score']), async (req, res) => {
  try {
    const { address, score } = req.body;
    
    // Validate Ethereum address and score
    if (!ethers.utils.isAddress(address)) {
      return res.status(400).json({ error: 'Invalid Ethereum address' });
    }
    
    if (isNaN(score) || score < 0 || score > 100) {
      return res.status(400).json({ error: 'Score must be between 0 and 100' });
    }
    
    // Update risk score on-chain
    const receipt = await aiIntegration.updateRiskScore(address, score);
    
    // Also submit this data to IOTA Tangle for permanent record
    if (iotaClient) {
      try {
        // Create block with data payload
        const blockData = {
          payload: {
            type: 1, // Tagged data
            tag: Buffer.from('RISK_SCORE_UPDATE').toString('hex'),
            data: Buffer.from(JSON.stringify({
              address,
              score,
              timestamp: Date.now(),
              txHash: receipt.transactionHash
            })).toString('hex')
          }
        };
        
        // Submit block
        await submitBlock(iotaClient, blockData);
      } catch (tanglerError) {
        logger.warn('Error submitting risk score to Tangle:', tanglerError);
      }
    }
    
    res.json({
      success: true,
      address,
      newScore: score,
      transactionHash: receipt.transactionHash
    });
  } catch (error) {
    logger.error(`Error updating risk score for ${req.body.address}:`, error);
    res.status(500).json({ error: 'Error updating risk score', message: error.message });
  }
});

// Cross-Layer Swap Routes
const swapRoutes = require('./crosschain/swap/swapRoutes');
app.use('/api/bridge', swapRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error', message: err.message });
});

// Start server
app.listen(PORT, () => {
  logger.info(`IntelliLend API server running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`IOTA network: ${process.env.IOTA_NETWORK || 'testnet'}`);
});

module.exports = app; // Export for testing