/**
 * Unit Tests for IOTA SDK Client Module
 * 
 * This file contains tests for the IOTA client functionality,
 * including connection, address generation, and transactions.
 */

const { expect } = require('chai');
const sinon = require('sinon');
const { Client } = require('@iota/sdk');

// Import our IOTA SDK wrappers
const {
  createClient,
  generateAddress,
  getBalance,
  submitBlock,
  getNetworkInfo,
  getTips,
  monitorTransaction,
  getAddressTransactions,
  subscribeToEvents,
  unsubscribeFromEvents,
  withExponentialBackoff,
  withTimeout,
  NodeManager
} = require('../../iota-sdk/client');

// Import test configuration
const config = require('./test-config');

describe('IOTA SDK Client Tests', function() {
  // Increase timeouts for IOTA network operations
  this.timeout(config.TIMEOUTS.MEDIUM);
  
  let client;
  let nodeManager;
  let stubbedClient;
  
  before(async function() {
    // This hook runs once before all tests
    // Create a real client for integration tests
    try {
      const result = await createClient(config.NETWORK);
      client = result.client;
      nodeManager = result.nodeManager;
      console.log('Test client created successfully');
    } catch (error) {
      console.error('Error creating test client:', error);
      // Continue with stubbed client for unit tests
    }
    
    // Create stub for unit tests that don't need real network
    stubbedClient = {
      getInfo: sinon.stub().resolves({
        nodeInfo: {
          name: 'HORNET',
          version: '2.0.0',
          status: {
            isHealthy: true,
            latestMilestone: {
              index: 123456,
              timestamp: Date.now() / 1000
            }
          },
          protocol: {
            version: 2,
            networkName: 'testnet'
          }
        }
      }),
      getBalance: sinon.stub().resolves({
        baseCoin: {
          total: '1000000',
          available: '1000000'
        },
        nativeTokens: []
      }),
      postBlock: sinon.stub().resolves({
        blockId: '0x1234567890abcdef'
      }),
      getBlockMetadata: sinon.stub().resolves({
        blockId: '0x1234567890abcdef',
        parents: ['0xaaaa', '0xbbbb'],
        isSolid: true,
        referencedByMilestoneIndex: 123456
      }),
      getTips: sinon.stub().resolves(['0xaaaa', '0xbbbb', '0xcccc']),
      getNodeInfo: sinon.stub().resolves({
        name: 'HORNET',
        version: '2.0.0',
        isHealthy: true
      })
    };
  });
  
  after(async function() {
    // Clean up after all tests
    if (client) {
      // If we need to clean anything up with the client
      console.log('Cleaning up test client');
    }
  });
  
  // Unit Tests for client module functions
  describe('NodeManager', function() {
    it('should create a NodeManager instance with provided nodes', function() {
      const nodes = ['https://node1.test', 'https://node2.test'];
      const manager = new NodeManager(nodes);
      
      expect(manager.nodes).to.have.lengthOf(2);
      expect(manager.getCurrentNode()).to.equal(nodes[0]);
    });
    
    it('should mark a node as unhealthy and switch to another', function() {
      const nodes = ['https://node1.test', 'https://node2.test', 'https://node3.test'];
      const manager = new NodeManager(nodes);
      
      const initialNode = manager.getCurrentNode();
      manager.markCurrentNodeUnhealthy(new Error('Test error'));
      
      expect(manager.getCurrentNode()).to.not.equal(initialNode);
    });
    
    it('should return all healthy nodes', function() {
      const nodes = ['https://node1.test', 'https://node2.test', 'https://node3.test'];
      const manager = new NodeManager(nodes);
      
      manager.markNodeUnhealthy(1, new Error('Test error'));
      
      const healthyNodes = manager.getHealthyNodes();
      expect(healthyNodes).to.have.lengthOf(2);
      expect(healthyNodes).to.not.include(nodes[1]);
    });
  });
  
  describe('withExponentialBackoff', function() {
    it('should retry a failing operation up to maxRetries', async function() {
      const operation = sinon.stub();
      operation.onCall(0).rejects(new Error('Attempt 1 failed'));
      operation.onCall(1).rejects(new Error('Attempt 2 failed'));
      operation.onCall(2).resolves('Success');
      
      const result = await withExponentialBackoff(operation, {
        maxRetries: 3,
        initialDelayMs: 10, // Small delay for testing
        maxDelayMs: 50
      });
      
      expect(result).to.equal('Success');
      expect(operation.callCount).to.equal(3);
    });
    
    it('should throw if all retries fail', async function() {
      const operation = sinon.stub().rejects(new Error('All attempts failed'));
      
      try {
        await withExponentialBackoff(operation, {
          maxRetries: 2,
          initialDelayMs: 10
        });
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.equal('All attempts failed');
        expect(operation.callCount).to.equal(3); // Initial + 2 retries
      }
    });
  });
  
  describe('withTimeout', function() {
    it('should resolve if operation completes before timeout', async function() {
      const operation = Promise.resolve('Success');
      const result = await withTimeout(operation, 1000);
      
      expect(result).to.equal('Success');
    });
    
    it('should reject if operation exceeds timeout', async function() {
      // Create a promise that never resolves
      const operation = new Promise(resolve => setTimeout(resolve, 1000));
      
      try {
        await withTimeout(operation, 50);
        expect.fail('Should have thrown a timeout error');
      } catch (error) {
        expect(error.message).to.include('timed out');
      }
    });
  });
  
  // Integration Tests that require a real network connection
  describe('Integration Tests', function() {
    // Skip all tests in this block if no client available
    beforeEach(function() {
      if (!client) {
        this.skip();
      }
    });
    
    it('should get network information', async function() {
      const info = await getNetworkInfo(client, nodeManager);
      
      expect(info).to.be.an('object');
      expect(info.nodeInfo).to.be.an('object');
      expect(info.protocol).to.be.an('object');
      expect(info.isHealthy).to.be.a('boolean');
    });
    
    it('should get tips from the network', async function() {
      const tips = await getTips(client, nodeManager);
      
      expect(tips).to.be.an('array');
      expect(tips.length).to.be.at.least(1);
    });
    
    it('should generate a valid address', async function() {
      // Skip if no secretManager available in client
      try {
        client.getSecretManager();
      } catch (error) {
        this.skip();
      }
      
      const accountIndex = 0;
      const addressIndex = 0;
      
      const address = await generateAddress(client, accountIndex, addressIndex, config.NETWORK);
      
      expect(address).to.be.a('string');
      // Verify address format based on network
      const network = config.NETWORK;
      const prefix = network === 'mainnet' ? 'smr' : 'rms';
      expect(address).to.match(new RegExp(`^${prefix}1`));
    });
  });
  
  // Mocked tests that don't require real network connection
  describe('Mocked Client Tests', function() {
    it('should submit a block successfully', async function() {
      const mockClient = { ...stubbedClient };
      const mockManager = { getHealthyNodes: () => ['https://node1.test'] };
      
      const blockData = {
        payload: {
          type: 1,
          tag: Buffer.from('TEST').toString('hex'),
          data: Buffer.from('Test Data').toString('hex')
        }
      };
      
      const result = await submitBlock(mockClient, blockData, mockManager);
      
      expect(result).to.have.property('blockId');
    });
    
    it('should monitor a transaction until confirmed', async function() {
      const mockClient = {
        blockMetadata: sinon.stub()
      };
      
      // First call returns pending, second call returns confirmed
      mockClient.blockMetadata.onCall(0).resolves({
        blockId: '0x1234',
        milestone_timestamp_booked: null,
        is_conflicting: false
      });
      
      mockClient.blockMetadata.onCall(1).resolves({
        blockId: '0x1234',
        milestone_timestamp_booked: Date.now() / 1000,
        is_conflicting: false
      });
      
      const statusCallback = sinon.spy();
      
      const result = await monitorTransaction(mockClient, '0x1234', statusCallback, {
        maxDuration: 10000,
        checkInterval: 50 // Small interval for testing
      });
      
      expect(result.status).to.equal('confirmed');
      expect(statusCallback.called).to.be.true;
    });
    
    it('should throw an error for invalid address format in getBalance', async function() {
      const mockClient = { ...stubbedClient };
      const mockManager = { getHealthyNodes: () => ['https://node1.test'] };
      
      try {
        await getBalance(mockClient, 'invalid-address', mockManager);
        expect.fail('Should have thrown an error for invalid address');
      } catch (error) {
        expect(error.message).to.include('Invalid address format');
      }
    });
  });
  
  // Performance Benchmarks
  describe('Performance Benchmarks', function() {
    // Skip all benchmarks if no client available
    beforeEach(function() {
      if (!client) {
        this.skip();
      }
      
      // Increase timeout for benchmarks
      this.timeout(config.TIMEOUTS.LONG);
    });
    
    it('should benchmark network info retrieval performance', async function() {
      const iterations = config.PERFORMANCE.ITERATIONS.MEDIUM;
      const times = [];
      
      for (let i = 0; i < iterations; i++) {
        const start = Date.now();
        await getNetworkInfo(client, nodeManager);
        const end = Date.now();
        times.push(end - start);
      }
      
      // Calculate statistics
      const totalTime = times.reduce((sum, time) => sum + time, 0);
      const avgTime = totalTime / times.length;
      const maxTime = Math.max(...times);
      const minTime = Math.min(...times);
      
      console.log(`Network Info Benchmark (${iterations} iterations):`);
      console.log(`  Average Time: ${avgTime.toFixed(2)}ms`);
      console.log(`  Min Time: ${minTime}ms`);
      console.log(`  Max Time: ${maxTime}ms`);
      
      // No specific assertion, just reporting
    });
    
    it('should benchmark tip retrieval performance', async function() {
      const iterations = config.PERFORMANCE.ITERATIONS.MEDIUM;
      const times = [];
      
      for (let i = 0; i < iterations; i++) {
        const start = Date.now();
        await getTips(client, nodeManager);
        const end = Date.now();
        times.push(end - start);
      }
      
      // Calculate statistics
      const totalTime = times.reduce((sum, time) => sum + time, 0);
      const avgTime = totalTime / times.length;
      const maxTime = Math.max(...times);
      const minTime = Math.min(...times);
      
      console.log(`Tip Retrieval Benchmark (${iterations} iterations):`);
      console.log(`  Average Time: ${avgTime.toFixed(2)}ms`);
      console.log(`  Min Time: ${minTime}ms`);
      console.log(`  Max Time: ${maxTime}ms`);
      
      // No specific assertion, just reporting
    });
  });
});
