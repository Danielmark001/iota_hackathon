/**
 * Simplified IOTA Cross-Layer Aggregator
 * 
 * This file provides a simplified implementation of the IOTA Cross-Layer Aggregator
 * to be used when the full implementation is unavailable.
 */

const logger = require('./utils/logger');

/**
 * Simplified Cross-Layer Aggregator for IOTA
 */
class SimplifiedCrossLayerAggregator {
  constructor() {
    logger.info('Using simplified Cross-Layer Aggregator');
    this.messages = [];
  }
  
  /**
   * Send a message from L2 to L1
   * @param {Object} options - Message options
   * @returns {Promise<Object>} Message submission result
   */
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
  
  /**
   * Get message status
   * @param {string} messageId - Message ID
   * @returns {Promise<Object>} Message status
   */
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
  
  /**
   * Get messages for a user
   * @param {string} address - User address
   * @returns {Promise<Array>} Array of messages
   */
  async getUserMessages(address) {
    return this.messages.filter(m => m.sender === address || m.targetAddress === address);
  }
}

/**
 * Create a Cross-Layer Aggregator
 * @param {Object} client - IOTA client instance
 * @param {Object} options - Options for the cross-layer service
 * @returns {Promise<SimplifiedCrossLayerAggregator>} The Cross-Layer Aggregator instance
 */
async function createCrossLayerAggregator(client, options = {}) {
  if (!client) {
    throw new Error("IOTA client is required for Cross-Layer Aggregator");
  }
  
  logger.info('Creating simplified Cross-Layer Aggregator');
  
  // Create a new SimplifiedCrossLayerAggregator instance
  const aggregator = new SimplifiedCrossLayerAggregator();
  
  logger.info('Simplified Cross-Layer Aggregator created successfully');
  
  return aggregator;
}

module.exports = {
  SimplifiedCrossLayerAggregator,
  createCrossLayerAggregator
};