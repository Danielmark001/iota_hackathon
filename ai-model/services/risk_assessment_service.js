/**
 * Enhanced Risk Assessment Service
 * 
 * Connects AI risk assessment with real IOTA Tangle data for improved accuracy.
 * Implements on-chain risk score updates and visualization components.
 */

const logger = require('../../iota-sdk/utils/logger');
const IotaTangleConnector = require('./iota_tangle_connector');
const fs = require('fs');
const path = require('path');

class RiskAssessmentService {
  constructor(options = {}) {
    this.apiUrl = options.apiUrl || 'http://localhost:5000';
    this.useMocks = options.useMocks === true;
    this.useLocalModel = options.useLocalModel === true;
    this.modelPath = options.modelPath || '../models';
    this.iotaClient = options.iotaClient;
    this.iotaAccount = options.iotaAccount;
    this.streamsService = options.streamsService;
    this.crossLayerAggregator = options.crossLayerAggregator;
    this.tangleConnector = null;
    
    // Initialize Tangle connector if IOTA client is provided
    if (this.iotaClient) {
      this.initializeTangleConnector();
    }
    
    logger.info('Enhanced Risk Assessment Service initialized');
    logger.info(`Using ${this.useMocks ? 'mock data' : 'real data'}`);
    logger.info(`Model: ${this.useLocalModel ? 'local' : 'remote API'}`);
  }
  
  /**
   * Initialize the IOTA Tangle connector
   */
  initializeTangleConnector() {
    if (!this.iotaClient) {
      logger.warn('Cannot initialize Tangle connector without IOTA client');
      return;
    }
    
    this.tangleConnector = new IotaTangleConnector({
      client: this.iotaClient,
      account: this.iotaAccount,
      streamsService: this.streamsService,
      crossLayerAggregator: this.crossLayerAggregator,
      cacheEnabled: true
    });
    
    logger.info('IOTA Tangle connector initialized for risk assessment');
  }
  
  /**
   * Set IOTA client
   * @param {Object} client - IOTA client instance
   */
  setIotaClient(client) {
    this.iotaClient = client;
    this.initializeTangleConnector();
  }
  
  /**
   * Set IOTA account
   * @param {Object} account - IOTA account instance
   */
  setIotaAccount(account) {
    this.iotaAccount = account;
    if (this.tangleConnector) {
      this.tangleConnector.account = account;
    }
  }
  
  /**
   * Assess risk for an address using real IOTA data
   * @param {string} address - User address
   * @param {Object} options - Assessment options
   * @returns {Promise<Object>} Risk assessment result
   */
  async assessRisk(address, options = {}) {
    try {
      logger.info(`Assessing risk for ${address}`);
      
      if (!address) {
        throw new Error('Address is required for risk assessment');
      }
      
      // Get transaction history from IOTA Tangle if available
      let transactionHistory = [];
      let networkStats = null;
      let crossLayerData = null;
      let identityData = null;
      
      if (this.tangleConnector && !this.useMocks) {
        try {
          // Get transaction history from Tangle
          transactionHistory = await this.tangleConnector.fetchTransactionHistory(address);
          
          // Get network stats for context
          networkStats = await this.tangleConnector.getNetworkStats();
          
          // Get cross-layer data if available
          crossLayerData = await this.tangleConnector.getCrossLayerData(address);
          
          // Get identity verification status
          identityData = await this.tangleConnector.getIdentityVerificationStatus(address);
          
          logger.info(`Retrieved real IOTA data for ${address}: ${transactionHistory.length} transactions`);
        } catch (tangleError) {
          logger.error(`Error retrieving data from Tangle: ${tangleError.message}`);
          logger.warn('Falling back to on-chain data without Tangle enhancements');
        }
      }
      
      // Run the risk assessment algorithm
      const riskScore = await this.calculateRiskScore(
        address,
        {
          transactionHistory,
          networkStats,
          crossLayerData,
          identityData
        }
      );
      
      // Record risk score on Tangle if requested
      if (options.updateOnChain && this.tangleConnector && !this.useMocks) {
        try {
          await this.tangleConnector.submitRiskScore(address, riskScore.riskScore, {
            algorithm: 'IntelliLend-AI-v1',
            factors: riskScore.factors.map(f => f.factor),
            confidence: riskScore.confidence
          });
          logger.info(`Risk score recorded on Tangle for ${address}`);
        } catch (recordError) {
          logger.error(`Error recording risk score on Tangle: ${recordError.message}`);
        }
      }
      
      return riskScore;
    } catch (error) {
      logger.error(`Error assessing risk: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Calculate risk score using AI model
   * @param {string} address - User address
   * @param {Object} data - Input data for risk calculation
   * @returns {Promise<Object>} Risk score result
   */
  async calculateRiskScore(address, data) {
    try {
      // If using local model
      if (this.useLocalModel) {
        return await this.calculateRiskScoreLocal(address, data);
      }
      
      // If using mock data
      if (this.useMocks) {
        return this.generateMockRiskScore(address);
      }
      
      // Otherwise use the API
      // In a real implementation, we would call an API here
      // For now, we'll use a simplified algorithm
      
      // Process transaction history
      const txStats = this.analyzeTransactionHistory(data.transactionHistory);
      
      // Consider identity verification
      const identityFactor = data.identityData?.isVerified ? -10 : 0;
      
      // Base risk score (0-100, lower is better)
      let baseScore = 50;
      
      // Adjust for transaction history
      baseScore -= txStats.successRate * 10; // Lower score for higher success rate
      baseScore += txStats.recentFailures * 5; // Increase score for recent failures
      
      // Adjust for cross-layer activity if available
      if (data.crossLayerData?.crossLayerEnabled) {
        baseScore -= 5; // Reward cross-layer activity
      }
      
      // Adjust for identity verification
      baseScore += identityFactor;
      
      // Ensure score is within bounds
      const riskScore = Math.max(0, Math.min(100, Math.round(baseScore)));
      
      // Calculate confidence
      const confidence = 0.75 + (data.transactionHistory.length / 100) * 0.2;
      
      // Determine risk factors
      const factors = [];
      
      if (txStats.totalTransactions > 0) {
        factors.push({
          factor: 'transaction_history',
          impact: txStats.successRate > 0.9 ? 'positive' : 'negative',
          weight: 0.3,
          details: `${txStats.totalTransactions} transactions with ${Math.round(txStats.successRate * 100)}% success`
        });
      }
      
      if (txStats.recentFailures > 0) {
        factors.push({
          factor: 'recent_failures',
          impact: 'negative',
          weight: 0.2,
          details: `${txStats.recentFailures} failed transactions in recent history`
        });
      }
      
      if (data.identityData?.isVerified) {
        factors.push({
          factor: 'identity_verification',
          impact: 'positive',
          weight: 0.15,
          details: `Identity verified via ${data.identityData.source}`
        });
      }
      
      if (data.crossLayerData?.crossLayerEnabled) {
        factors.push({
          factor: 'cross_layer_activity',
          impact: 'positive',
          weight: 0.1,
          details: 'Active in cross-layer operations'
        });
      }
      
      // Generate recommendations
      const recommendations = this.generateRecommendations(riskScore, factors);
      
      return {
        address,
        riskScore,
        confidence,
        factors,
        recommendations,
        timestamp: Date.now()
      };
    } catch (error) {
      logger.error(`Error calculating risk score: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Calculate risk score using local model
   * @param {string} address - User address
   * @param {Object} data - Input data for risk calculation
   * @returns {Promise<Object>} Risk score result
   */
  async calculateRiskScoreLocal(address, data) {
    try {
      logger.info(`Calculating risk score locally for ${address}`);
      
      // In a real implementation, we would load and run a local ML model
      // For now, we'll use a simplified algorithm
      
      // Check if model file exists
      const modelFilePath = path.join(this.modelPath, 'risk_model.json');
      let model = null;
      
      try {
        if (fs.existsSync(modelFilePath)) {
          const modelData = fs.readFileSync(modelFilePath, 'utf8');
          model = JSON.parse(modelData);
          logger.info('Loaded local risk assessment model');
        }
      } catch (fileError) {
        logger.warn(`Could not load model file: ${fileError.message}`);
      }
      
      // If model is available, use it
      if (model) {
        // Apply model weights to features
        const features = this.extractFeatures(data);
        let score = model.baseScore || 50;
        
        // Apply feature weights
        for (const [feature, value] of Object.entries(features)) {
          const weight = model.weights[feature] || 0;
          score += value * weight;
        }
        
        // Apply model adjustments
        if (model.adjustments) {
          for (const adjustment of model.adjustments) {
            if (this.checkCondition(adjustment.condition, features)) {
              score += adjustment.value;
            }
          }
        }
        
        // Ensure score is within bounds
        const riskScore = Math.max(0, Math.min(100, Math.round(score)));
        
        // Extract factors from model
        const factors = this.extractFactors(model, features);
        
        // Generate recommendations
        const recommendations = this.generateRecommendations(riskScore, factors);
        
        return {
          address,
          riskScore,
          confidence: model.confidence || 0.85,
          factors,
          recommendations,
          timestamp: Date.now()
        };
      }
      
      // Fallback to basic algorithm
      return this.calculateRiskScore(address, data);
    } catch (error) {
      logger.error(`Error calculating risk score locally: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Extract features from input data
   * @param {Object} data - Input data
   * @returns {Object} Extracted features
   */
  extractFeatures(data) {
    const features = {};
    
    // Transaction history features
    if (data.transactionHistory && data.transactionHistory.length > 0) {
      const txStats = this.analyzeTransactionHistory(data.transactionHistory);
      features.transactionCount = txStats.totalTransactions;
      features.successRate = txStats.successRate;
      features.recentFailures = txStats.recentFailures;
      features.avgTransactionValue = txStats.avgValue;
      features.largeTransactionRatio = txStats.largeTransactionRatio;
    } else {
      features.transactionCount = 0;
      features.successRate = 0;
      features.recentFailures = 0;
      features.avgTransactionValue = 0;
      features.largeTransactionRatio = 0;
    }
    
    // Identity features
    if (data.identityData) {
      features.identityVerified = data.identityData.isVerified ? 1 : 0;
      features.identityTrustLevel = 
        data.identityData.trustLevel === 'high' ? 1 :
        data.identityData.trustLevel === 'medium' ? 0.5 : 0;
    } else {
      features.identityVerified = 0;
      features.identityTrustLevel = 0;
    }
    
    // Cross-layer features
    if (data.crossLayerData && data.crossLayerData.crossLayerEnabled) {
      features.crossLayerEnabled = 1;
      features.crossLayerMessageCount = 
        data.crossLayerData.bridgeMessages?.length || 0;
    } else {
      features.crossLayerEnabled = 0;
      features.crossLayerMessageCount = 0;
    }
    
    return features;
  }
  
  /**
   * Check a condition against features
   * @param {Object} condition - Condition to check
   * @param {Object} features - Feature values
   * @returns {boolean} Whether condition is met
   */
  checkCondition(condition, features) {
    if (!condition || !condition.feature) return false;
    
    const featureValue = features[condition.feature];
    const targetValue = condition.value;
    
    switch (condition.operator) {
      case 'equals':
        return featureValue === targetValue;
      case 'not_equals':
        return featureValue !== targetValue;
      case 'greater_than':
        return featureValue > targetValue;
      case 'less_than':
        return featureValue < targetValue;
      case 'greater_equals':
        return featureValue >= targetValue;
      case 'less_equals':
        return featureValue <= targetValue;
      default:
        return false;
    }
  }
  
  /**
   * Extract risk factors from model and features
   * @param {Object} model - Risk model
   * @param {Object} features - Feature values
   * @returns {Array} Risk factors
   */
  extractFactors(model, features) {
    const factors = [];
    
    if (!model.factors) return factors;
    
    for (const factor of model.factors) {
      // Check if factor condition is met
      if (factor.condition && !this.checkCondition(factor.condition, features)) {
        continue;
      }
      
      // Add factor with impact
      factors.push({
        factor: factor.name,
        impact: factor.impact || 'neutral',
        weight: factor.weight || 0.1,
        details: factor.template
          ? this.formatTemplate(factor.template, features)
          : factor.details || ''
      });
    }
    
    return factors;
  }
  
  /**
   * Format a template string with feature values
   * @param {string} template - Template string
   * @param {Object} features - Feature values
   * @returns {string} Formatted string
   */
  formatTemplate(template, features) {
    let result = template;
    
    // Replace {feature} placeholders with values
    for (const [key, value] of Object.entries(features)) {
      const placeholder = `{${key}}`;
      
      if (result.includes(placeholder)) {
        // Format number values for better readability
        const formattedValue = typeof value === 'number'
          ? this.formatNumberValue(value, key)
          : value;
        
        result = result.replace(placeholder, formattedValue);
      }
    }
    
    return result;
  }
  
  /**
   * Format a number value based on feature type
   * @param {number} value - Number value
   * @param {string} featureType - Feature type
   * @returns {string} Formatted value
   */
  formatNumberValue(value, featureType) {
    if (featureType.includes('Rate') || featureType.includes('Ratio')) {
      return `${Math.round(value * 100)}%`;
    } else if (value < 1 && value > 0) {
      return value.toFixed(2);
    } else {
      return Math.round(value).toString();
    }
  }
  
  /**
   * Analyze transaction history
   * @param {Array} transactions - Transaction history
   * @returns {Object} Analysis results
   */
  analyzeTransactionHistory(transactions) {
    // Default values for empty history
    if (!transactions || transactions.length === 0) {
      return {
        totalTransactions: 0,
        successRate: 0,
        recentFailures: 0,
        avgValue: 0,
        largeTransactionRatio: 0
      };
    }
    
    // Count transactions
    const totalTransactions = transactions.length;
    
    // Count successful transactions
    const successfulTransactions = transactions.filter(tx => 
      tx.metadata?.metadata?.milestoneTimestampBooked || false
    ).length;
    
    // Calculate success rate
    const successRate = totalTransactions > 0
      ? successfulTransactions / totalTransactions
      : 0;
    
    // Count recent failures (last 10 transactions)
    const recentTransactions = transactions.slice(0, 10);
    const recentFailures = recentTransactions.filter(tx => 
      !tx.metadata?.metadata?.milestoneTimestampBooked
    ).length;
    
    // Calculate average value
    const values = transactions
      .map(tx => BigInt(tx.amount || '0'))
      .map(amount => Number(amount) / 1000000); // Convert to IOTA
    
    const totalValue = values.reduce((sum, val) => sum + val, 0);
    const avgValue = totalTransactions > 0
      ? totalValue / totalTransactions
      : 0;
    
    // Calculate ratio of large transactions
    // Define "large" as 3x the average
    const largeThreshold = avgValue * 3;
    const largeTransactions = values.filter(val => val > largeThreshold).length;
    const largeTransactionRatio = totalTransactions > 0
      ? largeTransactions / totalTransactions
      : 0;
    
    return {
      totalTransactions,
      successRate,
      recentFailures,
      avgValue,
      largeTransactionRatio
    };
  }
  
  /**
   * Generate recommendations based on risk score and factors
   * @param {number} riskScore - Risk score
   * @param {Array} factors - Risk factors
   * @returns {Array} Recommendations
   */
  generateRecommendations(riskScore, factors) {
    const recommendations = [];
    
    // Add recommendations based on risk score
    if (riskScore > 70) {
      recommendations.push({
        title: 'High Risk Profile',
        description: 'Your risk score is high. Consider reducing borrowing and increasing collateral.',
        actionType: 'warning'
      });
    } else if (riskScore > 50) {
      recommendations.push({
        title: 'Moderate Risk Profile',
        description: 'Your risk profile could be improved. Consider optimizing your portfolio.',
        actionType: 'suggestion'
      });
    } else {
      recommendations.push({
        title: 'Healthy Risk Profile',
        description: 'Your risk profile is healthy. Continue with your current strategy.',
        actionType: 'positive'
      });
    }
    
    // Add recommendations based on factors
    for (const factor of factors) {
      if (factor.impact === 'negative' && factor.weight >= 0.2) {
        let recommendation;
        
        switch (factor.factor) {
          case 'transaction_history':
            recommendation = {
              title: 'Improve Transaction Success Rate',
              description: 'Your transaction success rate is below average. Ensure you have sufficient gas and proper transaction parameters.',
              actionType: 'suggestion'
            };
            break;
          case 'recent_failures':
            recommendation = {
              title: 'Address Recent Transaction Failures',
              description: 'You have several recent failed transactions. Check your wallet configuration and network settings.',
              actionType: 'warning'
            };
            break;
          case 'identity_verification':
            recommendation = {
              title: 'Verify Your Identity',
              description: 'Verifying your identity with IOTA Identity can improve your risk score and lending terms.',
              actionType: 'suggestion'
            };
            break;
          default:
            continue;
        }
        
        recommendations.push(recommendation);
      }
    }
    
    return recommendations;
  }
  
  /**
   * Generate mock risk score
   * @param {string} address - User address
   * @returns {Object} Mock risk score
   */
  generateMockRiskScore(address) {
    // Generate deterministic but "random" score based on address
    const hash = this.simpleHash(address);
    const baseScore = hash % 100;
    
    // Generate factors
    const factors = [
      {
        factor: 'transaction_history',
        impact: baseScore < 50 ? 'positive' : 'negative',
        weight: 0.3,
        details: `${10 + (hash % 20)} transactions with ${70 + (hash % 30)}% success`
      },
      {
        factor: 'collateral_ratio',
        impact: baseScore < 40 ? 'positive' : 'neutral',
        weight: 0.25,
        details: `Collateral ratio: ${120 + (hash % 80)}%`
      },
      {
        factor: 'market_volatility',
        impact: 'negative',
        weight: 0.2,
        details: 'High market volatility in recent periods'
      }
    ];
    
    // Add identity factor sometimes
    if (hash % 3 === 0) {
      factors.push({
        factor: 'identity_verification',
        impact: 'positive',
        weight: 0.15,
        details: 'Identity verified via IOTA Identity'
      });
    }
    
    // Generate recommendations
    const recommendations = this.generateRecommendations(baseScore, factors);
    
    return {
      address,
      riskScore: baseScore,
      confidence: 0.75 + (hash % 20) / 100,
      factors,
      recommendations,
      timestamp: Date.now()
    };
  }
  
  /**
   * Simple hash function for deterministic "randomness"
   * @param {string} str - Input string
   * @returns {number} Hash value
   */
  simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }
  
  /**
   * Get model performance metrics
   * @param {number} timeRange - Optional time range in ms
   * @returns {Promise<Object>} Performance metrics
   */
  async getModelPerformanceMetrics(timeRange = null) {
    try {
      logger.info('Fetching model performance metrics');
      
      // In a real implementation, we would retrieve actual metrics
      // For now, we'll return mock data
      
      return {
        totalPredictions: 1245,
        correctPredictions: 1058,
        truePositives: 523,
        falsePositives: 87,
        trueNegatives: 535,
        falseNegatives: 100,
        confusionMatrix: [
          [523, 87],
          [100, 535]
        ],
        riskBucketAccuracy: {
          low: 0.92,
          medium: 0.85,
          high: 0.78
        },
        defaultRate: 0.08,
        riskBins: [
          { range: [0, 30], defaultRate: 0.02 },
          { range: [31, 60], defaultRate: 0.07 },
          { range: [61, 100], defaultRate: 0.15 }
        ],
        lastUpdate: Date.now()
      };
    } catch (error) {
      logger.error(`Error getting model performance metrics: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Get feature importance from the model
   * @returns {Promise<Array>} Feature importance
   */
  async getFeatureImportance() {
    try {
      logger.info('Fetching feature importance');
      
      // In a real implementation, we would retrieve actual feature importance
      // For now, we'll return mock data
      
      return [
        { feature: 'transaction_history', importance: 0.32, description: 'User transaction history on IOTA' },
        { feature: 'collateral_ratio', importance: 0.25, description: 'Ratio of collateral to borrowed assets' },
        { feature: 'identity_verification', importance: 0.15, description: 'IOTA Identity verification status' },
        { feature: 'market_volatility', importance: 0.12, description: 'Recent market volatility' },
        { feature: 'cross_layer_activity', importance: 0.08, description: 'Cross-layer activity between L1 and L2' },
        { feature: 'network_activity', importance: 0.05, description: 'General activity on the IOTA network' },
        { feature: 'time_since_first_tx', importance: 0.03, description: 'Time since first transaction' }
      ];
    } catch (error) {
      logger.error(`Error getting feature importance: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Validate predictions for a specific address
   * @param {string} address - User address
   * @returns {Promise<Object>} Validation results
   */
  async validateAddressPredictions(address) {
    try {
      logger.info(`Validating predictions for ${address}`);
      
      // In a real implementation, we would retrieve actual validation data
      // For now, we'll return mock data
      
      const hash = this.simpleHash(address);
      
      // Generate some mock predictions and actuals
      const predictions = [];
      const actuals = [];
      let correct = 0;
      
      for (let i = 0; i < 5; i++) {
        const timestamp = Date.now() - (i * 30 * 24 * 60 * 60 * 1000); // i months ago
        const predicted = 30 + (hash % 40) + (i * 3); // 30-70 + trend
        const actual = predicted + (((hash >> i) % 20) - 10); // ±10 from predicted
        
        predictions.push({ timestamp, score: predicted });
        actuals.push({ timestamp, score: actual });
        
        // Count as correct if within 10 points
        if (Math.abs(predicted - actual) <= 10) {
          correct++;
        }
      }
      
      return {
        address,
        predictions,
        actuals,
        accuracy: correct / 5,
        discrepancy: predictions.reduce((sum, p, i) => 
          sum + Math.abs(p.score - actuals[i].score), 0) / 5,
        lastUpdate: Date.now()
      };
    } catch (error) {
      logger.error(`Error validating predictions: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Start API server for local model (not implemented)
   */
  async startApiServer() {
    if (!this.useLocalModel) {
      logger.warn('API server not started: local model not enabled');
      return;
    }
    
    logger.info('Starting API server for local model');
    // This would start an Express server for the local model API
    // Not implemented in this code sample
  }
}

module.exports = RiskAssessmentService;
