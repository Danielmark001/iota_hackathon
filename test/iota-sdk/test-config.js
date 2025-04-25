/**
 * IOTA SDK Test Configuration
 * 
 * This file contains configuration for IOTA SDK tests, including
 * endpoints, test accounts, and other testing parameters.
 */

// Load environment variables for testing
require('dotenv').config();

module.exports = {
  // Network to use for testing (testnet or devnet recommended)
  NETWORK: process.env.TEST_IOTA_NETWORK || 'testnet',
  
  // Test timeouts
  TIMEOUTS: {
    SHORT: 5000,     // 5 seconds
    MEDIUM: 15000,   // 15 seconds
    LONG: 60000,     // 1 minute
    VERY_LONG: 300000 // 5 minutes
  },
  
  // Test wallet configuration
  TEST_WALLET: {
    STRONGHOLD_PASSWORD: process.env.TEST_STRONGHOLD_PASSWORD || 'SuperSecureTestPassword123!',
    SNAPSHOT_PATH: process.env.TEST_STRONGHOLD_SNAPSHOT_PATH || './test/iota-sdk/test-wallet.stronghold',
    STORAGE_PATH: process.env.TEST_IOTA_STORAGE_PATH || './test/iota-sdk/test-wallet-db'
  },
  
  // Security testing configuration
  SECURITY: {
    // Rate limiting test parameters
    RATE_LIMIT_REQUESTS: 10,
    RATE_LIMIT_INTERVAL_MS: 1000,
    
    // Known vulnerable transaction patterns to test for
    VULNERABLE_PATTERNS: [
      'double-spend-attempt',
      'dust-protection-bypass',
      'weak-signature'
    ]
  },
  
  // Performance benchmarking configuration
  PERFORMANCE: {
    // Number of operations to perform for each benchmark
    ITERATIONS: {
      LIGHT: 10,
      MEDIUM: 50,
      HEAVY: 100
    },
    
    // Time thresholds for performance alerts (ms)
    THRESHOLDS: {
      ADDRESS_GENERATION: 500,
      TRANSACTION_SUBMIT: 2000,
      BALANCE_CHECK: 1000
    }
  },
  
  // Test data
  TEST_DATA: {
    // Sample transaction for tests (small amount)
    SAMPLE_TRANSACTION_AMOUNT: '0.00001',
    
    // Test messages
    TEST_MESSAGE: 'IntelliLend Test Message',
    
    // For data attachment tests
    TEST_DATA: {
      testId: 'intellilend-iota-test',
      timestamp: Date.now(),
      testType: 'automated-integration-test'
    }
  }
};
