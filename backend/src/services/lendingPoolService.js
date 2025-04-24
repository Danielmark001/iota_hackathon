/**
 * Lending Pool Service
 * 
 * Handles interactions with the IntelliLend lending pool contract
 */

const { ethers } = require('ethers');
const { BlockchainDataService } = require('./blockchainDataService');
const RiskAssessmentService = require('./riskAssessmentService');
const config = require('../config');
const logger = require('../utils/logger');
const { BlockchainError } = require('../utils/errorHandler');
const { cache, CACHE_KEYS } = require('../utils/cache');

class LendingPoolService {
  constructor() {
    this.blockchainDataService = new BlockchainDataService();
    this.riskAssessmentService = new RiskAssessmentService();
    this.provider = this.blockchainDataService.getProvider();
    this.lendingPool = this.blockchainDataService.getContract('lendingPool');
    this.dataProvider = this.blockchainDataService.getContract('dataProvider');
    this.priceOracle = this.blockchainDataService.getContract('priceOracle');
    this.cacheEnabled = true;
    this.cacheTtl = 300; // 5 minutes
  }

  /**
   * Get markets information
   * @returns {Promise<Array>} - List of markets
   */
  async getMarkets() {
    try {
      // Check cache
      if (this.cacheEnabled) {
        const cachedMarkets = cache.get(CACHE_KEYS.MARKETS);
        if (cachedMarkets) {
          logger.debug('Returning cached markets data');
          return cachedMarkets;
        }
      }
      
      logger.info('Fetching markets data');
      
      // Get list of reserves from lending pool
      const reservesList = await this.lendingPool.getReservesList();
      
      // Fetch data for each reserve
      const marketsData = await Promise.all(
        reservesList.map(async (reserve) => {
          // Get reserve data
          const reserveData = await this.lendingPool.getReserveData(reserve);
          
          // Get asset metadata
          const metadata = await this.blockchainDataService.getAssetMetadata(reserve);
          
          // Get asset price
          const price = await this.priceOracle.getAssetPrice(reserve);
          
          return {
            assetAddress: reserve,
            symbol: metadata.symbol,
            name: metadata.name,
            decimals: metadata.decimals,
            liquidityRate: reserveData.liquidityRate.toString(),
            stableBorrowRate: reserveData.stableBorrowRate.toString(),
            variableBorrowRate: reserveData.variableBorrowRate.toString(),
            utilizationRate: this._calculateUtilizationRate(
              reserveData.totalStableDebt.toString(),
              reserveData.totalVariableDebt.toString(),
              reserveData.availableLiquidity.toString()
            ),
            totalLiquidity: ethers.utils.formatUnits(
              reserveData.availableLiquidity,
              metadata.decimals
            ),
            totalStableDebt: ethers.utils.formatUnits(
              reserveData.totalStableDebt,
              metadata.decimals
            ),
            totalVariableDebt: ethers.utils.formatUnits(
              reserveData.totalVariableDebt,
              metadata.decimals
            ),
            price: ethers.utils.formatUnits(price, 8), // Price with 8 decimals
            collateralFactor: reserveData.baseLTVasCollateral.div(100).toString(),
            liquidationThreshold: reserveData.liquidationThreshold.div(100).toString(),
            liquidationBonus: reserveData.liquidationBonus.sub(10000).div(100).toString(),
            isActive: reserveData.isActive,
            isFrozen: reserveData.isFrozen
          };
        })
      );
      
      // Cache the result
      if (this.cacheEnabled) {
        cache.set(CACHE_KEYS.MARKETS, marketsData, this.cacheTtl);
      }
      
      return marketsData;
    } catch (error) {
      logger.error(`Error getting markets data: ${error.message}`);
      throw new BlockchainError(`Failed to get markets data: ${error.message}`);
    }
  }

  /**
   * Get market statistics
   * @returns {Promise<Array>} - List of market statistics
   */
  async getMarketStatistics() {
    try {
      // Check cache
      if (this.cacheEnabled) {
        const cachedStats = cache.get(CACHE_KEYS.MARKET_STATS);
        if (cachedStats) {
          logger.debug('Returning cached market statistics');
          return cachedStats;
        }
      }
      
      logger.info('Fetching market statistics');
      
      // Get list of reserves from lending pool
      const reservesList = await this.lendingPool.getReservesList();
      
      // Fetch statistics for each reserve
      const marketStats = await Promise.all(
        reservesList.map(async (reserve) => {
          // Get reserve data
          const reserveData = await this.lendingPool.getReserveData(reserve);
          
          // Get asset metadata
          const metadata = await this.blockchainDataService.getAssetMetadata(reserve);
          
          // Calculate statistics
          const totalSupply = reserveData.availableLiquidity
            .add(reserveData.totalStableDebt)
            .add(reserveData.totalVariableDebt);
          
          const totalBorrow = reserveData.totalStableDebt.add(reserveData.totalVariableDebt);
          
          return {
            assetAddress: reserve,
            totalSupply: ethers.utils.formatUnits(totalSupply, metadata.decimals),
            totalBorrow: ethers.utils.formatUnits(totalBorrow, metadata.decimals),
            utilizationRate: totalSupply.gt(0)
              ? totalBorrow.mul(10000).div(totalSupply).toNumber() / 100
              : 0,
            depositAPY: this._calculateDepositAPY(reserveData.liquidityRate.toString()),
            stableBorrowAPY: this._calculateBorrowAPY(reserveData.stableBorrowRate.toString()),
            variableBorrowAPY: this._calculateBorrowAPY(reserveData.variableBorrowRate.toString())
          };
        })
      );
      
      // Cache the result
      if (this.cacheEnabled) {
        cache.set(CACHE_KEYS.MARKET_STATS, marketStats, this.cacheTtl);
      }
      
      return marketStats;
    } catch (error) {
      logger.error(`Error getting market statistics: ${error.message}`);
      throw new BlockchainError(`Failed to get market statistics: ${error.message}`);
    }
  }

  /**
   * Get user account data
   * @param {string} address - User address
   * @returns {Promise<Object>} - User account data
   */
  async getUserAccountData(address) {
    try {
      if (!ethers.utils.isAddress(address)) {
        throw new BlockchainError('Invalid address');
      }
      
      logger.info(`Fetching account data for ${address}`);
      
      // Get user account data from lending pool
      const accountData = await this.dataProvider.getUserAccountData(address);
      
      return {
        totalCollateralETH: ethers.utils.formatEther(accountData.totalCollateralETH),
        totalDebtETH: ethers.utils.formatEther(accountData.totalDebtETH),
        availableBorrowsETH: ethers.utils.formatEther(accountData.availableBorrowsETH),
        currentLiquidationThreshold: accountData.currentLiquidationThreshold.toNumber() / 100,
        ltv: accountData.ltv.toNumber() / 100,
        healthFactor: accountData.healthFactor.toString() === ethers.constants.MaxUint256.toString()
          ? 'MAX'
          : ethers.utils.formatUnits(accountData.healthFactor, 18),
        currentLtv: accountData.ltv.toNumber() / 100, // Loan to Value ratio (0-100)
      };
    } catch (error) {
      logger.error(`Error getting account data for ${address}: ${error.message}`);
      throw new BlockchainError(`Failed to get account data: ${error.message}`);
    }
  }

  /**
   * Get user positions (deposits and borrows)
   * @param {string} address - User address
   * @returns {Promise<Object>} - User positions
   */
  async getUserPositions(address) {
    try {
      if (!ethers.utils.isAddress(address)) {
        throw new BlockchainError('Invalid address');
      }
      
      // Check cache
      const cacheKey = `${CACHE_KEYS.USER_POSITIONS}:${address}`;
      if (this.cacheEnabled) {
        const cachedPositions = cache.get(cacheKey);
        if (cachedPositions) {
          logger.debug(`Returning cached positions for ${address}`);
          return cachedPositions;
        }
      }
      
      logger.info(`Fetching positions for ${address}`);
      
      // Get list of reserves from lending pool
      const reservesList = await this.lendingPool.getReservesList();
      
      // Get user configuration
      const userConfig = await this.lendingPool.getUserConfiguration(address);
      
      // Get user data for all reserves
      const positionsData = await this.dataProvider.getUserReservesData(address);
      
      // Extract deposits and borrows
      const deposits = [];
      const borrows = [];
      
      for (let i = 0; i < reservesList.length; i++) {
        const reserveAddress = reservesList[i];
        const userData = positionsData[i];
        
        // Get asset metadata
        const metadata = await this.blockchainDataService.getAssetMetadata(reserveAddress);
        
        // Get asset price
        const price = await this.priceOracle.getAssetPrice(reserveAddress);
        
        // Check if user has deposit
        if (userData.currentATokenBalance.gt(0)) {
          deposits.push({
            assetAddress: reserveAddress,
            symbol: metadata.symbol,
            decimals: metadata.decimals,
            amount: ethers.utils.formatUnits(userData.currentATokenBalance, metadata.decimals),
            amountUSD: ethers.utils.formatUnits(
              userData.currentATokenBalance.mul(price).div(ethers.constants.WeiPerEther),
              8
            ),
            usageAsCollateralEnabled: userData.usageAsCollateralEnabled
          });
        }
        
        // Check if user has stable debt
        if (userData.currentStableDebt.gt(0)) {
          borrows.push({
            assetAddress: reserveAddress,
            symbol: metadata.symbol,
            decimals: metadata.decimals,
            amount: ethers.utils.formatUnits(userData.currentStableDebt, metadata.decimals),
            amountUSD: ethers.utils.formatUnits(
              userData.currentStableDebt.mul(price).div(ethers.constants.WeiPerEther),
              8
            ),
            interestRate: ethers.utils.formatUnits(userData.stableBorrowRate, 25),
            interestRateType: 'stable'
          });
        }
        
        // Check if user has variable debt
        if (userData.currentVariableDebt.gt(0)) {
          borrows.push({
            assetAddress: reserveAddress,
            symbol: metadata.symbol,
            decimals: metadata.decimals,
            amount: ethers.utils.formatUnits(userData.currentVariableDebt, metadata.decimals),
            amountUSD: ethers.utils.formatUnits(
              userData.currentVariableDebt.mul(price).div(ethers.constants.WeiPerEther),
              8
            ),
            interestRate: ethers.utils.formatUnits(
              await this.lendingPool.getReserveNormalizedVariableDebt(reserveAddress),
              25
            ),
            interestRateType: 'variable'
          });
        }
      }
      
      const positions = {
        deposits,
        borrows
      };
      
      // Cache the result
      if (this.cacheEnabled) {
        cache.set(cacheKey, positions, this.cacheTtl);
      }
      
      return positions;
    } catch (error) {
      logger.error(`Error getting positions for ${address}: ${error.message}`);
      throw new BlockchainError(`Failed to get positions: ${error.message}`);
    }
  }

  /**
   * Get user transaction history
   * @param {string} address - User address
   * @param {number} page - Page number
   * @param {number} limit - Number of transactions per page
   * @param {string} type - Type of transactions to fetch
   * @returns {Promise<Object>} - Transaction history
   */
  async getUserTransactionHistory(address, page = 1, limit = 10, type = 'all') {
    try {
      if (!ethers.utils.isAddress(address)) {
        throw new BlockchainError('Invalid address');
      }
      
      logger.info(`Fetching transaction history for ${address}`);
      
      // Calculate pagination
      const skip = (page - 1) * limit;
      
      // Get all events related to the user from the lending pool
      const fromBlock = 0; // In a real app, you'd use a reasonable starting block
      const toBlock = 'latest';
      
      // Define event types to fetch
      const eventTypes = [];
      if (type === 'all' || type === 'deposit') {
        eventTypes.push(this.lendingPool.filters.Deposit(null, null, address));
      }
      if (type === 'all' || type === 'borrow') {
        eventTypes.push(this.lendingPool.filters.Borrow(null, null, address));
      }
      if (type === 'all' || type === 'repay') {
        eventTypes.push(this.lendingPool.filters.Repay(null, address));
      }
      if (type === 'all' || type === 'withdraw') {
        eventTypes.push(this.lendingPool.filters.Withdraw(null, address));
      }
      if (type === 'all' || type === 'liquidation') {
        eventTypes.push(this.lendingPool.filters.LiquidationCall(null, null, address));
      }
      
      // Fetch events in parallel
      const eventPromises = eventTypes.map(filter => 
        this.lendingPool.queryFilter(filter, fromBlock, toBlock)
      );
      
      const eventsArrays = await Promise.all(eventPromises);
      
      // Combine all events
      let allEvents = [];
      eventsArrays.forEach(events => {
        allEvents = [...allEvents, ...events];
      });
      
      // Sort events by block number (descending)
      allEvents.sort((a, b) => b.blockNumber - a.blockNumber);
      
      // Get total count
      const total = allEvents.length;
      
      // Apply pagination
      const paginatedEvents = allEvents.slice(skip, skip + limit);
      
      // Process events
      const transactions = await Promise.all(
        paginatedEvents.map(async (event) => {
          // Get block timestamp
          const block = await this.provider.getBlock(event.blockNumber);
          
          // Get asset metadata
          const assetAddress = event.args.reserve;
          const metadata = await this.blockchainDataService.getAssetMetadata(assetAddress);
          
          // Format event data
          const baseData = {
            transactionHash: event.transactionHash,
            blockNumber: event.blockNumber,
            timestamp: block.timestamp,
            asset: metadata.symbol,
            assetAddress,
            amount: ethers.utils.formatUnits(event.args.amount || 0, metadata.decimals)
          };
          
          // Add event-specific data
          if (event.event === 'Deposit') {
            return {
              ...baseData,
              type: 'deposit',
              from: event.args.user,
              to: event.args.onBehalfOf
            };
          } else if (event.event === 'Borrow') {
            return {
              ...baseData,
              type: 'borrow',
              from: event.args.user,
              interestRateMode: event.args.interestRateMode,
              borrowRate: ethers.utils.formatUnits(event.args.borrowRate, 25)
            };
          } else if (event.event === 'Repay') {
            return {
              ...baseData,
              type: 'repay',
              to: event.args.user,
              repayer: event.args.repayer,
              interestRateMode: event.args.interestRateMode
            };
          } else if (event.event === 'Withdraw') {
            return {
              ...baseData,
              type: 'withdraw',
              from: event.args.user,
              to: event.args.to
            };
          } else if (event.event === 'LiquidationCall') {
            const collateralAsset = await this.blockchainDataService.getAssetMetadata(
              event.args.collateralAsset
            );
            
            return {
              ...baseData,
              type: 'liquidation',
              user: event.args.user,
              liquidator: event.args.liquidator,
              collateralAsset: collateralAsset.symbol,
              collateralAssetAddress: event.args.collateralAsset,
              liquidatedCollateralAmount: ethers.utils.formatUnits(
                event.args.liquidatedCollateralAmount,
                collateralAsset.decimals
              )
            };
          }
          
          return {
            ...baseData,
            type: 'unknown'
          };
        })
      );
      
      return {
        transactions,
        total,
        page,
        limit
      };
    } catch (error) {
      logger.error(`Error getting transaction history for ${address}: ${error.message}`);
      throw new BlockchainError(`Failed to get transaction history: ${error.message}`);
    }
  }

  /**
   * Generate deposit transaction
   * @param {string} address - User address
   * @param {string} assetAddress - Asset address
   * @param {string} amount - Amount to deposit
   * @param {boolean} useAsCollateral - Whether to use the deposit as collateral
   * @returns {Promise<Object>} - Transaction data
   */
  async generateDepositTransaction(address, assetAddress, amount, useAsCollateral = true) {
    try {
      if (!ethers.utils.isAddress(address) || !ethers.utils.isAddress(assetAddress)) {
        throw new BlockchainError('Invalid address');
      }
      
      if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
        throw new BlockchainError('Invalid amount');
      }
      
      logger.info(`Generating deposit transaction for ${address}`);
      
      // Get asset metadata
      const metadata = await this.blockchainDataService.getAssetMetadata(assetAddress);
      
      // Convert amount to wei
      const amountWei = ethers.utils.parseUnits(amount.toString(), metadata.decimals);
      
      // Get lending pool contract interface
      const lendingPoolInterface = this.lendingPool.interface;
      
      // Encode function data
      const data = lendingPoolInterface.encodeFunctionData('deposit', [
        assetAddress,
        amountWei,
        address,
        0 // referralCode
      ]);
      
      // Generate transaction
      const tx = {
        to: this.lendingPool.address,
        data,
        value: assetAddress === ethers.constants.AddressZero ? amountWei : 0,
        gasLimit: config.blockchain.evm.gasLimit,
        gasPrice: ethers.utils.parseUnits(config.blockchain.evm.gasPrice, 'wei')
      };
      
      // Get risk adjustment
      const riskProfile = await this.riskAssessmentService.getUserRiskProfile(address);
      
      return {
        tx,
        asset: metadata.symbol,
        amount,
        riskAdjustment: riskProfile ? {
          riskScore: riskProfile.riskScore,
          collateralFactor: this.riskAssessmentService.getRecommendedCollateralFactor(riskProfile.riskScore)
        } : null
      };
    } catch (error) {
      logger.error(`Error generating deposit transaction for ${address}: ${error.message}`);
      throw new BlockchainError(`Failed to generate deposit transaction: ${error.message}`);
    }
  }

  /**
   * Generate borrow transaction
   * @param {string} address - User address
   * @param {string} assetAddress - Asset address
   * @param {string} amount - Amount to borrow
   * @param {number} interestRateMode - Interest rate mode (1 for stable, 2 for variable)
   * @param {number} referralCode - Referral code
   * @returns {Promise<Object>} - Transaction data
   */
  async generateBorrowTransaction(address, assetAddress, amount, interestRateMode = 2, referralCode = 0) {
    try {
      if (!ethers.utils.isAddress(address) || !ethers.utils.isAddress(assetAddress)) {
        throw new BlockchainError('Invalid address');
      }
      
      if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
        throw new BlockchainError('Invalid amount');
      }
      
      logger.info(`Generating borrow transaction for ${address}`);
      
      // Get asset metadata
      const metadata = await this.blockchainDataService.getAssetMetadata(assetAddress);
      
      // Convert amount to wei
      const amountWei = ethers.utils.parseUnits(amount.toString(), metadata.decimals);
      
      // Get lending pool contract interface
      const lendingPoolInterface = this.lendingPool.interface;
      
      // Get risk assessment
      const riskProfile = await this.riskAssessmentService.getUserRiskProfile(address);
      
      // Apply risk-based interest rate adjustment if available
      let adjustedInterestRateMode = interestRateMode;
      
      // Encode function data
      const data = lendingPoolInterface.encodeFunctionData('borrow', [
        assetAddress,
        amountWei,
        adjustedInterestRateMode,
        referralCode,
        address
      ]);
      
      // Generate transaction
      const tx = {
        to: this.lendingPool.address,
        data,
        value: 0,
        gasLimit: config.blockchain.evm.gasLimit,
        gasPrice: ethers.utils.parseUnits(config.blockchain.evm.gasPrice, 'wei')
      };
      
      return {
        tx,
        asset: metadata.symbol,
        amount,
        interestRateMode: adjustedInterestRateMode === 1 ? 'stable' : 'variable',
        riskAdjustment: riskProfile ? {
          riskScore: riskProfile.riskScore,
          recommendedInterestRate: this.riskAssessmentService.getRecommendedInterestRate(riskProfile.riskScore)
        } : null
      };
    } catch (error) {
      logger.error(`Error generating borrow transaction for ${address}: ${error.message}`);
      throw new BlockchainError(`Failed to generate borrow transaction: ${error.message}`);
    }
  }

  /**
   * Generate repay transaction
   * @param {string} address - User address
   * @param {string} assetAddress - Asset address
   * @param {string} amount - Amount to repay
   * @param {number} interestRateMode - Interest rate mode (1 for stable, 2 for variable)
   * @param {string} onBehalfOf - Address to repay on behalf of
   * @returns {Promise<Object>} - Transaction data
   */
  async generateRepayTransaction(address, assetAddress, amount, interestRateMode = 2, onBehalfOf = null) {
    try {
      if (!ethers.utils.isAddress(address) || !ethers.utils.isAddress(assetAddress)) {
        throw new BlockchainError('Invalid address');
      }
      
      if (onBehalfOf && !ethers.utils.isAddress(onBehalfOf)) {
        throw new BlockchainError('Invalid onBehalfOf address');
      }
      
      if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
        throw new BlockchainError('Invalid amount');
      }
      
      logger.info(`Generating repay transaction for ${address}`);
      
      // If onBehalfOf is not provided, use the sender address
      const repayAddress = onBehalfOf || address;
      
      // Get asset metadata
      const metadata = await this.blockchainDataService.getAssetMetadata(assetAddress);
      
      // Check if repaying max amount
      let amountWei;
      if (amount === '-1') {
        amountWei = ethers.constants.MaxUint256;
      } else {
        amountWei = ethers.utils.parseUnits(amount.toString(), metadata.decimals);
      }
      
      // Get lending pool contract interface
      const lendingPoolInterface = this.lendingPool.interface;
      
      // Encode function data
      const data = lendingPoolInterface.encodeFunctionData('repay', [
        assetAddress,
        amountWei,
        interestRateMode,
        repayAddress
      ]);
      
      // Generate transaction
      const tx = {
        to: this.lendingPool.address,
        data,
        value: assetAddress === ethers.constants.AddressZero ? amountWei : 0,
        gasLimit: config.blockchain.evm.gasLimit,
        gasPrice: ethers.utils.parseUnits(config.blockchain.evm.gasPrice, 'wei')
      };
      
      return {
        tx,
        asset: metadata.symbol,
        amount: amount === '-1' ? 'MAX' : amount,
        interestRateMode: interestRateMode === 1 ? 'stable' : 'variable',
        onBehalfOf: repayAddress
      };
    } catch (error) {
      logger.error(`Error generating repay transaction for ${address}: ${error.message}`);
      throw new BlockchainError(`Failed to generate repay transaction: ${error.message}`);
    }
  }

  /**
   * Generate withdraw transaction
   * @param {string} address - User address
   * @param {string} assetAddress - Asset address
   * @param {string} amount - Amount to withdraw
   * @returns {Promise<Object>} - Transaction data
   */
  async generateWithdrawTransaction(address, assetAddress, amount) {
    try {
      if (!ethers.utils.isAddress(address) || !ethers.utils.isAddress(assetAddress)) {
        throw new BlockchainError('Invalid address');
      }
      
      if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
        throw new BlockchainError('Invalid amount');
      }
      
      logger.info(`Generating withdraw transaction for ${address}`);
      
      // Get asset metadata
      const metadata = await this.blockchainDataService.getAssetMetadata(assetAddress);
      
      // Check if withdrawing max amount
      let amountWei;
      if (amount === '-1') {
        amountWei = ethers.constants.MaxUint256;
      } else {
        amountWei = ethers.utils.parseUnits(amount.toString(), metadata.decimals);
      }
      
      // Get lending pool contract interface
      const lendingPoolInterface = this.lendingPool.interface;
      
      // Encode function data
      const data = lendingPoolInterface.encodeFunctionData('withdraw', [
        assetAddress,
        amountWei,
        address
      ]);
      
      // Generate transaction
      const tx = {
        to: this.lendingPool.address,
        data,
        value: 0,
        gasLimit: config.blockchain.evm.gasLimit,
        gasPrice: ethers.utils.parseUnits(config.blockchain.evm.gasPrice, 'wei')
      };
      
      return {
        tx,
        asset: metadata.symbol,
        amount: amount === '-1' ? 'MAX' : amount
      };
    } catch (error) {
      logger.error(`Error generating withdraw transaction for ${address}: ${error.message}`);
      throw new BlockchainError(`Failed to generate withdraw transaction: ${error.message}`);
    }
  }

  /**
   * Calculate deposit APY
   * @param {string} liquidityRate - Liquidity rate
   * @returns {number} - Deposit APY
   * @private
   */
  _calculateDepositAPY(liquidityRate) {
    const rayRate = ethers.BigNumber.from(liquidityRate);
    const apy = Math.pow(
      1 + (rayRate.div(ethers.BigNumber.from(10).pow(25)).toNumber() / 365),
      365
    ) - 1;
    
    return apy * 100; // Convert to percentage
  }

  /**
   * Calculate borrow APY
   * @param {string} borrowRate - Borrow rate
   * @returns {number} - Borrow APY
   * @private
   */
  _calculateBorrowAPY(borrowRate) {
    const rayRate = ethers.BigNumber.from(borrowRate);
    const apy = Math.pow(
      1 + (rayRate.div(ethers.BigNumber.from(10).pow(25)).toNumber() / 365),
      365
    ) - 1;
    
    return apy * 100; // Convert to percentage
  }

  /**
   * Calculate utilization rate
   * @param {string} totalStableDebt - Total stable debt
   * @param {string} totalVariableDebt - Total variable debt
   * @param {string} availableLiquidity - Available liquidity
   * @returns {number} - Utilization rate
   * @private
   */
  _calculateUtilizationRate(totalStableDebt, totalVariableDebt, availableLiquidity) {
    const stableDebt = ethers.BigNumber.from(totalStableDebt);
    const variableDebt = ethers.BigNumber.from(totalVariableDebt);
    const liquidity = ethers.BigNumber.from(availableLiquidity);
    
    const totalDebt = stableDebt.add(variableDebt);
    const totalLiquidity = totalDebt.add(liquidity);
    
    if (totalLiquidity.eq(0)) {
      return 0;
    }
    
    return totalDebt.mul(10000).div(totalLiquidity).toNumber() / 100; // Convert to percentage
  }
}

module.exports = LendingPoolService;
