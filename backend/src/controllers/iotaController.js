/**
 * IOTA Controller
 * 
 * Handles API requests for IOTA-related operations.
 */

const logger = require('../utils/logger');
const iotaBlockchainService = require('../services/iotaBlockchainService');

/**
 * Generate a new IOTA address
 * @param {Object} req - Request object
 * @param {Object} res - Response object 
 */
exports.generateAddress = async (req, res) => {
  try {
    // Extract options from query params
    const network = req.query.network || process.env.IOTA_NETWORK || 'testnet';
    const options = {
      internal: req.query.internal === 'true',
      metadata: req.query.metadata || 'Generated by IntelliLend API'
    };
    
    // Generate address
    const result = await iotaBlockchainService.generateAddress(network, options);
    
    res.json(result);
  } catch (error) {
    logger.error(`Error generating IOTA address: ${error.message}`, { stack: error.stack });
    res.status(500).json({ error: 'Failed to generate address', message: error.message });
  }
};

/**
 * Get IOTA network information
 * @param {Object} req - Request object
 * @param {Object} res - Response object 
 */
exports.getNetworkInfo = async (req, res) => {
  try {
    const network = req.query.network || process.env.IOTA_NETWORK || 'testnet';
    
    // Get network info
    const result = await iotaBlockchainService.getNetworkInfo(network);
    
    res.json(result);
  } catch (error) {
    logger.error(`Error getting IOTA network info: ${error.message}`, { stack: error.stack });
    res.status(500).json({ error: 'Failed to get network information', message: error.message });
  }
};

/**
 * Get balance for an IOTA address
 * @param {Object} req - Request object
 * @param {Object} res - Response object 
 */
exports.getBalance = async (req, res) => {
  try {
    const { address } = req.params;
    const network = req.query.network || process.env.IOTA_NETWORK || 'testnet';
    
    if (!address) {
      return res.status(400).json({ error: 'Address is required' });
    }
    
    // Get balance
    const result = await iotaBlockchainService.getNativeBalance(network, address);
    
    res.json(result);
  } catch (error) {
    logger.error(`Error getting IOTA balance: ${error.message}`, { stack: error.stack });
    res.status(500).json({ error: 'Failed to get balance', message: error.message });
  }
};

/**
 * Send IOTA tokens
 * @param {Object} req - Request object
 * @param {Object} res - Response object 
 */
exports.sendTokens = async (req, res) => {
  try {
    const { address, amount, tag, metadata } = req.body;
    const network = req.body.network || process.env.IOTA_NETWORK || 'testnet';
    
    // Validate inputs
    if (!address) {
      return res.status(400).json({ error: 'Recipient address is required' });
    }
    
    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      return res.status(400).json({ error: 'Valid amount is required' });
    }
    
    // Send tokens
    const result = await iotaBlockchainService.sendNativeTokens(network, address, amount.toString(), {
      tag: tag || 'IntelliLend',
      metadata: metadata || 'Sent via IntelliLend API',
      monitor: true
    });
    
    res.json(result);
  } catch (error) {
    logger.error(`Error sending IOTA tokens: ${error.message}`, { stack: error.stack });
    res.status(500).json({ error: 'Failed to send tokens', message: error.message });
  }
};

/**
 * Check status of a transaction
 * @param {Object} req - Request object
 * @param {Object} res - Response object 
 */
exports.checkTransactionStatus = async (req, res) => {
  try {
    const { transactionId } = req.params;
    const network = req.query.network || process.env.IOTA_NETWORK || 'testnet';
    
    if (!transactionId) {
      return res.status(400).json({ error: 'Transaction ID is required' });
    }
    
    // Check status
    const result = await iotaBlockchainService.checkTransactionStatus(network, transactionId);
    
    res.json(result);
  } catch (error) {
    logger.error(`Error checking transaction status: ${error.message}`, { stack: error.stack });
    res.status(500).json({ error: 'Failed to check transaction status', message: error.message });
  }
};

/**
 * Get transactions for an address
 * @param {Object} req - Request object
 * @param {Object} res - Response object 
 */
exports.getTransactions = async (req, res) => {
  try {
    const { address } = req.params;
    const network = req.query.network || process.env.IOTA_NETWORK || 'testnet';
    const limit = parseInt(req.query.limit) || 10;
    
    if (!address) {
      return res.status(400).json({ error: 'Address is required' });
    }
    
    // Get transactions
    const transactions = await iotaBlockchainService.getAddressTransactions(address, network, limit);
    
    res.json({ transactions });
  } catch (error) {
    logger.error(`Error getting transactions: ${error.message}`, { stack: error.stack });
    res.status(500).json({ error: 'Failed to get transactions', message: error.message });
  }
};

/**
 * Submit data to Tangle
 * @param {Object} req - Request object
 * @param {Object} res - Response object 
 */
exports.submitData = async (req, res) => {
  try {
    const { data, tag } = req.body;
    const network = req.body.network || process.env.IOTA_NETWORK || 'testnet';
    
    if (!data) {
      return res.status(400).json({ error: 'Data is required' });
    }
    
    // Submit data
    const result = await iotaBlockchainService.sendTangleData(
      network,
      data,
      tag || 'IntelliLend',
      true
    );
    
    res.json(result);
  } catch (error) {
    logger.error(`Error submitting data to Tangle: ${error.message}`, { stack: error.stack });
    res.status(500).json({ error: 'Failed to submit data', message: error.message });
  }
};

/**
 * Get data from Tangle by tag
 * @param {Object} req - Request object
 * @param {Object} res - Response object 
 */
exports.getDataByTag = async (req, res) => {
  try {
    const { tag } = req.params;
    const network = req.query.network || process.env.IOTA_NETWORK || 'testnet';
    const limit = parseInt(req.query.limit) || 10;
    
    if (!tag) {
      return res.status(400).json({ error: 'Tag is required' });
    }
    
    // Get data
    const data = await iotaBlockchainService.getTangleDataByTag(network, tag, limit);
    
    res.json({ data });
  } catch (error) {
    logger.error(`Error getting data by tag: ${error.message}`, { stack: error.stack });
    res.status(500).json({ error: 'Failed to get data', message: error.message });
  }
};

/**
 * Submit batch of transactions
 * @param {Object} req - Request object
 * @param {Object} res - Response object 
 */
exports.submitBatch = async (req, res) => {
  try {
    const { transactions } = req.body;
    const network = req.body.network || process.env.IOTA_NETWORK || 'testnet';
    
    if (!transactions || !Array.isArray(transactions) || transactions.length === 0) {
      return res.status(400).json({ error: 'Valid transactions array is required' });
    }
    
    // Submit batch
    const results = await iotaBlockchainService.submitTransactionBatch(
      network,
      transactions
    );
    
    res.json({ results });
  } catch (error) {
    logger.error(`Error submitting batch: ${error.message}`, { stack: error.stack });
    res.status(500).json({ error: 'Failed to submit batch', message: error.message });
  }
};
