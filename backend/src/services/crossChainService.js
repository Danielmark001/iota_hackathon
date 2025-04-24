/**
 * Cross-Chain Liquidity Service
 * Manages cross-chain liquidity operations and optimizes yield across multiple blockchains
 */

const axios = require('axios');
const { ethers } = require('ethers');
const config = require('../config');
const logger = require('../utils/logger');

class CrossChainService {
  constructor() {
    this.providers = {};
    this.contracts = {};
    
    // Initialize providers and contracts for each supported chain
    this.initializeChains();
  }

  /**
   * Initialize connections to all supported blockchains
   */
  initializeChains() {
    try {
      // Initialize main IOTA EVM connection
      this.providers.iota = new ethers.providers.JsonRpcProvider(config.blockchain.rpcUrl);
      this.wallet = new ethers.Wallet(config.blockchain.privateKey, this.providers.iota);
      
      // Initialize the cross-chain liquidity contract
      this.contracts.crossChainLiquidity = new ethers.Contract(
        config.contracts.crossChainLiquidity.address,
        config.contracts.crossChainLiquidity.abi,
        this.wallet
      );
      
      // Initialize connections to other chains
      for (const chain of config.supportedChains) {
        if (chain.id !== config.blockchain.chainId) { // Skip main chain already initialized
          this.providers[chain.id] = new ethers.providers.JsonRpcProvider(chain.rpcUrl);
          
          // Initialize the bridge contract on this chain if needed
          if (chain.bridgeAddress) {
            this.contracts[`bridge_${chain.id}`] = new ethers.Contract(
              chain.bridgeAddress,
              config.contracts.bridge.abi,
              new ethers.Wallet(config.blockchain.privateKey, this.providers[chain.id])
            );
          }
        }
      }
      
      logger.info('Cross-chain connections initialized successfully');
    } catch (error) {
      logger.error(`Error initializing cross-chain connections: ${error.message}`);
      throw new Error(`Failed to initialize cross-chain connections: ${error.message}`);
    }
  }

  /**
   * Gets all supported chains and their information
   * 
   * @returns {Promise<Array>} - List of supported chains with their details
   */
  async getSupportedChains() {
    try {
      logger.info('Fetching supported chains');
      
      const supportedChains = [];
      
      // Get supported chains from the contract
      const chainCount = await this.contracts.crossChainLiquidity.getSupportedChainCount();
      
      for (let i = 0; i < chainCount.toNumber(); i++) {
        const chainId = await this.contracts.crossChainLiquidity.supportedChains(i);
        const chainInfo = await this.contracts.crossChainLiquidity.chains(chainId);
        
        supportedChains.push({
          id: chainId.toNumber(),
          name: chainInfo.name,
          bridge: chainInfo.bridge,
          totalLiquidity: ethers.utils.formatEther(chainInfo.totalLiquidity),
          utilizationRate: chainInfo.utilizationRate.toNumber() / 100, // Convert basis points to percentage
          interestRate: chainInfo.interestRate.toNumber() / 100,
          isSupported: chainInfo.supported
        });
      }
      
      // If no chains are returned from the contract, use configured ones as fallback
      if (supportedChains.length === 0) {
        return config.supportedChains.map(chain => ({
          id: chain.id,
          name: chain.name,
          bridge: chain.bridgeAddress || ethers.constants.AddressZero,
          totalLiquidity: '1000000',
          utilizationRate: 0.7,
          interestRate: 0.05,
          isSupported: true
        }));
      }
      
      return supportedChains;
    } catch (error) {
      logger.error(`Error fetching supported chains: ${error.message}`);
      
      // Return configured chains as fallback
      return config.supportedChains.map(chain => ({
        id: chain.id,
        name: chain.name,
        bridge: chain.bridgeAddress || ethers.constants.AddressZero,
        totalLiquidity: '1000000',
        utilizationRate: 0.7,
        interestRate: 0.05,
        isSupported: true
      }));
    }
  }

  /**
   * Gets all liquidity sources for a chain
   * 
   * @param {number} chainId - Chain ID
   * @returns {Promise<Array>} - List of liquidity sources
   */
  async getLiquiditySources(chainId) {
    try {
      logger.info(`Fetching liquidity sources for chain ${chainId}`);
      
      // Get liquidity sources from the contract
      const sourceIds = await this.contracts.crossChainLiquidity.getChainLiquiditySources(chainId);
      
      const sources = [];
      
      for (const sourceId of sourceIds) {
        const [
          sourceChainId,
          protocol,
          asset,
          amount,
          apy,
          utilizationRate,
          active
        ] = await this.contracts.crossChainLiquidity.getLiquiditySourceDetails(sourceId);
        
        sources.push({
          id: sourceId,
          chainId: sourceChainId.toNumber(),
          protocol,
          asset,
          amount: ethers.utils.formatEther(amount),
          apy: apy.toNumber() / 100,
          utilizationRate: utilizationRate.toNumber() / 100,
          active
        });
      }
      
      return sources;
    } catch (error) {
      logger.error(`Error fetching liquidity sources for chain ${chainId}: ${error.message}`);
      
      // Return mock data for hackathon demo
      return [
        {
          id: ethers.utils.id(`${chainId}-protocol1-token1`),
          chainId,
          protocol: '0x1111111111111111111111111111111111111111',
          asset: '0x2222222222222222222222222222222222222222',
          amount: '500000',
          apy: 0.05,
          utilizationRate: 0.7,
          active: true
        },
        {
          id: ethers.utils.id(`${chainId}-protocol2-token2`),
          chainId,
          protocol: '0x3333333333333333333333333333333333333333',
          asset: '0x4444444444444444444444444444444444444444',
          amount: '300000',
          apy: 0.08,
          utilizationRate: 0.6,
          active: true
        }
      ];
    }
  }

  /**
   * Gets a user's liquidity distribution across all chains
   * 
   * @param {string} address - User's blockchain address
   * @returns {Promise<Object>} - User's liquidity distribution
   */
  async getUserLiquidityDistribution(address) {
    try {
      logger.info(`Fetching liquidity distribution for ${address}`);
      
      // Get supported chains
      const chains = await this.getSupportedChains();
      
      const distribution = {};
      let totalLiquidity = ethers.BigNumber.from(0);
      
      // Get liquidity on each chain
      for (const chain of chains) {
        const userLiquidity = await this.getUserLiquidityOnChain(address, chain.id);
        
        distribution[chain.id] = {
          chainId: chain.id,
          chainName: chain.name,
          amount: ethers.utils.formatEther(userLiquidity),
          percentage: 0 // Will calculate after getting total
        };
        
        totalLiquidity = totalLiquidity.add(userLiquidity);
      }
      
      // Calculate percentages
      if (!totalLiquidity.isZero()) {
        for (const chainId in distribution) {
          const amount = ethers.utils.parseEther(distribution[chainId].amount);
          distribution[chainId].percentage = amount.mul(100).div(totalLiquidity).toNumber();
        }
      }
      
      return {
        address,
        totalLiquidity: ethers.utils.formatEther(totalLiquidity),
        distribution: Object.values(distribution)
      };
    } catch (error) {
      logger.error(`Error fetching liquidity distribution for ${address}: ${error.message}`);
      
      // Return mock data for hackathon demo
      const chains = config.supportedChains;
      const mockDistribution = [];
      let mockTotal = 0;
      
      // Generate pseudo-random distribution based on address
      const seed = parseInt(address.slice(2, 10), 16);
      
      for (const chain of chains) {
        // Generate pseudo-random amount based on chain ID and address
        const amount = ((seed + chain.id) % 10000) * 10;
        mockTotal += amount;
        
        mockDistribution.push({
          chainId: chain.id,
          chainName: chain.name,
          amount: amount.toString(),
          percentage: 0 // Will calculate after getting total
        });
      }
      
      // Calculate percentages
      if (mockTotal > 0) {
        for (const item of mockDistribution) {
          item.percentage = (parseInt(item.amount) / mockTotal) * 100;
        }
      }
      
      return {
        address,
        totalLiquidity: mockTotal.toString(),
        distribution: mockDistribution
      };
    }
  }

  /**
   * Gets a user's liquidity on a specific chain
   * 
   * @param {string} address - User's blockchain address
   * @param {number} chainId - Chain ID
   * @returns {Promise<ethers.BigNumber>} - User's liquidity on the chain
   */
  async getUserLiquidityOnChain(address, chainId) {
    try {
      // For the hackathon demo, we'll just call the contract on the main chain
      // In a production system, this would query each chain directly
      const liquidity = await this.contracts.crossChainLiquidity.getUserLiquidity(address, chainId);
      return liquidity;
    } catch (error) {
      logger.error(`Error fetching liquidity on chain ${chainId} for ${address}: ${error.message}`);
      
      // Return a random amount for demo purposes
      const randomAmount = ethers.utils.parseEther(
        (Math.floor(Math.random() * 10000) / 100).toString()
      );
      return randomAmount;
    }
  }

  /**
   * Calculates the optimal liquidity distribution across chains
   * 
   * @param {string} address - User's blockchain address
   * @returns {Promise<Object>} - Optimal distribution and projected yield
   */
  async calculateOptimalDistribution(address) {
    try {
      logger.info(`Calculating optimal distribution for ${address}`);
      
      // Get current distribution
      const currentDistribution = await this.getUserLiquidityDistribution(address);
      
      // Get all chains and their current stats
      const chains = await this.getSupportedChains();
      
      // Call the optimization algorithm
      const optimalDistribution = this.runOptimizationAlgorithm(
        address,
        currentDistribution,
        chains
      );
      
      return optimalDistribution;
    } catch (error) {
      logger.error(`Error calculating optimal distribution for ${address}: ${error.message}`);
      throw new Error(`Failed to calculate optimal distribution: ${error.message}`);
    }
  }

  /**
   * Runs the optimization algorithm to find the best distribution
   * This is a simplified version for the hackathon
   * 
   * @param {string} address - User's blockchain address
   * @param {Object} currentDistribution - Current liquidity distribution
   * @param {Array} chains - Available chains and their stats
   * @returns {Object} - Optimal distribution and projected yield
   */
  runOptimizationAlgorithm(address, currentDistribution, chains) {
    try {
      // Sort chains by APY (descending)
      const sortedChains = [...chains].sort((a, b) => 
        parseFloat(b.interestRate) - parseFloat(a.interestRate)
      );
      
      const totalLiquidity = parseFloat(currentDistribution.totalLiquidity);
      
      // Calculate risk-adjusted optimal allocation
      // In a real system, this would be much more sophisticated
      // considering correlation, volatility, risk preferences, etc.
      
      const optimalDistribution = [];
      let remainingLiquidity = totalLiquidity;
      let projectedYield = 0;
      
      // Allocate to highest-yielding chains first, but with constraints
      for (const chain of sortedChains) {
        // Skip inactive chains
        if (!chain.isSupported) continue;
        
        // Calculate available liquidity capacity on this chain (simplified)
        // In a real system, this would be based on the chain's capacity and risk parameters
        const maxCapacity = 1000000 - parseFloat(chain.totalLiquidity);
        
        // Allocate a portion of the liquidity to this chain
        // with higher-yielding chains getting more allocation
        const allocation = Math.min(
          remainingLiquidity,
          maxCapacity,
          // Allocation decreases for each chain to ensure diversification
          totalLiquidity * (0.4 - optimalDistribution.length * 0.05)
        );
        
        if (allocation > 0) {
          optimalDistribution.push({
            chainId: chain.id,
            chainName: chain.name,
            amount: allocation.toFixed(2),
            percentage: (allocation / totalLiquidity * 100).toFixed(2)
          });
          
          remainingLiquidity -= allocation;
          projectedYield += allocation * parseFloat(chain.interestRate);
        }
        
        // Stop if no more liquidity to allocate
        if (remainingLiquidity <= 0) break;
      }
      
      // If there's still remaining liquidity, allocate to the last chain
      if (remainingLiquidity > 0 && sortedChains.length > 0) {
        const lastChain = optimalDistribution[optimalDistribution.length - 1];
        lastChain.amount = (parseFloat(lastChain.amount) + remainingLiquidity).toFixed(2);
        lastChain.percentage = (parseFloat(lastChain.amount) / totalLiquidity * 100).toFixed(2);
        
        projectedYield += remainingLiquidity * parseFloat(
          sortedChains.find(c => c.id === lastChain.chainId).interestRate
        );
      }
      
      // Calculate current yield for comparison
      let currentYield = 0;
      for (const item of currentDistribution.distribution) {
        const chain = chains.find(c => c.id === item.chainId);
        if (chain) {
          currentYield += parseFloat(item.amount) * parseFloat(chain.interestRate);
        }
      }
      
      return {
        address,
        totalLiquidity,
        currentDistribution: currentDistribution.distribution,
        optimalDistribution,
        currentYield: currentYield.toFixed(2),
        projectedYield: projectedYield.toFixed(2),
        yieldImprovement: ((projectedYield - currentYield) / currentYield * 100).toFixed(2)
      };
    } catch (error) {
      logger.error(`Error running optimization algorithm for ${address}: ${error.message}`);
      throw new Error(`Failed to run optimization algorithm: ${error.message}`);
    }
  }

  /**
   * Executes a liquidity transfer between chains
   * 
   * @param {string} address - User's blockchain address
   * @param {number} sourceChainId - Source chain ID
   * @param {number} targetChainId - Target chain ID
   * @param {string} amount - Amount to transfer
   * @returns {Promise<Object>} - Transaction details
   */
  async transferLiquidityBetweenChains(address, sourceChainId, targetChainId, amount) {
    try {
      logger.info(`Transferring ${amount} from chain ${sourceChainId} to chain ${targetChainId} for ${address}`);
      
      const amountWei = ethers.utils.parseEther(amount);
      
      // Execute the transfer on the contract
      const tx = await this.contracts.crossChainLiquidity.transferLiquidity(
        sourceChainId,
        targetChainId,
        amountWei,
        { gasLimit: 500000 }
      );
      
      const receipt = await tx.wait();
      
      logger.info(`Liquidity transfer executed, tx: ${receipt.transactionHash}`);
      
      return {
        address,
        sourceChainId,
        targetChainId,
        amount,
        txHash: receipt.transactionHash,
        blockNumber: receipt.blockNumber,
        status: 'success'
      };
    } catch (error) {
      logger.error(`Error transferring liquidity between chains: ${error.message}`);
      throw new Error(`Failed to transfer liquidity: ${error.message}`);
    }
  }

  /**
   * Gets all available yield strategies
   * 
   * @returns {Promise<Array>} - List of yield strategies
   */
  async getYieldStrategies() {
    try {
      logger.info('Fetching yield strategies');
      
      // Get strategies from the contract
      const strategyCount = await this.contracts.crossChainLiquidity.nextStrategyId();
      
      const strategies = [];
      
      for (let i = 0; i < strategyCount.toNumber(); i++) {
        const strategy = await this.contracts.crossChainLiquidity.strategies(i);
        
        strategies.push({
          id: i,
          name: strategy.name,
          active: strategy.active,
          lastExecuted: strategy.lastExecuted.toNumber() > 0 ? 
            new Date(strategy.lastExecuted.toNumber() * 1000) : null,
          parameters: strategy.parameters
        });
      }
      
      return strategies;
    } catch (error) {
      logger.error(`Error fetching yield strategies: ${error.message}`);
      
      // Return mock strategies for hackathon demo
      return [
        {
          id: 0,
          name: 'Balanced Yield Optimizer',
          active: true,
          lastExecuted: new Date(Date.now() - 24 * 60 * 60 * 1000),
          description: 'Balances liquidity across chains for optimal risk-adjusted returns'
        },
        {
          id: 1,
          name: 'High Yield Maximizer',
          active: true,
          lastExecuted: new Date(Date.now() - 48 * 60 * 60 * 1000),
          description: 'Focuses on highest-yielding chains with higher risk tolerance'
        },
        {
          id: 2,
          name: 'Stability Focused Strategy',
          active: true,
          lastExecuted: new Date(Date.now() - 72 * 60 * 60 * 1000),
          description: 'Prioritizes chains with lower volatility and more stable returns'
        }
      ];
    }
  }

  /**
   * Executes a yield optimization strategy
   * 
   * @param {string} address - User's blockchain address
   * @param {number} strategyId - Strategy ID
   * @returns {Promise<Object>} - Execution results
   */
  async executeYieldStrategy(address, strategyId) {
    try {
      logger.info(`Executing yield strategy ${strategyId} for ${address}`);
      
      // First calculate optimal distribution
      const optimalDistribution = await this.calculateOptimalDistribution(address);
      
      // Create execution data for the strategy
      // For the hackathon, we'll just encode the first move to make
      let executionData;
      
      if (optimalDistribution.optimalDistribution.length > 0) {
        const currentItems = optimalDistribution.currentDistribution;
        const optimalItems = optimalDistribution.optimalDistribution;
        
        // Find biggest discrepancy between current and optimal
        let biggestDiff = 0;
        let sourceChain = null;
        let targetChain = null;
        let transferAmount = '0';
        
        for (const current of currentItems) {
          const optimal = optimalItems.find(o => o.chainId === current.chainId);
          
          if (optimal) {
            const diff = parseFloat(current.amount) - parseFloat(optimal.amount);
            
            if (diff > biggestDiff) {
              biggestDiff = diff;
              sourceChain = current.chainId;
              transferAmount = (diff * 0.5).toFixed(2); // Move half the difference
            }
          }
        }
        
        // Find target chain (chain with biggest deficit)
        let biggestDeficit = 0;
        
        for (const optimal of optimalItems) {
          const current = currentItems.find(c => c.chainId === optimal.chainId);
          
          if (current) {
            const deficit = parseFloat(optimal.amount) - parseFloat(current.amount);
            
            if (deficit > biggestDeficit) {
              biggestDeficit = deficit;
              targetChain = optimal.chainId;
            }
          } else {
            // Chain not in current distribution at all
            targetChain = optimal.chainId;
            break;
          }
        }
        
        if (sourceChain && targetChain && parseFloat(transferAmount) > 0) {
          executionData = ethers.utils.defaultAbiCoder.encode(
            ['uint256', 'uint256', 'address', 'uint256'],
            [
              sourceChain,
              targetChain,
              address,
              ethers.utils.parseEther(transferAmount)
            ]
          );
        }
      }
      
      // If no execution data was generated, create a dummy one
      if (!executionData) {
        executionData = ethers.utils.defaultAbiCoder.encode(
          ['uint256', 'uint256', 'address', 'uint256'],
          [1, 2, address, ethers.utils.parseEther('0.1')]
        );
      }
      
      // Execute the strategy
      const tx = await this.contracts.crossChainLiquidity.executeStrategy(
        strategyId,
        executionData,
        { gasLimit: 1000000 }
      );
      
      const receipt = await tx.wait();
      
      logger.info(`Strategy execution complete, tx: ${receipt.transactionHash}`);
      
      return {
        address,
        strategyId,
        txHash: receipt.transactionHash,
        blockNumber: receipt.blockNumber,
        optimalDistribution,
        status: 'success'
      };
    } catch (error) {
      logger.error(`Error executing yield strategy: ${error.message}`);
      throw new Error(`Failed to execute yield strategy: ${error.message}`);
    }
  }
}

module.exports = new CrossChainService();
