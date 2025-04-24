/**
 * Lending Routes
 * 
 * Defines all routes related to lending operations for the IntelliLend platform
 */

const express = require('express');
const router = express.Router();
const lendingController = require('../controllers/lendingController');
const riskController = require('../controllers/riskController');
const { authenticate } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validation');
const { depositSchema, borrowSchema, repaySchema, withdrawSchema } = require('../utils/validationSchemas');

// Public routes (no authentication required)
router.get('/markets', lendingController.getMarkets.bind(lendingController));
router.get('/account/:address', lendingController.getUserAccount.bind(lendingController));
router.get('/risk/:address', riskController.getRiskAssessment.bind(riskController));
router.get('/transactions/:address', lendingController.getTransactionHistory.bind(lendingController));

// Authentication required for transaction operations
router.post('/deposit', authenticate, validateRequest(depositSchema), lendingController.deposit.bind(lendingController));
router.post('/borrow', authenticate, validateRequest(borrowSchema), lendingController.borrow.bind(lendingController));
router.post('/repay', authenticate, validateRequest(repaySchema), lendingController.repay.bind(lendingController));
router.post('/withdraw', authenticate, validateRequest(withdrawSchema), lendingController.withdraw.bind(lendingController));

// Risk assessment routes
router.get('/risk/:address/detailed', riskController.getDetailedRiskAnalysis.bind(riskController));
router.post('/risk/batch', riskController.batchAssessRisk.bind(riskController));
router.get('/risk/:address/recommendations', riskController.getRiskRecommendations.bind(riskController));
router.get('/risk/:address/history', riskController.getRiskHistory.bind(riskController));

module.exports = router;
