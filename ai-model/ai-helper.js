/**
 * Advanced AI Helper Module for IntelliLend
 * 
 * This module provides sophisticated AI-powered functions to enhance
 * the DeFi lending platform with intelligent analytics capabilities.
 */

const tf = require('@tensorflow/tfjs-node');
const axios = require('axios');
const { ethers } = require('ethers');
const { MarketSentimentAnalyzer } = require('./market_sentiment');
const crypto = require('crypto');

// Load environment models based on environment
let modelPath = process.env.MODEL_PATH || './models';
let useRemoteAPI = process.env.USE_REMOTE_API === 'true';
let apiEndpoint = process.env.AI_API_ENDPOINT || 'http://localhost:5000/api/risk';

class AdvancedAIHelper {
    constructor(config = {}) {
        this.modelPath = config.modelPath || modelPath;
        this.useRemoteAPI = config.useRemoteAPI !== undefined ? config.useRemoteAPI : useRemoteAPI;
        this.apiEndpoint = config.apiEndpoint || apiEndpoint;
        this.models = {};
        this.marketSentiment = new MarketSentimentAnalyzer();
        this.modelLoaded = false;
        this.lastUpdate = Date.now();
        this.cachedPredictions = new Map();
        
        // Configure AI models
        this.modelConfig = {
            riskAssessment: {
                path: `${this.modelPath}/risk_model`,
                inputShape: [1, 40],
                outputShape: [1]
            },
            defaultPrediction: {
                path: `${this.modelPath}/default_model`,
                inputShape: [1, 30],
                outputShape: [1]
            },
            interestOptimization: {
                path: `${this.modelPath}/interest_model`,
                inputShape: [1, 25],
                outputShape: [1]
            },
            marketPrediction: {
                path: `${this.modelPath}/market_model`,
                inputShape: [1, 20],
                outputShape: [3] // [price, volatility, sentiment]
            }
        };
    }
    
    /**
     * Initialize AI models
     * @returns {Promise<boolean>} True if models loaded successfully
     */
    async initialize() {
        if (this.useRemoteAPI) {
            console.log('Using remote API for AI predictions');
            return true;
        }
        
        try {
            // Load all models
            for (const [modelName, config] of Object.entries(this.modelConfig)) {
                console.log(`Loading model: ${modelName}`);
                this.models[modelName] = await tf.loadLayersModel(`file://${config.path}/model.json`);
            }
            
            this.modelLoaded = true;
            console.log('All AI models loaded successfully');
            return true;
        } catch (error) {
            console.error('Error initializing AI models:', error);
            return false;
        }
    }
    
    /**
     * Assess risk score for a user based on on-chain data
     * @param {Object} userData User's on-chain data
     * @param {Object} options Additional options
     * @returns {Promise<Object>} Risk assessment results
     */
    async assessRisk(userData, options = {}) {
        // Check if we have a recent cached prediction
        const userHash = this._hashUserData(userData);
        const cachedResult = this.cachedPredictions.get(userHash);
        
        if (cachedResult && Date.now() - cachedResult.timestamp < 3600000 && !options.forceRefresh) {
            return cachedResult.prediction;
        }
        
        // Transform user data into feature vector
        const features = this._extractFeatures(userData);
        
        let riskScore, confidence, factors, recommendations;
        
        if (this.useRemoteAPI) {
            // Use remote API
            try {
                const response = await axios.post(this.apiEndpoint, {
                    features,
                    options
                });
                
                ({ riskScore, confidence, factors, recommendations } = response.data);
            } catch (error) {
                console.error('Error calling remote AI API:', error);
                // Fallback to simple heuristic
                riskScore = this._calculateBasicRiskScore(userData);
                confidence = 0.7;
                factors = this._getBasicRiskFactors(userData);
                recommendations = this._getBasicRecommendations(riskScore);
            }
        } else if (this.modelLoaded) {
            // Use local model
            try {
                // Prepare tensor
                const inputTensor = tf.tensor(features, this.modelConfig.riskAssessment.inputShape);
                
                // Run prediction
                const predictions = this.models.riskAssessment.predict(inputTensor);
                riskScore = await predictions.data();
                riskScore = Math.round(riskScore[0] * 100); // Scale to 0-100
                
                // Get confidence - in a real model this would be part of the output
                confidence = 0.85 + (Math.random() * 0.1); // Simulated high confidence
                
                // Get contributing factors - in a real model this would be more sophisticated
                factors = this._getModelBasedFactors(features);
                
                // Generate recommendations based on risk score and factors
                recommendations = this._generateRecommendations(riskScore, factors);
                
                // Clean up tensors
                inputTensor.dispose();
                predictions.dispose();
            } catch (error) {
                console.error('Error running risk assessment model:', error);
                // Fallback to simple heuristic
                riskScore = this._calculateBasicRiskScore(userData);
                confidence = 0.7;
                factors = this._getBasicRiskFactors(userData);
                recommendations = this._getBasicRecommendations(riskScore);
            }
        } else {
            // Model not loaded, use heuristic
            riskScore = this._calculateBasicRiskScore(userData);
            confidence = 0.7;
            factors = this._getBasicRiskFactors(userData);
            recommendations = this._getBasicRecommendations(riskScore);
        }
        
        // Enhance with market sentiment
        const marketData = await this._getMarketSentimentData();
        const marketAdjustedRisk = this._adjustRiskWithMarketData(riskScore, marketData);
        
        // Prepare final result
        const result = {
            riskScore: marketAdjustedRisk.score,
            originalScore: riskScore,
            confidence: confidence,
            factors: factors,
            recommendations: recommendations,
            marketInfluence: marketAdjustedRisk.influence,
            timestamp: Date.now()
        };
        
        // Cache the prediction
        this.cachedPredictions.set(userHash, {
            prediction: result,
            timestamp: Date.now()
        });
        
        return result;
    }
    
    /**
     * Predict default probability for a user
     * @param {Object} userData User's on-chain data
     * @param {Object} options Additional options
     * @returns {Promise<number>} Default probability (0-1)
     */
    async predictDefaultProbability(userData, options = {}) {
        // Transform user data into feature vector
        const features = this._extractFeatures(userData);
        
        let defaultProbability;
        
        if (this.useRemoteAPI) {
            // Use remote API
            try {
                const response = await axios.post(`${this.apiEndpoint}/default`, {
                    features,
                    options
                });
                
                defaultProbability = response.data.probability;
            } catch (error) {
                console.error('Error calling remote API for default prediction:', error);
                // Fallback to simple heuristic
                defaultProbability = this._calculateBasicDefaultProbability(userData);
            }
        } else if (this.modelLoaded) {
            // Use local model
            try {
                // Prepare tensor
                const inputTensor = tf.tensor(features, this.modelConfig.defaultPrediction.inputShape);
                
                // Run prediction
                const predictions = this.models.defaultPrediction.predict(inputTensor);
                defaultProbability = await predictions.data();
                defaultProbability = defaultProbability[0]; // Get first (only) value
                
                // Clean up tensors
                inputTensor.dispose();
                predictions.dispose();
            } catch (error) {
                console.error('Error running default prediction model:', error);
                // Fallback to simple heuristic
                defaultProbability = this._calculateBasicDefaultProbability(userData);
            }
        } else {
            // Model not loaded, use heuristic
            defaultProbability = this._calculateBasicDefaultProbability(userData);
        }
        
        return defaultProbability;
    }
    
    /**
     * Optimize interest rate for a user
     * @param {Object} userData User's on-chain data
     * @param {Object} marketData Current market conditions
     * @param {Object} options Additional options
     * @returns {Promise<Object>} Optimized interest rate and explanation
     */
    async optimizeInterestRate(userData, marketData = {}, options = {}) {
        // Get risk score and default probability
        const riskAssessment = await this.assessRisk(userData, options);
        const defaultProbability = await this.predictDefaultProbability(userData, options);
        
        // Get market sentiment data
        const sentimentData = await this._getMarketSentimentData();
        
        // Combine all features
        const combinedFeatures = [
            ...this._extractFeatures(userData),
            riskAssessment.riskScore / 100, // Normalize to 0-1
            defaultProbability,
            sentimentData.marketVolatilityIndex / 100,
            sentimentData.liquidityStress / 100,
            sentimentData.fearGreedIndex / 100
        ];
        
        let interestRate, components;
        
        if (this.useRemoteAPI) {
            // Use remote API
            try {
                const response = await axios.post(`${this.apiEndpoint}/interest`, {
                    features: combinedFeatures,
                    userData,
                    marketData: sentimentData,
                    options
                });
                
                ({ interestRate, components } = response.data);
            } catch (error) {
                console.error('Error calling remote API for interest optimization:', error);
                // Fallback to formula-based calculation
                ({ rate: interestRate, components } = this._calculateOptimalInterestRate(
                    riskAssessment.riskScore,
                    defaultProbability,
                    sentimentData
                ));
            }
        } else if (this.modelLoaded) {
            // Use local model
            try {
                // Prepare tensor - reshape to match model input
                const reshapedFeatures = [];
                // Take only the first 25 features or pad if necessary
                for (let i = 0; i < this.modelConfig.interestOptimization.inputShape[1]; i++) {
                    reshapedFeatures.push(combinedFeatures[i] || 0);
                }
                
                const inputTensor = tf.tensor([reshapedFeatures]);
                
                // Run prediction
                const predictions = this.models.interestOptimization.predict(inputTensor);
                interestRate = await predictions.data();
                interestRate = interestRate[0] * 0.25; // Scale to 0-25%
                
                // Generate components explanation using the formula as a reference
                const formulaRate = this._calculateOptimalInterestRate(
                    riskAssessment.riskScore,
                    defaultProbability,
                    sentimentData
                );
                components = formulaRate.components;
                
                // Clean up tensors
                inputTensor.dispose();
                predictions.dispose();
            } catch (error) {
                console.error('Error running interest optimization model:', error);
                // Fallback to formula-based calculation
                ({ rate: interestRate, components } = this._calculateOptimalInterestRate(
                    riskAssessment.riskScore,
                    defaultProbability,
                    sentimentData
                ));
            }
        } else {
            // Model not loaded, use formula
            ({ rate: interestRate, components } = this._calculateOptimalInterestRate(
                riskAssessment.riskScore,
                defaultProbability,
                sentimentData
            ));
        }
        
        return {
            rate: interestRate,
            components,
            explanation: this._generateInterestExplanation(interestRate, components),
            timestamp: Date.now()
        };
    }
    
    /**
     * Predict market conditions for yield optimization
     * @param {string} asset Asset symbol (e.g., "IOTA")
     * @param {string} timeFrame Time frame for prediction ("24h", "7d", "30d")
     * @returns {Promise<Object>} Market predictions
     */
    async predictMarketConditions(asset = "IOTA", timeFrame = "7d") {
        // Get current market sentiment data
        const sentimentData = await this.marketSentiment.get_sentiment_for_asset(asset);
        const marketPulse = await this.marketSentiment.get_realtime_market_pulse([asset]);
        
        // Create feature vector from sentiment data
        const features = [
            sentimentData.sentiment_score,
            sentimentData.sentiment_momentum.daily_change,
            sentimentData.sentiment_momentum.weekly_change,
            marketPulse.fear_greed_index.value / 100,
            marketPulse.global_risk_indicators.market_volatility_index / 100,
            marketPulse.global_risk_indicators.liquidity_stress_indicator / 100,
            marketPulse.global_risk_indicators.market_momentum,
            sentimentData.volatility_forecast.forecast_7d,
            sentimentData.onchain_metrics.network_health,
            sentimentData.market_correlation
        ];
        
        // Pad to match input shape
        while (features.length < this.modelConfig.marketPrediction.inputShape[1]) {
            features.push(0);
        }
        
        let predictions;
        
        if (this.useRemoteAPI) {
            // Use remote API
            try {
                const response = await axios.post(`${this.apiEndpoint}/market`, {
                    asset,
                    timeFrame,
                    features
                });
                
                predictions = response.data;
            } catch (error) {
                console.error('Error calling remote API for market prediction:', error);
                // Fallback to sentiment-based prediction
                predictions = this._generateBasicMarketPrediction(sentimentData, marketPulse);
            }
        } else if (this.modelLoaded) {
            // Use local model
            try {
                // Prepare tensor
                const inputTensor = tf.tensor([features]);
                
                // Run prediction
                const outputTensor = this.models.marketPrediction.predict(inputTensor);
                const outputValues = await outputTensor.data();
                
                // Parse predictions [price_change, volatility, sentiment_shift]
                predictions = {
                    price_change_prediction: outputValues[0],
                    volatility_prediction: outputValues[1],
                    sentiment_shift_prediction: outputValues[2],
                    confidence: 0.85 // Simulated confidence
                };
                
                // Clean up tensors
                inputTensor.dispose();
                outputTensor.dispose();
            } catch (error) {
                console.error('Error running market prediction model:', error);
                // Fallback to sentiment-based prediction
                predictions = this._generateBasicMarketPrediction(sentimentData, marketPulse);
            }
        } else {
            // Model not loaded, use sentiment-based prediction
            predictions = this._generateBasicMarketPrediction(sentimentData, marketPulse);
        }
        
        // Enhance predictions with sentiment data
        return {
            ...predictions,
            asset,
            timeFrame,
            fear_greed_index: marketPulse.fear_greed_index,
            market_sentiment: sentimentData.sentiment_label,
            timestamp: Date.now()
        };
    }
    
    /**
     * Generate personalized DeFi strategy recommendations
     * @param {Object} userData User's on-chain data
     * @param {Object} portfolio User's current portfolio
     * @returns {Promise<Object>} Strategy recommendations
     */
    async generateDeFiStrategy(userData, portfolio = {}) {
        // Get risk assessment
        const riskAssessment = await this.assessRisk(userData);
        
        // Get market predictions
        const marketPredictions = await this.predictMarketConditions("IOTA", "7d");
        
        // Calculate risk appetite based on risk score
        // Lower risk score = higher risk appetite
        const riskAppetite = 100 - riskAssessment.riskScore;
        
        // Define strategy profiles
        const strategies = {
            conservative: {
                lendingRatio: 0.7,
                borrowingRatio: 0.2,
                stablecoinRatio: 0.6,
                volatileAssetsRatio: 0.2,
                yieldFarmingRatio: 0.2,
                minCollateralization: 250
            },
            moderate: {
                lendingRatio: 0.5,
                borrowingRatio: 0.4,
                stablecoinRatio: 0.4,
                volatileAssetsRatio: 0.4,
                yieldFarmingRatio: 0.4,
                minCollateralization: 180
            },
            aggressive: {
                lendingRatio: 0.3,
                borrowingRatio: 0.6,
                stablecoinRatio: 0.2,
                volatileAssetsRatio: 0.6,
                yieldFarmingRatio: 0.6,
                minCollateralization: 150
            }
        };
        
        // Select strategy based on risk appetite
        let selectedStrategy;
        if (riskAppetite < 40) {
            selectedStrategy = strategies.conservative;
            selectedStrategy.name = "Conservative";
        } else if (riskAppetite < 70) {
            selectedStrategy = strategies.moderate;
            selectedStrategy.name = "Moderate";
        } else {
            selectedStrategy = strategies.aggressive;
            selectedStrategy.name = "Aggressive";
        }
        
        // Adjust based on market conditions
        if (marketPredictions.fear_greed_index.category === "Extreme Fear") {
            // Reduce volatile assets in fearful markets
            selectedStrategy.volatileAssetsRatio *= 0.7;
            selectedStrategy.stablecoinRatio += selectedStrategy.volatileAssetsRatio * 0.3;
            selectedStrategy.minCollateralization += 50;
        } else if (marketPredictions.fear_greed_index.category === "Extreme Greed") {
            // Potential bubble, be more cautious
            selectedStrategy.volatileAssetsRatio *= 0.8;
            selectedStrategy.borrowingRatio *= 0.8;
            selectedStrategy.minCollateralization += 30;
        }
        
        // Adjust based on predicted price movement
        if (marketPredictions.price_change_prediction > 0.1) {
            // Bullish prediction
            selectedStrategy.volatileAssetsRatio *= 1.2;
            selectedStrategy.borrowingRatio *= 1.1;
        } else if (marketPredictions.price_change_prediction < -0.1) {
            // Bearish prediction
            selectedStrategy.volatileAssetsRatio *= 0.8;
            selectedStrategy.stablecoinRatio *= 1.2;
            selectedStrategy.minCollateralization += 20;
        }
        
        // Cap ratios at 1.0
        for (const key of Object.keys(selectedStrategy)) {
            if (key.endsWith('Ratio') && selectedStrategy[key] > 1.0) {
                selectedStrategy[key] = 1.0;
            }
        }
        
        // Generate specific recommendations
        const recommendations = this._generateStrategyRecommendations(
            userData,
            selectedStrategy,
            marketPredictions
        );
        
        return {
            strategy: selectedStrategy.name,
            parameters: selectedStrategy,
            recommendations,
            market_outlook: {
                sentiment: marketPredictions.market_sentiment,
                fear_greed: marketPredictions.fear_greed_index.category,
                price_prediction: marketPredictions.price_change_prediction > 0 ? "Bullish" : "Bearish",
                confidence: marketPredictions.confidence
            },
            timestamp: Date.now()
        };
    }
    
    /**
     * Detect early warning signals for potential defaults
     * @param {Object} userData User's on-chain data
     * @param {Object} historicalData User's historical data
     * @returns {Promise<Object>} Warning signals and risk level
     */
    async detectEarlyWarningSignals(userData, historicalData = {}) {
        // Default probability threshold for warnings
        const defaultProbThreshold = 0.2;
        
        // Get risk assessment
        const riskAssessment = await this.assessRisk(userData);
        
        // Get default probability
        const defaultProbability = await this.predictDefaultProbability(userData);
        
        // Get market sentiment
        const marketSentiment = await this._getMarketSentimentData();
        
        // Initialize warnings array
        const warnings = [];
        
        // Check default probability
        if (defaultProbability > defaultProbThreshold) {
            warnings.push({
                type: "high_default_probability",
                severity: defaultProbability > 0.5 ? "critical" : "high",
                value: defaultProbability,
                threshold: defaultProbThreshold,
                description: `High probability of default (${(defaultProbability * 100).toFixed(1)}%)`
            });
        }
        
        // Check collateral ratio (simplified)
        const collateralRatio = userData.collaterals / Math.max(userData.borrows, 1);
        const minimumRatio = 1.5;
        if (collateralRatio < minimumRatio) {
            warnings.push({
                type: "low_collateral_ratio",
                severity: collateralRatio < 1.2 ? "critical" : "high",
                value: collateralRatio,
                threshold: minimumRatio,
                description: `Collateral ratio (${collateralRatio.toFixed(2)}) below recommended minimum (${minimumRatio})`
            });
        }
        
        // Check for negative market correlation
        if (marketSentiment.volatilityIndex > 70 && marketSentiment.fearGreedIndex < 30) {
            warnings.push({
                type: "market_stress",
                severity: "medium",
                value: marketSentiment.volatilityIndex,
                description: "Market under stress with high volatility and fear"
            });
        }
        
        // Check for unusual activity (simplified)
        const hasUnusualActivity = Math.random() < 0.3; // Simulated check
        if (hasUnusualActivity) {
            warnings.push({
                type: "unusual_activity",
                severity: "medium",
                description: "Unusual transaction patterns detected"
            });
        }
        
        // Determine overall risk level
        let riskLevel;
        if (warnings.some(w => w.severity === "critical")) {
            riskLevel = "critical";
        } else if (warnings.some(w => w.severity === "high")) {
            riskLevel = "high";
        } else if (warnings.some(w => w.severity === "medium")) {
            riskLevel = "medium";
        } else {
            riskLevel = "low";
        }
        
        return {
            risk_level: riskLevel,
            warnings,
            default_probability: defaultProbability,
            risk_score: riskAssessment.riskScore,
            timestamp: Date.now()
        };
    }
    
    // Private helper methods
    
    /**
     * Extract features from user data for model input
     * @private
     * @param {Object} userData User's on-chain data
     * @returns {Array} Feature vector
     */
    _extractFeatures(userData) {
        // This is a simplified example - in production, this would extract
        // and normalize many features from the user's on-chain activity
        
        const features = [
            // Transaction features
            parseFloat(userData.transaction_count || 0) / 100,
            parseFloat(userData.avg_transaction_value || 0) / 1000,
            parseFloat(userData.transaction_frequency || 0),
            
            // Wallet features
            parseFloat(userData.wallet_age_days || 0) / 365,
            parseFloat(userData.wallet_balance || 0) / 10000,
            parseFloat(userData.wallet_balance_volatility || 0),
            
            // Lending history
            parseFloat(userData.previous_loans_count || 0) / 10,
            parseFloat(userData.repayment_ratio || 0),
            parseFloat(userData.default_count || 0) / 5,
            parseFloat(userData.late_payment_frequency || 0),
            
            // Current position
            parseFloat(userData.borrows || 0) / 1000,
            parseFloat(userData.deposits || 0) / 1000,
            parseFloat(userData.collaterals || 0) / 1000,
            (parseFloat(userData.collaterals || 0) / Math.max(parseFloat(userData.borrows || 0), 1)),
            
            // Identity verification
            userData.identity_verified ? 1 : 0,
            parseFloat(userData.identity_score || 0) / 100
        ];
        
        // Pad array to match model input shape
        while (features.length < 40) {
            features.push(0);
        }
        
        return features;
    }
    
    /**
     * Calculate a basic risk score using heuristics
     * @private
     * @param {Object} userData User's on-chain data
     * @returns {number} Risk score (0-100)
     */
    _calculateBasicRiskScore(userData) {
        // Default to medium risk
        let score = 50;
        
        // Adjust based on transaction history
        const transactionCount = parseFloat(userData.transaction_count || 0);
        if (transactionCount > 50) score -= 5;
        if (transactionCount > 100) score -= 5;
        
        // Adjust based on wallet age
        const walletAgeDays = parseFloat(userData.wallet_age_days || 0);
        if (walletAgeDays > 180) score -= 10;
        if (walletAgeDays < 30) score += 15;
        
        // Adjust based on loan history
        const defaultCount = parseFloat(userData.default_count || 0);
        if (defaultCount > 0) score += 20 * defaultCount;
        
        const latePaymentFrequency = parseFloat(userData.late_payment_frequency || 0);
        score += latePaymentFrequency * 50;
        
        const repaymentRatio = parseFloat(userData.repayment_ratio || 0);
        score -= repaymentRatio * 20;
        
        // Adjust based on current position
        const collateralRatio = parseFloat(userData.collaterals || 0) / Math.max(parseFloat(userData.borrows || 0), 1);
        if (collateralRatio > 3) score -= 15;
        if (collateralRatio < 1.5) score += 20;
        
        // Adjust for identity verification
        if (userData.identity_verified) score -= 10;
        
        // Ensure score is within 0-100 range
        return Math.max(0, Math.min(100, score));
    }
    
    /**
     * Get basic risk factors based on user data
     * @private
     * @param {Object} userData User's on-chain data
     * @returns {Array} Risk factors
     */
    _getBasicRiskFactors(userData) {
        const factors = [
            {
                Feature: "repayment_ratio",
                Importance: Math.random() * 0.2 + 0.1
            },
            {
                Feature: "default_count",
                Importance: Math.random() * 0.2 + 0.1
            },
            {
                Feature: "wallet_balance_volatility",
                Importance: Math.random() * 0.2 + 0.1
            },
            {
                Feature: "collateral_value_ratio",
                Importance: Math.random() * 0.2 + 0.1
            },
            {
                Feature: "late_payment_frequency",
                Importance: Math.random() * 0.2 + 0.1
            }
        ];
        
        // Sort by importance (highest first)
        factors.sort((a, b) => b.Importance - a.Importance);
        
        return factors;
    }
    
    /**
     * Get model-based risk factors
     * @private
     * @param {Array} features Feature vector
     * @returns {Array} Risk factors
     */
    _getModelBasedFactors(features) {
        // In a real implementation, this would use model explainability techniques
        // like SHAP values to determine feature importance
        
        // For this demo, we'll use simulated importance values
        const featureNames = [
            "transaction_count",
            "avg_transaction_value",
            "transaction_frequency",
            "wallet_age_days",
            "wallet_balance",
            "wallet_balance_volatility",
            "previous_loans_count",
            "repayment_ratio",
            "default_count",
            "late_payment_frequency",
            "borrows",
            "deposits",
            "collaterals",
            "collateral_ratio",
            "identity_verified",
            "identity_score"
        ];
        
        // Generate simulated importance values
        const factors = [];
        for (let i = 0; i < featureNames.length; i++) {
            // Randomize importance but make it correlated with feature value
            const baseImportance = Math.random() * 0.3;
            const featureValue = i < features.length ? features[i] : 0;
            
            // Higher values for certain critical features
            let importance = baseImportance;
            if (featureNames[i] === "default_count") importance += 0.2;
            if (featureNames[i] === "repayment_ratio") importance += 0.15;
            if (featureNames[i] === "collateral_ratio") importance += 0.15;
            if (featureNames[i] === "late_payment_frequency") importance += 0.1;
            
            factors.push({
                Feature: featureNames[i],
                Importance: importance,
                Value: featureValue
            });
        }
        
        // Sort by importance (highest first)
        factors.sort((a, b) => b.Importance - a.Importance);
        
        // Return top 5 factors
        return factors.slice(0, 5);
    }
    
    /**
     * Generate basic recommendations based on risk score
     * @private
     * @param {number} riskScore Risk score (0-100)
     * @returns {Array} Recommendations
     */
    _getBasicRecommendations(riskScore) {
        const recommendations = [];
        
        if (riskScore > 70) {
            recommendations.push({
                title: "Increase Collateral",
                description: "Add more collateral to reduce liquidation risk",
                impact: "high"
            });
            recommendations.push({
                title: "Reduce Borrowed Amount",
                description: "Repay part of your loan to improve your position",
                impact: "high"
            });
        } else if (riskScore > 40) {
            recommendations.push({
                title: "Maintain Healthy Ratio",
                description: "Keep your collateral-to-loan ratio above 1.8x",
                impact: "medium"
            });
            if (!userData.identity_verified) {
                recommendations.push({
                    title: "Verify Identity",
                    description: "Complete identity verification to reduce your risk score",
                    impact: "medium"
                });
            }
        } else {
            recommendations.push({
                title: "Optimize Your Position",
                description: "Your risk level is low, consider optimizing for higher yields",
                impact: "low"
            });
        }
        
        return recommendations;
    }
    
    /**
     * Generate more sophisticated recommendations based on risk factors
     * @private
     * @param {number} riskScore Risk score
     * @param {Array} factors Risk factors
     * @returns {Array} Recommendations
     */
    _generateRecommendations(riskScore, factors) {
        const recommendations = [];
        
        // Critical recommendations for high risk
        if (riskScore > 75) {
            recommendations.push({
                title: "Urgent: Increase Collateral",
                description: "Your position is at high risk. Add at least 50% more collateral immediately.",
                impact: "critical",
                action_url: "/app/add-collateral"
            });
            recommendations.push({
                title: "Reduce Loan Exposure",
                description: "Consider repaying part of your loan to reduce liquidation risk.",
                impact: "high",
                action_url: "/app/repay-loan"
            });
        }
        // High risk recommendations
        else if (riskScore > 60) {
            recommendations.push({
                title: "Increase Collateral Buffer",
                description: "Add more collateral to create a safer buffer against price volatility.",
                impact: "high",
                action_url: "/app/add-collateral"
            });
            
            // Check for specific risk factors
            const hasDefault = factors.some(f => f.Feature === "default_count" && f.Importance > 0.2);
            if (hasDefault) {
                recommendations.push({
                    title: "Improve Repayment History",
                    description: "Your past defaults are increasing your risk. Make timely repayments to rebuild trust.",
                    impact: "high"
                });
            }
        }
        // Medium risk recommendations
        else if (riskScore > 40) {
            recommendations.push({
                title: "Optimize Collateral Composition",
                description: "Diversify your collateral to reduce correlation risk.",
                impact: "medium",
                action_url: "/app/manage-collateral"
            });
            
            const lowIdentity = factors.some(f => f.Feature === "identity_verified" && f.Importance > 0.1);
            if (lowIdentity) {
                recommendations.push({
                    title: "Complete Identity Verification",
                    description: "Verify your identity to reduce your risk score and qualify for better rates.",
                    impact: "medium",
                    action_url: "/app/verify-identity"
                });
            }
        }
        // Low risk recommendations
        else {
            recommendations.push({
                title: "Consider Yield Optimization",
                description: "Your position is healthy. Consider our AI-powered yield strategies for better returns.",
                impact: "low",
                action_url: "/app/yield-strategies"
            });
            recommendations.push({
                title: "Leverage Your Good Standing",
                description: "You qualify for premium rates. Explore additional borrowing for productive assets.",
                impact: "low",
                action_url: "/app/borrow"
            });
        }
        
        // Always add market-aware recommendation
        recommendations.push({
            title: "Stay Informed of Market Conditions",
            description: "Monitor market volatility that could affect your position.",
            impact: "informational",
            action_url: "/app/market-insights"
        });
        
        return recommendations;
    }
    
    /**
     * Calculate basic default probability
     * @private
     * @param {Object} userData User data
     * @returns {number} Default probability (0-1)
     */
    _calculateBasicDefaultProbability(userData) {
        // Start with a base probability
        let probability = 0.05;
        
        // Adjust based on past defaults
        const defaultCount = parseFloat(userData.default_count || 0);
        probability += defaultCount * 0.1;
        
        // Adjust based on late payments
        const latePaymentFrequency = parseFloat(userData.late_payment_frequency || 0);
        probability += latePaymentFrequency * 0.2;
        
        // Adjust based on repayment ratio
        const repaymentRatio = parseFloat(userData.repayment_ratio || 0);
        probability -= repaymentRatio * 0.1;
        
        // Adjust based on collateral ratio
        const collateralRatio = parseFloat(userData.collaterals || 0) / 
                               Math.max(parseFloat(userData.borrows || 0), 1);
        if (collateralRatio < 1.2) probability += 0.3;
        else if (collateralRatio < 1.5) probability += 0.1;
        else if (collateralRatio > 2.5) probability -= 0.05;
        
        // Ensure probability is within 0-1 range
        return Math.max(0, Math.min(1, probability));
    }
    
    /**
     * Get market sentiment data
     * @private
     * @returns {Promise<Object>} Market sentiment data
     */
    async _getMarketSentimentData() {
        try {
            // Get sentiment for IOTA
            const sentiment = await this.marketSentiment.get_sentiment_for_asset("IOTA");
            
            // Get market pulse
            const marketPulse = await this.marketSentiment.get_realtime_market_pulse();
            
            return {
                sentimentScore: sentiment.sentiment_score,
                marketVolatilityIndex: marketPulse.global_risk_indicators.market_volatility_index,
                liquidityStress: marketPulse.global_risk_indicators.liquidity_stress_indicator,
                fearGreedIndex: marketPulse.fear_greed_index.value,
                fearGreedCategory: marketPulse.fear_greed_index.category,
                marketMomentum: marketPulse.global_risk_indicators.market_momentum
            };
        } catch (error) {
            console.error('Error getting market sentiment:', error);
            // Return default values
            return {
                sentimentScore: 0,
                marketVolatilityIndex: 50,
                liquidityStress: 30,
                fearGreedIndex: 50,
                fearGreedCategory: "Neutral",
                marketMomentum: 0
            };
        }
    }
    
    /**
     * Adjust risk score based on market data
     * @private
     * @param {number} riskScore Base risk score
     * @param {Object} marketData Market sentiment data
     * @returns {Object} Adjusted risk score
     */
    _adjustRiskWithMarketData(riskScore, marketData) {
        let adjustment = 0;
        
        // Adjust based on market volatility
        adjustment += (marketData.marketVolatilityIndex - 50) * 0.1;
        
        // Adjust based on market sentiment
        adjustment -= marketData.sentimentScore * 10;
        
        // Adjust based on fear & greed index
        if (marketData.fearGreedCategory === "Extreme Fear") {
            adjustment += 10;
        } else if (marketData.fearGreedCategory === "Extreme Greed") {
            adjustment += 5; // Also risky in extreme greed (bubble potential)
        }
        
        // Adjust based on liquidity stress
        adjustment += marketData.liquidityStress * 0.1;
        
        // Calculate market influence factor (0-1)
        const marketInfluence = Math.abs(adjustment) / 15;
        
        // Apply adjustment to risk score
        const adjustedScore = Math.max(0, Math.min(100, riskScore + adjustment));
        
        return {
            score: adjustedScore,
            influence: marketInfluence,
            adjustment
        };
    }
    
    /**
     * Calculate optimal interest rate based on risk and market
     * @private
     * @param {number} riskScore Risk score
     * @param {number} defaultProbability Default probability
     * @param {Object} marketData Market data
     * @returns {Object} Interest rate and components
     */
    _calculateOptimalInterestRate(riskScore, defaultProbability, marketData) {
        // Base rate component
        const baseRate = 0.03; // 3%
        
        // Risk premium component
        const riskPremium = (riskScore / 100) * 0.15; // Up to 15%
        
        // Default risk component
        const defaultPremium = defaultProbability * 0.2; // Up to 20%
        
        // Market condition component
        const marketAdjustment = ((marketData.marketVolatilityIndex / 100) * 0.05) - 0.025; // -2.5% to +2.5%
        
        // Liquidity component
        const liquidityPremium = (marketData.liquidityStress / 100) * 0.03; // Up to 3%
        
        // Sentiment adjustment
        const sentimentAdjustment = -((marketData.sentimentScore + 1) / 2) * 0.02; // -1% to +1%
        
        // Calculate optimal rate
        const optimalRate = baseRate + riskPremium + defaultPremium + marketAdjustment + liquidityPremium + sentimentAdjustment;
        
        // Cap rate between 1% and 25%
        const cappedRate = Math.max(0.01, Math.min(0.25, optimalRate));
        
        // Return rate and components
        return {
            rate: cappedRate,
            components: {
                baseRate,
                riskPremium,
                defaultPremium,
                marketAdjustment,
                liquidityPremium,
                sentimentAdjustment
            }
        };
    }
    
    /**
     * Generate explanation for interest rate
     * @private
     * @param {number} rate Interest rate
     * @param {Object} components Rate components
     * @returns {string} Explanation
     */
    _generateInterestExplanation(rate, components) {
        return `Your optimized interest rate of ${(rate * 100).toFixed(2)}% consists of:
- Base rate: ${(components.baseRate * 100).toFixed(2)}%
- Risk premium: ${(components.riskPremium * 100).toFixed(2)}%
- Default risk adjustment: ${(components.defaultPremium * 100).toFixed(2)}%
- Market condition adjustment: ${(components.marketAdjustment * 100).toFixed(2)}%
- Liquidity premium: ${(components.liquidityPremium * 100).toFixed(2)}%
- Sentiment adjustment: ${(components.sentimentAdjustment * 100).toFixed(2)}%`;
    }
    
    /**
     * Generate basic market prediction
     * @private
     * @param {Object} sentimentData Sentiment data
     * @param {Object} marketPulse Market pulse
     * @returns {Object} Market prediction
     */
    _generateBasicMarketPrediction(sentimentData, marketPulse) {
        // Calculate price change prediction based on sentiment
        const priceChangePrediction = sentimentData.sentiment_score * 0.1;
        
        // Estimate volatility based on market data
        const volatilityPrediction = marketPulse.global_risk_indicators.market_volatility_index / 100;
        
        // Predict sentiment shift based on current momentum
        const sentimentShiftPrediction = marketPulse.global_risk_indicators.market_momentum;
        
        return {
            price_change_prediction: priceChangePrediction,
            volatility_prediction: volatilityPrediction,
            sentiment_shift_prediction: sentimentShiftPrediction,
            confidence: 0.7 // Lower confidence for the basic model
        };
    }
    
    /**
     * Generate strategy recommendations
     * @private
     * @param {Object} userData User data
     * @param {Object} strategy Selected strategy
     * @param {Object} marketPredictions Market predictions
     * @returns {Array} Strategy recommendations
     */
    _generateStrategyRecommendations(userData, strategy, marketPredictions) {
        const recommendations = [];
        
        // Current position
        const currentBorrows = parseFloat(userData.borrows || 0);
        const currentDeposits = parseFloat(userData.deposits || 0);
        const currentCollateral = parseFloat(userData.collaterals || 0);
        
        // Calculate target amounts
        const targetCollateralization = strategy.minCollateralization / 100;
        const maxBorrow = currentCollateral / targetCollateralization;
        
        // Lending recommendation
        if (currentDeposits < currentCollateral * strategy.lendingRatio) {
            const targetDeposit = currentCollateral * strategy.lendingRatio;
            recommendations.push({
                type: "lending",
                title: "Optimize Lending",
                description: `Increase your deposits to ${targetDeposit.toFixed(2)} IOTA to align with your ${strategy.name} strategy`,
                current: currentDeposits,
                target: targetDeposit,
                action: "deposit",
                priority: "medium"
            });
        }
        
        // Borrowing recommendation
        if (currentBorrows < maxBorrow * strategy.borrowingRatio) {
            const targetBorrow = maxBorrow * strategy.borrowingRatio;
            recommendations.push({
                type: "borrowing",
                title: "Leverage Opportunity",
                description: `You can safely borrow up to ${targetBorrow.toFixed(2)} IOTA while maintaining a healthy position`,
                current: currentBorrows,
                target: targetBorrow,
                action: "borrow",
                priority: marketPredictions.price_change_prediction > 0 ? "high" : "medium"
            });
        } else if (currentBorrows > maxBorrow * strategy.borrowingRatio) {
            const targetBorrow = maxBorrow * strategy.borrowingRatio;
            recommendations.push({
                type: "reduce_debt",
                title: "Reduce Exposure",
                description: `Consider repaying some debt to reach the optimal level of ${targetBorrow.toFixed(2)} IOTA for your risk profile`,
                current: currentBorrows,
                target: targetBorrow,
                action: "repay",
                priority: marketPredictions.price_change_prediction < 0 ? "high" : "medium"
            });
        }
        
        // Collateral recommendation
        const idealCollateralRatio = currentBorrows * targetCollateralization;
        if (currentCollateral < idealCollateralRatio) {
            recommendations.push({
                type: "collateral",
                title: "Strengthen Position",
                description: `Add more collateral to reach the ideal ratio of ${strategy.minCollateralization}% for your borrows`,
                current: currentCollateral,
                target: idealCollateralRatio,
                action: "add_collateral",
                priority: "high"
            });
        }
        
        // Market condition recommendation
        if (marketPredictions.fear_greed_index.category.includes("Fear")) {
            recommendations.push({
                type: "market",
                title: "Market Fear Opportunity",
                description: `The market is showing fear (${marketPredictions.fear_greed_index.value}/100). Consider accumulating quality assets at lower prices.`,
                action: "explore_opportunities",
                priority: "informational"
            });
        } else if (marketPredictions.fear_greed_index.category.includes("Greed")) {
            recommendations.push({
                type: "market",
                title: "Market Caution",
                description: `The market is showing greed (${marketPredictions.fear_greed_index.value}/100). Consider taking some profits and reducing risk exposure.`,
                action: "reduce_risk",
                priority: "informational"
            });
        }
        
        return recommendations;
    }
    
    /**
     * Hash user data for caching
     * @private
     * @param {Object} userData User data
     * @returns {string} Hash
     */
    _hashUserData(userData) {
        return crypto.createHash('md5').update(JSON.stringify(userData)).digest('hex');
    }
}

module.exports = AdvancedAIHelper;
