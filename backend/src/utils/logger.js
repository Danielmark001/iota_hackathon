/**
 * Logger Utility
 * 
 * Configures Winston logger for the application
 */

const winston = require('winston');
const { format, transports, createLogger } = winston;
const path = require('path');
const fs = require('fs');
const config = require('../config');

// Ensure logs directory exists
const logDir = path.dirname(config.logging.file);
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Define custom format with colors for console
const consoleFormat = format.combine(
  format.colorize(),
  format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  format.printf(({ level, message, timestamp, ...meta }) => {
    const metaString = Object.keys(meta).length
      ? JSON.stringify(meta, null, 2)
      : '';
    return `${timestamp} ${level}: ${message} ${metaString}`;
  })
);

// Define format for file logs
const fileFormat = format.combine(
  format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  format.uncolorize(),
  format.json()
);

// Create logger instance
const logger = createLogger({
  level: config.logging.level,
  format: fileFormat,
  defaultMeta: { service: 'intellilend-api' },
  transports: [
    // Console transport
    new transports.Console({
      format: consoleFormat
    }),
    
    // File transport
    new transports.File({
      filename: config.logging.file,
      maxsize: config.logging.maxSize,
      maxFiles: config.logging.maxFiles,
      tailable: true
    }),
    
    // Error file transport
    new transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
      maxsize: config.logging.maxSize,
      maxFiles: config.logging.maxFiles,
      tailable: true
    })
  ],
  exitOnError: false
});

// Create a stream object for Morgan
logger.stream = {
  write: (message) => {
    logger.info(message.trim());
  }
};

// Add methods for common log levels
const logLevels = ['error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly'];

// Add methods to log with metadata
logLevels.forEach((level) => {
  const originalMethod = logger[level];
  logger[level] = (message, meta = {}) => {
    if (typeof message === 'object') {
      meta = { ...message, ...meta };
      message = meta.message || JSON.stringify(message);
      delete meta.message;
    }
    return originalMethod.call(logger, message, meta);
  };
});

module.exports = logger;
