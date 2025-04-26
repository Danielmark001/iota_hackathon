/**
 * Stronghold Security Validator
 * 
 * This utility provides enhanced validation for Stronghold security settings
 * and implements secure recovery procedures for wallet operations.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { createHash } = require('crypto');
const logger = require('./logger');

class StrongholdValidator {
  /**
   * Initialize Stronghold Validator
   * @param {Object} options - Validator options
   */
  constructor(options = {}) {
    this.options = {
      minPasswordLength: options.minPasswordLength || 12,
      requireUppercase: options.requireUppercase !== false,
      requireLowercase: options.requireLowercase !== false,
      requireNumbers: options.requireNumbers !== false,
      requireSpecial: options.requireSpecial !== false,
      backupInterval: options.backupInterval || 86400000, // 24 hours
      maxBackups: options.maxBackups || 5,
      backupDir: options.backupDir || './backups/stronghold',
      encryptBackups: options.encryptBackups !== false,
      ...options
    };
    
    this.lastBackupTime = 0;
    
    logger.info('Stronghold Validator initialized');
  }
  
  /**
   * Validate Stronghold password strength
   * @param {string} password - Password to validate
   * @returns {Object} Validation result
   */
  validatePassword(password) {
    if (!password) {
      return {
        isValid: false,
        reasons: ['Password is required'],
        score: 0,
        strength: 'none'
      };
    }
    
    const reasons = [];
    let score = 0;
    
    // Length check
    if (password.length < this.options.minPasswordLength) {
      reasons.push(`Password must be at least ${this.options.minPasswordLength} characters`);
    } else {
      score += Math.min(10, password.length / 2);
    }
    
    // Uppercase check
    if (this.options.requireUppercase && !/[A-Z]/.test(password)) {
      reasons.push('Password must include at least one uppercase letter');
    } else if (/[A-Z]/.test(password)) {
      score += 5;
    }
    
    // Lowercase check
    if (this.options.requireLowercase && !/[a-z]/.test(password)) {
      reasons.push('Password must include at least one lowercase letter');
    } else if (/[a-z]/.test(password)) {
      score += 5;
    }
    
    // Number check
    if (this.options.requireNumbers && !/[0-9]/.test(password)) {
      reasons.push('Password must include at least one number');
    } else if (/[0-9]/.test(password)) {
      score += 5;
    }
    
    // Special character check
    if (this.options.requireSpecial && !/[^A-Za-z0-9]/.test(password)) {
      reasons.push('Password must include at least one special character');
    } else if (/[^A-Za-z0-9]/.test(password)) {
      score += 5;
    }
    
    // Check for repeating patterns
    if (/(.)\1{2,}/.test(password)) {
      reasons.push('Password should not contain repeating characters');
      score -= 5;
    }
    
    // Check for sequential characters
    if (/(?:abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz|012|123|234|345|456|567|678|789|987|876|765|654|543|432|321|210)/i.test(password)) {
      reasons.push('Password should not contain sequential characters');
      score -= 5;
    }
    
    // Calculate strength category
    let strength = 'weak';
    if (score >= 25) {
      strength = 'strong';
    } else if (score >= 15) {
      strength = 'medium';
    }
    
    // Ensure positive score
    score = Math.max(0, score);
    
    return {
      isValid: reasons.length === 0,
      reasons,
      score,
      strength
    };
  }
  
  /**
   * Validate Stronghold file
   * @param {string} filePath - Path to Stronghold file
   * @returns {Promise<Object>} Validation result
   */
  async validateStrongholdFile(filePath) {
    try {
      if (!filePath) {
        return {
          isValid: false,
          reasons: ['Stronghold file path is required']
        };
      }
      
      // Check if file exists
      if (!fs.existsSync(filePath)) {
        return {
          isValid: false,
          reasons: ['Stronghold file does not exist']
        };
      }
      
      // Check file permissions
      const stats = fs.statSync(filePath);
      const permissions = stats.mode & 0o777;
      
      // On Unix-like systems, check if permissions are too open
      if (process.platform !== 'win32' && (permissions & 0o077) !== 0) {
        return {
          isValid: false,
          reasons: [`Stronghold file permissions are too open: ${permissions.toString(8)}`]
        };
      }
      
      // Check file size (should be reasonable)
      if (stats.size < 100) {
        return {
          isValid: false,
          reasons: ['Stronghold file is too small, may be corrupted']
        };
      }
      
      return {
        isValid: true,
        fileSize: stats.size,
        lastModified: stats.mtime
      };
    } catch (error) {
      logger.error(`Error validating Stronghold file: ${error.message}`);
      return {
        isValid: false,
        reasons: [`Error validating file: ${error.message}`]
      };
    }
  }
  
  /**
   * Create backup of Stronghold file
   * @param {string} filePath - Path to Stronghold file
   * @param {string} backupDir - Backup directory (optional)
   * @returns {Promise<Object>} Backup result
   */
  async createBackup(filePath, backupDir = this.options.backupDir) {
    try {
      if (!filePath) {
        throw new Error('Stronghold file path is required');
      }
      
      // Check if file exists
      if (!fs.existsSync(filePath)) {
        throw new Error('Stronghold file does not exist');
      }
      
      // Check if it's time for a backup
      const now = Date.now();
      if (now - this.lastBackupTime < this.options.backupInterval) {
        return {
          skipped: true,
          reason: 'Backup interval not reached',
          nextBackup: new Date(this.lastBackupTime + this.options.backupInterval)
        };
      }
      
      // Ensure backup directory exists
      const backupDirectory = backupDir || path.join(path.dirname(filePath), 'backups');
      if (!fs.existsSync(backupDirectory)) {
        fs.mkdirSync(backupDirectory, { recursive: true });
      }
      
      // Generate backup filename with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = path.basename(filePath);
      const backupFileName = `${fileName}.${timestamp}.bak`;
      const backupPath = path.join(backupDirectory, backupFileName);
      
      // Read source file
      const fileData = fs.readFileSync(filePath);
      
      // Optionally encrypt backup
      let dataToWrite = fileData;
      let encryptionInfo = null;
      
      if (this.options.encryptBackups) {
        // Generate encryption key
        const encryptionKey = crypto.randomBytes(32);
        const iv = crypto.randomBytes(16);
        
        // Encrypt file
        const cipher = crypto.createCipheriv('aes-256-cbc', encryptionKey, iv);
        let encrypted = cipher.update(fileData);
        encrypted = Buffer.concat([encrypted, cipher.final()]);
        
        // Save encryption info
        encryptionInfo = {
          key: encryptionKey.toString('hex'),
          iv: iv.toString('hex'),
          algorithm: 'aes-256-cbc'
        };
        
        // Write encryption info to separate file
        const infoPath = `${backupPath}.info`;
        fs.writeFileSync(infoPath, JSON.stringify(encryptionInfo), { mode: 0o600 });
        
        dataToWrite = encrypted;
      }
      
      // Write backup file with secure permissions
      fs.writeFileSync(backupPath, dataToWrite, { mode: 0o600 });
      
      // Calculate file hash
      const fileHash = createHash('sha256').update(fileData).digest('hex');
      
      // Update last backup time
      this.lastBackupTime = now;
      
      // Cleanup old backups
      const cleanupResult = await this.cleanupOldBackups(backupDirectory, fileName);
      
      return {
        success: true,
        backupPath,
        timestamp,
        fileSize: fileData.length,
        fileHash,
        encrypted: this.options.encryptBackups,
        encryptionInfo: encryptionInfo ? {
          infoPath: `${backupPath}.info`,
          algorithm: encryptionInfo.algorithm
        } : null,
        cleanupResult
      };
    } catch (error) {
      logger.error(`Error creating Stronghold backup: ${error.message}`);
      throw new Error(`Failed to create Stronghold backup: ${error.message}`);
    }
  }
  
  /**
   * Clean up old backups
   * @param {string} backupDir - Backup directory
   * @param {string} baseFileName - Base filename
   * @returns {Promise<Object>} Cleanup result
   */
  async cleanupOldBackups(backupDir, baseFileName) {
    try {
      const files = fs.readdirSync(backupDir);
      
      // Filter backup files for this Stronghold file
      const backupFiles = files.filter(file => {
        return file.startsWith(`${baseFileName}.`) && file.endsWith('.bak');
      });
      
      // Sort by creation time (oldest first)
      backupFiles.sort((a, b) => {
        const statA = fs.statSync(path.join(backupDir, a));
        const statB = fs.statSync(path.join(backupDir, b));
        return statA.birthtimeMs - statB.birthtimeMs;
      });
      
      // Remove old backups if we have too many
      const filesToRemove = backupFiles.slice(0, Math.max(0, backupFiles.length - this.options.maxBackups));
      
      for (const file of filesToRemove) {
        const filePath = path.join(backupDir, file);
        fs.unlinkSync(filePath);
        
        // Also remove info file if it exists
        const infoPath = `${filePath}.info`;
        if (fs.existsSync(infoPath)) {
          fs.unlinkSync(infoPath);
        }
      }
      
      return {
        removed: filesToRemove.length,
        remaining: backupFiles.length - filesToRemove.length
      };
    } catch (error) {
      logger.error(`Error cleaning up old backups: ${error.message}`);
      return {
        error: error.message,
        removed: 0
      };
    }
  }
  
  /**
   * Restore Stronghold from backup
   * @param {string} backupPath - Path to backup file
   * @param {string} restorePath - Path to restore to
   * @returns {Promise<Object>} Restore result
   */
  async restoreFromBackup(backupPath, restorePath) {
    try {
      if (!backupPath || !restorePath) {
        throw new Error('Backup path and restore path are required');
      }
      
      // Check if backup exists
      if (!fs.existsSync(backupPath)) {
        throw new Error('Backup file does not exist');
      }
      
      // Read backup file
      let fileData = fs.readFileSync(backupPath);
      
      // Check if backup is encrypted
      const infoPath = `${backupPath}.info`;
      if (fs.existsSync(infoPath)) {
        // Read encryption info
        const encryptionInfo = JSON.parse(fs.readFileSync(infoPath, 'utf8'));
        
        // Decrypt file
        const key = Buffer.from(encryptionInfo.key, 'hex');
        const iv = Buffer.from(encryptionInfo.iv, 'hex');
        
        const decipher = crypto.createDecipheriv(encryptionInfo.algorithm, key, iv);
        let decrypted = decipher.update(fileData);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        
        fileData = decrypted;
      }
      
      // Create backup of current file if it exists
      if (fs.existsSync(restorePath)) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupBeforeRestorePath = `${restorePath}.pre-restore.${timestamp}`;
        fs.copyFileSync(restorePath, backupBeforeRestorePath);
      }
      
      // Write restored file with secure permissions
      fs.writeFileSync(restorePath, fileData, { mode: 0o600 });
      
      // Calculate file hash
      const fileHash = createHash('sha256').update(fileData).digest('hex');
      
      return {
        success: true,
        restorePath,
        fileSize: fileData.length,
        fileHash,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error(`Error restoring Stronghold from backup: ${error.message}`);
      throw new Error(`Failed to restore Stronghold from backup: ${error.message}`);
    }
  }
  
  /**
   * Get available backups for a Stronghold file
   * @param {string} filePath - Path to Stronghold file
   * @param {string} backupDir - Backup directory (optional)
   * @returns {Promise<Array>} Available backups
   */
  async getAvailableBackups(filePath, backupDir = this.options.backupDir) {
    try {
      const fileName = path.basename(filePath);
      const backupDirectory = backupDir || path.join(path.dirname(filePath), 'backups');
      
      if (!fs.existsSync(backupDirectory)) {
        return [];
      }
      
      const files = fs.readdirSync(backupDirectory);
      
      // Filter backup files for this Stronghold file
      const backupFiles = files.filter(file => {
        return file.startsWith(`${fileName}.`) && file.endsWith('.bak');
      });
      
      // Get info for each backup
      const backups = backupFiles.map(file => {
        const backupPath = path.join(backupDirectory, file);
        const stats = fs.statSync(backupPath);
        
        // Check if backup is encrypted
        const infoPath = `${backupPath}.info`;
        const isEncrypted = fs.existsSync(infoPath);
        
        // Parse timestamp from filename
        const match = file.match(/\.([^.]+)\.bak$/);
        const timestampStr = match ? match[1] : null;
        
        return {
          path: backupPath,
          filename: file,
          size: stats.size,
          created: stats.birthtime,
          lastModified: stats.mtime,
          isEncrypted,
          timestamp: timestampStr ? timestampStr.replace(/-/g, ':') : null
        };
      });
      
      // Sort by creation time (newest first)
      backups.sort((a, b) => b.created - a.created);
      
      return backups;
    } catch (error) {
      logger.error(`Error getting available backups: ${error.message}`);
      throw new Error(`Failed to get available backups: ${error.message}`);
    }
  }
  
  /**
   * Set up automatic backup schedule
   * @param {string} filePath - Path to Stronghold file
   * @param {string} backupDir - Backup directory (optional)
   * @returns {Object} Schedule info
   */
  setupAutomaticBackups(filePath, backupDir = this.options.backupDir) {
    if (this.backupInterval) {
      clearInterval(this.backupInterval);
    }
    
    logger.info(`Setting up automatic Stronghold backups every ${this.options.backupInterval / (60 * 60 * 1000)} hours`);
    
    this.backupInterval = setInterval(async () => {
      try {
        await this.createBackup(filePath, backupDir);
        logger.info('Automatic Stronghold backup created successfully');
      } catch (error) {
        logger.error(`Error creating automatic backup: ${error.message}`);
      }
    }, this.options.backupInterval);
    
    return {
      interval: this.options.backupInterval,
      backupDir,
      nextBackup: new Date(Date.now() + this.options.backupInterval)
    };
  }
  
  /**
   * Stop automatic backup schedule
   */
  stopAutomaticBackups() {
    if (this.backupInterval) {
      clearInterval(this.backupInterval);
      this.backupInterval = null;
      logger.info('Automatic Stronghold backups stopped');
    }
  }
}

module.exports = StrongholdValidator;
