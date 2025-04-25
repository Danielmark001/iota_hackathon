/**
 * IOTA SDK Configuration
 * 
 * This file contains configuration settings for the IOTA SDK integration.
 * Updated to use the latest IOTA network endpoints and enhanced resilience features.
 */

const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

// Load environment variables
dotenv.config();

// Network configurations with multiple node URLs for redundancy
const NETWORKS = {
  mainnet: {
    // Latest Shimmer mainnet endpoints
    nodes: [
      'https://api.shimmer.network',
      'https://mainnet.shimmer.iota-1.workers.dev', 
      'https://shimmer-mainnet.api.nodesail.io',
      'https://shimmer.api.iotaichi.network'
    ],
    faucet: null,
    explorer: {
      baseUrl: 'https://explorer.shimmer.network/shimmer',
      addressPath: 'addr/'
    },
    coinType: 4219, // Shimmer
    protocol: {
      networkName: 'shimmer',
      bech32Hrp: 'smr',
      minPowScore: 1000
    }
  },
  testnet: {
    // Latest testnet endpoints from docs.iota.org
    nodes: [
      'https://api.testnet.iota.cafe',
      'https://testnet.shimmer.network',
      'https://testnet.shimmer.iota-1.workers.dev', 
      'https://shimmer-testnet.api.nodesail.io'
    ],
    faucet: 'https://faucet.testnet.iota.cafe',
    explorer: {
      baseUrl: 'https://explorer.rebased.iota.org/?network=testnet',
      addressPath: 'addr/'
    },
    jsonRpcUrl: 'https://api.testnet.iota.cafe',
    indexerRpcUrl: 'https://indexer.testnet.iota.cafe',
    graphqlRpcUrl: 'https://graphql.testnet.iota.cafe',
    rpcWebsocketUrl: 'wss://api.testnet.iota.cafe',
    coinType: 4219, // Shimmer
    protocol: {
      networkName: 'shimmer-testnet',
      bech32Hrp: 'rms',
      minPowScore: 1000
    }
  },
  devnet: {
    // Latest devnet endpoints
    nodes: [
      'https://api.devnet.iota.cafe',
      'https://api.testnet.shimmer.network'
    ],
    faucet: 'https://faucet.devnet.iota.cafe',
    explorer: {
      baseUrl: 'https://explorer.rebased.iota.org/?network=devnet',
      addressPath: 'addr/'
    },
    jsonRpcUrl: 'https://api.devnet.iota.cafe',
    indexerRpcUrl: 'https://indexer.devnet.iota.cafe', 
    graphqlRpcUrl: 'https://graphql.devnet.iota.cafe',
    rpcWebsocketUrl: 'wss://api.devnet.iota.cafe',
    coinType: 4219, // Shimmer
    protocol: {
      networkName: 'shimmer-devnet',
      bech32Hrp: 'rms',
      minPowScore: 1000
    }
  },
  local: {
    // For local development network
    nodes: [
      'http://127.0.0.1:9000'
    ],
    faucet: 'http://127.0.0.1:9123/gas',
    explorer: {
      baseUrl: 'http://127.0.0.1:8082',
      addressPath: 'addr/'
    },
    jsonRpcUrl: 'http://127.0.0.1:9000',
    indexerRpcUrl: 'http://127.0.0.1:9124',
    graphqlRpcUrl: 'http://127.0.0.1:8000',
    rpcWebsocketUrl: 'ws://127.0.0.1:9000',
    coinType: 4219, // Shimmer
    protocol: {
      networkName: 'shimmer-local',
      bech32Hrp: 'rms',
      minPowScore: 1000
    }
  }
};

// Connection resilience configuration
const CONNECTION_RESILIENCE = {
  // Retry configuration
  maxRetries: 5,
  initialDelayMs: 1000, // Initial delay before first retry
  maxDelayMs: 30000, // Maximum delay between retries
  timeoutMs: 60000, // Overall timeout for operations
  
  // Node health check configuration
  healthCheckIntervalMs: 60000, // Check node health every minute
  nodeUnhealthyThreshold: 3, // Number of consecutive failures before marking node unhealthy
  nodeRecoveryTimeMs: 300000, // Time before rechecking an unhealthy node (5 minutes)
  
  // Quorum configuration 
  quorumMinNodes: 2, // Minimum nodes needed for quorum
  quorumPercentage: 67, // Percentage of nodes that must agree (67%)
};

// Default network based on environment variable or fallback to testnet
const DEFAULT_NETWORK = process.env.IOTA_NETWORK || 'testnet';

// Storage path for wallet database
const STORAGE_PATH = process.env.IOTA_STORAGE_PATH || './wallet-database';

// Create storage path if it doesn't exist
if (!fs.existsSync(STORAGE_PATH)) {
  try {
    fs.mkdirSync(STORAGE_PATH, { recursive: true });
    console.log(`Created storage directory at ${STORAGE_PATH}`);
  } catch (error) {
    console.error(`Failed to create storage directory: ${error.message}`);
  }
}

// Stronghold security configuration 
const STRONGHOLD_CONFIG = {
  snapshotPath: process.env.STRONGHOLD_SNAPSHOT_PATH || './wallet.stronghold',
  password: process.env.STRONGHOLD_PASSWORD,
  // Enhanced security settings
  timeoutSecs: 600, // Auto-lock after 10 minutes of inactivity
  snapshotIntervalSecs: 60, // Snapshot every minute when data changes
  // Validate password requirements
  validatePassword: (password) => {
    if (!password) return false;
    // Min 12 chars, must include uppercase, lowercase, number, and special char
    const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{12,}$/;
    return strongPasswordRegex.test(password);
  },
  // New function for password strength evaluation
  evaluatePasswordStrength: (password) => {
    if (!password) return { strength: 'none', score: 0 };
    
    let score = 0;
    // Length check (0-5 points)
    score += Math.min(5, Math.floor(password.length / 3));
    
    // Character variety checks
    if (/[A-Z]/.test(password)) score += 1; // Uppercase
    if (/[a-z]/.test(password)) score += 1; // Lowercase
    if (/[0-9]/.test(password)) score += 1; // Numbers
    if (/[^A-Za-z0-9]/.test(password)) score += 2; // Special chars
    
    // Pattern checks (subtract points)
    if (/(.)\1\1/.test(password)) score -= 1; // Repeated characters
    if (/^[A-Za-z]+$/.test(password)) score -= 1; // Only letters
    if (/^[0-9]+$/.test(password)) score -= 1; // Only numbers
    
    // Determine strength category
    let strength = 'weak';
    if (score >= 7) strength = 'strong';
    else if (score >= 5) strength = 'medium';
    
    return { strength, score };
  }
};

// Validate stronghold configuration
if (!STRONGHOLD_CONFIG.password) {
  console.warn('WARNING: Stronghold password not set. You will need to provide it programmatically.');
} else if (!STRONGHOLD_CONFIG.validatePassword(STRONGHOLD_CONFIG.password)) {
  console.warn('WARNING: Stronghold password does not meet security requirements. Consider updating it.');
}

// Configure client options based on selected network with enhanced resilience
const getClientOptions = (networkName = DEFAULT_NETWORK) => {
  const network = NETWORKS[networkName];
  
  if (!network) {
    throw new Error(`Network '${networkName}' not found in configuration.`);
  }
  
  return {
    // Node configuration with enhanced security and resilience
    nodes: network.nodes,
    localPow: true,
    nodeSyncEnabled: true,
    nodePoolUrls: network.nodes,
    fallbackToLocalPow: true,
    
    // Quorum settings for increased security and reliability
    quorumSize: Math.min(network.nodes.length, CONNECTION_RESILIENCE.quorumMinNodes),
    quorumThreshold: CONNECTION_RESILIENCE.quorumPercentage,
    
    // PoW configuration
    minPowScore: network.protocol?.minPowScore || 1000,
    powWorkerCount: 0, // Use all available cores
    
    // Timeout and retry settings
    requestTimeout: CONNECTION_RESILIENCE.timeoutMs,
    maxConnectRetries: CONNECTION_RESILIENCE.maxRetries,
    connectRetryIntervalSecs: CONNECTION_RESILIENCE.initialDelayMs / 1000,
    
    // Network info
    networkInfo: {
      network: network.protocol?.networkName || networkName,
      bech32Hrp: network.protocol?.bech32Hrp || 'smr'
    },
    
    // Additional options
    disableNodeSync: false,
    nodeSyncInterval: 60, // Check node sync every 60 seconds
    tipSelectionAlgorithm: 'default',
    
    // API timeout settings
    apiTimeout: {
      seconds: 30,
      nanos: 0
    }
  };
};

// Configure wallet options based on selected network with enhanced security
const getWalletOptions = (networkName = DEFAULT_NETWORK) => {
  const network = NETWORKS[networkName];
  
  if (!network) {
    throw new Error(`Network '${networkName}' not found in configuration.`);
  }
  
  // Check if stronghold file exists, if not provide different warning
  const strongholdPath = path.resolve(STRONGHOLD_CONFIG.snapshotPath);
  const strongholdExists = fs.existsSync(strongholdPath);
  
  if (!strongholdExists) {
    console.log(`Stronghold file does not exist at ${strongholdPath}. A new one will be created.`);
  }
  
  return {
    storagePath: STORAGE_PATH,
    clientOptions: {
      nodes: network.nodes,
      localPow: true,
      nodeSyncEnabled: true,
      nodePoolUrls: network.nodes,
      fallbackToLocalPow: true,
      quorumSize: Math.min(network.nodes.length, CONNECTION_RESILIENCE.quorumMinNodes),
      quorumThreshold: CONNECTION_RESILIENCE.quorumPercentage,
      minPowScore: network.protocol?.minPowScore || 1000,
      powWorkerCount: 0,
      requestTimeout: CONNECTION_RESILIENCE.timeoutMs,
      maxConnectRetries: CONNECTION_RESILIENCE.maxRetries,
      connectRetryIntervalSecs: CONNECTION_RESILIENCE.initialDelayMs / 1000
    },
    coinType: network.coinType,
    secretManager: {
      stronghold: {
        snapshotPath: STRONGHOLD_CONFIG.snapshotPath,
        password: STRONGHOLD_CONFIG.password,
        timeout: STRONGHOLD_CONFIG.timeoutSecs
      }
    },
    // Enhanced wallet options
    walletOptions: {
      storagePath: STORAGE_PATH,
      coinType: network.coinType,
      bech32Hrp: network.protocol?.bech32Hrp || 'smr',
      startupMigrations: true,
      allowCreateMultipleEmptyAccounts: false,
      checkBalance: true // Ensure balance check during operations
    }
  };
};

// Get faucet URL for a specific network
const getFaucetUrl = (networkName = DEFAULT_NETWORK) => {
  const network = NETWORKS[networkName];
  
  if (!network) {
    throw new Error(`Network '${networkName}' not found in configuration.`);
  }
  
  return network.faucet;
};

// Get explorer URL for address on a specific network
const getExplorerAddressUrl = (address, networkName = DEFAULT_NETWORK) => {
  const network = NETWORKS[networkName];
  
  if (!network) {
    throw new Error(`Network '${networkName}' not found in configuration.`);
  }
  
  return `${network.explorer.baseUrl}/${network.explorer.addressPath}${address}`;
};

// Get JSON-RPC URL for a specific network
const getJsonRpcUrl = (networkName = DEFAULT_NETWORK) => {
  const network = NETWORKS[networkName];
  
  if (!network) {
    throw new Error(`Network '${networkName}' not found in configuration.`);
  }
  
  return network.jsonRpcUrl || network.nodes[0];
};

// Get Indexer URL for a specific network
const getIndexerUrl = (networkName = DEFAULT_NETWORK) => {
  const network = NETWORKS[networkName];
  
  if (!network) {
    throw new Error(`Network '${networkName}' not found in configuration.`);
  }
  
  return network.indexerRpcUrl || `${network.nodes[0]}/api/indexer/v1`;
};

// Get Websocket URL for a specific network
const getWebsocketUrl = (networkName = DEFAULT_NETWORK) => {
  const network = NETWORKS[networkName];
  
  if (!network) {
    throw new Error(`Network '${networkName}' not found in configuration.`);
  }
  
  return network.rpcWebsocketUrl || network.nodes[0].replace('http', 'ws');
};

module.exports = {
  DEFAULT_NETWORK,
  NETWORKS,
  STORAGE_PATH,
  STRONGHOLD_CONFIG,
  CONNECTION_RESILIENCE,
  getClientOptions,
  getWalletOptions,
  getFaucetUrl,
  getExplorerAddressUrl,
  getJsonRpcUrl,
  getIndexerUrl,
  getWebsocketUrl
};
