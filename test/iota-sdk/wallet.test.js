/**
 * Unit Tests for IOTA SDK Wallet Module
 * 
 * This file contains tests for the IOTA wallet functionality,
 * including wallet creation, account management, and transactions.
 */

const { expect } = require('chai');
const sinon = require('sinon');
const { Wallet, CoinType } = require('@iota/sdk');
const fs = require('fs');
const path = require('path');

// Import our IOTA SDK wrappers
const {
  createWallet,
  getOrCreateAccount,
  generateAddress,
  getBalance,
  sendTokens,
  monitorTransaction,
  getTransactionHistory,
  createTransaction,
  burnNativeTokens,
  listenToAccountEvents,
  createSigningKey
} = require('../../iota-sdk/wallet');

// Import test configuration
const config = require('./test-config');

describe('IOTA SDK Wallet Tests', function() {
  // Increase timeouts for IOTA network operations
  this.timeout(config.TIMEOUTS.MEDIUM);
  
  let wallet;
  let account;
  let mockWallet;
  let mockAccount;
  
  // Prepare test wallet directory
  before(async function() {
    // Create test directories if they don't exist
    const testWalletDir = path.dirname(config.TEST_WALLET.SNAPSHOT_PATH);
    if (!fs.existsSync(testWalletDir)) {
      fs.mkdirSync(testWalletDir, { recursive: true });
    }
    
    const testStorageDir = config.TEST_WALLET.STORAGE_PATH;
    if (!fs.existsSync(testStorageDir)) {
      fs.mkdirSync(testStorageDir, { recursive: true });
    }
    
    // If stronghold file exists, remove it for clean test
    if (fs.existsSync(config.TEST_WALLET.SNAPSHOT_PATH)) {
      fs.unlinkSync(config.TEST_WALLET.SNAPSHOT_PATH);
    }
    
    // Set up test environment variables
    process.env.STRONGHOLD_PASSWORD = config.TEST_WALLET.STRONGHOLD_PASSWORD;
    process.env.STRONGHOLD_SNAPSHOT_PATH = config.TEST_WALLET.SNAPSHOT_PATH;
    process.env.IOTA_STORAGE_PATH = config.TEST_WALLET.STORAGE_PATH;
    
    try {
      // Try to create a real wallet for integration tests
      wallet = await createWallet(config.NETWORK);
      console.log('Test wallet created successfully');
      
      // Create a test account
      account = await getOrCreateAccount(wallet, 'TestAccount');
      console.log('Test account created successfully');
    } catch (error) {
      console.error('Error setting up test wallet:', error);
      // We'll continue with mocks for unit tests
    }
    
    // Setup mock wallet and account for unit tests
    mockWallet = {
      createAccount: sinon.stub().resolves({
        alias: () => 'MockAccount',
        addresses: sinon.stub().resolves([
          { address: 'rms1mockaddress123456789abcdefghijklmnopqrstuvwxyz', keyIndex: 0, internal: false }
        ]),
        sync: sinon.stub().resolves({ unspentOutputs: [], pendingTransactions: [] }),
        getBalance: sinon.stub().resolves({
          baseCoin: { total: '1000000000', available: '1000000000' },
          nativeTokens: []
        }),
        generateAddress: sinon.stub().resolves({ address: 'rms1mockaddress123456789abcdefghijklmnopqrstuvwxyz' }),
        send: sinon.stub().resolves({ blockId: '0xmockblockhash', transactionId: '0xmocktxhash' }),
        transactions: sinon.stub().resolves([
          {
            id: '0xmocktxhash1',
            blockId: '0xmockblockhash1',
            incoming: true,
            amount: '1000000000',
            address: 'rms1mockaddress123456789abcdefghijklmnopqrstuvwxyz',
            timestamp: Date.now(),
            inclusionState: 'pending'
          },
          {
            id: '0xmocktxhash2',
            blockId: '0xmockblockhash2',
            incoming: false,
            amount: '500000000',
            address: 'rms1anothermockaddress123456789abcdefghijklmnopqrst',
            timestamp: Date.now() - 3600000, // 1 hour ago
            inclusionState: 'included'
          }
        ]),
        client: () => ({
          getNetworkInfo: () => ({ bech32Hrp: 'rms' })
        }),
        prepareTransaction: sinon.stub().resolves({
          transaction: 'mockserializedtransaction'
        }),
        submitAndSign: sinon.stub().resolves('0xmockblockhash'),
        generateSigningKey: sinon.stub().resolves({
          publicKey: 'mockPublicKey',
          type: 'Ed25519'
        })
      };
      
      mockAccount = {
        alias: () => 'MockAccount',
        addresses: () => [
          { address: 'rms1mockaddress123456789abcdefghijklmnopqrstuvwxyz', keyIndex: 0, internal: false }
        ],
        sync: sinon.stub().resolves({ unspentOutputs: [], pendingTransactions: [] }),
        getBalance: mockWallet.getBalance,
        generateAddress: mockWallet.generateAddress,
        send: mockWallet.send,
        transactions: mockWallet.transactions,
        client: mockWallet.client,
        prepareTransaction: mockWallet.prepareTransaction,
        submitAndSign: mockWallet.submitAndSign,
        generateSigningKey: mockWallet.generateSigningKey
      };
    });
  
  after(async function() {
    // Clean up test wallet and files
    if (wallet) {
      // Any wallet cleanup if needed
      console.log('Cleaning up test wallet');
    }
    
    // Optionally remove test files
    // if (fs.existsSync(config.TEST_WALLET.SNAPSHOT_PATH)) {
    //   fs.unlinkSync(config.TEST_WALLET.SNAPSHOT_PATH);
    // }
  });
  
  // Unit Tests for wallet module functions
  describe('Wallet Creation and Account Management', function() {
    it('should create a new wallet with stronghold', function() {
      expect(wallet).to.exist;
    });
    
    it('should create or get an account', async function() {
      // If we have a real wallet, use it, otherwise test with mock
      if (wallet) {
        const testAccount = await getOrCreateAccount(wallet, 'TestAccount2');
        expect(testAccount).to.exist;
        expect(testAccount.alias()).to.equal('TestAccount2');
      } else {
        // Test with mock
        mockWallet.getAccounts = sinon.stub().resolves([]);
        
        const testAccount = await getOrCreateAccount(mockWallet, 'TestAccount2');
        expect(testAccount).to.exist;
        expect(mockWallet.createAccount.calledOnce).to.be.true;
      }
    });
    
    it('should retrieve an existing account instead of creating a new one', async function() {
      // Test with mock
      mockWallet.getAccounts = sinon.stub().resolves([{
        alias: () => 'ExistingAccount'
      }]);
      
      const existingAccount = await getOrCreateAccount(mockWallet, 'ExistingAccount');
      expect(existingAccount).to.exist;
      expect(existingAccount.alias()).to.equal('ExistingAccount');
      expect(mockWallet.createAccount.calledOnce).to.be.false; // Should not be called again
    });
  });
  
  describe('Address Generation', function() {
    it('should generate a new address for an account', async function() {
      const address = await generateAddress(mockAccount);
      
      expect(address).to.be.a('string');
      expect(mockAccount.generateAddress.calledOnce).to.be.true;
    });
    
    it('should generate an internal address when specified', async function() {
      const options = { internal: true };
      await generateAddress(mockAccount, options);
      
      expect(mockAccount.generateAddress.calledWith(sinon.match({ 
        internal: true 
      }))).to.be.true;
    });
  });
  
  describe('Balance Retrieval', function() {
    it('should get account balance', async function() {
      const balance = await getBalance(mockAccount);
      
      expect(balance).to.be.an('object');
      expect(balance.formatted).to.be.an('object');
      expect(balance.formatted.total).to.equal('1000');
      expect(balance.formatted.available).to.equal('1000');
      expect(balance.formatted.tokenSymbol).to.be.a('string');
      expect(mockAccount.getBalance.calledOnce).to.be.true;
    });
    
    it('should sync account before getting balance if requested', async function() {
      await getBalance(mockAccount, { syncFirst: true });
      
      expect(mockAccount.sync.calledOnce).to.be.true;
      expect(mockAccount.getBalance.calledOnce).to.be.true;
    });
  });
  
  describe('Transaction Operations', function() {
    it('should send tokens from an account', async function() {
      const result = await sendTokens(
        mockAccount,
        '10',
        'rms1receiveraddress123456789abcdefghijklmnopqrstuvwxyz'
      );
      
      expect(result).to.be.an('object');
      expect(result.success).to.be.true;
      expect(result.blockId).to.be.a('string');
      expect(result.formattedAmount).to.include('10');
      expect(mockAccount.send.calledOnce).to.be.true;
    });
    
    it('should validate address format when sending tokens', async function() {
      try {
        await sendTokens(mockAccount, '10', 'invalid-address');
        expect.fail('Should have thrown an error for invalid address');
      } catch (error) {
        expect(error.message).to.include('Invalid address format');
      }
    });
    
    it('should create a transaction with custom outputs', async function() {
      const outputs = [
        {
          address: 'rms1receiveraddress123456789abcdefghijklmnopqrstuvwxyz',
          amount: '10',
          tag: 'Test'
        }
      ];
      
      const result = await createTransaction(mockAccount, outputs);
      
      expect(result).to.be.an('object');
      expect(result.blockId).to.be.a('string');
      expect(mockAccount.prepareTransaction.calledOnce).to.be.true;
      expect(mockAccount.submitAndSign.calledOnce).to.be.true;
    });
    
    it('should get transaction history', async function() {
      const history = await getTransactionHistory(mockAccount);
      
      expect(history).to.be.an('array');
      expect(history.length).to.be.at.least(1);
      expect(history[0]).to.have.property('id');
      expect(history[0]).to.have.property('blockId');
      expect(history[0]).to.have.property('formattedAmount');
      expect(mockAccount.transactions.calledOnce).to.be.true;
    });
  });
  
  describe('Event Handling', function() {
    it('should set up account event listeners', async function() {
      // Mock client with event emitter functionality
      const mockClient = {
        on: sinon.stub(),
        off: sinon.stub()
      };
      
      // Mock account with client accessor
      const eventAccount = {
        ...mockAccount,
        client: () => mockClient,
        addresses: () => [{ address: 'rms1mockaddress123456789abcdefghijklmnopqrstuvwxyz' }]
      };
      
      const callback = sinon.spy();
      
      await listenToAccountEvents(eventAccount, callback);
      
      expect(mockClient.on.calledTwice).to.be.true; // Should register for newOutput and transactionConfirmed
    });
  });
  
  // Cryptographic Function Tests
  describe('Cryptographic Functions', function() {
    it('should create a signing key', async function() {
      const keyType = 'ed25519';
      const result = await createSigningKey(mockAccount, keyType);
      
      expect(result).to.be.an('object');
      expect(result.publicKey).to.be.a('string');
      expect(result.keyType).to.equal(keyType);
      expect(mockAccount.generateSigningKey.calledOnce).to.be.true;
    });
  });
  
  // Integration Tests that require a real wallet
  describe('Integration Tests', function() {
    // Skip all tests in this block if no wallet available
    beforeEach(function() {
      if (!wallet || !account) {
        this.skip();
      }
    });
    
    it('should synchronize account with the network', async function() {
      const syncResult = await account.sync();
      
      expect(syncResult).to.be.an('object');
      // The structure of syncResult varies, but it should indicate successful sync
    });
    
    it('should get real account balance', async function() {
      const balance = await getBalance(account);
      
      expect(balance).to.be.an('object');
      expect(balance.formatted).to.be.an('object');
      expect(balance.formatted.total).to.be.a('string');
      expect(balance.formatted.available).to.be.a('string');
      expect(balance.formatted.tokenSymbol).to.be.a('string');
    });
    
    it('should generate a real address', async function() {
      const address = await generateAddress(account);
      
      expect(address).to.be.a('string');
      // Address should match network prefix
      const prefix = config.NETWORK === 'mainnet' ? 'smr' : 'rms';
      expect(address).to.match(new RegExp(`^${prefix}1`));
    });
  });
  
  // Performance Benchmarks
  describe('Performance Benchmarks', function() {
    // Skip all benchmarks if no wallet or account available
    beforeEach(function() {
      if (!wallet || !account) {
        this.skip();
      }
      
      // Increase timeout for benchmarks
      this.timeout(config.TIMEOUTS.LONG);
    });
    
    it('should benchmark address generation performance', async function() {
      const iterations = config.PERFORMANCE.ITERATIONS.LIGHT;
      const times = [];
      
      for (let i = 0; i < iterations; i++) {
        const start = Date.now();
        await generateAddress(account, { metadata: `Benchmark address ${i}` });
        const end = Date.now();
        times.push(end - start);
      }
      
      // Calculate statistics
      const totalTime = times.reduce((sum, time) => sum + time, 0);
      const avgTime = totalTime / times.length;
      const maxTime = Math.max(...times);
      const minTime = Math.min(...times);
      
      console.log(`Address Generation Benchmark (${iterations} iterations):`);
      console.log(`  Average Time: ${avgTime.toFixed(2)}ms`);
      console.log(`  Min Time: ${minTime}ms`);
      console.log(`  Max Time: ${maxTime}ms`);
      
      // Verify performance against threshold
      const threshold = config.PERFORMANCE.THRESHOLDS.ADDRESS_GENERATION;
      if (avgTime > threshold) {
        console.warn(`⚠️ Address generation performance (${avgTime.toFixed(2)}ms) exceeds threshold (${threshold}ms)`);
      }
    });
    
    it('should benchmark balance check performance', async function() {
      const iterations = config.PERFORMANCE.ITERATIONS.LIGHT;
      const times = [];
      
      for (let i = 0; i < iterations; i++) {
        const start = Date.now();
        await getBalance(account, { syncFirst: false });
        const end = Date.now();
        times.push(end - start);
      }
      
      // Calculate statistics
      const totalTime = times.reduce((sum, time) => sum + time, 0);
      const avgTime = totalTime / times.length;
      const maxTime = Math.max(...times);
      const minTime = Math.min(...times);
      
      console.log(`Balance Check Benchmark (${iterations} iterations):`);
      console.log(`  Average Time: ${avgTime.toFixed(2)}ms`);
      console.log(`  Min Time: ${minTime}ms`);
      console.log(`  Max Time: ${maxTime}ms`);
      
      // Verify performance against threshold
      const threshold = config.PERFORMANCE.THRESHOLDS.BALANCE_CHECK;
      if (avgTime > threshold) {
        console.warn(`⚠️ Balance check performance (${avgTime.toFixed(2)}ms) exceeds threshold (${threshold}ms)`);
      }
    });
  });
});
