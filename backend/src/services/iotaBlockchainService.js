/**
 * IOTA Blockchain Service
 * Handles interactions with the IOTA network and its EVM layer
 */

const { ClientBuilder } = require('@iota/client');
const { ethers } = require('ethers');
const config = require('../../config/iota-config');
const logger = require('../utils/logger');

class IOTABlockchainService {
  constructor() {
    this.initialize();
  }

  /**
   * Initialize connections to IOTA networks
   */
  async initialize() {
    try {
      // Initialize IOTA Layer 1 clients
      this.iotaClient = ClientBuilder.withNode(config.networks.iota.rpcUrl)
        .build();
      
      this.shimmerClient = ClientBuilder.withNode(config.networks.shimmer.rpcUrl)
        .build();
      
      // Initialize EVM providers
      this.iotaEvmProvider = new ethers.providers.JsonRpcProvider(
        config.networks.iota.evmRpcUrl
      );
      
      this.shimmerEvmProvider = new ethers.providers.JsonRpcProvider(
        config.networks.shimmer.evmRpcUrl
      );
      
      // Initialize signer with private key from environment variable
      if (process.env.PRIVATE_KEY) {
        this.iotaSigner = new ethers.Wallet(process.env.PRIVATE_KEY, this.iotaEvmProvider);
        this.shimmerSigner = new ethers.Wallet(process.env.PRIVATE_KEY, this.shimmerEvmProvider);
      } else {
        logger.warn('No private key provided. Contract interactions will be read-only.');
      }
      
      // Initialize contract instances
      this.initializeContracts();
      
      logger.info('IOTA Blockchain Service initialized successfully');
    } catch (error) {
      logger.error(`Error initializing IOTA Blockchain Service: ${error.message}`);
      throw error;
    }
  }

  /**
   * Initialize contract instances
   */
  initializeContracts() {
    // Check if signer is available
    if (!this.iotaSigner) return;
    
    try {
      // Initialize contracts on IOTA EVM
      this.contracts = {
        lendingPool: new ethers.Contract(
          config.contracts.lendingPool.address,
          require(config.contracts.lendingPool.abi),
          this.iotaSigner
        ),
        aiRiskAssessment: new ethers.Contract(
          config.contracts.aiRiskAssessment.address,
          require(config.contracts.aiRiskAssessment.abi),
          this.iotaSigner
        ),
        crossChainLiquidity: new ethers.Contract(
          config.contracts.crossChainLiquidity.address,
          require(config.contracts.crossChainLiquidity.abi),
          this.iotaSigner
        ),
        privacyPreservingIdentity: new ethers.Contract(
          config.contracts.privacyPreservingIdentity.address,
          require(config.contracts.privacyPreservingIdentity.abi),
          this.iotaSigner
        ),
        crossLayerBridge: new ethers.Contract(
          config.contracts.crossLayerBridge.address,
          require(config.contracts.crossLayerBridge.abi),
          this.iotaSigner
        )
      };
      
      // Initialize same contracts on Shimmer EVM
      this.shimmerContracts = {
        // Shimmer contracts would go here - they might have different addresses
      };
      
      logger.info('Contract instances initialized');
    } catch (error) {
      logger.error(`Error initializing contracts: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get information about the IOTA network
   * 
   * @param {string} network - Network name: 'iota', 'shimmer', or 'testnet'
   * @returns {Promise<Object>} - Network information
   */
  async getNetworkInfo(network = 'iota') {
    try {
      // Select appropriate client
      const client = network === 'shimmer' 
        ? this.shimmerClient 
        : network === 'testnet' 
          ? this.testnetClient 
          : this.iotaClient;
      
      if (!client) {
        throw new Error(`No client available for network: ${network}`);
      }
      
      // Get node info
      const info = await client.getNodeInfo();
      
      return {
        network,
        nodeUrl: config.networks[network].rpcUrl,
        nodeVersion: info.version,
        isHealthy: true,
        networkId: info.networkId,
        latestMilestoneIndex: info.latestMilestoneIndex,
        confirmedMilestoneIndex: info.confirmedMilestoneIndex,
        messagesSinceSnapshot: info.messageSinceSnapshot,
        messagesPerSecond: info.messagesPerSecond
      };
    } catch (error) {
      logger.error(`Error getting IOTA network info: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get EVM block information
   * 
   * @param {string} network - Network name: 'iota', 'shimmer', or 'testnet' 
   * @param {string|number} blockNumber - Block number or 'latest'
   * @returns {Promise<Object>} - Block information
   */
  async getBlock(network = 'iota', blockNumber = 'latest') {
    try {
      // Select appropriate provider
      const provider = network === 'shimmer' 
        ? this.shimmerEvmProvider 
        : network === 'testnet' 
          ? this.testnetEvmProvider 
          : this.iotaEvmProvider;
      
      if (!provider) {
        throw new Error(`No provider available for network: ${network}`);
      }
      
      // Get block information
      const block = await provider.getBlock(blockNumber);
      
      return {
        network,
        number: block.number,
        hash: block.hash,
        parentHash: block.parentHash,
        timestamp: new Date(block.timestamp * 1000).toISOString(),
        transactions: block.transactions.length,
        gasUsed: block.gasUsed.toString(),
        gasLimit: block.gasLimit.toString()
      };
    } catch (error) {
      logger.error(`Error getting block information: ${error.message}`);
      throw error;
    }
  }

  /**
   * Send a Layer 1 message to the IOTA Tangle
   * 
   * @param {string} network - Network name: 'iota', 'shimmer', or 'testnet'
   * @param {Object} messagePayload - Message payload
   * @returns {Promise<Object>} - Message submission result
   */
  async sendTangleMessage(network = 'iota', messagePayload) {
    try {
      // Select appropriate client
      const client = network === 'shimmer' 
        ? this.shimmerClient 
        : network === 'testnet' 
          ? this.testnetClient 
          : this.iotaClient;
      
      if (!client) {
        throw new Error(`No client available for network: ${network}`);
      }
      
      // Create message
      const messageId = await client.message()
        .withIndexation('IntelliLend', Buffer.from(JSON.stringify(messagePayload)))
        .submit();
      
      logger.info(`Message published to ${network} Tangle: ${messageId}`);
      
      return {
        messageId,
        network,
        timestamp: new Date().toISOString(),
        payload: messagePayload
      };
    } catch (error) {
      logger.error(`Error sending Tangle message: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get a message from the IOTA Tangle by message ID
   * 
   * @param {string} network - Network name: 'iota', 'shimmer', or 'testnet'
   * @param {string} messageId - Message ID
   * @returns {Promise<Object>} - Message data
   */
  async getTangleMessage(network = 'iota', messageId) {
    try {
      // Select appropriate client
      const client = network === 'shimmer' 
        ? this.shimmerClient 
        : network === 'testnet' 
          ? this.testnetClient 
          : this.iotaClient;
      
      if (!client) {
        throw new Error(`No client available for network: ${network}`);
      }
      
      // Get message data
      const messageData = await client.getMessage(messageId);
      
      // Extract indexation data if present
      let payload = null;
      if (messageData.payload && messageData.payload.type === 2) { // Indexation payload
        const indexationPayload = messageData.payload;
        const data = indexationPayload.data;
        if (data) {
          try {
            payload = JSON.parse(Buffer.from(data).toString());
          } catch (e) {
            payload = Buffer.from(data).toString();
          }
        }
      }
      
      return {
        messageId,
        network,
        timestamp: new Date().toISOString(),
        messageData,
        payload
      };
    } catch (error) {
      logger.error(`Error getting Tangle message: ${error.message}`);
      throw error;
    }
  }

  /**
   * Transfer tokens on IOTA EVM Layer
   * 
   * @param {string} network - Network name: 'iota', 'shimmer', or 'testnet'
   * @param {string} to - Recipient address
   * @param {string} amount - Amount in ETH format
   * @param {Object} options - Transaction options
   * @returns {Promise<Object>} - Transaction receipt
   */
  async transferEVM(network = 'iota', to, amount, options = {}) {
    try {
      // Select appropriate signer
      const signer = network === 'shimmer' 
        ? this.shimmerSigner 
        : network === 'testnet' 
          ? this.testnetSigner 
          : this.iotaSigner;
      
      if (!signer) {
        throw new Error(`No signer available for network: ${network}`);
      }
      
      // Create transaction
      const tx = await signer.sendTransaction({
        to,
        value: ethers.utils.parseEther(amount),
        gasLimit: options.gasLimit || config.gas.limit,
        gasPrice: options.gasPrice || config.gas.price
      });
      
      // Wait for transaction to be mined
      const receipt = await tx.wait();
      
      logger.info(`Transaction sent on ${network} EVM: ${receipt.transactionHash}`);
      
      return {
        hash: receipt.transactionHash,
        from: receipt.from,
        to: receipt.to,
        blockNumber: receipt.blockNumber,
        confirmations: receipt.confirmations,
        status: receipt.status === 1 ? 'confirmed' : 'failed',
        gasUsed: receipt.gasUsed.toString(),
        effectiveGasPrice: receipt.effectiveGasPrice.toString(),
        network
      };
    } catch (error) {
      logger.error(`Error transferring on EVM: ${error.message}`);
      throw error;
    }
  }

  /**
   * Call a contract method on the IOTA EVM
   * 
   * @param {string} network - Network name: 'iota', 'shimmer', or 'testnet'
   * @param {string} contractName - Contract name from config
   * @param {string} method - Method name
   * @param {Array} params - Method parameters
   * @param {Object} options - Transaction options
   * @returns {Promise<any>} - Method result or transaction receipt
   */
  async callContract(network = 'iota', contractName, method, params = [], options = {}) {
    try {
      // Select appropriate contract instance
      const contracts = network === 'shimmer' 
        ? this.shimmerContracts 
        : this.contracts;
      
      if (!contracts || !contracts[contractName]) {
        throw new Error(`Contract ${contractName} not available for network: ${network}`);
      }
      
      const contract = contracts[contractName];
      
      // Check if method exists
      if (typeof contract[method] !== 'function') {
        throw new Error(`Method ${method} does not exist on contract ${contractName}`);
      }
      
      // Determine if this is a read or write operation
      const methodAbi = contract.interface.functions[
        Object.keys(contract.interface.functions).find(
          f => contract.interface.functions[f].name === method
        )
      ];
      
      const isReadOperation = methodAbi.constant;
      
      if (isReadOperation) {
        // Call read method
        const result = await contract[method](...params);
        return result;
      } else {
        // Send transaction for write method
        const tx = await contract[method](...params, {
          gasLimit: options.gasLimit || config.gas.limit,
          gasPrice: options.gasPrice || config.gas.price,
          value: options.value ? ethers.utils.parseEther(options.value) : 0
        });
        
        // Wait for transaction to be mined
        const receipt = await tx.wait();
        
        logger.info(`Contract method ${method} called on ${network}: ${receipt.transactionHash}`);
        
        return {
          hash: receipt.transactionHash,
          from: receipt.from,
          to: receipt.to,
          blockNumber: receipt.blockNumber,
          confirmations: receipt.confirmations,
          status: receipt.status === 1 ? 'confirmed' : 'failed',
          gasUsed: receipt.gasUsed.toString(),
          network
        };
      }
    } catch (error) {
      logger.error(`Error calling contract method: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get balance of an address on IOTA EVM
   * 
   * @param {string} network - Network name: 'iota', 'shimmer', or 'testnet'
   * @param {string} address - Address to check
   * @returns {Promise<string>} - Balance in ETH format
   */
  async getBalance(network = 'iota', address) {
    try {
      // Select appropriate provider
      const provider = network === 'shimmer' 
        ? this.shimmerEvmProvider 
        : network === 'testnet' 
          ? this.testnetEvmProvider 
          : this.iotaEvmProvider;
      
      if (!provider) {
        throw new Error(`No provider available for network: ${network}`);
      }
      
      // Get balance
      const balance = await provider.getBalance(address);
      
      return ethers.utils.formatEther(balance);
    } catch (error) {
      logger.error(`Error getting balance: ${error.message}`);
      throw error;
    }
  }
}

module.exports = new IOTABlockchainService();
