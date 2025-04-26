/**
 * Risk Assessment Controller
 * 
 * This controller handles API endpoints for risk assessment functionality,
 * including user risk scoring, recommendations, and model performance metrics.
 */

const { ethers } = require('ethers');
const logger = require('../../utils/logger');
const RiskAssessmentService = require('../services/riskAssessmentService');

// Initialize risk assessment service
const riskService = new RiskAssessmentService();

/**
 * Assess risk for a user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const assessRisk = async (req, res) => {
    try {
        const { address, onChainData } = req.body;
        
        // Validate Ethereum address
        if (!ethers.utils.isAddress(address)) {
            return res.status(400).json({ error: 'Invalid Ethereum address' });
        }
        
        // Get IOTA address from query param or body if available
        const iotaAddress = req.query.iotaAddress || req.body.iotaAddress;
        
        // Set IOTA clients if available in req.app
        if (req.app.iotaClient) {
            riskService.setIotaClient(req.app.iotaClient);
        }
        
        if (req.app.iotaAccount) {
            riskService.setIotaAccount(req.app.iotaAccount);
        }
        
        // Use provided on-chain data or fetch it
        const userData = onChainData || await riskService.fetchUserData(address);
        
        // Add IOTA address if provided
        if (iotaAddress) {
            userData.iotaAddress = iotaAddress;
        }
        
        // Generate risk assessment
        const riskAssessment = await riskService.assessRisk(address, userData, {
            useCachedData: req.query.useCache !== 'false',
            forceRefresh: req.query.forceRefresh === 'true',
            includeIOTA: req.query.includeIOTA !== 'false'
        });
        
        // Return risk assessment with recommendations
        res.json({
            address,
            riskScore: riskAssessment.riskScore,
            riskClass: riskAssessment.riskClass,
            confidence: riskAssessment.confidenceScore || 0.85,
            recommendations: riskAssessment.recommendations || [],
            topFactors: riskAssessment.riskFactors || [],
            analysisTimestamp: riskAssessment.timestamp || Date.now()
        });
    } catch (error) {
        logger.error(`Error assessing risk for ${req.body?.address}:`, error);
        res.status(500).json({ error: 'Error processing risk assessment', message: error.message });
    }
};

/**
 * Get recommendations for a user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getRecommendations = async (req, res) => {
    try {
        const { address } = req.params;
        
        // Validate Ethereum address
        if (!ethers.utils.isAddress(address)) {
            return res.status(400).json({ error: 'Invalid Ethereum address' });
        }
        
        // Set IOTA clients if available in req.app
        if (req.app.iotaClient) {
            riskService.setIotaClient(req.app.iotaClient);
        }
        
        if (req.app.iotaAccount) {
            riskService.setIotaAccount(req.app.iotaAccount);
        }
        
        // Get recommendations
        const recommendations = await riskService.getRecommendations(address);
        
        res.json(recommendations);
    } catch (error) {
        logger.error(`Error getting recommendations for ${req.params.address}:`, error);
        res.status(500).json({ error: 'Error fetching recommendations', message: error.message });
    }
};

/**
 * Get model performance metrics
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getModelPerformanceMetrics = async (req, res) => {
    try {
        // Get time range from query param if available
        let timeRange = null;
        if (req.params.period) {
            const period = req.params.period;
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
        }
        
        // Get model performance metrics
        const metrics = await riskService.getModelPerformanceMetrics(timeRange);
        
        res.json(metrics);
    } catch (error) {
        logger.error(`Error getting model performance metrics:`, error);
        res.status(500).json({ error: 'Error fetching model performance metrics', message: error.message });
    }
};

/**
 * Get feature importance
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getFeatureImportance = async (req, res) => {
    try {
        // Get feature importance
        const featureImportance = await riskService.getFeatureImportance();
        
        // Sort features by importance
        const sortedFeatures = featureImportance.sort((a, b) => b.importance - a.importance);
        
        res.json({
            features: sortedFeatures,
            lastUpdate: new Date().toISOString()
        });
    } catch (error) {
        logger.error(`Error getting feature importance:`, error);
        res.status(500).json({ error: 'Error fetching feature importance', message: error.message });
    }
};

/**
 * Get validation metrics for a specific address
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const validateAddressPredictions = async (req, res) => {
    try {
        const { address } = req.params;
        
        // Validate Ethereum address
        if (!ethers.utils.isAddress(address)) {
            return res.status(400).json({ error: 'Invalid Ethereum address' });
        }
        
        // For now, return simulated validation data
        // In a real implementation, this would be calculated from a database of predictions and outcomes
        const validationData = {
            address,
            predictions: [
                { timestamp: Date.now() - 30 * 86400 * 1000, score: 45 },
                { timestamp: Date.now() - 20 * 86400 * 1000, score: 48 },
                { timestamp: Date.now() - 10 * 86400 * 1000, score: 52 },
                { timestamp: Date.now(), score: 50 }
            ],
            actuals: [
                { timestamp: Date.now() - 30 * 86400 * 1000, score: 47 },
                { timestamp: Date.now() - 20 * 86400 * 1000, score: 49 },
                { timestamp: Date.now() - 10 * 86400 * 1000, score: 50 },
                { timestamp: Date.now(), score: 51 }
            ],
            accuracy: 0.92,
            discrepancy: 2.1,
            lastUpdate: new Date().toISOString()
        };
        
        res.json(validationData);
    } catch (error) {
        logger.error(`Error validating predictions for ${req.params.address}:`, error);
        res.status(500).json({ error: 'Error validating predictions', message: error.message });
    }
};

/**
 * Update risk score on-chain
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const updateRiskScore = async (req, res) => {
    try {
        const { address, score } = req.body;
        
        // Validate Ethereum address
        if (!ethers.utils.isAddress(address)) {
            return res.status(400).json({ error: 'Invalid Ethereum address' });
        }
        
        // Validate score
        if (isNaN(score) || score < 0 || score > 100) {
            return res.status(400).json({ error: 'Score must be between 0 and 100' });
        }
        
        // Update risk score on-chain (would be implemented in a real system)
        // This would call the contract method to update the risk score
        
        // For now, simulate a success response
        const txHash = `0x${Math.random().toString(16).substring(2)}`;
        
        // Also submit this data to IOTA Tangle if client is available
        if (req.app.iotaClient) {
            try {
                const { submitBlock } = require('../../../iota-sdk/client');
                
                // Create block with data payload
                const blockData = {
                    payload: {
                        type: 1, // Tagged data
                        tag: Buffer.from('RISK_SCORE_UPDATE').toString('hex'),
                        data: Buffer.from(JSON.stringify({
                            address,
                            score,
                            timestamp: Date.now(),
                            txHash
                        })).toString('hex')
                    }
                };
                
                // Submit block
                const result = await submitBlock(req.app.iotaClient, blockData);
                logger.info(`Risk score update recorded on IOTA Tangle: ${result.blockId}`);
            } catch (tanglerError) {
                logger.warn('Error submitting risk score to Tangle:', tanglerError);
            }
        }
        
        res.json({
            success: true,
            address,
            newScore: score,
            transactionHash: txHash
        });
    } catch (error) {
        logger.error(`Error updating risk score for ${req.body.address}:`, error);
        res.status(500).json({ error: 'Error updating risk score', message: error.message });
    }
};

module.exports = {
    assessRisk,
    getRecommendations,
    getModelPerformanceMetrics,
    getFeatureImportance,
    validateAddressPredictions,
    updateRiskScore
};
