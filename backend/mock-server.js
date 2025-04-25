/**
 * IntelliLend Backend Server - Mock Version
 * 
 * This is a simplified version that uses only mock data
 */

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { ethers } = require('ethers');
const morgan = require('morgan');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Import mock AI integration
const MockAIIntegration = require('../ai-model/api/mock_integration');
console.log('Using MOCK AI integration for development');

// Initialize express app
const app = express();
const PORT = process.env.BACKEND_PORT || 3001;

// Middleware
app.use(cors());
app.use(morgan('dev'));
app.use(bodyParser.json());

// Initialize AI Integration with mock data
const aiIntegration = new MockAIIntegration({});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: Date.now() });
});

// User profile endpoint
app.get('/api/user/:address', async (req, res) => {
  try {
    const { address } = req.params;
    
    // Validate Ethereum address
    if (!ethers.utils.isAddress(address)) {
      return res.status(400).json({ error: 'Invalid Ethereum address' });
    }
    
    // Fetch user data
    const userData = await aiIntegration.fetchUserData(address);
    
    // Calculate health factor
    const liquidationThreshold = 0.83; // 83%
    const collateralValue = parseFloat(userData.collaterals);
    const borrowValue = parseFloat(userData.borrows);
    
    const healthFactor = borrowValue > 0 
      ? (collateralValue * liquidationThreshold) / borrowValue 
      : 999;
    
    // Calculate interest rate
    const baseRate = 3;
    const riskPremium = Math.floor(userData.riskScore / 10);
    const interestRate = baseRate + riskPremium;
    
    // Return user stats
    res.json({
      address,
      deposits: parseFloat(userData.deposits),
      borrows: parseFloat(userData.borrows),
      collateral: parseFloat(userData.collaterals),
      riskScore: userData.riskScore,
      interestRate,
      healthFactor,
      identityVerified: userData.identityVerified || false,
      lastUpdated: userData.timestamp || Date.now()
    });
  } catch (error) {
    console.error(`Error fetching user ${req.params.address}:`, error);
    res.status(500).json({ error: 'Error fetching user data', message: error.message });
  }
});

// Market data endpoint
app.get('/api/market', async (req, res) => {
  try {
    // Generate simulated market data
    const totalDeposits = 500000;
    const totalBorrows = 350000;
    const totalCollateral = 750000;
    const utilizationRate = Math.round((totalBorrows / totalDeposits) * 100);
    
    res.json({
      totalDeposits,
      totalBorrows,
      totalCollateral,
      utilizationRate,
      lastUpdated: Date.now()
    });
  } catch (error) {
    console.error('Error fetching market data:', error);
    res.status(500).json({ error: 'Error fetching market data', message: error.message });
  }
});

// Historical data endpoint
app.get('/api/history/:address', async (req, res) => {
  try {
    const { address } = req.params;
    
    // Validate Ethereum address
    if (!ethers.utils.isAddress(address)) {
      return res.status(400).json({ error: 'Invalid Ethereum address' });
    }
    
    // Generate 30 days of history
    const days = 30;
    const labels = [];
    const deposits = [];
    const borrows = [];
    const riskScores = [];
    
    for (let i = days; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      labels.push(date.toLocaleDateString());
      
      // Generate simulated data with realistic trends
      const baseDeposit = 100 + Math.random() * 50;
      const baseBorrow = 50 + Math.random() * 30;
      const baseRisk = 30 + Math.random() * 20;
      
      // Add some trend (increasing deposits, fluctuating borrows)
      const deposit = baseDeposit + (days - i) * 2;
      const borrow = baseBorrow + Math.sin(i / 5) * 15;
      const risk = baseRisk - Math.cos(i / 7) * 10;
      
      deposits.push(deposit);
      borrows.push(borrow);
      riskScores.push(risk);
    }
    
    // Format for Chart.js
    res.json({
      labels,
      datasets: [
        {
          label: 'Deposits',
          data: deposits,
          borderColor: '#4caf50',
          backgroundColor: 'rgba(76, 175, 80, 0.1)',
          fill: true
        },
        {
          label: 'Borrows',
          data: borrows,
          borderColor: '#2196f3',
          backgroundColor: 'rgba(33, 150, 243, 0.1)',
          fill: true
        },
        {
          label: 'Risk Score',
          data: riskScores,
          borderColor: '#f44336',
          backgroundColor: 'rgba(244, 67, 54, 0.1)',
          fill: true,
          yAxisID: 'y2'
        }
      ]
    });
  } catch (error) {
    console.error(`Error fetching history for ${req.params.address}:`, error);
    res.status(500).json({ error: 'Error fetching historical data', message: error.message });
  }
});

// Risk assessment endpoint
app.post('/api/risk-assessment', async (req, res) => {
  try {
    const { address } = req.body;
    
    // Validate Ethereum address
    if (!ethers.utils.isAddress(address)) {
      return res.status(400).json({ error: 'Invalid Ethereum address' });
    }
    
    // Generate risk assessment
    const riskAssessment = await aiIntegration.assessRisk(address, {
      updateOnChain: false,
      useCachedData: true,
      generateZkProof: false
    });
    
    // Return risk assessment with recommendations
    res.json({
      address,
      riskScore: riskAssessment.riskScore,
      confidence: riskAssessment.confidence || 0.85,
      recommendations: riskAssessment.recommendations || [],
      topFactors: riskAssessment.factors || [],
      analysisTimestamp: Date.now()
    });
  } catch (error) {
    console.error(`Error assessing risk for ${req.body.address}:`, error);
    res.status(500).json({ error: 'Error processing risk assessment', message: error.message });
  }
});

// Get AI recommendations
app.get('/api/recommendations/:address', async (req, res) => {
  try {
    const { address } = req.params;
    
    // Validate Ethereum address
    if (!ethers.utils.isAddress(address)) {
      return res.status(400).json({ error: 'Invalid Ethereum address' });
    }
    
    // Get recommendations from AI
    const recommendations = await aiIntegration.getRecommendations(address);
    
    res.json(recommendations);
  } catch (error) {
    console.error(`Error getting recommendations for ${req.params.address}:`, error);
    res.status(500).json({ error: 'Error fetching recommendations', message: error.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`IntelliLend Mock API server running on port ${PORT}`);
  console.log(`Open http://localhost:${PORT}/health to check server status`);
});
