/**
 * Circuit Breaker Pattern Implementation
 * 
 * This module provides a circuit breaker implementation to prevent
 * cascading failures and provide fallback mechanisms.
 */

const logger = require('./logger');

/**
 * States for the Circuit Breaker
 */
const CircuitState = {
  CLOSED: 'closed',   // Normal operation, requests go through
  OPEN: 'open',       // Circuit is open, requests fail fast
  HALF_OPEN: 'half-open' // Testing if service is back, allowing limited requests
};

/**
 * Circuit Breaker implementation
 */
class CircuitBreaker {
  /**
   * Create a new circuit breaker
   * @param {Object} options - Circuit breaker options
   * @param {number} options.failureThreshold - Number of failures before opening circuit
   * @param {number} options.resetTimeout - Time in ms to wait before trying to half-open
   * @param {number} options.halfOpenSuccessThreshold - Number of successes needed to close circuit
   * @param {Function} options.fallbackFunction - Function to call when circuit is open
   */
  constructor(options = {}) {
    this.failureThreshold = options.failureThreshold || 5;
    this.resetTimeout = options.resetTimeout || 30000; // 30 seconds
    this.halfOpenSuccessThreshold = options.halfOpenSuccessThreshold || 2;
    this.fallbackFunction = options.fallbackFunction;
    
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;
    this.nextAttemptTime = null;
    
    // Track statistics
    this.stats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      rejectedRequests: 0,
      lastStateChange: new Date()
    };
    
    logger.info(`Circuit breaker initialized with threshold: ${this.failureThreshold}, resetTimeout: ${this.resetTimeout}ms`);
  }
  
  /**
   * Reset the circuit breaker to closed state
   */
  reset() {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;
    this.nextAttemptTime = null;
    this.stats.lastStateChange = new Date();
    logger.info('Circuit breaker reset to CLOSED state');
  }
  
  /**
   * Execute a function with circuit breaker protection
   * @param {Function} fn - Function to execute
   * @param {any[]} args - Arguments to pass to the function
   * @returns {Promise<any>} - Result of the function
   */
  async execute(fn, ...args) {
    this.stats.totalRequests++;
    
    // Check if circuit is open
    if (this.state === CircuitState.OPEN) {
      // Check if it's time to try again
      if (this.nextAttemptTime && Date.now() >= this.nextAttemptTime) {
        this.transitionToHalfOpen();
      } else {
        // Circuit is open, fail fast
        this.stats.rejectedRequests++;
        logger.warn('Circuit is OPEN, rejecting request');
        
        // Use fallback if provided
        if (typeof this.fallbackFunction === 'function') {
          logger.info('Using fallback function');
          return this.fallbackFunction(...args);
        }
        
        throw new Error('Circuit is open, request rejected');
      }
    }
    
    try {
      // Execute the function
      const result = await fn(...args);
      
      // Success, maybe close the circuit
      this.handleSuccess();
      this.stats.successfulRequests++;
      return result;
    } catch (error) {
      // Handle failure
      this.handleFailure(error);
      this.stats.failedRequests++;
      throw error;
    }
  }
  
  /**
   * Handle a successful operation
   */
  handleSuccess() {
    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;
      
      // If enough consecutive successes, close the circuit
      if (this.successCount >= this.halfOpenSuccessThreshold) {
        this.transitionToClosed();
      }
    } else if (this.state === CircuitState.CLOSED) {
      // Reset failure count on success in closed state
      this.failureCount = 0;
    }
  }
  
  /**
   * Handle a failed operation
   * @param {Error} error - The error that occurred
   */
  handleFailure(error) {
    this.lastFailureTime = Date.now();
    
    if (this.state === CircuitState.CLOSED) {
      this.failureCount++;
      
      // If too many failures, open the circuit
      if (this.failureCount >= this.failureThreshold) {
        this.transitionToOpen();
      }
    } else if (this.state === CircuitState.HALF_OPEN) {
      // Any failure in half-open state opens the circuit again
      this.transitionToOpen();
    }
    
    logger.error(`Circuit breaker failure (${this.failureCount}/${this.failureThreshold}): ${error.message}`);
  }
  
  /**
   * Transition to OPEN state
   */
  transitionToOpen() {
    logger.warn(`Circuit breaker state changing from ${this.state} to OPEN`);
    this.state = CircuitState.OPEN;
    this.nextAttemptTime = Date.now() + this.resetTimeout;
    this.stats.lastStateChange = new Date();
    
    // Log detailed information
    logger.warn(`Circuit will try again at: ${new Date(this.nextAttemptTime).toISOString()}`);
    logger.warn(`Circuit open due to ${this.failureCount} consecutive failures`);
  }
  
  /**
   * Transition to HALF_OPEN state
   */
  transitionToHalfOpen() {
    logger.info(`Circuit breaker state changing from ${this.state} to HALF_OPEN`);
    this.state = CircuitState.HALF_OPEN;
    this.successCount = 0;
    this.stats.lastStateChange = new Date();
  }
  
  /**
   * Transition to CLOSED state
   */
  transitionToClosed() {
    logger.info(`Circuit breaker state changing from ${this.state} to CLOSED`);
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.stats.lastStateChange = new Date();
  }
  
  /**
   * Get current circuit breaker state
   * @returns {string} The current state
   */
  getState() {
    return this.state;
  }
  
  /**
   * Get statistics about the circuit breaker
   * @returns {Object} Circuit breaker statistics
   */
  getStats() {
    return {
      ...this.stats,
      currentState: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime ? new Date(this.lastFailureTime) : null,
      nextAttemptTime: this.nextAttemptTime ? new Date(this.nextAttemptTime) : null,
      timeInCurrentState: new Date() - this.stats.lastStateChange
    };
  }
}

module.exports = {
  CircuitBreaker,
  CircuitState
};
