require("@nomicfoundation/hardhat-toolbox");
require('dotenv').config();

const PRIVATE_KEY = process.env.PRIVATE_KEY || "0x0000000000000000000000000000000000000000000000000000000000000000";

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.19",
  networks: {
    iota_testnet: {
      url: process.env.IOTA_EVM_RPC_URL || "https://evm.wasp.sc.iota.org",
      accounts: [PRIVATE_KEY]
    }
  },
  paths: {
    sources: "./smart-contracts/evm",
    tests: "./smart-contracts/test",
    cache: "./artifacts/cache",
    artifacts: "./artifacts"
  }
};
