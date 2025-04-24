/**
 * Lending Controller
 * 
 * Handles all lending-related operations for the IntelliLend platform
 */

const { ethers } = require('ethers');
const axios = require('axios');
const LendingPoolService = require('../services/lendingPoolService');
const RiskAssessmentService = require('../services/riskAssessmentService');
const AssetService = require('../services/assetService');
const Web3Service = require('../services/web3Service');
const { handleError } = require('../utils/errorHandler');
const { validateDepositRequest, validateBorrowRequest, validateRepayRequest } = require('../utils/validators');
const config = require('../config');
const logger = require('../utils/logger');

class LendingController {
  constructor() {
    this.lendingPoolService = new LendingPoolService();
    this.riskAssessmentService = new RiskAssessmentService();
    this.assetService = new AssetService();
    this.web3Service = new Web3Service();
  }

  /**
   * Get markets information (supported assets, rates, etc.)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async getMarkets(req, res) {
    try {
      logger.info('Getting markets information');
      
      // Get markets data from lending pool service
      const markets = await this.lendingPoolService.getMarkets();
      
      // Get latest market statistics
      const marketStats = await this.lendingPoolService.getMarketStatistics();
      
      // Get asset prices
      const assetPrices = await this.assetService.getAssetPrices(
        markets.map(market => market.assetAddress)
      );
      
      // Combine data
      const marketsWithStats = markets.map(market => {
        const stats = marketStats.find(stat => stat.assetAddress === market.assetAddress) || {};
        const price = assetPrices[market.assetAddress] || 0;
        
        return {
          ...market,
          ...stats,
          price,
          totalSupplyUSD: stats.totalSupply * price,
          totalBorrowUSD: stats.totalBorrow * price
        };
      });
      
      // Return response
      return res.status(200).json({
        success: true,
        data: marketsWithStats,
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      logger.error(`Error in getMarkets: ${error.message}`);
      return handleError(res, error);
    }
  }

  /**
   * Get user account information
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async getUserAccount(req, res) {
    try {
      const { address } = req.params;
      
      if (!address || !ethers.utils.isAddress(address)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid address'
        });
      }
      
      logger.info(`Getting user account data for address: ${address}`);
      
      // Get user account data from lending pool service
      const accountData = await this.lendingPoolService.getUserAccountData(address);
      
      // Get user's risk profile
      const riskProfile = await this.riskAssessmentService.getUserRiskProfile(address);
      
      // Get user's deposit and borrow positions
      const positions = await this.lendingPoolService.getUserPositions(address);
      
      // Get asset prices
      const assetAddresses = [
        ...positions.deposits.map(deposit => deposit.assetAddress),
        ...positions.borrows.map(borrow => borrow.assetAddress)
      ];
      const assetPrices = await this.assetService.getAssetPrices(assetAddresses);
      
      // Calculate positions with USD values
      const depositsWithUSD = positions.deposits.map(deposit => {
        const price = assetPrices[deposit.assetAddress] || 0;
        return {
          ...deposit,
          valueUSD: deposit.amount * price
        };
      });
      
      const borrowsWithUSD = positions.borrows.map(borrow => {
        const price = assetPrices[borrow.assetAddress] || 0;
        return {
          ...borrow,
          valueUSD: borrow.amount * price
        };
      });
      
      // Calculate total deposit and borrow values
      const totalDepositUSD = depositsWithUSD.reduce((sum, deposit) => sum + deposit.valueUSD, 0);
      const totalBorrowUSD = borrowsWithUSD.reduce((sum, borrow) => sum + borrow.valueUSD, 0);
      
      // Calculate health factor
      const healthFactor = accountData.healthFactor || 
        (totalBorrowUSD > 0 ? (totalDepositUSD * accountData.currentLtv / 100) / totalBorrowUSD : Infinity);
      
      // Combine data
      const userData = {
        address,
        totalCollateralUSD: totalDepositUSD,
        totalBorrowUSD,
        availableBorrowsUSD: Math.max(0, (totalDepositUSD * accountData.currentLtv / 100) - totalBorrowUSD),
        currentLtv: accountData.currentLtv,
        healthFactor,
        riskProfile,
        positions: {
          deposits: depositsWithUSD,
          borrows: borrowsWithUSD
        }
      };
      
      // Return response
      return res.status(200).json({
        success: true,
        data: userData,
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      logger.error(`Error in getUserAccount: ${error.message}`);
      return handleError(res, error);
    }
  }

  /**
   * Deposit assets into the lending pool
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async deposit(req, res) {
    try {
      const { address, assetAddress, amount, useAsCollateral = true } = req.body;
      
      // Validate request
      const validationError = validateDepositRequest(req.body);
      if (validationError) {
        return res.status(400).json({
          success: false,
          error: validationError
        });
      }
      
      logger.info(`Deposit request: ${address} depositing ${amount} of asset ${assetAddress}`);
      
      // Check allowance
      const allowance = await this.web3Service.checkAllowance(address, assetAddress, config.lendingPoolAddress);
      
      // Generate transaction data
      let txData;
      
      if (ethers.BigNumber.from(allowance).lt(ethers.BigNumber.from(amount))) {
        // Generate approve transaction first
        const approveTx = await this.web3Service.generateApproveTransaction(
          address, assetAddress, config.lendingPoolAddress, amount
        );
        
        // Generate deposit transaction
        const depositTx = await this.lendingPoolService.generateDepositTransaction(
          address, assetAddress, amount, useAsCollateral
        );
        
        txData = {
          requiresApproval: true,
          approveTx,
          depositTx
        };
      } else {
        // Generate only deposit transaction
        const depositTx = await this.lendingPoolService.generateDepositTransaction(
          address, assetAddress, amount, useAsCollateral
        );
        
        txData = {
          requiresApproval: false,
          depositTx
        };
      }
      
      // Return transaction data
      return res.status(200).json({
        success: true,
        data: txData,
        message: 'Deposit transaction generated successfully'
      });
    } catch (error) {
      logger.error(`Error in deposit: ${error.message}`);
      return handleError(res, error);
    }
  }

  /**
   * Borrow assets from the lending pool
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async borrow(req, res) {
    try {
      const { 
        address, 
        assetAddress, 
        amount, 
        interestRateMode = 2, // 1 for stable, 2 for variable
        referralCode = 0 
      } = req.body;
      
      // Validate request
      const validationError = validateBorrowRequest(req.body);
      if (validationError) {
        return res.status(400).json({
          success: false,
          error: validationError
        });
      }
      
      logger.info(`Borrow request: ${address} borrowing ${amount} of asset ${assetAddress}`);
      
      // Check if user can borrow the requested amount
      const accountData = await this.lendingPoolService.getUserAccountData(address);
      const assetPrice = await this.assetService.getAssetPrice(assetAddress);
      const borrowValueUSD = amount * assetPrice;
      
      if (borrowValueUSD > accountData.availableBorrowsUSD) {
        return res.status(400).json({
          success: false,
          error: 'Insufficient collateral for requested borrow amount'
        });
      }
      
      // Analyze risk
      await this.riskAssessmentService.assessRisk(address);
      
      // Generate borrow transaction
      const borrowTx = await this.lendingPoolService.generateBorrowTransaction(
        address, assetAddress, amount, interestRateMode, referralCode
      );
      
      // Return transaction data
      return res.status(200).json({
        success: true,
        data: {
          borrowTx
        },
        message: 'Borrow transaction generated successfully'
      });
    } catch (error) {
      logger.error(`Error in borrow: ${error.message}`);
      return handleError(res, error);
    }
  }

  /**
   * Repay a loan
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async repay(req, res) {
    try {
      const { 
        address, 
        assetAddress, 
        amount, 
        interestRateMode = 2, // 1 for stable, 2 for variable
        onBehalfOf = null 
      } = req.body;
      
      // Validate request
      const validationError = validateRepayRequest(req.body);
      if (validationError) {
        return res.status(400).json({
          success: false,
          error: validationError
        });
      }
      
      const repayAddress = onBehalfOf || address;
      
      logger.info(`Repay request: ${address} repaying ${amount} of asset ${assetAddress} for ${repayAddress}`);
      
      // Check allowance
      const allowance = await this.web3Service.checkAllowance(address, assetAddress, config.lendingPoolAddress);
      
      // Generate transaction data
      let txData;
      
      if (ethers.BigNumber.from(allowance).lt(ethers.BigNumber.from(amount))) {
        // Generate approve transaction first
        const approveTx = await this.web3Service.generateApproveTransaction(
          address, assetAddress, config.lendingPoolAddress, amount
        );
        
        // Generate repay transaction
        const repayTx = await this.lendingPoolService.generateRepayTransaction(
          address, assetAddress, amount, interestRateMode, repayAddress
        );
        
        txData = {
          requiresApproval: true,
          approveTx,
          repayTx
        };
      } else {
        // Generate only repay transaction
        const repayTx = await this.lendingPoolService.generateRepayTransaction(
          address, assetAddress, amount, interestRateMode, repayAddress
        );
        
        txData = {
          requiresApproval: false,
          repayTx
        };
      }
      
      // Return transaction data
      return res.status(200).json({
        success: true,
        data: txData,
        message: 'Repay transaction generated successfully'
      });
    } catch (error) {
      logger.error(`Error in repay: ${error.message}`);
      return handleError(res, error);
    }
  }

  /**
   * Withdraw assets from the lending pool
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async withdraw(req, res) {
    try {
      const { address, assetAddress, amount } = req.body;
      
      if (!address || !ethers.utils.isAddress(address)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid address'
        });
      }
      
      if (!assetAddress || !ethers.utils.isAddress(assetAddress)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid asset address'
        });
      }
      
      if (!amount || isNaN(amount) || amount <= 0) {
        return res.status(400).json({
          success: false,
          error: 'Invalid amount'
        });
      }
      
      logger.info(`Withdraw request: ${address} withdrawing ${amount} of asset ${assetAddress}`);
      
      // Check if withdrawal would affect health factor
      const positions = await this.lendingPoolService.getUserPositions(address);
      const assetPrices = await this.assetService.getAssetPrices(
        [...positions.deposits.map(d => d.assetAddress), ...positions.borrows.map(b => b.assetAddress)]
      );
      
      // Find the deposit position for the asset
      const depositPosition = positions.deposits.find(d => d.assetAddress.toLowerCase() === assetAddress.toLowerCase());
      
      if (!depositPosition) {
        return res.status(400).json({
          success: false,
          error: 'No deposit found for this asset'
        });
      }
      
      // Check if trying to withdraw more than deposited
      if (ethers.BigNumber.from(amount).gt(ethers.BigNumber.from(depositPosition.amount))) {
        return res.status(400).json({
          success: false,
          error: 'Withdrawal amount exceeds deposit balance'
        });
      }
      
      // Calculate total collateral value in USD
      let totalCollateralUSD = positions.deposits.reduce((sum, deposit) => {
        const price = assetPrices[deposit.assetAddress] || 0;
        return sum + deposit.amount * price * (deposit.usageAsCollateralEnabled ? 1 : 0);
      }, 0);
      
      // Calculate total borrow value in USD
      const totalBorrowUSD = positions.borrows.reduce((sum, borrow) => {
        const price = assetPrices[borrow.assetAddress] || 0;
        return sum + borrow.amount * price;
      }, 0);
      
      // Calculate health factor after withdrawal
      const assetPrice = assetPrices[assetAddress] || 0;
      const withdrawalValueUSD = amount * assetPrice;
      
      // Adjust total collateral
      if (depositPosition.usageAsCollateralEnabled) {
        totalCollateralUSD -= withdrawalValueUSD;
      }
      
      // Calculate health factor (if borrowing)
      if (totalBorrowUSD > 0) {
        const newHealthFactor = (totalCollateralUSD * 0.8) / totalBorrowUSD; // 80% LTV for simplicity
        
        if (newHealthFactor < 1.0) {
          return res.status(400).json({
            success: false,
            error: 'Withdrawal would put your position at risk of liquidation',
            details: {
              currentHealthFactor: (totalCollateralUSD + withdrawalValueUSD) * 0.8 / totalBorrowUSD,
              newHealthFactor,
              safeWithdrawalAmount: Math.max(0, (totalCollateralUSD - totalBorrowUSD / 0.8) / assetPrice)
            }
          });
        }
      }
      
      // Generate withdraw transaction
      const withdrawTx = await this.lendingPoolService.generateWithdrawTransaction(
        address, assetAddress, amount
      );
      
      // Return transaction data
      return res.status(200).json({
        success: true,
        data: {
          withdrawTx
        },
        message: 'Withdraw transaction generated successfully'
      });
    } catch (error) {
      logger.error(`Error in withdraw: ${error.message}`);
      return handleError(res, error);
    }
  }

  /**
   * Get risk assessment for a user
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async getRiskAssessment(req, res) {
    try {
      const { address } = req.params;
      
      if (!address || !ethers.utils.isAddress(address)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid address'
        });
      }
      
      logger.info(`Getting risk assessment for address: ${address}`);
      
      // Get risk assessment
      const riskAssessment = await this.riskAssessmentService.assessRisk(address);
      
      // Return risk assessment
      return res.status(200).json({
        success: true,
        data: riskAssessment,
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      logger.error(`Error in getRiskAssessment: ${error.message}`);
      return handleError(res, error);
    }
  }

  /**
   * Get transaction history for a user
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async getTransactionHistory(req, res) {
    try {
      const { address } = req.params;
      const { page = 1, limit = 10, type = 'all' } = req.query;
      
      if (!address || !ethers.utils.isAddress(address)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid address'
        });
      }
      
      logger.info(`Getting transaction history for address: ${address}`);
      
      // Get transaction history
      const history = await this.lendingPoolService.getUserTransactionHistory(
        address, parseInt(page), parseInt(limit), type
      );
      
      // Return transaction history
      return res.status(200).json({
        success: true,
        data: history,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: history.total,
          pages: Math.ceil(history.total / parseInt(limit))
        }
      });
    } catch (error) {
      logger.error(`Error in getTransactionHistory: ${error.message}`);
      return handleError(res, error);
    }
  }
}

module.exports = new LendingController();
