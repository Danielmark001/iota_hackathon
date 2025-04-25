/**
 * Identity Controller
 * 
 * Handles identity verification and secure communication endpoints for the IntelliLend platform
 * using IOTA's identity framework and Streams protocol.
 */

const iotaIdentityService = require('../services/iotaIdentityService');
const iotaStreamsService = require('../services/iotaStreamsService');
const iotaBlockchainService = require('../services/iotaBlockchainService');
const logger = require('../utils/logger');

/**
 * Create a new decentralized identity for a user
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function createIdentity(req, res) {
  try {
    const { address } = req.params;
    const { name, email, phoneNumber } = req.body;
    
    logger.info(`Creating new DID for user ${address}`);
    
    // Create a new DID for the user
    const identity = await iotaIdentityService.createIdentity(address, {
      name,
      email,
      phoneNumber
    });
    
    // Return the result
    res.json({
      success: true,
      identity: {
        did: identity.did,
        address
      },
      credential: identity.credential
    });
  } catch (error) {
    logger.error(`Error creating identity for ${req.params.address}: ${error.message}`);
    
    res.status(500).json({
      success: false,
      error: 'Error creating identity',
      message: error.message
    });
  }
}

/**
 * Verify a user's identity using zero-knowledge proofs
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function verifyIdentity(req, res) {
  try {
    const { address } = req.params;
    const { zkProof } = req.body;
    
    logger.info(`Verifying identity for ${address} using ZK proof`);
    
    // Verify the identity using the ZK proof
    const verificationResult = await iotaIdentityService.verifyIdentityWithZKProof(
      address,
      zkProof
    );
    
    // Return the result
    res.json({
      success: true,
      verified: verificationResult.verified,
      lending: {
        eligible: verificationResult.eligible,
        recommendedTerms: verificationResult.recommendedTerms
      }
    });
  } catch (error) {
    logger.error(`Error verifying identity for ${req.params.address}: ${error.message}`);
    
    res.status(500).json({
      success: false,
      error: 'Error verifying identity',
      message: error.message
    });
  }
}

/**
 * Create a lending credential for a user
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function createLendingCredential(req, res) {
  try {
    const { address } = req.params;
    const { did, creditScore, incomeVerified, assetValue, loanAmount, loanTerm, interestRate } = req.body;
    
    logger.info(`Creating lending credential for ${address} with DID ${did}`);
    
    // Create a lending credential
    const credentialResult = await iotaIdentityService.createLendingCredential(did, {
      creditScore,
      incomeVerified,
      assetValue,
      loanAmount,
      loanTerm,
      interestRate
    });
    
    // Return the credential
    res.json({
      success: true,
      credential: credentialResult.credential,
      zkProof: credentialResult.zkProof,
      loanApproved: credentialResult.loanApproved,
      maxLoanAmount: credentialResult.maxLoanAmount,
      interestRate: credentialResult.interestRate
    });
  } catch (error) {
    logger.error(`Error creating lending credential for ${req.params.address}: ${error.message}`);
    
    res.status(500).json({
      success: false,
      error: 'Error creating lending credential',
      message: error.message
    });
  }
}

/**
 * Create a secure communication channel between lender and borrower
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function createSecureChannel(req, res) {
  try {
    const { lenderAddress, borrowerAddress } = req.body;
    const { channelType, metadata } = req.body;
    
    logger.info(`Creating secure channel between lender ${lenderAddress} and borrower ${borrowerAddress}`);
    
    // Create a secure channel
    const channelInfo = await iotaStreamsService.createChannel(
      lenderAddress,
      borrowerAddress,
      {
        channelType,
        metadata
      }
    );
    
    // Return the channel information
    res.json({
      success: true,
      channel: {
        channelId: channelInfo.channelId,
        type: channelInfo.type,
        created: channelInfo.created,
        participants: channelInfo.participants
      },
      encryptionKey: channelInfo.encryptionKey
    });
  } catch (error) {
    logger.error(`Error creating secure channel: ${error.message}`);
    
    res.status(500).json({
      success: false,
      error: 'Error creating secure channel',
      message: error.message
    });
  }
}

/**
 * Send a secure message in a channel
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function sendSecureMessage(req, res) {
  try {
    const { channelId } = req.params;
    const { sender, message, encryptionKey, attachments, urgent, messageType } = req.body;
    
    logger.info(`Sending secure message in channel ${channelId} from ${sender}`);
    
    // Send the message
    const messageResult = await iotaStreamsService.sendMessage(
      channelId,
      sender,
      message,
      {
        encryptionKey,
        urgent,
        messageType,
        attachments
      }
    );
    
    // Return the message receipt
    res.json({
      success: true,
      message: {
        messageId: messageResult.messageId,
        channelId: messageResult.channelId,
        sender: messageResult.sender,
        recipient: messageResult.recipient,
        timestamp: messageResult.timestamp,
        attachments: messageResult.attachments
      }
    });
  } catch (error) {
    logger.error(`Error sending secure message: ${error.message}`);
    
    res.status(500).json({
      success: false,
      error: 'Error sending secure message',
      message: error.message
    });
  }
}

/**
 * Get messages from a secure channel
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function getSecureMessages(req, res) {
  try {
    const { channelId } = req.params;
    const { address, limit, before, decryptionKey } = req.query;
    
    logger.info(`Getting messages from channel ${channelId} for ${address}`);
    
    // Get messages
    const messages = await iotaStreamsService.getMessages(
      channelId,
      address,
      {
        limit: limit ? parseInt(limit) : 50,
        before: before ? parseInt(before) : Date.now(),
        decryptionKey
      }
    );
    
    // Return the messages
    res.json({
      success: true,
      messages,
      count: messages.length
    });
  } catch (error) {
    logger.error(`Error getting secure messages: ${error.message}`);
    
    res.status(500).json({
      success: false,
      error: 'Error getting secure messages',
      message: error.message
    });
  }
}

/**
 * Get a secure document attachment
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function getSecureAttachment(req, res) {
  try {
    const { channelId, attachmentId } = req.params;
    const { address, decryptionKey } = req.query;
    
    logger.info(`Getting attachment ${attachmentId} from channel ${channelId} for ${address}`);
    
    // Get the attachment
    const attachment = await iotaStreamsService.getAttachment(
      channelId,
      attachmentId,
      address,
      {
        decryptionKey
      }
    );
    
    // Set content type and disposition headers
    res.setHeader('Content-Type', attachment.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${attachment.name}"`);
    
    // Send the file
    res.send(attachment.data);
  } catch (error) {
    logger.error(`Error getting secure attachment: ${error.message}`);
    
    res.status(500).json({
      success: false,
      error: 'Error getting secure attachment',
      message: error.message
    });
  }
}

/**
 * Create a cross-chain verification for a user
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function createCrossChainVerification(req, res) {
  try {
    const { address } = req.params;
    const { did, iotaAddress } = req.body;
    
    logger.info(`Creating cross-chain verification for ${address} with DID ${did}`);
    
    // Create a cross-chain verification
    const verificationResult = await iotaIdentityService.createCrossChainVerification(
      did,
      address,
      iotaAddress
    );
    
    // Return the result
    res.json({
      success: true,
      credential: verificationResult.credential,
      status: verificationResult.status,
      validUntil: verificationResult.validUntil
    });
  } catch (error) {
    logger.error(`Error creating cross-chain verification for ${req.params.address}: ${error.message}`);
    
    res.status(500).json({
      success: false,
      error: 'Error creating cross-chain verification',
      message: error.message
    });
  }
}

module.exports = {
  createIdentity,
  verifyIdentity,
  createLendingCredential,
  createSecureChannel,
  sendSecureMessage,
  getSecureMessages,
  getSecureAttachment,
  createCrossChainVerification
};
