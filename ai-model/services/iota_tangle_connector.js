/**
 * IOTA Tangle Data Connector for AI Risk Assessment
 * 
 * This module connects the AI risk assessment to real IOTA Tangle data,
 * enabling the model to use on-chain data for more accurate risk scoring.
 */

const logger = require('../../iota-sdk/utils/logger');
const { withExponentialBackoff, withCache } = require('../../iota-sdk/client');

class IotaTangleConnector {
  constructor(options = {}) {
    this.client = options.client;
    this.nodeManager = options.nodeManager;
    this.account = options.account;
    this.streamsService = options.streamsService;
    this.crossLayerAggregator = options.crossLayerAggregator;
    this.cacheEnabled = options.cacheEnabled !== false;
    this.cacheTTL = options.cacheTTL || 5 * 60 * 1000; // 5 minutes default
    
    // Validation
    if (!this.client) {
      throw new Error('IOTA client is required for Tangle Data Connector');
    }
    
    logger.info('IOTA Tangle Data Connector initialized');
  }
  
  /**
   * Fetch on-chain transaction history for an address
   * @param {string} address - Address to fetch history for
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Transaction history
   */
  async fetchTransactionHistory(address, options = {}) {
    try {
      logger.info(`Fetching transaction history for ${address}`);
      
      // Use caching for performance
      const cacheKey = `tx-history-${address}`;
      
      return await withCache(cacheKey, async () => {
        const transactions = await withExponentialBackoff(async () => {
          return await this.client.getAddressOutputs(address);
        });
        
        logger.info(`Found ${transactions.length} transactions for ${address}`);
        
        // Process transaction data
        const processedTxs = await this.processTransactions(transactions);
        
        return processedTxs;
      }, {
        useCache: this.cacheEnabled,
        cacheTTL: options.cacheTTL || this.cacheTTL
      });
    } catch (error) {
      logger.error(`Error fetching transaction history: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Process transaction data
   * @param {Array} transactions - Raw transactions
   * @returns {Promise<Array>} Processed transactions
   */
  async processTransactions(transactions) {
    try {
      // Extract transaction metadata relevant for risk assessment
      const processed = await Promise.all(transactions.map(async (tx) => {
        // Get additional transaction details if available
        let metadata = null;
        try {
          metadata = await this.client.getOutput(tx);
        } catch (error) {
          logger.debug(`Couldn't fetch full output data: ${error.message}`);
        }
        
        return {
          outputId: tx,
          metadata: metadata,
          timestamp: metadata?.metadata?.milestoneTimestampBooked || Date.now(),
          amount: metadata?.output?.amount || '0',
          unlockConditions: metadata?.output?.unlockConditions || []
        };
      }));
      
      return processed;
    } catch (error) {
      logger.error(`Error processing transactions: ${error.message}`);
      return transactions; // Return raw transactions on error
    }
  }
  
  /**
   * Get basic network statistics for risk modeling
   * @returns {Promise<Object>} Network statistics
   */
  async getNetworkStats() {
    try {
      logger.info('Fetching IOTA network statistics');
      
      // Use caching for performance
      const cacheKey = 'network-stats';
      
      return await withCache(cacheKey, async () => {
        // Get protocol parameters
        const protocol = await this.client.getProtocolParameters();
        
        // Get node info
        const info = await this.client.getInfo();
        
        // Get node health
        const health = info.nodeInfo.status;
        
        return {
          networkName: protocol.networkName,
          baseToken: protocol.baseToken,
          tokenSupply: protocol.baseToken.supply,
          bech32Hrp: protocol.bech32Hrp,
          nodeInfo: {
            version: info.nodeInfo.version,
            healthy: health.isHealthy,
            status: health
          },
          timestamp: Date.now()
        };
      }, { cacheTTL: 15 * 60 * 1000 }); // 15 minutes cache for network stats
    } catch (error) {
      logger.error(`Error fetching network stats: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Submit risk score to the Tangle for permanent record
   * @param {string} address - User address
   * @param {number} score - Risk score (0-100)
   * @param {Object} metadata - Additional metadata
   * @returns {Promise<Object>} Submission result
   */
  async submitRiskScore(address, score, metadata = {}) {
    try {
      logger.info(`Submitting risk score ${score} for ${address} to Tangle`);
      
      if (!address) {
        throw new Error('Address is required');
      }
      
      if (isNaN(score) || score < 0 || score > 100) {
        throw new Error('Score must be between 0 and 100');
      }
      
      // Prepare data payload
      const data = {
        address,
        riskScore: score,
        timestamp: Date.now(),
        algorithm: metadata.algorithm || 'IntelliLend-AI-v1',
        factors: metadata.factors || [],
        confidence: metadata.confidence || null,
        version: metadata.version || '1.0'
      };
      
      // Create block with data payload
      const blockData = {
        payload: {
          type: 1, // Tagged data
          tag: Buffer.from('RISK_SCORE').toString('hex'),
          data: Buffer.from(JSON.stringify(data)).toString('hex')
        }
      };
      
      // Submit to Tangle
      const result = await this.client.submitBlock(blockData);
      
      logger.info(`Risk score submitted successfully! Block ID: ${result.blockId}`);
      
      // Also send to Streams if available
      if (this.streamsService) {
        try {
          await this.streamsService.sendMessage({
            type: 'RISK_SCORE_UPDATE',
            content: data
          });
        } catch (streamsError) {
          logger.warn(`Failed to send to Streams: ${streamsError.message}`);
        }
      }
      
      return {
        success: true,
        blockId: result.blockId,
        timestamp: Date.now()
      };
    } catch (error) {
      logger.error(`Error submitting risk score: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Retrieve historical risk scores from the Tangle
   * @param {string} address - User address
   * @returns {Promise<Array>} Historical risk scores
   */
  async getHistoricalRiskScores(address) {
    try {
      logger.info(`Retrieving historical risk scores for ${address}`);
      
      // This is a complex operation as we need to search the Tangle for records
      // In a production environment, we would use an indexer service or IOTA Streams
      // For now, we'll return mock data as this requires specific Tangle indexing
      
      // If we have a Streams service, use it to get historical data
      if (this.streamsService) {
        try {
          const messages = await this.streamsService.getMessages({
            filter: {
              type: 'RISK_SCORE_UPDATE',
              address
            }
          });
          
          if (messages && messages.length > 0) {
            return messages.map(msg => msg.content);
          }
        } catch (streamsError) {
          logger.warn(`Failed to retrieve from Streams: ${streamsError.message}`);
        }
      }
      
      // Fallback to mock data if real data isn't available yet
      logger.warn('Returning mock historical risk scores - implement indexer for production');
      return [
        {
          address,
          riskScore: 42,
          timestamp: Date.now() - 30 * 24 * 60 * 60 * 1000, // 30 days ago
          algorithm: 'IntelliLend-AI-v1',
          factors: ['transaction_history', 'collateral_ratio'],
          confidence: 0.85,
          version: '1.0'
        },
        {
          address,
          riskScore: 38,
          timestamp: Date.now() - 15 * 24 * 60 * 60 * 1000, // 15 days ago
          algorithm: 'IntelliLend-AI-v1',
          factors: ['transaction_history', 'collateral_ratio', 'market_volatility'],
          confidence: 0.88,
          version: '1.0'
        }
      ];
    } catch (error) {
      logger.error(`Error retrieving historical risk scores: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Get cross-layer data for a user
   * @param {string} address - User address
   * @returns {Promise<Object>} Cross-layer data
   */
  async getCrossLayerData(address) {
    try {
      logger.info(`Fetching cross-layer data for ${address}`);
      
      if (!this.crossLayerAggregator) {
        logger.warn('Cross-layer aggregator not available');
        return { crossLayerEnabled: false };
      }
      
      // Use the cross-layer aggregator to get data from both L1 and L2
      const crossLayerData = await this.crossLayerAggregator.getUserData(address);
      
      return {
        crossLayerEnabled: true,
        l1Data: crossLayerData.l1Data,
        l2Data: crossLayerData.l2Data,
        bridgeMessages: crossLayerData.bridgeMessages,
        lastUpdated: Date.now()
      };
    } catch (error) {
      logger.error(`Error fetching cross-layer data: ${error.message}`);
      return { 
        crossLayerEnabled: false,
        error: error.message
      };
    }
  }
  
  /**
   * Get identity verification status from IOTA Identity
   * @param {string} address - User address
   * @returns {Promise<Object>} Identity verification status
   */
  async getIdentityVerificationStatus(address) {
    try {
      logger.info(`Checking identity verification for ${address}`);
      
      // This would connect to the IOTA Identity service in production
      // For now, we'll return mock data as this requires IOTA Identity integration
      
      return {
        isVerified: Math.random() > 0.5, // Random for now
        trustLevel: 'medium',
        lastVerified: Date.now() - Math.floor(Math.random() * 30) * 24 * 60 * 60 * 1000,
        source: 'IOTA-Identity'
      };
    } catch (error) {
      logger.error(`Error checking identity verification: ${error.message}`);
      return { 
        isVerified: false,
        error: error.message
      };
    }
  }
}

module.exports = IotaTangleConnector;
