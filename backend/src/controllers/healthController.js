/**
 * Health Controller
 * 
 * Handles API health check requests.
 */

const logger = require('../utils/logger');
const iotaBlockchainService = require('../services/iotaBlockchainService');

/**
 * Get API health status
 * @param {Object} req - Request object
 * @param {Object} res - Response object 
 */
exports.getHealth = async (req, res) => {
  try {
    // Get IOTA network information
    const network = process.env.IOTA_NETWORK || 'testnet';
    let iotaStatus = 'unknown';
    let iotaMessage = 'IOTA status unknown';
    let iotaDetails = null;
    
    try {
      const iotaInfo = await iotaBlockchainService.getNetworkInfo(network);
      iotaStatus = iotaInfo.isHealthy ? 'healthy' : 'unhealthy';
      iotaMessage = iotaInfo.isHealthy 
        ? `Connected to ${iotaInfo.networkName || network}` 
        : `Connected to ${iotaInfo.networkName || network} but node is unhealthy`;
      
      iotaDetails = {
        network: iotaInfo.networkName || network,
        node: iotaInfo.nodeUrl,
        isHealthy: iotaInfo.isHealthy,
        lastChecked: iotaInfo.lastChecked,
        healthyNodes: iotaInfo.connectionStatus?.healthyNodeCount || 0,
        totalNodes: iotaInfo.connectionStatus?.totalNodeCount || 0
      };
    } catch (error) {
      logger.error(`Error getting IOTA health: ${error.message}`);
      iotaStatus = 'error';
      iotaMessage = `Failed to connect to IOTA: ${error.message}`;
    }
    
    // Check if any mocks are being used
    const useMocks = process.env.USE_MOCKS === 'true';
    
    // Build health response
    const health = {
      status: iotaStatus === 'healthy' ? 'healthy' : 'degraded',
      version: process.env.npm_package_version || '1.0.0',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      iota: {
        status: iotaStatus,
        message: iotaMessage,
        network,
        details: iotaDetails,
        usingRealNetwork: !useMocks
      },
      services: {
        database: 'healthy', // Placeholder for database health
        web3: 'healthy'      // Placeholder for web3 health
      }
    };
    
    // Set status code based on health
    const statusCode = health.status === 'healthy' ? 200 : health.status === 'degraded' ? 200 : 500;
    
    res.status(statusCode).json(health);
  } catch (error) {
    logger.error(`Health check error: ${error.message}`, { stack: error.stack });
    res.status(500).json({ 
      status: 'error',
      message: 'Health check failed',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
};
