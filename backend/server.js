const express = require('express');
const cors = require('cors');
const { ethers } = require('ethers');
const axios = require('axios');
const dotenv = require('dotenv');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');

// Configuration
dotenv.config();
const app = express();
const port = process.env.PORT || 3001;
const AI_MODEL_API = process.env.AI_MODEL_API || 'http://localhost:5000';
const USE_MOCKS = process.env.USE_MOCKS === 'true';

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Contract ABIs and addresses
const LENDING_POOL_ADDRESS = process.env.LENDING_POOL_ADDRESS || '0x0000000000000000000000000000000000000000';
const BRIDGE_ADDRESS = process.env.BRIDGE_ADDRESS || '0x0000000000000000000000000000000000000000';

// Initialize provider and contracts
let provider, lendingPoolContract, bridgeContract;

// Check if we should use mocks
if (USE_MOCKS) {
  console.log('Using mock implementations for contracts');
  
  try {
    // Load mock adapter
    const mockAdapter = require('./mocks/adapter');
    lendingPoolContract = mockAdapter.getContract('LendingPool', LENDING_POOL_ADDRESS);
    bridgeContract = mockAdapter.getContract('Bridge', BRIDGE_ADDRESS);
  } catch (error) {
    console.error('Error loading mock implementations:', error);
    process.exit(1);
  }
} else {
  // Use real blockchain connection
  try {
    console.log('Connecting to IOTA EVM network...');
    provider = new ethers.providers.JsonRpcProvider(process.env.IOTA_EVM_RPC_URL);
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    
    // Contract ABIs (simplified for now)
    const LENDING_POOL_ABI = [
      "function deposits(address user) external view returns (uint256)",
      "function borrows(address user) external view returns (uint256)",
      "function collaterals(address user) external view returns (uint256)",
      "function riskScores(address user) external view returns (uint256)",
      "function calculateInterestRate(address user) external view returns (uint256)",
      "function getHealthFactor(address user) external view returns (uint256)",
      "function updateRiskScore(address user, uint256 score) external",
      "function totalDeposits() external view returns (uint256)",
      "function totalBorrows() external view returns (uint256)",
      "function totalCollateral() external view returns (uint256)"
    ];
    
    const BRIDGE_ABI = [
      "function sendMessageToL1(bytes32 targetAddress, string calldata messageType, bytes calldata payload, uint256 gasLimit) external payable returns (bytes32)",
      "function getMessageIdsBySender(address sender) external view returns (bytes32[] memory)",
      "function messages(bytes32 messageId) external view returns (bytes32, address, bytes32, bytes, uint256, uint8, uint8, string, uint256, uint256)"
    ];
    
    lendingPoolContract = new ethers.Contract(
      LENDING_POOL_ADDRESS,
      LENDING_POOL_ABI,
      wallet
    );
    
    bridgeContract = new ethers.Contract(
      BRIDGE_ADDRESS,
      BRIDGE_ABI,
      wallet
    );
  } catch (error) {
    console.error('Error connecting to blockchain:', error);
    console.log('Falling back to mock implementations...');
    
    // Load mock adapter
    try {
      const mockAdapter = require('./mocks/adapter');
      lendingPoolContract = mockAdapter.getContract('LendingPool', LENDING_POOL_ADDRESS);
      bridgeContract = mockAdapter.getContract('Bridge', BRIDGE_ADDRESS);
    } catch (mockError) {
      console.error('Error loading mock implementations:', mockError);
      process.exit(1);
    }
  }
}

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
    const healthFactor = await lendingPoolContract.getHealthFactor(address);
    
    res.json({
      deposits: ethers.utils.formatEther(deposits),
      borrows: ethers.utils.formatEther(borrows),
      collateral: ethers.utils.formatEther(collateral),
      riskScore: riskScore.toNumber(),
      interestRate: interestRate.toNumber(),
      healthFactor: healthFactor.toNumber() / 100, // Convert to decimal (e.g., 1.5)
      timestamp: new Date().toISOString()
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
    // Fetch actual data from the contract
    const totalDeposits = await lendingPoolContract.totalDeposits();
    const totalBorrows = await lendingPoolContract.totalBorrows();
    const totalCollateral = await lendingPoolContract.totalCollateral();
    
    // Calculate utilization rate
    const utilizationRate = totalDeposits.gt(0) 
      ? totalBorrows.mul(100).div(totalDeposits).toNumber() 
      : 0;
    
    res.json({
      totalDeposits: ethers.utils.formatEther(totalDeposits),
      totalBorrows: ethers.utils.formatEther(totalBorrows),
      totalCollateral: ethers.utils.formatEther(totalCollateral),
      utilizationRate,
      timestamp: new Date().toISOString()
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
    
    // Fetch additional on-chain data if not provided
    let features = onChainData;
    if (!features) {
      try {
        // Call the blockchain data collector service
        const response = await axios.get(`${AI_MODEL_API}/blockchain-data/${address}`);
        features = response.data.features;
      } catch (dataError) {
        console.error('Error fetching blockchain data:', dataError);
        // Use mock data as fallback
        features = {
          transaction_count: Math.floor(Math.random() * 100),
          avg_transaction_value: Math.random() * 1000,
          wallet_age_days: Math.floor(Math.random() * 365) + 1,
          previous_loans_count: Math.floor(Math.random() * 10),
          repayment_ratio: 0.8 + Math.random() * 0.2, // 0.8 to 1.0
          default_count: Math.floor(Math.random() * 2),
          collateral_diversity: Math.floor(Math.random() * 3) + 1,
          cross_chain_activity: Math.floor(Math.random() * 5),
          lending_protocol_interactions: Math.floor(Math.random() * 20),
          wallet_balance_volatility: Math.random() * 5
        };
      }
    }

    // Try to call the AI model API
    let aiResponse;
    try {
      aiResponse = await axios.post(`${AI_MODEL_API}/predict`, {
        address,
        features
      });
    } catch (aiError) {
      console.error('Error calling AI model API:', aiError);
      // Use mock data if AI model is not available
      aiResponse = {
        data: {
          risk_score: Math.floor(Math.random() * 100),
          risk_category: "Medium Risk",
          explanation: {
            recommendations: [
              {
                title: "Diversify Your Collateral",
                description: "Adding different asset types as collateral can reduce your risk score.",
                impact: "high"
              },
              {
                title: "Improve Repayment Frequency",
                description: "Regular repayments can improve your risk profile.",
                impact: "medium"
              }
            ],
            top_factors: [
              { Feature: "repayment_ratio", Importance: 0.35 },
              { Feature: "default_count", Importance: 0.25 },
              { Feature: "collateral_diversity", Importance: 0.15 }
            ]
          }
        }
      };
    }
    
    const riskScore = Math.floor(aiResponse.data.risk_score);
    
    // Update the risk score on the contract
    const tx = await lendingPoolContract.updateRiskScore(address, riskScore);
    await tx.wait();
    
    // Get recommendations from AI model
    const recommendations = aiResponse.data.explanation.recommendations;
    
    res.json({
      address,
      riskScore,
      riskCategory: aiResponse.data.risk_category,
      updated: true,
      txHash: tx.hash,
      recommendations,
      topFactors: aiResponse.data.explanation.top_factors,
      timestamp: new Date().toISOString()
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
    
    try {
      // Call the AI model API for recommendations
      const aiResponse = await axios.post(`${AI_MODEL_API}/predict`, {
        address,
        features: null // Let the API fetch the features
      });
      
      res.json(aiResponse.data.explanation.recommendations);
    } catch (aiError) {
      console.error('Error calling AI API:', aiError);
      // Fallback to mock recommendations
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
    }
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
    
    // Check if we have historical data in mocks
    if (USE_MOCKS) {
      try {
        const mockDbPath = path.join(__dirname, 'mocks', 'db.json');
        const mockDb = JSON.parse(fs.readFileSync(mockDbPath, 'utf8'));
        
        res.json(mockDb.history);
        return;
      } catch (mockError) {
        console.error('Error reading mock database:', mockError);
      }
    }
    
    // Fallback mock data
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

/**
 * Send a message to Layer 1 (Move) via the bridge
 */
app.post('/api/bridge/send-message', async (req, res) => {
  try {
    const { targetAddress, messageType, payload, gasLimit } = req.body;
    
    // Convert address to bytes32
    const targetAddressBytes = ethers.utils.hexZeroPad(targetAddress, 32);
    
    // Send message via the bridge
    const tx = await bridgeContract.sendMessageToL1(
      targetAddressBytes,
      messageType,
      payload || '0x',
      gasLimit || 2000000,
      { value: ethers.utils.parseEther('0.01') } // Fee for the bridge
    );
    
    await tx.wait();
    
    res.json({
      success: true,
      txHash: tx.hash,
      messageType,
      targetAddress
    });
  } catch (error) {
    console.error('Error sending message to Layer 1:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

/**
 * Get pending messages for an address
 */
app.get('/api/bridge/messages/:address', async (req, res) => {
  try {
    const { address } = req.params;
    
    // Get messages from the bridge
    const messageIds = await bridgeContract.getMessageIdsBySender(address);
    
    // Get details for each message
    const messages = await Promise.all(
      messageIds.map(async (id) => {
        const message = await bridgeContract.messages(id);
        return {
          id: id,
          sender: message.sender,
          targetAddress: ethers.utils.hexStripZeros(message.targetAddress),
          status: ['Pending', 'Processed', 'Failed', 'Canceled'][message.status],
          messageType: message.messageType,
          timestamp: new Date(message.timestamp.toNumber() * 1000).toISOString()
        };
      })
    );
    
    res.json({
      address,
      messages,
      count: messages.length
    });
  } catch (error) {
    console.error('Error fetching bridge messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

/**
 * Deposit funds into the lending pool
 */
app.post('/api/deposit', async (req, res) => {
  try {
    const { address, amount } = req.body;
    
    // Execute deposit transaction
    const tx = await lendingPoolContract.deposit(
      ethers.utils.parseEther(amount),
      { from: address }
    );
    
    await tx.wait();
    
    res.json({
      success: true,
      txHash: tx.hash,
      amount,
      address
    });
  } catch (error) {
    console.error('Error processing deposit:', error);
    res.status(500).json({ error: 'Failed to process deposit' });
  }
});

/**
 * Borrow funds from the lending pool
 */
app.post('/api/borrow', async (req, res) => {
  try {
    const { address, amount } = req.body;
    
    // Execute borrow transaction
    const tx = await lendingPoolContract.borrow(
      ethers.utils.parseEther(amount),
      { from: address }
    );
    
    await tx.wait();
    
    res.json({
      success: true,
      txHash: tx.hash,
      amount,
      address
    });
  } catch (error) {
    console.error('Error processing borrow:', error);
    res.status(500).json({ error: 'Failed to process borrow' });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`IntelliLend API server running on port ${port}`);
});

module.exports = app;
