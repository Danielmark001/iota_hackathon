/**
 * Risk Assessment Routes
 * 
 * This module defines the routes for risk assessment functionality,
 * including risk scoring, recommendations, and model performance metrics.
 */

const express = require('express');
const { authenticate } = require('../../middleware/auth');
const { validateRequest } = require('../../middleware/validation');
const { cacheMiddleware } = require('../../middleware/cache');
const riskController = require('../controllers/riskAssessmentController');

const router = express.Router();

/**
 * @route POST /api/risk-assessment
 * @desc Assess risk for a user
 * @access Public
 */
router.post(
    '/',
    validateRequest(['address']),
    riskController.assessRisk
);

/**
 * @route GET /api/risk-assessment/recommendations/:address
 * @desc Get recommendations for a user
 * @access Public
 */
router.get(
    '/recommendations/:address',
    cacheMiddleware(1800), // Cache for 30 minutes
    riskController.getRecommendations
);

/**
 * @route GET /api/risk-assessment/model/performance
 * @desc Get model performance metrics
 * @access Public
 */
router.get(
    '/model/performance',
    authenticate, // Require authentication
    cacheMiddleware(3600), // Cache for 1 hour
    riskController.getModelPerformanceMetrics
);

/**
 * @route GET /api/risk-assessment/model/performance/:period
 * @desc Get model performance metrics for a specific time period
 * @access Public
 */
router.get(
    '/model/performance/:period',
    authenticate, // Require authentication
    cacheMiddleware(3600), // Cache for 1 hour
    riskController.getModelPerformanceMetrics
);

/**
 * @route GET /api/risk-assessment/model/feature-importance
 * @desc Get feature importance for the risk model
 * @access Public
 */
router.get(
    '/model/feature-importance',
    authenticate, // Require authentication
    cacheMiddleware(3600), // Cache for 1 hour
    riskController.getFeatureImportance
);

/**
 * @route GET /api/risk-assessment/model/validation/:address
 * @desc Get validation metrics for a specific address
 * @access Public
 */
router.get(
    '/model/validation/:address',
    authenticate, // Require authentication
    riskController.validateAddressPredictions
);

/**
 * @route POST /api/risk-assessment/update
 * @desc Update risk score on-chain
 * @access Admin
 */
router.post(
    '/update',
    authenticate, // Require authentication
    validateRequest(['address', 'score']), // Validate request body
    riskController.updateRiskScore
);

module.exports = router;
