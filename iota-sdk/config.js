/**
 * IOTA SDK Configuration
 * 
 * This file contains configuration settings for the IOTA SDK integration.
 */

const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Network configurations
const NETWORKS = {
  mainnet: {
    nodes: ['https://api.shimmer.network'],
    faucet: null,
    explorer: {
      baseUrl: 'https://explorer.shimmer.network/shimmer',
      addressPath: 'addr/'
    },
    coinType: 4219 // Shimmer
  },
  testnet: {
    nodes: ['https://api.testnet.shimmer.network'],
    faucet: 'https://faucet.testnet.shimmer.network/api/enqueue',
    explorer: {
      baseUrl: 'https://explorer.shimmer.network/testnet',
      addressPath: 'addr/'
    },
    coinType: 4219 // Shimmer
  }
};

// Default network based on environment variable or fallback to testnet
const DEFAULT_NETWORK = process.env.IOTA_NETWORK || 'testnet';

// Storage path for wallet database
const STORAGE_PATH = process.env.IOTA_STORAGE_PATH || './wallet-database';

// Stronghold configuration
const STRONGHOLD_CONFIG = {
  snapshotPath: process.env.STRONGHOLD_SNAPSHOT_PATH || './wallet.stronghold',
  password: process.env.STRONGHOLD_PASSWORD
};

// Configure client options based on selected network
const getClientOptions = (networkName = DEFAULT_NETWORK) => {
  const network = NETWORKS[networkName];
  
  if (!network) {
    throw new Error(`Network '${networkName}' not found in configuration.`);
  }
  
  return {
    nodes: network.nodes,
    localPow: true
  };
};

// Configure wallet options based on selected network
const getWalletOptions = (networkName = DEFAULT_NETWORK) => {
  const network = NETWORKS[networkName];
  
  if (!network) {
    throw new Error(`Network '${networkName}' not found in configuration.`);
  }
  
  return {
    storagePath: STORAGE_PATH,
    clientOptions: {
      nodes: network.nodes,
      localPow: true,
    },
    coinType: network.coinType,
    secretManager: {
      stronghold: {
        snapshotPath: STRONGHOLD_CONFIG.snapshotPath,
        password: STRONGHOLD_CONFIG.password
      }
    }
  };
};

module.exports = {
  DEFAULT_NETWORK,
  NETWORKS,
  STORAGE_PATH,
  STRONGHOLD_CONFIG,
  getClientOptions,
  getWalletOptions
};
