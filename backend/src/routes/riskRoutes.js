/**
 * Risk API Routes
 */

const express = require('express');
const riskController = require('../controllers/riskController');
const router = express.Router();

// Risk assessment routes
router.get('/predict/:address', riskController.predictRiskScore);
router.post('/update/:address', riskController.updateRiskScore);
router.get('/metrics/:address', riskController.getCurrentRiskMetrics);
router.get('/analyze/:address', riskController.analyzeUserActivity);
router.get('/recommendations/:address', riskController.getRecommendations);
router.get('/history/:address', riskController.getRiskHistory);
router.post('/batch-predict', riskController.batchPredictRiskScores);

module.exports = router;
