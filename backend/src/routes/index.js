/**
 * API Routes Index
 * Combines all route modules into a single router
 */

const express = require('express');
const router = express.Router();

// Import route modules
const lendingRoutes = require('./lendingRoutes');
const riskRoutes = require('./riskRoutes');
const crossChainRoutes = require('./crossChainRoutes');
const identityRoutes = require('./identityRoutes');

// Mount routes
router.use('/lending', lendingRoutes);
router.use('/risk', riskRoutes);
router.use('/cross-chain', crossChainRoutes);
router.use('/identity', identityRoutes);

// API root
router.get('/', (req, res) => {
  res.json({
    message: 'Welcome to IntelliLend API',
    version: '1.0.0',
    endpoints: {
      lending: '/api/lending',
      risk: '/api/risk',
      crossChain: '/api/cross-chain',
      identity: '/api/identity'
    }
  });
});

module.exports = router;
