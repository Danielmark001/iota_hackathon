/**
 * Risk Controller
 * 
 * Handles all risk assessment and management operations for the IntelliLend platform
 */

const { ethers } = require('ethers');
const RiskAssessmentService = require('../services/riskAssessmentService');
const LendingPoolService = require('../services/lendingPoolService');
const { handleError } = require('../utils/errorHandler');
const logger = require('../utils/logger');

class RiskController {
  constructor() {
    this.riskAssessmentService = new RiskAssessmentService();
    this.lendingPoolService = new LendingPoolService();
  }

  /**
   * Get risk assessment for a user
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async getRiskAssessment(req, res) {
    try {
      const { address } = req.params;
      
      if (!address || !ethers.utils.isAddress(address)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid address'
        });
      }
      
      logger.info(`Getting risk assessment for address: ${address}`);
      
      // Get risk assessment
      const riskAssessment = await this.riskAssessmentService.assessRisk(address);
      
      // Return risk assessment
      return res.status(200).json({
        success: true,
        data: riskAssessment,
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      logger.error(`Error in getRiskAssessment: ${error.message}`);
      return handleError(res, error);
    }
  }

  /**
   * Get detailed risk analysis for a user
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async getDetailedRiskAnalysis(req, res) {
    try {
      const { address } = req.params;
      
      if (!address || !ethers.utils.isAddress(address)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid address'
        });
      }
      
      logger.info(`Getting detailed risk analysis for address: ${address}`);
      
      // Get detailed risk analysis
      const riskAnalysis = await this.riskAssessmentService.getDetailedRiskAnalysis(address);
      
      // Return detailed risk analysis
      return res.status(200).json({
        success: true,
        data: riskAnalysis,
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      logger.error(`Error in getDetailedRiskAnalysis: ${error.message}`);
      return handleError(res, error);
    }
  }

  /**
   * Batch assess risk for multiple users
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async batchAssessRisk(req, res) {
    try {
      const { addresses } = req.body;
      
      if (!addresses || !Array.isArray(addresses) || addresses.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Invalid addresses array'
        });
      }
      
      // Validate addresses
      const invalidAddresses = addresses.filter(addr => !ethers.utils.isAddress(addr));
      if (invalidAddresses.length > 0) {
        return res.status(400).json({
          success: false,
          error: 'Invalid addresses in the array',
          invalidAddresses
        });
      }
      
      logger.info(`Batch assessing risk for ${addresses.length} addresses`);
      
      // Batch assess risk
      const batchResults = await this.riskAssessmentService.batchAssessRisk(addresses);
      
      // Return batch results
      return res.status(200).json({
        success: true,
        data: batchResults,
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      logger.error(`Error in batchAssessRisk: ${error.message}`);
      return handleError(res, error);
    }
  }

  /**
   * Get risk recommendations for a user
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async getRiskRecommendations(req, res) {
    try {
      const { address } = req.params;
      
      if (!address || !ethers.utils.isAddress(address)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid address'
        });
      }
      
      logger.info(`Getting risk recommendations for address: ${address}`);
      
      // Get risk assessment
      const riskAssessment = await this.riskAssessmentService.assessRisk(address);
      
      // Get lending positions
      const positions = await this.lendingPoolService.getUserPositions(address);
      
      // Generate recommendations based on risk assessment and positions
      const recommendations = this._generateRecommendations(riskAssessment, positions);
      
      // Return recommendations
      return res.status(200).json({
        success: true,
        data: {
          address,
          riskScore: riskAssessment.riskScore,
          riskClass: riskAssessment.riskClass,
          recommendations
        },
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      logger.error(`Error in getRiskRecommendations: ${error.message}`);
      return handleError(res, error);
    }
  }

  /**
   * Get risk score history for a user
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async getRiskHistory(req, res) {
    try {
      const { address } = req.params;
      const { days = 30 } = req.query;
      
      if (!address || !ethers.utils.isAddress(address)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid address'
        });
      }
      
      logger.info(`Getting risk history for address: ${address}`);
      
      // For a real implementation, we would fetch historical risk scores from a database
      // For this demo, we'll generate mock data
      const history = this._generateMockRiskHistory(address, parseInt(days));
      
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
  }

  /**
   * Generate recommendations based on risk assessment and positions
   * @param {Object} riskAssessment - Risk assessment data
   * @param {Object} positions - User's lending positions
   * @returns {Array} - Array of recommendation objects
   * @private
   */
  _generateRecommendations(riskAssessment, positions) {
    const recommendations = [];
    
    // Collateral recommendations
    if (positions.deposits.length > 0 && positions.borrows.length > 0) {
      const totalDeposits = positions.deposits.reduce((sum, deposit) => sum + parseFloat(deposit.amountUSD || 0), 0);
      const totalBorrows = positions.borrows.reduce((sum, borrow) => sum + parseFloat(borrow.amountUSD || 0), 0);
      
      const ltv = (totalBorrows / totalDeposits) * 100;
      
      if (ltv > 70) {
        recommendations.push({
          type: 'high_priority',
          action: 'Reduce your loan-to-value ratio',
          description: 'Your current LTV ratio is high which increases liquidation risk. Consider adding more collateral or repaying part of your loan.',
          impact: 'high'
        });
      } else if (ltv > 50) {
        recommendations.push({
          type: 'medium_priority',
          action: 'Consider adding more collateral',
          description: 'Adding more collateral would improve your position\'s health and reduce liquidation risk.',
          impact: 'medium'
        });
      }
      
      // Collateral diversification
      if (positions.deposits.length === 1 && positions.deposits[0].amountUSD > 1000) {
        recommendations.push({
          type: 'medium_priority',
          action: 'Diversify your collateral',
          description: 'Having all collateral in a single asset increases risk due to price volatility. Consider diversifying across multiple assets.',
          impact: 'medium'
        });
      }
    }
    
    // Risk score based recommendations
    if (riskAssessment.riskScore > 75) {
      recommendations.push({
        type: 'high_priority',
        action: 'Improve your risk score',
        description: 'Your risk score is high which may result in higher interest rates. Consider improving your repayment history and maintaining consistent wallet activity.',
        impact: 'high'
      });
    } else if (riskAssessment.riskScore > 50) {
      recommendations.push({
        type: 'medium_priority',
        action: 'Maintain consistent repayment behavior',
        description: 'Consistent and timely repayments will help improve your risk score over time.',
        impact: 'medium'
      });
    } else {
      recommendations.push({
        type: 'opportunity',
        action: 'You may qualify for better rates',
        description: 'Your excellent risk score may qualify you for better interest rates and higher borrowing limits.',
        impact: 'positive'
      });
    }
    
    // Add any recommendations from the risk assessment itself
    if (riskAssessment.recommendations && Array.isArray(riskAssessment.recommendations)) {
      riskAssessment.recommendations.forEach(rec => {
        recommendations.push({
          type: rec.impact === 'high' ? 'high_priority' : 
                rec.impact === 'medium' ? 'medium_priority' : 'low_priority',
          action: rec.action,
          description: rec.description || '',
          impact: rec.impact
        });
      });
    }
    
    // Return unique recommendations
    return Array.from(new Set(recommendations.map(r => JSON.stringify(r))))
      .map(r => JSON.parse(r));
  }

  /**
   * Generate mock risk history data for demonstration
   * @param {string} address - User address
   * @param {number} days - Number of days of history
   * @returns {Array} - Array of risk history data points
   * @private
   */
  _generateMockRiskHistory(address, days) {
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
        riskClass: this._getRiskClassFromScore(riskScore)
      });
    }
    
    return history;
  }

  /**
   * Get risk class from risk score
   * @param {number} score - Risk score
   * @returns {string} - Risk class
   * @private
   */
  _getRiskClassFromScore(score) {
    if (score < 20) return 'Very Low Risk';
    if (score < 40) return 'Low Risk';
    if (score < 60) return 'Medium Risk';
    if (score < 80) return 'High Risk';
    return 'Very High Risk';
  }
}

module.exports = new RiskController();
