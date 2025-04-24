const express = require('express');
const cors = require('cors');
const { ethers } = require('ethers');
const axios = require('axios');
const dotenv = require('dotenv');
const bodyParser = require('body-parser');

// Configuration
dotenv.config();
const app = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Mock database (replace with real DB in production)
const userRiskData = {};

// Contract ABIs and addresses
const LENDING_POOL_ADDRESS = process.env.LENDING_POOL_ADDRESS || '0x0000000000000000000000000000000000000000';
const LENDING_POOL_ABI = require('../abis/LendingPool.json');

// Connect to IOTA node (for demonstration purposes)
const provider = new ethers.providers.JsonRpcProvider(process.env.IOTA_EVM_RPC_URL);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
const lendingPoolContract = new ethers.Contract(
  LENDING_POOL_ADDRESS,
  LENDING_POOL_ABI,
  wallet
);

/**
 * Get user lending data from the blockchain
 */
app.get('/api/user/:address', async (req, res) => {
  try {
    const { address } = req.params;
    
    // Get user data from the contract
    const deposits = await lendingPoolContract.deposits(address);
    const borrows = await lendingPoolContract.borrows(address);
    const collateral = await lendingPoolContract.collaterals(address);
    const riskScore = await lendingPoolContract.riskScores(address);
    const interestRate = await lendingPoolContract.calculateInterestRate(address);
    
    res.json({
      deposits: ethers.utils.formatEther(deposits),
      borrows: ethers.utils.formatEther(borrows),
      collateral: ethers.utils.formatEther(collateral),
      riskScore: riskScore.toNumber(),
      interestRate: interestRate.toNumber(),
    });
  } catch (error) {
    console.error('Error fetching user data:', error);
    res.status(500).json({ error: 'Failed to fetch user data' });
  }
});

/**
 * Get market statistics
 */
app.get('/api/market', async (req, res) => {
  try {
    // In a real implementation, this would fetch data from the contract
    // For now, returning mock data
    res.json({
      totalDeposits: '1,000,000',
      totalBorrows: '750,000',
      totalCollateral: '1,500,000',
      utilizationRate: 75,
    });
  } catch (error) {
    console.error('Error fetching market data:', error);
    res.status(500).json({ error: 'Failed to fetch market data' });
  }
});

/**
 * Update risk score based on AI model prediction
 */
app.post('/api/risk-assessment', async (req, res) => {
  try {
    const { address, onChainData } = req.body;
    
    // In a real implementation, this would send data to the Python AI model
    // For now, generating a mock risk score
    const mockRiskScore = Math.floor(Math.random() * 100);
    
    // Update the risk score on the contract
    const tx = await lendingPoolContract.updateRiskScore(address, mockRiskScore);
    await tx.wait();
    
    // Store the data for future reference
    userRiskData[address] = {
      riskScore: mockRiskScore,
      timestamp: new Date().toISOString(),
      data: onChainData
    };
    
    res.json({
      address,
      riskScore: mockRiskScore,
      updated: true,
      txHash: tx.hash
    });
  } catch (error) {
    console.error('Error updating risk score:', error);
    res.status(500).json({ error: 'Failed to update risk score' });
  }
});

/**
 * Get AI recommendations for a user
 */
app.get('/api/recommendations/:address', async (req, res) => {
  try {
    const { address } = req.params;
    
    // In a real implementation, this would generate recommendations based on the AI model
    // For now, returning mock recommendations
    const recommendations = [
      {
        id: 1,
        title: 'Diversify Your Collateral',
        description: 'Adding different asset types as collateral can reduce your risk score by up to 10 points.',
        impact: 'high',
      },
      {
        id: 2,
        title: 'Increase Repayment Frequency',
        description: 'More frequent smaller repayments can improve your repayment pattern score.',
        impact: 'medium',
      },
      {
        id: 3,
        title: 'Add More Collateral',
        description: 'Your current collateralization ratio is lower than recommended.',
        impact: 'high',
      },
    ];
    
    res.json(recommendations);
  } catch (error) {
    console.error('Error generating recommendations:', error);
    res.status(500).json({ error: 'Failed to generate recommendations' });
  }
});

/**
 * Get historical data for a user
 */
app.get('/api/history/:address', async (req, res) => {
  try {
    const { address } = req.params;
    
    // In a real implementation, this would fetch historical data from a database
    // For now, returning mock data
    const historicalData = {
      labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
      datasets: [
        {
          label: 'Risk Score',
          data: [65, 59, 80, 81, 56, 55],
        },
        {
          label: 'Interest Rate',
          data: [8, 7, 9, 10, 7, 6],
        }
      ],
    };
    
    res.json(historicalData);
  } catch (error) {
    console.error('Error fetching historical data:', error);
    res.status(500).json({ error: 'Failed to fetch historical data' });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`IntelliLend API server running on port ${port}`);
});

module.exports = app;
