/**
 * Secure Credential Store
 * 
 * Provides secure storage and retrieval of credentials with encryption.
 * Designed to work with IOTA identity framework for enhanced security.
 */

const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');
const logger = require('./logger');

class SecureCredentialStore {
  constructor(options = {}) {
    this.storageDirectory = options.storageDirectory || path.join(process.cwd(), 'credential-store');
    this.encryptionKey = options.encryptionKey || process.env.CREDENTIAL_ENCRYPTION_KEY;
    
    if (!this.encryptionKey) {
      logger.warn('No encryption key provided for credential store. Generating a temporary key.');
      this.encryptionKey = crypto.randomBytes(32).toString('hex');
      logger.warn('In production, set CREDENTIAL_ENCRYPTION_KEY in your environment variables.');
    }
    
    // Create storage directory if it doesn't exist
    this.initialize();
  }
  
  /**
   * Initialize the credential store
   */
  async initialize() {
    try {
      await fs.mkdir(this.storageDirectory, { recursive: true });
      logger.info(`Secure credential store initialized at ${this.storageDirectory}`);
    } catch (error) {
      logger.error(`Error initializing credential store: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Store a credential securely
   * 
   * @param {string} id - Unique identifier for the credential
   * @param {Object} credential - Credential to store
   * @param {Object} options - Storage options
   * @returns {Promise<boolean>} Success indicator
   */
  async storeCredential(id, credential, options = {}) {
    try {
      const {
        namespace = 'default',
        additionalMetadata = {},
        expiry = null // Optional expiry timestamp
      } = options;
      
      // Prepare data for storage
      const storageData = {
        credential,
        metadata: {
          id,
          namespace,
          created: Date.now(),
          expires: expiry,
          ...additionalMetadata
        }
      };
      
      // Encrypt the data
      const encryptedData = this.encrypt(JSON.stringify(storageData));
      
      // Create directory for namespace if it doesn't exist
      const namespaceDir = path.join(this.storageDirectory, namespace);
      await fs.mkdir(namespaceDir, { recursive: true });
      
      // Write encrypted data to file
      const filePath = path.join(namespaceDir, `${id}.enc`);
      await fs.writeFile(filePath, encryptedData);
      
      logger.debug(`Credential ${id} stored securely in namespace ${namespace}`);
      return true;
    } catch (error) {
      logger.error(`Error storing credential ${id}: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Retrieve a credential
   * 
   * @param {string} id - Credential ID
   * @param {string} namespace - Namespace
   * @returns {Promise<Object|null>} The credential or null if not found
   */
  async getCredential(id, namespace = 'default') {
    try {
      // Construct file path
      const filePath = path.join(this.storageDirectory, namespace, `${id}.enc`);
      
      // Check if file exists
      try {
        await fs.access(filePath);
      } catch (error) {
        logger.debug(`Credential ${id} not found in namespace ${namespace}`);
        return null;
      }
      
      // Read and decrypt file
      const encryptedData = await fs.readFile(filePath, 'utf8');
      const decryptedData = this.decrypt(encryptedData);
      
      // Parse the data
      const storageData = JSON.parse(decryptedData);
      
      // Check if credential has expired
      if (storageData.metadata.expires && storageData.metadata.expires < Date.now()) {
        logger.debug(`Credential ${id} has expired`);
        
        // Delete expired credential
        await fs.unlink(filePath).catch(err => {
          logger.warn(`Error deleting expired credential ${id}: ${err.message}`);
        });
        
        return null;
      }
      
      return {
        credential: storageData.credential,
        metadata: storageData.metadata
      };
    } catch (error) {
      logger.error(`Error retrieving credential ${id}: ${error.message}`);
      return null;
    }
  }
  
  /**
   * Delete a credential
   * 
   * @param {string} id - Credential ID
   * @param {string} namespace - Namespace
   * @returns {Promise<boolean>} Success indicator
   */
  async deleteCredential(id, namespace = 'default') {
    try {
      const filePath = path.join(this.storageDirectory, namespace, `${id}.enc`);
      
      // Check if file exists
      try {
        await fs.access(filePath);
      } catch (error) {
        logger.debug(`Credential ${id} not found in namespace ${namespace}`);
        return true; // Already deleted
      }
      
      // Delete the file
      await fs.unlink(filePath);
      logger.debug(`Credential ${id} deleted from namespace ${namespace}`);
      
      return true;
    } catch (error) {
      logger.error(`Error deleting credential ${id}: ${error.message}`);
      return false;
    }
  }
  
  /**
   * List all credentials in a namespace
   * 
   * @param {string} namespace - Namespace
   * @returns {Promise<Array>} List of credential IDs
   */
  async listCredentials(namespace = 'default') {
    try {
      const namespaceDir = path.join(this.storageDirectory, namespace);
      
      // Check if directory exists
      try {
        await fs.access(namespaceDir);
      } catch (error) {
        return []; // No credentials yet
      }
      
      // Read directory contents
      const files = await fs.readdir(namespaceDir);
      
      // Filter for encrypted files and extract IDs
      const credentialIds = files
        .filter(file => file.endsWith('.enc'))
        .map(file => file.slice(0, -4)); // Remove .enc extension
      
      return credentialIds;
    } catch (error) {
      logger.error(`Error listing credentials in namespace ${namespace}: ${error.message}`);
      return [];
    }
  }
  
  /**
   * Search for credentials based on metadata
   * 
   * @param {Object} query - Search query
   * @param {string} namespace - Namespace
   * @returns {Promise<Array>} Matching credentials
   */
  async searchCredentials(query, namespace = 'default') {
    try {
      // Get all credential IDs in the namespace
      const credentialIds = await this.listCredentials(namespace);
      
      // Fetch and filter credentials
      const results = [];
      
      for (const id of credentialIds) {
        const data = await this.getCredential(id, namespace);
        
        if (!data) continue; // Skip if not found or expired
        
        // Check if credential matches the query
        let matches = true;
        
        for (const [key, value] of Object.entries(query)) {
          // Check nested properties using dot notation
          const keyParts = key.split('.');
          let currentObj = data;
          
          // Navigate to the nested property
          for (const part of keyParts) {
            if (!currentObj || typeof currentObj !== 'object') {
              matches = false;
              break;
            }
            currentObj = currentObj[part];
          }
          
          // Compare value
          if (currentObj !== value) {
            matches = false;
            break;
          }
        }
        
        if (matches) {
          results.push(data);
        }
      }
      
      return results;
    } catch (error) {
      logger.error(`Error searching credentials: ${error.message}`);
      return [];
    }
  }
  
  /**
   * Encrypt data
   * 
   * @private
   * @param {string} data - Data to encrypt
   * @returns {string} Encrypted data
   */
  encrypt(data) {
    // Generate a random initialization vector
    const iv = crypto.randomBytes(16);
    
    // Create cipher
    const key = Buffer.from(this.encryptionKey, 'hex');
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    
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
  }
  
  /**
   * Decrypt data
   * 
   * @private
   * @param {string} encryptedData - Encrypted data
   * @returns {string} Decrypted data
   */
  decrypt(encryptedData) {
    // Parse encrypted data
    const { iv, encrypted, authTag } = JSON.parse(encryptedData);
    
    // Create decipher
    const key = Buffer.from(this.encryptionKey, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'hex'));
    
    // Set auth tag
    decipher.setAuthTag(Buffer.from(authTag, 'hex'));
    
    // Decrypt data
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }
}

module.exports = SecureCredentialStore;
