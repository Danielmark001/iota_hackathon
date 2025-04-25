/**
 * Automated Liquidation Service for IntelliLend
 * 
 * This service monitors collateral ratios in real-time and triggers liquidations
 * when thresholds are crossed. It includes Dutch auction mechanisms for liquidated
 * collateral and flash loan protection features.
 */

const { ethers } = require('ethers');
const { EventEmitter } = require('events');
const { submitBlock } = require('../../iota-sdk/client');
const logger = require('../../iota-sdk/utils/logger');

// Load contract ABIs
const LendingPoolABI = require('../../abis/LendingPool.json');
const LiquidationAuctionABI = require('../../abis/LiquidationAuction.json');
const FlashLoanProtectionABI = require('../../abis/FlashLoanProtection.json');

class LiquidationService extends EventEmitter {
  /**
   * Initialize the liquidation service
   * @param {Object} config - Configuration options
   * @param {string} config.provider - Ethereum provider URL
   * @param {string} config.lendingPoolAddress - Address of the LendingPool contract
   * @param {string} config.liquidationAuctionAddress - Address of the LiquidationAuction contract
   * @param {string} config.flashLoanProtectionAddress - Address of the FlashLoanProtection contract
   * @param {number} config.checkIntervalMs - Interval for collateral checks in milliseconds (default: 60000)
   * @param {number} config.liquidationThreshold - Collateral ratio that triggers liquidation (default: 1.1)
   * @param {number} config.warningThreshold - Collateral ratio that triggers warnings (default: 1.25)
   * @param {Object} iotaClient - IOTA client instance
   * @param {Object} iotaAccount - IOTA account instance (optional)
   */
  constructor(config, iotaClient, iotaAccount = null) {
    super();
    
    this.config = {
      checkIntervalMs: 60000, // 1 minute
      liquidationThreshold: 1.1, // 110%
      warningThreshold: 1.25, // 125%
      ...config
    };
    
    this.iotaClient = iotaClient;
    this.iotaAccount = iotaAccount;
    
    // Set up provider
    this.provider = new ethers.providers.JsonRpcProvider(config.provider);
    
    // Initialize contract interfaces
    if (config.lendingPoolAddress) {
      this.lendingPool = new ethers.Contract(
        config.lendingPoolAddress,
        LendingPoolABI,
        this.provider
      );
    } else {
      throw new Error('LendingPool address is required');
    }
    
    if (config.liquidationAuctionAddress) {
      this.liquidationAuction = new ethers.Contract(
        config.liquidationAuctionAddress,
        LiquidationAuctionABI,
        this.provider
      );
    } else {
      logger.warn('LiquidationAuction address not provided - auction functionality will be disabled');
    }
    
    if (config.flashLoanProtectionAddress) {
      this.flashLoanProtection = new ethers.Contract(
        config.flashLoanProtectionAddress,
        FlashLoanProtectionABI,
        this.provider
      );
    } else {
      logger.warn('FlashLoanProtection address not provided - protection functionality will be disabled');
    }
    
    // State tracking
    this.isRunning = false;
    this.monitoringInterval = null;
    this.borrowersAtRisk = new Map();
    this.pendingLiquidations = new Map();
    this.activeAuctions = new Map();
    
    logger.info('Liquidation service initialized');
  }
  
  /**
   * Set wallet for transaction signing
   * @param {string} privateKey - Private key for the signing wallet
   */
  setWallet(privateKey) {
    this.wallet = new ethers.Wallet(privateKey, this.provider);
    
    // Connect contracts
    this.lendingPool = this.lendingPool.connect(this.wallet);
    
    if (this.liquidationAuction) {
      this.liquidationAuction = this.liquidationAuction.connect(this.wallet);
    }
    
    if (this.flashLoanProtection) {
      this.flashLoanProtection = this.flashLoanProtection.connect(this.wallet);
    }
    
    logger.info('Wallet connected to liquidation service');
  }
  
  /**
   * Start the liquidation monitoring service
   * @returns {Promise<boolean>} Success status
   */
  async start() {
    try {
      if (this.isRunning) {
        logger.warn('Liquidation service is already running');
        return true;
      }
      
      logger.info('Starting liquidation monitoring service');
      
      // Set up event listeners for on-chain events
      this.setupEventListeners();
      
      // Run initial check
      await this.checkAllBorrowersHealth();
      
      // Start monitoring interval
      this.monitoringInterval = setInterval(
        () => this.checkAllBorrowersHealth().catch(
          err => logger.error(`Error in scheduled health check: ${err.message}`)
        ),
        this.config.checkIntervalMs
      );
      
      this.isRunning = true;
      this.emit('started');
      
      logger.info('Liquidation monitoring service started');
      return true;
    }
    catch (error) {
      logger.error(`Error starting liquidation service: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Stop the liquidation monitoring service
   * @returns {boolean} Success status
   */
  stop() {
    try {
      if (!this.isRunning) {
        logger.warn('Liquidation service is not running');
        return true;
      }
      
      logger.info('Stopping liquidation monitoring service');
      
      // Clear monitoring interval
      if (this.monitoringInterval) {
        clearInterval(this.monitoringInterval);
        this.monitoringInterval = null;
      }
      
      // Remove event listeners
      this.removeAllListeners();
      
      this.isRunning = false;
      this.emit('stopped');
      
      logger.info('Liquidation monitoring service stopped');
      return true;
    }
    catch (error) {
      logger.error(`Error stopping liquidation service: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Set up event listeners for on-chain events
   */
  setupEventListeners() {
    try {
      logger.info('Setting up event listeners');
      
      // LendingPool events
      this.lendingPool.on('Borrow', (borrower, amount, event) => {
        logger.info(`Borrow event detected for ${borrower}`);
        // Check borrower health on new borrows
        this.checkBorrowerHealth(borrower).catch(
          err => logger.error(`Error checking borrower health after borrow: ${err.message}`)
        );
      });
      
      this.lendingPool.on('Repay', (borrower, amount, event) => {
        logger.info(`Repay event detected for ${borrower}`);
        // Check if borrower was at risk and update status
        if (this.borrowersAtRisk.has(borrower)) {
          this.checkBorrowerHealth(borrower).catch(
            err => logger.error(`Error checking borrower health after repay: ${err.message}`)
          );
        }
      });
      
      this.lendingPool.on('CollateralAdded', (borrower, amount, event) => {
        logger.info(`CollateralAdded event detected for ${borrower}`);
        // Check if borrower was at risk and update status
        if (this.borrowersAtRisk.has(borrower)) {
          this.checkBorrowerHealth(borrower).catch(
            err => logger.error(`Error checking borrower health after collateral added: ${err.message}`)
          );
        }
      });
      
      this.lendingPool.on('CollateralRemoved', (borrower, amount, event) => {
        logger.info(`CollateralRemoved event detected for ${borrower}`);
        // Check borrower health on collateral removals
        this.checkBorrowerHealth(borrower).catch(
          err => logger.error(`Error checking borrower health after collateral removed: ${err.message}`)
        );
      });
      
      // LiquidationAuction events
      if (this.liquidationAuction) {
        this.liquidationAuction.on('AuctionStarted', (auctionId, borrower, collateralAmount, event) => {
          logger.info(`Auction started for ${borrower} with ID ${auctionId}`);
          // Track the auction
          this.activeAuctions.set(auctionId.toString(), {
            borrower,
            collateralAmount: ethers.utils.formatEther(collateralAmount),
            startTime: Date.now(),
            status: 'active'
          });
          
          // Record auction on Tangle
          this.recordAuctionToTangle('AUCTION_STARTED', {
            auctionId: auctionId.toString(),
            borrower,
            collateralAmount: ethers.utils.formatEther(collateralAmount),
            startTime: new Date().toISOString()
          }).catch(
            err => logger.error(`Error recording auction to Tangle: ${err.message}`)
          );
        });
        
        this.liquidationAuction.on('AuctionEnded', (auctionId, winner, finalPrice, event) => {
          logger.info(`Auction ended for ID ${auctionId}`);
          // Update auction status
          const auction = this.activeAuctions.get(auctionId.toString());
          if (auction) {
            auction.status = 'completed';
            auction.winner = winner;
            auction.finalPrice = ethers.utils.formatEther(finalPrice);
            auction.endTime = Date.now();
            
            // Record auction result on Tangle
            this.recordAuctionToTangle('AUCTION_ENDED', {
              auctionId: auctionId.toString(),
              borrower: auction.borrower,
              winner,
              finalPrice: ethers.utils.formatEther(finalPrice),
              endTime: new Date().toISOString()
            }).catch(
              err => logger.error(`Error recording auction result to Tangle: ${err.message}`)
            );
            
            // Remove from active auctions after a delay
            setTimeout(() => {
              this.activeAuctions.delete(auctionId.toString());
            }, 3600000); // 1 hour
          }
        });
      }
      
      // FlashLoanProtection events
      if (this.flashLoanProtection) {
        this.flashLoanProtection.on('ProtectionActivated', (borrower, protectionId, amount, event) => {
          logger.info(`Protection activated for ${borrower} with ID ${protectionId}`);
          // Record protection on Tangle
          this.recordProtectionToTangle('PROTECTION_ACTIVATED', {
            protectionId: protectionId.toString(),
            borrower,
            amount: ethers.utils.formatEther(amount),
            activationTime: new Date().toISOString()
          }).catch(
            err => logger.error(`Error recording protection to Tangle: ${err.message}`)
          );
        });
      }
      
      logger.info('Event listeners set up successfully');
    }
    catch (error) {
      logger.error(`Error setting up event listeners: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Check the health of all borrowers
   * @returns {Promise<Object>} Results of the health check
   */
  async checkAllBorrowersHealth() {
    try {
      logger.info('Checking health of all borrowers');
      
      // Get list of all borrowers from the lending pool
      const borrowers = await this.getBorrowers();
      
      logger.info(`Retrieved ${borrowers.length} borrowers`);
      
      // Check each borrower's health
      const results = {
        total: borrowers.length,
        healthy: 0,
        atRisk: 0,
        liquidatable: 0,
        errors: 0
      };
      
      for (const borrower of borrowers) {
        try {
          const healthCheck = await this.checkBorrowerHealth(borrower);
          
          if (healthCheck.isLiquidatable) {
            results.liquidatable++;
          } else if (healthCheck.isAtRisk) {
            results.atRisk++;
          } else {
            results.healthy++;
          }
        } catch (error) {
          logger.error(`Error checking health for ${borrower}: ${error.message}`);
          results.errors++;
        }
      }
      
      logger.info(`Health check complete: ${results.healthy} healthy, ${results.atRisk} at risk, ${results.liquidatable} liquidatable`);
      
      return results;
    }
    catch (error) {
      logger.error(`Error checking borrowers health: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Get list of borrowers from the lending pool
   * @returns {Promise<Array>} List of borrower addresses
   */
  async getBorrowers() {
    try {
      // This implementation depends on the contract structure
      // For this example, we'll assume there's a getBorrowers function
      // In a real implementation, you might need to fetch this from events or state
      
      const filter = this.lendingPool.filters.Borrow();
      const events = await this.lendingPool.queryFilter(filter);
      
      // Extract unique borrower addresses
      const borrowers = [...new Set(events.map(event => event.args.borrower))];
      
      return borrowers;
    }
    catch (error) {
      logger.error(`Error getting borrowers: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Check the health of a specific borrower
   * @param {string} borrower - Borrower's address
   * @returns {Promise<Object>} Health check result
   */
  async checkBorrowerHealth(borrower) {
    try {
      logger.info(`Checking health for borrower: ${borrower}`);
      
      // Get borrower data from lending pool
      const [borrows, collateral] = await Promise.all([
        this.lendingPool.borrows(borrower),
        this.lendingPool.collaterals(borrower)
      ]);
      
      // Convert to numbers
      const borrowsValue = parseFloat(ethers.utils.formatEther(borrows));
      const collateralValue = parseFloat(ethers.utils.formatEther(collateral));
      
      // If no borrows, the borrower is healthy
      if (borrowsValue === 0) {
        logger.info(`Borrower ${borrower} has no outstanding loans`);
        
        // If was at risk before, remove from at-risk list
        if (this.borrowersAtRisk.has(borrower)) {
          this.borrowersAtRisk.delete(borrower);
          this.emit('borrowerHealthRestored', borrower);
        }
        
        return {
          borrower,
          isHealthy: true,
          isAtRisk: false,
          isLiquidatable: false,
          collateralRatio: Infinity,
          borrowsValue,
          collateralValue
        };
      }
      
      // Calculate collateral ratio
      const collateralRatio = collateralValue / borrowsValue;
      
      // Determine if at risk or liquidatable
      const isLiquidatable = collateralRatio < this.config.liquidationThreshold;
      const isAtRisk = collateralRatio < this.config.warningThreshold;
      
      logger.info(`Borrower ${borrower} health: ${isLiquidatable ? 'LIQUIDATABLE' : isAtRisk ? 'AT RISK' : 'HEALTHY'}, ratio: ${collateralRatio.toFixed(2)}`);
      
      // Handle status changes
      if (isLiquidatable) {
        if (!this.pendingLiquidations.has(borrower)) {
          logger.warn(`Borrower ${borrower} is now liquidatable with collateral ratio ${collateralRatio.toFixed(2)}`);
          
          // Move to liquidatable state
          this.borrowersAtRisk.delete(borrower);
          this.pendingLiquidations.set(borrower, {
            timestamp: Date.now(),
            collateralRatio,
            borrowsValue,
            collateralValue
          });
          
          // Trigger liquidation process
          this.triggerLiquidation(borrower, borrowsValue, collateralValue, collateralRatio);
          
          this.emit('borrowerLiquidatable', borrower, collateralRatio);
        }
      } else if (isAtRisk) {
        if (!this.borrowersAtRisk.has(borrower) && !this.pendingLiquidations.has(borrower)) {
          logger.warn(`Borrower ${borrower} is now at risk with collateral ratio ${collateralRatio.toFixed(2)}`);
          
          // Add to at-risk list
          this.borrowersAtRisk.set(borrower, {
            timestamp: Date.now(),
            collateralRatio,
            borrowsValue,
            collateralValue
          });
          
          // Send warning notification
          this.sendRiskWarning(borrower, collateralRatio);
          
          this.emit('borrowerAtRisk', borrower, collateralRatio);
        } else if (this.borrowersAtRisk.has(borrower)) {
          // Update at-risk data
          this.borrowersAtRisk.set(borrower, {
            timestamp: Date.now(),
            collateralRatio,
            borrowsValue,
            collateralValue
          });
        }
      } else {
        // If was at risk before, remove from at-risk list
        if (this.borrowersAtRisk.has(borrower)) {
          logger.info(`Borrower ${borrower} is no longer at risk`);
          this.borrowersAtRisk.delete(borrower);
          this.emit('borrowerHealthRestored', borrower);
        }
        
        // If was pending liquidation but somehow recovered, remove from pending liquidations
        if (this.pendingLiquidations.has(borrower)) {
          logger.info(`Borrower ${borrower} recovered from liquidation state`);
          this.pendingLiquidations.delete(borrower);
          this.emit('liquidationCancelled', borrower);
        }
      }
      
      return {
        borrower,
        isHealthy: !isAtRisk && !isLiquidatable,
        isAtRisk,
        isLiquidatable,
        collateralRatio,
        borrowsValue,
        collateralValue
      };
    }
    catch (error) {
      logger.error(`Error checking borrower health for ${borrower}: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Send a risk warning to a borrower
   * @param {string} borrower - Borrower's address
   * @param {number} collateralRatio - Current collateral ratio
   * @returns {Promise<boolean>} Success status
   */
  async sendRiskWarning(borrower, collateralRatio) {
    try {
      logger.info(`Sending risk warning to ${borrower}`);
      
      // Record warning on Tangle
      await this.recordToTangle('RISK_WARNING', {
        borrower,
        collateralRatio,
        warningThreshold: this.config.warningThreshold,
        liquidationThreshold: this.config.liquidationThreshold,
        timestamp: new Date().toISOString(),
        message: `Your collateral ratio (${collateralRatio.toFixed(2)}) is below the warning threshold (${this.config.warningThreshold}). Please add more collateral or repay part of your loan to avoid liquidation.`
      });
      
      // In a real application, this would also send an off-chain notification
      // via email, SMS, or UI notification
      
      logger.info(`Risk warning sent to ${borrower}`);
      this.emit('riskWarningSent', borrower, collateralRatio);
      
      return true;
    }
    catch (error) {
      logger.error(`Error sending risk warning to ${borrower}: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Trigger liquidation for a borrower
   * @param {string} borrower - Borrower's address
   * @param {number} borrowsValue - Value of borrows
   * @param {number} collateralValue - Value of collateral
   * @param {number} collateralRatio - Current collateral ratio
   * @returns {Promise<Object>} Liquidation result
   */
  async triggerLiquidation(borrower, borrowsValue, collateralValue, collateralRatio) {
    try {
      logger.info(`Triggering liquidation for ${borrower}`);
      
      // Check if flash loan protection is available and borrower has it
      let hasProtection = false;
      if (this.flashLoanProtection) {
        try {
          hasProtection = await this.flashLoanProtection.hasActiveProtection(borrower);
        } catch (error) {
          logger.error(`Error checking flash loan protection: ${error.message}`);
        }
      }
      
      // If protection is active, try to use it instead of liquidation
      if (hasProtection) {
        logger.info(`Borrower ${borrower} has flash loan protection, attempting to use it`);
        
        try {
          // Attempt to activate flash loan protection
          const protectionTx = await this.flashLoanProtection.activateProtection(borrower);
          const receipt = await protectionTx.wait();
          
          logger.info(`Flash loan protection activated for ${borrower}: ${receipt.transactionHash}`);
          
          // Record protection on Tangle
          await this.recordToTangle('PROTECTION_USED', {
            borrower,
            collateralRatio,
            borrowsValue,
            collateralValue,
            transactionHash: receipt.transactionHash,
            timestamp: new Date().toISOString()
          });
          
          this.emit('protectionActivated', borrower, receipt.transactionHash);
          
          // Remove from pending liquidations
          this.pendingLiquidations.delete(borrower);
          
          return {
            success: true,
            type: 'protection',
            transactionHash: receipt.transactionHash
          };
        } catch (error) {
          logger.error(`Error activating flash loan protection: ${error.message}`);
          logger.warn('Falling back to liquidation');
        }
      }
      
      // Record liquidation initiation on Tangle
      await this.recordToTangle('LIQUIDATION_INITIATED', {
        borrower,
        collateralRatio,
        borrowsValue,
        collateralValue,
        timestamp: new Date().toISOString()
      });
      
      // Start Dutch auction if available
      if (this.liquidationAuction) {
        logger.info(`Starting Dutch auction for ${borrower}`);
        
        try {
          // Get collateral in wei
          const collateralWei = ethers.utils.parseEther(collateralValue.toString());
          
          // Configure auction parameters
          const startPrice = collateralWei.mul(120).div(100); // 120% of collateral value
          const reservePrice = collateralWei.mul(70).div(100); // 70% of collateral value
          const duration = 3600; // 1 hour in seconds
          
          // Start the auction
          const auctionTx = await this.liquidationAuction.startAuction(
            borrower,
            collateralWei,
            startPrice,
            reservePrice,
            duration
          );
          
          const receipt = await auctionTx.wait();
          
          // Extract auction ID from events
          const event = receipt.events.find(e => e.event === 'AuctionStarted');
          const auctionId = event.args.auctionId;
          
          logger.info(`Dutch auction started for ${borrower} with ID ${auctionId}: ${receipt.transactionHash}`);
          
          this.emit('auctionStarted', borrower, auctionId.toString(), receipt.transactionHash);
          
          return {
            success: true,
            type: 'auction',
            auctionId: auctionId.toString(),
            transactionHash: receipt.transactionHash
          };
        } catch (error) {
          logger.error(`Error starting Dutch auction: ${error.message}`);
          logger.warn('Falling back to direct liquidation');
        }
      }
      
      // If auction fails or is not available, perform direct liquidation
      logger.info(`Performing direct liquidation for ${borrower}`);
      
      try {
        // Liquidate the borrower
        const liquidationTx = await this.lendingPool.liquidate(borrower);
        const receipt = await liquidationTx.wait();
        
        logger.info(`Direct liquidation completed for ${borrower}: ${receipt.transactionHash}`);
        
        // Record liquidation completion on Tangle
        await this.recordToTangle('LIQUIDATION_COMPLETED', {
          borrower,
          collateralRatio,
          borrowsValue,
          collateralValue,
          transactionHash: receipt.transactionHash,
          timestamp: new Date().toISOString()
        });
        
        this.emit('liquidationCompleted', borrower, receipt.transactionHash);
        
        // Remove from pending liquidations
        this.pendingLiquidations.delete(borrower);
        
        return {
          success: true,
          type: 'direct',
          transactionHash: receipt.transactionHash
        };
      } catch (error) {
        logger.error(`Error performing direct liquidation: ${error.message}`);
        
        // Record liquidation failure on Tangle
        await this.recordToTangle('LIQUIDATION_FAILED', {
          borrower,
          collateralRatio,
          borrowsValue,
          collateralValue,
          error: error.message,
          timestamp: new Date().toISOString()
        });
        
        this.emit('liquidationFailed', borrower, error.message);
        
        return {
          success: false,
          type: 'direct',
          error: error.message
        };
      }
    }
    catch (error) {
      logger.error(`Error triggering liquidation for ${borrower}: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Record data to the IOTA Tangle
   * @param {string} tag - Message tag
   * @param {Object} data - Data to record
   * @returns {Promise<Object>} Result of the operation
   */
  async recordToTangle(tag, data) {
    try {
      // Check if IOTA client is available
      if (!this.iotaClient) {
        logger.warn('IOTA client not available, skipping Tangle recording');
        return null;
      }
      
      logger.debug(`Recording ${tag} to Tangle`);
      
      // Create block with data payload
      const blockData = {
        payload: {
          type: 1, // Tagged data
          tag: Buffer.from(tag).toString('hex'),
          data: Buffer.from(JSON.stringify(data)).toString('hex')
        }
      };
      
      // Submit to IOTA Tangle
      const result = await submitBlock(this.iotaClient, blockData);
      logger.debug(`Data recorded to Tangle with tag ${tag}: ${result.blockId}`);
      
      return result;
    }
    catch (error) {
      logger.error(`Error recording to Tangle: ${error.message}`);
      return null;
    }
  }
  
  /**
   * Record auction data to the IOTA Tangle
   * @param {string} tag - Auction event tag
   * @param {Object} data - Auction data
   * @returns {Promise<Object>} Result of the operation
   */
  async recordAuctionToTangle(tag, data) {
    return this.recordToTangle(tag, data);
  }
  
  /**
   * Record protection data to the IOTA Tangle
   * @param {string} tag - Protection event tag
   * @param {Object} data - Protection data
   * @returns {Promise<Object>} Result of the operation
   */
  async recordProtectionToTangle(tag, data) {
    return this.recordToTangle(tag, data);
  }
  
  /**
   * Get current status of the liquidation service
   * @returns {Object} Service status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      borrowersAtRisk: Array.from(this.borrowersAtRisk.entries()).map(([address, data]) => ({
        address,
        ...data
      })),
      pendingLiquidations: Array.from(this.pendingLiquidations.entries()).map(([address, data]) => ({
        address,
        ...data
      })),
      activeAuctions: Array.from(this.activeAuctions.entries()).map(([id, data]) => ({
        id,
        ...data
      })),
      config: {
        checkIntervalMs: this.config.checkIntervalMs,
        liquidationThreshold: this.config.liquidationThreshold,
        warningThreshold: this.config.warningThreshold
      },
      lastChecked: new Date().toISOString()
    };
  }
  
  /**
   * Get details for a specific borrower
   * @param {string} borrower - Borrower's address
   * @returns {Promise<Object>} Borrower details
   */
  async getBorrowerDetails(borrower) {
    try {
      // Get borrower data
      const [borrows, collateral, liquidationHistory] = await Promise.all([
        this.lendingPool.borrows(borrower),
        this.lendingPool.collaterals(borrower),
        this.getLiquidationHistory(borrower)
      ]);
      
      // Convert to numbers
      const borrowsValue = parseFloat(ethers.utils.formatEther(borrows));
      const collateralValue = parseFloat(ethers.utils.formatEther(collateral));
      
      // Calculate collateral ratio
      const collateralRatio = borrowsValue === 0 ? Infinity : collateralValue / borrowsValue;
      
      // Determine status
      const isLiquidatable = collateralRatio < this.config.liquidationThreshold;
      const isAtRisk = collateralRatio < this.config.warningThreshold;
      
      // Get flash loan protection status if available
      let protectionStatus = null;
      if (this.flashLoanProtection) {
        try {
          const hasProtection = await this.flashLoanProtection.hasActiveProtection(borrower);
          const protectionDetails = hasProtection ? 
            await this.flashLoanProtection.getProtectionDetails(borrower) : null;
          
          protectionStatus = {
            active: hasProtection,
            details: protectionDetails ? {
              amount: ethers.utils.formatEther(protectionDetails.amount),
              expirationTime: new Date(protectionDetails.expirationTime.toNumber() * 1000).toISOString(),
              remainingUses: protectionDetails.remainingUses.toNumber()
            } : null
          };
        } catch (error) {
          logger.error(`Error getting protection status: ${error.message}`);
        }
      }
      
      return {
        address: borrower,
        borrowsValue,
        collateralValue,
        collateralRatio,
        status: isLiquidatable ? 'LIQUIDATABLE' : isAtRisk ? 'AT RISK' : 'HEALTHY',
        thresholds: {
          warning: this.config.warningThreshold,
          liquidation: this.config.liquidationThreshold
        },
        liquidationHistory,
        protectionStatus,
        activeAuction: this.getActiveBorrowerAuction(borrower)
      };
    }
    catch (error) {
      logger.error(`Error getting borrower details for ${borrower}: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Get liquidation history for a borrower
   * @param {string} borrower - Borrower's address
   * @returns {Promise<Array>} Liquidation history
   */
  async getLiquidationHistory(borrower) {
    try {
      // This would typically query events from the blockchain
      // For this example, we'll use a simplified approach
      
      const filter = this.lendingPool.filters.Liquidation(borrower);
      const events = await this.lendingPool.queryFilter(filter);
      
      // Format events
      return events.map(event => ({
        timestamp: new Date(event.args.timestamp.toNumber() * 1000).toISOString(),
        collateralLiquidated: ethers.utils.formatEther(event.args.collateralLiquidated),
        debtCovered: ethers.utils.formatEther(event.args.debtCovered),
        liquidator: event.args.liquidator,
        transactionHash: event.transactionHash,
        blockNumber: event.blockNumber
      }));
    }
    catch (error) {
      logger.error(`Error getting liquidation history for ${borrower}: ${error.message}`);
      return [];
    }
  }
  
  /**
   * Get active auction for a borrower
   * @param {string} borrower - Borrower's address
   * @returns {Object|null} Active auction or null if none
   */
  getActiveBorrowerAuction(borrower) {
    // Find auction for this borrower
    for (const [id, auction] of this.activeAuctions.entries()) {
      if (auction.borrower === borrower && auction.status === 'active') {
        return {
          id,
          ...auction
        };
      }
    }
    
    return null;
  }
}

module.exports = LiquidationService;