/**
 * Mock AI Integration Module for IntelliLend
 * 
 * This module provides mock implementations of the AI integration functions
 * for development and testing purposes.
 */

class MockAIIntegration {
  constructor(config) {
    console.log('Mock AI Integration initialized');
    this.userDataCache = new Map();
    this.lastRiskScores = new Map();
  }
  
  // Set wallet for transaction signing
  setWallet(privateKey) {
    console.log('Mock wallet connected');
  }
  
  // Assess risk for a user
  async assessRisk(userAddress, options = {}) {
    console.log(`Mock risk assessment for user: ${userAddress}`);
    
    // Generate mock risk score between 20-70
    const riskScore = Math.floor(Math.random() * 50) + 20;
    
    const riskAssessment = {
      riskScore,
      confidence: 0.85 + (Math.random() * 0.1),
      factors: [
        { feature: 'transaction_history', importance: 0.35, contribution: -10 },
        { feature: 'collateral_ratio', importance: 0.25, contribution: 15 },
        { feature: 'wallet_age', importance: 0.15, contribution: -5 },
        { feature: 'repayment_history', importance: 0.15, contribution: -8 },
        { feature: 'cross_chain_activity', importance: 0.10, contribution: 3 }
      ],
      recommendations: [
        {
          title: 'Verify Your Identity',
          description: 'Complete identity verification to reduce your risk score by up to 15 points.',
          impact: 'high'
        },
        {
          title: 'Increase Collateral Ratio',
          description: 'Your current health factor is lower than optimal. Consider adding more collateral.',
          impact: 'medium'
        }
      ],
      timestamp: Date.now(),
      modelVersion: '1.2.0'
    };
    
    // Cache the risk score
    this.lastRiskScores.set(userAddress, riskScore);
    
    return riskAssessment;
  }
  
  // Fetch user data
  async fetchUserData(userAddress, useCache = false) {
    if (useCache && this.userDataCache.has(userAddress)) {
      return this.userDataCache.get(userAddress);
    }
    
    // Generate mock user data
    const userData = {
      address: userAddress,
      deposits: (Math.random() * 2000).toFixed(2),
      borrows: (Math.random() * 1000).toFixed(2),
      collaterals: (Math.random() * 2500).toFixed(2),
      riskScore: this.lastRiskScores.get(userAddress) || 45,
      timestamp: Date.now(),
      identityVerified: Math.random() > 0.7, // 30% chance of being verified
      transactionHistory: this.generateMockTransactions(),
      // Derived metrics
      collateralRatio: Math.random() * 2 + 1, // Between 1-3
      utilizationRatio: Math.random() * 0.8, // Between 0-0.8
    };
    
    // Cache the data
    this.userDataCache.set(userAddress, userData);
    
    return userData;
  }
  
  // Generate mock transactions
  generateMockTransactions() {
    const transactions = [];
    const types = ['deposit', 'borrow', 'repay', 'withdraw'];
    const count = 5 + Math.floor(Math.random() * 10);
    
    for (let i = 0; i < count; i++) {
      const type = types[Math.floor(Math.random() * types.length)];
      transactions.push({
        type,
        amount: (10 + Math.random() * 100).toFixed(2),
        timestamp: Date.now() - Math.floor(Math.random() * 30 * 86400 * 1000) // Up to 30 days ago
      });
    }
    
    // Sort by timestamp, newest first
    transactions.sort((a, b) => b.timestamp - a.timestamp);
    
    return transactions;
  }
  
  // Update risk score on-chain
  async updateRiskScore(userAddress, riskScore) {
    console.log(`Mock update risk score for ${userAddress} to ${riskScore}`);
    this.lastRiskScores.set(userAddress, riskScore);
    return { transactionHash: '0x' + Math.random().toString(16).substring(2, 66) };
  }
  
  // Get recommendations
  async getRecommendations(userAddress) {
    return [
      {
        title: 'Verify Your Identity',
        description: 'Complete identity verification to reduce your risk score by up to 15 points.',
        impact: 'high',
        type: 'verification'
      },
      {
        title: 'Increase Collateral Ratio',
        description: 'Your current health factor is lower than optimal. Consider adding more collateral.',
        impact: 'medium',
        type: 'collateral'
      },
      {
        title: 'Optimize Yield Strategy',
        description: 'Based on your risk profile, you could earn 2.3% more APY by switching to our optimized strategy.',
        impact: 'medium',
        type: 'yield'
      },
      {
        title: 'Diversify Collateral',
        description: 'Using multiple assets as collateral can reduce your liquidation risk during market volatility.',
        impact: 'low',
        type: 'strategy'
      }
    ];
  }
  
  // Clear cached data
  clearCache(userAddress = null) {
    if (userAddress) {
      this.userDataCache.delete(userAddress);
    } else {
      this.userDataCache.clear();
    }
  }
}

module.exports = MockAIIntegration;
