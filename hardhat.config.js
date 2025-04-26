require("@nomicfoundation/hardhat-toolbox");
require('dotenv').config();

/** @type import('hardhat/config').HardhatUserConfig */
// Get private key from environment
const PRIVATE_KEY = process.env.PRIVATE_KEY || "0000000000000000000000000000000000000000000000000000000000000000";

module.exports = {
  solidity: "0.8.19",
  networks: {
    // IOTA Shimmer EVM Testnet
    shimmer_testnet: {
      url: process.env.IOTA_EVM_RPC_URL || "https://api.testnet.shimmer.network/evm",
      accounts: [PRIVATE_KEY],
      chainId: 1071, // Shimmer EVM Testnet Chain ID
      gasPrice: 0, // Gas is free on the testnet
      timeout: 120000, // 2 minutes
    },
    // Legacy IOTA EVM testnet (if needed)
    iota_testnet: {
      url: process.env.IOTA_LEGACY_EVM_RPC_URL || "https://evm.wasp.sc.iota.org",
      accounts: [PRIVATE_KEY]
    },
    // Local development network for testing
    localhost: {
      url: "http://127.0.0.1:8545",
      accounts: [PRIVATE_KEY],
    }
  },
  // Etherscan API key for contract verification (can be set for IOTA Explorer when available)
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY
  },
  // Compilation settings
  settings: {
    optimizer: {
      enabled: true,
      runs: 200,
    },
  },
  paths: {
    sources: "./smart-contracts/evm",
    tests: "./smart-contracts/test",
    cache: "./artifacts/cache",
    artifacts: "./artifacts"
  }
};
