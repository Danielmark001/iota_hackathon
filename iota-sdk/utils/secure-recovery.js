/**
 * Secure Recovery Procedures for IOTA Wallet
 * 
 * Implements secure recovery procedures for Stronghold wallet integration.
 * Handles key management, backup, and recovery with enhanced security.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const logger = require('./logger');

/**
 * Secure backup generator for Stronghold snapshots
 */
class SecureRecovery {
  constructor(options = {}) {
    this.snapshotPath = options.snapshotPath;
    this.backupDir = options.backupDir || './backups';
    this.backupCount = options.backupCount || 5;
    this.encryption = options.encryption !== false;
    this.encryptionKey = options.encryptionKey || null;
    
    // Ensure backup directory exists
    if (!fs.existsSync(this.backupDir)) {
      try {
        fs.mkdirSync(this.backupDir, { recursive: true });
        logger.info(`Created backup directory at ${this.backupDir}`);
      } catch (error) {
        logger.error(`Error creating backup directory: ${error.message}`);
      }
    }
  }
  
  /**
   * Create a secure backup of the Stronghold snapshot
   * @param {Object} options - Backup options
   * @returns {Promise<string>} Backup file path
   */
  async createBackup(options = {}) {
    try {
      const { encryptionKey = this.encryptionKey, force = false } = options;
      
      if (!this.snapshotPath || !fs.existsSync(this.snapshotPath)) {
        throw new Error(`Snapshot file not found at ${this.snapshotPath}`);
      }
      
      // Generate backup filename with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const snapshotName = path.basename(this.snapshotPath);
      const backupName = `${snapshotName}.${timestamp}.backup`;
      const backupPath = path.join(this.backupDir, backupName);
      
      // Check if snapshot has changed since last backup
      const lastBackup = this.getLastBackup();
      if (!force && lastBackup) {
        const snapshotHash = this.hashFile(this.snapshotPath);
        const lastBackupHash = await this.getBackupHash(lastBackup);
        
        if (snapshotHash === lastBackupHash) {
          logger.info('Snapshot has not changed since last backup, skipping');
          return lastBackup;
        }
      }
      
      // Read snapshot file
      const snapshotData = fs.readFileSync(this.snapshotPath);
      
      // Encrypt if requested
      const backupData = this.encryption && encryptionKey
        ? this.encryptData(snapshotData, encryptionKey)
        : snapshotData;
      
      // Write backup file
      fs.writeFileSync(backupPath, backupData);
      logger.info(`Created backup at ${backupPath}`);
      
      // Rotate old backups
      this.rotateBackups();
      
      return backupPath;
    } catch (error) {
      logger.error(`Error creating backup: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Restore snapshot from backup
   * @param {string} backupPath - Path to backup file
   * @param {Object} options - Restore options
   * @returns {Promise<boolean>} Success state
   */
  async restoreFromBackup(backupPath, options = {}) {
    try {
      const { encryptionKey = this.encryptionKey, targetPath = this.snapshotPath } = options;
      
      if (!backupPath || !fs.existsSync(backupPath)) {
        throw new Error(`Backup file not found at ${backupPath}`);
      }
      
      // Read backup file
      const backupData = fs.readFileSync(backupPath);
      
      // Decrypt if necessary
      const snapshotData = this.isEncrypted(backupData) && encryptionKey
        ? this.decryptData(backupData, encryptionKey)
        : backupData;
      
      // Make sure target directory exists
      const targetDir = path.dirname(targetPath);
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }
      
      // Create a backup of the current file if it exists
      if (fs.existsSync(targetPath)) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupPath = `${targetPath}.${timestamp}.pre-restore`;
        fs.copyFileSync(targetPath, backupPath);
        logger.info(`Created pre-restore backup at ${backupPath}`);
      }
      
      // Write restored snapshot
      fs.writeFileSync(targetPath, snapshotData);
      logger.info(`Restored snapshot from backup to ${targetPath}`);
      
      return true;
    } catch (error) {
      logger.error(`Error restoring from backup: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * List available backups
   * @returns {Array<Object>} List of backups with metadata
   */
  listBackups() {
    try {
      if (!fs.existsSync(this.backupDir)) {
        return [];
      }
      
      // Get snapshot name for filtering
      const snapshotName = path.basename(this.snapshotPath);
      
      // List backup files
      const files = fs.readdirSync(this.backupDir)
        .filter(file => file.startsWith(snapshotName) && file.includes('.backup'))
        .map(file => {
          const filePath = path.join(this.backupDir, file);
          const stats = fs.statSync(filePath);
          
          // Extract timestamp from filename
          let timestamp = null;
          try {
            const dateStr = file.split('.')[1].replace(/-/g, ':');
            timestamp = new Date(dateStr);
          } catch (e) {
            timestamp = stats.mtime;
          }
          
          return {
            file,
            path: filePath,
            size: stats.size,
            created: stats.mtime,
            timestamp,
            encrypted: this.isFileEncrypted(filePath)
          };
        });
      
      // Sort by timestamp, newest first
      files.sort((a, b) => b.timestamp - a.timestamp);
      
      return files;
    } catch (error) {
      logger.error(`Error listing backups: ${error.message}`);
      return [];
    }
  }
  
  /**
   * Get the most recent backup
   * @returns {string|null} Path to most recent backup
   */
  getLastBackup() {
    const backups = this.listBackups();
    return backups.length > 0 ? backups[0].path : null;
  }
  
  /**
   * Rotate old backups, keeping only the most recent ones
   */
  rotateBackups() {
    try {
      const backups = this.listBackups();
      
      // Delete oldest backups if we have more than backupCount
      if (backups.length > this.backupCount) {
        const toDelete = backups.slice(this.backupCount);
        
        for (const backup of toDelete) {
          fs.unlinkSync(backup.path);
          logger.info(`Deleted old backup: ${backup.file}`);
        }
      }
    } catch (error) {
      logger.error(`Error rotating backups: ${error.message}`);
    }
  }
  
  /**
   * Encrypt data with a key
   * @param {Buffer} data - Data to encrypt
   * @param {string} key - Encryption key
   * @returns {Buffer} Encrypted data
   */
  encryptData(data, key) {
    try {
      // Generate a random initialization vector
      const iv = crypto.randomBytes(16);
      
      // Create a cipher with AES-256-GCM
      const cipher = crypto.createCipheriv(
        'aes-256-gcm',
        crypto.createHash('sha256').update(key).digest(),
        iv
      );
      
      // Encrypt the data
      const encrypted = Buffer.concat([
        cipher.update(data),
        cipher.final()
      ]);
      
      // Get the authentication tag
      const authTag = cipher.getAuthTag();
      
      // Combine IV, auth tag, and encrypted data
      const result = Buffer.concat([
        // Header to identify encrypted data
        Buffer.from('ENCRYPTED:', 'utf8'),
        // IV (16 bytes)
        iv,
        // Auth tag (16 bytes)
        authTag,
        // Encrypted data
        encrypted
      ]);
      
      return result;
    } catch (error) {
      logger.error(`Encryption error: ${error.message}`);
      throw new Error(`Failed to encrypt data: ${error.message}`);
    }
  }
  
  /**
   * Decrypt data with a key
   * @param {Buffer} data - Encrypted data
   * @param {string} key - Decryption key
   * @returns {Buffer} Decrypted data
   */
  decryptData(data, key) {
    try {
      // Check if data is encrypted
      if (!this.isEncrypted(data)) {
        throw new Error('Data is not encrypted');
      }
      
      // Extract components
      const header = data.slice(0, 10);
      const iv = data.slice(10, 26);
      const authTag = data.slice(26, 42);
      const encrypted = data.slice(42);
      
      // Create a decipher
      const decipher = crypto.createDecipheriv(
        'aes-256-gcm',
        crypto.createHash('sha256').update(key).digest(),
        iv
      );
      
      // Set auth tag
      decipher.setAuthTag(authTag);
      
      // Decrypt the data
      const decrypted = Buffer.concat([
        decipher.update(encrypted),
        decipher.final()
      ]);
      
      return decrypted;
    } catch (error) {
      logger.error(`Decryption error: ${error.message}`);
      throw new Error(`Failed to decrypt data: ${error.message}`);
    }
  }
  
  /**
   * Check if data is encrypted
   * @param {Buffer} data - Data to check
   * @returns {boolean} Whether data is encrypted
   */
  isEncrypted(data) {
    // Check for encryption header
    return data.slice(0, 10).toString() === 'ENCRYPTED:';
  }
  
  /**
   * Check if a file is encrypted
   * @param {string} filePath - Path to file
   * @returns {boolean} Whether file is encrypted
   */
  isFileEncrypted(filePath) {
    try {
      // Read the first 10 bytes
      const fd = fs.openSync(filePath, 'r');
      const buffer = Buffer.alloc(10);
      fs.readSync(fd, buffer, 0, 10, 0);
      fs.closeSync(fd);
      
      return this.isEncrypted(buffer);
    } catch (error) {
      logger.error(`Error checking if file is encrypted: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Get hash of a file
   * @param {string} filePath - Path to file
   * @returns {string} File hash
   */
  hashFile(filePath) {
    try {
      const data = fs.readFileSync(filePath);
      return crypto.createHash('sha256').update(data).digest('hex');
    } catch (error) {
      logger.error(`Error hashing file: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Get hash of a backup file contents
   * @param {string} backupPath - Path to backup file
   * @returns {Promise<string>} Backup hash
   */
  async getBackupHash(backupPath) {
    try {
      // Read backup file
      const backupData = fs.readFileSync(backupPath);
      
      // Decrypt if necessary
      const fileData = this.isEncrypted(backupData) && this.encryptionKey
        ? this.decryptData(backupData, this.encryptionKey)
        : backupData;
      
      // Hash the data
      return crypto.createHash('sha256').update(fileData).digest('hex');
    } catch (error) {
      logger.error(`Error getting backup hash: ${error.message}`);
      // Return random hash to ensure backup creation proceeds
      return crypto.randomBytes(32).toString('hex');
    }
  }
}

/**
 * Create a secure recovery manager
 * @param {Object} options - Recovery options
 * @returns {SecureRecovery} Recovery manager
 */
function createSecureRecovery(options = {}) {
  return new SecureRecovery(options);
}

module.exports = {
  SecureRecovery,
  createSecureRecovery
};