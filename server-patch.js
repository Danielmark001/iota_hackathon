/**
 * Server Patch for IOTA Integration
 * 
 * This file provides fixes and enhancements for the IOTA integration in the server.
 * It should be required at the beginning of server.js.
 */

const path = require('path');
const logger = require('./iota-sdk/utils/logger');

// Import enhanced network info handler
const getEnhancedNetworkInfo = require('./iota-sdk/network-info-handler');

// Import streams module with createStreamsService
const streams = require('./iota-sdk/streams');

// Import simplified identity service
const identityModule = require('./iota-sdk/identity-simplified');

// Import simplified cross-layer aggregator
const crossLayerModule = require('./iota-sdk/cross-layer-simplified');

// Apply monkey patches
const originalGetNetworkInfo = require('./iota-sdk/client').getNetworkInfo;

// Override getNetworkInfo with enhanced version
require('./iota-sdk/client').getNetworkInfo = async function(client, nodeManager, options) {
  try {
    // Try original first
    return await originalGetNetworkInfo(client, nodeManager, options);
  } catch (error) {
    logger.warn(`Original getNetworkInfo failed: ${error.message}. Using enhanced version.`);
    return await getEnhancedNetworkInfo(client, nodeManager);
  }
};

logger.info('IOTA integration patches applied successfully');

module.exports = {
  streams,
  identityModule,
  crossLayerModule,
  getEnhancedNetworkInfo
};