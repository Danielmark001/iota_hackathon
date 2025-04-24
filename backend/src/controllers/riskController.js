/**
 * Risk Controller
 * 
 * Handles all risk assessment and management operations for the IntelliLend platform
 */

const { ethers } = require('ethers');
const riskAssessmentService = require('../services/riskAssessmentService');
const { handleError } = require('../utils/errorHandler');
const logger = require('../utils/logger');

/**
 * Predict risk score for a user
 */
exports.predictRiskScore = async (req, res) => {
  try {
    const { address } = req.params;
    
    if (!address || !address.match(/^0x[a-fA-F0-9]{40}$/)) {
      return res.status(400).json({ error: 'Invalid address format' });
    }
    
    logger.info(`Predicting risk score for ${address}`);
    
    const prediction = await riskAssessmentService.predictRiskScore(address);
    res.json(prediction);
  } catch (error) {
    logger.error(`Error in predictRiskScore: ${error.message}`);
    return handleError(res, error);
  }
};

/**
 * Update risk score on-chain
 */
exports.updateRiskScore = async (req, res) => {
  try {
    const { address } = req.params;
    const { riskScore, metrics } = req.body;
    
    if (!address || !address.match(/^0x[a-fA-F0-9]{40}$/)) {
      return res.status(400).json({ error: 'Invalid address format' });
    }
    
    if (riskScore === undefined || isNaN(parseInt(riskScore)) || parseInt(riskScore) < 0 || parseInt(riskScore) > 100) {
      return res.status(400).json({ error: 'Invalid risk score' });
    }
    
    logger.info(`Updating risk score for ${address}`);
    
    const result = await riskAssessmentService.updateRiskScoreOnChain(address, parseInt(riskScore), metrics);
    res.json(result);
  } catch (error) {
    logger.error(`Error in updateRiskScore: ${error.message}`);
    return handleError(res, error);
  }
};

/**
 * Get current risk metrics for a user
 */
exports.getCurrentRiskMetrics = async (req, res) => {
  try {
    const { address } = req.params;
    
    if (!address || !address.match(/^0x[a-fA-F0-9]{40}$/)) {
      return res.status(400).json({ error: 'Invalid address format' });
    }
    
    logger.info(`Getting current risk metrics for ${address}`);
    
    const metrics = await riskAssessmentService.getCurrentRiskMetrics(address);
    res.json(metrics);
  } catch (error) {
    logger.error(`Error in getCurrentRiskMetrics: ${error.message}`);
    return handleError(res, error);
  }
};

/**
 * Analyze user's on-chain activity
 */
exports.analyzeUserActivity = async (req, res) => {
  try {
    const { address } = req.params;
    
    if (!address || !address.match(/^0x[a-fA-F0-9]{40}$/)) {
      return res.status(400).json({ error: 'Invalid address format' });
    }
    
    logger.info(`Analyzing on-chain activity for ${address}`);
    
    const analysis = await riskAssessmentService.analyzeUserActivity(address);
    res.json(analysis);
  } catch (error) {
    logger.error(`Error in analyzeUserActivity: ${error.message}`);
    return handleError(res, error);
  }
};

/**
 * Get risk improvement recommendations
 */
exports.getRecommendations = async (req, res) => {
  try {
    const { address } = req.params;
    
    if (!address || !address.match(/^0x[a-fA-F0-9]{40}$/)) {
      return res.status(400).json({ error: 'Invalid address format' });
    }
    
    logger.info(`Getting recommendations for ${address}`);
    
    const recommendations = await riskAssessmentService.getRecommendations(address);
    res.json({
      address,
      recommendations
    });
  } catch (error) {
    logger.error(`Error in getRecommendations: ${error.message}`);
    return handleError(res, error);
  }
};

/**
 * Get risk score history for a user
 */
exports.getRiskHistory = async (req, res) => {
  try {
    const { address } = req.params;
    const { days = 30 } = req.query;
    
    if (!address || !address.match(/^0x[a-fA-F0-9]{40}$/)) {
      return res.status(400).json({ error: 'Invalid address format' });
    }
    
    logger.info(`Getting risk history for address: ${address}`);
    
    // For a real implementation, we would fetch historical risk scores from a database
    // For this demo, we'll generate mock data
    const history = generateMockRiskHistory(address, parseInt(days));
    
    // Return risk history
    return res.status(200).json({
      success: true,
      data: {
        address,
        history
      }
    });
  } catch (error) {
    logger.error(`Error in getRiskHistory: ${error.message}`);
    return handleError(res, error);
  }
};

/**
 * Batch predict risk scores for multiple users
 */
exports.batchPredictRiskScores = async (req, res) => {
  try {
    const { addresses } = req.body;
    
    if (!addresses || !Array.isArray(addresses) || addresses.length === 0) {
      return res.status(400).json({ error: 'Invalid addresses array' });
    }
    
    // Validate addresses
    const invalidAddresses = addresses.filter(addr => !ethers.utils.isAddress(addr));
    if (invalidAddresses.length > 0) {
      return res.status(400).json({
        error: 'Invalid addresses in the array',
        invalidAddresses
      });
    }
    
    logger.info(`Batch predicting risk scores for ${addresses.length} addresses`);
    
    // Create promises for each prediction
    const predictionPromises = addresses.map(address => 
      riskAssessmentService.predictRiskScore(address)
        .catch(error => {
          logger.error(`Error predicting risk for ${address}: ${error.message}`);
          return { address, error: error.message };
        })
    );
    
    // Wait for all predictions to complete
    const results = await Promise.all(predictionPromises);
    
    res.json({
      batchSize: addresses.length,
      results
    });
  } catch (error) {
    logger.error(`Error in batchPredictRiskScores: ${error.message}`);
    return handleError(res, error);
  }
};

/**
 * Generate mock risk history data for demonstration
 * @param {string} address - User address
 * @param {number} days - Number of days of history
 * @returns {Array} - Array of risk history data points
 */
function generateMockRiskHistory(address, days) {
  const history = [];
  const now = new Date();
  
  // Generate a seed based on the address
  const seed = parseInt(address.slice(2, 10), 16);
  
  // Starting risk score (between 30 and 70)
  let riskScore = 30 + (seed % 40);
  
  for (let i = days; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    
    // Add some random variation to the risk score (-3 to +3)
    const variation = ((seed * i) % 7) - 3;
    riskScore = Math.max(0, Math.min(100, riskScore + variation));
    
    history.push({
      date: date.toISOString().split('T')[0],
      riskScore: Math.round(riskScore),
      riskClass: getRiskClassFromScore(riskScore)
    });
  }
  
  return history;
}

/**
 * Get risk class from risk score
 * @param {number} score - Risk score
 * @returns {string} - Risk class
 */
function getRiskClassFromScore(score) {
  if (score < 20) return 'Very Low Risk';
  if (score < 40) return 'Low Risk';
  if (score < 60) return 'Medium Risk';
  if (score < 80) return 'High Risk';
  return 'Very High Risk';
}
