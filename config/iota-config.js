/**
 * IOTA Configuration
 * Contains settings for connecting to IOTA networks and services
 */

// Helper functions
function getExplorerAddressUrl(address, network = 'testnet') {
  const networkConfig = module.exports.networks[network] || module.exports.networks.testnet;
  return `${networkConfig.explorerUrl}/addr/${address}`;
}

function getExplorerTransactionUrl(txId, network = 'testnet') {
  const networkConfig = module.exports.networks[network] || module.exports.networks.testnet;
  return `${networkConfig.explorerUrl}/block/${txId}`;
}

function getClientOptions(network = 'testnet') {
  const networkConfig = module.exports.networks[network] || module.exports.networks.testnet;
  
  // Get node URLs from environment or config
  const nodeUrls = process.env.IOTA_NODES ? 
    process.env.IOTA_NODES.split(',') : 
    networkConfig.nodes;
  
  return {
    nodes: nodeUrls,
    localPow: true,
    protocol: {
      type: networkConfig.protocol.type,
      bech32Hrp: networkConfig.protocol.bech32Hrp
    }
  };
}

function getWalletOptions(network = 'testnet') {
  const networkConfig = module.exports.networks[network] || module.exports.networks.testnet;
  
  return {
    storagePath: process.env.IOTA_STORAGE_PATH || './wallet-database',
    clientOptions: getClientOptions(network),
    coinType: networkConfig.coinType || 4219, // Shimmer
    secretManager: {
      stronghold: {
        snapshotPath: process.env.STRONGHOLD_SNAPSHOT_PATH || './wallet.stronghold',
        password: process.env.STRONGHOLD_PASSWORD
      }
    }
  };
}

// Default network
const DEFAULT_NETWORK = process.env.IOTA_NETWORK || 'testnet';

// Network configurations
const NETWORKS = {
  shimmer: {
    name: 'Shimmer Mainnet',
    id: 2,
    rpcUrl: 'https://api.shimmer.network',
    evmRpcUrl: 'https://json-rpc.evm.shimmer.network',
    explorerUrl: 'https://explorer.shimmer.network',
    tokenSymbol: 'SMR',
    bridgeAddress: '0x7D3046872F56AE3B5d2ED9CC0D7cbe7a7c7f1928',
    enabled: true,
    nodes: [
      'https://api.shimmer.network',
      'https://mainnet.shimmer.iota-1.workers.dev',
      'https://shimmer-mainnet.api.nodesail.io'
    ],
    protocol: {
      type: 'shimmer',
      bech32Hrp: 'smr',
      networkName: 'shimmer'
    },
    coinType: 4219
  },
  testnet: {
    name: 'Shimmer Testnet',
    id: 3,
    rpcUrl: 'https://api.testnet.shimmer.network',
    evmRpcUrl: 'https://json-rpc.testnet.evm.shimmer.network',
    explorerUrl: 'https://explorer.testnet.shimmer.network',
    tokenSymbol: 'SMR',
    bridgeAddress: '0x8D3046872F56AE3B5d2ED9CC0D7cbe7a7c7f3049',
    enabled: true,
    nodes: [
      'https://api.testnet.shimmer.network',
      'https://testnet.shimmer.iota-1.workers.dev',
      'https://shimmer-testnet.api.nodesail.io'
    ],
    protocol: {
      type: 'shimmer',
      bech32Hrp: 'rms',
      networkName: 'shimmer-testnet'
    },
    coinType: 4219
  },
  // Legacy networks
  iota: {
    name: 'IOTA Mainnet',
    id: 1,
    rpcUrl: 'https://chrysalis-nodes.iota.org',
    evmRpcUrl: 'https://evm.wasp.sc.iota.org',
    explorerUrl: 'https://explorer.iota.org',
    tokenSymbol: 'MIOTA',
    bridgeAddress: '0x6C3046872F56AE3B5d2ED9CC0D7cbe7a7c7f0637',
    enabled: true,
    nodes: [
      'https://chrysalis-nodes.iota.org',
      'https://mainnet.tanglebay.com'
    ],
    protocol: {
      type: 'chrysalis',
      bech32Hrp: 'iota',
      networkName: 'iota-mainnet'
    },
    coinType: 4218
  }
};

// Connection resilience configuration
const CONNECTION_RESILIENCE = {
  maxRetries: 5,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  healthCheckIntervalMs: 60000, // 1 minute
  nodeRecoveryTimeMs: 300000, // 5 minutes
  nodeUnhealthyThreshold: 3, // 3 consecutive failures
  timeoutMs: 15000, // 15 seconds
  quorumMinNodes: 2, // Minimum nodes for quorum
};

// Stronghold security configuration
const STRONGHOLD_CONFIG = {
  passwordMinLength: 12,
  passwordRequirements: {
    uppercase: true,
    lowercase: true,
    numbers: true,
    specialChars: true
  },
  validatePassword: (password) => {
    if (!password || password.length < STRONGHOLD_CONFIG.passwordMinLength) return false;
    
    const hasUppercase = /[A-Z]/.test(password);
    const hasLowercase = /[a-z]/.test(password);
    const hasNumbers = /[0-9]/.test(password);
    const hasSpecialChars = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
    
    return (!STRONGHOLD_CONFIG.passwordRequirements.uppercase || hasUppercase) &&
           (!STRONGHOLD_CONFIG.passwordRequirements.lowercase || hasLowercase) &&
           (!STRONGHOLD_CONFIG.passwordRequirements.numbers || hasNumbers) &&
           (!STRONGHOLD_CONFIG.passwordRequirements.specialChars || hasSpecialChars);
  },
  evaluatePasswordStrength: (password) => {
    if (!password) return { score: 0, strength: 'none' };
    
    let score = 0;
    
    // Length check
    if (password.length >= 12) score += 2;
    else if (password.length >= 8) score += 1;
    
    // Character type checks
    if (/[A-Z]/.test(password)) score += 1;
    if (/[a-z]/.test(password)) score += 1;
    if (/[0-9]/.test(password)) score += 1;
    if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) score += 1;
    
    // Complexity check
    const uniqueChars = new Set(password).size;
    if (uniqueChars > password.length * 0.7) score += 1;
    
    // Determine strength
    let strength = 'weak';
    if (score >= 6) strength = 'strong';
    else if (score >= 4) strength = 'medium';
    
    return { score, strength };
  }
};

// IOTA Smart Contract Protocol Settings
const ISC = {
  apiUrl: 'https://api.wasp.sc.iota.org',
  chainId: 'tst1pzeqy9lrykhhf5m9secunpssth4ugpzp9buthaymd5f55g0mg75s9encqx'
};

// IOTA Identity Framework Settings
const IDENTITY = {
  didMethod: 'iota',
  didNetworkUrl: 'https://identity.iota.org/api/v1',
  verifiableCredentialsUrl: 'https://identity.iota.org/api/v1/credentials'
};

// Default Gas Settings for IOTA EVM
const GAS = {
  limit: 3000000,
  price: '1000000000' // 1 gwei
};

// Cross-Chain Settings
const CROSS_CHAIN = {
  iotaToShimmer: {
    bridgeAddress: '0x1293746582910AE31c4D4e8461DC56F1d057712a',
    confirmations: 2
  },
  shimmerToIota: {
    bridgeAddress: '0x4726354827193AE67c4F7e1062562915Ab155628',
    confirmations: 5
  }
};

// Contract Addresses
const CONTRACTS = {
  lendingPool: {
    address: process.env.LENDING_POOL_ADDRESS || '0x8293847193AE67c4F7e1062562915Ab155628a12',
    abi: require('../abis/LendingPool.json')
  },
  aiRiskAssessment: {
    address: process.env.ZK_VERIFIER_ADDRESS || '0x2938471938AE67c4F7e1062562915Ab155628a34',
    abi: require('../abis/AIRiskAssessment.json')
  },
  crossChainLiquidity: {
    address: '0x3847193847c4F7e1062562915Ab155628a341293',
    abi: require('../abis/CrossChainLiquidity.json')
  },
  privacyPreservingIdentity: {
    address: '0x4827193847c4F1062562915Ab155628a3412938e',
    abi: require('../abis/PrivacyPreservingIdentity.json')
  },
  crossLayerBridge: {
    address: process.env.BRIDGE_ADDRESS || '0x5827193847c4F7e1062562915Ab155628a341294',
    abi: require('../abis/CrossLayerBridge.json')
  },
  zkBridge: {
    address: process.env.ZK_BRIDGE_ADDRESS || '0x6827193847c4F7e1062562915Ab155628a341295',
    abi: require('../abis/ZKBridge.json')
  }
};

module.exports = {
  DEFAULT_NETWORK,
  NETWORKS,
  CONNECTION_RESILIENCE,
  STRONGHOLD_CONFIG,
  ISC,
  IDENTITY,
  GAS,
  CROSS_CHAIN,
  CONTRACTS,
  getExplorerAddressUrl,
  getExplorerTransactionUrl,
  getClientOptions,
  getWalletOptions,
  networks: NETWORKS,
  gas: GAS,
  contracts: CONTRACTS
};
