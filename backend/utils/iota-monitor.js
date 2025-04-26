/**
 * IOTA Network Monitoring Service
 * 
 * This service provides continuous monitoring of IOTA network nodes
 * with alerting capabilities for network degradation.
 */

const logger = require('./logger');
const { withExponentialBackoff } = require('../../iota-sdk/client');
const EventEmitter = require('events');

class IotaMonitor extends EventEmitter {
  /**
   * Initialize IOTA Monitor
   * @param {Object} client - IOTA client 
   * @param {Object} nodeManager - Node manager from client.js
   * @param {Object} options - Monitor options
   */
  constructor(client, nodeManager, options = {}) {
    super();
    this.client = client;
    this.nodeManager = nodeManager;
    this.options = {
      checkInterval: options.checkInterval || 60000, // Check every minute
      healthThreshold: options.healthThreshold || 0.7, // 70% of nodes should be healthy
      alertThreshold: options.alertThreshold || 0.5, // Alert if less than 50% are healthy
      criticalThreshold: options.criticalThreshold || 0.3, // Critical if less than 30% are healthy
      performanceThreshold: options.performanceThreshold || 2000, // Slow node response time (ms)
      nodeStatusHistory: options.nodeHistorySize || 100, // Keep history of last 100 checks
      autoRecover: options.autoRecover !== false, // Try to recover unhealthy nodes
      ...options
    };
    
    this.status = {
      overall: 'unknown',
      healthyNodeCount: 0,
      totalNodeCount: 0,
      healthyPercentage: 0,
      lastCheck: null,
      avgResponseTime: 0,
      alerts: []
    };
    
    this.history = [];
    this.isRunning = false;
    this.checkInterval = null;
    this.alertCallbacks = new Map();
    
    logger.info('IOTA Monitor initialized');
  }
  
  /**
   * Start monitoring
   * @returns {Promise<boolean>} Success status
   */
  async start() {
    if (this.isRunning) {
      logger.warn('IOTA Monitor is already running');
      return true;
    }
    
    if (!this.client || !this.nodeManager) {
      logger.error('IOTA client or node manager not provided');
      return false;
    }
    
    logger.info('Starting IOTA Monitor');
    this.isRunning = true;
    
    // Perform initial check
    await this.checkNodeHealth();
    
    // Set up interval for regular checks
    this.checkInterval = setInterval(() => {
      this.checkNodeHealth().catch(error => {
        logger.error(`Error checking node health: ${error.message}`);
      });
    }, this.options.checkInterval);
    
    // Register event listeners
    this.on('alert', (alert) => {
      logger.warn(`IOTA Network Alert: ${alert.level} - ${alert.message}`);
      this.status.alerts.push(alert);
      
      // Keep only last 10 alerts
      if (this.status.alerts.length > 10) {
        this.status.alerts.shift();
      }
      
      // Notify alert callbacks
      if (this.alertCallbacks.has(alert.level)) {
        const callbacks = this.alertCallbacks.get(alert.level);
        callbacks.forEach(callback => callback(alert));
      }
    });
    
    this.emit('started');
    return true;
  }
  
  /**
   * Stop monitoring
   */
  stop() {
    if (!this.isRunning) {
      return;
    }
    
    logger.info('Stopping IOTA Monitor');
    this.isRunning = false;
    
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    
    this.emit('stopped');
  }
  
  /**
   * Register alert callback
   * @param {string} level - Alert level (info, warning, error, critical)
   * @param {Function} callback - Callback function
   * @returns {string} Callback ID
   */
  onAlert(level, callback) {
    const callbackId = `alert-${level}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    
    if (!this.alertCallbacks.has(level)) {
      this.alertCallbacks.set(level, new Map());
    }
    
    const callbacks = this.alertCallbacks.get(level);
    callbacks.set(callbackId, callback);
    
    return callbackId;
  }
  
  /**
   * Remove alert callback
   * @param {string} callbackId - Callback ID
   * @returns {boolean} Success status
   */
  removeAlertCallback(callbackId) {
    for (const [level, callbacks] of this.alertCallbacks.entries()) {
      if (callbacks.has(callbackId)) {
        callbacks.delete(callbackId);
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * Check node health
   * @returns {Promise<Object>} Health status
   */
  async checkNodeHealth() {
    try {
      await withExponentialBackoff(async () => {
        logger.debug('Checking IOTA node health');
        
        // Get all nodes from node manager
        const nodes = this.nodeManager.nodes || [];
        const totalNodes = nodes.length;
        
        if (totalNodes === 0) {
          throw new Error('No IOTA nodes configured');
        }
        
        // Check if nodeManager has updated node health
        const healthyNodes = nodes.filter(node => node.healthy);
        const healthyCount = healthyNodes.length;
        const healthyPercentage = healthyCount / totalNodes;
        
        // Calculate average response time
        const responseTimes = nodes
          .filter(node => node.responseTime > 0)
          .map(node => node.responseTime);
        
        const avgResponseTime = responseTimes.length > 0
          ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length
          : null;
        
        // Determine overall status
        let overallStatus = 'unknown';
        if (healthyPercentage >= this.options.healthThreshold) {
          overallStatus = 'healthy';
        } else if (healthyPercentage >= this.options.alertThreshold) {
          overallStatus = 'degraded';
        } else if (healthyPercentage >= this.options.criticalThreshold) {
          overallStatus = 'poor';
        } else {
          overallStatus = 'critical';
        }
        
        // Update status
        const previousStatus = this.status.overall;
        this.status = {
          overall: overallStatus,
          healthyNodeCount: healthyCount,
          totalNodeCount: totalNodes,
          healthyPercentage,
          lastCheck: new Date(),
          avgResponseTime,
          alerts: this.status.alerts || []
        };
        
        // Add to history
        this.history.push({
          timestamp: new Date(),
          overall: overallStatus,
          healthyCount,
          totalNodes,
          healthyPercentage,
          avgResponseTime
        });
        
        // Keep history size limited
        if (this.history.length > this.options.nodeStatusHistory) {
          this.history.shift();
        }
        
        // Handle status changes and alerts
        this.handleStatusChanges(previousStatus, overallStatus);
        
        // Auto-recovery actions
        if (this.options.autoRecover && overallStatus !== 'healthy') {
          this.recoverNodes();
        }
        
        return this.status;
      });
    } catch (error) {
      logger.error(`Error checking node health: ${error.message}`);
      
      // Set critical status
      this.status.overall = 'error';
      this.status.lastCheck = new Date();
      
      // Emit alert
      this.emit('alert', {
        level: 'critical',
        message: `Error checking node health: ${error.message}`,
        timestamp: new Date(),
        details: { error: error.message }
      });
      
      throw error;
    }
  }
  
  /**
   * Handle status changes and emit alerts
   * @param {string} previousStatus - Previous overall status
   * @param {string} currentStatus - Current overall status
   */
  handleStatusChanges(previousStatus, currentStatus) {
    // Skip if status hasn't changed
    if (previousStatus === currentStatus) {
      return;
    }
    
    // Determine if status improved or degraded
    const statusLevels = {
      'healthy': 4,
      'degraded': 3,
      'poor': 2,
      'critical': 1,
      'error': 0,
      'unknown': -1
    };
    
    const improved = statusLevels[currentStatus] > statusLevels[previousStatus];
    
    // Emit status change event
    this.emit('statusChange', {
      previous: previousStatus,
      current: currentStatus,
      improved,
      timestamp: new Date()
    });
    
    // Emit alerts based on current status
    if (currentStatus === 'critical') {
      this.emit('alert', {
        level: 'critical',
        message: 'IOTA network in critical state - immediate action required',
        timestamp: new Date(),
        details: this.status
      });
    } else if (currentStatus === 'poor') {
      this.emit('alert', {
        level: 'error',
        message: 'IOTA network health is poor - action needed',
        timestamp: new Date(),
        details: this.status
      });
    } else if (currentStatus === 'degraded') {
      this.emit('alert', {
        level: 'warning',
        message: 'IOTA network is degraded - monitoring recommended',
        timestamp: new Date(),
        details: this.status
      });
    } else if (currentStatus === 'healthy' && previousStatus !== 'unknown') {
      this.emit('alert', {
        level: 'info',
        message: 'IOTA network has recovered to healthy state',
        timestamp: new Date(),
        details: this.status
      });
    }
    
    // Also check response time
    if (this.status.avgResponseTime > this.options.performanceThreshold) {
      this.emit('alert', {
        level: 'warning',
        message: `IOTA network response time is slow: ${this.status.avgResponseTime.toFixed(0)}ms`,
        timestamp: new Date(),
        details: { 
          avgResponseTime: this.status.avgResponseTime,
          threshold: this.options.performanceThreshold
        }
      });
    }
  }
  
  /**
   * Try to recover unhealthy nodes
   * @returns {Promise<Object>} Recovery results
   */
  async recoverNodes() {
    try {
      logger.info('Attempting to recover unhealthy IOTA nodes');
      
      // Get unhealthy nodes
      const nodes = this.nodeManager.nodes || [];
      const unhealthyNodes = nodes.filter(node => !node.healthy);
      
      if (unhealthyNodes.length === 0) {
        return { recovered: 0, total: 0 };
      }
      
      let recoveredCount = 0;
      
      // Try to reconnect to each unhealthy node
      for (const node of unhealthyNodes) {
        try {
          // Create a temporary client to try connection
          const tempClient = new (this.client.constructor)({
            nodes: [node.url]
          });
          
          // Try to get info
          await tempClient.getInfo();
          
          // If successful, mark node as potentially healthy
          node.failureCount = Math.max(0, node.failureCount - 1);
          if (node.failureCount < this.nodeManager.options?.nodeUnhealthyThreshold || 3) {
            node.healthy = true;
            node.lastCheckTime = Date.now();
            recoveredCount++;
          }
        } catch (error) {
          logger.debug(`Failed to recover node ${node.url}: ${error.message}`);
          // Skip to next node
        }
      }
      
      if (recoveredCount > 0) {
        logger.info(`Recovered ${recoveredCount} of ${unhealthyNodes.length} unhealthy nodes`);
        
        // Emit recovery event
        this.emit('nodeRecovery', {
          recovered: recoveredCount,
          total: unhealthyNodes.length,
          timestamp: new Date()
        });
      }
      
      return {
        recovered: recoveredCount,
        total: unhealthyNodes.length
      };
    } catch (error) {
      logger.error(`Error recovering nodes: ${error.message}`);
      return {
        recovered: 0,
        total: 0,
        error: error.message
      };
    }
  }
  
  /**
   * Get current status
   * @returns {Object} Current status
   */
  getStatus() {
    return {
      ...this.status,
      isRunning: this.isRunning
    };
  }
  
  /**
   * Get status history
   * @param {number} limit - Maximum number of history entries
   * @returns {Array} Status history
   */
  getHistory(limit = 0) {
    if (limit <= 0 || limit >= this.history.length) {
      return [...this.history];
    }
    
    return this.history.slice(-limit);
  }
}

module.exports = IotaMonitor;
