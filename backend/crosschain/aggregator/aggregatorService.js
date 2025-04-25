/**
 * Cross-Layer Aggregation Service for IntelliLend
 * 
 * This service provides enhanced functionality between IOTA L1 (Move) and L2 (EVM).
 * It combines data from both layers, creates unified transaction views, and 
 * enables cross-layer collateral management and atomic swaps.
 */

const { ethers } = require('ethers');
const { submitBlock, getAddressTransactions } = require('../../../iota-sdk/client');
const { sendTokens } = require('../../../iota-sdk/wallet');
const logger = require('../../../iota-sdk/utils/logger');

// Load contract ABIs
const CrossLayerBridgeABI = require('../../../abis/CrossLayerBridge.json');
const MoveBridgeProxyABI = require('../../../abis/MoveBridgeProxy.json');

class AggregatorService {
  /**
   * Initialize the cross-layer aggregation service
   * @param {Object} config - Configuration options
   * @param {string} config.provider - Ethereum provider URL
   * @param {string} config.crossLayerBridgeAddress - Address of the CrossLayerBridge contract
   * @param {string} config.moveBridgeProxyAddress - Address of the MoveBridgeProxy contract
   * @param {Object} iotaClient - IOTA client instance
   * @param {Object} iotaAccount - IOTA account instance
   */
  constructor(config, iotaClient, iotaAccount) {
    this.config = config;
    this.iotaClient = iotaClient;
    this.iotaAccount = iotaAccount;
    
    // Set up provider
    this.provider = new ethers.providers.JsonRpcProvider(config.provider);
    
    // Initialize contract interfaces
    if (config.crossLayerBridgeAddress) {
      this.crossLayerBridge = new ethers.Contract(
        config.crossLayerBridgeAddress,
        CrossLayerBridgeABI,
        this.provider
      );
    } else {
      logger.warn('CrossLayerBridge address not provided - EVM bridge functionality will be disabled');
    }
    
    if (config.moveBridgeProxyAddress) {
      this.moveBridgeProxy = new ethers.Contract(
        config.moveBridgeProxyAddress,
        MoveBridgeProxyABI,
        this.provider
      );
    } else {
      logger.warn('MoveBridgeProxy address not provided - Move bridge functionality will be disabled');
    }
    
    // Initialize mapping between EVM addresses and IOTA addresses
    this.addressMappings = new Map();
    
    // Initialize transaction cache
    this.transactionCache = new Map();
    
    logger.info('Cross-Layer Aggregation service initialized');
  }
  
  /**
   * Set wallet for transaction signing
   * @param {string} privateKey - Private key for the signing wallet
   */
  setWallet(privateKey) {
    this.wallet = new ethers.Wallet(privateKey, this.provider);
    
    // Connect contracts
    if (this.crossLayerBridge) {
      this.crossLayerBridge = this.crossLayerBridge.connect(this.wallet);
    }
    
    if (this.moveBridgeProxy) {
      this.moveBridgeProxy = this.moveBridgeProxy.connect(this.wallet);
    }
    
    logger.info('Wallet connected to aggregator service');
  }
  
  /**
   * Register an address mapping between EVM and IOTA
   * @param {string} evmAddress - Ethereum address
   * @param {string} iotaAddress - IOTA address
   * @returns {Promise<Object>} Registration result
   */
  async registerAddressMapping(evmAddress, iotaAddress) {
    try {
      logger.info(`Registering address mapping: ${evmAddress} <-> ${iotaAddress}`);
      
      // Validate addresses
      if (!ethers.utils.isAddress(evmAddress)) {
        throw new Error(`Invalid EVM address: ${evmAddress}`);
      }
      
      if (!iotaAddress.startsWith('smr1') && !iotaAddress.startsWith('rms1')) {
        throw new Error(`Invalid IOTA address: ${iotaAddress}`);
      }
      
      // Store mapping
      this.addressMappings.set(evmAddress.toLowerCase(), iotaAddress);
      this.addressMappings.set(iotaAddress, evmAddress.toLowerCase());
      
      // Record mapping on Tangle
      const result = await this.recordToTangle('ADDRESS_MAPPING', {
        evmAddress,
        iotaAddress,
        timestamp: new Date().toISOString()
      });
      
      logger.info(`Address mapping registered: ${evmAddress} <-> ${iotaAddress}`);
      
      return {
        evmAddress,
        iotaAddress,
        blockId: result.blockId
      };
    }
    catch (error) {
      logger.error(`Error registering address mapping: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Get the IOTA address for an EVM address
   * @param {string} evmAddress - Ethereum address
   * @returns {Promise<string>} IOTA address
   */
  async getIotaAddress(evmAddress) {
    try {
      // Check local mapping
      if (this.addressMappings.has(evmAddress.toLowerCase())) {
        return this.addressMappings.get(evmAddress.toLowerCase());
      }
      
      // Check on-chain mapping
      if (this.crossLayerBridge) {
        try {
          const iotaAddress = await this.crossLayerBridge.getIotaAddress(evmAddress);
          
          if (iotaAddress && iotaAddress !== '0x0000000000000000000000000000000000000000000000000000000000000000') {
            // Convert bytes32 to address string
            const addressString = ethers.utils.toUtf8String(iotaAddress).replace(/\0+$/, '');
            
            // Update local mapping
            this.addressMappings.set(evmAddress.toLowerCase(), addressString);
            this.addressMappings.set(addressString, evmAddress.toLowerCase());
            
            return addressString;
          }
        } catch (error) {
          logger.warn(`Error getting on-chain IOTA address: ${error.message}`);
        }
      }
      
      // Check Tangle records
      const mappings = await this.findAddressMappings();
      
      for (const mapping of mappings) {
        if (mapping.evmAddress.toLowerCase() === evmAddress.toLowerCase()) {
          // Update local mapping
          this.addressMappings.set(evmAddress.toLowerCase(), mapping.iotaAddress);
          this.addressMappings.set(mapping.iotaAddress, evmAddress.toLowerCase());
          
          return mapping.iotaAddress;
        }
      }
      
      return null;
    }
    catch (error) {
      logger.error(`Error getting IOTA address: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Get the EVM address for an IOTA address
   * @param {string} iotaAddress - IOTA address
   * @returns {Promise<string>} EVM address
   */
  async getEvmAddress(iotaAddress) {
    try {
      // Check local mapping
      if (this.addressMappings.has(iotaAddress)) {
        return this.addressMappings.get(iotaAddress);
      }
      
      // Check on-chain mapping
      if (this.crossLayerBridge) {
        try {
          const evmAddress = await this.crossLayerBridge.getEvmAddress(
            ethers.utils.formatBytes32String(iotaAddress)
          );
          
          if (evmAddress && evmAddress !== '0x0000000000000000000000000000000000000000') {
            // Update local mapping
            this.addressMappings.set(iotaAddress, evmAddress.toLowerCase());
            this.addressMappings.set(evmAddress.toLowerCase(), iotaAddress);
            
            return evmAddress;
          }
        } catch (error) {
          logger.warn(`Error getting on-chain EVM address: ${error.message}`);
        }
      }
      
      // Check Tangle records
      const mappings = await this.findAddressMappings();
      
      for (const mapping of mappings) {
        if (mapping.iotaAddress === iotaAddress) {
          // Update local mapping
          this.addressMappings.set(iotaAddress, mapping.evmAddress.toLowerCase());
          this.addressMappings.set(mapping.evmAddress.toLowerCase(), iotaAddress);
          
          return mapping.evmAddress;
        }
      }
      
      return null;
    }
    catch (error) {
      logger.error(`Error getting EVM address: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Find address mappings on the Tangle
   * @returns {Promise<Array>} Array of address mappings
   */
  async findAddressMappings() {
    try {
      // Get all transactions with the address mapping tag
      const tag = Buffer.from('ADDRESS_MAPPING').toString('hex');
      
      // Query for messages with this tag
      const messages = await getAddressTransactions(this.iotaClient, tag);
      
      // Filter and parse the messages
      const mappings = [];
      
      for (const message of messages) {
        try {
          const data = JSON.parse(Buffer.from(message.data, 'hex').toString());
          if (data.evmAddress && data.iotaAddress) {
            mappings.push({
              evmAddress: data.evmAddress,
              iotaAddress: data.iotaAddress,
              timestamp: data.timestamp,
              blockId: message.blockId
            });
          }
        } catch (error) {
          // Skip invalid messages
          continue;
        }
      }
      
      return mappings;
    }
    catch (error) {
      logger.error(`Error finding address mappings: ${error.message}`);
      return [];
    }
  }
  
  /**
   * Get unified transaction history for an address
   * @param {string} address - Address (EVM or IOTA)
   * @param {Object} options - Query options
   * @param {boolean} options.includeL1 - Include L1 transactions (default: true)
   * @param {boolean} options.includeL2 - Include L2 transactions (default: true)
   * @param {number} options.limit - Maximum number of transactions to return (default: 50)
   * @returns {Promise<Array>} Unified transaction history
   */
  async getUnifiedTransactionHistory(address, options = {}) {
    const {
      includeL1 = true,
      includeL2 = true,
      limit = 50
    } = options;
    
    try {
      logger.info(`Getting unified transaction history for ${address}`);
      
      // Determine if this is an EVM or IOTA address
      const isEvmAddress = ethers.utils.isAddress(address);
      
      // Initialize arrays for both L1 and L2 transactions
      let l1Transactions = [];
      let l2Transactions = [];
      
      // Get the corresponding address on the other layer
      let iotaAddress = isEvmAddress ? await this.getIotaAddress(address) : address;
      let evmAddress = isEvmAddress ? address : await this.getEvmAddress(address);
      
      // If we don't have both addresses, we can only query one layer
      if (!iotaAddress && !evmAddress) {
        throw new Error(`Could not determine both EVM and IOTA addresses for ${address}`);
      }
      
      if (!iotaAddress) {
        logger.warn(`No IOTA address found for ${address}, skipping L1 transactions`);
      }
      
      if (!evmAddress) {
        logger.warn(`No EVM address found for ${address}, skipping L2 transactions`);
      }
      
      // Get L1 transactions if requested and IOTA address is available
      if (includeL1 && iotaAddress && this.iotaAccount) {
        l1Transactions = await this.getL1Transactions(iotaAddress, limit);
      }
      
      // Get L2 transactions if requested and EVM address is available
      if (includeL2 && evmAddress) {
        l2Transactions = await this.getL2Transactions(evmAddress, limit);
      }
      
      // Combine and sort transactions
      const allTransactions = [
        ...l1Transactions.map(tx => ({ ...tx, layer: 'L1' })),
        ...l2Transactions.map(tx => ({ ...tx, layer: 'L2' }))
      ];
      
      // Sort by timestamp, newest first
      allTransactions.sort((a, b) => {
        return new Date(b.timestamp) - new Date(a.timestamp);
      });
      
      // Limit the number of transactions
      const limitedTransactions = allTransactions.slice(0, limit);
      
      logger.info(`Retrieved ${limitedTransactions.length} transactions for ${address} (${l1Transactions.length} L1, ${l2Transactions.length} L2)`);
      
      return limitedTransactions;
    }
    catch (error) {
      logger.error(`Error getting unified transaction history: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Get L1 (IOTA) transactions for an address
   * @param {string} iotaAddress - IOTA address
   * @param {number} limit - Maximum number of transactions to return
   * @returns {Promise<Array>} L1 transactions
   */
  async getL1Transactions(iotaAddress, limit = 50) {
    try {
      logger.info(`Getting L1 transactions for ${iotaAddress}`);
      
      // Check IOTA account availability
      if (!this.iotaAccount) {
        throw new Error('IOTA account not available');
      }
      
      // Use the IOTA SDK to get transactions
      const transactions = await this.iotaAccount.transactions({
        type: 0, // all transactions
        limit: limit,
        // Additional filters can be added here
      });
      
      // Filter for transactions involving this address
      const addressTransactions = transactions.filter(tx => {
        return tx.address === iotaAddress || tx.inputs.some(input => input.address === iotaAddress);
      });
      
      // Format transactions
      const formattedTransactions = addressTransactions.map(tx => {
        return {
          id: tx.transactionId,
          blockId: tx.blockId,
          hash: tx.transactionId,
          from: tx.inputs[0]?.address || 'Unknown',
          to: tx.address,
          amount: tx.amount,
          timestamp: new Date(tx.timestamp).toISOString(),
          type: tx.inputs.some(input => input.address === iotaAddress) ? 'send' : 'receive',
          status: tx.inclusionState === 'included' ? 'confirmed' : 'pending',
          layer: 'L1',
          explorerUrl: `https://explorer.iota.org/mainnet/message/${tx.blockId}`
        };
      });
      
      return formattedTransactions;
    }
    catch (error) {
      logger.error(`Error getting L1 transactions: ${error.message}`);
      return [];
    }
  }
  
  /**
   * Get L2 (EVM) transactions for an address
   * @param {string} evmAddress - EVM address
   * @param {number} limit - Maximum number of transactions to return
   * @returns {Promise<Array>} L2 transactions
   */
  async getL2Transactions(evmAddress, limit = 50) {
    try {
      logger.info(`Getting L2 transactions for ${evmAddress}`);
      
      // Get the current block number
      const currentBlock = await this.provider.getBlockNumber();
      
      // Get transaction history from ethers (last 1000 blocks or as configured)
      const history = await this.provider.getHistory(
        evmAddress,
        Math.max(0, currentBlock - 1000),
        currentBlock
      );
      
      // Limit the number of transactions
      const limitedHistory = history.slice(0, limit);
      
      // Get transaction details
      const transactionPromises = limitedHistory.map(async tx => {
        try {
          // Check cache first
          if (this.transactionCache.has(tx.hash)) {
            return this.transactionCache.get(tx.hash);
          }
          
          // Get transaction receipt
          const receipt = await this.provider.getTransactionReceipt(tx.hash);
          
          // Get block for timestamp
          const block = await this.provider.getBlock(receipt.blockNumber);
          
          // Format transaction
          const formattedTx = {
            id: tx.hash,
            hash: tx.hash,
            blockNumber: receipt.blockNumber,
            from: tx.from,
            to: tx.to,
            value: ethers.utils.formatEther(tx.value),
            timestamp: new Date(block.timestamp * 1000).toISOString(),
            gasUsed: receipt.gasUsed.toString(),
            status: receipt.status === 1 ? 'confirmed' : 'failed',
            layer: 'L2',
            explorerUrl: `https://explorer.shimmer.network/testnet/tx/${tx.hash}`
          };
          
          // Cache the transaction
          this.transactionCache.set(tx.hash, formattedTx);
          
          return formattedTx;
        } catch (error) {
          logger.error(`Error getting transaction details for ${tx.hash}: ${error.message}`);
          return null;
        }
      });
      
      // Wait for all promises to resolve
      const transactions = (await Promise.all(transactionPromises)).filter(tx => tx !== null);
      
      return transactions;
    }
    catch (error) {
      logger.error(`Error getting L2 transactions: ${error.message}`);
      return [];
    }
  }
  
  /**
   * Transfer assets across layers (L1 to L2 or L2 to L1)
   * @param {string} fromAddress - Source address
   * @param {string} toAddress - Destination address
   * @param {string} amount - Amount to transfer
   * @param {string} direction - Transfer direction ('L1toL2' or 'L2toL1')
   * @returns {Promise<Object>} Transfer result
   */
  async transferAcrossLayers(fromAddress, toAddress, amount, direction) {
    try {
      logger.info(`Transferring ${amount} from ${fromAddress} to ${toAddress} (${direction})`);
      
      if (direction !== 'L1toL2' && direction !== 'L2toL1') {
        throw new Error(`Invalid direction: ${direction}`);
      }
      
      if (direction === 'L1toL2') {
        // L1 to L2 transfer
        return await this.transferL1toL2(fromAddress, toAddress, amount);
      } else {
        // L2 to L1 transfer
        return await this.transferL2toL1(fromAddress, toAddress, amount);
      }
    }
    catch (error) {
      logger.error(`Error transferring across layers: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Transfer assets from L1 to L2
   * @param {string} fromAddress - Source IOTA address
   * @param {string} toAddress - Destination EVM address
   * @param {string} amount - Amount to transfer
   * @returns {Promise<Object>} Transfer result
   */
  async transferL1toL2(fromAddress, toAddress, amount) {
    try {
      logger.info(`Transferring ${amount} from L1 (${fromAddress}) to L2 (${toAddress})`);
      
      // Validate addresses
      if (!fromAddress.startsWith('smr1') && !fromAddress.startsWith('rms1')) {
        throw new Error(`Invalid IOTA address: ${fromAddress}`);
      }
      
      if (!ethers.utils.isAddress(toAddress)) {
        throw new Error(`Invalid EVM address: ${toAddress}`);
      }
      
      // Check if IOTA account is available
      if (!this.iotaAccount) {
        throw new Error('IOTA account not available');
      }
      
      // Check if bridge contracts are available
      if (!this.crossLayerBridge) {
        throw new Error('CrossLayerBridge contract not available');
      }
      
      // Check if L1 Move bridge address is set
      const moveBridgeAddress = await this.crossLayerBridge.getMoveBridgeAddress();
      
      if (!moveBridgeAddress || moveBridgeAddress === '0x0000000000000000000000000000000000000000000000000000000000000000') {
        throw new Error('Move bridge address not set');
      }
      
      // Convert bytes32 to address string
      const bridgeAddress = ethers.utils.toUtf8String(moveBridgeAddress).replace(/\0+$/, '');
      
      logger.info(`Using Move bridge address: ${bridgeAddress}`);
      
      // Create a deposit record on the Tangle
      const depositId = `deposit-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
      
      const depositRecord = {
        id: depositId,
        fromAddress,
        toAddress,
        amount,
        direction: 'L1toL2',
        status: 'pending',
        timestamp: new Date().toISOString()
      };
      
      await this.recordToTangle('CROSS_LAYER_DEPOSIT', depositRecord);
      
      // Send tokens to the bridge address
      const sendResult = await sendTokens(this.iotaAccount, amount, bridgeAddress, {
        tag: 'CROSS_LAYER_DEPOSIT',
        metadata: JSON.stringify({
          depositId,
          toAddress
        }),
        monitor: true
      });
      
      logger.info(`Tokens sent to bridge: ${sendResult.blockId}`);
      
      // Update deposit record with transaction hash
      depositRecord.status = 'processing';
      depositRecord.l1Transaction = sendResult.blockId;
      
      await this.recordToTangle('CROSS_LAYER_DEPOSIT_UPDATE', depositRecord);
      
      // Wait for the deposit to be processed
      // In a real implementation, this would be handled asynchronously
      // For this example, we'll initiate the process and return
      
      // Trigger the deposit on the L2 bridge
      const depositTx = await this.crossLayerBridge.receiveFromL1(
        ethers.utils.formatBytes32String(fromAddress),
        toAddress,
        ethers.utils.parseEther(amount),
        ethers.utils.formatBytes32String(depositId)
      );
      
      const receipt = await depositTx.wait();
      
      logger.info(`Deposit processed on L2: ${receipt.transactionHash}`);
      
      // Update deposit record with L2 transaction hash
      depositRecord.status = 'completed';
      depositRecord.l2Transaction = receipt.transactionHash;
      
      await this.recordToTangle('CROSS_LAYER_DEPOSIT_COMPLETE', depositRecord);
      
      return {
        success: true,
        depositId,
        fromAddress,
        toAddress,
        amount,
        direction: 'L1toL2',
        status: 'completed',
        l1Transaction: sendResult.blockId,
        l2Transaction: receipt.transactionHash,
        timestamp: new Date().toISOString()
      };
    }
    catch (error) {
      logger.error(`Error transferring from L1 to L2: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Transfer assets from L2 to L1
   * @param {string} fromAddress - Source EVM address
   * @param {string} toAddress - Destination IOTA address
   * @param {string} amount - Amount to transfer
   * @returns {Promise<Object>} Transfer result
   */
  async transferL2toL1(fromAddress, toAddress, amount) {
    try {
      logger.info(`Transferring ${amount} from L2 (${fromAddress}) to L1 (${toAddress})`);
      
      // Validate addresses
      if (!ethers.utils.isAddress(fromAddress)) {
        throw new Error(`Invalid EVM address: ${fromAddress}`);
      }
      
      if (!toAddress.startsWith('smr1') && !toAddress.startsWith('rms1')) {
        throw new Error(`Invalid IOTA address: ${toAddress}`);
      }
      
      // Check if wallet is available
      if (!this.wallet) {
        throw new Error('Wallet not available');
      }
      
      // Check if bridge contracts are available
      if (!this.crossLayerBridge) {
        throw new Error('CrossLayerBridge contract not available');
      }
      
      // Create a withdrawal record on the Tangle
      const withdrawalId = `withdrawal-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
      
      const withdrawalRecord = {
        id: withdrawalId,
        fromAddress,
        toAddress,
        amount,
        direction: 'L2toL1',
        status: 'pending',
        timestamp: new Date().toISOString()
      };
      
      await this.recordToTangle('CROSS_LAYER_WITHDRAWAL', withdrawalRecord);
      
      // Get the required fee
      const fee = await this.crossLayerBridge.getWithdrawalFee();
      
      // Send transaction to the bridge contract
      const withdrawalTx = await this.crossLayerBridge.withdrawToL1(
        ethers.utils.formatBytes32String(toAddress),
        ethers.utils.parseEther(amount),
        ethers.utils.formatBytes32String(withdrawalId),
        { value: fee }
      );
      
      const receipt = await withdrawalTx.wait();
      
      logger.info(`Withdrawal initiated on L2: ${receipt.transactionHash}`);
      
      // Update withdrawal record with L2 transaction hash
      withdrawalRecord.status = 'processing';
      withdrawalRecord.l2Transaction = receipt.transactionHash;
      
      await this.recordToTangle('CROSS_LAYER_WITHDRAWAL_UPDATE', withdrawalRecord);
      
      // In a real implementation, there would be a separate process to monitor
      // withdrawal events and trigger the L1 transaction
      // For this example, we'll return the initiated withdrawal
      
      return {
        success: true,
        withdrawalId,
        fromAddress,
        toAddress,
        amount,
        direction: 'L2toL1',
        status: 'processing',
        l2Transaction: receipt.transactionHash,
        timestamp: new Date().toISOString()
      };
    }
    catch (error) {
      logger.error(`Error transferring from L2 to L1: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Perform an atomic swap between L1 and L2 assets
   * @param {Object} swap - Swap details
   * @param {string} swap.l1Address - L1 address
   * @param {string} swap.l2Address - L2 address
   * @param {string} swap.l1Amount - L1 amount
   * @param {string} swap.l2Amount - L2 amount
   * @param {number} swap.timeoutMinutes - Timeout in minutes
   * @returns {Promise<Object>} Swap result
   */
  async performAtomicSwap(swap) {
    try {
      logger.info(`Performing atomic swap between ${swap.l1Address} and ${swap.l2Address}`);
      
      // Validate addresses
      if (!swap.l1Address.startsWith('smr1') && !swap.l1Address.startsWith('rms1')) {
        throw new Error(`Invalid IOTA address: ${swap.l1Address}`);
      }
      
      if (!ethers.utils.isAddress(swap.l2Address)) {
        throw new Error(`Invalid EVM address: ${swap.l2Address}`);
      }
      
      // Check if IOTA account and bridge contracts are available
      if (!this.iotaAccount) {
        throw new Error('IOTA account not available');
      }
      
      if (!this.crossLayerBridge) {
        throw new Error('CrossLayerBridge contract not available');
      }
      
      // Generate a unique swap ID
      const swapId = `swap-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
      
      // Calculate timeout
      const timeoutSeconds = (swap.timeoutMinutes || 60) * 60;
      const timeoutTimestamp = Math.floor(Date.now() / 1000) + timeoutSeconds;
      
      // Create swap record
      const swapRecord = {
        id: swapId,
        l1Address: swap.l1Address,
        l2Address: swap.l2Address,
        l1Amount: swap.l1Amount,
        l2Amount: swap.l2Amount,
        timeoutTimestamp,
        status: 'initiated',
        timestamp: new Date().toISOString()
      };
      
      // Record swap initiation on Tangle
      await this.recordToTangle('ATOMIC_SWAP_INITIATED', swapRecord);
      
      // Create hash lock for the swap
      const hashSecret = ethers.utils.randomBytes(32);
      const hashLock = ethers.utils.keccak256(hashSecret);
      
      logger.info(`Swap initiated with ID ${swapId} and hash lock ${hashLock}`);
      
      // Step 1: Create the L2 lock transaction
      const lockTx = await this.crossLayerBridge.createHashLockedSwap(
        ethers.utils.formatBytes32String(swap.l1Address),
        ethers.utils.parseEther(swap.l2Amount),
        hashLock,
        timeoutTimestamp,
        ethers.utils.formatBytes32String(swapId)
      );
      
      const lockReceipt = await lockTx.wait();
      
      logger.info(`L2 funds locked: ${lockReceipt.transactionHash}`);
      
      // Update swap record
      swapRecord.status = 'l2Locked';
      swapRecord.l2Transaction = lockReceipt.transactionHash;
      
      await this.recordToTangle('ATOMIC_SWAP_L2_LOCKED', swapRecord);
      
      // Step 2: Create the L1 lock transaction
      const metadata = {
        swapId,
        hashLock,
        timeoutTimestamp,
        l2Address: swap.l2Address
      };
      
      // Get the swap contract address on L1
      const swapContractAddress = this.config.l1SwapContractAddress;
      
      if (!swapContractAddress) {
        throw new Error('L1 swap contract address not set');
      }
      
      // Send tokens to the swap contract
      const l1LockResult = await sendTokens(this.iotaAccount, swap.l1Amount, swapContractAddress, {
        tag: 'ATOMIC_SWAP_LOCK',
        metadata: JSON.stringify(metadata),
        monitor: true
      });
      
      logger.info(`L1 funds locked: ${l1LockResult.blockId}`);
      
      // Update swap record
      swapRecord.status = 'locked';
      swapRecord.l1Transaction = l1LockResult.blockId;
      
      await this.recordToTangle('ATOMIC_SWAP_LOCKED', swapRecord);
      
      // Step 3: Claim both sides of the swap
      // In a real implementation, this would be a separate process
      
      // Claim the L2 side
      const claimL2Tx = await this.crossLayerBridge.claimHashLockedSwap(
        ethers.utils.formatBytes32String(swapId),
        ethers.utils.hexlify(hashSecret)
      );
      
      const claimL2Receipt = await claimL2Tx.wait();
      
      logger.info(`L2 funds claimed: ${claimL2Receipt.transactionHash}`);
      
      // Update swap record
      swapRecord.status = 'l2Claimed';
      swapRecord.l2ClaimTransaction = claimL2Receipt.transactionHash;
      
      await this.recordToTangle('ATOMIC_SWAP_L2_CLAIMED', swapRecord);
      
      // Claim the L1 side (simplified - in a real implementation this would interact with a Move contract)
      await this.recordToTangle('ATOMIC_SWAP_L1_CLAIM', {
        ...swapRecord,
        hashSecret: ethers.utils.hexlify(hashSecret)
      });
      
      // Update swap record
      swapRecord.status = 'completed';
      swapRecord.completedTimestamp = new Date().toISOString();
      
      await this.recordToTangle('ATOMIC_SWAP_COMPLETED', swapRecord);
      
      logger.info(`Atomic swap completed: ${swapId}`);
      
      return {
        success: true,
        swapId,
        l1Address: swap.l1Address,
        l2Address: swap.l2Address,
        l1Amount: swap.l1Amount,
        l2Amount: swap.l2Amount,
        status: 'completed',
        l1Transaction: l1LockResult.blockId,
        l2Transaction: lockReceipt.transactionHash,
        hashLock,
        timestamp: new Date().toISOString(),
        completedTimestamp: swapRecord.completedTimestamp
      };
    }
    catch (error) {
      logger.error(`Error performing atomic swap: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Get cross-layer collateral information for an address
   * @param {string} address - Address (EVM or IOTA)
   * @returns {Promise<Object>} Collateral information
   */
  async getCrossLayerCollateral(address) {
    try {
      logger.info(`Getting cross-layer collateral for ${address}`);
      
      // Determine if this is an EVM or IOTA address
      const isEvmAddress = ethers.utils.isAddress(address);
      
      // Get the corresponding address on the other layer
      let iotaAddress = isEvmAddress ? await this.getIotaAddress(address) : address;
      let evmAddress = isEvmAddress ? address : await this.getEvmAddress(address);
      
      // Get L1 collateral (if IOTA address is available)
      let l1Collateral = null;
      if (iotaAddress && this.iotaAccount) {
        try {
          // In a real implementation, this would interact with a Move contract
          // For this example, we'll use Tangle records
          l1Collateral = await this.getL1CollateralFromTangle(iotaAddress);
        } catch (error) {
          logger.error(`Error getting L1 collateral: ${error.message}`);
        }
      }
      
      // Get L2 collateral (if EVM address is available)
      let l2Collateral = null;
      if (evmAddress && this.crossLayerBridge) {
        try {
          const collateral = await this.crossLayerBridge.getCollateral(evmAddress);
          l2Collateral = {
            amount: ethers.utils.formatEther(collateral),
            assets: [{ symbol: 'SMR', amount: ethers.utils.formatEther(collateral) }]
          };
        } catch (error) {
          logger.error(`Error getting L2 collateral: ${error.message}`);
        }
      }
      
      // Combine collateral information
      return {
        address: {
          evm: evmAddress,
          iota: iotaAddress
        },
        l1: l1Collateral || { amount: '0', assets: [] },
        l2: l2Collateral || { amount: '0', assets: [] },
        total: {
          amount: (
            parseFloat(l1Collateral?.amount || '0') + 
            parseFloat(l2Collateral?.amount || '0')
          ).toString()
        },
        timestamp: new Date().toISOString()
      };
    }
    catch (error) {
      logger.error(`Error getting cross-layer collateral: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Get L1 collateral information from Tangle records
   * @param {string} iotaAddress - IOTA address
   * @returns {Promise<Object>} L1 collateral information
   */
  async getL1CollateralFromTangle(iotaAddress) {
    try {
      // Get all transactions with the collateral tag
      const tag = Buffer.from('L1_COLLATERAL').toString('hex');
      
      // Query for messages with this tag
      const messages = await getAddressTransactions(this.iotaClient, tag);
      
      // Filter and parse the messages
      const collateralRecords = [];
      
      for (const message of messages) {
        try {
          const data = JSON.parse(Buffer.from(message.data, 'hex').toString());
          if (data.iotaAddress === iotaAddress) {
            collateralRecords.push(data);
          }
        } catch (error) {
          // Skip invalid messages
          continue;
        }
      }
      
      // Sort by timestamp, newest first
      collateralRecords.sort((a, b) => {
        return new Date(b.timestamp) - new Date(a.timestamp);
      });
      
      // Get the latest record
      if (collateralRecords.length > 0) {
        const latest = collateralRecords[0];
        return {
          amount: latest.amount,
          assets: latest.assets || [{ symbol: 'SMR', amount: latest.amount }]
        };
      }
      
      // Default to zero if no records found
      return {
        amount: '0',
        assets: []
      };
    }
    catch (error) {
      logger.error(`Error getting L1 collateral from Tangle: ${error.message}`);
      return {
        amount: '0',
        assets: []
      };
    }
  }
  
  /**
   * Record data to the IOTA Tangle
   * @param {string} tag - Message tag
   * @param {Object} data - Data to record
   * @returns {Promise<Object>} Result of the operation
   */
  async recordToTangle(tag, data) {
    try {
      // Check if IOTA client is available
      if (!this.iotaClient) {
        throw new Error('IOTA client not available');
      }
      
      logger.debug(`Recording ${tag} to Tangle`);
      
      // Create block with data payload
      const blockData = {
        payload: {
          type: 1, // Tagged data
          tag: Buffer.from(tag).toString('hex'),
          data: Buffer.from(JSON.stringify(data)).toString('hex')
        }
      };
      
      // Submit to IOTA Tangle
      const result = await submitBlock(this.iotaClient, blockData);
      logger.debug(`Data recorded to Tangle with tag ${tag}: ${result.blockId}`);
      
      return result;
    }
    catch (error) {
      logger.error(`Error recording to Tangle: ${error.message}`);
      throw error;
    }
  }
}

module.exports = AggregatorService;