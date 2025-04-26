/**
 * Cross-Layer Swap Controller
 * 
 * Handles the API endpoints for swapping assets between IOTA L1 (Move) and L2 (EVM).
 */

const { ethers } = require('ethers');
const crypto = require('crypto');
const logger = require('../../utils/logger');

// IOTA SDK imports
const { 
  createClient, 
  generateAddress, 
  submitBlock,
  monitorTransaction, 
  withExponentialBackoff
} = require('../../../iota-sdk/client');

const { 
  sendTokens,
  getBalance,
} = require('../../../iota-sdk/wallet');

// Temporary storage for transfer details (in a real app, use a database)
const pendingTransfers = new Map();

// Get active IOTA components from global scope (initialized in server.js)
const getIotaComponents = () => {
  return {
    client: global.iotaClient,
    nodeManager: global.iotaNodeManager,
    wallet: global.iotaWallet,
    account: global.iotaAccount,
    crossLayerAggregator: global.iotaCrossLayerAggregator
  };
};

/**
 * Generate a unique transfer ID
 * @returns {string} A unique transfer ID
 */
const generateTransferId = () => {
  return crypto.randomBytes(16).toString('hex');
};

/**
 * Initiate a transfer from L1 (IOTA) to L2 (EVM)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const initiateL1ToL2Transfer = async (req, res) => {
  try {
    const { fromAddress, toAddress, amount, timestamp } = req.body;
    
    // Validate inputs
    if (!fromAddress) {
      return res.status(400).json({ error: 'Source address (fromAddress) is required' });
    }
    
    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      return res.status(400).json({ error: 'Invalid amount. Must be a positive number.' });
    }
    
    // Get IOTA components
    const { client, account, crossLayerAggregator } = getIotaComponents();
    
    if (!client) {
      return res.status(503).json({ 
        error: 'IOTA client not initialized',
        details: 'IOTA services are currently unavailable. Please try again later.'
      });
    }
    
    logger.info(`Initiating L1 to L2 transfer: ${amount} SMR from ${fromAddress} to ${toAddress || 'same owner'}`);
    
    // Generate transfer ID
    const transferId = generateTransferId();
    
    // Generate bridge address (in production, this would be the actual bridge contract address)
    // For now, we'll use the platform address as the bridge
    const bridgeAddress = process.env.IOTA_PLATFORM_ADDRESS;
    
    if (!bridgeAddress) {
      return res.status(503).json({ 
        error: 'Bridge address not configured',
        details: 'The bridge address is not configured. Please check the server configuration.'
      });
    }
    
    // Store transfer details
    pendingTransfers.set(transferId, {
      id: transferId,
      type: 'L1ToL2',
      fromAddress,
      toAddress: toAddress || '', // If not provided, will transfer to same user on L2
      amount: parseFloat(amount),
      timestamp: timestamp || Date.now(),
      status: 'Pending',
      bridgeAddress
    });
    
    // In a real implementation, this would also:
    // 1. Register the transfer with the bridge contract
    // 2. Set up listeners for the incoming transaction
    
    // If cross-layer aggregator is available, register the transfer
    if (crossLayerAggregator) {
      try {
        await crossLayerAggregator.registerTransfer({
          transferId,
          fromAddress,
          toAddress: toAddress || '',
          amount: parseFloat(amount),
          direction: 'L1ToL2',
          timestamp: timestamp || Date.now()
        });
        logger.info(`Registered transfer ${transferId} with cross-layer aggregator`);
      } catch (error) {
        logger.error(`Error registering transfer with cross-layer aggregator: ${error.message}`);
        // Continue without registration - the transfer can still work
      }
    }
    
    // Return transfer details to the client
    res.json({
      success: true,
      transferId,
      bridgeAddress,
      amount: parseFloat(amount),
      fromAddress,
      toAddress: toAddress || '',
      timestamp: timestamp || Date.now(),
      status: 'Pending',
      direction: 'L1ToL2'
    });
  } catch (error) {
    logger.error(`Error initiating L1 to L2 transfer: ${error.message}`);
    res.status(500).json({ 
      error: 'Error initiating transfer', 
      message: error.message 
    });
  }
};

/**
 * Initiate a transfer from L2 (EVM) to L1 (IOTA)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const initiateL2ToL1Transfer = async (req, res) => {
  try {
    const { fromAddress, toAddress, amount, timestamp } = req.body;
    
    // Validate inputs
    if (!fromAddress) {
      return res.status(400).json({ error: 'Source address (fromAddress) is required' });
    }
    
    if (!ethers.utils.isAddress(fromAddress)) {
      return res.status(400).json({ error: 'Invalid source address format' });
    }
    
    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      return res.status(400).json({ error: 'Invalid amount. Must be a positive number.' });
    }
    
    // Get IOTA components
    const { client, crossLayerAggregator } = getIotaComponents();
    
    if (!client) {
      return res.status(503).json({ 
        error: 'IOTA client not initialized',
        details: 'IOTA services are currently unavailable. Please try again later.'
      });
    }
    
    logger.info(`Initiating L2 to L1 transfer: ${amount} SMR from ${fromAddress} to ${toAddress || 'same owner'}`);
    
    // Generate transfer ID
    const transferId = generateTransferId();
    
    // Generate calldata for the bridge contract
    // In a real implementation, this would be the actual calldata for the bridge contract
    const calldata = ethers.utils.defaultAbiCoder.encode(
      ['bytes32', 'address', 'uint256'],
      [
        ethers.utils.keccak256(ethers.utils.toUtf8Bytes(transferId)),
        toAddress ? ethers.utils.hexlify(ethers.utils.toUtf8Bytes(toAddress)) : ethers.constants.HashZero,
        ethers.utils.parseUnits(amount.toString(), 18)
      ]
    );
    
    // Get bridge contract address from the environment
    const bridgeAddress = process.env.ZK_BRIDGE_ADDRESS || process.env.BRIDGE_ADDRESS;
    
    if (!bridgeAddress) {
      return res.status(503).json({ 
        error: 'Bridge address not configured',
        details: 'The bridge address is not configured. Please check the server configuration.'
      });
    }
    
    // Store transfer details
    pendingTransfers.set(transferId, {
      id: transferId,
      type: 'L2ToL1',
      fromAddress,
      toAddress: toAddress || '', // If not provided, will transfer to same user on L1
      amount: parseFloat(amount),
      timestamp: timestamp || Date.now(),
      status: 'Pending',
      bridgeAddress
    });
    
    // In a real implementation, this would also:
    // 1. Register the transfer with the bridge contract
    // 2. Set up listeners for the incoming transaction
    
    // If cross-layer aggregator is available, register the transfer
    if (crossLayerAggregator) {
      try {
        await crossLayerAggregator.registerTransfer({
          transferId,
          fromAddress,
          toAddress: toAddress || '',
          amount: parseFloat(amount),
          direction: 'L2ToL1',
          timestamp: timestamp || Date.now()
        });
        logger.info(`Registered transfer ${transferId} with cross-layer aggregator`);
      } catch (error) {
        logger.error(`Error registering transfer with cross-layer aggregator: ${error.message}`);
        // Continue without registration - the transfer can still work
      }
    }
    
    // Return transfer details to the client
    res.json({
      success: true,
      transferId,
      bridgeAddress,
      calldata,
      amount: parseFloat(amount),
      fromAddress,
      toAddress: toAddress || '',
      timestamp: timestamp || Date.now(),
      status: 'Pending',
      direction: 'L2ToL1'
    });
  } catch (error) {
    logger.error(`Error initiating L2 to L1 transfer: ${error.message}`);
    res.status(500).json({ 
      error: 'Error initiating transfer', 
      message: error.message 
    });
  }
};

/**
 * Get the status of a transfer
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getTransferStatus = async (req, res) => {
  try {
    const { transferId } = req.params;
    
    // Check if transfer exists in memory
    if (!pendingTransfers.has(transferId)) {
      return res.status(404).json({ 
        error: 'Transfer not found',
        details: 'The specified transfer ID was not found.'
      });
    }
    
    const transfer = pendingTransfers.get(transferId);
    
    // Get IOTA components
    const { crossLayerAggregator } = getIotaComponents();
    
    // If cross-layer aggregator is available, get the latest status
    if (crossLayerAggregator) {
      try {
        const aggregatorStatus = await crossLayerAggregator.getTransferStatus(transferId);
        
        if (aggregatorStatus) {
          // Update the transfer status from the aggregator
          transfer.status = aggregatorStatus.status;
          transfer.confirmations = aggregatorStatus.confirmations;
          transfer.completedTimestamp = aggregatorStatus.completedTimestamp;
        }
      } catch (error) {
        logger.error(`Error getting transfer status from aggregator: ${error.message}`);
        // Continue with the stored status
      }
    }
    
    // Return the transfer status
    res.json({
      transferId,
      status: transfer.status,
      fromAddress: transfer.fromAddress,
      toAddress: transfer.toAddress,
      amount: transfer.amount,
      timestamp: transfer.timestamp,
      bridgeAddress: transfer.bridgeAddress,
      direction: transfer.type,
      confirmations: transfer.confirmations,
      completedTimestamp: transfer.completedTimestamp,
      lastChecked: Date.now()
    });
  } catch (error) {
    logger.error(`Error getting transfer status: ${error.message}`);
    res.status(500).json({ 
      error: 'Error getting transfer status', 
      message: error.message 
    });
  }
};

/**
 * Get estimated gas costs for transfers
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getGasEstimates = async (req, res) => {
  try {
    // In a real implementation, these would be calculated based on:
    // 1. Current network congestion
    // 2. Historical data
    // 3. Contract gas usage
    
    // For now, return static estimates
    res.json({
      l1ToL2Gas: 0.001, // SMR
      l2ToL1Gas: 0.005, // SMR
      l1NetworkCongestion: 'Low',
      l2NetworkCongestion: 'Medium',
      lastUpdated: Date.now()
    });
  } catch (error) {
    logger.error(`Error getting gas estimates: ${error.message}`);
    res.status(500).json({ 
      error: 'Error getting gas estimates', 
      message: error.message 
    });
  }
};

/**
 * Complete a transfer (simulated, for demo purposes)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const completeTransfer = async (req, res) => {
  try {
    const { transferId } = req.params;
    
    // Check if transfer exists in memory
    if (!pendingTransfers.has(transferId)) {
      return res.status(404).json({ 
        error: 'Transfer not found',
        details: 'The specified transfer ID was not found.'
      });
    }
    
    const transfer = pendingTransfers.get(transferId);
    
    // Update transfer status
    transfer.status = 'Processed';
    transfer.completedTimestamp = Date.now();
    pendingTransfers.set(transferId, transfer);
    
    // Get IOTA components
    const { crossLayerAggregator } = getIotaComponents();
    
    // If cross-layer aggregator is available, update the transfer status
    if (crossLayerAggregator) {
      try {
        await crossLayerAggregator.updateTransferStatus(transferId, 'Processed');
        logger.info(`Updated transfer ${transferId} status with cross-layer aggregator`);
      } catch (error) {
        logger.error(`Error updating transfer status with cross-layer aggregator: ${error.message}`);
      }
    }
    
    // Return updated transfer
    res.json({
      success: true,
      transferId,
      status: transfer.status,
      completedTimestamp: transfer.completedTimestamp,
      message: 'Transfer completed successfully'
    });
  } catch (error) {
    logger.error(`Error completing transfer: ${error.message}`);
    res.status(500).json({ 
      error: 'Error completing transfer', 
      message: error.message 
    });
  }
};

/**
 * Get all transfers for a specific address
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getAddressTransfers = async (req, res) => {
  try {
    const { address } = req.params;
    
    // Find all transfers for this address
    const transfers = Array.from(pendingTransfers.values())
      .filter(transfer => 
        transfer.fromAddress === address || 
        transfer.toAddress === address
      )
      .sort((a, b) => b.timestamp - a.timestamp);
    
    res.json({
      address,
      transfers,
      count: transfers.length,
      lastUpdated: Date.now()
    });
  } catch (error) {
    logger.error(`Error getting address transfers: ${error.message}`);
    res.status(500).json({ 
      error: 'Error getting address transfers', 
      message: error.message 
    });
  }
};

// Export controller functions
module.exports = {
  initiateL1ToL2Transfer,
  initiateL2ToL1Transfer,
  getTransferStatus,
  getGasEstimates,
  completeTransfer,
  getAddressTransfers
};
