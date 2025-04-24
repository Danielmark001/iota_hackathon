/**
 * Blockchain Data Service
 * 
 * Handles all interactions with the IOTA blockchain (both L1 and L2)
 */

const { ethers } = require('ethers');
const axios = require('axios');
const config = require('../config');
const logger = require('../utils/logger');
const { BlockchainError } = require('../utils/errorHandler');
const { cache, CACHE_KEYS } = require('../utils/cache');

class BlockchainDataService {
  constructor() {
    this.providers = {};
    this.contracts = {};
    this.initialize();
  }

  /**
   * Initialize blockchain providers and contracts
   */
  initialize() {
    try {
      // Initialize EVM provider
      this.providers.evm = new ethers.providers.JsonRpcProvider(
        config.blockchain.evm.rpcUrl,
        config.blockchain.evm.chainId
      );
      
      // Initialize websocket provider if available
      if (config.blockchain.evm.wsUrl) {
        this.providers.evmWs = new ethers.providers.WebSocketProvider(
          config.blockchain.evm.wsUrl,
          config.blockchain.evm.chainId
        );
      }
      
      // Initialize contracts
      this._initializeContracts();
      
      logger.info('Blockchain Data Service initialized successfully');
    } catch (error) {
      logger.error(`Error initializing Blockchain Data Service: ${error.message}`);
      throw new BlockchainError(`Failed to initialize blockchain service: ${error.message}`);
    }
  }

  /**
   * Get EVM provider instance
   * @param {boolean} useWebsocket - Whether to use WebSocket provider
   * @returns {ethers.providers.Provider} - Provider instance
   */
  getProvider(useWebsocket = false) {
    if (useWebsocket && this.providers.evmWs) {
      return this.providers.evmWs;
    }
    
    return this.providers.evm;
  }

  /**
   * Get contract instance
   * @param {string} contractName - Name of the contract to get
   * @returns {ethers.Contract} - Contract instance
   */
  getContract(contractName) {
    if (!this.contracts[contractName]) {
      throw new BlockchainError(`Contract ${contractName} not initialized`);
    }
    
    return this.contracts[contractName];
  }

  /**
   * Fetch account balance
   * @param {string} address - Account address
   * @param {string} assetAddress - Asset address (optional, defaults to native token)
   * @returns {Promise<string>} - Account balance
   */
  async getBalance(address, assetAddress = null) {
    try {
      if (!ethers.utils.isAddress(address)) {
        throw new BlockchainError('Invalid address');
      }
      
      // Check if fetching native token balance
      if (!assetAddress || assetAddress === ethers.constants.AddressZero) {
        const balance = await this.providers.evm.getBalance(address);
        return balance.toString();
      }
      
      // Otherwise fetch ERC20 token balance
      const erc20Abi = ['function balanceOf(address) view returns (uint256)'];
      const tokenContract = new ethers.Contract(assetAddress, erc20Abi, this.providers.evm);
      
      const balance = await tokenContract.balanceOf(address);
      return balance.toString();
    } catch (error) {
      logger.error(`Error getting balance for ${address}: ${error.message}`);
      throw new BlockchainError(`Failed to get balance: ${error.message}`);
    }
  }

  /**
   * Fetch account transactions
   * @param {string} address - Account address
   * @param {number} limit - Maximum number of transactions to fetch
   * @returns {Promise<Array>} - List of transactions
   */
  async getTransactions(address, limit = 10) {
    try {
      if (!ethers.utils.isAddress(address)) {
        throw new BlockchainError('Invalid address');
      }
      
      // Check cache
      const cacheKey = `${CACHE_KEYS.TRANSACTIONS}:${address}:${limit}`;
      const cachedTransactions = cache.get(cacheKey);
      
      if (cachedTransactions) {
        logger.debug(`Returning cached transactions for ${address}`);
        return cachedTransactions;
      }
      
      // Fetch current block number
      const currentBlock = await this.providers.evm.getBlockNumber();
      
      // Determine start block (last 10,000 blocks by default)
      const startBlock = Math.max(0, currentBlock - 10000);
      
      // Prepare filter
      const filter = {
        fromBlock: startBlock,
        toBlock: 'latest',
        address: null,
      };
      
      // Get sent transactions
      filter.address = address;
      const sentLogs = await this.providers.evm.getLogs(filter);
      
      // Get received transactions
      const receivedLogs = await this.providers.evm.getLogs({
        ...filter,
        topics: [null, ethers.utils.hexZeroPad(address, 32)]
      });
      
      // Combine and deduplicate logs
      const allLogs = [...sentLogs, ...receivedLogs];
      const uniqueLogs = Array.from(new Map(allLogs.map(log => [log.transactionHash, log])).values());
      
      // Fetch transaction details
      const transactions = await Promise.all(
        uniqueLogs
          .slice(0, limit)
          .map(log => this.providers.evm.getTransactionReceipt(log.transactionHash))
      );
      
      // Cache results
      cache.set(cacheKey, transactions, 300); // Cache for 5 minutes
      
      return transactions;
    } catch (error) {
      logger.error(`Error getting transactions for ${address}: ${error.message}`);
      throw new BlockchainError(`Failed to get transactions: ${error.message}`);
    }
  }

  /**
   * Check allowance for ERC20 token
   * @param {string} owner - Token owner address
   * @param {string} tokenAddress - Token address
   * @param {string} spender - Spender address
   * @returns {Promise<string>} - Allowance amount
   */
  async checkAllowance(owner, tokenAddress, spender) {
    try {
      if (!ethers.utils.isAddress(owner) || 
          !ethers.utils.isAddress(tokenAddress) || 
          !ethers.utils.isAddress(spender)) {
        throw new BlockchainError('Invalid address');
      }
      
      const erc20Abi = ['function allowance(address,address) view returns (uint256)'];
      const tokenContract = new ethers.Contract(tokenAddress, erc20Abi, this.providers.evm);
      
      const allowance = await tokenContract.allowance(owner, spender);
      return allowance.toString();
    } catch (error) {
      logger.error(`Error checking allowance for ${owner}: ${error.message}`);
      throw new BlockchainError(`Failed to check allowance: ${error.message}`);
    }
  }

  /**
   * Get asset metadata
   * @param {string} assetAddress - Asset address
   * @returns {Promise<Object>} - Asset metadata
   */
  async getAssetMetadata(assetAddress) {
    try {
      if (!ethers.utils.isAddress(assetAddress)) {
        throw new BlockchainError('Invalid asset address');
      }
      
      // Return native token metadata
      if (assetAddress === ethers.constants.AddressZero) {
        return {
          address: ethers.constants.AddressZero,
          name: 'IOTA',
          symbol: 'IOTA',
          decimals: 18
        };
      }
      
      // Check cache
      const cacheKey = `${CACHE_KEYS.ASSET_METADATA}:${assetAddress}`;
      const cachedMetadata = cache.get(cacheKey);
      
      if (cachedMetadata) {
        logger.debug(`Returning cached metadata for ${assetAddress}`);
        return cachedMetadata;
      }
      
      // Fetch ERC20 token metadata
      const erc20Abi = [
        'function name() view returns (string)',
        'function symbol() view returns (string)',
        'function decimals() view returns (uint8)'
      ];
      
      const tokenContract = new ethers.Contract(assetAddress, erc20Abi, this.providers.evm);
      
      // Fetch token metadata in parallel
      const [name, symbol, decimals] = await Promise.all([
        tokenContract.name(),
        tokenContract.symbol(),
        tokenContract.decimals()
      ]);
      
      const metadata = {
        address: assetAddress,
        name,
        symbol,
        decimals
      };
      
      // Cache results
      cache.set(cacheKey, metadata, 86400); // Cache for 24 hours
      
      return metadata;
    } catch (error) {
      logger.error(`Error getting asset metadata for ${assetAddress}: ${error.message}`);
      throw new BlockchainError(`Failed to get asset metadata: ${error.message}`);
    }
  }

  /**
   * Get transaction counts from IOTA L1 for bridge messages
   * @param {string} address - Address to check
   * @returns {Promise<Object>} - Transaction counts
   */
  async getIOTATransactionCounts(address) {
    try {
      // Convert Ethereum address to IOTA address format
      // This is simplified and would need proper conversion in a real implementation
      
      // Make API call to IOTA node
      const response = await axios.get(
        `${config.blockchain.iota.nodeUrl}/api/v1/addresses/${address}/outputs`,
        { timeout: 10000 }
      );
      
      if (!response.data) {
        throw new BlockchainError('Failed to get IOTA transactions: Empty response');
      }
      
      return {
        outputCount: response.data.count || 0,
        data: response.data.outputs || []
      };
    } catch (error) {
      logger.error(`Error getting IOTA transactions for ${address}: ${error.message}`);
      throw new BlockchainError(`Failed to get IOTA transactions: ${error.message}`);
    }
  }

  /**
   * Listen for events from a contract
   * @param {string} contractName - Name of the contract to listen to
   * @param {string} eventName - Name of the event to listen for
   * @param {Function} callback - Callback function to handle events
   * @returns {ethers.Contract} - Contract instance
   */
  listenForEvents(contractName, eventName, callback) {
    try {
      const contract = this.getContract(contractName);
      
      // Use websocket provider if available
      const wsContract = this.providers.evmWs
        ? new ethers.Contract(contract.address, contract.interface, this.providers.evmWs)
        : contract;
      
      wsContract.on(eventName, (...args) => {
        logger.debug(`Received ${eventName} event from ${contractName}`);
        callback(...args);
      });
      
      return wsContract;
    } catch (error) {
      logger.error(`Error setting up event listener for ${contractName}.${eventName}: ${error.message}`);
      throw new BlockchainError(`Failed to set up event listener: ${error.message}`);
    }
  }

  /**
   * Submit a transaction to the EVM layer
   * @param {Object} transaction - Transaction object
   * @param {string} privateKey - Private key to sign the transaction
   * @returns {Promise<Object>} - Transaction receipt
   */
  async submitTransaction(transaction, privateKey) {
    try {
      // Create wallet from private key
      const wallet = new ethers.Wallet(privateKey, this.providers.evm);
      
      // Sign and send transaction
      const tx = await wallet.sendTransaction(transaction);
      
      // Wait for confirmation
      const receipt = await tx.wait(config.blockchain.bridge.confirmationBlocks);
      
      return {
        transactionHash: receipt.transactionHash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        status: receipt.status
      };
    } catch (error) {
      logger.error(`Error submitting transaction: ${error.message}`);
      throw new BlockchainError(`Failed to submit transaction: ${error.message}`);
    }
  }

  /**
   * Initialize contract instances
   * @private
   */
  _initializeContracts() {
    // Load contract ABIs
    const lendingPoolAbi = require('../abis/LendingPool.json');
    const addressesProviderAbi = require('../abis/LendingPoolAddressesProvider.json');
    const dataProviderAbi = require('../abis/LendingPoolDataProvider.json');
    const priceOracleAbi = require('../abis/PriceOracle.json');
    const riskAssessmentOracleAbi = require('../abis/RiskAssessmentOracle.json');
    const bridgeAbi = require('../abis/CrossLayerBridge.json');
    
    // Create contract instances
    this.contracts.lendingPool = new ethers.Contract(
      config.contracts.lendingPool,
      lendingPoolAbi,
      this.providers.evm
    );
    
    this.contracts.addressesProvider = new ethers.Contract(
      config.contracts.addressesProvider,
      addressesProviderAbi,
      this.providers.evm
    );
    
    this.contracts.dataProvider = new ethers.Contract(
      config.contracts.dataProvider,
      dataProviderAbi,
      this.providers.evm
    );
    
    this.contracts.priceOracle = new ethers.Contract(
      config.contracts.priceOracle,
      priceOracleAbi,
      this.providers.evm
    );
    
    this.contracts.riskAssessmentOracle = new ethers.Contract(
      config.contracts.riskAssessmentOracle,
      riskAssessmentOracleAbi,
      this.providers.evm
    );
    
    this.contracts.bridge = new ethers.Contract(
      config.blockchain.bridge.address,
      bridgeAbi,
      this.providers.evm
    );
  }
}

module.exports = {
  BlockchainDataService
};
