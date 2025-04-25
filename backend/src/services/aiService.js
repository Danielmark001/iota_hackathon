/**
 * IntelliLend AI Service
 * 
 * This service integrates with the AI model for risk assessment and provides
 * enhanced risk scoring, advanced prediction features, and cross-chain activity analysis.
 */

const axios = require('axios');
const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
const tf = require('@tensorflow/tfjs-node');
const dotenv = require('dotenv');

dotenv.config();

// Configuration
const AI_MODEL_API = process.env.AI_MODEL_API || 'http://localhost:5000';
const MODEL_PATH = process.env.MODEL_PATH || path.join(__dirname, '../../ai-model/models/risk_model');
const MOCK_DATA = process.env.MOCK_DATA === 'true';
const USE_CACHED_MODEL = process.env.USE_CACHED_MODEL === 'true';

// Cache for model predictions
const predictionCache = new Map();
const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes

// Cached TensorFlow model for local predictions
let localModel = null;

/**
 * Initialize the AI service and load the local model if available
 */
async function initialize() {
  if (USE_CACHED_MODEL) {
    try {
      console.log('Loading local TensorFlow model...');
      if (fs.existsSync(`${MODEL_PATH}/model.json`)) {
        localModel = await tf.loadLayersModel(`file://${MODEL_PATH}/model.json`);
        console.log('Local model loaded successfully');
      } else {
        console.warn(`Local model not found at ${MODEL_PATH}`);
      }
    } catch (error) {
      console.error('Error loading local model:', error);
    }
  }
}

/**
 * Process blockchain data to extract features for the AI model
 * 
 * @param {string} address - Wallet address
 * @param {Object} blockchainData - Raw blockchain data
 * @returns {Object} Processed features
 */
function processBlockchainData(address, blockchainData) {
  // Extract transactions
  const transactions = blockchainData.transactions || [];
  
  // Basic statistics
  const txCount = transactions.length;
  const values = transactions.map(tx => parseFloat(tx.value) || 0);
  const totalValue = values.reduce((sum, val) => sum + val, 0);
  const avgValue = txCount > 0 ? totalValue / txCount : 0;
  
  // Calculate lending activity
  const lendingTxs = transactions.filter(tx => 
    tx.to === process.env.LENDING_POOL_ADDRESS || 
    tx.from === process.env.LENDING_POOL_ADDRESS
  );
  
  // Get transactions in last 30 days
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const recentTxs = transactions.filter(tx => tx.timestamp >= thirtyDaysAgo);
  const recentTxCount = recentTxs.length;
  
  // Get total incoming/outgoing
  const incoming = transactions
    .filter(tx => tx.to === address)
    .reduce((sum, tx) => sum + (parseFloat(tx.value) || 0), 0);
  
  const outgoing = transactions
    .filter(tx => tx.from === address)
    .reduce((sum, tx) => sum + (parseFloat(tx.value) || 0), 0);
  
  // Calculate wallet age
  const oldestTx = transactions.length > 0 ? 
    transactions.reduce((oldest, tx) => tx.timestamp < oldest.timestamp ? tx : oldest, transactions[0]) : 
    { timestamp: Date.now() };
    
  const walletAgeDays = Math.floor((Date.now() - oldestTx.timestamp) / (24 * 60 * 60 * 1000));
  
  // Extract cross-chain activity if available
  const crossChainActivity = blockchainData.crossChainActivity || [];
  const crossChainCount = crossChainActivity.length;
  
  // Extract lending history
  const lendingHistory = blockchainData.lendingHistory || {
    totalBorrowed: 0,
    totalRepaid: 0,
    defaultCount: 0,
    loanCount: 0
  };
  
  // Calculate balance volatility
  let balanceVolatility = 0;
  if (blockchainData.balanceHistory && blockchainData.balanceHistory.length > 1) {
    const balanceHistory = blockchainData.balanceHistory;
    const balances = balanceHistory.map(entry => parseFloat(entry.balance) || 0);
    const avgBalance = balances.reduce((sum, bal) => sum + bal, 0) / balances.length;
    
    // Standard deviation / average
    const variance = balances.reduce((sum, bal) => sum + Math.pow(bal - avgBalance, 2), 0) / balances.length;
    balanceVolatility = avgBalance > 0 ? Math.sqrt(variance) / avgBalance : 0;
  }
  
  // Extract identity verification level
  const identityLevel = blockchainData.identityVerification ? 
    blockchainData.identityVerification.level || 0 : 0;
  
  // Define feature mapping
  return {
    transaction_count: txCount,
    avg_transaction_value: avgValue,
    max_transaction_value: Math.max(...values, 0),
    min_transaction_value: txCount > 0 ? Math.min(...values) : 0,
    transaction_frequency: walletAgeDays > 0 ? txCount / walletAgeDays : 0,
    transaction_regularity: calculateRegularity(transactions),
    transaction_growth_rate: calculateGrowthRate(transactions),
    incoming_tx_ratio: txCount > 0 ? transactions.filter(tx => tx.to === address).length / txCount : 0,
    wallet_age_days: walletAgeDays,
    wallet_balance: blockchainData.balance || 0,
    wallet_balance_volatility: balanceVolatility,
    balance_utilization_ratio: calculateUtilizationRatio(blockchainData),
    address_entropy: calculateAddressEntropy(address),
    previous_loans_count: lendingHistory.loanCount || 0,
    repayment_ratio: lendingHistory.totalBorrowed > 0 ? 
      lendingHistory.totalRepaid / lendingHistory.totalBorrowed : 1,
    default_count: lendingHistory.defaultCount || 0,
    avg_loan_duration: lendingHistory.avgDuration || 0,
    max_loan_amount: lendingHistory.maxAmount || 0,
    early_repayment_frequency: lendingHistory.earlyRepayments || 0,
    late_payment_frequency: lendingHistory.latePayments || 0,
    collateral_diversity: blockchainData.collateralAssets ? 
      blockchainData.collateralAssets.length || 1 : 1,
    collateral_value_ratio: calculateCollateralRatio(blockchainData),
    collateral_quality_score: blockchainData.collateralQuality || 'B',
    collateral_volatility: blockchainData.collateralVolatility || 0.1,
    network_centrality: 0.5, // Default value, would require network graph analysis
    unique_counterparties: countUniqueCounterparties(transactions, address),
    trusted_counterparties_ratio: 0.7, // Default value, would require reputation data
    counterparty_risk_exposure: 0.3, // Default value
    cross_chain_activity: crossChainCount,
    defi_protocol_diversity: blockchainData.defiProtocols ? 
      blockchainData.defiProtocols.length : 1,
    lending_protocol_interactions: lendingTxs.length,
    staking_history_score: blockchainData.stakingScore || 50,
    governance_participation: blockchainData.governanceScore || 0.1,
    market_volatility_correlation: 0.5, // Default value
    token_price_correlation: 0.1, // Default value
    liquidation_risk_score: calculateLiquidationRisk(blockchainData),
    identity_verification_level: identityLevel,
    security_score: 70, // Default value
    social_trust_score: 80 // Default value
  };
}

/**
 * Assess risk for a user based on on-chain data and AI model
 * 
 * @param {string} address - User address
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} Risk assessment results
 */
async function assessRisk(address, options = {}) {
  try {
    // Check cache if not forced refresh
    if (!options.forceRefresh) {
      const cached = predictionCache.get(address);
      if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
        return cached.data;
      }
    }
    
    // Collect blockchain data
    let blockchainData;
    if (options.onChainData) {
      blockchainData = options.onChainData;
    } else {
      blockchainData = await fetchBlockchainData(address);
    }
    
    // Process data into features
    const features = processBlockchainData(address, blockchainData);
    
    let result;
    
    // Use remote API if available, otherwise fall back to local model
    try {
      result = await callRiskAPI(address, features);
    } catch (apiError) {
      console.error('Error calling remote AI API:', apiError);
      
      if (localModel) {
        console.log('Falling back to local model prediction');
        result = predictWithLocalModel(features);
      } else if (MOCK_DATA) {
        console.log('Using mock data for prediction');
        result = generateMockPrediction(address, features);
      } else {
        throw new Error('Failed to predict risk: API unavailable and no local model');
      }
    }
    
    // Cache the result
    predictionCache.set(address, {
      data: result,
      timestamp: Date.now()
    });
    
    return result;
  } catch (error) {
    console.error('Error assessing risk:', error);
    
    // Fall back to mock data in case of error
    if (MOCK_DATA) {
      return generateMockPrediction(address);
    }
    
    throw error;
  }
}

/**
 * Call the remote AI model API
 * 
 * @param {string} address - User address
 * @param {Object} features - Extracted features
 * @returns {Promise<Object>} API response
 */
async function callRiskAPI(address, features) {
  const response = await axios.post(`${AI_MODEL_API}/predict`, {
    address,
    features
  });
  
  return response.data;
}

/**
 * Predict risk using the local TensorFlow model
 * 
 * @param {Object} features - Extracted features
 * @returns {Object} Prediction results
 */
function predictWithLocalModel(features) {
  if (!localModel) {
    throw new Error('Local model not loaded');
  }
  
  // Prepare input tensor
  const featureNames = Object.keys(features);
  const featureValues = featureNames.map(name => features[name]);
  
  // Normalize features (assuming model was trained on normalized data)
  const normalized = normalizeFeatures(featureValues);
  
  // Make prediction
  const inputTensor = tf.tensor2d([normalized]);
  const prediction = localModel.predict(inputTensor);
  const riskScore = prediction.dataSync()[0] * 100; // Scale to 0-100
  
  // Clean up
  inputTensor.dispose();
  prediction.dispose();
  
  // Generate explanation and recommendations
  return formatPredictionResult(riskScore, features);
}

/**
 * Generate mock prediction for testing
 * 
 * @param {string} address - User address
 * @param {Object} features - Extracted features (optional)
 * @returns {Object} Mock prediction
 */
function generateMockPrediction(address, features = {}) {
  // Generate a deterministic but seemingly random score based on address
  const hash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(address));
  const hashNum = parseInt(hash.slice(2, 10), 16);
  const baseScore = (hashNum % 100); // 0-99
  
  // Adjust score based on features if available
  let adjustedScore = baseScore;
  if (Object.keys(features).length > 0) {
    // Positive factors
    if (features.repayment_ratio > 0.8) adjustedScore -= 10;
    if (features.wallet_age_days > 180) adjustedScore -= 5;
    if (features.transaction_count > 50) adjustedScore -= 3;
    if (features.collateral_value_ratio > 1.5) adjustedScore -= 7;
    
    // Negative factors
    if (features.default_count > 0) adjustedScore += 15 * features.default_count;
    if (features.wallet_balance_volatility > 0.5) adjustedScore += 8;
    if (features.late_payment_frequency > 0.2) adjustedScore += 10;
    
    // Bound to 0-100
    adjustedScore = Math.min(100, Math.max(0, adjustedScore));
  }
  
  // Determine risk category
  let riskCategory;
  if (adjustedScore < 25) riskCategory = "Low Risk";
  else if (adjustedScore < 50) riskCategory = "Medium Risk";
  else if (adjustedScore < 75) riskCategory = "High Risk";
  else riskCategory = "Very High Risk";
  
  // Generate top factors - mix of positive and negative
  const topFactors = [];
  if (features.repayment_ratio) {
    topFactors.push({ Feature: "repayment_ratio", Importance: 0.35 });
  } else {
    topFactors.push({ Feature: "repayment_ratio", Importance: 0.35 });
  }
  
  if (features.default_count) {
    topFactors.push({ Feature: "default_count", Importance: 0.25 });
  } else {
    topFactors.push({ Feature: "default_count", Importance: 0.25 });
  }
  
  if (features.collateral_diversity) {
    topFactors.push({ Feature: "collateral_diversity", Importance: 0.15 });
  } else {
    topFactors.push({ Feature: "collateral_diversity", Importance: 0.15 });
  }
  
  topFactors.push({ Feature: "wallet_balance_volatility", Importance: 0.12 });
  topFactors.push({ Feature: "transaction_regularity", Importance: 0.08 });
  topFactors.push({ Feature: "identity_verification_level", Importance: 0.05 });
  
  // Generate recommendations
  const recommendations = [];
  
  if (adjustedScore > 30) {
    recommendations.push({
      id: 1,
      title: "Diversify Your Collateral",
      description: "Adding different asset types as collateral can reduce your risk score by up to 10 points.",
      impact: "high"
    });
  }
  
  if (features.repayment_ratio < 0.9 || !features.repayment_ratio) {
    recommendations.push({
      id: 2,
      title: "Improve Repayment Frequency",
      description: "More frequent smaller repayments can improve your repayment pattern score.",
      impact: "medium"
    });
  }
  
  if (features.wallet_balance_volatility > 0.3 || !features.wallet_balance_volatility) {
    recommendations.push({
      id: 3,
      title: "Maintain Stable Balances",
      description: "Reducing balance volatility by maintaining consistent funds improves your profile.",
      impact: "medium"
    });
  }
  
  if (features.identity_verification_level < 2 || !features.identity_verification_level) {
    recommendations.push({
      id: 4,
      title: "Complete Advanced Identity Verification",
      description: "Upgrading to advanced identity verification can reduce your risk score significantly.",
      impact: "high"
    });
  }
  
  return {
    address,
    riskScore: adjustedScore,
    riskCategory,
    warning: MOCK_DATA ? "Using mock data for demonstration purposes" : undefined,
    explanation: {
      recommendations,
      topFactors
    },
    timestamp: new Date().toISOString()
  };
}

/**
 * Format the prediction result with explanations and recommendations
 * 
 * @param {number} riskScore - Predicted risk score (0-100)
 * @param {Object} features - User features
 * @returns {Object} Formatted prediction result
 */
function formatPredictionResult(riskScore, features) {
  // Determine risk category
  let riskCategory;
  if (riskScore < 25) riskCategory = "Low Risk";
  else if (riskScore < 50) riskCategory = "Medium Risk";
  else if (riskScore < 75) riskCategory = "High Risk";
  else riskCategory = "Very High Risk";
  
  // Generate explanations based on feature importance
  // This would come from the model in a real implementation
  const featureImportance = calculateFeatureImportance(features);
  
  // Get top factors
  const topFactors = Object.entries(featureImportance)
    .map(([Feature, Importance]) => ({ Feature, Importance }))
    .sort((a, b) => b.Importance - a.Importance)
    .slice(0, 6);
  
  // Generate recommendations
  const recommendations = generateRecommendations(riskScore, features, featureImportance);
  
  return {
    riskScore: Math.round(riskScore),
    riskCategory,
    explanation: {
      recommendations,
      topFactors
    },
    timestamp: new Date().toISOString()
  };
}

/**
 * Generate personalized recommendations based on risk assessment
 * 
 * @param {number} riskScore - Risk score
 * @param {Object} features - User features
 * @param {Object} importance - Feature importance
 * @returns {Array} List of recommendations
 */
function generateRecommendations(riskScore, features, importance) {
  const recommendations = [];
  
  // Add recommendations based on feature values and importance
  
  // Collateral diversity
  if (features.collateral_diversity < 2 && importance.collateral_diversity > 0.1) {
    recommendations.push({
      id: 1,
      title: "Diversify Your Collateral",
      description: "Adding different asset types as collateral can reduce your risk score by up to 10 points.",
      impact: "high"
    });
  }
  
  // Repayment ratio
  if (features.repayment_ratio < 0.9 && importance.repayment_ratio > 0.1) {
    recommendations.push({
      id: 2,
      title: "Improve Repayment History",
      description: "Consistent and timely repayments will significantly improve your risk profile.",
      impact: "high"
    });
  }
  
  // Balance volatility
  if (features.wallet_balance_volatility > 0.3 && importance.wallet_balance_volatility > 0.05) {
    recommendations.push({
      id: 3,
      title: "Maintain Stable Balances",
      description: "Reduce balance volatility by maintaining consistent funds in your wallet.",
      impact: "medium"
    });
  }
  
  // Identity verification
  if (features.identity_verification_level < 2) {
    recommendations.push({
      id: 4,
      title: "Complete Identity Verification",
      description: "Verify your identity through our secure zero-knowledge proof system to reduce risk.",
      impact: "high"
    });
  }
  
  // Collateral value ratio
  if (features.collateral_value_ratio < 1.5 && importance.collateral_value_ratio > 0.05) {
    recommendations.push({
      id: 5,
      title: "Increase Collateral Ratio",
      description: "A higher collateral-to-loan ratio can improve your borrowing terms.",
      impact: "medium"
    });
  }
  
  // Cross-chain activity
  if (features.cross_chain_activity < 2 && importance.cross_chain_activity > 0.02) {
    recommendations.push({
      id: 6,
      title: "Utilize Cross-Chain Features",
      description: "Our cross-chain liquidity aggregation can optimize your capital efficiency.",
      impact: "low"
    });
  }
  
  return recommendations;
}

/**
 * Calculate feature importance for explanation
 * 
 * @param {Object} features - User features
 * @returns {Object} Feature importance
 */
function calculateFeatureImportance(features) {
  // This is a simplified version - in reality this would come from the model
  const importance = {
    repayment_ratio: 0.35,
    default_count: 0.25,
    collateral_diversity: 0.15,
    wallet_balance_volatility: 0.12,
    transaction_regularity: 0.08,
    identity_verification_level: 0.05
  };
  
  // Here we could adjust importance based on feature values
  
  return importance;
}

/**
 * Normalize features for model input
 * 
 * @param {Array} features - Feature values
 * @returns {Array} Normalized features
 */
function normalizeFeatures(features) {
  // This is a simplified version - in reality would use means and std devs from training
  return features.map(val => {
    if (typeof val === 'number' && !isNaN(val)) {
      return val / 100; // Simple scaling for demonstration
    }
    return 0; // Default for non-numeric
  });
}

/**
 * Fetch on-chain data for a user
 * 
 * @param {string} address - User address
 * @returns {Promise<Object>} Blockchain data
 */
async function fetchBlockchainData(address) {
  try {
    // In a real implementation, this would query the blockchain
    // For the hackathon, we'll generate some realistic data
    
    if (MOCK_DATA) {
      return generateMockBlockchainData(address);
    }
    
    // TODO: Implement actual blockchain data fetching
    // This would involve querying the IOTA network for transactions, balances, etc.
    
    throw new Error('Blockchain data fetching not implemented');
  } catch (error) {
    console.error('Error fetching blockchain data:', error);
    return generateMockBlockchainData(address);
  }
}

/**
 * Generate mock blockchain data for testing
 * 
 * @param {string} address - User address
 * @returns {Object} Mock blockchain data
 */
function generateMockBlockchainData(address) {
  // Create a deterministic but seemingly random seed from address
  const hash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(address));
  const hashNum = parseInt(hash.slice(2, 10), 16);
  
  // Generate transaction count (10-100)
  const txCount = 10 + (hashNum % 90);
  
  // Generate transactions
  const transactions = [];
  let timestamp = Date.now() - (365 * 24 * 60 * 60 * 1000); // Start 1 year ago
  
  for (let i = 0; i < txCount; i++) {
    const isIncoming = (i % 3 === 0); // Every 3rd is incoming
    const value = 10 + (hashNum % 1000) / 10; // 10-110 IOTA
    
    transactions.push({
      hash: `0x${i}${hash.slice(2, 8)}`,
      from: isIncoming ? `0x${hash.slice(10, 50)}` : address,
      to: isIncoming ? address : `0x${hash.slice(20, 60)}`,
      value: value.toString(),
      timestamp: timestamp,
      confirmations: 100 + i
    });
    
    // Increment timestamp somewhat randomly
    timestamp += (1 + (hashNum % 10)) * 24 * 60 * 60 * 1000;
    if (timestamp > Date.now()) timestamp = Date.now();
  }
  
  // Generate balance history
  const balanceHistory = [];
  timestamp = Date.now() - (365 * 24 * 60 * 60 * 1000); // Start 1 year ago
  let balance = 100 + (hashNum % 1000);
  
  for (let i = 0; i < 12; i++) { // Monthly snapshots
    balanceHistory.push({
      timestamp,
      balance: balance.toString()
    });
    
    // Adjust balance somewhat randomly (-20% to +30%)
    const change = balance * (0.3 - (0.2 * (hashNum % 10) / 10));
    balance += change;
    if (balance < 10) balance = 10; // Minimum balance
    
    // Increment timestamp by ~1 month
    timestamp += 30 * 24 * 60 * 60 * 1000;
    if (timestamp > Date.now()) timestamp = Date.now();
  }
  
  // Generate lending history
  const loanCount = hashNum % 5; // 0-4 loans
  const defaultCount = loanCount > 0 ? hashNum % 2 : 0; // 0-1
  const totalBorrowed = loanCount * (100 + (hashNum % 500));
  const repaymentRatio = 0.7 + (0.3 * (hashNum % 10) / 10); // 0.7-1.0
  const totalRepaid = totalBorrowed * repaymentRatio;
  
  // Generate cross-chain activity
  const crossChainCount = hashNum % 3; // 0-2 cross-chain transfers
  const crossChainActivity = [];
  
  for (let i = 0; i < crossChainCount; i++) {
    crossChainActivity.push({
      timestamp: Date.now() - (i * 30 * 24 * 60 * 60 * 1000),
      sourceChain: 'IOTA EVM',
      targetChain: `Chain-${i + 1}`,
      amount: (50 + (hashNum % 200)).toString(),
      status: 'Completed'
    });
  }
  
  // Generates collateral assets
  const collateralAssets = [];
  const collateralCount = 1 + (hashNum % 3); // 1-3 collateral assets
  
  for (let i = 0; i < collateralCount; i++) {
    collateralAssets.push({
      id: `asset-${i}-${hash.slice(2, 8)}`,
      type: i === 0 ? 'IOTA' : `Token-${i}`,
      value: (200 + (hashNum % 800)).toString(),
      isVerified: i < 2 // First two are verified
    });
  }
  
  // Build and return the data
  return {
    address,
    balance: (balance).toString(),
    transactions,
    balanceHistory,
    lendingHistory: {
      loanCount,
      totalBorrowed,
      totalRepaid,
      defaultCount,
      avgDuration: 30 + (hashNum % 60), // 30-90 days
      maxAmount: 100 + (hashNum % 900), // 100-1000 IOTA
      earlyRepayments: hashNum % 3, // 0-2
      latePayments: defaultCount > 0 ? 1 + (hashNum % 3) : 0 // 0-3, at least 1 if defaulted
    },
    crossChainActivity,
    collateralAssets,
    collateralQuality: ['A', 'B', 'C', 'D'][hashNum % 4],
    collateralVolatility: 0.1 + (0.4 * (hashNum % 10) / 10), // 0.1-0.5
    identityVerification: {
      level: hashNum % 4, // 0-3 (None, Basic, Advanced, Full)
      verified: (hashNum % 4) > 0,
      timestamp: Date.now() - (30 * 24 * 60 * 60 * 1000) // 1 month ago
    },
    defiProtocols: ['Lending', 'DEX', 'Staking'].slice(0, 1 + (hashNum % 3))
  };
}

/**
 * Calculate transaction regularity (consistency over time)
 * 
 * @param {Array} transactions - Transaction list
 * @returns {number} Regularity score (0-1)
 */
function calculateRegularity(transactions) {
  if (!transactions || transactions.length < 2) return 0;
  
  // Sort by timestamp
  const sortedTx = [...transactions].sort((a, b) => a.timestamp - b.timestamp);
  
  // Calculate time differences between transactions
  const timeDiffs = [];
  for (let i = 1; i < sortedTx.length; i++) {
    timeDiffs.push(sortedTx[i].timestamp - sortedTx[i - 1].timestamp);
  }
  
  // Calculate coefficient of variation (lower means more regular)
  const avg = timeDiffs.reduce((sum, diff) => sum + diff, 0) / timeDiffs.length;
  const variance = timeDiffs.reduce((sum, diff) => sum + Math.pow(diff - avg, 2), 0) / timeDiffs.length;
  const stdDev = Math.sqrt(variance);
  
  // Convert to regularity score (1 = perfectly regular, 0 = completely irregular)
  const cv = avg > 0 ? stdDev / avg : 1; // Coefficient of variation
  return Math.max(0, Math.min(1, 1 - cv));
}

/**
 * Calculate utilization ratio (borrowed / total available)
 * 
 * @param {Object} blockchainData - Blockchain data
 * @returns {number} Utilization ratio (0-1)
 */
function calculateUtilizationRatio(blockchainData) {
  const balance = parseFloat(blockchainData.balance) || 0;
  const lendingHistory = blockchainData.lendingHistory || {};
  const borrowed = parseFloat(lendingHistory.totalBorrowed || 0) - parseFloat(lendingHistory.totalRepaid || 0);
  
  const totalAvailable = balance + borrowed;
  return totalAvailable > 0 ? borrowed / totalAvailable : 0;
}

/**
 * Calculate collateral ratio (collateral value / borrowed)
 * 
 * @param {Object} blockchainData - Blockchain data
 * @returns {number} Collateral ratio
 */
function calculateCollateralRatio(blockchainData) {
  const collateralAssets = blockchainData.collateralAssets || [];
  const lendingHistory = blockchainData.lendingHistory || {};
  
  const collateralValue = collateralAssets.reduce(
    (sum, asset) => sum + parseFloat(asset.value || 0), 
    0
  );
  
  const borrowed = parseFloat(lendingHistory.totalBorrowed || 0) - parseFloat(lendingHistory.totalRepaid || 0);
  
  return borrowed > 0 ? collateralValue / borrowed : 3; // Default to 3 if no borrowing
}

/**
 * Calculate address entropy (measure of randomness/complexity)
 * 
 * @param {string} address - Wallet address
 * @returns {number} Entropy score (0-1)
 */
function calculateAddressEntropy(address) {
  if (!address || address.length < 10) return 0;
  
  // Remove 0x prefix if present
  const cleanAddress = address.startsWith('0x') ? address.slice(2) : address;
  
  // Count character frequencies
  const charFreq = {};
  for (let i = 0; i < cleanAddress.length; i++) {
    const char = cleanAddress[i];
    charFreq[char] = (charFreq[char] || 0) + 1;
  }
  
  // Calculate Shannon entropy
  let entropy = 0;
  const len = cleanAddress.length;
  
  for (const char in charFreq) {
    const freq = charFreq[char] / len;
    entropy -= freq * Math.log2(freq);
  }
  
  // Normalize to 0-1 (max entropy for hex is log2(16) = 4)
  return Math.min(entropy / 4, 1);
}

/**
 * Calculate growth rate of transaction activity
 * 
 * @param {Array} transactions - Transaction list
 * @returns {number} Growth rate
 */
function calculateGrowthRate(transactions) {
  if (!transactions || transactions.length < 10) return 0;
  
  // Sort by timestamp
  const sortedTx = [...transactions].sort((a, b) => a.timestamp - b.timestamp);
  
  // Split into two halves
  const midpoint = Math.floor(sortedTx.length / 2);
  const firstHalf = sortedTx.slice(0, midpoint);
  const secondHalf = sortedTx.slice(midpoint);
  
  // Calculate activity in each half
  const firstHalfActivity = firstHalf.reduce((sum, tx) => sum + parseFloat(tx.value || 0), 0);
  const secondHalfActivity = secondHalf.reduce((sum, tx) => sum + parseFloat(tx.value || 0), 0);
  
  // Calculate growth rate
  return firstHalfActivity > 0 ? 
    (secondHalfActivity - firstHalfActivity) / firstHalfActivity : 
    secondHalfActivity > 0 ? 1 : 0;
}

/**
 * Count unique counterparties in transactions
 * 
 * @param {Array} transactions - Transaction list
 * @param {string} address - User address
 * @returns {number} Unique counterparty count
 */
function countUniqueCounterparties(transactions, address) {
  if (!transactions || transactions.length === 0) return 0;
  
  const counterparties = new Set();
  
  transactions.forEach(tx => {
    if (tx.from === address && tx.to) {
      counterparties.add(tx.to);
    } else if (tx.to === address && tx.from) {
      counterparties.add(tx.from);
    }
  });
  
  return counterparties.size;
}

/**
 * Calculate liquidation risk score
 * 
 * @param {Object} blockchainData - Blockchain data
 * @returns {number} Liquidation risk score (0-100)
 */
function calculateLiquidationRisk(blockchainData) {
  const collateralRatio = calculateCollateralRatio(blockchainData);
  const volatility = blockchainData.collateralVolatility || 0.1;
  
  // Higher ratio = lower risk, higher volatility = higher risk
  let risk = 100 - (collateralRatio * 20) + (volatility * 200);
  
  // Bound to 0-100
  return Math.max(0, Math.min(100, risk));
}

/**
 * Generate early warning signals for potential defaults
 * 
 * @param {string} address - User address
 * @returns {Promise<Array>} Warning signals
 */
async function getEarlyWarningSignals(address) {
  try {
    // Get risk assessment
    const risk = await assessRisk(address);
    
    // Generate warnings
    const warnings = [];
    
    // High risk score warning
    if (risk.riskScore > 70) {
      warnings.push({
        type: 'high_risk_score',
        severity: 'high',
        description: 'User has a very high risk score indicating potential default risk',
        details: { riskScore: risk.riskScore }
      });
    }
    
    // Check for specific risk factors
    const topFactors = risk.explanation.topFactors || [];
    const highRiskFactors = topFactors.filter(factor => factor.Importance > 0.2);
    
    highRiskFactors.forEach(factor => {
      warnings.push({
        type: `high_${factor.Feature}`,
        severity: factor.Importance > 0.3 ? 'high' : 'medium',
        description: `High impact risk factor: ${factor.Feature}`,
        details: { factor: factor.Feature, importance: factor.Importance }
      });
    });
    
    return warnings;
  } catch (error) {
    console.error('Error generating warning signals:', error);
    return [];
  }
}

/**
 * Get optimal interest rate for a user
 * 
 * @param {string} address - User address
 * @param {Object} marketConditions - Current market conditions
 * @returns {Promise<Object>} Optimized interest rate
 */
async function getOptimalInterestRate(address, marketConditions = {}) {
  try {
    // Get risk assessment
    const risk = await assessRisk(address);
    
    // Base rate from market conditions
    const baseRate = marketConditions.baseRate || 0.03; // 3% default
    
    // Risk premium based on risk score
    const riskPremium = (risk.riskScore / 100) * 0.1; // Up to 10% premium
    
    // Calculate final rate
    const rate = baseRate + riskPremium;
    
    return {
      address,
      baseRate: baseRate * 100,
      riskPremium: riskPremium * 100,
      optimalRate: rate * 100,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error calculating optimal interest rate:', error);
    
    // Fall back to simpler calculation
    return {
      address,
      baseRate: 3,
      riskPremium: 5,
      optimalRate: 8,
      timestamp: new Date().toISOString(),
      error: 'Estimation error, using default values'
    };
  }
}

module.exports = {
  initialize,
  assessRisk,
  getOptimalInterestRate,
  getEarlyWarningSignals,
  processBlockchainData,
  fetchBlockchainData
};
