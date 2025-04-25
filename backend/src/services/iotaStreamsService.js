/**
 * IOTA Streams Service
 * 
 * Provides secure, encrypted communication channels between lenders and borrowers
 * using IOTA Streams for data exchange and document sharing.
 */

const { Client } = require('@iota/sdk');
const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');
const iotaBlockchainService = require('./iotaBlockchainService');

class IOTAStreamsService {
  constructor() {
    this.initialize();
    this.channelCache = new Map();
    this.documentsDirectory = process.env.STREAMS_DOCUMENTS_DIR || path.join(process.cwd(), 'streams-documents');
  }
  
  /**
   * Initialize IOTA Streams with the client
   */
  async initialize() {
    try {
      logger.info('Initializing IOTA Streams Service');
      
      // Get the IOTA client from the blockchain service
      this.client = await iotaBlockchainService.getClient();
      
      if (!this.client) {
        throw new Error('IOTA client not initialized in blockchain service');
      }
      
      // Create documents directory if it doesn't exist
      await fs.mkdir(this.documentsDirectory, { recursive: true });
      
      logger.info('IOTA Streams Service initialized successfully');
    } catch (error) {
      logger.error(`Error initializing IOTA Streams Service: ${error.message}`);
      logger.warn('Secure communication features will be limited or unavailable');
    }
  }
  
  /**
   * Create a new secure channel between a lender and borrower
   * 
   * @param {string} lenderAddress - Lender's blockchain address
   * @param {string} borrowerAddress - Borrower's blockchain address
   * @param {Object} options - Channel options
   * @returns {Promise<Object>} Channel information
   */
  async createChannel(lenderAddress, borrowerAddress, options = {}) {
    try {
      const {
        channelType = 'lending',
        metadata = {},
        encryptionType = 'symmetric'
      } = options;
      
      logger.info(`Creating secure channel between lender ${lenderAddress} and borrower ${borrowerAddress}`);
      
      // Generate a unique channel ID
      const channelId = crypto.randomBytes(16).toString('hex');
      
      // Generate encryption keys
      let encryptionKey, publicKeys;
      
      if (encryptionType === 'asymmetric') {
        // For asymmetric encryption, generate keypairs for both parties
        // In a real implementation, you would use their existing keypairs
        const lenderKeypair = crypto.generateKeyPairSync('rsa', {
          modulusLength: 2048,
          publicKeyEncoding: {
            type: 'spki',
            format: 'pem'
          },
          privateKeyEncoding: {
            type: 'pkcs8',
            format: 'pem'
          }
        });
        
        const borrowerKeypair = crypto.generateKeyPairSync('rsa', {
          modulusLength: 2048,
          publicKeyEncoding: {
            type: 'spki',
            format: 'pem'
          },
          privateKeyEncoding: {
            type: 'pkcs8',
            format: 'pem'
          }
        });
        
        publicKeys = {
          lender: lenderKeypair.publicKey,
          borrower: borrowerKeypair.publicKey
        };
      } else {
        // For symmetric encryption, generate a shared key
        encryptionKey = crypto.randomBytes(32).toString('hex');
      }
      
      // Create channel metadata for storage on the Tangle
      const channelMetadata = {
        channelId,
        type: channelType,
        created: Date.now(),
        participants: {
          lender: lenderAddress,
          borrower: borrowerAddress
        },
        encryptionType,
        metadata: {
          ...metadata,
          status: 'active'
        }
      };
      
      // Store channel announcement on the Tangle
      const announcementData = {
        type: 'channel_announcement',
        channelId,
        channelType,
        created: Date.now(),
        participants: {
          lender: lenderAddress,
          borrower: borrowerAddress
        }
      };
      
      // Send announcement message to IOTA Tangle
      await iotaBlockchainService.sendTangleMessage('streams', announcementData);
      
      // Cache channel information
      this.channelCache.set(channelId, {
        ...channelMetadata,
        messages: []
      });
      
      // Return channel information
      const channelInfo = {
        channelId,
        type: channelType,
        created: Date.now(),
        participants: {
          lender: lenderAddress,
          borrower: borrowerAddress
        },
        // Include keys in response but would normally distribute securely
        encryptionKey: encryptionType === 'symmetric' ? encryptionKey : undefined,
        publicKeys: encryptionType === 'asymmetric' ? publicKeys : undefined
      };
      
      logger.info(`Created secure channel ${channelId} for lender ${lenderAddress} and borrower ${borrowerAddress}`);
      
      return channelInfo;
    } catch (error) {
      logger.error(`Error creating secure channel: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Send a secure message in a channel
   * 
   * @param {string} channelId - Channel ID
   * @param {string} sender - Sender's blockchain address
   * @param {Object} messageData - Message data
   * @param {Object} options - Message options
   * @returns {Promise<Object>} Message receipt
   */
  async sendMessage(channelId, sender, messageData, options = {}) {
    try {
      const {
        encryptionKey,
        urgent = false,
        messageType = 'text',
        attachments = []
      } = options;
      
      logger.info(`Sending message in channel ${channelId} from ${sender}`);
      
      // Verify channel exists
      const channel = this.channelCache.get(channelId);
      if (!channel) {
        throw new Error(`Channel ${channelId} not found`);
      }
      
      // Verify sender is a participant
      if (channel.participants.lender !== sender && channel.participants.borrower !== sender) {
        throw new Error(`Sender ${sender} is not a participant in channel ${channelId}`);
      }
      
      // Determine recipient
      const recipient = sender === channel.participants.lender 
        ? channel.participants.borrower 
        : channel.participants.lender;
      
      // Generate a unique message ID
      const messageId = crypto.randomBytes(12).toString('hex');
      
      // Prepare the message
      const message = {
        messageId,
        channelId,
        sender,
        recipient,
        timestamp: Date.now(),
        type: messageType,
        priority: urgent ? 'high' : 'normal',
        hasAttachments: attachments.length > 0
      };
      
      // Process attachments if any
      const processedAttachments = [];
      if (attachments.length > 0) {
        for (const attachment of attachments) {
          // Store attachment
          const attachmentId = crypto.randomBytes(8).toString('hex');
          const attachmentInfo = await this.storeAttachment(channelId, messageId, attachmentId, attachment);
          processedAttachments.push(attachmentInfo);
        }
      }
      
      // Encrypt the message content
      // In a real implementation, this would use proper encryption based on encryptionType
      let encryptedContent;
      if (encryptionKey) {
        // Use provided encryption key
        encryptedContent = this.encryptData(JSON.stringify(messageData), encryptionKey);
      } else {
        // Simulate encryption for demo (not actually secure)
        encryptedContent = Buffer.from(JSON.stringify(messageData)).toString('base64');
      }
      
      // Prepare the complete message with encrypted content
      const completeMessage = {
        ...message,
        encryptedContent,
        attachments: processedAttachments.map(att => att.metadata)
      };
      
      // Store message in Tangle
      const tangleData = {
        type: 'secure_message',
        messageId,
        channelId,
        sender,
        recipient,
        timestamp: Date.now(),
        messageType,
        // The actual content is encrypted
        encryptedData: encryptedContent
      };
      
      // Send message to IOTA Tangle
      const tangleResult = await iotaBlockchainService.sendTangleMessage('streams', tangleData);
      
      // Update channel cache
      channel.messages.push(completeMessage);
      this.channelCache.set(channelId, channel);
      
      logger.info(`Message ${messageId} sent in channel ${channelId}`);
      
      return {
        messageId,
        channelId,
        sender,
        recipient,
        timestamp: message.timestamp,
        tangleBlockId: tangleResult?.blockId,
        attachments: processedAttachments.map(att => att.metadata)
      };
    } catch (error) {
      logger.error(`Error sending message in channel ${channelId}: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Store a document attachment securely
   * 
   * @private
   * @param {string} channelId - Channel ID
   * @param {string} messageId - Message ID
   * @param {string} attachmentId - Attachment ID
   * @param {Object} attachment - Attachment data
   * @returns {Promise<Object>} Attachment information
   */
  async storeAttachment(channelId, messageId, attachmentId, attachment) {
    try {
      const { name, mimeType, data, size, encryptionKey } = attachment;
      
      // Create directory for channel if it doesn't exist
      const channelDir = path.join(this.documentsDirectory, channelId);
      await fs.mkdir(channelDir, { recursive: true });
      
      // Create filename
      const filename = `${attachmentId}-${name.replace(/[^a-zA-Z0-9-_.]/g, '_')}`;
      const filepath = path.join(channelDir, filename);
      
      // Encrypt data if encryption key is provided
      let encryptedData;
      if (encryptionKey) {
        encryptedData = this.encryptData(data, encryptionKey);
      } else {
        // No encryption, just use the data as is
        encryptedData = data;
      }
      
      // Write file
      await fs.writeFile(filepath, encryptedData);
      
      // Create attachment metadata
      const metadata = {
        attachmentId,
        name,
        mimeType,
        size: size || encryptedData.length,
        messageId,
        channelId,
        timestamp: Date.now(),
        isEncrypted: !!encryptionKey
      };
      
      // Store attachment metadata on Tangle
      const tangleData = {
        type: 'document_attachment',
        attachmentId,
        messageId,
        channelId,
        name,
        mimeType,
        size: metadata.size,
        timestamp: metadata.timestamp,
        // Don't include the actual data in the Tangle
        encryptedHash: crypto.createHash('sha256').update(encryptedData).digest('hex')
      };
      
      // Send metadata to IOTA Tangle
      await iotaBlockchainService.sendTangleMessage('streams', tangleData);
      
      return {
        filepath,
        metadata
      };
    } catch (error) {
      logger.error(`Error storing attachment: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Get messages from a channel
   * 
   * @param {string} channelId - Channel ID
   * @param {string} address - Requestor's blockchain address
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Channel messages
   */
  async getMessages(channelId, address, options = {}) {
    try {
      const {
        limit = 50,
        before = Date.now(),
        decryptionKey = null // Key to decrypt messages
      } = options;
      
      logger.info(`Getting messages from channel ${channelId} for ${address}`);
      
      // Verify channel exists
      const channel = this.channelCache.get(channelId);
      
      if (!channel) {
        // Try to fetch channel from the Tangle
        const tangleChannels = await this.fetchChannelsFromTangle(address);
        const tangleChannel = tangleChannels.find(ch => ch.channelId === channelId);
        
        if (!tangleChannel) {
          throw new Error(`Channel ${channelId} not found`);
        }
        
        // Store in cache
        this.channelCache.set(channelId, tangleChannel);
      }
      
      // Verify address is a participant
      if (channel.participants.lender !== address && channel.participants.borrower !== address) {
        throw new Error(`Address ${address} is not a participant in channel ${channelId}`);
      }
      
      // Get messages from Tangle
      const tangleMessages = await this.fetchMessagesFromTangle(channelId, {
        limit,
        before
      });
      
      // Decrypt messages if decryption key is provided
      const processedMessages = [];
      
      for (const message of tangleMessages) {
        let decryptedContent = null;
        
        if (decryptionKey) {
          try {
            // Decrypt content
            const decryptedData = this.decryptData(message.encryptedData, decryptionKey);
            decryptedContent = JSON.parse(decryptedData);
          } catch (decryptError) {
            logger.warn(`Error decrypting message ${message.messageId}: ${decryptError.message}`);
            // Include message with encrypted content
            decryptedContent = { encryptedContent: message.encryptedData };
          }
        }
        
        processedMessages.push({
          messageId: message.messageId,
          channelId: message.channelId,
          sender: message.sender,
          recipient: message.recipient,
          timestamp: message.timestamp,
          type: message.messageType,
          content: decryptedContent,
          hasAttachments: message.hasAttachments
        });
      }
      
      // Sort by timestamp, newest first
      processedMessages.sort((a, b) => b.timestamp - a.timestamp);
      
      return processedMessages;
    } catch (error) {
      logger.error(`Error getting messages from channel ${channelId}: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Fetch channels from the IOTA Tangle
   * 
   * @private
   * @param {string} address - Blockchain address to filter by
   * @returns {Promise<Array>} Channels from the Tangle
   */
  async fetchChannelsFromTangle(address) {
    try {
      logger.debug(`Fetching channels from Tangle for address ${address}`);
      
      // This is a simplified example
      // In a real implementation, you would use IOTA Streams APIs to fetch channels
      const channelAnnouncements = await iotaBlockchainService.queryTangle({
        type: 'channel_announcement',
        participants: address
      });
      
      // Convert to channel objects
      const channels = channelAnnouncements.map(announcement => ({
        channelId: announcement.channelId,
        type: announcement.channelType,
        created: announcement.created,
        participants: announcement.participants,
        messages: []
      }));
      
      logger.debug(`Found ${channels.length} channels for address ${address}`);
      
      return channels;
    } catch (error) {
      logger.error(`Error fetching channels from Tangle: ${error.message}`);
      return [];
    }
  }
  
  /**
   * Fetch messages from the IOTA Tangle
   * 
   * @private
   * @param {string} channelId - Channel ID
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Messages from the Tangle
   */
  async fetchMessagesFromTangle(channelId, options = {}) {
    try {
      const {
        limit = 50,
        before = Date.now()
      } = options;
      
      logger.debug(`Fetching messages for channel ${channelId} from Tangle`);
      
      // This is a simplified example
      // In a real implementation, you would use IOTA Streams APIs to fetch messages
      const messages = await iotaBlockchainService.queryTangle({
        type: 'secure_message',
        channelId,
        timestamp: { $lt: before },
        limit
      });
      
      logger.debug(`Found ${messages.length} messages for channel ${channelId}`);
      
      return messages;
    } catch (error) {
      logger.error(`Error fetching messages from Tangle: ${error.message}`);
      return [];
    }
  }
  
  /**
   * Get a document attachment
   * 
   * @param {string} channelId - Channel ID
   * @param {string} attachmentId - Attachment ID
   * @param {string} address - Requestor's blockchain address
   * @param {Object} options - Options for retrieval
   * @returns {Promise<Object>} Attachment data
   */
  async getAttachment(channelId, attachmentId, address, options = {}) {
    try {
      const {
        decryptionKey = null // Key to decrypt attachment
      } = options;
      
      logger.info(`Getting attachment ${attachmentId} from channel ${channelId} for ${address}`);
      
      // Verify channel exists and user is a participant
      const channel = this.channelCache.get(channelId);
      
      if (!channel) {
        throw new Error(`Channel ${channelId} not found`);
      }
      
      // Verify address is a participant
      if (channel.participants.lender !== address && channel.participants.borrower !== address) {
        throw new Error(`Address ${address} is not a participant in channel ${channelId}`);
      }
      
      // Get attachment metadata from Tangle
      const attachmentMetadata = await iotaBlockchainService.queryTangle({
        type: 'document_attachment',
        attachmentId,
        channelId
      });
      
      if (!attachmentMetadata || attachmentMetadata.length === 0) {
        throw new Error(`Attachment ${attachmentId} not found`);
      }
      
      const metadata = attachmentMetadata[0];
      
      // Find attachment file
      const channelDir = path.join(this.documentsDirectory, channelId);
      const files = await fs.readdir(channelDir);
      
      // Find file with attachment ID prefix
      const attachmentFile = files.find(file => file.startsWith(`${attachmentId}-`));
      
      if (!attachmentFile) {
        throw new Error(`Attachment file for ${attachmentId} not found`);
      }
      
      // Read file
      const filePath = path.join(channelDir, attachmentFile);
      const encryptedData = await fs.readFile(filePath);
      
      // Decrypt if needed and decryption key is provided
      let data = encryptedData;
      if (metadata.isEncrypted && decryptionKey) {
        try {
          data = this.decryptData(encryptedData, decryptionKey);
        } catch (decryptError) {
          logger.warn(`Error decrypting attachment ${attachmentId}: ${decryptError.message}`);
          throw new Error(`Failed to decrypt attachment: ${decryptError.message}`);
        }
      }
      
      return {
        attachmentId,
        name: metadata.name,
        mimeType: metadata.mimeType,
        size: metadata.size,
        data,
        messageId: metadata.messageId,
        channelId,
        isEncrypted: metadata.isEncrypted && !decryptionKey
      };
    } catch (error) {
      logger.error(`Error getting attachment ${attachmentId}: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Encrypt data using AES-GCM
   * 
   * @private
   * @param {string|Buffer} data - Data to encrypt
   * @param {string} key - Encryption key (hex)
   * @returns {string} Encrypted data (hex)
   */
  encryptData(data, key) {
    try {
      // Convert key to buffer
      const keyBuffer = Buffer.from(key, 'hex');
      
      // Generate random IV
      const iv = crypto.randomBytes(12);
      
      // Create cipher
      const cipher = crypto.createCipheriv('aes-256-gcm', keyBuffer, iv);
      
      // Encrypt data
      let encrypted = cipher.update(data, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      // Get auth tag
      const authTag = cipher.getAuthTag().toString('hex');
      
      // Return encrypted data with IV and auth tag
      return JSON.stringify({
        iv: iv.toString('hex'),
        encrypted,
        authTag
      });
    } catch (error) {
      logger.error(`Error encrypting data: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Decrypt data using AES-GCM
   * 
   * @private
   * @param {string} encryptedData - Encrypted data in JSON format
   * @param {string} key - Decryption key (hex)
   * @returns {string} Decrypted data
   */
  decryptData(encryptedData, key) {
    try {
      // Parse encrypted data
      const { iv, encrypted, authTag } = JSON.parse(encryptedData);
      
      // Convert key to buffer
      const keyBuffer = Buffer.from(key, 'hex');
      
      // Create decipher
      const decipher = crypto.createDecipheriv(
        'aes-256-gcm',
        keyBuffer,
        Buffer.from(iv, 'hex')
      );
      
      // Set auth tag
      decipher.setAuthTag(Buffer.from(authTag, 'hex'));
      
      // Decrypt data
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      logger.error(`Error decrypting data: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Close a channel
   * 
   * @param {string} channelId - Channel ID
   * @param {string} initiator - Blockchain address of the initiator
   * @param {Object} options - Options for closing
   * @returns {Promise<Object>} Closure status
   */
  async closeChannel(channelId, initiator, options = {}) {
    try {
      const {
        reason = 'complete'
      } = options;
      
      logger.info(`Closing channel ${channelId} by ${initiator}`);
      
      // Verify channel exists
      const channel = this.channelCache.get(channelId);
      
      if (!channel) {
        throw new Error(`Channel ${channelId} not found`);
      }
      
      // Verify initiator is a participant
      if (channel.participants.lender !== initiator && channel.participants.borrower !== initiator) {
        throw new Error(`Initiator ${initiator} is not a participant in channel ${channelId}`);
      }
      
      // Update channel status
      channel.metadata.status = 'closed';
      channel.metadata.closedBy = initiator;
      channel.metadata.closedAt = Date.now();
      channel.metadata.closeReason = reason;
      
      // Store closure information on Tangle
      const closureData = {
        type: 'channel_closure',
        channelId,
        closedBy: initiator,
        closedAt: Date.now(),
        reason
      };
      
      // Send closure message to IOTA Tangle
      await iotaBlockchainService.sendTangleMessage('streams', closureData);
      
      // Update cache
      this.channelCache.set(channelId, channel);
      
      logger.info(`Channel ${channelId} closed by ${initiator}`);
      
      return {
        channelId,
        status: 'closed',
        closedBy: initiator,
        closedAt: Date.now(),
        reason
      };
    } catch (error) {
      logger.error(`Error closing channel ${channelId}: ${error.message}`);
      throw error;
    }
  }
}

module.exports = new IOTAStreamsService();
