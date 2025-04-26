/**
 * IOTA Routes
 * 
 * API routes for IOTA-related operations.
 */

const express = require('express');
const router = express.Router();
const iotaController = require('../controllers/iotaController');
const { validateRequest } = require('../middleware/validation');

// GET /api/iota/address - Generate a new IOTA address
router.get('/address', iotaController.generateAddress);

// GET /api/iota/network - Get IOTA network information
router.get('/network', iotaController.getNetworkInfo);

// GET /api/iota/balance/:address - Get balance for an address
router.get('/balance/:address', iotaController.getBalance);

// POST /api/iota/send - Send IOTA tokens
router.post('/send', validateRequest(['address', 'amount']), iotaController.sendTokens);

// GET /api/iota/transaction/:transactionId/status - Check transaction status
router.get('/transaction/:transactionId/status', iotaController.checkTransactionStatus);

// GET /api/iota/transactions/:address - Get transactions for an address
router.get('/transactions/:address', iotaController.getTransactions);

// POST /api/iota/submit - Submit data to Tangle
router.post('/submit', validateRequest(['data']), iotaController.submitData);

// GET /api/iota/data/:tag - Get data from Tangle by tag
router.get('/data/:tag', iotaController.getDataByTag);

// POST /api/iota/batch - Submit batch of transactions
router.post('/batch', validateRequest(['transactions']), iotaController.submitBatch);

module.exports = router;
