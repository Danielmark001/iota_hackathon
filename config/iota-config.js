/**
 * IOTA Configuration
 * Contains settings for connecting to IOTA networks and services
 */

module.exports = {
  // IOTA Network Configurations
  networks: {
    iota: {
      name: 'IOTA Mainnet',
      id: 1,
      rpcUrl: 'https://chrysalis-nodes.iota.org',
      evmRpcUrl: 'https://evm.wasp.sc.iota.org',
      explorerUrl: 'https://explorer.iota.org',
      tokenSymbol: 'MIOTA',
      bridgeAddress: '0x6C3046872F56AE3B5d2ED9CC0D7cbe7a7c7f0637',
      enabled: true
    },
    shimmer: {
      name: 'Shimmer',
      id: 2,
      rpcUrl: 'https://api.shimmer.network',
      evmRpcUrl: 'https://json-rpc.evm.shimmer.network',
      explorerUrl: 'https://explorer.shimmer.network',
      tokenSymbol: 'SMR',
      bridgeAddress: '0x7D3046872F56AE3B5d2ED9CC0D7cbe7a7c7f1928',
      enabled: true
    },
    testnet: {
      name: 'IOTA Testnet',
      id: 3,
      rpcUrl: 'https://api.testnet.shimmer.network',
      evmRpcUrl: 'https://json-rpc.testnet.evm.shimmer.network',
      explorerUrl: 'https://explorer.testnet.shimmer.network',
      tokenSymbol: 'SMR',
      bridgeAddress: '0x8D3046872F56AE3B5d2ED9CC0D7cbe7a7c7f3049',
      enabled: true
    }
  },

  // IOTA Smart Contract Protocol Settings
  isc: {
    apiUrl: 'https://api.wasp.sc.iota.org',
    chainId: 'tst1pzeqy9lrykhhf5m9secunpssth4ugpzp9buthaymd5f55g0mg75s9encqx'
  },

  // IOTA Identity Framework Settings
  identity: {
    didMethod: 'iota',
    didNetworkUrl: 'https://identity.iota.org/api/v1',
    verifiableCredentialsUrl: 'https://identity.iota.org/api/v1/credentials'
  },

  // Default Gas Settings for IOTA EVM
  gas: {
    limit: 3000000,
    price: '1000000000' // 1 gwei
  },

  // Cross-Chain Settings
  crossChain: {
    iotaToShimmer: {
      bridgeAddress: '0x1293746582910AE31c4D4e8461DC56F1d057712a',
      confirmations: 2
    },
    shimmerToIota: {
      bridgeAddress: '0x4726354827193AE67c4F7e1062562915Ab155628',
      confirmations: 5
    }
  },

  // Contract Addresses
  contracts: {
    lendingPool: {
      address: '0x8293847193AE67c4F7e1062562915Ab155628a12',
      abi: './abis/LendingPool.json'
    },
    aiRiskAssessment: {
      address: '0x2938471938AE67c4F7e1062562915Ab155628a34',
      abi: './abis/AIRiskAssessment.json'
    },
    crossChainLiquidity: {
      address: '0x3847193847c4F7e1062562915Ab155628a341293',
      abi: './abis/CrossChainLiquidity.json'
    },
    privacyPreservingIdentity: {
      address: '0x4827193847c4F1062562915Ab155628a3412938e',
      abi: './abis/PrivacyPreservingIdentity.json'
    },
    crossLayerBridge: {
      address: '0x5827193847c4F7e1062562915Ab155628a341294',
      abi: './abis/CrossLayerBridge.json'
    }
  }
};
