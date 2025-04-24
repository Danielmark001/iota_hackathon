/**
 * IntelliLend Deployment Simulation
 * 
 * This script simulates the deployment process without connecting to a real network.
 * Useful for testing the application without requiring blockchain connection.
 */

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const crypto = require('crypto');

// Load environment variables
dotenv.config();

async function simulateDeployment() {
  console.log('===============================================');
  console.log('IntelliLend Deployment Simulation');
  console.log('===============================================');
  
  try {
    // Generate mock contract addresses
    const bridgeAddress = generateContractAddress();
    const lendingPoolAddress = generateContractAddress();
    
    // Update .env file
    updateEnvFile({
      BRIDGE_ADDRESS: bridgeAddress,
      LENDING_POOL_ADDRESS: lendingPoolAddress
    });
    
    // Save deployment info
    saveDeploymentInfo({
      networkName: 'simulation',
      explorer: 'https://explorer.evm.testnet.shimmer.network',
      deployer: '0x' + crypto.randomBytes(20).toString('hex'),
      bridgeAddress,
      lendingPoolAddress,
      timestamp: new Date().toISOString(),
      simulation: true
    });
    
    console.log('Starting backend simulation...');
    // We'll create mock implementations of the smart contracts
    createMockImplementations(bridgeAddress, lendingPoolAddress);
    
    console.log('===============================================');
    console.log('Simulation completed successfully!');
    console.log('===============================================');
    console.log(`Bridge Address: ${bridgeAddress}`);
    console.log(`LendingPool Address: ${lendingPoolAddress}`);
    console.log('===============================================');
    console.log('');
    console.log('IMPORTANT: This is a simulated deployment.');
    console.log('The backend will use mock implementations instead of real blockchain contracts.');
    console.log('You can now start the services:');
    console.log('  1. npm run start:backend');
    console.log('  2. npm run start:ai');
    console.log('  3. npm run start:frontend');
    console.log('===============================================');
    
  } catch (error) {
    console.error('Simulation failed:', error);
    process.exit(1);
  }
}

/**
 * Generate a fake Ethereum contract address
 */
function generateContractAddress() {
  return '0x' + crypto.randomBytes(20).toString('hex');
}

/**
 * Update .env file with new values
 */
function updateEnvFile(updates) {
  const envPath = path.join(__dirname, '..', '.env');
  
  try {
    // Read existing .env file
    let envContent = '';
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf8');
    }
    
    // Update values
    for (const [key, value] of Object.entries(updates)) {
      // Check if key exists in .env
      const regex = new RegExp(`^${key}=.*$`, 'm');
      
      if (regex.test(envContent)) {
        // Replace existing value
        envContent = envContent.replace(regex, `${key}=${value}`);
      } else {
        // Add new value
        envContent += `\n${key}=${value}`;
      }
    }
    
    // Write updated .env file
    fs.writeFileSync(envPath, envContent);
    
    console.log('Environment variables updated successfully.');
    
  } catch (error) {
    console.error('Error updating .env file:', error);
  }
}

/**
 * Save deployment information to a JSON file
 */
function saveDeploymentInfo(deploymentInfo) {
  const deploymentsDir = path.join(__dirname, '..', 'deployments');
  
  // Create deployments directory if it doesn't exist
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }
  
  // Create file name based on network and timestamp
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const fileName = `deployment-${deploymentInfo.networkName}-${timestamp}.json`;
  const filePath = path.join(deploymentsDir, fileName);
  
  // Write deployment info to file
  fs.writeFileSync(filePath, JSON.stringify(deploymentInfo, null, 2));
  
  console.log(`Deployment information saved to: ${filePath}`);
}

/**
 * Create mock implementations for the smart contracts
 */
function createMockImplementations(bridgeAddress, lendingPoolAddress) {
  const mocksDir = path.join(__dirname, '..', 'backend', 'mocks');
  
  // Create mocks directory if it doesn't exist
  if (!fs.existsSync(mocksDir)) {
    fs.mkdirSync(mocksDir, { recursive: true });
  }
  
  // Create mock database
  const mockDb = {
    users: {
      // Default user (wallet address from .env)
      '0x3c0d9184692b1E34852d0F0be7adC3bd1Dbf0e15': {
        deposits: '1000',
        borrows: '500',
        collateral: '1500',
        riskScore: 25,
        healthFactor: 1.75
      }
    },
    market: {
      totalDeposits: '1000000',
      totalBorrows: '750000',
      totalCollateral: '1500000',
      utilizationRate: 75
    },
    history: {
      labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
      datasets: [
        {
          label: 'Risk Score',
          data: [65, 59, 80, 81, 56, 25],
        },
        {
          label: 'Interest Rate',
          data: [8, 7, 9, 10, 7, 6],
        }
      ]
    },
    messages: []
  };
  
  // Write mock database
  fs.writeFileSync(
    path.join(mocksDir, 'db.json'),
    JSON.stringify(mockDb, null, 2)
  );
  
  // Create mock contract implementations
  const mockContractsFile = path.join(mocksDir, 'contracts.js');
  const mockContractsContent = `/**
 * Mock Smart Contract Implementations
 * 
 * This file provides mock implementations of the smart contracts for local testing.
 */

const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');

// Load mock database
const dbPath = path.join(__dirname, 'db.json');
let db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

// Save database helper
function saveDb() {
  fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
}

// Mock LendingPool contract
const lendingPool = {
  address: '${lendingPoolAddress}',
  
  // User data
  deposits: async (address) => {
    return ethers.BigNumber.from(db.users[address]?.deposits || '0');
  },
  
  borrows: async (address) => {
    return ethers.BigNumber.from(db.users[address]?.borrows || '0');
  },
  
  collaterals: async (address) => {
    return ethers.BigNumber.from(db.users[address]?.collateral || '0');
  },
  
  riskScores: async (address) => {
    return ethers.BigNumber.from(db.users[address]?.riskScore || 50);
  },
  
  calculateInterestRate: async (address) => {
    // Base rate is 3%
    const baseRate = 3;
    
    // Add risk premium based on risk score
    const riskScore = db.users[address]?.riskScore || 50;
    const riskPremium = Math.floor(riskScore / 10);
    
    // Add utilization factor
    const utilizationRate = db.market.utilizationRate;
    const utilizationFactor = Math.floor(utilizationRate / 20);
    
    return ethers.BigNumber.from(baseRate + riskPremium + utilizationFactor);
  },
  
  getHealthFactor: async (address) => {
    const healthFactor = (db.users[address]?.healthFactor || 1.5) * 100;
    return ethers.BigNumber.from(Math.floor(healthFactor));
  },
  
  // Market data
  totalDeposits: async () => {
    return ethers.BigNumber.from(db.market.totalDeposits);
  },
  
  totalBorrows: async () => {
    return ethers.BigNumber.from(db.market.totalBorrows);
  },
  
  totalCollateral: async () => {
    return ethers.BigNumber.from(db.market.totalCollateral);
  },
  
  // Actions
  updateRiskScore: async (address, score) => {
    if (!db.users[address]) {
      db.users[address] = {
        deposits: '0',
        borrows: '0',
        collateral: '0',
        riskScore: 50,
        healthFactor: 1.5
      };
    }
    
    db.users[address].riskScore = score;
    saveDb();
    
    return {
      hash: '0x' + Buffer.from(crypto.randomBytes(32)).toString('hex'),
      wait: async () => ({})
    };
  }
};

// Mock Bridge contract
const bridge = {
  address: '${bridgeAddress}',
  
  sendMessageToL1: async (targetAddress, messageType, payload, gasLimit) => {
    const messageId = '0x' + Buffer.from(crypto.randomBytes(32)).toString('hex');
    
    db.messages.push({
      id: messageId,
      sender: '0x3c0d9184692b1E34852d0F0be7adC3bd1Dbf0e15',
      targetAddress,
      messageType,
      status: 'Pending',
      timestamp: new Date().toISOString()
    });
    
    saveDb();
    
    return {
      hash: '0x' + Buffer.from(crypto.randomBytes(32)).toString('hex'),
      wait: async () => ({})
    };
  },
  
  getMessageIdsBySender: async (address) => {
    return db.messages
      .filter(msg => msg.sender === address)
      .map(msg => msg.id);
  },
  
  messages: async (messageId) => {
    const message = db.messages.find(msg => msg.id === messageId);
    
    if (!message) {
      return {
        messageId: '0x0000000000000000000000000000000000000000000000000000000000000000',
        sender: '0x0000000000000000000000000000000000000000',
        targetAddress: '0x0000000000000000000000000000000000000000000000000000000000000000',
        payload: '0x',
        timestamp: 0,
        status: 0,
        direction: 0,
        messageType: '',
        gasLimit: 0,
        fee: 0
      };
    }
    
    const statuses = { 'Pending': 0, 'Processed': 1, 'Failed': 2, 'Canceled': 3 };
    
    return {
      messageId: message.id,
      sender: message.sender,
      targetAddress: message.targetAddress,
      payload: '0x',
      timestamp: ethers.BigNumber.from(Math.floor(new Date(message.timestamp).getTime() / 1000)),
      status: statuses[message.status],
      direction: 0,
      messageType: message.messageType,
      gasLimit: ethers.BigNumber.from(2000000),
      fee: ethers.BigNumber.from(0)
    };
  }
};

module.exports = {
  lendingPool,
  bridge
};`;
  
  fs.writeFileSync(mockContractsFile, mockContractsContent);
  
  // Create backend mock adapter
  const mockAdapterFile = path.join(mocksDir, 'adapter.js');
  const mockAdapterContent = `/**
 * Mock Contract Adapter
 * 
 * This file provides a way to use either real or mock contracts.
 */

const { ethers } = require('ethers');
const dotenv = require('dotenv');
const mockContracts = require('./contracts');

// Load environment variables
dotenv.config();

// Determine if we should use mock implementations
const USE_MOCKS = process.env.USE_MOCKS === 'true' || true;

/**
 * Get a contract instance (real or mock)
 */
function getContract(name, address, abi, provider) {
  if (USE_MOCKS) {
    console.log(\`Using mock \${name} implementation\`);
    return mockContracts[name.toLowerCase()];
  } else {
    console.log(\`Using real \${name} contract at \${address}\`);
    return new ethers.Contract(address, abi, provider);
  }
}

module.exports = {
  getContract,
  USE_MOCKS
};`;
  
  fs.writeFileSync(mockAdapterFile, mockAdapterContent);
  
  // Update .env to use mocks
  updateEnvFile({
    USE_MOCKS: 'true'
  });
  
  console.log('Mock implementations created successfully.');
}

// Execute deployment simulation
if (require.main === module) {
  simulateDeployment()
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
}
