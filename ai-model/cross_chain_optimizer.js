/**
 * IntelliLend Cross-Chain Liquidity Optimizer
 * 
 * This module uses AI and machine learning to optimize liquidity allocation
 * across multiple chains, maximizing capital efficiency and yield.
 */

const { ethers } = require('ethers');
const axios = require('axios');
const tfjs = require('@tensorflow/tfjs-node');
const fs = require('fs').promises;
const path = require('path');

// Load contract ABIs
const CrossChainLiquidityABI = require('../abis/CrossChainLiquidity.json');
const StrategyControllerABI = require('../abis/StrategyController.json');

class CrossChainOptimizer {
    /**
     * Initialize the cross-chain liquidity optimizer
     * @param {Object} config - Configuration options
     */
    constructor(config) {
        this.config = config;
        this.providers = {};
        this.contracts = {};
        this.models = {};
        this.marketData = {};
        this.strategies = [];
        this.currentAllocation = {};
        this.predictionCache = {};
        
        this.logger = config.logger || console;
        this.logger.info('Initializing Cross-Chain Liquidity Optimizer');
    }
    
    /**
     * Initialize connections to all chains
     */
    async initialize() {
        try {
            // Connect to each chain
            for (const chain of this.config.chains) {
                this.logger.info(`Connecting to chain: ${chain.name} (${chain.chainId})`);
                
                // Set up provider
                const provider = new ethers.providers.JsonRpcProvider(chain.rpcUrl);
                this.providers[chain.chainId] = provider;
                
                // Initialize wallet if private key is provided
                let wallet = null;
                if (chain.privateKey) {
                    wallet = new ethers.Wallet(chain.privateKey, provider);
                    this.logger.info(`Wallet initialized for chain ${chain.chainId}`);
                }
                
                // Set up contracts
                const liquidityContract = new ethers.Contract(
                    chain.liquidityAddress,
                    CrossChainLiquidityABI,
                    wallet || provider
                );
                
                const strategyContract = new ethers.Contract(
                    chain.strategyAddress,
                    StrategyControllerABI,
                    wallet || provider
                );
                
                this.contracts[chain.chainId] = {
                    liquidity: liquidityContract,
                    strategy: strategyContract
                };
                
                // Get initial chain data
                await this.updateChainData(chain.chainId);
            }
            
            // Load AI models
            await this.loadModels();
            
            // Get available strategies
            await this.getAvailableStrategies();
            
            // Get market data
            await this.updateMarketData();
            
            this.logger.info('Cross-Chain Liquidity Optimizer initialized successfully');
            return true;
        } catch (error) {
            this.logger.error('Error initializing Cross-Chain Liquidity Optimizer:', error);
            throw error;
        }
    }
    
    /**
     * Load the AI models for yield prediction and optimization
     */
    async loadModels() {
        try {
            this.logger.info('Loading AI models');
            
            // Load yield prediction model
            this.models.yieldPredictor = await tfjs.loadLayersModel(
                `file://${path.join(this.config.modelPath, 'yield_predictor/model.json')}`
            );
            
            // Load risk assessment model
            this.models.riskAssessor = await tfjs.loadLayersModel(
                `file://${path.join(this.config.modelPath, 'risk_assessor/model.json')}`
            );
            
            // Load optimizer model
            this.models.optimizer = await tfjs.loadLayersModel(
                `file://${path.join(this.config.modelPath, 'allocation_optimizer/model.json')}`
            );
            
            // Load model metadata
            const metadata = JSON.parse(
                await fs.readFile(path.join(this.config.modelPath, 'metadata.json'), 'utf8')
            );
            
            this.models.metadata = metadata;
            this.models.featureNames = metadata.features;
            
            this.logger.info('AI models loaded successfully');
        } catch (error) {
            this.logger.error('Error loading AI models:', error);
            this.logger.info('Will use fallback optimization strategies');
            
            // Set flag to use fallback strategies
            this.useFallbackStrategies = true;
        }
    }
    
    /**
     * Get available yield strategies across all chains
     */
    async getAvailableStrategies() {
        try {
            this.logger.info('Getting available strategies');
            
            this.strategies = [];
            
            // Get strategies from each chain
            for (const chain of this.config.chains) {
                const strategyContract = this.contracts[chain.chainId].strategy;
                
                // Get strategy count
                const strategyCount = await strategyContract.getStrategyCount();
                
                // Get details for each strategy
                for (let i = 0; i < strategyCount; i++) {
                    const strategyId = await strategyContract.strategyIds(i);
                    const details = await strategyContract.getStrategyDetails(strategyId);
                    
                    this.strategies.push({
                        chainId: chain.chainId,
                        chainName: chain.name,
                        id: strategyId,
                        name: details.name,
                        apy: details.projectedAPY.toNumber() / 100, // Convert basis points to percentage
                        risk: details.riskScore.toNumber(),
                        isActive: details.isActive,
                        description: details.description || `Strategy on ${chain.name}`,
                        allocatedAmount: details.allocatedAmount,
                        targetProtocol: details.targetProtocol
                    });
                }
            }
            
            this.logger.info(`Found ${this.strategies.length} available strategies`);
        } catch (error) {
            this.logger.error('Error getting available strategies:', error);
            throw error;
        }
    }
    
    /**
     * Update chain-specific data
     * @param {number} chainId - Chain ID to update
     */
    async updateChainData(chainId) {
        try {
            const liquidityContract = this.contracts[chainId].liquidity;
            
            // Get supported tokens
            const tokens = await liquidityContract.getSupportedTokens();
            
            // Get liquidity data for each token
            const liquidityData = {};
            
            for (const token of tokens) {
                const pool = await liquidityContract.getLiquidityPool(token);
                
                liquidityData[token] = {
                    symbol: token,
                    totalLiquidity: ethers.utils.formatEther(pool.totalLiquidity),
                    allocatedLiquidity: ethers.utils.formatEther(pool.allocatedLiquidity),
                    utilizationRate: pool.utilizationRate.toNumber() / 1e6, // Convert to percentage
                    apy: pool.apy.toNumber() / 1e6, // Convert to percentage
                    active: pool.active
                };
            }
            
            // Store chain data
            if (!this.currentAllocation[chainId]) {
                this.currentAllocation[chainId] = {};
            }
            
            this.currentAllocation[chainId].tokens = tokens;
            this.currentAllocation[chainId].liquidity = liquidityData;
            this.currentAllocation[chainId].lastUpdated = Date.now();
            
            this.logger.info(`Updated chain data for ${chainId}: ${tokens.length} tokens`);
        } catch (error) {
            this.logger.error(`Error updating chain data for ${chainId}:`, error);
            throw error;
        }
    }
    
    /**
     * Update market data from external sources
     */
    async updateMarketData() {
        try {
            this.logger.info('Updating market data');
            
            // Get market data from external API
            const response = await axios.get(this.config.marketDataUrl);
            const data = response.data;
            
            // Process market data
            this.marketData = {
                tokens: {},
                volatility: data.marketVolatility || 0.2,
                trend: data.marketTrend || 'neutral',
                lastUpdated: Date.now()
            };
            
            // Process token-specific data
            for (const token of data.tokens) {
                this.marketData.tokens[token.symbol] = {
                    price: token.price,
                    priceChange24h: token.priceChange24h,
                    volatility: token.volatility,
                    marketCap: token.marketCap,
                    liquidity: token.liquidity
                };
            }
            
            this.logger.info(`Updated market data for ${Object.keys(this.marketData.tokens).length} tokens`);
        } catch (error) {
            this.logger.error('Error updating market data:', error);
            this.logger.info('Using default market data');
            
            // Use default data if API fails
            this.marketData = {
                tokens: {
                    'IOTA': {
                        price: 1.0,
                        priceChange24h: 0,
                        volatility: 0.2,
                        marketCap: 1e9,
                        liquidity: 1e8
                    }
                },
                volatility: 0.2,
                trend: 'neutral',
                lastUpdated: Date.now()
            };
        }
    }
    
    /**
     * Optimize liquidity allocation across chains and strategies
     * @param {Object} options - Optimization options
     * @returns {Object} Optimization results
     */
    async optimizeAllocation(options = {}) {
        const {
            riskTolerance = 'medium',
            optimizationGoal = 'balanced',
            rebalanceThreshold = 0.05,
            maxSlippage = 0.02
        } = options;
        
        try {
            this.logger.info(`Optimizing allocation with risk tolerance: ${riskTolerance}`);
            
            // Update data
            await Promise.all(this.config.chains.map(chain => 
                this.updateChainData(chain.chainId)
            ));
            await this.updateMarketData();
            
            // Get current allocation
            const currentAllocation = this.getCurrentAllocation();
            
            // Predict yields for all strategies
            const predictedYields = await this.predictStrategyYields();
            
            // Generate allocation plan
            let allocationPlan;
            
            if (this.useFallbackStrategies || !this.models.optimizer) {
                allocationPlan = this.generateFallbackAllocationPlan(
                    currentAllocation,
                    predictedYields,
                    riskTolerance,
                    optimizationGoal
                );
            } else {
                allocationPlan = await this.generateAIAllocationPlan(
                    currentAllocation,
                    predictedYields,
                    riskTolerance,
                    optimizationGoal
                );
            }
            
            // Calculate rebalancing needs
            const rebalancingActions = this.calculateRebalancingActions(
                currentAllocation,
                allocationPlan,
                rebalanceThreshold
            );
            
            // Create execution plan
            const executionPlan = await this.createExecutionPlan(
                rebalancingActions,
                maxSlippage
            );
            
            return {
                currentAllocation,
                predictedYields,
                allocationPlan,
                rebalancingActions,
                executionPlan,
                timestamp: Date.now()
            };
        } catch (error) {
            this.logger.error('Error optimizing allocation:', error);
            throw error;
        }
    }
    
    /**
     * Get current allocation across all chains and strategies
     * @returns {Object} Current allocation
     */
    getCurrentAllocation() {
        const currentAllocation = {
            byChain: {},
            byToken: {},
            byStrategy: {},
            total: 0
        };
        
        // Aggregate data from all chains
        for (const chain of this.config.chains) {
            const chainId = chain.chainId;
            const chainData = this.currentAllocation[chainId];
            
            if (!chainData) continue;
            
            // Initialize chain data
            currentAllocation.byChain[chainId] = {
                name: chain.name,
                totalLiquidity: 0,
                allocatedLiquidity: 0,
                utilizationRate: 0,
                tokens: {}
            };
            
            // Process token data
            for (const token of chainData.tokens) {
                const tokenData = chainData.liquidity[token];
                
                if (!tokenData) continue;
                
                // Add to chain total
                currentAllocation.byChain[chainId].totalLiquidity += parseFloat(tokenData.totalLiquidity);
                currentAllocation.byChain[chainId].allocatedLiquidity += parseFloat(tokenData.allocatedLiquidity);
                
                // Add to token total
                if (!currentAllocation.byToken[token]) {
                    currentAllocation.byToken[token] = {
                        symbol: token,
                        totalLiquidity: 0,
                        allocatedLiquidity: 0,
                        byChain: {}
                    };
                }
                
                currentAllocation.byToken[token].totalLiquidity += parseFloat(tokenData.totalLiquidity);
                currentAllocation.byToken[token].allocatedLiquidity += parseFloat(tokenData.allocatedLiquidity);
                
                // Add chain-specific data
                currentAllocation.byChain[chainId].tokens[token] = tokenData;
                currentAllocation.byToken[token].byChain[chainId] = tokenData;
            }
            
            // Calculate chain utilization rate
            if (currentAllocation.byChain[chainId].totalLiquidity > 0) {
                currentAllocation.byChain[chainId].utilizationRate = 
                    currentAllocation.byChain[chainId].allocatedLiquidity / 
                    currentAllocation.byChain[chainId].totalLiquidity;
            }
            
            // Add to total
            currentAllocation.total += currentAllocation.byChain[chainId].totalLiquidity;
        }
        
        // Process strategy allocations
        for (const strategy of this.strategies) {
            if (!strategy.isActive) continue;
            
            const chainId = strategy.chainId;
            const strategyId = strategy.id;
            
            currentAllocation.byStrategy[strategyId] = {
                ...strategy,
                percentage: strategy.allocatedAmount > 0 ? 
                    strategy.allocatedAmount / currentAllocation.total : 0
            };
        }
        
        return currentAllocation;
    }
    
    /**
     * Predict yields for all strategies using the AI model
     * @returns {Object} Predicted yields for each strategy
     */
    async predictStrategyYields() {
        try {
            this.logger.info('Predicting strategy yields');
            
            const predictions = {};
            
            // Use the AI model if available
            if (this.models.yieldPredictor && !this.useFallbackStrategies) {
                // Prepare data for batch prediction
                const batchData = this.strategies.filter(s => s.isActive).map(strategy => {
                    // Create feature vector for the strategy
                    return this.createFeatureVector(strategy);
                });
                
                if (batchData.length > 0) {
                    // Convert to tensor
                    const inputTensor = tfjs.tensor2d(batchData);
                    
                    // Make prediction
                    const outputTensor = this.models.yieldPredictor.predict(inputTensor);
                    const results = await outputTensor.array();
                    
                    // Process results
                    this.strategies.filter(s => s.isActive).forEach((strategy, index) => {
                        if (index < results.length) {
                            const [predictedYield, confidenceScore, volatility] = results[index];
                            
                            predictions[strategy.id] = {
                                strategyId: strategy.id,
                                chainId: strategy.chainId,
                                predictedYield: predictedYield,
                                confidenceScore: confidenceScore,
                                volatility: volatility,
                                adjustedYield: predictedYield * confidenceScore, // Risk-adjusted yield
                                timestamp: Date.now()
                            };
                        }
                    });
                    
                    // Clean up tensors
                    inputTensor.dispose();
                    outputTensor.dispose();
                }
            } else {
                // Use fallback prediction method
                this.strategies.filter(s => s.isActive).forEach(strategy => {
                    // Simple heuristic based on strategy APY and risk
                    const baseYield = strategy.apy;
                    const risk = strategy.risk / 100; // Normalize to 0-1
                    
                    // Adjust yield based on market conditions
                    const marketAdjustment = this.getMarketAdjustment(strategy);
                    
                    // Calculate predicted yield
                    const predictedYield = baseYield * (1 + marketAdjustment);
                    
                    // Higher risk means lower confidence
                    const confidenceScore = 1 - (risk * 0.5);
                    
                    // Volatility increases with risk
                    const volatility = risk * 0.3 + 0.1;
                    
                    predictions[strategy.id] = {
                        strategyId: strategy.id,
                        chainId: strategy.chainId,
                        predictedYield: predictedYield,
                        confidenceScore: confidenceScore,
                        volatility: volatility,
                        adjustedYield: predictedYield * confidenceScore, // Risk-adjusted yield
                        timestamp: Date.now()
                    };
                });
            }
            
            this.logger.info(`Generated yield predictions for ${Object.keys(predictions).length} strategies`);
            return predictions;
        } catch (error) {
            this.logger.error('Error predicting strategy yields:', error);
            throw error;
        }
    }
    
    /**
     * Create feature vector for AI model prediction
     * @param {Object} strategy - Strategy data
     * @returns {Array} Feature vector
     */
    createFeatureVector(strategy) {
        // Get market data for relevant tokens
        const marketData = this.marketData;
        
        // Create feature vector based on model metadata
        const features = this.models.featureNames.map(feature => {
            switch (feature) {
                case 'strategy_apy':
                    return strategy.apy;
                case 'strategy_risk':
                    return strategy.risk / 100; // Normalize to 0-1
                case 'chain_id':
                    return strategy.chainId / 1000; // Normalize
                case 'market_volatility':
                    return marketData.volatility;
                case 'token_price_change':
                    const tokenSymbol = this.getStrategyToken(strategy);
                    return tokenSymbol && marketData.tokens[tokenSymbol] ? 
                        marketData.tokens[tokenSymbol].priceChange24h / 100 : 0;
                case 'token_volatility':
                    const symbol = this.getStrategyToken(strategy);
                    return symbol && marketData.tokens[symbol] ? 
                        marketData.tokens[symbol].volatility : 0.2;
                case 'utilization_rate':
                    const chainData = this.currentAllocation[strategy.chainId];
                    return chainData ? 
                        chainData.utilizationRate || 0 : 0;
                case 'market_trend':
                    return marketData.trend === 'bullish' ? 1 : 
                        marketData.trend === 'bearish' ? -1 : 0;
                default:
                    return 0;
            }
        });
        
        return features;
    }
    
    /**
     * Get market adjustment for a strategy
     * @param {Object} strategy - Strategy data
     * @returns {number} Market adjustment factor
     */
    getMarketAdjustment(strategy) {
        const marketData = this.marketData;
        const tokenSymbol = this.getStrategyToken(strategy);
        
        // Default adjustment
        let adjustment = 0;
        
        // Adjust based on market trend
        if (marketData.trend === 'bullish') {
            adjustment += 0.1;
        } else if (marketData.trend === 'bearish') {
            adjustment -= 0.1;
        }
        
        // Adjust based on token-specific data
        if (tokenSymbol && marketData.tokens[tokenSymbol]) {
            const tokenData = marketData.tokens[tokenSymbol];
            
            // Price momentum effect
            adjustment += tokenData.priceChange24h / 100;
            
            // Volatility effect
            adjustment -= tokenData.volatility * 0.2;
        } else {
            // Apply general market volatility
            adjustment -= marketData.volatility * 0.2;
        }
        
        return adjustment;
    }
    
    /**
     * Get the primary token for a strategy
     * @param {Object} strategy - Strategy data
     * @returns {string} Token symbol
     */
    getStrategyToken(strategy) {
        // Extract token from strategy name or description
        const name = strategy.name.toUpperCase();
        const desc = strategy.description.toUpperCase();
        
        // Check for common tokens
        const commonTokens = ['IOTA', 'MIOTA', 'ETH', 'BTC', 'USDT', 'USDC'];
        
        for (const token of commonTokens) {
            if (name.includes(token) || desc.includes(token)) {
                return token;
            }
        }
        
        // Default to IOTA
        return 'IOTA';
    }
    
    /**
     * Generate allocation plan using the AI optimizer model
     * @param {Object} currentAllocation - Current allocation data
     * @param {Object} predictedYields - Predicted yields for strategies
     * @param {string} riskTolerance - Risk tolerance level
     * @param {string} optimizationGoal - Optimization goal
     * @returns {Object} Allocation plan
     */
    async generateAIAllocationPlan(
        currentAllocation,
        predictedYields,
        riskTolerance,
        optimizationGoal
    ) {
        try {
            this.logger.info('Generating AI allocation plan');
            
            // Create input features for the optimizer
            const allStrategies = this.strategies.filter(s => s.isActive);
            const strategyFeatures = allStrategies.map(strategy => {
                const prediction = predictedYields[strategy.id];
                return [
                    strategy.chainId / 1000, // Normalize chain ID
                    strategy.apy,
                    strategy.risk / 100,
                    prediction ? prediction.predictedYield : strategy.apy,
                    prediction ? prediction.confidenceScore : 0.8,
                    prediction ? prediction.volatility : 0.2,
                    currentAllocation.byStrategy[strategy.id] ? 
                        currentAllocation.byStrategy[strategy.id].percentage : 0
                ];
            });
            
            // Convert risk tolerance to number
            const riskToleranceValue = 
                riskTolerance === 'high' ? 0.8 :
                riskTolerance === 'medium' ? 0.5 :
                0.2; // low
            
            // Convert optimization goal to vector
            const optimizationVector = 
                optimizationGoal === 'yield' ? [0.8, 0.2] :
                optimizationGoal === 'safety' ? [0.2, 0.8] :
                [0.5, 0.5]; // balanced
            
            // Combine all input features
            const inputFeatures = [
                ...strategyFeatures.flat(),
                riskToleranceValue,
                ...optimizationVector,
                this.marketData.volatility
            ];
            
            // Create input tensor
            const inputTensor = tfjs.tensor2d([inputFeatures]);
            
            // Run the optimizer model
            const outputTensor = this.models.optimizer.predict(inputTensor);
            const allocationWeights = await outputTensor.array();
            
            // Clean up tensors
            inputTensor.dispose();
            outputTensor.dispose();
            
            // Process allocation weights
            const allocationPlan = {
                byStrategy: {},
                byChain: {},
                byToken: {},
                riskLevel: riskTolerance,
                expectedYield: 0,
                expectedRisk: 0,
                timestamp: Date.now()
            };
            
            // Normalize weights if needed
            const weights = allocationWeights[0];
            const totalWeight = weights.reduce((sum, w) => sum + w, 0);
            const normalizedWeights = totalWeight > 0 ? 
                weights.map(w => w / totalWeight) : 
                weights;
            
            // Assign weights to strategies
            allStrategies.forEach((strategy, index) => {
                const weight = normalizedWeights[index];
                
                allocationPlan.byStrategy[strategy.id] = {
                    ...strategy,
                    allocationPercentage: weight,
                    expectedYield: predictedYields[strategy.id] ? 
                        predictedYields[strategy.id].predictedYield : strategy.apy,
                    expectedRisk: strategy.risk / 100
                };
                
                // Update expected yield and risk
                allocationPlan.expectedYield += weight * allocationPlan.byStrategy[strategy.id].expectedYield;
                allocationPlan.expectedRisk += weight * allocationPlan.byStrategy[strategy.id].expectedRisk;
                
                // Update chain allocation
                if (!allocationPlan.byChain[strategy.chainId]) {
                    allocationPlan.byChain[strategy.chainId] = {
                        name: strategy.chainName,
                        allocationPercentage: 0,
                        strategies: {}
                    };
                }
                
                allocationPlan.byChain[strategy.chainId].allocationPercentage += weight;
                allocationPlan.byChain[strategy.chainId].strategies[strategy.id] = weight;
                
                // Update token allocation (simplified)
                const tokenSymbol = this.getStrategyToken(strategy);
                
                if (!allocationPlan.byToken[tokenSymbol]) {
                    allocationPlan.byToken[tokenSymbol] = {
                        symbol: tokenSymbol,
                        allocationPercentage: 0
                    };
                }
                
                allocationPlan.byToken[tokenSymbol].allocationPercentage += weight;
            });
            
            return allocationPlan;
        } catch (error) {
            this.logger.error('Error generating AI allocation plan:', error);
            // Fall back to heuristic method
            return this.generateFallbackAllocationPlan(
                currentAllocation,
                predictedYields,
                riskTolerance,
                optimizationGoal
            );
        }
    }
    
    /**
     * Generate allocation plan using heuristic rules (fallback method)
     * @param {Object} currentAllocation - Current allocation data
     * @param {Object} predictedYields - Predicted yields for strategies
     * @param {string} riskTolerance - Risk tolerance level
     * @param {string} optimizationGoal - Optimization goal
     * @returns {Object} Allocation plan
     */
    generateFallbackAllocationPlan(
        currentAllocation,
        predictedYields,
        riskTolerance,
        optimizationGoal
    ) {
        this.logger.info('Generating fallback allocation plan');
        
        // Get active strategies
        const allStrategies = this.strategies.filter(s => s.isActive);
        
        // Set risk threshold based on tolerance
        const maxRiskScore = 
            riskTolerance === 'high' ? 100 :
            riskTolerance === 'medium' ? 70 :
            40; // low
        
        // Filter strategies by risk threshold
        const eligibleStrategies = allStrategies.filter(s => s.risk <= maxRiskScore);
        
        if (eligibleStrategies.length === 0) {
            // If no strategies meet the risk criteria, use low-risk ones
            eligibleStrategies = allStrategies
                .sort((a, b) => a.risk - b.risk)
                .slice(0, Math.max(3, Math.floor(allStrategies.length / 3)));
        }
        
        // Calculate score for each strategy based on optimization goal
        const scoredStrategies = eligibleStrategies.map(strategy => {
            const prediction = predictedYields[strategy.id];
            const expectedYield = prediction ? prediction.predictedYield : strategy.apy;
            const riskFactor = strategy.risk / 100;
            const confidenceFactor = prediction ? prediction.confidenceScore : 0.8;
            
            // Calculate score based on optimization goal
            let score;
            
            if (optimizationGoal === 'yield') {
                // Prioritize yield
                score = expectedYield * confidenceFactor;
            } else if (optimizationGoal === 'safety') {
                // Prioritize safety
                score = expectedYield * confidenceFactor * (1 - riskFactor);
            } else {
                // Balanced approach
                score = expectedYield * confidenceFactor * Math.pow(1 - riskFactor, 0.5);
            }
            
            return {
                strategy,
                score,
                expectedYield,
                riskFactor
            };
        });
        
        // Sort strategies by score
        scoredStrategies.sort((a, b) => b.score - a.score);
        
        // Calculate allocation weights
        const totalScore = scoredStrategies.reduce((sum, s) => sum + s.score, 0);
        const allocations = scoredStrategies.map(s => {
            return {
                strategy: s.strategy,
                weight: totalScore > 0 ? s.score / totalScore : 1 / scoredStrategies.length,
                expectedYield: s.expectedYield,
                riskFactor: s.riskFactor
            };
        });
        
        // Create allocation plan
        const allocationPlan = {
            byStrategy: {},
            byChain: {},
            byToken: {},
            riskLevel: riskTolerance,
            expectedYield: 0,
            expectedRisk: 0,
            timestamp: Date.now()
        };
        
        // Populate allocation plan
        allocations.forEach(allocation => {
            const strategy = allocation.strategy;
            
            allocationPlan.byStrategy[strategy.id] = {
                ...strategy,
                allocationPercentage: allocation.weight,
                expectedYield: allocation.expectedYield,
                expectedRisk: allocation.riskFactor
            };
            
            // Update expected yield and risk
            allocationPlan.expectedYield += allocation.weight * allocation.expectedYield;
            allocationPlan.expectedRisk += allocation.weight * allocation.riskFactor;
            
            // Update chain allocation
            if (!allocationPlan.byChain[strategy.chainId]) {
                allocationPlan.byChain[strategy.chainId] = {
                    name: strategy.chainName,
                    allocationPercentage: 0,
                    strategies: {}
                };
            }
            
            allocationPlan.byChain[strategy.chainId].allocationPercentage += allocation.weight;
            allocationPlan.byChain[strategy.chainId].strategies[strategy.id] = allocation.weight;
            
            // Update token allocation
            const tokenSymbol = this.getStrategyToken(strategy);
            
            if (!allocationPlan.byToken[tokenSymbol]) {
                allocationPlan.byToken[tokenSymbol] = {
                    symbol: tokenSymbol,
                    allocationPercentage: 0
                };
            }
            
            allocationPlan.byToken[tokenSymbol].allocationPercentage += allocation.weight;
        });
        
        return allocationPlan;
    }
    
    /**
     * Calculate rebalancing actions needed to reach target allocation
     * @param {Object} currentAllocation - Current allocation
     * @param {Object} targetAllocation - Target allocation plan
     * @param {number} threshold - Minimum difference to trigger rebalancing
     * @returns {Object} Rebalancing actions
     */
    calculateRebalancingActions(currentAllocation, targetAllocation, threshold) {
        this.logger.info(`Calculating rebalancing actions with threshold ${threshold}`);
        
        const actions = {
            strategies: [],
            chains: [],
            total: {
                moveFunds: 0,
                estimatedGasCost: 0,
                estimatedTimeToComplete: 0
            }
        };
        
        const totalLiquidity = currentAllocation.total;
        
        // Calculate strategy-level actions
        Object.entries(targetAllocation.byStrategy).forEach(([strategyId, targetData]) => {
            const currentData = currentAllocation.byStrategy[strategyId] || {
                allocatedAmount: 0,
                percentage: 0
            };
            
            const targetPercentage = targetData.allocationPercentage;
            const currentPercentage = currentData.percentage;
            const percentageDiff = targetPercentage - currentPercentage;
            
            // Check if difference exceeds threshold
            if (Math.abs(percentageDiff) >= threshold) {
                const amountDiff = percentageDiff * totalLiquidity;
                
                actions.strategies.push({
                    strategyId,
                    chainId: targetData.chainId,
                    action: percentageDiff > 0 ? 'increase' : 'decrease',
                    currentPercentage,
                    targetPercentage,
                    percentageDiff,
                    amountDiff: Math.abs(amountDiff),
                    expectedYield: targetData.expectedYield,
                    expectedRisk: targetData.expectedRisk
                });
            }
        });
        
        // Calculate chain-level actions
        Object.entries(targetAllocation.byChain).forEach(([chainId, targetData]) => {
            const currentChainData = currentAllocation.byChain[chainId] || {
                totalLiquidity: 0
            };
            
            const targetPercentage = targetData.allocationPercentage;
            const currentPercentage = currentChainData.totalLiquidity / totalLiquidity;
            const percentageDiff = targetPercentage - currentPercentage;
            
            // Check if difference exceeds threshold
            if (Math.abs(percentageDiff) >= threshold) {
                const amountDiff = percentageDiff * totalLiquidity;
                
                actions.chains.push({
                    chainId: parseInt(chainId),
                    name: targetData.name,
                    action: percentageDiff > 0 ? 'increase' : 'decrease',
                    currentPercentage,
                    targetPercentage,
                    percentageDiff,
                    amountDiff: Math.abs(amountDiff)
                });
            }
        });
        
        // Calculate totals
        actions.total.moveFunds = actions.strategies.reduce(
            (sum, action) => sum + action.amountDiff, 0
        );
        
        // Estimate gas costs (simplified)
        const avgGasCost = 0.05; // Average cost per transaction in IOTA
        actions.total.estimatedGasCost = actions.strategies.length * avgGasCost;
        
        // Estimate time to complete (simplified)
        const avgTimePerAction = 2 * 60; // 2 minutes per action
        actions.total.estimatedTimeToComplete = actions.strategies.length * avgTimePerAction;
        
        this.logger.info(`Calculated ${actions.strategies.length} strategy actions and ${actions.chains.length} chain actions`);
        
        return actions;
    }
    
    /**
     * Create an execution plan for rebalancing
     * @param {Object} rebalancingActions - Rebalancing actions
     * @param {number} maxSlippage - Maximum allowed slippage
     * @returns {Object} Execution plan
     */
    async createExecutionPlan(rebalancingActions, maxSlippage) {
        this.logger.info('Creating execution plan');
        
        const executionPlan = {
            steps: [],
            estimatedGas: rebalancingActions.total.estimatedGasCost,
            estimatedTime: rebalancingActions.total.estimatedTimeToComplete,
            timestamp: Date.now()
        };
        
        // Group actions by chain for efficiency
        const actionsByChain = {};
        
        rebalancingActions.strategies.forEach(action => {
            if (!actionsByChain[action.chainId]) {
                actionsByChain[action.chainId] = {
                    increases: [],
                    decreases: []
                };
            }
            
            if (action.action === 'increase') {
                actionsByChain[action.chainId].increases.push(action);
            } else {
                actionsByChain[action.chainId].decreases.push(action);
            }
        });
        
        // Create steps for each chain
        let stepIndex = 1;
        
        for (const chain of this.config.chains) {
            const chainId = chain.chainId;
            const chainActions = actionsByChain[chainId];
            
            if (!chainActions) continue;
            
            // First process decreases
            if (chainActions.decreases.length > 0) {
                for (const action of chainActions.decreases) {
                    executionPlan.steps.push({
                        index: stepIndex++,
                        chainId,
                        chainName: chain.name,
                        strategyId: action.strategyId,
                        action: 'decrease',
                        amount: action.amountDiff,
                        functionName: 'withdrawFromStrategy',
                        parameters: [
                            action.strategyId,
                            ethers.utils.parseEther(action.amountDiff.toString())
                        ],
                        maxSlippage,
                        estimatedGas: 0.01,
                        dependencies: []
                    });
                }
            }
            
            // Then process increases
            if (chainActions.increases.length > 0) {
                for (const action of chainActions.increases) {
                    // Find matching decreases from same chain to use as dependencies
                    const dependencies = chainActions.decreases.map(d => 
                        executionPlan.steps.find(s => 
                            s.strategyId === d.strategyId && s.action === 'decrease'
                        )?.index
                    ).filter(Boolean);
                    
                    executionPlan.steps.push({
                        index: stepIndex++,
                        chainId,
                        chainName: chain.name,
                        strategyId: action.strategyId,
                        action: 'increase',
                        amount: action.amountDiff,
                        functionName: 'executeStrategy',
                        parameters: [
                            this.getStrategyToken(this.strategies.find(s => s.id === action.strategyId)),
                            action.strategyId,
                            ethers.utils.parseEther(action.amountDiff.toString())
                        ],
                        maxSlippage,
                        estimatedGas: 0.02,
                        dependencies
                    });
                }
            }
        }
        
        // Add cross-chain transfers if needed
        const chainBalances = {};
        
        // Calculate required balances for each chain
        executionPlan.steps.forEach(step => {
            if (!chainBalances[step.chainId]) {
                chainBalances[step.chainId] = 0;
            }
            
            if (step.action === 'decrease') {
                chainBalances[step.chainId] += step.amount;
            } else {
                chainBalances[step.chainId] -= step.amount;
            }
        });
        
        // Add cross-chain transfer steps where needed
        const transferSteps = [];
        let chainIds = Object.keys(chainBalances).map(id => parseInt(id));
        
        // Sort chains by balance (descending)
        chainIds.sort((a, b) => chainBalances[b] - chainBalances[a]);
        
        // Match excess funds with deficits
        while (chainIds.length >= 2) {
            const sourceChainId = chainIds[0];
            const targetChainId = chainIds[chainIds.length - 1];
            
            const sourceBalance = chainBalances[sourceChainId];
            const targetBalance = chainBalances[targetChainId];
            
            if (sourceBalance <= 0 || targetBalance >= 0) {
                // No more transfers needed
                break;
            }
            
            // Calculate transfer amount
            const transferAmount = Math.min(sourceBalance, -targetBalance);
            
            if (transferAmount > 0) {
                transferSteps.push({
                    index: stepIndex++,
                    sourceChainId,
                    sourceChainName: this.config.chains.find(c => c.chainId === sourceChainId).name,
                    targetChainId,
                    targetChainName: this.config.chains.find(c => c.chainId === targetChainId).name,
                    action: 'transfer',
                    amount: transferAmount,
                    functionName: 'initiateTransfer',
                    parameters: [
                        targetChainId,
                        '0x', // Will be replaced with recipient address
                        'IOTA', // Default token
                        ethers.utils.parseEther(transferAmount.toString())
                    ],
                    maxSlippage,
                    estimatedGas: 0.05,
                    dependencies: executionPlan.steps
                        .filter(s => s.chainId === sourceChainId && s.action === 'decrease')
                        .map(s => s.index)
                });
                
                // Update balances
                chainBalances[sourceChainId] -= transferAmount;
                chainBalances[targetChainId] += transferAmount;
            }
            
            // Re-sort chains
            chainIds = Object.keys(chainBalances).map(id => parseInt(id));
            chainIds.sort((a, b) => chainBalances[b] - chainBalances[a]);
        }
        
        // Add transfer steps to the execution plan
        executionPlan.steps.push(...transferSteps);
        
        // Update dependencies for increase actions to depend on transfers
        executionPlan.steps.forEach(step => {
            if (step.action === 'increase') {
                // Find transfers to this chain
                const transfers = transferSteps.filter(t => t.targetChainId === step.chainId);
                
                if (transfers.length > 0) {
                    // Add transfer indices as dependencies
                    transfers.forEach(transfer => {
                        if (!step.dependencies.includes(transfer.index)) {
                            step.dependencies.push(transfer.index);
                        }
                    });
                }
            }
        });
        
        this.logger.info(`Created execution plan with ${executionPlan.steps.length} steps`);
        return executionPlan;
    }
    
    /**
     * Execute a rebalancing plan
     * @param {Object} executionPlan - Execution plan to execute
     * @returns {Object} Execution results
     */
    async executeRebalancing(executionPlan) {
        this.logger.info('Executing rebalancing plan');
        
        const results = {
            steps: [],
            success: true,
            completedSteps: 0,
            totalSteps: executionPlan.steps.length,
            gasUsed: 0,
            errors: []
        };
        
        // Dependency tracking
        const completedSteps = new Set();
        const pendingSteps = new Set(executionPlan.steps.map(step => step.index));
        
        // Execute until all steps completed or max attempts reached
        let remainingAttempts = 3;
        
        while (pendingSteps.size > 0 && remainingAttempts > 0) {
            let progress = false;
            
            // Find steps that can be executed (all dependencies satisfied)
            for (const step of executionPlan.steps) {
                if (!pendingSteps.has(step.index)) {
                    // Already processed
                    continue;
                }
                
                // Check if all dependencies are satisfied
                const dependenciesSatisfied = step.dependencies.every(dep => completedSteps.has(dep));
                
                if (dependenciesSatisfied) {
                    try {
                        // Execute the step
                        const result = await this.executeStep(step);
                        
                        // Record result
                        results.steps.push({
                            ...step,
                            success: result.success,
                            txHash: result.txHash,
                            gasUsed: result.gasUsed,
                            error: result.error
                        });
                        
                        if (result.success) {
                            completedSteps.add(step.index);
                            pendingSteps.delete(step.index);
                            results.gasUsed += result.gasUsed;
                            results.completedSteps++;
                            progress = true;
                        } else {
                            results.errors.push({
                                step: step.index,
                                error: result.error
                            });
                        }
                    } catch (error) {
                        this.logger.error(`Error executing step ${step.index}:`, error);
                        
                        results.steps.push({
                            ...step,
                            success: false,
                            error: error.message
                        });
                        
                        results.errors.push({
                            step: step.index,
                            error: error.message
                        });
                    }
                }
            }
            
            // If no progress was made, try again with remaining steps
            if (!progress) {
                remainingAttempts--;
                
                if (remainingAttempts > 0) {
                    this.logger.warn(`No progress made, retrying remaining steps (${remainingAttempts} attempts left)`);
                    await new Promise(resolve => setTimeout(resolve, 30000)); // Wait 30 seconds
                }
            }
        }
        
        // Update success flag
        results.success = results.completedSteps === results.totalSteps;
        
        this.logger.info(`Rebalancing execution completed: ${results.completedSteps}/${results.totalSteps} steps successful`);
        
        return results;
    }
    
    /**
     * Execute a single step in the rebalancing plan
     * @param {Object} step - Step to execute
     * @returns {Object} Execution result
     */
    async executeStep(step) {
        this.logger.info(`Executing step ${step.index}: ${step.action} on chain ${step.chainId}`);
        
        try {
            // Get contract based on step type
            let contract;
            
            if (step.action === 'transfer') {
                contract = this.contracts[step.sourceChainId].liquidity;
            } else {
                contract = 
                    step.functionName === 'executeStrategy' ? 
                    this.contracts[step.chainId].liquidity :
                    this.contracts[step.chainId].strategy;
            }
            
            // Execute transaction
            const tx = await contract.functions[step.functionName](
                ...step.parameters,
                { gasLimit: 500000 } // Ensure enough gas
            );
            
            // Wait for confirmation
            const receipt = await tx.wait();
            
            this.logger.info(`Step ${step.index} executed successfully: ${receipt.transactionHash}`);
            
            return {
                success: true,
                txHash: receipt.transactionHash,
                gasUsed: receipt.gasUsed.toNumber(),
                error: null
            };
        } catch (error) {
            this.logger.error(`Error executing step ${step.index}:`, error);
            
            return {
                success: false,
                txHash: null,
                gasUsed: 0,
                error: error.message
            };
        }
    }
}

module.exports = CrossChainOptimizer;
