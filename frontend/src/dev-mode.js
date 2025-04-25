// Development mode override script
// This file provides mock implementations for authentication and Web3 contexts

// Mock Web3 data
export const mockWeb3Data = {
  currentAccount: '0x71C7656EC7ab88b098defB751B7401B5f6d8976F',
  chainId: 1,
  isConnected: true,
  provider: {},
  signer: {},
  lendingPool: {},
  zkVerifier: {}
};

// Mock user profile data
export const mockUserProfile = {
  address: '0x71C7656EC7ab88b098defB751B7401B5f6d8976F',
  name: 'Test User',
  email: 'user@example.com',
  deposits: 1500,
  borrows: 800,
  collateral: 2000,
  riskScore: 45,
  interestRate: 7.5,
  healthFactor: 1.8,
  identityVerified: false
};

// Override isAuthenticated globally for development
window.DEV_MODE = {
  isAuthenticated: true,
  bypassAuth: true
};

console.log('🛠️ DEVELOPMENT MODE ENABLED');
console.log('✅ Authentication bypassed');
console.log('✅ Mock wallet connected:', mockWeb3Data.currentAccount);
