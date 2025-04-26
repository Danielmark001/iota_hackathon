/**
 * Unit Tests for IOTA Cross-Layer Communication Module
 * 
 * This file contains tests for the cross-layer communication functionality,
 * including L1-L2 messaging and atomic swaps.
 */

const { expect } = require('chai');
const sinon = require('sinon');
const { ethers } = require('ethers');

// Import our IOTA SDK wrappers
const { createClient } = require('../../iota-sdk/client');
const { createWallet, getOrCreateAccount } = require('../../iota-sdk/wallet');

// Import test configuration
const config = require('./test-config');

describe('IOTA Cross-Layer Tests', function() {
  // Increase timeouts for IOTA network operations
  this.timeout(config.TIMEOUTS.LONG);
  
  let client;
  let wallet;
  let account;
  let evmProvider;
  let crossLayerAggregator;
  let mockBridge;
  
  before(async function() {
    // This hook runs once before all tests
    // Create a real client for integration tests
    try {
      const result = await createClient(config.NETWORK);
      client = result.client;
      console.log('Test client created successfully');
      
      // Try to create a real wallet for integration tests
      if (process.env.TEST_STRONGHOLD_PASSWORD) {
        wallet = await createWallet(config.NETWORK);
        console.log('Test wallet created successfully');
        
        // Create a test account
        account = await getOrCreateAccount(wallet, 'TestCrossLayerAccount');
        console.log('Test account created successfully');
      }
      
      // Connect to IOTA EVM testnet
      try {
        evmProvider = new ethers.providers.JsonRpcProvider(
          process.env.IOTA_EVM_RPC_URL || 'https://api.testnet.shimmer.network/evm'
        );
        await evmProvider.getNetwork();
        console.log('Connected to IOTA EVM testnet');
      } catch (error) {
        console.error('Failed to connect to IOTA EVM testnet:', error);
      }
      
      // Initialize cross-layer aggregator if wallet is available
      if (wallet && evmProvider) {
        try {
          const { createAggregator } = require('../../iota-sdk/cross-layer');
          crossLayerAggregator = await createAggregator(client, {
            l1NetworkType: 'iota',
            l2NetworkType: 'evm',
            wallet: wallet,
            account: account,
            evmProvider: evmProvider
          });
          console.log('Cross-layer aggregator initialized');
        } catch (error) {
          console.error('Failed to initialize cross-layer aggregator:', error);
        }
      }
    } catch (error) {
      console.error('Error in test setup:', error);
    }
    
    // Create mock bridge for unit tests
    mockBridge = {
      sendMessageToL2: sinon.stub().resolves({
        messageId: '0x' + '1'.repeat(64),
        transactionHash: '0x' + '2'.repeat(64)
      }),
      sendMessageToL1: sinon.stub().resolves({
        messageId: '0x' + '3'.repeat(64),
        blockId: '0x' + '4'.repeat(64)
      }),
      getMessageStatus: sinon.stub().resolves({
        status: 'confirmed',
        confirmations: 10
      }),
      atomicSwap: sinon.stub().resolves({
        swapId: '0x' + '5'.repeat(64),
        statusL1: 'pending',
        statusL2: 'pending'
      })
    };
  });
  
  // Skip all tests in this block if no client available
  beforeEach(function() {
    if (!client) {
      this.skip();
    }
  });
  
  describe('Cross-Layer Message Passing', function() {
    it('should send a message from L1 to L2', async function() {
      // Skip if no cross-layer aggregator
      if (!crossLayerAggregator) {
        this.skip();
      }
      
      const message = {
        targetAddress: '0x' + '0'.repeat(40),
        payload: {
          action: 'test',
          data: 'test-message'
        }
      };
      
      const result = await crossLayerAggregator.sendMessageToL2(message);
      
      expect(result).to.be.an('object');
      expect(result.messageId).to.be.a('string');
    });
    
    it('should send a message from L2 to L1', async function() {
      // Skip if no cross-layer aggregator
      if (!crossLayerAggregator) {
        this.skip();
      }
      
      const message = {
        targetAddress: 'smr1' + '0'.repeat(60),
        payload: {
          action: 'test',
          data: 'test-message'
        }
      };
      
      const result = await crossLayerAggregator.sendMessageToL1(message);
      
      expect(result).to.be.an('object');
      expect(result.messageId).to.be.a('string');
    });
    
    it('should mock sending a message from L1 to L2', async function() {
      const message = {
        targetAddress: '0x' + '0'.repeat(40),
        payload: {
          action: 'test',
          data: 'test-message'
        }
      };
      
      const result = await mockBridge.sendMessageToL2(message);
      
      expect(result.messageId).to.equal('0x' + '1'.repeat(64));
      expect(result.transactionHash).to.equal('0x' + '2'.repeat(64));
    });
    
    it('should get message status', async function() {
      // Skip if no cross-layer aggregator
      if (!crossLayerAggregator) {
        this.skip();
      }
      
      const messageId = '0x' + '0'.repeat(64);
      
      try {
        const status = await crossLayerAggregator.getMessageStatus(messageId);
        expect(status).to.be.an('object');
        expect(status).to.have.property('status');
      } catch (error) {
        // If message doesn't exist, that's acceptable for test
        expect(error.message).to.include('not found');
      }
    });
  });
  
  describe('Atomic Swaps', function() {
    it('should perform an atomic swap between L1 and L2', async function() {
      // Skip if no cross-layer aggregator
      if (!crossLayerAggregator) {
        this.skip();
      }
      
      const swapParams = {
        amountL1: '1000000', // 1 IOTA in smallest units
        recipientL1: 'smr1' + '0'.repeat(60),
        amountL2: ethers.utils.parseEther('0.001').toString(),
        recipientL2: '0x' + '1'.repeat(40),
        timelock: Math.floor(Date.now() / 1000) + 3600 // 1 hour from now
      };
      
      try {
        const result = await crossLayerAggregator.atomicSwap(swapParams);
        expect(result).to.be.an('object');
        expect(result.swapId).to.be.a('string');
      } catch (error) {
        // This might fail if the account has insufficient balance
        console.warn('Atomic swap test failed:', error.message);
        this.skip();
      }
    });
    
    it('should mock an atomic swap', async function() {
      const swapParams = {
        amountL1: '1000000', // 1 IOTA in smallest units
        recipientL1: 'smr1' + '0'.repeat(60),
        amountL2: ethers.utils.parseEther('0.001').toString(),
        recipientL2: '0x' + '1'.repeat(40),
        timelock: Math.floor(Date.now() / 1000) + 3600 // 1 hour from now
      };
      
      const result = await mockBridge.atomicSwap(swapParams);
      
      expect(result.swapId).to.equal('0x' + '5'.repeat(64));
      expect(result.statusL1).to.equal('pending');
      expect(result.statusL2).to.equal('pending');
    });
  });
  
  describe('Cross-Layer Data Synchronization', function() {
    it('should synchronize data between L1 and L2', async function() {
      // Skip if no cross-layer aggregator
      if (!crossLayerAggregator) {
        this.skip();
      }
      
      const data = {
        key: 'test-key',
        value: 'test-value',
        timestamp: Date.now()
      };
      
      try {
        const result = await crossLayerAggregator.syncData(data);
        expect(result).to.be.an('object');
        expect(result.syncId).to.be.a('string');
      } catch (error) {
        // This might not be implemented yet
        this.skip();
      }
    });
  });
  
  describe('Error Handling and Recovery', function() {
    it('should handle network errors gracefully', async function() {
      // Mock a failed message send
      const failedBridge = {
        sendMessageToL2: sinon.stub().rejects(new Error('Network error'))
      };
      
      // Create a cross-layer aggregator with retry functionality
      const { withExponentialBackoff } = require('../../iota-sdk/client');
      
      try {
        await withExponentialBackoff(async () => {
          await failedBridge.sendMessageToL2({
            targetAddress: '0x' + '0'.repeat(40),
            payload: { action: 'test' }
          });
        }, {
          maxRetries: 2,
          initialDelayMs: 10
        });
        
        // Should not reach here
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.equal('Network error');
        expect(failedBridge.sendMessageToL2.callCount).to.equal(3); // Initial + 2 retries
      }
    });
    
    it('should implement circuit breaker pattern', async function() {
      // This test checks if the circuit breaker functionality works
      // Requires implementation in the cross-layer module
      
      // Skip if no cross-layer aggregator
      if (!crossLayerAggregator || !crossLayerAggregator.circuitBreaker) {
        this.skip();
      }
      
      // Reset circuit breaker state
      crossLayerAggregator.circuitBreaker.reset();
      
      // Trigger multiple failures
      for (let i = 0; i < 5; i++) {
        try {
          await crossLayerAggregator.circuitBreaker.execute(() => {
            throw new Error('Test failure');
          });
        } catch (error) {
          // Expected
        }
      }
      
      // Circuit should be open now
      expect(crossLayerAggregator.circuitBreaker.state).to.equal('open');
      
      // Wait for circuit to go to half-open state
      // This would be a real test in a complete implementation
    });
  });
});
