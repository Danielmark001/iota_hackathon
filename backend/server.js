/**
 * IntelliLend Backend Server
 * 
 * This server provides APIs for the IntelliLend protocol, handling AI risk assessment,
 * cross-chain operations, and interacting with IOTA smart contracts.
 */

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { ethers } = require('ethers');
const morgan = require('morgan');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Check if we should use mocks
const USE_MOCKS = process.env.USE_MOCKS === 'true';

// Choose the right AI integration
let AIIntegration;
if (USE_MOCKS) {
  // Use mock implementation
  AIIntegration = require('../ai-model/api/mock_integration');
  console.log('Using MOCK AI integration');
} else {
  // Use real implementation
  AIIntegration = require('../ai-model/api/ai_integration');
  console.log('Using REAL AI integration');
}

// Load utilities and middleware
const { authenticate } = require('./middleware/auth');
const { validateRequest } = require('./middleware/validation');
const { cacheMiddleware } = require('./middleware/cache');
const logger = require('./utils/logger');

// Initialize express app
const app = express();
const PORT = process.env.PORT || 3001;

// Security and performance middleware
app.use(helmet());
app.use(compression());
app.use(cors());
app.use(morgan('combined'));
app.use(bodyParser.json());

// Apply rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later'
});
app.use('/api/', apiLimiter);

// Initialize AI Integration
const aiConfig = {
  provider: process.env.IOTA_EVM_RPC_URL || 'http://localhost:8545',
  lendingPoolAddress: process.env.LENDING_POOL_ADDRESS,
  zkVerifierAddress: process.env.ZK_VERIFIER_ADDRESS,
  zkBridgeAddress: process.env.ZK_BRIDGE_ADDRESS,
  modelPath: process.env.AI_MODEL_PATH || '../ai-model/models',
  useLocalModel: process.env.USE_LOCAL_MODEL === 'true',
  apiUrl: process.env.AI_API_URL || 'http://localhost:5000',
  enableCrossLayer: process.env.ENABLE_CROSS_LAYER === 'true'
};

const aiIntegration = new AIIntegration(aiConfig);

// If admin private key is provided, set wallet for transactions
if (process.env.ADMIN_PRIVATE_KEY) {
  try {
    aiIntegration.setWallet(process.env.ADMIN_PRIVATE_KEY);
    logger.info('Admin wallet connected for backend operations');
  } catch (error) {
    logger.error('Error connecting admin wallet:', error);
  }
}

// API Routes

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: Date.now() });
});

// User profile endpoint
app.get('/api/user/:address', cacheMiddleware(60), async (req, res) => {
  try {
    const { address } = req.params;
    
    // Validate Ethereum address
    if (!ethers.utils.isAddress(address)) {
      return res.status(400).json({ error: 'Invalid Ethereum address' });
    }
    
    // Fetch user data
    const userData = await aiIntegration.fetchUserData(address);
    
    // Calculate health factor
    const liquidationThreshold = 0.83; // 83%
    const collateralValue = parseFloat(userData.collaterals);
    const borrowValue = parseFloat(userData.borrows);
    
    const healthFactor = borrowValue > 0 
      ? (collateralValue * liquidationThreshold) / borrowValue 
      : 999;
    
    // Calculate interest rate
    const baseRate = 3;
    const riskPremium = Math.floor(userData.riskScore / 10);
    const interestRate = baseRate + riskPremium;
    
    // Return user stats
    res.json({
      address,
      deposits: parseFloat(userData.deposits),
      borrows: parseFloat(userData.borrows),
      collateral: parseFloat(userData.collaterals),
      riskScore: userData.riskScore,
      interestRate,
      healthFactor,
      identityVerified: userData.identityVerified || false,
      lastUpdated: userData.timestamp || Date.now()
    });
  } catch (error) {
    logger.error(`Error fetching user ${req.params.address}:`, error);
    res.status(500).json({ error: 'Error fetching user data', message: error.message });
  }
});

// Market data endpoint
app.get('/api/market', cacheMiddleware(300), async (req, res) => {
  try {
    // In a production environment, this would fetch real data from the contracts
    // For demo purposes, we'll generate simulated market data
    
    const totalDeposits = 500000;
    const totalBorrows = 350000;
    const totalCollateral = 750000;
    const utilizationRate = Math.round((totalBorrows / totalDeposits) * 100);
    
    res.json({
      totalDeposits,
      totalBorrows,
      totalCollateral,
      utilizationRate,
      lastUpdated: Date.now()
    });
  } catch (error) {
    logger.error('Error fetching market data:', error);
    res.status(500).json({ error: 'Error fetching market data', message: error.message });
  }
});

// Historical data endpoint
app.get('/api/history/:address', cacheMiddleware(600), async (req, res) => {
  try {
    const { address } = req.params;
    
    // Validate Ethereum address
    if (!ethers.utils.isAddress(address)) {
      return res.status(400).json({ error: 'Invalid Ethereum address' });
    }
    
    // Generate chart data
    // In a production environment, this would fetch historical data from a database
    
    // Generate 30 days of history
    const days = 30;
    const labels = [];
    const deposits = [];
    const borrows = [];
    const riskScores = [];
    
    for (let i = days; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      labels.push(date.toLocaleDateString());
      
      // Generate simulated data with realistic trends
      const baseDeposit = 100 + Math.random() * 50;
      const baseBorrow = 50 + Math.random() * 30;
      const baseRisk = 30 + Math.random() * 20;
      
      // Add some trend (increasing deposits, fluctuating borrows)
      const deposit = baseDeposit + (days - i) * 2;
      const borrow = baseBorrow + Math.sin(i / 5) * 15;
      const risk = baseRisk - Math.cos(i / 7) * 10;
      
      deposits.push(deposit);
      borrows.push(borrow);
      riskScores.push(risk);
    }
    
    // Format for Chart.js
    res.json({
      labels,
      datasets: [
        {
          label: 'Deposits',
          data: deposits,
          borderColor: '#4caf50',
          backgroundColor: 'rgba(76, 175, 80, 0.1)',
          fill: true
        },
        {
          label: 'Borrows',
          data: borrows,
          borderColor: '#2196f3',
          backgroundColor: 'rgba(33, 150, 243, 0.1)',
          fill: true
        },
        {
          label: 'Risk Score',
          data: riskScores,
          borderColor: '#f44336',
          backgroundColor: 'rgba(244, 67, 54, 0.1)',
          fill: true,
          yAxisID: 'y2'
        }
      ]
    });
  } catch (error) {
    logger.error(`Error fetching history for ${req.params.address}:`, error);
    res.status(500).json({ error: 'Error fetching historical data', message: error.message });
  }
});

// Risk assessment endpoint
app.post('/api/risk-assessment', validateRequest(['address']), async (req, res) => {
  try {
    const { address, onChainData } = req.body;
    
    // Validate Ethereum address
    if (!ethers.utils.isAddress(address)) {
      return res.status(400).json({ error: 'Invalid Ethereum address' });
    }
    
    // Use provided on-chain data or fetch it
    const userData = onChainData || await aiIntegration.fetchUserData(address, false);
    
    // Generate risk assessment
    const riskAssessment = await aiIntegration.assessRisk(address, {
      updateOnChain: false, // Don't update on-chain from API request
      useCachedData: true,
      generateZkProof: false
    });
    
    // Return risk assessment with recommendations
    res.json({
      address,
      riskScore: riskAssessment.riskScore,
      confidence: riskAssessment.confidence || 0.85,
      recommendations: riskAssessment.recommendations || [],
      topFactors: riskAssessment.factors || [],
      analysisTimestamp: Date.now()
    });
  } catch (error) {
    logger.error(`Error assessing risk for ${req.body.address}:`, error);
    res.status(500).json({ error: 'Error processing risk assessment', message: error.message });
  }
});

// Get AI recommendations
app.get('/api/recommendations/:address', cacheMiddleware(1800), async (req, res) => {
  try {
    const { address } = req.params;
    
    // Validate Ethereum address
    if (!ethers.utils.isAddress(address)) {
      return res.status(400).json({ error: 'Invalid Ethereum address' });
    }
    
    // Get recommendations from AI
    const recommendations = await aiIntegration.getRecommendations(address);
    
    res.json(recommendations);
  } catch (error) {
    logger.error(`Error getting recommendations for ${req.params.address}:`, error);
    res.status(500).json({ error: 'Error fetching recommendations', message: error.message });
  }
});

// Bridge messages endpoint
app.get('/api/bridge/messages/:address', async (req, res) => {
  try {
    const { address } = req.params;
    
    // Validate Ethereum address
    if (!ethers.utils.isAddress(address)) {
      return res.status(400).json({ error: 'Invalid Ethereum address' });
    }
    
    // In a production environment, this would fetch real bridge messages
    // For demo purposes, generate some simulated messages
    
    const messageTypes = ['RISK_SCORE_UPDATE', 'COLLATERAL_CHANGE', 'CROSS_CHAIN_TRANSFER', 'IDENTITY_VERIFICATION'];
    const statuses = ['Pending', 'Processed', 'Failed'];
    
    const messages = [];
    const count = 3 + Math.floor(Math.random() * 5);
    
    for (let i = 0; i < count; i++) {
      const messageType = messageTypes[Math.floor(Math.random() * messageTypes.length)];
      const status = statuses[Math.floor(Math.random() * statuses.length)];
      const timestamp = Date.now() - Math.floor(Math.random() * 7 * 86400 * 1000); // Up to 7 days ago
      
      messages.push({
        messageId: `0x${Math.random().toString(16).slice(2, 10)}`,
        messageType,
        status,
        timestamp,
        sender: address,
        targetAddress: `0x${Math.random().toString(16).slice(2, 42)}`,
        direction: Math.random() > 0.5 ? 'L2ToL1' : 'L1ToL2'
      });
    }
    
    // Sort by timestamp, newest first
    messages.sort((a, b) => b.timestamp - a.timestamp);
    
    res.json({ messages, count: messages.length });
  } catch (error) {
    logger.error(`Error fetching bridge messages for ${req.params.address}:`, error);
    res.status(500).json({ error: 'Error fetching bridge messages', message: error.message });
  }
});

// Add model validation endpoint
app.get('/api/model/performance', authenticate, async (req, res) => {
  try {
    // Get model performance metrics
    const performanceMetrics = await aiIntegration.getModelPerformanceMetrics();
    
    // Calculate key metrics
    const accuracy = performanceMetrics.correctPredictions / performanceMetrics.totalPredictions;
    const precision = performanceMetrics.truePositives / (performanceMetrics.truePositives + performanceMetrics.falsePositives);
    const recall = performanceMetrics.truePositives / (performanceMetrics.truePositives + performanceMetrics.falseNegatives);
    const f1Score = 2 * (precision * recall) / (precision + recall);
    
    res.json({
      accuracy,
      precision,
      recall,
      f1Score,
      confusionMatrix: performanceMetrics.confusionMatrix,
      riskBucketAccuracy: performanceMetrics.riskBucketAccuracy,
      lastUpdate: performanceMetrics.lastUpdate
    });
  } catch (error) {
    console.error('Error fetching model performance:', error);
    res.status(500).json({ error: 'Error fetching model performance' });
  }
});

// Add model validation with time period
app.get('/api/model/performance/:period', authenticate, async (req, res) => {
  try {
    const { period } = req.params;
    let timeRange;
    
    // Set time range based on period
    switch(period) {
      case 'week':
        timeRange = 7 * 24 * 60 * 60 * 1000; // 7 days in ms
        break;
      case 'month':
        timeRange = 30 * 24 * 60 * 60 * 1000; // 30 days in ms
        break;
      case 'quarter':
        timeRange = 90 * 24 * 60 * 60 * 1000; // 90 days in ms
        break;
      default:
        timeRange = null; // All time
    }
    
    // Get model performance metrics
    const performanceMetrics = await aiIntegration.getModelPerformanceMetrics(timeRange);
    
    // Calculate key metrics
    const accuracy = performanceMetrics.correctPredictions / performanceMetrics.totalPredictions;
    const precision = performanceMetrics.truePositives / (performanceMetrics.truePositives + performanceMetrics.falsePositives);
    const recall = performanceMetrics.truePositives / (performanceMetrics.truePositives + performanceMetrics.falseNegatives);
    const f1Score = 2 * (precision * recall) / (precision + recall);
    
    res.json({
      period,
      accuracy,
      precision,
      recall,
      f1Score,
      confusionMatrix: performanceMetrics.confusionMatrix,
      riskBucketAccuracy: performanceMetrics.riskBucketAccuracy,
      defaultRate: performanceMetrics.defaultRate,
      riskBins: performanceMetrics.riskBins,
      totalSamples: performanceMetrics.totalPredictions,
      lastUpdate: performanceMetrics.lastUpdate
    });
  } catch (error) {
    console.error(`Error fetching model performance for period ${req.params.period}:`, error);
    res.status(500).json({ error: 'Error fetching model performance' });
  }
});

// Add feature importance endpoint
app.get('/api/model/feature-importance', authenticate, async (req, res) => {
  try {
    // Get feature importance from AI model
    const featureImportance = await aiIntegration.getFeatureImportance();
    
    // Sort features by importance
    const sortedFeatures = featureImportance.sort((a, b) => b.importance - a.importance);
    
    res.json({
      features: sortedFeatures,
      lastUpdate: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching feature importance:', error);
    res.status(500).json({ error: 'Error fetching feature importance' });
  }
});

// Add model validation for specific address
app.get('/api/model/validation/:address', authenticate, async (req, res) => {
  try {
    const { address } = req.params;
    
    // Validate Ethereum address
    if (!ethers.utils.isAddress(address)) {
      return res.status(400).json({ error: 'Invalid Ethereum address' });
    }
    
    // Get validation data for this specific address
    const validationData = await aiIntegration.validateAddressPredictions(address);
    
    res.json({
      address,
      predictions: validationData.predictions,
      actuals: validationData.actuals,
      accuracy: validationData.accuracy,
      discrepancy: validationData.discrepancy,
      lastUpdate: validationData.lastUpdate
    });
  } catch (error) {
    console.error(`Error validating predictions for ${req.params.address}:`, error);
    res.status(500).json({ error: 'Error validating predictions' });
  }
});

// Admin routes (protected)
app.post('/api/admin/update-risk-score', authenticate, validateRequest(['address', 'score']), async (req, res) => {
  try {
    const { address, score } = req.body;
    
    // Validate Ethereum address and score
    if (!ethers.utils.isAddress(address)) {
      return res.status(400).json({ error: 'Invalid Ethereum address' });
    }
    
    if (isNaN(score) || score < 0 || score > 100) {
      return res.status(400).json({ error: 'Score must be between 0 and 100' });
    }
    
    // Update risk score on-chain
    const receipt = await aiIntegration.updateRiskScore(address, score);
    
    res.json({
      success: true,
      address,
      newScore: score,
      transactionHash: receipt.transactionHash
    });
  } catch (error) {
    logger.error(`Error updating risk score for ${req.body.address}:`, error);
    res.status(500).json({ error: 'Error updating risk score', message: error.message });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error', message: err.message });
});

// Start server
app.listen(PORT, () => {
  logger.info(`IntelliLend API server running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`Using ${USE_MOCKS ? 'MOCK' : 'REAL'} AI integration`);
});

module.exports = app; // Export for testing
