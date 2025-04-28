
// Contract configuration for IntelliLend frontend
// This file provides contract addresses and network settings for the application

// Import ABIs
import LendingPoolABI from '../abis/LendingPool.json';
import ZKVerifierABI from '../abis/ZKVerifier.json';

// Network settings
export const NETWORK_CONFIG = {
  chainId: '0x1074', // 4212 in decimal (IOTA EVM Testnet)
  chainName: 'IOTA EVM Testnet',
  nativeCurrency: {
    name: 'IOTA',
    symbol: 'IOTA',
    decimals: 18
  },
  rpcUrls: ['https://iota-testnet-evm.public.blastapi.io'],
  blockExplorerUrls: ['https://explorer.evm.testnet.iota.cafe']
};

// Contract addresses - using values from .env if available via REACT_APP_* variables
// If not available, using the addresses from the main .env file
export const CONTRACT_ADDRESSES = {
  LENDING_POOL: process.env.REACT_APP_LENDING_POOL_ADDRESS || '0x9A9f2CCfdE556A7E9Ff0848998Aa4a0CFD8863AE',
  ZK_VERIFIER: process.env.REACT_APP_ZK_VERIFIER_ADDRESS || '0x68B1D87F95878fE05B998F19b66F4baba5De1aed',
  ZK_BRIDGE: process.env.REACT_APP_ZK_BRIDGE_ADDRESS || '0x3Aa5ebB10DC797CAC828524e59A333d0A371443c',
  BRIDGE: process.env.REACT_APP_BRIDGE_ADDRESS || '0x3Aa5ebB10DC797CAC828524e59A333d0A371443c',
  LIQUIDATION_AUCTION: process.env.REACT_APP_LIQUIDATION_AUCTION_ADDRESS || '0x12Ab342bB35d6E95c8292f2f9DAd16F61cc8923B',
  MOVE_LENDING_POOL: process.env.REACT_APP_MOVE_LENDING_POOL_ADDRESS || '0x21feA4CeF471E7DEC974889cd7C1e23B5B4D9b6a',
  MOVE_RISK_BRIDGE: process.env.REACT_APP_MOVE_RISK_BRIDGE_ADDRESS || '0x7BE486a1a5A5df9f37056179D2a1879516800ee9',
};

// Contract ABIs
export const CONTRACT_ABIS = {
  LENDING_POOL: LendingPoolABI,
  ZK_VERIFIER: ZKVerifierABI,
};

// Use mock data when in development mode or when connections fail
export const USE_MOCK_DATA = process.env.REACT_APP_USE_MOCKS === 'true' || false;

export default {
  NETWORK_CONFIG,
  CONTRACT_ADDRESSES,
  CONTRACT_ABIS,
  USE_MOCK_DATA
};
