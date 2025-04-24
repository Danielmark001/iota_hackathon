/**
 * Configuration
 * 
 * Central configuration for the IntelliLend platform
 */

require('dotenv').config();

const config = {
  // Environment
  env: process.env.NODE_ENV || 'development',
  
  // API version
  version: '0.1.0',
  
  // Server configuration
  server: {
    port: process.env.PORT || 3001,
    host: process.env.HOST || 'localhost'
  },
  
  // CORS configuration
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
    exposedHeaders: ['X-Total-Count'],
    credentials: true,
    maxAge: 86400 // 24 hours
  },
  
  // JWT configuration
  jwt: {
    secret: process.env.JWT_SECRET || 'IntelliLendSecretKey-ChangeInProduction!',
    expiresIn: process.env.JWT_EXPIRES_IN || '24h'
  },
  
  // Risk assessment API configuration
  riskAssessmentApi: {
    baseUrl: process.env.RISK_API_URL || 'http://localhost:5000',
    timeout: parseInt(process.env.RISK_API_TIMEOUT) || 10000,
    cacheEnabled: process.env.RISK_API_CACHE_ENABLED !== 'false',
    cacheTtl: parseInt(process.env.RISK_API_CACHE_TTL) || 3600
  },
  
  // IOTA blockchain configuration
  blockchain: {
    // EVM layer (Layer 2)
    evm: {
      rpcUrl: process.env.EVM_RPC_URL || 'https://evm-test.iota.org:443',
      chainId: parseInt(process.env.EVM_CHAIN_ID) || 1,
      blockExplorerUrl: process.env.EVM_BLOCK_EXPLORER_URL || 'https://explorer.iota.org',
      wsUrl: process.env.EVM_WS_URL || 'wss://evm-test.iota.org:443',
      gasLimit: parseInt(process.env.EVM_GAS_LIMIT) || 3000000,
      gasPrice: process.env.EVM_GAS_PRICE || '5000000000' // 5 gwei
    },
    
    // IOTA Layer 1
    iota: {
      nodeUrl: process.env.IOTA_NODE_URL || 'https://chrysalis-nodes.iota.org:443',
      networkId: process.env.IOTA_NETWORK_ID || 'mainnet',
      bech32HRP: process.env.IOTA_BECH32_HRP || 'iota',
      explorerUrl: process.env.IOTA_EXPLORER_URL || 'https://explorer.iota.org'
    },
    
    // Bridge configuration
    bridge: {
      address: process.env.BRIDGE_ADDRESS || '0x0000000000000000000000000000000000000000',
      confirmationBlocks: parseInt(process.env.BRIDGE_CONFIRMATION_BLOCKS) || 1,
      maxRetries: parseInt(process.env.BRIDGE_MAX_RETRIES) || 3,
      retryInterval: parseInt(process.env.BRIDGE_RETRY_INTERVAL) || 5000
    }
  },
  
  // Smart contract addresses
  contracts: {
    lendingPool: process.env.LENDING_POOL_ADDRESS || '0x0000000000000000000000000000000000000000',
    addressesProvider: process.env.ADDRESSES_PROVIDER_ADDRESS || '0x0000000000000000000000000000000000000000',
    dataProvider: process.env.DATA_PROVIDER_ADDRESS || '0x0000000000000000000000000000000000000000',
    priceOracle: process.env.PRICE_ORACLE_ADDRESS || '0x0000000000000000000000000000000000000000',
    aaveToken: process.env.AAVE_TOKEN_ADDRESS || '0x0000000000000000000000000000000000000000',
    riskAssessmentOracle: process.env.RISK_ASSESSMENT_ORACLE_ADDRESS || '0x0000000000000000000000000000000000000000'
  },
  
  // Database configuration (MongoDB)
  database: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/intellilend',
    options: {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000
    }
  },
  
  // Cache configuration (Redis)
  cache: {
    enabled: process.env.CACHE_ENABLED !== 'false',
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD || '',
    ttl: parseInt(process.env.REDIS_TTL) || 3600
  },
  
  // Logging configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    file: process.env.LOG_FILE || 'logs/intellilend.log',
    maxSize: parseInt(process.env.LOG_MAX_SIZE) || 5242880, // 5MB
    maxFiles: parseInt(process.env.LOG_MAX_FILES) || 5
  },
  
  // Assets configuration
  assets: {
    supported: [
      {
        symbol: 'IOTA',
        name: 'IOTA',
        address: '0x0000000000000000000000000000000000000000',
        decimals: 18,
        isNative: true,
        iconUrl: '/assets/iota.svg'
      },
      {
        symbol: 'USDC',
        name: 'USD Coin',
        address: '0x0000000000000000000000000000000000000001',
        decimals: 6,
        isNative: false,
        iconUrl: '/assets/usdc.svg'
      },
      {
        symbol: 'WBTC',
        name: 'Wrapped Bitcoin',
        address: '0x0000000000000000000000000000000000000002',
        decimals: 8,
        isNative: false,
        iconUrl: '/assets/wbtc.svg'
      },
      {
        symbol: 'WETH',
        name: 'Wrapped Ethereum',
        address: '0x0000000000000000000000000000000000000003',
        decimals: 18,
        isNative: false,
        iconUrl: '/assets/weth.svg'
      }
    ]
  },
  
  // Analytics configuration
  analytics: {
    enabled: process.env.ANALYTICS_ENABLED !== 'false',
    provider: process.env.ANALYTICS_PROVIDER || 'internal',
    trackingId: process.env.ANALYTICS_TRACKING_ID || ''
  }
};

module.exports = config;
