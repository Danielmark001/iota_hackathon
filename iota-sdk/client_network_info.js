/**
 * Enhanced getNetworkInfo function for IOTA client
 * 
 * This file provides a more robust implementation of the getNetworkInfo function
 * with better error handling and fallbacks for API inconsistencies.
 */

/**
 * Get network information with enhanced resilience and caching
 * @param {Client} client - The IOTA client instance
 * @param {NodeManager} nodeManager - Optional node manager for failover
 * @param {Object} options - Additional options (useCache, cacheTTL)
 * @returns {Promise<object>} Network information
 */
async function getNetworkInfo(client, nodeManager = null, options = {}) {
  // Import required modules
  const logger = require('./utils/logger');
  
  // Generate cache key
  const cacheKey = 'network-info';
  
  // Use withCache to handle caching logic
  return await withCache(cacheKey, async () => {
    return await withExponentialBackoff(async () => {
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
        return {
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
        };
      } catch (error) {
        logger.error(`Error getting network information: ${error.message}`);
        
        // Handle node errors with failover if node manager is provided
        if (nodeManager && error.message && (
          error.message.includes('connect') ||
          error.message.includes('timeout') ||
          error.message.includes('ECONNREFUSED') ||
          error.message.includes('503')
        )) {
          try {
            // Mark current node as unhealthy
            nodeManager.markCurrentNodeUnhealthy(error);
            
            // Update client nodes
            client.updateSetting('nodes', nodeManager.getHealthyNodes());
          } catch (nodeError) {
            logger.error(`Error updating nodes: ${nodeError.message}`);
          }
        }
        
        // Return a fallback network info object instead of throwing
        return {
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
        };
      }
    });
  }, options);
}

module.exports = getNetworkInfo;