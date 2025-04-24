/**
 * Risk Assessment Service
 * Connects to the AI Risk Assessment API and provides methods to analyze user risk
 */

const axios = require('axios');
const { ethers } = require('ethers');
const config = require('../config');
const logger = require('../utils/logger');

class RiskAssessmentService {
  constructor() {
    this.apiUrl = config.riskAssessmentApi.url;
    this.provider = new ethers.providers.JsonRpcProvider(config.blockchain.rpcUrl);
    this.wallet = new ethers.Wallet(config.blockchain.privateKey, this.provider);
    
    // Initialize contracts
    this.contracts = {
      riskAssessment: new ethers.Contract(
        config.contracts.riskAssessment.address,
        config.contracts.riskAssessment.abi,
        this.wallet
      ),
      lendingPool: new ethers.Contract(
        config.contracts.lendingPool.address,
        config.contracts.lendingPool.abi,
        this.wallet
      )
    };
  }

  /**
   * Fetches the feature vector for a user's risk assessment
   * 
   * @param {string} address - User's blockchain address
   * @returns {Promise<Object>} - Feature vector for risk modeling
   */
  async fetchFeatureVector(address) {
    try {
      logger.info(`Fetching on-chain data for ${address}`);
      
      // Get lending data from the contract
      const deposits = await this.contracts.lendingPool.deposits(address);
      const borrows = await this.contracts.lendingPool.borrows(address);
      const collaterals = await this.contracts.lendingPool.collaterals(address);
      
      // Get transaction history - simplified for hackathon
      // In a production system, this would be more comprehensive
      const blockNumber = await this.provider.getBlockNumber();
      const lastMonth = await this.provider.getBlock(blockNumber - 172800); // ~30 days of blocks (assuming 15s block time)
      
      // Get user's transactions
      const filter = {
        address: [config.contracts.lendingPool.address],
        fromBlock: lastMonth.number,
        toBlock: blockNumber,
        topics: [null, ethers.utils.hexZeroPad(address, 32)] // Filter for events with user's address as indexed param
      };
      
      const events = await this.provider.getLogs(filter);
      
      // Extract transaction features
      const transactionCount = events.length;
      const uniqueInteractionDays = new Set(
        events.map(event => Math.floor((Date.now() / 1000 - event.timeStamp) / 86400))
      ).size;
      
      // Extract deposit/borrow/repay events
      const depositEvents = events.filter(event => 
        event.topics[0] === ethers.utils.id("Deposit(address,uint256)")
      );
      const borrowEvents = events.filter(event => 
        event.topics[0] === ethers.utils.id("Borrow(address,uint256)")
      );
      const repayEvents = events.filter(event => 
        event.topics[0] === ethers.utils.id("Repay(address,uint256)")
      );
      
      // Get account age (simplified - in a real system this would be more precise)
      const accountAge = Math.floor(Math.random() * 365 * 2) + 30; // Random between 30 days and 2 years
      
      // Build feature vector
      const featureVector = {
        address,
        transaction_count: transactionCount,
        avg_transaction_value: transactionCount > 0 ? 
          parseFloat(ethers.utils.formatEther(borrows.add(deposits).div(transactionCount))) : 0,
        wallet_age_days: accountAge,
        previous_loans_count: borrowEvents.length,
        repayment_ratio: borrowEvents.length > 0 ? 
          repayEvents.length / borrowEvents.length : 1,
        default_count: 0, // Would need liquidation events in a real system
        collateral_diversity: 1, // Simplified - would be calculated from different collateral types
        cross_chain_activity: 0, // Would need cross-chain data in a real system
        lending_protocol_interactions: transactionCount,
        wallet_balance_volatility: 0.3, // Simplified - would be calculated from balance history
        deposits: parseFloat(ethers.utils.formatEther(deposits)),
        borrows: parseFloat(ethers.utils.formatEther(borrows)),
        collateral: parseFloat(ethers.utils.formatEther(collaterals)),
        ltv_ratio: borrows.gt(0) && collaterals.gt(0) ? 
          parseFloat(ethers.utils.formatEther(borrows.mul(100).div(collaterals))) : 0,
        unique_interaction_days: uniqueInteractionDays
      };
      
      return featureVector;
    } catch (error) {
      logger.error(`Error fetching feature vector for ${address}: ${error.message}`);
      throw new Error(`Failed to fetch feature vector: ${error.message}`);
    }
  }

  /**
   * Predicts the risk score for a user
   * 
   * @param {string} address - User's blockchain address
   * @returns {Promise<Object>} - Risk assessment results
   */
  async predictRiskScore(address) {
    try {
      logger.info(`Predicting risk score for ${address}`);
      
      // Fetch user's feature vector
      const featureVector = await this.fetchFeatureVector(address);
      
      // Call the AI model API
      const response = await axios.post(`${this.apiUrl}/predict`, {
        address,
        features: featureVector
      });
      
      // Extract risk assessment results
      const { risk_score, risk_class, risk_factors, recommendations } = response.data;
      
      logger.info(`Risk score prediction complete for ${address}: ${risk_score}`);
      
      return {
        address,
        riskScore: risk_score,
        riskClass: risk_class,
        riskFactors: risk_factors,
        recommendations,
        featureVector
      };
    } catch (error) {
      logger.error(`Error predicting risk score for ${address}: ${error.message}`);
      
      // Fallback to a deterministic random score for the hackathon demo
      // In production, this would use a local model or more robust fallback
      const seed = parseInt(address.slice(2, 10), 16);
      const pseudoRandomScore = (seed % 100) || 50;
      
      return {
        address,
        riskScore: pseudoRandomScore,
        riskClass: this.getRiskClass(pseudoRandomScore),
        riskFactors: [],
        recommendations: [],
        isBackupScore: true
      };
    }
  }

  /**
   * Updates the risk score on-chain
   * 
   * @param {string} address - User's blockchain address
   * @param {number} riskScore - Calculated risk score (0-100)
   * @param {Object} metrics - Detailed risk metrics
   * @returns {Promise<Object>} - Transaction receipt
   */
  async updateRiskScoreOnChain(address, riskScore, metrics = {}) {
    try {
      logger.info(`Updating on-chain risk score for ${address} to ${riskScore}`);
      
      // Encode additional metrics if provided
      let additionalData = '0x';
      if (Object.keys(metrics).length > 0) {
        const { repaymentScore, collateralScore, volatilityScore, activityScore, rateAdjustment } = metrics;
        additionalData = ethers.utils.defaultAbiCoder.encode(
          ['uint256', 'uint256', 'uint256', 'uint256', 'int256'],
          [
            repaymentScore || riskScore,
            collateralScore || riskScore,
            volatilityScore || riskScore,
            activityScore || riskScore,
            rateAdjustment || 0
          ]
        );
      }
      
      // Update risk score on-chain
      const tx = await this.contracts.riskAssessment.updateUserRiskScore(
        address,
        riskScore,
        additionalData
      );
      
      const receipt = await tx.wait();
      
      logger.info(`Risk score updated on-chain for ${address}, tx: ${receipt.transactionHash}`);
      
      return {
        address,
        riskScore,
        txHash: receipt.transactionHash,
        blockNumber: receipt.blockNumber
      };
    } catch (error) {
      logger.error(`Error updating risk score on-chain for ${address}: ${error.message}`);
      throw new Error(`Failed to update risk score on-chain: ${error.message}`);
    }
  }

  /**
   * Gets a user's current risk metrics from the blockchain
   * 
   * @param {string} address - User's blockchain address
   * @returns {Promise<Object>} - Current risk metrics
   */
  async getCurrentRiskMetrics(address) {
    try {
      logger.info(`Fetching current risk metrics for ${address}`);
      
      // Get overall risk score
      const riskScore = await this.contracts.riskAssessment.getUserRiskScore(address);
      
      // Get detailed metrics
      const [
        overallScore,
        repaymentScore,
        collateralScore,
        volatilityScore,
        activityScore
      ] = await this.contracts.riskAssessment.getUserRiskMetrics(address);
      
      // Get recommended interest rate adjustment
      const rateAdjustment = await this.contracts.riskAssessment.getRecommendedRateAdjustment(address);
      
      return {
        address,
        riskScore: riskScore.toNumber(),
        overallScore: overallScore.toNumber(),
        repaymentScore: repaymentScore.toNumber(),
        collateralScore: collateralScore.toNumber(),
        volatilityScore: volatilityScore.toNumber(),
        activityScore: activityScore.toNumber(),
        rateAdjustment: rateAdjustment.toNumber()
      };
    } catch (error) {
      logger.error(`Error fetching risk metrics for ${address}: ${error.message}`);
      
      // Return dummy data for hackathon demo
      return {
        address,
        riskScore: 50,
        overallScore: 50,
        repaymentScore: 55,
        collateralScore: 60,
        volatilityScore: 45,
        activityScore: 50,
        rateAdjustment: 0,
        isBackupData: true
      };
    }
  }

  /**
   * Analyzes a user's on-chain activity
   * 
   * @param {string} address - User's blockchain address
   * @returns {Promise<Object>} - Analysis results
   */
  async analyzeUserActivity(address) {
    try {
      logger.info(`Analyzing on-chain activity for ${address}`);
      
      // Call the AI model API
      const response = await axios.post(`${this.apiUrl}/analyze`, {
        address
      });
      
      logger.info(`Activity analysis complete for ${address}`);
      
      return response.data;
    } catch (error) {
      logger.error(`Error analyzing activity for ${address}: ${error.message}`);
      throw new Error(`Failed to analyze user activity: ${error.message}`);
    }
  }

  /**
   * Gets customized recommendations for improving risk score
   * 
   * @param {string} address - User's blockchain address
   * @returns {Promise<Array>} - List of recommendations
   */
  async getRecommendations(address) {
    try {
      logger.info(`Getting recommendations for ${address}`);
      
      // Get current risk metrics
      const metrics = await this.getCurrentRiskMetrics(address);
      
      // Generate recommendations based on metrics
      const recommendations = [];
      
      // Add collateral recommendation if needed
      if (metrics.collateralScore < 70) {
        recommendations.push({
          id: 'collateral',
          title: 'Increase Your Collateral',
          description: 'Adding more collateral will improve your collateral score and reduce your overall risk profile.',
          impact: 'high',
          potentialImprovement: 10
        });
      }
      
      // Add repayment recommendation if needed
      if (metrics.repaymentScore < 80) {
        recommendations.push({
          id: 'repayment',
          title: 'Improve Repayment History',
          description: 'Making regular, on-time repayments will significantly improve your credit score over time.',
          impact: 'high',
          potentialImprovement: 15
        });
      }
      
      // Add activity recommendation if needed
      if (metrics.activityScore < 60) {
        recommendations.push({
          id: 'activity',
          title: 'Increase Protocol Interaction',
          description: 'More regular interaction with the protocol demonstrates consistent behavior and can improve your risk score.',
          impact: 'medium',
          potentialImprovement: 8
        });
      }
      
      // Add volatility recommendation if needed
      if (metrics.volatilityScore < 65) {
        recommendations.push({
          id: 'volatility',
          title: 'Reduce Wallet Volatility',
          description: 'Maintaining more stable balances in your wallet demonstrates financial stability and reduces perceived risk.',
          impact: 'medium',
          potentialImprovement: 7
        });
      }
      
      // Add general recommendation
      recommendations.push({
        id: 'diversify',
        title: 'Diversify Your Collateral',
        description: 'Using multiple types of assets as collateral can reduce overall portfolio risk and improve your risk score.',
        impact: 'medium',
        potentialImprovement: 5
      });
      
      return recommendations;
    } catch (error) {
      logger.error(`Error getting recommendations for ${address}: ${error.message}`);
      
      // Return default recommendations for hackathon demo
      return [
        {
          id: 'collateral',
          title: 'Increase Your Collateral',
          description: 'Adding more collateral will improve your collateral score and reduce your overall risk profile.',
          impact: 'high',
          potentialImprovement: 10
        },
        {
          id: 'repayment',
          title: 'Improve Repayment History',
          description: 'Making regular, on-time repayments will significantly improve your credit score over time.',
          impact: 'high',
          potentialImprovement: 15
        },
        {
          id: 'diversify',
          title: 'Diversify Your Collateral',
          description: 'Using multiple types of assets as collateral can reduce overall portfolio risk and improve your risk score.',
          impact: 'medium',
          potentialImprovement: 5
        }
      ];
    }
  }

  /**
   * Helper method to get risk class from score
   * 
   * @param {number} score - Risk score (0-100)
   * @returns {string} - Risk class
   */
  getRiskClass(score) {
    if (score <= 20) return 'Very Low Risk';
    if (score <= 40) return 'Low Risk';
    if (score <= 60) return 'Medium Risk';
    if (score <= 80) return 'High Risk';
    return 'Very High Risk';
  }
}

module.exports = new RiskAssessmentService();
