/**
 * Enhanced AI Integration Module for IntelliLend
 * 
 * This module enhances the original AI integration with IOTA-specific features:
 * 1. On-chain reputation scoring using historical transaction data from the Tangle
 * 2. Cross-chain oracle for external credit data
 * 3. Multi-factor risk assessment combining on-chain and off-chain data
 * 4. Real-time risk monitoring with automatic alerts
 */

const { ethers } = require('ethers');
const axios = require('axios');
const { spawn } = require('child_process');
const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const { submitBlock, getAddressTransactions } = require('../../iota-sdk/client');
const { sendTokens } = require('../../iota-sdk/wallet');
const logger = require('../../iota-sdk/utils/logger');

// Import the original AI integration
const OriginalAIIntegration = require('./ai_integration');

// Load additional contract ABIs
const CrossChainOracleABI = require('../../abis/CrossChainOracle.json');
const RiskMonitoringABI = require('../../abis/RiskMonitoring.json');

class EnhancedAIIntegration extends OriginalAIIntegration {
  /**
   * Initialize the enhanced AI integration module
   * @param {Object} config - Configuration options
   * @param {string} config.provider - Ethereum provider URL
   * @param {string} config.lendingPoolAddress - Address of the LendingPool contract
   * @param {string} config.zkVerifierAddress - Address of the ZKVerifier contract
   * @param {string} config.zkBridgeAddress - Address of the ZKCrossLayerBridge contract
   * @param {string} config.crossChainOracleAddress - Address of the CrossChainOracle contract
   * @param {string} config.riskMonitoringAddress - Address of the RiskMonitoring contract
   * @param {string} config.modelPath - Path to the AI models directory
   * @param {boolean} config.useLocalModel - Whether to use the local model or API
   * @param {string} config.apiUrl - URL of the AI risk assessment API (if not using local model)
   * @param {number} config.tangleDataWeight - Weight of Tangle data in risk assessment (0-1)
   * @param {boolean} config.enableRealTimeMonitoring - Whether to enable real-time monitoring
   */
  constructor(config) {
    // Call the parent constructor
    super(config);
    
    // Store enhanced configuration
    this.enhancedConfig = {
      tangleDataWeight: 0.3, // Default weight for Tangle data (30%)
      enableRealTimeMonitoring: true, // Enable real-time monitoring by default
      monitoringIntervalMs: 300000, // Check every 5 minutes by default
      riskScoreChangeThreshold: 5, // Minimum score change to trigger alert
      ...config
    };
    
    // Initialize additional contract interfaces
    if (config.crossChainOracleAddress) {
      this.crossChainOracle = new ethers.Contract(
        config.crossChainOracleAddress,
        CrossChainOracleABI,
        this.provider
      );
    } else {
      console.warn('CrossChainOracle address not provided - oracle functionality will be limited');
    }
    
    if (config.riskMonitoringAddress) {
      this.riskMonitoring = new ethers.Contract(
        config.riskMonitoringAddress,
        RiskMonitoringABI,
        this.provider
      );
    } else {
      console.warn('RiskMonitoring address not provided - monitoring functionality will be limited');
    }
    
    // Initialize monitoring state
    this.monitoredUsers = new Map();
    this.lastScoreUpdates = new Map();
    this.monitoringInterval = null;
    
    // Initialize Tangle data cache
    this.tangleDataCache = new Map();
    
    // Initialize external data sources
    this.externalDataSources = [
      {
        name: 'Credit Score API',
        type: 'api',
        endpoint: config.creditScoreApiUrl || 'https://api.creditscore.example.com',
        apiKey: config.creditScoreApiKey,
        enabled: !!config.creditScoreApiKey
      },
      {
        name: 'Market Data Aggregator',
        type: 'api',
        endpoint: config.marketDataApiUrl || 'https://api.marketdata.example.com',
        apiKey: config.marketDataApiKey,
        enabled: !!config.marketDataApiKey
      }
    ];
    
    console.log('Enhanced AI Integration initialized with IOTA support');
  }
  
  /**
   * Set wallet for transaction signing
   * @param {string} privateKey - Private key for the signing wallet
   */
  setWallet(privateKey) {
    // Call parent method
    super.setWallet(privateKey);
    
    // Connect additional contracts
    if (this.crossChainOracle) {
      this.crossChainOracle = this.crossChainOracle.connect(this.wallet);
    }
    
    if (this.riskMonitoring) {
      this.riskMonitoring = this.riskMonitoring.connect(this.wallet);
    }
    
    console.log('Wallet connected to enhanced AI integration');
  }
  
  /**
   * Start real-time risk monitoring
   * @returns {Promise<boolean>} Success status
   */
  async startRealTimeMonitoring() {
    try {
      console.log('Starting real-time risk monitoring');
      
      if (this.monitoringInterval) {
        console.warn('Monitoring is already running');
        return true;
      }
      
      // Get active borrowers to monitor
      const activeBorrowers = await this.getActiveBorrowers();
      console.log(`Found ${activeBorrowers.length} active borrowers to monitor`);
      
      // Initialize monitoring for each borrower
      for (const borrower of activeBorrowers) {
        this.monitoredUsers.set(borrower, {
          lastChecked: new Date(),
          lastScore: await this.getLastRiskScore(borrower)
        });
      }
      
      // Start monitoring interval
      this.monitoringInterval = setInterval(
        () => this.checkMonitoredUsers().catch(
          err => console.error(`Error in monitoring interval: ${err.message}`)
        ),
        this.enhancedConfig.monitoringIntervalMs
      );
      
      console.log('Real-time risk monitoring started');
      return true;
    }
    catch (error) {
      console.error(`Error starting real-time monitoring: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Stop real-time risk monitoring
   * @returns {boolean} Success status
   */
  stopRealTimeMonitoring() {
    try {
      console.log('Stopping real-time risk monitoring');
      
      if (!this.monitoringInterval) {
        console.warn('Monitoring is not running');
        return true;
      }
      
      // Clear monitoring interval
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      
      // Clear monitoring state
      this.monitoredUsers.clear();
      
      console.log('Real-time risk monitoring stopped');
      return true;
    }
    catch (error) {
      console.error(`Error stopping real-time monitoring: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Check all monitored users for risk changes
   * @returns {Promise<Object>} Check results
   */
  async checkMonitoredUsers() {
    try {
      console.log('Checking monitored users for risk changes');
      
      const results = {
        checked: 0,
        updated: 0,
        alerts: 0,
        errors: 0
      };
      
      // Check each monitored user
      for (const [userAddress, userData] of this.monitoredUsers.entries()) {
        try {
          // Check if enough time has passed since last check
          const now = new Date();
          const timeSinceLastCheck = now - userData.lastChecked;
          
          if (timeSinceLastCheck < this.enhancedConfig.monitoringIntervalMs) {
            continue;
          }
          
          // Update last checked time
          userData.lastChecked = now;
          
          // Get current risk score
          const currentScore = await this.getLastRiskScore(userAddress);
          
          // Get fresh assessment
          const freshAssessment = await this.assessRisk(userAddress, {
            updateOnChain: false,
            generateZkProof: false,
            useCachedData: false
          });
          
          // Check if score has changed significantly
          const scoreChange = Math.abs(freshAssessment.riskScore - userData.lastScore);
          
          if (scoreChange >= this.enhancedConfig.riskScoreChangeThreshold) {
            console.log(`Significant risk change detected for ${userAddress}: ${userData.lastScore} -> ${freshAssessment.riskScore}`);
            
            // Record the change on Tangle
            await this.recordToIotaTangle('RISK_SCORE_CHANGE', {
              address: userAddress,
              previousScore: userData.lastScore,
              newScore: freshAssessment.riskScore,
              change: scoreChange,
              timestamp: new Date().toISOString()
            });
            
            // Update on-chain if monitoring contract is available
            if (this.riskMonitoring) {
              try {
                await this.riskMonitoring.reportRiskChange(
                  userAddress,
                  freshAssessment.riskScore,
                  userData.lastScore
                );
                
                results.updated++;
              } catch (contractError) {
                console.error(`Error updating on-chain risk monitoring: ${contractError.message}`);
              }
            }
            
            // If exceeds high threshold, trigger alert
            if (scoreChange >= this.enhancedConfig.riskScoreChangeThreshold * 2) {
              await this.triggerRiskAlert(
                userAddress,
                userData.lastScore,
                freshAssessment.riskScore
              );
              
              results.alerts++;
            }
            
            // Update last score
            userData.lastScore = freshAssessment.riskScore;
          }
          
          results.checked++;
        } catch (error) {
          console.error(`Error checking user ${userAddress}: ${error.message}`);
          results.errors++;
        }
      }
      
      console.log(`Monitoring check complete: checked ${results.checked}, updated ${results.updated}, alerts ${results.alerts}, errors ${results.errors}`);
      
      return results;
    }
    catch (error) {
      console.error(`Error checking monitored users: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Trigger a risk alert for significant changes
   * @param {string} userAddress - User's address
   * @param {number} oldScore - Previous risk score
   * @param {number} newScore - New risk score
   * @returns {Promise<Object>} Alert result
   */
  async triggerRiskAlert(userAddress, oldScore, newScore) {
    try {
      console.log(`Triggering risk alert for ${userAddress}: ${oldScore} -> ${newScore}`);
      
      // Record alert on Tangle
      const tangleResult = await this.recordToIotaTangle('RISK_ALERT', {
        address: userAddress,
        previousScore: oldScore,
        newScore: newScore,
        change: Math.abs(newScore - oldScore),
        severity: newScore > oldScore ? 'increasing' : 'decreasing',
        timestamp: new Date().toISOString()
      });
      
      // Trigger on-chain alert if contract available
      let contractResult = null;
      if (this.riskMonitoring) {
        try {
          const tx = await this.riskMonitoring.triggerRiskAlert(
            userAddress,
            newScore,
            oldScore
          );
          
          const receipt = await tx.wait();
          
          contractResult = {
            transactionHash: receipt.transactionHash,
            blockNumber: receipt.blockNumber
          };
          
          console.log(`Alert recorded on-chain: ${receipt.transactionHash}`);
        } catch (contractError) {
          console.error(`Error recording alert on-chain: ${contractError.message}`);
        }
      }
      
      return {
        userAddress,
        oldScore,
        newScore,
        change: Math.abs(newScore - oldScore),
        timestamp: new Date().toISOString(),
        tangleResult,
        contractResult
      };
    }
    catch (error) {
      console.error(`Error triggering risk alert: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Get list of active borrowers to monitor
   * @returns {Promise<string[]>} Array of borrower addresses
   */
  async getActiveBorrowers() {
    try {
      // Check if lending pool contract is available
      if (!this.lendingPool) {
        console.warn('LendingPool contract not available, using backup method');
        return await this.getActiveBorrowersFromTangle();
      }
      
      // Get Borrow events from the lending pool
      const filter = this.lendingPool.filters.Borrow();
      const events = await this.lendingPool.queryFilter(filter);
      
      // Extract unique borrower addresses with active loans
      const borrowers = new Set();
      
      for (const event of events) {
        // Check if borrower still has an active loan
        const borrows = await this.lendingPool.borrows(event.args.borrower);
        
        if (borrows.gt(0)) {
          borrowers.add(event.args.borrower);
        }
      }
      
      return Array.from(borrowers);
    }
    catch (error) {
      console.error(`Error getting active borrowers: ${error.message}`);
      
      // Fallback to Tangle data
      return this.getActiveBorrowersFromTangle();
    }
  }
  
  /**
   * Get active borrowers from Tangle records
   * @returns {Promise<string[]>} Array of borrower addresses
   */
  async getActiveBorrowersFromTangle() {
    try {
      console.log('Getting active borrowers from Tangle');
      
      // Check if IOTA client is available
      if (!this.iotaClient) {
        return [];
      }
      
      // Search for loan records on the Tangle
      const tag = Buffer.from('LOAN_STATUS').toString('hex');
      
      // Query for messages with this tag
      const messages = await getAddressTransactions(this.iotaClient, tag);
      
      // Extract active borrowers
      const borrowers = new Set();
      
      for (const message of messages) {
        try {
          const data = JSON.parse(Buffer.from(message.data, 'hex').toString());
          
          if (data.status === 'active' && data.borrowerAddress) {
            borrowers.add(data.borrowerAddress);
          }
        } catch (error) {
          // Skip invalid messages
          continue;
        }
      }
      
      return Array.from(borrowers);
    }
    catch (error) {
      console.error(`Error getting active borrowers from Tangle: ${error.message}`);
      return [];
    }
  }
  
  /**
   * Get the last known risk score for a user
   * @param {string} userAddress - User's address
   * @returns {Promise<number>} Risk score
   */
  async getLastRiskScore(userAddress) {
    try {
      // Check cache first
      if (this.lastScoreUpdates.has(userAddress)) {
        return this.lastScoreUpdates.get(userAddress);
      }
      
      // Try to get from contract
      if (this.lendingPool) {
        try {
          const score = await this.lendingPool.riskScores(userAddress);
          const scoreNumber = score.toNumber();
          
          // Update cache
          this.lastScoreUpdates.set(userAddress, scoreNumber);
          
          return scoreNumber;
        } catch (contractError) {
          console.warn(`Error getting risk score from contract: ${contractError.message}`);
        }
      }
      
      // Try to get from Tangle
      try {
        const tangleScore = await this.getLastRiskScoreFromTangle(userAddress);
        
        if (tangleScore !== null) {
          // Update cache
          this.lastScoreUpdates.set(userAddress, tangleScore);
          
          return tangleScore;
        }
      } catch (tangleError) {
        console.warn(`Error getting risk score from Tangle: ${tangleError.message}`);
      }
      
      // Default to medium risk
      return 50;
    }
    catch (error) {
      console.error(`Error getting last risk score for ${userAddress}: ${error.message}`);
      return 50; // Default to medium risk
    }
  }
  
  /**
   * Get the last risk score from Tangle records
   * @param {string} userAddress - User's address
   * @returns {Promise<number|null>} Risk score or null if not found
   */
  async getLastRiskScoreFromTangle(userAddress) {
    try {
      // Check if IOTA client is available
      if (!this.iotaClient) {
        return null;
      }
      
      // Search for risk score records on the Tangle
      const tag = Buffer.from('RISK_SCORE_UPDATE').toString('hex');
      
      // Query for messages with this tag
      const messages = await getAddressTransactions(this.iotaClient, tag);
      
      // Find relevant messages
      const scoreRecords = [];
      
      for (const message of messages) {
        try {
          const data = JSON.parse(Buffer.from(message.data, 'hex').toString());
          
          if (data.address && data.address.toLowerCase() === userAddress.toLowerCase() && 
              data.score !== undefined) {
            scoreRecords.push({
              score: data.score,
              timestamp: data.timestamp || Date.now()
            });
          }
        } catch (error) {
          // Skip invalid messages
          continue;
        }
      }
      
      // Sort by timestamp, newest first
      scoreRecords.sort((a, b) => {
        return new Date(b.timestamp) - new Date(a.timestamp);
      });
      
      // Return the latest score or null if not found
      return scoreRecords.length > 0 ? scoreRecords[0].score : null;
    }
    catch (error) {
      console.error(`Error getting risk score from Tangle: ${error.message}`);
      return null;
    }
  }
  
  /**
   * Enhanced risk assessment with IOTA data integration
   * @param {string} userAddress - Ethereum address of the user
   * @param {Object} options - Options for risk assessment
   * @param {boolean} options.updateOnChain - Whether to update the risk score on-chain
   * @param {boolean} options.generateZkProof - Whether to generate a ZK proof for privacy
   * @param {boolean} options.useCachedData - Whether to use cached on-chain data
   * @param {boolean} options.includeIotaData - Whether to include IOTA data (default: true)
   * @param {boolean} options.includeCrossChainData - Whether to include cross-chain data (default: true)
   * @returns {Promise<Object>} Enhanced risk assessment results
   */
  async assessRisk(userAddress, options = {}) {
    const {
      updateOnChain = false,
      generateZkProof = false,
      useCachedData = false,
      includeIotaData = true,
      includeCrossChainData = true
    } = options;
    
    try {
      console.log(`Enhanced risk assessment for user: ${userAddress}`);
      
      // Get basic on-chain data from the parent class
      const userData = await this.fetchUserData(userAddress, useCachedData);
      
      // Add IOTA Layer 1 data if enabled
      if (includeIotaData && this.iotaClient) {
        const iotaData = await this.fetchIotaData(userAddress);
        userData.iotaData = iotaData;
      }
      
      // Add cross-chain oracle data if enabled
      if (includeCrossChainData && this.crossChainOracle) {
        const crossChainData = await this.fetchCrossChainData(userAddress);
        userData.crossChainData = crossChainData;
      }
      
      // Generate enhanced risk score using combined data
      const enhancedAssessment = await this.generateEnhancedRiskScore(userAddress, userData);
      
      // Update last known score
      this.lastScoreUpdates.set(userAddress, enhancedAssessment.riskScore);
      
      // Log the assessment result
      console.log(`Enhanced risk assessment generated for ${userAddress}: ${enhancedAssessment.riskScore}`);
      
      // Update on-chain risk score if requested
      if (updateOnChain) {
        // Check if risk score has changed significantly
        const currentOnChainScore = await this.getLastRiskScore(userAddress);
        const onChainScoreChanged = Math.abs(
          currentOnChainScore - enhancedAssessment.riskScore
        ) >= 5; // Only update if changed by at least 5 points
        
        if (onChainScoreChanged) {
          if (generateZkProof) {
            // Generate ZK proof for privacy-preserving update
            await this.updateRiskScoreWithZkProof(userAddress, enhancedAssessment);
          } else {
            // Regular risk score update
            await this.updateRiskScore(userAddress, enhancedAssessment.riskScore);
          }
        } else {
          console.log('Risk score unchanged, skipping on-chain update');
        }
      }
      
      return enhancedAssessment;
    } catch (error) {
      console.error('Error in enhanced risk assessment:', error);
      
      // Fall back to the original assessment method
      console.log('Falling back to basic risk assessment');
      return super.assessRisk(userAddress, {
        updateOnChain,
        generateZkProof,
        useCachedData
      });
    }
  }
  
  /**
   * Fetch IOTA (Layer 1) data for a user
   * @param {string} userAddress - Ethereum address of the user
   * @returns {Promise<Object>} IOTA data
   */
  async fetchIotaData(userAddress) {
    try {
      console.log(`Fetching IOTA data for ${userAddress}`);
      
      // Check cache first
      const cacheKey = `iota_${userAddress}`;
      if (this.tangleDataCache.has(cacheKey)) {
        const cachedData = this.tangleDataCache.get(cacheKey);
        
        // Use cache if it's less than 5 minutes old
        if (Date.now() - cachedData.timestamp < 300000) {
          return cachedData.data;
        }
      }
      
      // Find the corresponding IOTA address (if available)
      const iotaAddress = await this.findIotaAddress(userAddress);
      
      if (!iotaAddress) {
        console.warn(`No IOTA address found for ${userAddress}, using partial data`);
      }
      
      // Initialize IOTA data object
      const iotaData = {
        address: iotaAddress,
        transactions: [],
        totalBalance: '0',
        reputationScore: 0,
        activityMetrics: {
          transactionCount: 0,
          lastActivity: null,
          firstActivity: null,
          transactionFrequency: 0
        },
        trustIndicators: []
      };
      
      // Get all Tangle data related to this user (with or without IOTA address)
      const tangleData = await this.fetchTangleData(userAddress, iotaAddress);
      
      // Process and integrate Tangle data
      if (tangleData.transactions.length > 0) {
        iotaData.transactions = tangleData.transactions;
        iotaData.activityMetrics.transactionCount = tangleData.transactions.length;
        
        // Sort transactions by timestamp
        const sortedTransactions = [...tangleData.transactions]
          .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        
        iotaData.activityMetrics.firstActivity = sortedTransactions[0].timestamp;
        iotaData.activityMetrics.lastActivity = sortedTransactions[sortedTransactions.length - 1].timestamp;
        
        // Calculate transaction frequency (tx per day)
        const firstDate = new Date(iotaData.activityMetrics.firstActivity);
        const lastDate = new Date(iotaData.activityMetrics.lastActivity);
        const daysDiff = Math.max(1, (lastDate - firstDate) / (1000 * 60 * 60 * 24));
        iotaData.activityMetrics.transactionFrequency = iotaData.activityMetrics.transactionCount / daysDiff;
      }
      
      // Get balance if IOTA address is available and client is connected
      if (iotaAddress && this.iotaClient) {
        try {
          const balance = await this.iotaClient.getAddressBalance(iotaAddress);
          iotaData.totalBalance = balance.toString();
        } catch (balanceError) {
          console.warn(`Error getting IOTA balance: ${balanceError.message}`);
        }
      }
      
      // Extract trust indicators
      iotaData.trustIndicators = this.extractTrustIndicators(tangleData);
      
      // Calculate reputation score
      iotaData.reputationScore = this.calculateIotaReputationScore(iotaData);
      
      // Cache the result
      this.tangleDataCache.set(cacheKey, {
        data: iotaData,
        timestamp: Date.now()
      });
      
      return iotaData;
    }
    catch (error) {
      console.error(`Error fetching IOTA data for ${userAddress}: ${error.message}`);
      
      // Return minimal data structure on error
      return {
        address: null,
        transactions: [],
        totalBalance: '0',
        reputationScore: 0,
        activityMetrics: {
          transactionCount: 0,
          lastActivity: null,
          firstActivity: null,
          transactionFrequency: 0
        },
        trustIndicators: []
      };
    }
  }
  
  /**
   * Find the IOTA address corresponding to an Ethereum address
   * @param {string} evmAddress - Ethereum address
   * @returns {Promise<string|null>} IOTA address or null if not found
   */
  async findIotaAddress(evmAddress) {
    try {
      // Check if cross-chain bridge is available
      if (this.crossLayerBridge) {
        try {
          const iotaAddress = await this.crossLayerBridge.getIotaAddress(evmAddress);
          
          if (iotaAddress && iotaAddress !== '0x0000000000000000000000000000000000000000000000000000000000000000') {
            // Convert bytes32 to address string
            const addressString = ethers.utils.toUtf8String(iotaAddress).replace(/\0+$/, '');
            return addressString;
          }
        } catch (contractError) {
          console.warn(`Error getting IOTA address from contract: ${contractError.message}`);
        }
      }
      
      // Search for address mappings on the Tangle
      const mappings = await this.findAddressMappingsOnTangle();
      
      for (const mapping of mappings) {
        if (mapping.evmAddress.toLowerCase() === evmAddress.toLowerCase()) {
          return mapping.iotaAddress;
        }
      }
      
      return null;
    }
    catch (error) {
      console.error(`Error finding IOTA address: ${error.message}`);
      return null;
    }
  }
  
  /**
   * Find address mappings on the Tangle
   * @returns {Promise<Array>} Array of address mappings
   */
  async findAddressMappingsOnTangle() {
    try {
      // Check if IOTA client is available
      if (!this.iotaClient) {
        return [];
      }
      
      // Search for address mapping records on the Tangle
      const tag = Buffer.from('ADDRESS_MAPPING').toString('hex');
      
      // Query for messages with this tag
      const messages = await getAddressTransactions(this.iotaClient, tag);
      
      // Find relevant messages
      const mappings = [];
      
      for (const message of messages) {
        try {
          const data = JSON.parse(Buffer.from(message.data, 'hex').toString());
          
          if (data.evmAddress && data.iotaAddress) {
            mappings.push({
              evmAddress: data.evmAddress,
              iotaAddress: data.iotaAddress,
              timestamp: data.timestamp || Date.now()
            });
          }
        } catch (error) {
          // Skip invalid messages
          continue;
        }
      }
      
      return mappings;
    }
    catch (error) {
      console.error(`Error finding address mappings: ${error.message}`);
      return [];
    }
  }
  
  /**
   * Fetch all Tangle data related to a user
   * @param {string} evmAddress - Ethereum address
   * @param {string|null} iotaAddress - IOTA address (if available)
   * @returns {Promise<Object>} Tangle data
   */
  async fetchTangleData(evmAddress, iotaAddress = null) {
    try {
      console.log(`Fetching Tangle data for ${evmAddress}`);
      
      // Check if IOTA client is available
      if (!this.iotaClient) {
        return { transactions: [] };
      }
      
      // Tags to search for
      const tags = [
        'RISK_SCORE_UPDATE',
        'VERIFICATION_STATUS',
        'LOAN_STATUS',
        'REPAYMENT',
        'COLLATERAL_UPDATE',
        'CROSS_LAYER_DEPOSIT',
        'CROSS_LAYER_WITHDRAWAL'
      ];
      
      // Collect all relevant transactions
      const transactions = [];
      
      // Search for messages with each tag
      for (const tagName of tags) {
        const tag = Buffer.from(tagName).toString('hex');
        
        try {
          // Query for messages with this tag
          const messages = await getAddressTransactions(this.iotaClient, tag);
          
          // Filter and parse messages
          for (const message of messages) {
            try {
              const data = JSON.parse(Buffer.from(message.data, 'hex').toString());
              
              // Check if this message is related to the user (by EVM or IOTA address)
              const isRelated = 
                (data.address && data.address.toLowerCase() === evmAddress.toLowerCase()) ||
                (data.evmAddress && data.evmAddress.toLowerCase() === evmAddress.toLowerCase()) ||
                (iotaAddress && data.iotaAddress === iotaAddress) ||
                (data.borrowerAddress && data.borrowerAddress.toLowerCase() === evmAddress.toLowerCase());
              
              if (isRelated) {
                transactions.push({
                  blockId: message.blockId,
                  tag: tagName,
                  data,
                  timestamp: data.timestamp || Date.now()
                });
              }
            } catch (error) {
              // Skip invalid messages
              continue;
            }
          }
        } catch (error) {
          console.warn(`Error fetching messages for tag ${tagName}: ${error.message}`);
        }
      }
      
      console.log(`Found ${transactions.length} Tangle transactions related to ${evmAddress}`);
      
      return { transactions };
    }
    catch (error) {
      console.error(`Error fetching Tangle data: ${error.message}`);
      return { transactions: [] };
    }
  }
  
  /**
   * Extract trust indicators from Tangle data
   * @param {Object} tangleData - Tangle data
   * @returns {Array} Trust indicators
   */
  extractTrustIndicators(tangleData) {
    try {
      const indicators = [];
      
      // Check if there are any verification records
      const verifications = tangleData.transactions.filter(tx => 
        tx.tag === 'VERIFICATION_STATUS' && 
        tx.data.status === true
      );
      
      if (verifications.length > 0) {
        indicators.push({
          type: 'identity_verified',
          value: true,
          weight: 0.2, // 20% boost for verified identity
          source: 'tangle'
        });
      }
      
      // Check repayment history
      const repayments = tangleData.transactions.filter(tx => 
        tx.tag === 'REPAYMENT'
      );
      
      if (repayments.length > 3) {
        indicators.push({
          type: 'consistent_repayment',
          value: true,
          weight: 0.15, // 15% boost for consistent repayment
          source: 'tangle'
        });
      }
      
      // Check if collateral has been increased
      const collateralIncreases = tangleData.transactions.filter(tx => 
        tx.tag === 'COLLATERAL_UPDATE' && 
        tx.data.action === 'increase'
      );
      
      if (collateralIncreases.length > 0) {
        indicators.push({
          type: 'collateral_increases',
          value: collateralIncreases.length,
          weight: 0.1, // 10% boost for collateral increases
          source: 'tangle'
        });
      }
      
      // Check for loan status
      const activeLoanCount = tangleData.transactions.filter(tx => 
        tx.tag === 'LOAN_STATUS' && 
        tx.data.status === 'active'
      ).length;
      
      const completedLoanCount = tangleData.transactions.filter(tx => 
        tx.tag === 'LOAN_STATUS' && 
        tx.data.status === 'completed'
      ).length;
      
      if (completedLoanCount > 0) {
        indicators.push({
          type: 'completed_loans',
          value: completedLoanCount,
          weight: 0.15, // 15% boost for each completed loan
          source: 'tangle'
        });
      }
      
      if (activeLoanCount > 2) {
        indicators.push({
          type: 'many_active_loans',
          value: activeLoanCount,
          weight: -0.1, // 10% penalty for many active loans
          source: 'tangle'
        });
      }
      
      return indicators;
    }
    catch (error) {
      console.error(`Error extracting trust indicators: ${error.message}`);
      return [];
    }
  }
  
  /**
   * Calculate IOTA reputation score from data
   * @param {Object} iotaData - IOTA data
   * @returns {number} Reputation score (0-100)
   */
  calculateIotaReputationScore(iotaData) {
    try {
      // Base score is 50 (neutral)
      let score = 50;
      
      // Add points for activity metrics
      if (iotaData.activityMetrics.transactionCount > 0) {
        // More transactions = more data = more reliable score
        const transactionFactor = Math.min(20, iotaData.activityMetrics.transactionCount / 2);
        score += transactionFactor;
        
        // Regular activity is good
        if (iotaData.activityMetrics.transactionFrequency > 0.5) { // More than 1 tx every 2 days
          score += 10;
        }
      }
      
      // Apply trust indicators
      for (const indicator of iotaData.trustIndicators) {
        // Positive indicators increase score, negative decrease
        score += 100 * indicator.weight;
      }
      
      // Ensure score is within bounds
      return Math.max(0, Math.min(100, Math.round(score)));
    }
    catch (error) {
      console.error(`Error calculating IOTA reputation score: ${error.message}`);
      return 50; // Default to neutral
    }
  }
  
  /**
   * Fetch cross-chain oracle data
   * @param {string} userAddress - Ethereum address of the user
   * @returns {Promise<Object>} Cross-chain data
   */
  async fetchCrossChainData(userAddress) {
    try {
      console.log(`Fetching cross-chain data for ${userAddress}`);
      
      // Initialize results object
      const results = {
        externalCreditScore: null,
        marketRiskIndicators: {},
        crossChainCollateral: {},
        crossChainActivity: {}
      };
      
      // Get data from cross-chain oracle if available
      if (this.crossChainOracle) {
        try {
          // Get credit score
          const creditScore = await this.crossChainOracle.getCreditScore(userAddress);
          results.externalCreditScore = creditScore.toNumber();
          
          // Get market risk indicators
          const marketRisk = await this.crossChainOracle.getMarketRiskData(userAddress);
          results.marketRiskIndicators = {
            volatilityIndex: marketRisk.volatilityIndex.toNumber(),
            marketSentiment: marketRisk.sentiment.toNumber(),
            liquidityRisk: marketRisk.liquidityRisk.toNumber()
          };
          
          // Get cross-chain collateral if available
          try {
            const collateral = await this.crossChainOracle.getCrossChainCollateral(userAddress);
            
            // Format collateral data
            for (let i = 0; i < collateral.chains.length; i++) {
              results.crossChainCollateral[collateral.chains[i]] = {
                amount: ethers.utils.formatEther(collateral.amounts[i]),
                assetType: collateral.assetTypes[i],
                lastUpdate: new Date(collateral.lastUpdated[i].toNumber() * 1000).toISOString()
              };
            }
          } catch (collateralError) {
            console.warn(`Error getting cross-chain collateral: ${collateralError.message}`);
          }
          
          // Get cross-chain activity if available
          try {
            const activity = await this.crossChainOracle.getCrossChainActivity(userAddress);
            
            // Format activity data
            for (let i = 0; i < activity.chains.length; i++) {
              results.crossChainActivity[activity.chains[i]] = {
                transactionCount: activity.transactionCounts[i].toNumber(),
                lastActivity: new Date(activity.lastActivity[i].toNumber() * 1000).toISOString(),
                failureRate: activity.failureRates[i].toNumber() / 100 // Convert basis points to percentage
              };
            }
          } catch (activityError) {
            console.warn(`Error getting cross-chain activity: ${activityError.message}`);
          }
        } catch (oracleError) {
          console.warn(`Error getting data from cross-chain oracle: ${oracleError.message}`);
        }
      }
      
      // If oracle data is missing, try to get from external sources
      if (results.externalCreditScore === null) {
        try {
          results.externalCreditScore = await this.getExternalCreditScore(userAddress);
        } catch (externalError) {
          console.warn(`Error getting external credit score: ${externalError.message}`);
        }
      }
      
      return results;
    }
    catch (error) {
      console.error(`Error fetching cross-chain data: ${error.message}`);
      
      // Return minimal data structure on error
      return {
        externalCreditScore: null,
        marketRiskIndicators: {},
        crossChainCollateral: {},
        crossChainActivity: {}
      };
    }
  }
  
  /**
   * Get external credit score from third-party API
   * @param {string} userAddress - Ethereum address of the user
   * @returns {Promise<number|null>} Credit score or null if not available
   */
  async getExternalCreditScore(userAddress) {
    try {
      // Find the credit score API in external data sources
      const creditScoreApi = this.externalDataSources.find(
        source => source.name === 'Credit Score API' && source.enabled
      );
      
      if (!creditScoreApi) {
        return null;
      }
      
      // Call the API
      const response = await axios.get(
        `${creditScoreApi.endpoint}/score/${userAddress}`,
        {
          headers: {
            'Authorization': `Bearer ${creditScoreApi.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (response.data && response.data.score) {
        return response.data.score;
      }
      
      return null;
    }
    catch (error) {
      console.error(`Error getting external credit score: ${error.message}`);
      return null;
    }
  }
  
  /**
   * Generate enhanced risk score using combined data from multiple sources
   * @param {string} userAddress - Ethereum address of the user
   * @param {Object} userData - Combined user data
   * @returns {Promise<Object>} Enhanced risk assessment
   */
  async generateEnhancedRiskScore(userAddress, userData) {
    try {
      console.log(`Generating enhanced risk score for ${userAddress}`);
      
      let riskAssessment;
      
      // First check if we have IOTA data
      const iotaDataAvailable = userData.iotaData && 
                               userData.iotaData.address && 
                               userData.iotaData.transactions &&
                               userData.iotaData.transactions.length > 0;
      
      // Attempt to get cross-chain data if not already present
      if (!userData.crossChainData && this.crossChainOracle) {
        try {
          userData.crossChainData = await this.fetchCrossChainData(userAddress);
        } catch (error) {
          console.warn(`Could not fetch cross-chain data: ${error.message}`);
        }
      }
      
      // Use appropriate model depending on available data
      if (this.useLocalModel) {
        // Use local Python model with enhanced data
        if (iotaDataAvailable) {
          // Use IOTA-enhanced model
          try {
            console.log('Using IOTA-enhanced local model');
            riskAssessment = await this.runEnhancedLocalRiskModel(userData);
          } catch (error) {
            console.warn(`IOTA model failed: ${error.message}, falling back to standard model`);
            riskAssessment = await this.runLocalRiskModel(userData);
          }
        } else {
          // Use standard model
          riskAssessment = await this.runLocalRiskModel(userData);
        }
      } else {
        // Use remote API with enhanced data
        try {
          riskAssessment = await this.callEnhancedRiskAPI(userData);
        } catch (error) {
          console.warn(`Enhanced API failed: ${error.message}, falling back to standard API`);
          riskAssessment = await this.callRiskAPI(userData);
        }
      }
      
      // If model execution fails, use weighted factor approach
      if (!riskAssessment) {
        console.warn('Model execution failed, using weighted factor approach');
        riskAssessment = this.generateWeightedRiskScore(userData);
      }
      
      // Add IOTA-specific recommendations if applicable
      if (iotaDataAvailable) {
        riskAssessment = this.addIotaRecommendations(riskAssessment, userData.iotaData);
      }
      
      // Record assessment to IOTA Tangle for audit trail
      try {
        if (this.iotaClient) {
          // Don't include full user data in the record, just the assessment result
          const tangleRecord = {
            address: userAddress,
            riskScore: riskAssessment.riskScore,
            timestamp: Date.now(),
            modelVersion: '2.0.0-enhanced',
            factorCount: riskAssessment.factors ? riskAssessment.factors.length : 0,
            usedIotaData: iotaDataAvailable
          };
          
          await this.recordToIotaTangle('RISK_ASSESSMENT', tangleRecord);
          console.log('Risk assessment recorded to IOTA Tangle');
        }
      } catch (error) {
        console.warn(`Failed to record assessment to Tangle: ${error.message}`);
      }
      
      // Add metadata
      riskAssessment.timestamp = Date.now();
      riskAssessment.modelVersion = '2.0.0-enhanced';
      riskAssessment.dataQuality = {
        usedRealIotaData: iotaDataAvailable,
        usedCrossChainData: !!userData.crossChainData,
        confidenceAdjustment: iotaDataAvailable ? +0.15 : 0
      };
      
      // Adjust confidence if we have IOTA data
      if (iotaDataAvailable && riskAssessment.confidence) {
        riskAssessment.confidence = Math.min(1.0, riskAssessment.confidence + 0.15);
      }
      
      return riskAssessment;
    }
    catch (error) {
      console.error(`Error generating enhanced risk score for ${userAddress}: ${error.message}`);
      
      // Fall back to original risk score calculation
      return this.fallbackRiskCalculation(userData);
    }
  }
  
  /**
   * Add IOTA-specific recommendations to risk assessment
   * @param {Object} assessment - Risk assessment
   * @param {Object} iotaData - IOTA data
   * @returns {Object} Updated risk assessment with IOTA recommendations
   */
  addIotaRecommendations(assessment, iotaData) {
    console.log('Adding IOTA-specific recommendations');
    
    if (!assessment.recommendations) {
      assessment.recommendations = [];
    }
    
    // Add recommendation to increase IOTA transaction frequency if low
    if (iotaData.activityMetrics.transactionFrequency < 0.5) { // Less than 1 tx every 2 days
      assessment.recommendations.push({
        title: 'Increase IOTA Transaction Activity',
        description: 'Regular transactions on the IOTA network improve your on-chain reputation.',
        impact: 'medium',
        type: 'network',
        details: 'Your transaction frequency is currently lower than optimal. Aim for at least one transaction every 2 days to build a stronger reputation score.'
      });
    }
    
    // Add recommendation to use IOTA Streams if not used
    const usesStreams = iotaData.transactions.some(tx => tx.tag === 'STREAMS_MESSAGE');
    if (!usesStreams) {
      assessment.recommendations.push({
        title: 'Utilize IOTA Streams for Secure Messaging',
        description: 'IOTA Streams provides secure, verifiable communication channels.',
        impact: 'low',
        type: 'network',
        details: 'Using IOTA Streams for secure messaging demonstrates advanced usage of the network and can positively impact your risk profile.'
      });
    }
    
    // Add recommendation to diversify IOTA activity if limited
    const uniqueTags = new Set(iotaData.transactions.map(tx => tx.tag)).size;
    if (uniqueTags < 3) {
      assessment.recommendations.push({
        title: 'Diversify IOTA Network Activity',
        description: 'Utilizing multiple IOTA features improves your network reputation.',
        impact: 'medium',
        type: 'network',
        details: 'Your IOTA usage is currently limited to few transaction types. Consider exploring identity, streams, and smart contracts to build a more diverse profile.'
      });
    }
    
    return assessment;
  }
  
  /**
   * Run enhanced local Python risk model
   * @param {Object} userData - Enhanced user data
   * @returns {Promise<Object>} Risk assessment results
   */
  async runEnhancedLocalRiskModel(userData) {
    return new Promise((resolve, reject) => {
      // Save user data to temporary file for Python model
      const tempFile = path.join(this.modelPath, `temp_enhanced_${Date.now()}.json`);
      
      fs.writeFile(tempFile, JSON.stringify(userData))
        .then(() => {
          // Run Python model process
          const pythonProcess = spawn('python', [
            path.join(this.modelPath, 'enhanced_risk_model.py'),
            '--input', tempFile,
            '--mode', 'predict'
          ]);
          
          let outputData = '';
          let errorData = '';
          
          pythonProcess.stdout.on('data', (data) => {
            outputData += data.toString();
          });
          
          pythonProcess.stderr.on('data', (data) => {
            errorData += data.toString();
          });
          
          pythonProcess.on('close', (code) => {
            // Clean up temporary file
            fs.unlink(tempFile).catch(err => console.warn('Error deleting temp file:', err));
            
            if (code !== 0) {
              console.error(`Python model exited with code ${code}`);
              console.error(`Error: ${errorData}`);
              reject(new Error(`Model execution failed with code ${code}: ${errorData}`));
              return;
            }
            
            try {
              // Parse output JSON
              const result = JSON.parse(outputData);
              resolve(result);
            } catch (error) {
              console.error('Error parsing model output:', error);
              reject(error);
            }
          });
        })
        .catch(reject);
    });
  }
  
  /**
   * Call enhanced risk assessment API
   * @param {Object} userData - Enhanced user data
   * @returns {Promise<Object>} Risk assessment results
   */
  async callEnhancedRiskAPI(userData) {
    try {
      console.log(`Calling enhanced risk API for ${userData.address}`);
      
      const response = await axios.post(
        `${this.apiUrl}/api/enhanced-risk-assessment`,
        userData
      );
      
      return response.data;
    } catch (error) {
      console.error('Error calling enhanced risk API:', error);
      throw error;
    }
  }
  
  /**
   * Generate a weighted risk score from multiple data sources
   * @param {Object} userData - Combined user data
   * @returns {Object} Risk assessment
   */
  generateWeightedRiskScore(userData) {
    try {
      console.log(`Generating weighted risk score for ${userData.address}`);
      
      // Base score calculation components
      let evmScore = 50; // Default neutral score
      let iotaScore = null;
      let crossChainScore = null;
      
      // Weights for combining scores (should sum to 1)
      const weights = {
        evm: 0.5, // 50% weight for EVM data
        iota: this.enhancedConfig.tangleDataWeight, // Configurable weight for IOTA data
        crossChain: 1 - 0.5 - this.enhancedConfig.tangleDataWeight // Remaining weight
      };
      
      // Calculate EVM-based score (similar to original fallback)
      if (userData.collateralRatio !== undefined) {
        // Adjust based on collateral ratio
        if (userData.collateralRatio === Infinity) {
          // No borrows, very low risk
          evmScore -= 20;
        } else if (userData.collateralRatio > 2) {
          // Well collateralized
          evmScore -= 15;
        } else if (userData.collateralRatio > 1.5) {
          // Adequately collateralized
          evmScore -= 5;
        } else if (userData.collateralRatio < 1.2) {
          // Thinly collateralized
          evmScore += 15;
        }
      }
      
      if (userData.utilizationRatio !== undefined) {
        // Adjust based on utilization
        if (userData.utilizationRatio > 0.8) {
          // High utilization
          evmScore += 10;
        } else if (userData.utilizationRatio < 0.3) {
          // Low utilization
          evmScore -= 5;
        }
      }
      
      // Adjust for identity verification
      if (userData.identityVerified) {
        evmScore -= 10;
      }
      
      // Use IOTA reputation score if available
      if (userData.iotaData && userData.iotaData.reputationScore !== undefined) {
        iotaScore = userData.iotaData.reputationScore;
      }
      
      // Use cross-chain data if available
      if (userData.crossChainData) {
        // Calculate cross-chain score
        let tempScore = 50; // Start with neutral
        
        // Use external credit score if available
        if (userData.crossChainData.externalCreditScore !== null) {
          // Convert external credit score (typically 300-850) to our scale (0-100)
          const normalizedScore = Math.min(100, Math.max(0, 
            (userData.crossChainData.externalCreditScore - 300) / (850 - 300) * 100
          ));
          
          // Lower is riskier on our scale
          tempScore = 100 - normalizedScore;
        }
        
        // Use market risk indicators if available
        if (userData.crossChainData.marketRiskIndicators.volatilityIndex !== undefined) {
          // Higher volatility = higher risk
          tempScore += userData.crossChainData.marketRiskIndicators.volatilityIndex / 10;
        }
        
        if (userData.crossChainData.marketRiskIndicators.liquidityRisk !== undefined) {
          // Higher liquidity risk = higher risk
          tempScore += userData.crossChainData.marketRiskIndicators.liquidityRisk / 5;
        }
        
        // Check cross-chain activity
        if (userData.crossChainData.crossChainActivity) {
          const activityCount = Object.values(userData.crossChainData.crossChainActivity).length;
          
          if (activityCount > 0) {
            // More chains = more diversified = lower risk
            tempScore -= Math.min(15, activityCount * 5);
            
            // Check failure rates across chains
            const failureRates = Object.values(userData.crossChainData.crossChainActivity)
              .map(a => a.failureRate || 0);
            
            if (failureRates.length > 0) {
              const avgFailureRate = failureRates.reduce((sum, rate) => sum + rate, 0) / failureRates.length;
              
              // Higher failure rate = higher risk
              tempScore += avgFailureRate * 50;
            }
          }
        }
        
        // Ensure within bounds
        crossChainScore = Math.max(0, Math.min(100, tempScore));
      }
      
      // Calculate combined score with available components
      let combinedScore = evmScore * weights.evm;
      let totalWeight = weights.evm;
      
      if (iotaScore !== null) {
        combinedScore += iotaScore * weights.iota;
        totalWeight += weights.iota;
      }
      
      if (crossChainScore !== null) {
        combinedScore += crossChainScore * weights.crossChain;
        totalWeight += weights.crossChain;
      }
      
      // Normalize for missing components
      if (totalWeight > 0 && totalWeight < 1) {
        combinedScore = combinedScore / totalWeight;
      }
      
      // Round to nearest integer
      const finalScore = Math.round(combinedScore);
      
      // Create risk factors based on data
      const factors = [
        { feature: 'collateral_ratio', importance: 0.3 }
      ];
      
      if (iotaScore !== null) {
        factors.push({ feature: 'iota_reputation', importance: 0.25 });
      }
      
      if (userData.identityVerified) {
        factors.push({ feature: 'identity_verified', importance: 0.2 });
      }
      
      if (crossChainScore !== null) {
        factors.push({ feature: 'cross_chain_data', importance: 0.25 });
      }
      
      // Create recommendations
      const recommendations = [
        {
          title: 'Add more collateral',
          description: 'Consider adding more collateral to reduce your risk score',
          impact: 'high'
        }
      ];
      
      if (!userData.identityVerified) {
        recommendations.push({
          title: 'Verify your identity',
          description: 'Complete identity verification to improve your borrowing terms',
          impact: 'medium'
        });
      }
      
      // Add IOTA-specific recommendations if applicable
      if (userData.iotaData) {
        if (!userData.iotaData.address) {
          recommendations.push({
            title: 'Connect IOTA address',
            description: 'Link your IOTA address to your profile to improve your risk assessment',
            impact: 'medium'
          });
        } else if (userData.iotaData.transactions.length < 5) {
          recommendations.push({
            title: 'Increase IOTA activity',
            description: 'Conduct more transactions on IOTA to build your reputation',
            impact: 'medium'
          });
        }
      }
      
      return {
        riskScore: finalScore,
        confidence: iotaScore !== null && crossChainScore !== null ? 0.85 : 0.7,
        factors,
        recommendations,
        dataSourcesUsed: {
          evm: true,
          iota: iotaScore !== null,
          crossChain: crossChainScore !== null
        }
      };
    }
    catch (error) {
      console.error(`Error generating weighted risk score: ${error.message}`);
      
      // Fall back to original calculation
      return this.fallbackRiskCalculation(userData);
    }
  }
  
  /**
   * Record data to the IOTA Tangle
   * @param {string} tag - Message tag
   * @param {Object} data - Data to record
   * @returns {Promise<Object>} Result of the recording
   */
  async recordToIotaTangle(tag, data) {
    try {
      // Check if IOTA client is available
      if (!this.iotaClient) {
        console.warn('IOTA client not available, skipping Tangle recording');
        return null;
      }
      
      console.debug(`Recording ${tag} to IOTA Tangle`);
      
      // Create block with data payload
      const blockData = {
        payload: {
          type: 1, // Tagged data
          tag: Buffer.from(tag).toString('hex'),
          data: Buffer.from(JSON.stringify(data)).toString('hex')
        }
      };
      
      // Submit to IOTA Tangle
      const result = await submitBlock(this.iotaClient, blockData);
      console.debug(`Data submitted to IOTA Tangle: ${result.blockId}`);
      
      return result;
    }
    catch (error) {
      console.error(`Error recording to IOTA Tangle: ${error.message}`);
      return null;
    }
  }
}

module.exports = EnhancedAIIntegration;