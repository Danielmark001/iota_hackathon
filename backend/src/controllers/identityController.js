/**
 * Privacy-Preserving Identity Controller
 * Handles API endpoints for identity verification and credit scoring
 */

const identityService = require('../services/identityService');
const logger = require('../utils/logger');

/**
 * Check the status of a user's identity verification
 */
exports.checkIdentityStatus = async (req, res) => {
  try {
    const { address } = req.params;
    
    if (!address || !address.match(/^0x[a-fA-F0-9]{40}$/)) {
      return res.status(400).json({ error: 'Invalid address format' });
    }
    
    const status = await identityService.checkIdentityStatus(address);
    res.json(status);
  } catch (error) {
    logger.error(`Error in checkIdentityStatus: ${error.message}`);
    res.status(500).json({ error: 'Failed to check identity status', message: error.message });
  }
};

/**
 * Register a new identity
 */
exports.registerIdentity = async (req, res) => {
  try {
    const { address } = req.params;
    const userData = req.body;
    
    // Validate input
    if (!address || !address.match(/^0x[a-fA-F0-9]{40}$/)) {
      return res.status(400).json({ error: 'Invalid address format' });
    }
    
    // Check required fields
    const requiredFields = ['name', 'email', 'consentToDataUsage', 'consentToKYC'];
    for (const field of requiredFields) {
      if (userData[field] === undefined) {
        return res.status(400).json({ error: `Missing required field: ${field}` });
      }
    }
    
    const result = await identityService.registerIdentity(address, userData);
    res.json(result);
  } catch (error) {
    logger.error(`Error in registerIdentity: ${error.message}`);
    res.status(500).json({ error: 'Failed to register identity', message: error.message });
  }
};

/**
 * Generate a zero-knowledge proof for identity verification
 */
exports.generateZkProof = async (req, res) => {
  try {
    const { address } = req.params;
    const proofData = req.body;
    
    // Validate input
    if (!address || !address.match(/^0x[a-fA-F0-9]{40}$/)) {
      return res.status(400).json({ error: 'Invalid address format' });
    }
    
    // Check required fields
    const requiredFields = ['incomeLevel', 'creditHistory', 'repaymentHistory'];
    for (const field of requiredFields) {
      if (proofData[field] === undefined) {
        return res.status(400).json({ error: `Missing required field: ${field}` });
      }
    }
    
    const proof = await identityService.generateZkProof(address, proofData);
    res.json(proof);
  } catch (error) {
    logger.error(`Error in generateZkProof: ${error.message}`);
    res.status(500).json({ error: 'Failed to generate zero-knowledge proof', message: error.message });
  }
};

/**
 * Verify identity using zero-knowledge proof
 */
exports.verifyIdentity = async (req, res) => {
  try {
    const { address } = req.params;
    const verificationData = req.body;
    
    // Validate input
    if (!address || !address.match(/^0x[a-fA-F0-9]{40}$/)) {
      return res.status(400).json({ error: 'Invalid address format' });
    }
    
    // Check for proof
    if (!verificationData.proof) {
      return res.status(400).json({ error: 'Missing zero-knowledge proof' });
    }
    
    const result = await identityService.verifyIdentity(address, verificationData);
    res.json(result);
  } catch (error) {
    logger.error(`Error in verifyIdentity: ${error.message}`);
    res.status(500).json({ error: 'Failed to verify identity', message: error.message });
  }
};

/**
 * Get a user's credit profile
 */
exports.getCreditProfile = async (req, res) => {
  try {
    const { address } = req.params;
    
    if (!address || !address.match(/^0x[a-fA-F0-9]{40}$/)) {
      return res.status(400).json({ error: 'Invalid address format' });
    }
    
    const creditProfile = await identityService.getCreditProfile(address);
    res.json(creditProfile);
  } catch (error) {
    logger.error(`Error in getCreditProfile: ${error.message}`);
    res.status(500).json({ error: 'Failed to get credit profile', message: error.message });
  }
};
