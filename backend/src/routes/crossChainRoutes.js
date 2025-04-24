/**
 * Cross-Chain Liquidity API Routes
 */

const express = require('express');
const crossChainController = require('../controllers/crossChainController');
const router = express.Router();

// Cross-chain liquidity routes
router.get('/chains', crossChainController.getSupportedChains);
router.get('/sources/:chainId', crossChainController.getLiquiditySources);
router.get('/distribution/:address', crossChainController.getUserLiquidityDistribution);
router.get('/optimize/:address', crossChainController.calculateOptimalDistribution);
router.post('/transfer/:address', crossChainController.transferLiquidity);
router.get('/strategies', crossChainController.getYieldStrategies);
router.post('/execute-strategy/:address', crossChainController.executeStrategy);

module.exports = router;
