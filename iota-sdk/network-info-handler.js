/**
 * Enhanced Network Information Handler for IOTA
 * 
 * This file provides a more robust implementation for retrieving network information
 * with better error handling and fallbacks.
 */

const logger = require('./utils/logger');

/**
 * Get network information with enhanced resilience and error handling
 * @param {Client} client - The IOTA client instance
 * @param {NodeManager} nodeManager - Optional node manager for failover
 * @returns {Promise<object>} Network information
 */
async function getEnhancedNetworkInfo(client, nodeManager = null) {
  return new Promise(async (resolve) => {
    try {
      // Get basic info with error handling
      let info;
      try {
        info = await client.getInfo();
      } catch (infoError) {
        logger.warn(`Error getting node info: ${infoError.message}`);
        info = { 
          nodeInfo: { 
            status: { isHealthy: false }, 
            name: 'Unknown', 
            version: 'Unknown',
            protocol: { networkName: process.env.IOTA_NETWORK || 'unknown' }
          }
        };
      }
      
      // Get protocol parameters with error handling
      let protocol;
      try {
        protocol = await client.getProtocolParameters();
      } catch (protocolError) {
        logger.warn(`Error getting protocol parameters: ${protocolError.message}`);
        protocol = { 
          networkName: info.nodeInfo?.protocol?.networkName || process.env.IOTA_NETWORK || 'unknown',
          bech32Hrp: process.env.IOTA_NETWORK === 'shimmer-testnet' ? 'smr' : 'iota',
          baseToken: { name: 'Shimmer', ticker: 'SMR', decimals: 6 }
        };
      }
      
      // Combine relevant information with fallbacks for missing fields
      resolve({
        nodeInfo: info.nodeInfo || { status: { isHealthy: false } },
        protocol: protocol || {},
        baseToken: protocol?.baseToken || { name: 'Shimmer', ticker: 'SMR', decimals: 6 },
        networkName: protocol?.networkName || info.nodeInfo?.protocol?.networkName || process.env.IOTA_NETWORK || 'unknown',
        bech32Hrp: protocol?.bech32Hrp || (process.env.IOTA_NETWORK === 'shimmer-testnet' ? 'smr' : 'iota'),
        networkId: protocol?.networkId || '0',
        // Add additional useful information
        isHealthy: info.nodeInfo?.status?.isHealthy || false,
        currentNode: client.getSettings?.()?.nodes?.[0] || 'unknown',
        currentTime: new Date().toISOString()
      });
    } catch (error) {
      logger.error(`Error getting network information: ${error.message}`);
      
      // Return a fallback network info object instead of throwing
      resolve({
        nodeInfo: { 
          status: { isHealthy: false }, 
          name: 'Offline', 
          version: 'Unknown',
          protocol: { networkName: process.env.IOTA_NETWORK || 'unknown' }
        },
        protocol: { 
          networkName: process.env.IOTA_NETWORK || 'unknown',
          bech32Hrp: process.env.IOTA_NETWORK === 'shimmer-testnet' ? 'smr' : 'iota',
          baseToken: { name: 'Shimmer', ticker: 'SMR', decimals: 6 }
        },
        baseToken: { name: 'Shimmer', ticker: 'SMR', decimals: 6 },
        networkName: process.env.IOTA_NETWORK || 'unknown',
        bech32Hrp: process.env.IOTA_NETWORK === 'shimmer-testnet' ? 'smr' : 'iota',
        networkId: '0',
        isHealthy: false,
        currentNode: 'offline',
        currentTime: new Date().toISOString(),
        error: error.message
      });
    }
  });
}

module.exports = getEnhancedNetworkInfo;