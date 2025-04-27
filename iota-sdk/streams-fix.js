/**
 * Fixed IOTA Streams implementation
 * 
 * This file provides a proper streams implementation with the createStreamsService function
 * to fix the "client is not defined" error.
 */

const { randomBytes, createCipheriv, createDecipheriv, createHash } = require('crypto');
const { submitBlock, getAddressTransactions } = require('./client');
const logger = require('./utils/logger');
const config = require('./config');

class IOTAStreams {
  /**
   * Initialize the IOTA Streams module
   * @param {Object} client - IOTA client instance
   * @param {Object} account - IOTA account for wallet operations (optional)
   */
  constructor(client, account = null) {
    this.client = client;
    this.account = account;
    this.channels = new Map();
    this.subscriptions = new Map();
    this.keys = new Map();
    
    // The network we're connecting to (from config)
    const network = process.env.IOTA_NETWORK || config.DEFAULT_NETWORK;
    this.network = network;
    
    logger.info('IOTA Streams module initialized');
  }
  
  /**
   * Create a new secure channel
   * @param {string} channelId - Unique identifier for the channel
   * @param {string} author - Channel author/owner
   * @param {Array} participants - Array of participant identifiers
   * @returns {Promise<Object>} Created channel information
   */
  async createChannel(channelId, author, participants = []) {
    try {
      logger.info(`Creating new channel: ${channelId} by ${author}`);
      
      // Generate a symmetric key for this channel
      const encryptionKey = randomBytes(32).toString('hex');
      
      // Create a channel object
      const channel = {
        id: channelId,
        author,
        participants: [author, ...participants],
        created: new Date().toISOString(),
        encryptionKey,
        messages: []
      };
      
      // Store channel in memory
      this.channels.set(channelId, channel);
      
      // Store encryption key in memory
      this.keys.set(channelId, encryptionKey);
      
      // Publish channel announcement to the Tangle (without the encryption key)
      const publicChannel = {
        id: channelId,
        author,
        participants: [author, ...participants],
        created: new Date().toISOString()
      };
      
      // Encrypt participant list for each participant
      const encryptedParticipants = {};
      for (const participant of [author, ...participants]) {
        // In a real implementation, we would use the participant's public key
        // For simplicity, we'll use a derived key from the participant's ID
        const participantKey = this.deriveKeyFromId(participant);
        encryptedParticipants[participant] = this.encryptData(
          JSON.stringify(channel.participants),
          participantKey
        );
      }
      
      // Create announcement message
      const announcement = {
        type: 'channel_announcement',
        channel: publicChannel,
        encryptedParticipants,
        announcedBy: author,
        timestamp: new Date().toISOString()
      };
      
      // Submit announcement to Tangle
      const result = await this.publishToTangle('STREAMS_ANNOUNCEMENT', announcement);
      
      logger.info(`Channel created: ${channelId}, announced on Tangle: ${result.blockId}`);
      
      return {
        channel: publicChannel,
        blockId: result.blockId,
        tangleExplorerUrl: `${config.getExplorerAddressUrl(result.blockId, this.network)}`
      };
    }
    catch (error) {
      logger.error(`Error creating channel: ${error.message}`);
      throw new Error(`Failed to create channel: ${error.message}`);
    }
  }
  
  /**
   * Join an existing channel
   * @param {string} channelId - Channel identifier
   * @param {string} participant - Participant identifier
   * @param {string} joinKey - Key to join the channel (typically shared off-band)
   * @returns {Promise<boolean>} Success status
   */
  async joinChannel(channelId, participant, joinKey) {
    try {
      logger.info(`Joining channel: ${channelId} as ${participant}`);
      
      // Try to find the channel announcement on the Tangle
      const announcements = await this.findChannelAnnouncements(channelId);
      
      if (announcements.length === 0) {
        throw new Error(`Channel not found: ${channelId}`);
      }
      
      // Get the latest announcement
      const announcement = announcements[0];
      
      // Check if participant is in the participants list
      if (!announcement.channel.participants.includes(participant)) {
        throw new Error(`Participant ${participant} is not authorized to join this channel`);
      }
      
      // In a real implementation, we would decrypt the encryption key using the participant's private key
      // For simplicity, we'll use the joinKey directly as the encryption key
      this.keys.set(channelId, joinKey);
      
      // Store channel in memory
      this.channels.set(channelId, {
        id: channelId,
        author: announcement.channel.author,
        participants: announcement.channel.participants,
        created: announcement.channel.created,
        encryptionKey: joinKey,
        messages: []
      });
      
      // Publish join confirmation to the Tangle
      const joinConfirmation = {
        type: 'channel_join',
        channelId,
        participant,
        timestamp: new Date().toISOString()
      };
      
      // Submit join confirmation to Tangle
      const result = await this.publishToTangle('STREAMS_JOIN', joinConfirmation);
      
      logger.info(`Joined channel: ${channelId}, confirmed on Tangle: ${result.blockId}`);
      
      return true;
    }
    catch (error) {
      logger.error(`Error joining channel: ${error.message}`);
      throw new Error(`Failed to join channel: ${error.message}`);
    }
  }
  
  /**
   * Send a message on a channel
   * @param {string} channelId - Channel identifier
   * @param {string} sender - Sender identifier
   * @param {Object} message - Message content
   * @param {string} messageType - Type of message
   * @returns {Promise<Object>} Message submission result
   */
  async sendMessage(channelId, sender, message, messageType = 'text') {
    try {
      logger.info(`Sending ${messageType} message on channel ${channelId} by ${sender}`);
      
      // Get channel and encryption key
      const channel = this.channels.get(channelId);
      const encryptionKey = this.keys.get(channelId);
      
      if (!channel) {
        throw new Error(`Channel not found: ${channelId}`);
      }
      
      if (!channel.participants.includes(sender)) {
        throw new Error(`Sender ${sender} is not a participant in this channel`);
      }
      
      // Create message object
      const messageObj = {
        id: `${channelId}-msg-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`,
        channelId,
        sender,
        type: messageType,
        content: message,
        timestamp: new Date().toISOString()
      };
      
      // Encrypt the message
      const encryptedMessage = this.encryptData(JSON.stringify(messageObj), encryptionKey);
      
      // Create message payload
      const messagePayload = {
        type: 'encrypted_message',
        channelId,
        sender,
        messageType,
        encryptedContent: encryptedMessage,
        messageId: messageObj.id,
        timestamp: new Date().toISOString()
      };
      
      // Submit message to Tangle
      const result = await this.publishToTangle('STREAMS_MESSAGE', messagePayload);
      
      logger.info(`Message sent on channel ${channelId}: ${messageObj.id}, published on Tangle: ${result.blockId}`);
      
      // Store message in memory
      channel.messages.push({
        ...messageObj,
        blockId: result.blockId
      });
      
      return {
        messageId: messageObj.id,
        channelId,
        sender,
        type: messageType,
        timestamp: messageObj.timestamp,
        blockId: result.blockId,
        tangleExplorerUrl: `${config.getExplorerAddressUrl(result.blockId, this.network)}`
      };
    }
    catch (error) {
      logger.error(`Error sending message: ${error.message}`);
      throw new Error(`Failed to send message: ${error.message}`);
    }
  }
  
  /**
   * Share a document on a channel
   * @param {string} channelId - Channel identifier
   * @param {string} sender - Sender identifier
   * @param {Object} document - Document content
   * @param {string} documentType - Type of document
   * @returns {Promise<Object>} Document sharing result
   */
  async shareDocument(channelId, sender, document, documentType) {
    try {
      logger.info(`Sharing ${documentType} document on channel ${channelId} by ${sender}`);
      
      // For documents, we'll use the same message sending mechanism
      // but with a different message type
      return await this.sendMessage(channelId, sender, document, `document:${documentType}`);
    }
    catch (error) {
      logger.error(`Error sharing document: ${error.message}`);
      throw new Error(`Failed to share document: ${error.message}`);
    }
  }
  
  /**
   * Fetch messages from a channel
   * @param {string} channelId - Channel identifier
   * @param {string} recipient - Recipient identifier
   * @param {number} limit - Maximum number of messages to fetch
   * @returns {Promise<Array>} Array of messages
   */
  async fetchMessages(channelId, recipient, limit = 20) {
    try {
      logger.info(`Fetching messages for channel ${channelId} as ${recipient}`);
      
      // Get channel and encryption key
      const channel = this.channels.get(channelId);
      const encryptionKey = this.keys.get(channelId);
      
      if (!channel) {
        throw new Error(`Channel not found: ${channelId}`);
      }
      
      if (!channel.participants.includes(recipient)) {
        throw new Error(`Recipient ${recipient} is not a participant in this channel`);
      }
      
      // Search for messages on the Tangle
      const tangleMessages = await this.findChannelMessages(channelId);
      
      // Decrypt and parse messages
      const decryptedMessages = [];
      
      for (const message of tangleMessages) {
        try {
          // Only process encrypted messages
          if (message.type !== 'encrypted_message') {
            continue;
          }
          
          // Try to decrypt the message
          const decryptedContent = this.decryptData(message.encryptedContent, encryptionKey);
          const parsedMessage = JSON.parse(decryptedContent);
          
          // Add to results
          decryptedMessages.push({
            ...parsedMessage,
            blockId: message.blockId,
            tangleExplorerUrl: `${config.getExplorerAddressUrl(message.blockId, this.network)}`
          });
        } catch (error) {
          logger.warn(`Error decrypting message: ${error.message}`);
          // Skip this message
          continue;
        }
      }
      
      // Sort by timestamp and limit results
      decryptedMessages.sort((a, b) => {
        return new Date(b.timestamp) - new Date(a.timestamp);
      });
      
      const limitedMessages = decryptedMessages.slice(0, limit);
      
      logger.info(`Fetched ${limitedMessages.length} messages from channel ${channelId}`);
      
      return limitedMessages;
    }
    catch (error) {
      logger.error(`Error fetching messages: ${error.message}`);
      throw new Error(`Failed to fetch messages: ${error.message}`);
    }
  }
  
  /**
   * Subscribe to channel updates
   * @param {string} channelId - Channel identifier
   * @param {string} participant - Participant identifier
   * @param {Function} callback - Callback function for new messages
   * @returns {Promise<Object>} Subscription handle
   */
  async subscribeToChannel(channelId, participant, callback) {
    try {
      logger.info(`Setting up subscription for channel ${channelId} by ${participant}`);
      
      // Get channel
      const channel = this.channels.get(channelId);
      
      if (!channel) {
        throw new Error(`Channel not found: ${channelId}`);
      }
      
      if (!channel.participants.includes(participant)) {
        throw new Error(`Participant ${participant} is not a participant in this channel`);
      }
      
      // Create subscription object
      const subscriptionId = `sub-${channelId}-${participant}-${Date.now()}`;
      
      const subscription = {
        id: subscriptionId,
        channelId,
        participant,
        lastChecked: new Date(),
        callback,
        active: true
      };
      
      // Store subscription
      this.subscriptions.set(subscriptionId, subscription);
      
      // Start polling for new messages
      this.startSubscriptionPolling(subscriptionId);
      
      logger.info(`Subscription created: ${subscriptionId}`);
      
      return {
        subscriptionId,
        channelId,
        participant,
        created: new Date().toISOString(),
        // Method to cancel the subscription
        cancel: () => this.cancelSubscription(subscriptionId)
      };
    }
    catch (error) {
      logger.error(`Error subscribing to channel: ${error.message}`);
      throw new Error(`Failed to subscribe to channel: ${error.message}`);
    }
  }
  
  /**
   * Start polling for new messages for a subscription
   * @param {string} subscriptionId - Subscription identifier
   */
  startSubscriptionPolling(subscriptionId) {
    // Set up polling interval
    const pollingInterval = setInterval(async () => {
      try {
        const subscription = this.subscriptions.get(subscriptionId);
        
        if (!subscription || !subscription.active) {
          clearInterval(pollingInterval);
          return;
        }
        
        // Get channel and encryption key
        const channel = this.channels.get(subscription.channelId);
        const encryptionKey = this.keys.get(subscription.channelId);
        
        if (!channel || !encryptionKey) {
          clearInterval(pollingInterval);
          return;
        }
        
        // Search for messages on the Tangle since last check
        const tangleMessages = await this.findChannelMessages(
          subscription.channelId,
          subscription.lastChecked
        );
        
        // Update last checked time
        subscription.lastChecked = new Date();
        
        // Decrypt and parse new messages
        const newMessages = [];
        
        for (const message of tangleMessages) {
          try {
            // Only process encrypted messages
            if (message.type !== 'encrypted_message') {
              continue;
            }
            
            // Try to decrypt the message
            const decryptedContent = this.decryptData(message.encryptedContent, encryptionKey);
            const parsedMessage = JSON.parse(decryptedContent);
            
            // Add to results
            newMessages.push({
              ...parsedMessage,
              blockId: message.blockId,
              tangleExplorerUrl: `${config.getExplorerAddressUrl(message.blockId, this.network)}`
            });
          } catch (error) {
            logger.warn(`Error decrypting message: ${error.message}`);
            // Skip this message
            continue;
          }
        }
        
        // Call callback with new messages if any
        if (newMessages.length > 0) {
          logger.info(`Found ${newMessages.length} new messages for subscription ${subscriptionId}`);
          subscription.callback(newMessages);
        }
      } catch (error) {
        logger.error(`Error polling for subscription ${subscriptionId}: ${error.message}`);
      }
    }, 10000); // Poll every 10 seconds
    
    // Store polling interval for cleanup
    const subscription = this.subscriptions.get(subscriptionId);
    subscription.pollingInterval = pollingInterval;
  }
  
  /**
   * Cancel a channel subscription
   * @param {string} subscriptionId - Subscription identifier
   * @returns {boolean} Success status
   */
  cancelSubscription(subscriptionId) {
    try {
      logger.info(`Cancelling subscription: ${subscriptionId}`);
      
      const subscription = this.subscriptions.get(subscriptionId);
      
      if (!subscription) {
        throw new Error(`Subscription not found: ${subscriptionId}`);
      }
      
      // Clear polling interval
      if (subscription.pollingInterval) {
        clearInterval(subscription.pollingInterval);
      }
      
      // Mark as inactive
      subscription.active = false;
      
      // Remove from subscriptions
      this.subscriptions.delete(subscriptionId);
      
      logger.info(`Subscription cancelled: ${subscriptionId}`);
      
      return true;
    }
    catch (error) {
      logger.error(`Error cancelling subscription: ${error.message}`);
      throw new Error(`Failed to cancel subscription: ${error.message}`);
    }
  }
  
  /**
   * Send a notification to channel participants
   * @param {string} channelId - Channel identifier
   * @param {string} sender - Sender identifier
   * @param {string} notificationType - Type of notification
   * @param {Object} data - Notification data
   * @returns {Promise<Object>} Notification result
   */
  async sendNotification(channelId, sender, notificationType, data) {
    try {
      logger.info(`Sending ${notificationType} notification on channel ${channelId} by ${sender}`);
      
      // Create notification object
      const notification = {
        type: notificationType,
        data,
        isNotification: true
      };
      
      // Use the standard message sending mechanism
      return await this.sendMessage(channelId, sender, notification, 'notification');
    }
    catch (error) {
      logger.error(`Error sending notification: ${error.message}`);
      throw new Error(`Failed to send notification: ${error.message}`);
    }
  }
  
  /**
   * Find channel announcements on the Tangle
   * @param {string} channelId - Channel identifier
   * @returns {Promise<Array>} Array of channel announcements
   */
  async findChannelAnnouncements(channelId) {
    try {
      // Get all transactions with the announcement tag
      const tag = Buffer.from('STREAMS_ANNOUNCEMENT').toString('hex');
      
      // Query for messages with this tag
      const messages = await getAddressTransactions(this.client, tag);
      
      // Filter and parse the messages
      const announcements = [];
      
      for (const message of messages) {
        try {
          const data = JSON.parse(Buffer.from(message.data, 'hex').toString());
          if (data.type === 'channel_announcement' && data.channel.id === channelId) {
            announcements.push({
              ...data,
              blockId: message.blockId
            });
          }
        } catch (error) {
          // Skip invalid messages
          continue;
        }
      }
      
      // Sort by timestamp, newest first
      announcements.sort((a, b) => {
        return new Date(b.timestamp) - new Date(a.timestamp);
      });
      
      return announcements;
    }
    catch (error) {
      logger.error(`Error finding channel announcements: ${error.message}`);
      throw new Error(`Failed to find channel announcements: ${error.message}`);
    }
  }
  
  /**
   * Find channel messages on the Tangle
   * @param {string} channelId - Channel identifier
   * @param {Date} since - Only messages since this date
   * @returns {Promise<Array>} Array of channel messages
   */
  async findChannelMessages(channelId, since = null) {
    try {
      // Get all transactions with the message tag
      const tag = Buffer.from('STREAMS_MESSAGE').toString('hex');
      
      // Query for messages with this tag
      const messages = await getAddressTransactions(this.client, tag);
      
      // Filter and parse the messages
      const channelMessages = [];
      
      for (const message of messages) {
        try {
          const data = JSON.parse(Buffer.from(message.data, 'hex').toString());
          if (data.type === 'encrypted_message' && data.channelId === channelId) {
            // Check timestamp if 'since' is provided
            if (since) {
              const messageDate = new Date(data.timestamp);
              if (messageDate <= since) {
                continue;
              }
            }
            
            channelMessages.push({
              ...data,
              blockId: message.blockId
            });
          }
        } catch (error) {
          // Skip invalid messages
          continue;
        }
      }
      
      // Sort by timestamp, newest first
      channelMessages.sort((a, b) => {
        return new Date(b.timestamp) - new Date(a.timestamp);
      });
      
      return channelMessages;
    }
    catch (error) {
      logger.error(`Error finding channel messages: ${error.message}`);
      throw new Error(`Failed to find channel messages: ${error.message}`);
    }
  }
  
  /**
   * Publish data to the Tangle
   * @param {string} tag - Message tag
   * @param {Object} data - Data to publish
   * @returns {Promise<Object>} Result of the publication
   */
  async publishToTangle(tag, data) {
    try {
      // Convert data to JSON
      const dataJSON = JSON.stringify(data);
      
      // Create block with data payload
      const blockData = {
        payload: {
          type: 1, // Tagged data
          tag: Buffer.from(tag).toString('hex'),
          data: Buffer.from(dataJSON).toString('hex')
        }
      };
      
      // Submit to IOTA Tangle
      const result = await submitBlock(this.client, blockData);
      logger.debug(`Data published to Tangle with tag ${tag}: ${result.blockId}`);
      
      return result;
    }
    catch (error) {
      logger.error(`Error publishing to Tangle: ${error.message}`);
      throw new Error(`Failed to publish to Tangle: ${error.message}`);
    }
  }
  
  /**
   * Encrypt data for secure sharing
   * @param {string} data - Data to encrypt
   * @param {string} key - Encryption key
   * @returns {string} Encrypted data
   */
  encryptData(data, key) {
    try {
      // Derive a key and IV from the provided key
      const derivedKey = createHash('sha256').update(key).digest();
      const iv = randomBytes(16);
      
      // Create cipher
      const cipher = createCipheriv('aes-256-cbc', derivedKey, iv);
      
      // Encrypt the data
      let encrypted = cipher.update(data, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      // Return the IV and encrypted data
      return `${iv.toString('hex')}:${encrypted}`;
    }
    catch (error) {
      logger.error(`Error encrypting data: ${error.message}`);
      throw new Error(`Failed to encrypt data: ${error.message}`);
    }
  }
  
  /**
   * Decrypt received data
   * @param {string} encryptedData - Encrypted data
   * @param {string} key - Decryption key
   * @returns {string} Decrypted data
   */
  decryptData(encryptedData, key) {
    try {
      // Split IV and encrypted data
      const [ivHex, encrypted] = encryptedData.split(':');
      
      // Derive key from the provided key
      const derivedKey = createHash('sha256').update(key).digest();
      const iv = Buffer.from(ivHex, 'hex');
      
      // Create decipher
      const decipher = createDecipheriv('aes-256-cbc', derivedKey, iv);
      
      // Decrypt the data
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    }
    catch (error) {
      logger.error(`Error decrypting data: ${error.message}`);
      throw new Error(`Failed to decrypt data: ${error.message}`);
    }
  }
  
  /**
   * Derive a key from an identifier (for simplified demo purposes)
   * @param {string} id - Identifier
   * @returns {string} Derived key
   */
  deriveKeyFromId(id) {
    // Note: In a real application, you would use a proper key derivation function
    // and possibly integrate with a key management system
    return createHash('sha256').update(`${id}-key-salt`).digest('hex');
  }
}

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
};