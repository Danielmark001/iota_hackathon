/**
 * Identity Routes
 * 
 * API routes for identity verification and secure communication using IOTA
 */

const express = require('express');
const router = express.Router();
const identityController = require('../controllers/identityController');
const { authenticate } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validation');

/**
 * @route POST /api/identity/:address
 * @description Create a new decentralized identity for a user
 * @middleware authenticate
 * @validation name, email
 */
router.post(
  '/:address',
  authenticate,
  validateRequest(['name', 'email']),
  identityController.createIdentity
);

/**
 * @route POST /api/identity/:address/verify
 * @description Verify a user's identity using zero-knowledge proofs
 * @middleware authenticate
 * @validation zkProof
 */
router.post(
  '/:address/verify',
  authenticate,
  validateRequest(['zkProof']),
  identityController.verifyIdentity
);

/**
 * @route POST /api/identity/:address/lending-credential
 * @description Create a lending credential for a user
 * @middleware authenticate
 * @validation did, creditScore, assetValue, loanAmount
 */
router.post(
  '/:address/lending-credential',
  authenticate,
  validateRequest(['did', 'creditScore', 'assetValue', 'loanAmount']),
  identityController.createLendingCredential
);

/**
 * @route POST /api/identity/:address/cross-chain
 * @description Create a cross-chain verification for a user
 * @middleware authenticate
 * @validation did, iotaAddress
 */
router.post(
  '/:address/cross-chain',
  authenticate,
  validateRequest(['did', 'iotaAddress']),
  identityController.createCrossChainVerification
);

/**
 * Secure Channel Routes
 */

/**
 * @route POST /api/channels
 * @description Create a secure communication channel between lender and borrower
 * @middleware authenticate
 * @validation lenderAddress, borrowerAddress
 */
router.post(
  '/channels',
  authenticate,
  validateRequest(['lenderAddress', 'borrowerAddress']),
  identityController.createSecureChannel
);

/**
 * @route POST /api/channels/:channelId/messages
 * @description Send a secure message in a channel
 * @middleware authenticate
 * @validation sender, message
 */
router.post(
  '/channels/:channelId/messages',
  authenticate,
  validateRequest(['sender', 'message']),
  identityController.sendSecureMessage
);

/**
 * @route GET /api/channels/:channelId/messages
 * @description Get messages from a secure channel
 * @middleware authenticate
 * @query address, limit, before, decryptionKey
 */
router.get(
  '/channels/:channelId/messages',
  authenticate,
  identityController.getSecureMessages
);

/**
 * @route GET /api/channels/:channelId/attachments/:attachmentId
 * @description Get a secure document attachment
 * @middleware authenticate
 * @query address, decryptionKey
 */
router.get(
  '/channels/:channelId/attachments/:attachmentId',
  authenticate,
  identityController.getSecureAttachment
);

module.exports = router;
