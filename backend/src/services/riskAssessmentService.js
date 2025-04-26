/**
 * Risk Assessment Service
 * 
 * This module provides a service for risk assessment functionality,
 * connecting to the Python ML models via a REST API.
 */

const axios = require('axios');
const dotenv = require('dotenv');
const { ethers } = require('ethers');
const logger = require('../../utils/logger');
const { subprocess } = require('../../utils/subprocess');
const path = require('path');
const fs = require('fs').promises;

// Load environment variables
dotenv.config();

// Configuration
const API_URL = process.env.AI_API_URL || 'http://localhost:5000';
const USE_MOCKS = process.env.USE_MOCKS === 'true';
const USE_LOCAL_MODEL = process.env.USE_LOCAL_MODEL === 'true';
const AI_MODEL_PATH = process.env.AI_MODEL_PATH || '../ai-model/models';

class RiskAssessmentService {
    /**
     * Initialize the risk assessment service
     */
    constructor(options = {}) {
        this.apiUrl = options.apiUrl || API_URL;
        this.useMocks = options.useMocks || USE_MOCKS;
        this.useLocalModel = options.useLocalModel || USE_LOCAL_MODEL;
        this.modelPath = options.modelPath || AI_MODEL_PATH;
        this.apiProcess = null;
        this.apiHealthy = false;
        
        // IOTA integration properties
        this.iotaClient = null;
        this.iotaAccount = null;
        
        // Cache for risk assessments
        this.riskCache = new Map();
        this.lastCheck = Date.now();
        
        // Start the API server if using local model
        if (this.useLocalModel) {
            this.startApiServer();
        }
        
        // Start periodic health check
        this.startHealthCheck();
        
        logger.info('Risk Assessment Service initialized');
    }
    
    /**
     * Set the IOTA client for Tangle operations
     * @param {Object} client - IOTA client instance
     */
    setIotaClient(client) {
        this.iotaClient = client;
        logger.debug('IOTA client set in Risk Assessment Service');
    }
    
    /**
     * Set the IOTA account for wallet operations
     * @param {Object} account - IOTA account instance
     */
    setIotaAccount(account) {
        this.iotaAccount = account;
        logger.debug('IOTA account set in Risk Assessment Service');
    }
    
    /**
     * Start the API server process if not already running
     */
    async startApiServer() {
        try {
            // Check if API is already running
            const isRunning = await this.checkApiHealth();
            
            if (isRunning) {
                logger.info('AI API server is already running');
                return;
            }
            
            logger.info('Starting AI API server...');
            
            // Path to the API server script
            const apiScript = path.join(__dirname, '../../../ai-model/api/start_api.js');
            
            // Check if script exists
            try {
                await fs.access(apiScript);
            } catch (err) {
                logger.error(`API script not found at ${apiScript}`);
                throw new Error(`API script not found: ${err.message}`);
            }
            
            // Start the API server process
            this.apiProcess = subprocess('node', [apiScript], {
                detached: true,
                stdio: 'ignore'
            });
            
            // Give the server some time to start
            await new Promise(resolve => setTimeout(resolve, 5000));
            
            // Check if server is running
            const healthy = await this.checkApiHealth();
            
            if (healthy) {
                logger.info('AI API server started successfully');
            } else {
                logger.error('AI API server failed to start');
                throw new Error('AI API server failed to start');
            }
        } catch (error) {
            logger.error(`Error starting API server: ${error.message}`);
            throw error;
        }
    }
    
    /**
     * Check API server health
     * @returns {Promise<boolean>} True if API is healthy
     */
    async checkApiHealth() {
        try {
            const response = await axios.get(`${this.apiUrl}/health`, {
                timeout: 5000
            });
            
            this.apiHealthy = response.data && response.data.status === 'ok';
            this.lastCheck = Date.now();
            
            return this.apiHealthy;
        } catch (error) {
            logger.warn(`API health check failed: ${error.message}`);
            this.apiHealthy = false;
            return false;
        }
    }
    
    /**
     * Start periodic health check
     */
    startHealthCheck() {
        // Check API health every 5 minutes
        setInterval(async () => {
            // Only check if it's been more than 5 minutes since last check
            if (Date.now() - this.lastCheck > 5 * 60 * 1000) {
                await this.checkApiHealth();
            }
        }, 5 * 60 * 1000);
    }
    
    /**
     * Assess risk for a user
     * @param {string} userAddress - Ethereum address of the user
     * @param {Object} userData - User data for risk assessment
     * @param {Object} options - Assessment options
     * @returns {Promise<Object>} Risk assessment results
     */
    async assessRisk(userAddress, userData = null, options = {}) {
        const {
            useCachedData = true,
            forceRefresh = false,
            includeIOTA = true,
            timeout = 30000
        } = options;
        
        // Use cache unless force refresh is requested
        if (useCachedData && !forceRefresh && this.riskCache.has(userAddress)) {
            const cachedAssessment = this.riskCache.get(userAddress);
            
            // Cache is valid for 1 hour
            if (Date.now() - cachedAssessment.timestamp < 60 * 60 * 1000) {
                logger.debug(`Using cached risk assessment for ${userAddress}`);
                return cachedAssessment;
            }
        }
        
        logger.info(`Assessing risk for ${userAddress}`);
        
        try {
            // If userData is not provided, fetch it first
            const data = userData || await this.fetchUserData(userAddress);
            
            // Add IOTA address if available
            if (includeIOTA && data.iotaAddress) {
                logger.debug(`Using IOTA address for ${userAddress}: ${data.iotaAddress}`);
                
                // Map IOTA address from data object to the format expected by the ML model
                data.iota_address = data.iotaAddress;
            }
            
            // If using mocks, generate a simulated assessment
            if (this.useMocks) {
                return this.generateMockRiskAssessment(userAddress, data);
            }
            
            // Call the risk assessment API
            const response = await axios.post(`${this.apiUrl}/api/risk-assessment`, data, {
                timeout
            });
            
            const assessment = response.data;
            
            // Cache the result
            assessment.timestamp = Date.now();
            this.riskCache.set(userAddress, assessment);
            
            return assessment;
        } catch (error) {
            logger.error(`Error assessing risk for ${userAddress}: ${error.message}`);
            
            // If API error, try to use local Python model directly
            if (this.useLocalModel && error.isAxiosError) {
                logger.info(`Trying local Python model for ${userAddress} after API error`);
                
                try {
                    return await this.assessRiskWithLocalPythonModel(userAddress, userData);
                } catch (pythonError) {
                    logger.error(`Local Python model also failed: ${pythonError.message}`);
                    
                    // Fallback to mock if all else fails
                    return this.generateMockRiskAssessment(userAddress, userData);
                }
            }
            
            // Fallback to mock assessment on error
            logger.info(`Using mock risk assessment for ${userAddress} due to error`);
            return this.generateMockRiskAssessment(userAddress, userData);
        }
    }
    
    /**
     * Fetch user data for risk assessment
     * @param {string} userAddress - Ethereum address of the user
     * @returns {Promise<Object>} User data
     */
    async fetchUserData(userAddress) {
        logger.debug(`Fetching user data for ${userAddress}`);
        
        try {
            const AIIntegration = require('../../../ai-model/api/ai_integration');
            const aiIntegration = new AIIntegration({
                provider: process.env.IOTA_EVM_RPC_URL || 'https://api.testnet.shimmer.network/evm',
                lendingPoolAddress: process.env.LENDING_POOL_ADDRESS,
                zkVerifierAddress: process.env.ZK_VERIFIER_ADDRESS,
                zkBridgeAddress: process.env.ZK_BRIDGE_ADDRESS,
            });
            
            // Set IOTA client if available
            if (this.iotaClient) {
                aiIntegration.setIotaClient(this.iotaClient);
            }
            
            // Set IOTA account if available
            if (this.iotaAccount) {
                aiIntegration.setIotaAccount(this.iotaAccount);
            }
            
            // Fetch user data
            const userData = await aiIntegration.fetchUserData(userAddress);
            
            return userData;
        } catch (error) {
            logger.error(`Error fetching user data for ${userAddress}: ${error.message}`);
            
            // Generate simulated data as fallback
            return this.generateSimulatedUserData(userAddress);
        }
    }
    
    /**
     * Assess risk using local Python model directly
     * @param {string} userAddress - Ethereum address of the user
     * @param {Object} userData - User data for risk assessment
     * @returns {Promise<Object>} Risk assessment results
     */
    async assessRiskWithLocalPythonModel(userAddress, userData) {
        logger.info(`Using local Python model for ${userAddress}`);
        
        try {
            // Stringify user data for passing to Python
            const userDataJson = JSON.stringify(userData);
            
            // Create a temporary file to pass data to Python
            const tempFile = path.join(os.tmpdir(), `risk_data_${Date.now()}.json`);
            await fs.writeFile(tempFile, userDataJson);
            
            // Run Python risk model
            const pythonScript = path.join(__dirname, '../../../ai-model/run_model.py');
            
            // Check if script exists
            try {
                await fs.access(pythonScript);
            } catch (err) {
                throw new Error(`Python script not found: ${err.message}`);
            }
            
            // Run Python script
            const { stdout, stderr } = await subprocess('python', [
                pythonScript,
                '--input', tempFile,
                '--mode', 'predict'
            ], {
                timeout: 30000
            });
            
            // Clean up temporary file
            try {
                await fs.unlink(tempFile);
            } catch (cleanupError) {
                logger.warn(`Error cleaning up temp file: ${cleanupError.message}`);
            }
            
            // Check for errors
            if (stderr) {
                logger.error(`Python model error: ${stderr}`);
                throw new Error(`Python model error: ${stderr}`);
            }
            
            // Parse output
            const assessment = JSON.parse(stdout);
            
            // Cache the result
            assessment.timestamp = Date.now();
            this.riskCache.set(userAddress, assessment);
            
            return assessment;
        } catch (error) {
            logger.error(`Error using local Python model: ${error.message}`);
            throw error;
        }
    }
    
    /**
     * Get recommendations for a user
     * @param {string} userAddress - Ethereum address of the user
     * @returns {Promise<Array>} Recommendations
     */
    async getRecommendations(userAddress) {
        logger.info(`Getting recommendations for ${userAddress}`);
        
        try {
            // If using mocks, generate simulated recommendations
            if (this.useMocks) {
                return this.generateMockRecommendations(userAddress);
            }
            
            // Call the API
            const response = await axios.get(`${this.apiUrl}/api/recommendations/${userAddress}`, {
                timeout: 10000
            });
            
            return response.data.recommendations || [];
        } catch (error) {
            logger.error(`Error getting recommendations for ${userAddress}: ${error.message}`);
            // Fallback to mock recommendations
            return this.generateMockRecommendations(userAddress);
        }
    }
    
    /**
     * Get model performance metrics
     * @param {number} timeRange - Time range in milliseconds (null for all time)
     * @returns {Promise<Object>} Performance metrics
     */
    async getModelPerformanceMetrics(timeRange = null) {
        logger.info(`Getting model performance metrics${timeRange ? ` for last ${timeRange / (24 * 60 * 60 * 1000)} days` : ''}`);
        
        try {
            // If using mocks, generate simulated metrics
            if (this.useMocks) {
                return this.generateMockPerformanceMetrics(timeRange);
            }
            
            // Call the API
            const response = await axios.get(`${this.apiUrl}/api/model/performance`, {
                params: timeRange ? { timeRange } : {},
                timeout: 10000
            });
            
            return response.data;
        } catch (error) {
            logger.error(`Error getting model performance metrics: ${error.message}`);
            // Fallback to mock metrics
            return this.generateMockPerformanceMetrics(timeRange);
        }
    }
    
    /**
     * Get feature importance for the model
     * @returns {Promise<Array>} Feature importance
     */
    async getFeatureImportance() {
        logger.info('Getting feature importance');
        
        try {
            // If using mocks, generate simulated feature importance
            if (this.useMocks) {
                return this.generateMockFeatureImportance();
            }
            
            // Call the API
            const response = await axios.get(`${this.apiUrl}/api/feature-importance`, {
                timeout: 10000
            });
            
            return response.data.features || [];
        } catch (error) {
            logger.error(`Error getting feature importance: ${error.message}`);
            // Fallback to mock feature importance
            return this.generateMockFeatureImportance();
        }
    }
    
    /**
     * Generate a mock risk assessment for testing and fallback
     * @param {string} userAddress - Ethereum address of the user
     * @param {Object} userData - User data for risk assessment
     * @returns {Object} Mock risk assessment
     */
    generateMockRiskAssessment(userAddress, userData = null) {
        logger.debug(`Generating mock risk assessment for ${userAddress}`);
        
        // Use a deterministic random seed based on address
        const addressSum = userAddress.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
        const rng = (seed) => ((Math.sin(seed) * 10000) % 1 + 1) / 2; // Deterministic random between 0-1
        
        // Generate risk score (between 20-80)
        const riskScore = Math.floor(20 + rng(addressSum) * 60);
        
        // Determine risk class
        let riskClass;
        if (riskScore < 20) riskClass = "Very Low Risk";
        else if (riskScore < 40) riskClass = "Low Risk";
        else if (riskScore < 60) riskClass = "Medium Risk";
        else if (riskScore < 80) riskClass = "High Risk";
        else riskClass = "Very High Risk";
        
        // Generate mock confidence score (between 0.7-0.95)
        const confidenceScore = 0.7 + rng(addressSum + 1) * 0.25;
        
        // Generate mock recommendations
        const recommendations = this.generateMockRecommendations(userAddress, riskScore);
        
        // Generate mock risk factors
        const riskFactors = [];
        
        // Low collateral ratio is a risk factor
        if ((userData?.collateralRatio || 0) < 1.5) {
            riskFactors.push({
                factor: "Collateral Ratio",
                impact: "negative",
                description: "Low collateralization increases liquidation risk.",
                value: userData?.collateralRatio || "unknown"
            });
        } else if ((userData?.collateralRatio || 0) > 2.0) {
            riskFactors.push({
                factor: "Collateral Ratio",
                impact: "positive",
                description: "Strong collateralization significantly reduces risk.",
                value: userData?.collateralRatio || "unknown"
            });
        }
        
        // Identity verification reduces risk
        if (userData?.identityVerified) {
            riskFactors.push({
                factor: "Identity Verification",
                impact: "positive",
                description: "Verified identity reduces risk.",
                value: "verified"
            });
        } else {
            riskFactors.push({
                factor: "Identity Verification",
                impact: "negative",
                description: "No identity verification increases risk.",
                value: "none"
            });
        }
        
        // Add IOTA-specific factors if present
        if (userData?.has_iota_address) {
            const iotaTxCount = userData?.iota_transaction_count || 0;
            
            if (iotaTxCount > 10) {
                riskFactors.push({
                    factor: "IOTA Activity",
                    impact: "positive",
                    description: "High IOTA transaction activity shows consistent network usage.",
                    value: iotaTxCount
                });
            } else if (iotaTxCount < 3) {
                riskFactors.push({
                    factor: "IOTA Activity",
                    impact: "negative",
                    description: "Low IOTA transaction activity provides limited data for assessment.",
                    value: iotaTxCount
                });
            }
            
            const crossLayerTransfers = userData?.cross_layer_transfers || 0;
            if (crossLayerTransfers > 3) {
                riskFactors.push({
                    factor: "Cross-Layer Activity",
                    impact: "positive",
                    description: "Cross-layer activity demonstrates blockchain expertise.",
                    value: crossLayerTransfers
                });
            }
        }
        
        return {
            address: userAddress,
            riskScore,
            riskClass,
            confidenceScore,
            recommendations,
            riskFactors,
            timestamp: Date.now(),
            isUsingFallback: true
        };
    }
    
    /**
     * Generate mock recommendations for testing and fallback
     * @param {string} userAddress - Ethereum address of the user
     * @param {number} riskScore - Risk score to base recommendations on
     * @returns {Array} Mock recommendations
     */
    generateMockRecommendations(userAddress, riskScore = 50) {
        // Use a deterministic random seed based on address
        const addressSum = userAddress.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
        const rng = (seed) => ((Math.sin(seed) * 10000) % 1 + 1) / 2; // Deterministic random between 0-1
        
        // Possible recommendations
        const possibleRecommendations = [
            {
                title: "Increase Collateral Ratio",
                description: "Adding more collateral will reduce your risk score and improve borrowing terms.",
                impact: "high",
                actionType: "depositCollateral"
            },
            {
                title: "Complete Identity Verification",
                description: "Verify your identity using IOTA Identity to get better borrowing rates.",
                impact: "high",
                actionType: "verifyIdentity"
            },
            {
                title: "Establish IOTA History",
                description: "Increase your activity on the IOTA network to build reputation.",
                impact: "medium",
                actionType: "iotaActivity"
            },
            {
                title: "Reduce Borrowing",
                description: "Maintain a lower borrowing-to-collateral ratio to reduce risk.",
                impact: "high",
                actionType: "reduceBorrowing"
            },
            {
                title: "Try Cross-Layer Transfers",
                description: "Demonstrate blockchain expertise by using both L1 and L2 layers.",
                impact: "medium",
                actionType: "crossLayerTransfer"
            },
            {
                title: "Balance Asset Distribution",
                description: "Diversify your assets across multiple token types for better risk profile.",
                impact: "low",
                actionType: "diversifyAssets"
            },
            {
                title: "Maintain Regular Transactions",
                description: "Regular transaction patterns improve your reputation scores.",
                impact: "medium",
                actionType: "regularActivity"
            },
            {
                title: "Build Longer History",
                description: "Maintain account activity over time to establish longer track record.",
                impact: "low",
                actionType: "buildHistory"
            }
        ];
        
        // Select 3-5 recommendations based on address
        const count = 3 + Math.floor(rng(addressSum) * 3);
        const selectedIndices = new Set();
        
        // Ensure high impact recommendations for high risk scores
        if (riskScore > 70) {
            // Always include collateral recommendation for high risk
            selectedIndices.add(0);
            // Always include borrowing reduction for high risk
            selectedIndices.add(3);
        }
        
        // Add random recommendations until we have enough
        while (selectedIndices.size < count) {
            const index = Math.floor(rng(addressSum + selectedIndices.size) * possibleRecommendations.length);
            selectedIndices.add(index);
        }
        
        // Get selected recommendations
        const recommendations = Array.from(selectedIndices)
            .map(index => possibleRecommendations[index % possibleRecommendations.length])
            .sort((a, b) => {
                // Sort by impact: high, medium, low
                const impactOrder = { high: 0, medium: 1, low: 2 };
                return impactOrder[a.impact] - impactOrder[b.impact];
            });
        
        return recommendations;
    }
    
    /**
     * Generate mock performance metrics for testing and fallback
     * @param {number} timeRange - Time range in milliseconds
     * @returns {Object} Mock performance metrics
     */
    generateMockPerformanceMetrics(timeRange = null) {
        // For now, return simulated metrics
        return {
            accuracy: 0.87,
            precision: 0.85,
            recall: 0.90,
            f1Score: 0.87,
            totalSamples: 1000,
            correctPredictions: 870,
            truePositives: 450,
            falsePositives: 80,
            trueNegatives: 420,
            falseNegatives: 50,
            confusionMatrix: [
                [450, 80],  // [TP, FP]
                [50, 420]   // [FN, TN]
            ],
            riskBucketAccuracy: {
                "veryLow": 0.95,
                "low": 0.90,
                "medium": 0.85,
                "high": 0.80,
                "veryHigh": 0.75
            },
            defaultRate: 0.05,
            riskBins: [
                { score: '0-20', count: 150, defaultRate: 0.01 },
                { score: '21-40', count: 250, defaultRate: 0.02 },
                { score: '41-60', count: 300, defaultRate: 0.05 },
                { score: '61-80', count: 200, defaultRate: 0.08 },
                { score: '81-100', count: 100, defaultRate: 0.15 }
            ],
            lastUpdate: Date.now()
        };
    }
    
    /**
     * Generate mock feature importance for testing and fallback
     * @returns {Array} Mock feature importance
     */
    generateMockFeatureImportance() {
        return [
            { feature: "collateral_ratio", importance: 0.35, description: "Ratio of collateral to borrowed amount" },
            { feature: "utilization_ratio", importance: 0.25, description: "Ratio of borrowed to deposited amount" },
            { feature: "transaction_count", importance: 0.15, description: "Number of transactions" },
            { feature: "identity_verification", importance: 0.12, description: "Identity verification status" },
            { feature: "activity_regularity", importance: 0.08, description: "Regularity of user activity" },
            { feature: "iota_transaction_count", importance: 0.08, description: "Number of IOTA transactions" },
            { feature: "cross_layer_transfers", importance: 0.07, description: "Cross-layer transaction activity" },
            { feature: "wallet_age", importance: 0.05, description: "Age of the wallet" },
            { feature: "balance", importance: 0.04, description: "Account balance" },
            { feature: "native_tokens_count", importance: 0.03, description: "Number of different tokens held" }
        ];
    }
    
    /**
     * Generate simulated user data for testing and fallback
     * @param {string} userAddress - Ethereum address of the user
     * @returns {Object} Simulated user data
     */
    generateSimulatedUserData(userAddress) {
        // Use a deterministic random seed based on address
        const addressSum = userAddress.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
        const rng = (seed) => ((Math.sin(seed) * 10000) % 1 + 1) / 2; // Deterministic random between 0-1
        
        // Generate realistic but simulated values
        const deposits = (100 + rng(addressSum) * 500).toFixed(2);
        const borrows = (50 + rng(addressSum + 1) * 200).toFixed(2);
        const collaterals = (120 + rng(addressSum + 2) * 600).toFixed(2);
        const riskScore = Math.floor(20 + rng(addressSum + 3) * 60); // Between 20-80
        
        // Create user data object
        const userData = {
            address: userAddress,
            deposits,
            borrows,
            collaterals,
            riskScore,
            timestamp: Date.now(),
            isSimulated: true
        };
        
        // Fetch transaction history (simulated)
        const txHistory = this.generateSimulatedTransactionHistory(userAddress);
        userData.transactionHistory = txHistory;
        
        // Calculate derived metrics
        userData.collateralRatio = userData.borrows > 0 
            ? (userData.collaterals / userData.borrows) 
            : Infinity;
            
        userData.utilizationRatio = userData.deposits > 0 
            ? (userData.borrows / userData.deposits)
            : 0;
            
        // Simulated identity verification (30% chance of being verified)
        userData.identityVerified = rng(addressSum + 4) > 0.7;
        userData.identityVerificationTime = userData.identityVerified 
            ? Date.now() - Math.floor(rng(addressSum + 5) * 30 * 86400 * 1000) 
            : 0;
        
        // Return the data
        return userData;
    }
    
    /**
     * Generate simulated transaction history
     * @param {string} userAddress - Ethereum address of the user
     * @returns {Array} Simulated transaction history
     */
    generateSimulatedTransactionHistory(userAddress) {
        // Use a deterministic random seed based on address
        const addressSum = userAddress.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
        const rng = (seed) => ((Math.sin(seed) * 10000) % 1 + 1) / 2; // Deterministic random between 0-1
        
        const history = [];
        const types = ['deposit', 'borrow', 'repay', 'withdraw'];
        const count = 5 + Math.floor(rng(addressSum) * 10);
        
        for (let i = 0; i < count; i++) {
            const type = types[Math.floor(rng(addressSum + i) * types.length)];
            const amount = (10 + rng(addressSum + i + 100) * 100).toFixed(2);
            const timestamp = Date.now() - Math.floor(rng(addressSum + i + 200) * 30 * 86400 * 1000); // Up to 30 days ago
            
            history.push({
                type,
                amount,
                timestamp
            });
        }
        
        // Sort by timestamp, newest first
        history.sort((a, b) => b.timestamp - a.timestamp);
        
        return history;
    }
}

module.exports = RiskAssessmentService;
