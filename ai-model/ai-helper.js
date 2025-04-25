/**
 * AI Helper Functions for IntelliLend
 * 
 * This module provides interfaces to connect the IntelliLend platform with
 * the AI risk assessment model. It handles data preprocessing, model inference,
 * and result formatting.
 */

const tf = require('@tensorflow/tfjs-node');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

// Configuration
const config = {
    // AI model paths
    riskClassifierPath: path.join(__dirname, './models/risk_classifier.joblib'),
    defaultPredictorPath: path.join(__dirname, './models/default_predictor.joblib'),
    interestOptimizerPath: path.join(__dirname, './models/interest_optimizer'),
    
    // API endpoint (if running as a service)
    apiEndpoint: process.env.AI_ENDPOINT || 'http://localhost:5000',
    
    // Feature list
    features: [
        'transaction_count',
        'avg_transaction_value',
        'max_transaction_value',
        'min_transaction_value',
        'transaction_frequency',
        'transaction_regularity',
        'transaction_growth_rate',
        'incoming_tx_ratio',
        'wallet_age_days',
        'wallet_balance',
        'wallet_balance_volatility',
        'balance_utilization_ratio',
        'address_entropy',
        'previous_loans_count',
        'repayment_ratio',
        'default_count',
        'avg_loan_duration',
        'max_loan_amount',
        'early_repayment_frequency',
        'late_payment_frequency',
        'collateral_diversity',
        'collateral_value_ratio',
        'collateral_quality_score',
        'collateral_volatility',
        'network_centrality',
        'unique_counterparties',
        'trusted_counterparties_ratio',
        'counterparty_risk_exposure',
        'cross_chain_activity',
        'defi_protocol_diversity',
        'lending_protocol_interactions',
        'staking_history_score',
        'governance_participation',
        'market_volatility_correlation',
        'token_price_correlation',
        'liquidation_risk_score',
        'identity_verification_level',
        'security_score',
        'social_trust_score'
    ],
    
    // Default values for missing features
    defaultValues: {
        'transaction_count': 0,
        'avg_transaction_value': 0,
        'max_transaction_value': 0,
        'min_transaction_value': 0,
        'transaction_frequency': 0,
        'transaction_regularity': 0.5,
        'transaction_growth_rate': 0,
        'incoming_tx_ratio': 0.5,
        'wallet_balance': 0,
        'wallet_balance_volatility': 0.5,
        'balance_utilization_ratio': 0.5,
        'address_entropy': 0.5,
        'avg_loan_duration': 30,
        'max_loan_amount': 0,
        'early_repayment_frequency': 0,
        'late_payment_frequency': 0,
        'collateral_quality_score': 'B',
        'collateral_volatility': 0.5,
        'network_centrality': 0.5,
        'unique_counterparties': 0,
        'trusted_counterparties_ratio': 0.5,
        'counterparty_risk_exposure': 0.5,
        'defi_protocol_diversity': 0,
        'staking_history_score': 50,
        'governance_participation': 0,
        'market_volatility_correlation': 0.5,
        'token_price_correlation': 0,
        'liquidation_risk_score': 50,
        'identity_verification_level': 'basic',
        'security_score': 50,
        'social_trust_score': 50
    }
};

/**
 * Load the AI risk model if not running as a service
 */
async function loadModels() {
    console.log('Loading AI models...');
    
    try {
        // In a real implementation, we would load the models here
        // For the hackathon demo, we'll use simplified models
        
        const riskClassifierModel = {
            predict: (features) => {
                // Simplified risk classification model
                // Returns a risk category (0: Low, 1: Medium, 2: High, 3: Very High)
                const score = calculateRiskScore(features);
                if (score < 25) return 0;
                if (score < 50) return 1;
                if (score < 75) return 2;
                return 3;
            }
        };
        
        const defaultPredictorModel = {
            predict: (features) => {
                // Simplified default probability model
                // Returns a probability between 0 and 1
                const defaultRatio = features.default_count / (features.previous_loans_count + 1);
                const repaymentFactor = features.repayment_ratio * 2;
                
                return Math.min(1, Math.max(0, 
                    defaultRatio * 0.5 - repaymentFactor * 0.3 + 
                    features.wallet_balance_volatility * 0.2 +
                    features.late_payment_frequency * 0.3
                ));
            }
        };
        
        const interestOptimizerModel = {
            predict: (features, marketConditions) => {
                // Simplified interest rate optimization model
                // Returns an optimal interest rate based on risk and market conditions
                const riskCategory = riskClassifierModel.predict(features);
                const defaultProb = defaultPredictorModel.predict(features);
                
                // Base rates for different risk categories
                const baseRates = [0.03, 0.06, 0.09, 0.15];
                let rate = baseRates[riskCategory];
                
                // Add market conditions adjustment
                if (marketConditions) {
                    rate += marketConditions.volatility * 0.1;
                    rate -= marketConditions.liquidityRatio * 0.05;
                }
                
                // Add default probability adjustment
                rate += defaultProb * 0.1;
                
                return Math.min(0.25, Math.max(0.01, rate));
            }
        };
        
        return {
            riskClassifier: riskClassifierModel,
            defaultPredictor: defaultPredictorModel,
            interestOptimizer: interestOptimizerModel
        };
    } catch (error) {
        console.error('Error loading models:', error);
        throw error;
    }
}

// Global models variable
let models = null;

/**
 * Preprocess user data to prepare for model input
 */
function preprocessUserData(userData) {
    const processedData = {};
    
    // Copy existing fields
    for (const key in userData) {
        processedData[key] = userData[key];
    }
    
    // Fill in missing features with default values
    for (const feature of config.features) {
        if (!(feature in processedData) && feature in config.defaultValues) {
            processedData[feature] = config.defaultValues[feature];
        }
    }
    
    // Calculate derived features
    processedData.default_risk_ratio = processedData.default_count / (processedData.previous_loans_count + 1);
    processedData.late_payment_risk = processedData.late_payment_frequency / (processedData.previous_loans_count + 1);
    
    processedData.lending_engagement = (
        processedData.transaction_count * processedData.lending_protocol_interactions / 
        (processedData.wallet_age_days + 1)
    );
    
    // Handle categorical features
    if (typeof processedData.identity_verification_level === 'string') {
        const levelMap = {
            'none': 0,
            'basic': 1,
            'advanced': 2,
            'full': 3
        };
        processedData.identity_verification_level_encoded = 
            levelMap[processedData.identity_verification_level] || 0;
    }
    
    if (typeof processedData.collateral_quality_score === 'string') {
        const scoreMap = {
            'A': 4,
            'B': 3,
            'C': 2,
            'D': 1
        };
        processedData.collateral_quality_score_encoded = 
            scoreMap[processedData.collateral_quality_score] || 2;
    }
    
    return processedData;
}

/**
 * Calculate a simplified risk score
 */
function calculateRiskScore(userData) {
    // Simple weighted average of key risk factors
    const weights = {
        default_count: 20,
        repayment_ratio: -30,
        late_payment_frequency: 15,
        wallet_balance_volatility: 10,
        transaction_count: -5,
        lending_protocol_interactions: -5,
        collateral_diversity: -5,
        wallet_age_days: -5,
        cross_chain_activity: -5
    };
    
    let score = 50; // Base score
    let totalWeight = 0;
    
    for (const [feature, weight] of Object.entries(weights)) {
        if (feature in userData) {
            let value = userData[feature];
            
            // Normalize values
            if (feature === 'repayment_ratio') {
                value = value * 100; // Convert to percentage
            } else if (feature === 'wallet_age_days') {
                value = Math.min(value, 1000) / 10; // Cap at 1000 days, scale down
            } else if (feature === 'transaction_count') {
                value = Math.min(value, 100); // Cap at 100 transactions
            }
            
            score += value * weight / 100;
            totalWeight += Math.abs(weight);
        }
    }
    
    // Ensure score is between 0 and 100
    return Math.min(100, Math.max(0, score));
}

/**
 * Assess risk for a user based on their on-chain activity
 * 
 * @param {Object} userData User transaction and wallet data
 * @returns {Number} Risk score (0-100, higher means higher risk)
 */
async function assessRisk(userData) {
    try {
        // Check if we're using the API
        if (process.env.USE_API === 'true' && config.apiEndpoint) {
            const response = await axios.post(`${config.apiEndpoint}/assess-risk`, userData);
            return response.data.riskScore;
        }
        
        // Load models if not already loaded
        if (!models) {
            models = await loadModels();
        }
        
        // Preprocess data
        const processedData = preprocessUserData(userData);
        
        // Run the simplified risk calculation
        const riskScore = calculateRiskScore(processedData);
        
        return Math.round(riskScore);
    } catch (error) {
        console.error('Error assessing risk:', error);
        // Fallback to a simplified calculation
        return calculateRiskScore(userData);
    }
}

/**
 * Predict the probability of default for a user
 * 
 * @param {Object} userData User transaction and wallet data
 * @returns {Number} Default probability (0-1)
 */
async function predictDefaultProbability(userData) {
    try {
        // Check if we're using the API
        if (process.env.USE_API === 'true' && config.apiEndpoint) {
            const response = await axios.post(`${config.apiEndpoint}/predict-default`, userData);
            return response.data.defaultProbability;
        }
        
        // Load models if not already loaded
        if (!models) {
            models = await loadModels();
        }
        
        // Preprocess data
        const processedData = preprocessUserData(userData);
        
        // Predict default probability
        const defaultProb = models.defaultPredictor.predict(processedData);
        
        return defaultProb;
    } catch (error) {
        console.error('Error predicting default probability:', error);
        // Fallback calculation
        const defaultRatio = userData.default_count / (userData.previous_loans_count + 1);
        const repaymentFactor = userData.repayment_ratio || 0.8;
        
        return Math.min(1, Math.max(0, defaultRatio * 0.5 - repaymentFactor * 0.3 + 0.1));
    }
}

/**
 * Optimize interest rate for a user based on their risk profile and market conditions
 * 
 * @param {Object} userData User transaction and wallet data
 * @param {Object} marketConditions Current market conditions
 * @returns {Number} Optimized interest rate (0-1)
 */
async function optimizeInterestRate(userData, marketConditions) {
    try {
        // Check if we're using the API
        if (process.env.USE_API === 'true' && config.apiEndpoint) {
            const response = await axios.post(
                `${config.apiEndpoint}/optimize-rate`, 
                { userData, marketConditions }
            );
            return response.data.interestRate;
        }
        
        // Load models if not already loaded
        if (!models) {
            models = await loadModels();
        }
        
        // Preprocess data
        const processedData = preprocessUserData(userData);
        
        // Optimize interest rate
        const rate = models.interestOptimizer.predict(processedData, marketConditions);
        
        return rate;
    } catch (error) {
        console.error('Error optimizing interest rate:', error);
        // Fallback calculation
        const riskScore = await assessRisk(userData);
        const baseRate = 0.03;
        const riskPremium = riskScore / 100 * 0.2;
        
        let marketAdjustment = 0;
        if (marketConditions) {
            marketAdjustment = (marketConditions.volatility || 0) * 0.1 - 
                               (marketConditions.liquidityRatio || 0.5) * 0.05;
        }
        
        return Math.min(0.25, Math.max(0.01, baseRate + riskPremium + marketAdjustment));
    }
}

/**
 * Generate early warning signals for potential defaults
 * 
 * @param {Object} userData User transaction and wallet data
 * @returns {Object} Warning signals and their severity
 */
async function generateEarlyWarningSignals(userData) {
    try {
        // Check if we're using the API
        if (process.env.USE_API === 'true' && config.apiEndpoint) {
            const response = await axios.post(`${config.apiEndpoint}/warning-signals`, userData);
            return response.data.warnings;
        }
        
        const warnings = {};
        
        // Preprocess data
        const processedData = preprocessUserData(userData);
        
        // Check for high default probability
        const defaultProb = await predictDefaultProbability(userData);
        if (defaultProb > 0.3) {
            warnings.high_default_probability = {
                severity: defaultProb > 0.5 ? 'high' : 'medium',
                value: defaultProb,
                threshold: 0.3,
                description: 'User has a high probability of default based on historical behavior'
            };
        }
        
        // Check for low repayment ratio
        if (processedData.repayment_ratio < 0.8) {
            warnings.low_repayment_ratio = {
                severity: processedData.repayment_ratio < 0.6 ? 'high' : 'medium',
                value: processedData.repayment_ratio,
                threshold: 0.8,
                description: 'User has a history of incomplete loan repayments'
            };
        }
        
        // Check for high wallet balance volatility
        if (processedData.wallet_balance_volatility > 0.4) {
            warnings.high_wallet_volatility = {
                severity: processedData.wallet_balance_volatility > 0.6 ? 'high' : 'medium',
                value: processedData.wallet_balance_volatility,
                threshold: 0.4,
                description: 'User has unusually volatile wallet balance'
            };
        }
        
        // Check for high late payment frequency
        if (processedData.late_payment_frequency > 0.2) {
            warnings.frequent_late_payments = {
                severity: 'medium',
                value: processedData.late_payment_frequency,
                threshold: 0.2,
                description: 'User frequently makes late payments'
            };
        }
        
        // Check for low collateral diversity
        if (processedData.collateral_diversity < 2) {
            warnings.low_collateral_diversity = {
                severity: 'low',
                value: processedData.collateral_diversity,
                threshold: 2,
                description: 'User has limited collateral diversity, increasing concentration risk'
            };
        }
        
        return warnings;
    } catch (error) {
        console.error('Error generating warning signals:', error);
        return {};
    }
}

/**
 * Predict future user behavior based on historical data
 * 
 * @param {Object} userData User transaction and wallet data
 * @param {Number} daysAhead Number of days to predict ahead
 * @returns {Object} Predictions for key metrics
 */
async function predictFutureBehavior(userData, daysAhead = 30) {
    try {
        // Check if we're using the API
        if (process.env.USE_API === 'true' && config.apiEndpoint) {
            const response = await axios.post(
                `${config.apiEndpoint}/predict-behavior`, 
                { userData, daysAhead }
            );
            return response.data.predictions;
        }
        
        // Simple trend-based predictions
        const predictions = {};
        
        // Predict repayment trend
        const repaymentRatio = userData.repayment_ratio || 0.8;
        const repaymentTrend = Math.random() > 0.7 ? -0.05 : 0.02; // Mostly improving
        predictions.repayment_ratio = {
            current: repaymentRatio,
            predicted: Math.min(1, Math.max(0, repaymentRatio + repaymentTrend)),
            trend: repaymentTrend > 0 ? 'improving' : 'declining'
        };
        
        // Predict wallet volatility
        const volatility = userData.wallet_balance_volatility || 0.3;
        const volatilityTrend = Math.random() > 0.6 ? 0.1 : -0.05; // Slightly more volatile
        predictions.wallet_volatility = {
            current: volatility,
            predicted: Math.min(1, Math.max(0, volatility + volatilityTrend)),
            trend: volatilityTrend > 0 ? 'increasing' : 'decreasing'
        };
        
        // Predict borrowing activity
        const borrowRatio = userData.borrows / (userData.wallet_balance || 1);
        const borrowTrend = Math.random() > 0.5 ? 0.1 : -0.1;
        predictions.borrow_activity = {
            current: borrowRatio,
            predicted: Math.max(0, borrowRatio + borrowTrend),
            trend: borrowTrend > 0 ? 'increasing' : 'decreasing'
        };
        
        return predictions;
    } catch (error) {
        console.error('Error predicting future behavior:', error);
        return {};
    }
}

module.exports = {
    assessRisk,
    predictDefaultProbability,
    optimizeInterestRate,
    generateEarlyWarningSignals,
    predictFutureBehavior
};
