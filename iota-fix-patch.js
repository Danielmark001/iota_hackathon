/**
 * IOTA Integration Fixes
 * 
 * This file contains patches for fixing issues with IOTA SDK integration:
 * 1. Fixes "client is not defined" error in Streams service
 * 2. Enhances network info retrieval with better error handling
 * 3. Provides fallbacks for missing dependencies
 *
 * Apply this patch by requiring it at the beginning of server.js
 */

const path = require('path');
const fs = require('fs');
const logger = require('./iota-sdk/utils/logger');

// Create directory for logs if it doesn't exist
if (!fs.existsSync('./logs')) {
  fs.mkdirSync('./logs');
}

// Configure logger
logger.configure({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  enableConsole: true,
  enableFile: true,
  logDir: 'logs',
  logFilename: 'iota-integration.log',
  format: 'text',
  colorize: true
});

// Patch Streams service
try {
  logger.info('Applying patch for IOTA Streams service...');
  const streamsPath = path.join(__dirname, 'iota-sdk', 'streams.js');
  
  // Read the streams.js file
  let streamsContent = fs.readFileSync(streamsPath, 'utf8');
  
  // Check if we need to apply the patch (only if it doesn't already have createStreamsService)
  if (!streamsContent.includes('createStreamsService')) {
    // Find the export line
    const exportLine = 'module.exports = IOTAStreams;';
    
    // Create the createStreamsService function
    const createStreamsServiceFn = `
/**
 * Create an IOTA Streams service
 * @param {Object} client - IOTA client instance
 * @param {Object} options - Options for the streams service
 * @returns {Promise<IOTAStreams>} The IOTA Streams service instance
 */
async function createStreamsService(client, options = {}) {
  if (!client) {
    throw new Error("IOTA client is required for Streams service");
  }
  
  const { seed, permanode, account } = options;
  
  // Create a new IOTAStreams instance
  const streamsService = new IOTAStreams(client, account);
  
  // If a seed is provided, use it for initialization
  if (seed) {
    streamsService.seedKey = seed;
    logger.info('Using provided seed for Streams service');
  }
  
  // If a permanode URL is provided, use it for fetching historical data
  if (permanode) {
    streamsService.permanodeUrl = permanode;
    logger.info('Using provided permanode for Streams service');
  }
  
  logger.info('IOTA Streams service created successfully');
  
  return streamsService;
}

module.exports = {
  IOTAStreams,
  createStreamsService
};`;
    
    // Replace the export line with our new export that includes createStreamsService
    streamsContent = streamsContent.replace(exportLine, createStreamsServiceFn);
    
    // Write the updated file
    fs.writeFileSync(streamsPath, streamsContent);
    logger.info('Successfully patched IOTA Streams service');
  } else {
    logger.info('IOTA Streams service already patched, skipping...');
  }
} catch (streamsError) {
  logger.error(`Error patching Streams service: ${streamsError.message}`);
}

// Enhance network info retrieval in server.js
const enhanceNetworkInfoRetrieval = () => {
  return (client, nodeManager) => {
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
  };
};

// Provide fallback implementations for missing dependencies
class SimplifiedIdentityService {
  constructor() {
    logger.info('Using simplified Identity service');
    this.identities = new Map();
    this.associations = new Map();
  }
  
  async createIdentity(options) {
    const { controller, metadata } = options;
    const did = `did:iota:${Buffer.from(Math.random().toString()).toString('hex').slice(0, 32)}`;
    
    this.identities.set(did, {
      controller,
      metadata,
      created: new Date().toISOString()
    });
    
    logger.info(`Created simplified DID: ${did}`);
    
    return {
      did,
      document: { id: did, controller },
      address: did,
      explorerUrl: 'https://explorer.iota.org/shimmer-testnet'
    };
  }
  
  async associateAddress(did, address) {
    this.associations.set(address, did);
    logger.info(`Associated DID ${did} with address ${address}`);
    return true;
  }
  
  async verifyCredential(did, credential) {
    // Simple placeholder verification (always succeeds)
    return {
      isValid: true
    };
  }
  
  async getCredentialDetails(credential) {
    return {
      expirationDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      trustLevel: 'verified'
    };
  }
}

class SimplifiedCrossLayerAggregator {
  constructor() {
    logger.info('Using simplified Cross-Layer Aggregator');
    this.messages = [];
  }
  
  async sendMessageToL1(options) {
    const { targetAddress, messageType, payload, sender, useBridge, useStreams } = options;
    
    const messageId = `msg-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
    
    this.messages.push({
      id: messageId,
      targetAddress,
      messageType,
      payload,
      sender,
      timestamp: Date.now(),
      status: 'pending'
    });
    
    logger.info(`Simplified cross-layer message sent: ${messageId}`);
    
    return {
      messageId,
      bridgeStatus: useBridge ? 'pending' : 'skipped',
      streamsStatus: useStreams ? 'pending' : 'skipped'
    };
  }
  
  async getMessageStatus(messageId) {
    const message = this.messages.find(m => m.id === messageId);
    
    if (!message) {
      return null;
    }
    
    return {
      status: message.status,
      bridgeStatus: 'pending',
      streamsStatus: 'pending',
      confirmations: 0,
      timestamp: message.timestamp
    };
  }
  
  async getUserMessages(address) {
    return this.messages.filter(m => m.sender === address || m.targetAddress === address);
  }
}

// Export patches and utilities
module.exports = {
  enhanceNetworkInfoRetrieval,
  SimplifiedIdentityService,
  SimplifiedCrossLayerAggregator
};