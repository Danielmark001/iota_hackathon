/**
 * Advanced logger for IOTA SDK integration
 * Provides structured logging with different levels and formats
 */

const fs = require('fs');
const path = require('path');
const util = require('util');

// Log levels with numeric values for comparison
const LOG_LEVELS = {
  trace: 0,
  debug: 1,
  info: 2,
  warn: 3,
  error: 4,
  fatal: 5,
  none: 6
};

// Default configuration
const DEFAULT_CONFIG = {
  level: 'info',
  enableConsole: true,
  enableFile: false,
  logDir: 'logs',
  logFilename: 'iota-sdk.log',
  maxFileSize: 10 * 1024 * 1024, // 10MB
  maxFiles: 5,
  format: 'text', // 'text' or 'json'
  colorize: true,
  timestamp: true,
  includeLocation: true
};

// ANSI color codes for terminal output
const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  
  // Level-specific colors
  trace: '\x1b[36m', // cyan
  debug: '\x1b[34m', // blue
  info: '\x1b[32m',  // green
  warn: '\x1b[33m',  // yellow
  error: '\x1b[31m', // red
  fatal: '\x1b[35m'  // magenta
};

// Current configuration - initialized with defaults
let config = { ...DEFAULT_CONFIG };

// File stream for logging
let fileStream = null;

/**
 * Initialize the logger with provided configuration
 * @param {Object} customConfig - Logger configuration
 */
function configure(customConfig = {}) {
  // Merge custom config with defaults
  config = { ...DEFAULT_CONFIG, ...customConfig };
  
  // Validate log level
  if (!LOG_LEVELS.hasOwnProperty(config.level)) {
    console.warn(`Invalid log level: ${config.level}. Defaulting to 'info'.`);
    config.level = 'info';
  }
  
  // Set up file logging if enabled
  if (config.enableFile) {
    setupFileLogging();
  } else if (fileStream) {
    // Close existing file stream if disabling file logging
    fileStream.end();
    fileStream = null;
  }
  
  // Log configuration at startup
  log('info', 'Logger initialized', { config });
}

/**
 * Set up file logging with rotation
 */
function setupFileLogging() {
  try {
    // Create log directory if it doesn't exist
    const logDir = path.resolve(config.logDir);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    
    // Close existing stream if any
    if (fileStream) {
      fileStream.end();
    }
    
    // Create a new write stream
    const logFilePath = path.join(logDir, config.logFilename);
    fileStream = fs.createWriteStream(logFilePath, { flags: 'a' });
    
    fileStream.on('error', (err) => {
      console.error(`Error with log file: ${err.message}`);
      config.enableFile = false;
    });
    
    // Check file size and rotate if needed
    checkAndRotateLogFile(logFilePath);
  } catch (error) {
    console.error(`Failed to set up file logging: ${error.message}`);
    config.enableFile = false;
  }
}

/**
 * Check log file size and rotate if it exceeds the maximum size
 * @param {string} logFilePath - Path to the log file
 */
function checkAndRotateLogFile(logFilePath) {
  try {
    if (!fs.existsSync(logFilePath)) return;
    
    const stats = fs.statSync(logFilePath);
    if (stats.size < config.maxFileSize) return;
    
    // Close current stream
    if (fileStream) {
      fileStream.end();
    }
    
    // Rotate log files
    for (let i = config.maxFiles - 1; i > 0; i--) {
      const oldFile = `${logFilePath}.${i}`;
      const newFile = `${logFilePath}.${i + 1}`;
      
      if (fs.existsSync(oldFile)) {
        if (i === config.maxFiles - 1) {
          // Delete oldest log file
          fs.unlinkSync(oldFile);
        } else {
          // Rename file to increment index
          fs.renameSync(oldFile, newFile);
        }
      }
    }
    
    // Rename current log to .1
    fs.renameSync(logFilePath, `${logFilePath}.1`);
    
    // Create a new stream for the new log file
    fileStream = fs.createWriteStream(logFilePath, { flags: 'a' });
  } catch (error) {
    console.error(`Error rotating log files: ${error.message}`);
  }
}

/**
 * Format a log message
 * @param {string} level - Log level
 * @param {string} message - Log message
 * @param {Object} metadata - Additional metadata
 * @returns {string} Formatted log message
 */
function formatLogMessage(level, message, metadata = {}) {
  const timestamp = config.timestamp ? new Date().toISOString() : '';
  
  // Get caller information if enabled
  let location = '';
  if (config.includeLocation) {
    const stack = new Error().stack.split('\n');
    // Find the first call that's not from the logger
    let callerLine = '';
    for (let i = 3; i < stack.length; i++) {
      if (!stack[i].includes('logger.js')) {
        callerLine = stack[i].trim();
        break;
      }
    }
    
    // Extract filename and line number from the stack trace
    const matches = callerLine.match(/at\s+(.+?)\s+\((.+?):(\d+):(\d+)\)/);
    if (matches) {
      const [, caller, filename, line, column] = matches;
      location = `${path.basename(filename)}:${line}`;
    } else {
      // Alternative format for anonymouns functions or other patterns
      const altMatches = callerLine.match(/at\s+(.+?):(\d+):(\d+)/);
      if (altMatches) {
        const [, filename, line, column] = altMatches;
        location = `${path.basename(filename)}:${line}`;
      }
    }
  }
  
  if (config.format === 'json') {
    // JSON format
    return JSON.stringify({
      timestamp,
      level,
      message,
      location,
      ...metadata
    });
  } else {
    // Text format
    let formatted = '';
    
    if (timestamp) {
      formatted += `[${timestamp}] `;
    }
    
    formatted += `[${level.toUpperCase()}] `;
    
    if (location) {
      formatted += `[${location}] `;
    }
    
    formatted += message;
    
    // Add metadata if present
    if (Object.keys(metadata).length > 0) {
      formatted += ` ${util.inspect(metadata, { depth: 3, colors: false, compact: true })}`;
    }
    
    return formatted;
  }
}

/**
 * Add color to a log message for console output
 * @param {string} level - Log level
 * @param {string} message - Log message
 * @returns {string} Colorized message
 */
function colorize(level, message) {
  if (!config.colorize) return message;
  
  const levelColor = COLORS[level] || COLORS.reset;
  return `${levelColor}${message}${COLORS.reset}`;
}

/**
 * Write log message to outputs (console and/or file)
 * @param {string} level - Log level
 * @param {string} message - Log message
 * @param {Object} metadata - Additional metadata
 */
function log(level, message, metadata = {}) {
  // Skip if log level is too low
  if (LOG_LEVELS[level] < LOG_LEVELS[config.level]) {
    return;
  }
  
  const formatted = formatLogMessage(level, message, metadata);
  
  // Write to console if enabled
  if (config.enableConsole) {
    if (level === 'error' || level === 'fatal') {
      console.error(colorize(level, formatted));
    } else if (level === 'warn') {
      console.warn(colorize(level, formatted));
    } else if (level === 'debug' || level === 'trace') {
      console.debug(colorize(level, formatted));
    } else {
      console.log(colorize(level, formatted));
    }
  }
  
  // Write to file if enabled
  if (config.enableFile && fileStream) {
    fileStream.write(formatted + '\n');
    
    // Check and rotate log file if needed
    try {
      const logFilePath = path.join(path.resolve(config.logDir), config.logFilename);
      checkAndRotateLogFile(logFilePath);
    } catch (error) {
      console.error(`Error checking log file size: ${error.message}`);
    }
  }
}

// Initialize logger
configure();

// Export logger methods
module.exports = {
  configure,
  trace: (message, metadata) => log('trace', message, metadata),
  debug: (message, metadata) => log('debug', message, metadata),
  info: (message, metadata) => log('info', message, metadata),
  warn: (message, metadata) => log('warn', message, metadata),
  error: (message, metadata) => log('error', message, metadata),
  fatal: (message, metadata) => log('fatal', message, metadata)
};
