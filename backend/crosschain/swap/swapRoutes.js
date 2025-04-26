/**
 * Cross-Layer Swap Routes
 * 
 * Routes for handling asset transfers between IOTA L1 (Move) and L2 (EVM)
 */

const express = require('express');
const router = express.Router();
const { validateRequest } = require('../../middleware/validation');
const { cacheMiddleware } = require('../../middleware/cache');
const swapController = require('./swapController');

// Rate limiting for swap operations
const rateLimit = require('express-rate-limit');

const swapLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 requests per windowMs
  message: 'Too many swap requests from this IP, please try again later',
  standardHeaders: true,
  legacyHeaders: false
});

// Apply rate limiter to all routes
router.use(swapLimiter);

/**
 * @route POST /api/bridge/l1-to-l2
 * @description Initiate a transfer from IOTA L1 to L2
 * @access Public
 */
router.post('/l1-to-l2', 
  validateRequest(['fromAddress', 'amount']),
  swapController.initiateL1ToL2Transfer
);

/**
 * @route POST /api/bridge/l2-to-l1
 * @description Initiate a transfer from IOTA L2 to L1
 * @access Public
 */
router.post('/l2-to-l1', 
  validateRequest(['fromAddress', 'amount']),
  swapController.initiateL2ToL1Transfer
);

/**
 * @route GET /api/bridge/transfer/:transferId
 * @description Get the status of a transfer
 * @access Public
 */
router.get('/transfer/:transferId', 
  swapController.getTransferStatus
);

/**
 * @route GET /api/bridge/gas-estimates
 * @description Get estimated gas costs for transfers
 * @access Public
 */
router.get('/gas-estimates', 
  cacheMiddleware(60), // Cache for 1 minute
  swapController.getGasEstimates
);

/**
 * @route POST /api/bridge/complete/:transferId
 * @description Complete a transfer (simulated, for demo purposes)
 * @access Public
 */
router.post('/complete/:transferId', 
  swapController.completeTransfer
);

/**
 * @route GET /api/bridge/address/:address
 * @description Get all transfers for a specific address
 * @access Public
 */
router.get('/address/:address', 
  swapController.getAddressTransfers
);

module.exports = router;
