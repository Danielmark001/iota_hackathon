/**
 * Cross-Chain Liquidity Controller
 * Handles API endpoints for cross-chain liquidity operations
 */

const crossChainService = require('../services/crossChainService');
const logger = require('../utils/logger');

/**
 * Get all supported chains and their information
 */
exports.getSupportedChains = async (req, res) => {
  try {
    const chains = await crossChainService.getSupportedChains();
    res.json(chains);
  } catch (error) {
    logger.error(`Error in getSupportedChains: ${error.message}`);
    res.status(500).json({ error: 'Failed to fetch supported chains', message: error.message });
  }
};

/**
 * Get liquidity sources for a specific chain
 */
exports.getLiquiditySources = async (req, res) => {
  try {
    const { chainId } = req.params;
    
    if (!chainId || isNaN(parseInt(chainId))) {
      return res.status(400).json({ error: 'Invalid chain ID' });
    }
    
    const sources = await crossChainService.getLiquiditySources(parseInt(chainId));
    res.json(sources);
  } catch (error) {
    logger.error(`Error in getLiquiditySources: ${error.message}`);
    res.status(500).json({ error: 'Failed to fetch liquidity sources', message: error.message });
  }
};

/**
 * Get a user's liquidity distribution across all chains
 */
exports.getUserLiquidityDistribution = async (req, res) => {
  try {
    const { address } = req.params;
    
    if (!address || !address.match(/^0x[a-fA-F0-9]{40}$/)) {
      return res.status(400).json({ error: 'Invalid address format' });
    }
    
    const distribution = await crossChainService.getUserLiquidityDistribution(address);
    res.json(distribution);
  } catch (error) {
    logger.error(`Error in getUserLiquidityDistribution: ${error.message}`);
    res.status(500).json({ error: 'Failed to fetch liquidity distribution', message: error.message });
  }
};

/**
 * Calculate the optimal liquidity distribution
 */
exports.calculateOptimalDistribution = async (req, res) => {
  try {
    const { address } = req.params;
    
    if (!address || !address.match(/^0x[a-fA-F0-9]{40}$/)) {
      return res.status(400).json({ error: 'Invalid address format' });
    }
    
    const optimalDistribution = await crossChainService.calculateOptimalDistribution(address);
    res.json(optimalDistribution);
  } catch (error) {
    logger.error(`Error in calculateOptimalDistribution: ${error.message}`);
    res.status(500).json({ error: 'Failed to calculate optimal distribution', message: error.message });
  }
};

/**
 * Transfer liquidity between chains
 */
exports.transferLiquidity = async (req, res) => {
  try {
    const { address } = req.params;
    const { sourceChainId, targetChainId, amount } = req.body;
    
    // Validate input
    if (!address || !address.match(/^0x[a-fA-F0-9]{40}$/)) {
      return res.status(400).json({ error: 'Invalid address format' });
    }
    
    if (!sourceChainId || isNaN(parseInt(sourceChainId))) {
      return res.status(400).json({ error: 'Invalid source chain ID' });
    }
    
    if (!targetChainId || isNaN(parseInt(targetChainId))) {
      return res.status(400).json({ error: 'Invalid target chain ID' });
    }
    
    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }
    
    const result = await crossChainService.transferLiquidityBetweenChains(
      address,
      parseInt(sourceChainId),
      parseInt(targetChainId),
      amount.toString()
    );
    
    res.json(result);
  } catch (error) {
    logger.error(`Error in transferLiquidity: ${error.message}`);
    res.status(500).json({ error: 'Failed to transfer liquidity', message: error.message });
  }
};

/**
 * Get all available yield strategies
 */
exports.getYieldStrategies = async (req, res) => {
  try {
    const strategies = await crossChainService.getYieldStrategies();
    res.json(strategies);
  } catch (error) {
    logger.error(`Error in getYieldStrategies: ${error.message}`);
    res.status(500).json({ error: 'Failed to fetch yield strategies', message: error.message });
  }
};

/**
 * Execute a yield optimization strategy
 */
exports.executeStrategy = async (req, res) => {
  try {
    const { address } = req.params;
    const { strategyId } = req.body;
    
    // Validate input
    if (!address || !address.match(/^0x[a-fA-F0-9]{40}$/)) {
      return res.status(400).json({ error: 'Invalid address format' });
    }
    
    if (strategyId === undefined || isNaN(parseInt(strategyId))) {
      return res.status(400).json({ error: 'Invalid strategy ID' });
    }
    
    const result = await crossChainService.executeYieldStrategy(
      address,
      parseInt(strategyId)
    );
    
    res.json(result);
  } catch (error) {
    logger.error(`Error in executeStrategy: ${error.message}`);
    res.status(500).json({ error: 'Failed to execute strategy', message: error.message });
  }
};
