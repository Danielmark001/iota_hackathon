/**
 * Risk Assessment Service
 * 
 * Handles risk assessment and scoring for the IntelliLend platform
 */

const axios = require('axios');
const { ethers } = require('ethers');
const config = require('../config');
const logger = require('../utils/logger');
const { BlockchainDataService } = require('./blockchainDataService');
const { cache, CACHE_KEYS } = require('../utils/cache');
const { ApiError } = require('../utils/errors');

class RiskAssessmentService {
  constructor() {
    this.blockchainDataService = new BlockchainDataService();
    this.riskApiBaseUrl = config.riskAssessmentApi.baseUrl;
    this.riskApiTimeout = config.riskAssessmentApi.timeout || 10000;
    this.cacheEnabled = config.riskAssessmentApi.cacheEnabled || true;
    this.cacheTtl = config.riskAssessmentApi.cacheTtl || 3600; // 1 hour
  }

  /**
   * Assesses the risk for a user and returns a risk score and profile
   * @param {string} address - User address
   * @returns {Promise<Object>} - Risk assessment result
   */
  async assessRisk(address) {
    try {
      // Normalize address
      const normalizedAddress = ethers.utils.getAddress(address);
      
      // Check cache if enabled
      if (this.cacheEnabled) {
        const cachedResult = cache.get(`${CACHE_KEYS.RISK_ASSESSMENT}:${normalizedAddress}`);
        if (cachedResult) {
          logger.debug(`Returning cached risk assessment for ${normalizedAddress}`);
          return cachedResult;
        }
      }
      
      logger.info(`Assessing risk for address ${normalizedAddress}`);
      
      // Make API call to the risk assessment service
      const response = await axios.post(
        `${this.riskApiBaseUrl}/predict`,
        { address: normalizedAddress },
        { timeout: this.riskApiTimeout }
      );
      
      if (!response.data) {
        throw new ApiError('Risk assessment service returned empty response', 500);
      }
      
      // Process the response and return risk assessment
      const riskAssessment = {
        address: normalizedAddress,
        riskScore: response.data.risk_score,
        riskClass: response.data.risk_class,
        riskFactors: this._processRiskFactors(response.data.risk_factors),
        recommendations: this._processRecommendations(response.data.recommendations),
        modelVersion: response.data.model_version,
        timestamp: response.data.timestamp || new Date().toISOString()
      };
      
      // Cache the result if enabled
      if (this.cacheEnabled) {
        cache.set(
          `${CACHE_KEYS.RISK_ASSESSMENT}:${normalizedAddress}`, 
          riskAssessment, 
          this.cacheTtl
        );
      }
      
      return riskAssessment;
    } catch (error) {
      logger.error(`Error assessing risk for ${address}: ${error.message}`);
      
      // Handle API errors
      if (error.response) {
        throw new ApiError(
          `Risk assessment service error: ${error.response.data.error || error.response.statusText}`,
          error.response.status
        );
      }
      
      // Handle other errors
      throw new ApiError(
        `Risk assessment error: ${error.message}`,
        500
      );
    }
  }

  /**
   * Gets a user's risk profile from cache or generates a new one
   * @param {string} address - User address
   * @returns {Promise<Object>} - User risk profile
   */
  async getUserRiskProfile(address) {
    try {
      // Normalize address
      const normalizedAddress = ethers.utils.getAddress(address);
      
      // Get full risk assessment
      const riskAssessment = await this.assessRisk(normalizedAddress);
      
      // Return just the risk profile part
      return {
        riskScore: riskAssessment.riskScore,
        riskClass: riskAssessment.riskClass,
        riskFactors: riskAssessment.riskFactors.map(factor => ({
          factor: factor.factor,
          score: factor.score,
          impact: factor.impact
        }))
      };
    } catch (error) {
      logger.error(`Error getting risk profile for ${address}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Gets a detailed risk analysis for a user
   * @param {string} address - User address
   * @returns {Promise<Object>} - Detailed risk analysis
   */
  async getDetailedRiskAnalysis(address) {
    try {
      // Normalize address
      const normalizedAddress = ethers.utils.getAddress(address);
      
      // Make API call to the risk assessment service
      const response = await axios.post(
        `${this.riskApiBaseUrl}/analyze`,
        { address: normalizedAddress },
        { timeout: this.riskApiTimeout * 2 } // Double timeout for this heavy operation
      );
      
      if (!response.data) {
        throw new ApiError('Risk analysis service returned empty response', 500);
      }
      
      // Return the detailed analysis
      return response.data;
    } catch (error) {
      logger.error(`Error getting detailed risk analysis for ${address}: ${error.message}`);
      
      // Handle API errors
      if (error.response) {
        throw new ApiError(
          `Risk analysis service error: ${error.response.data.error || error.response.statusText}`,
          error.response.status
        );
      }
      
      // Handle other errors
      throw new ApiError(
        `Risk analysis error: ${error.message}`,
        500
      );
    }
  }

  /**
   * Batch assesses risk for multiple users
   * @param {Array<string>} addresses - List of user addresses
   * @returns {Promise<Object>} - Batch risk assessment results
   */
  async batchAssessRisk(addresses) {
    try {
      // Normalize addresses
      const normalizedAddresses = addresses.map(addr => ethers.utils.getAddress(addr));
      
      logger.info(`Batch assessing risk for ${normalizedAddresses.length} addresses`);
      
      // Make API call to the risk assessment service
      const response = await axios.post(
        `${this.riskApiBaseUrl}/batch-predict`,
        { addresses: normalizedAddresses },
        { timeout: this.riskApiTimeout * 2 } // Double timeout for batch operation
      );
      
      if (!response.data || !response.data.predictions) {
        throw new ApiError('Risk assessment service returned invalid response for batch operation', 500);
      }
      
      // Process the response and return risk assessments
      const riskAssessments = {};
      
      response.data.predictions.forEach(prediction => {
        riskAssessments[prediction.address] = {
          address: prediction.address,
          riskScore: prediction.risk_score,
          riskClass: prediction.risk_class
        };
        
        // Cache individual results if enabled
        if (this.cacheEnabled) {
          cache.set(
            `${CACHE_KEYS.RISK_ASSESSMENT}:${prediction.address}`, 
            riskAssessments[prediction.address],
            this.cacheTtl
          );
        }
      });
      
      return {
        results: riskAssessments,
        timestamp: response.data.timestamp || new Date().toISOString(),
        modelVersion: response.data.model_version
      };
    } catch (error) {
      logger.error(`Error batch assessing risk: ${error.message}`);
      
      // Handle API errors
      if (error.response) {
        throw new ApiError(
          `Risk assessment service error: ${error.response.data.error || error.response.statusText}`,
          error.response.status
        );
      }
      
      // Handle other errors
      throw new ApiError(
        `Risk assessment error: ${error.message}`,
        500
      );
    }
  }

  /**
   * Gets a recommended interest rate based on risk score
   * @param {number} riskScore - User risk score
   * @returns {number} - Recommended interest rate (basis points)
   */
  getRecommendedInterestRate(riskScore) {
    // Base rate of 300 basis points (3%)
    const baseRate = 300;
    
    // Add risk premium (0-1000 basis points, or 0-10%)
    // Mapping risk score 0-100 to premium 0-1000 basis points
    const riskPremium = Math.floor((riskScore / 100) * 1000);
    
    return baseRate + riskPremium;
  }

  /**
   * Gets a recommended collateral factor based on risk score
   * @param {number} riskScore - User risk score
   * @returns {number} - Recommended collateral factor (0-100)
   */
  getRecommendedCollateralFactor(riskScore) {
    // Max collateral factor of 85%
    const maxFactor = 85;
    
    // Min collateral factor of 40%
    const minFactor = 40;
    
    // Linear interpolation based on risk score
    // Lower risk score = higher collateral factor
    return Math.floor(maxFactor - ((riskScore / 100) * (maxFactor - minFactor)));
  }

  /**
   * Processes risk factors from API response
   * @param {Array<Object>} riskFactors - Risk factors from API
   * @returns {Array<Object>} - Processed risk factors
   * @private
   */
  _processRiskFactors(riskFactors) {
    if (!riskFactors || !Array.isArray(riskFactors)) {
      return [];
    }
    
    return riskFactors.map(factor => {
      // Format factor name for display
      const formattedFactor = factor.factor
        .toLowerCase()
        .replace(/_/g, ' ')
        .replace(/\b\w/g, l => l.toUpperCase());
      
      return {
        factor: formattedFactor,
        score: factor.score,
        importance: factor.importance || null,
        impact: factor.impact || 'neutral',
        description: this._getRiskFactorDescription(factor.factor)
      };
    });
  }

  /**
   * Processes recommendations from API response
   * @param {Array<Object>} recommendations - Recommendations from API
   * @returns {Array<Object>} - Processed recommendations
   * @private
   */
  _processRecommendations(recommendations) {
    if (!recommendations || !Array.isArray(recommendations)) {
      return [];
    }
    
    return recommendations.map(rec => ({
      action: rec.action,
      impact: rec.impact,
      description: rec.description || null
    }));
  }

  /**
   * Gets a description for a risk factor
   * @param {string} factorKey - Risk factor key
   * @returns {string} - Description
   * @private
   */
  _getRiskFactorDescription(factorKey) {
    const descriptions = {
      'repayment_ratio': 'History of repaying borrowed assets on time',
      'balance_volatility': 'Stability of wallet balance over time',
      'transaction_frequency': 'Frequency of blockchain transactions',
      'wallet_age_days': 'Age of the wallet in days',
      'borrow_frequency': 'Frequency of borrowing assets',
      'cross_chain_activity': 'Activity across multiple blockchains',
      'deposit_frequency': 'Frequency of depositing assets',
      'active_borrows': 'Currently active borrow positions',
      'using_as_collateral': 'Usage of assets as collateral',
      'is_contract': 'Whether the address is a smart contract',
      'collateral_diversity': 'Diversity of collateral assets'
    };
    
    return descriptions[factorKey] || 'This factor affects your overall risk score';
  }
}

module.exports = RiskAssessmentService;
