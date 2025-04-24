/**
 * Enhanced IntelliLend Deployment Script
 * 
 * This script deploys the entire IntelliLend stack:
 * 1. Smart contracts to IOTA EVM
 * 2. Backend API server
 * 3. AI Model API
 * 4. Frontend application
 */

const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { execSync, spawn } = require('child_process');
const deploymentConfig = require('../deployments/config.json');

// Load environment variables
dotenv.config();

// Set environment
const ENVIRONMENT = process.env.ENVIRONMENT || 'testnet';

// Global process objects
let backendProcess = null;
let aiModelProcess = null;
let frontendProcess = null;

/**
 * Main deployment function
 */
async function deploy() {
  console.log('===============================================');
  console.log('IntelliLend Deployment - IOTA DefAI Hackathon');
  console.log('===============================================');
  console.log(`Environment: ${ENVIRONMENT}`);
  
  try {
    // Validate environment
    validateEnvironment();
    
    // Deploy smart contracts
    const contractAddresses = await deploySmartContracts();
    
    // Update environment variables
    updateEnvironmentVariables(contractAddresses);
    
    // Start backend and AI services
    startServices();
    
    console.log('===============================================');
    console.log('Deployment completed successfully!');
    console.log('===============================================');
    console.log(`Bridge Address: ${contractAddresses.bridgeAddress}`);
    console.log(`LendingPool Address: ${contractAddresses.lendingPoolAddress}`);
    console.log('');
    console.log('Services:');
    console.log(`- Backend API: http://localhost:${process.env.BACKEND_PORT || 3001}`);
    console.log(`- AI Model API: http://localhost:${process.env.AI_MODEL_PORT || 5000}`);
    console.log(`- Frontend: http://localhost:${process.env.FRONTEND_PORT || 3000}`);
    console.log('===============================================');
    
  } catch (error) {
    console.error('Deployment failed:', error);
    process.exit(1);
  }
}

/**
 * Validate environment variables and dependencies
 */
function validateEnvironment() {
  console.log('\nValidating environment...');
  
  // Check for private key
  if (!process.env.PRIVATE_KEY) {
    throw new Error('PRIVATE_KEY not found in environment variables');
  }
  
  // Check for RPC URL
  if (!process.env.IOTA_EVM_RPC_URL) {
    throw new Error('IOTA_EVM_RPC_URL not found in environment variables');
  }
  
  // Check for NodeJS
  try {
    const nodeVersion = execSync('node --version').toString().trim();
    console.log(`Node.js version: ${nodeVersion}`);
  } catch (error) {
    throw new Error('Node.js not found. Please install Node.js v14 or higher.');
  }
  
  // Check for Python
  try {
    const pythonVersion = execSync('python --version').toString().trim();
    console.log(`Python version: ${pythonVersion}`);
  } catch (error) {
    try {
      const python3Version = execSync('python3 --version').toString().trim();
      console.log(`Python version: ${python3Version}`);
    } catch (error) {
      throw new Error('Python not found. Please install Python 3.8 or higher.');
    }
  }
  
  console.log('Environment validation successful.\n');
}

/**
 * Deploy smart contracts to IOTA EVM
 */
async function deploySmartContracts() {
  console.log('Deploying smart contracts to IOTA EVM...');
  
  // Connect to IOTA EVM network
  const provider = new ethers.providers.JsonRpcProvider(
    deploymentConfig.networks[ENVIRONMENT].rpcUrl
  );
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  const address = wallet.address;
  
  console.log(`Connected to IOTA EVM network: ${deploymentConfig.networks[ENVIRONMENT].rpcUrl}`);
  console.log(`Deployer address: ${address}`);
  
  // Check balance
  const balance = await provider.getBalance(address);
  console.log(`Account balance: ${ethers.utils.formatEther(balance)} IOTA`);
  
  if (balance.eq(0)) {
    throw new Error('Account has no balance. Please fund your account before deploying contracts.');
  }
  
  // Load contract artifacts
  const bridgeArtifact = {
    abi: [
      "function sendMessageToL1(bytes32 targetAddress, string calldata messageType, bytes calldata payload, uint256 gasLimit) external payable returns (bytes32)",
      "function getMessageIdsBySender(address sender) external view returns (bytes32[] memory)",
      "function messages(bytes32 messageId) external view returns (bytes32, address, bytes32, bytes, uint256, uint8, uint8, string, uint256, uint256)"
    ],
    bytecode: "0x608060405234801561001057600080fd5b50610a3c806100206000396000f3fe60806040..."
  };
  
  const lendingPoolArtifact = {
    abi: [
      "function deposits(address user) external view returns (uint256)",
      "function borrows(address user) external view returns (uint256)",
      "function collaterals(address user) external view returns (uint256)",
      "function riskScores(address user) external view returns (uint256)",
      "function calculateInterestRate(address user) external view returns (uint256)",
      "function getHealthFactor(address user) external view returns (uint256)",
      "function updateRiskScore(address user, uint256 score) external",
      "function deposit(uint256 amount) external",
      "function borrow(uint256 amount) external"
    ],
    bytecode: "0x608060405234801561001057600080fd5b50610c5e806100206000396000f3fe60806040..."
  };
  
  try {
    // 1. Deploy CrossLayerBridge
    console.log('\nDeploying CrossLayerBridge contract...');
    const bridgeFactory = new ethers.ContractFactory(
      bridgeArtifact.abi, 
      bridgeArtifact.bytecode, 
      wallet
    );
    
    const bridgeContract = await bridgeFactory.deploy(address);
    await bridgeContract.deployed();
    
    console.log(`CrossLayerBridge deployed to: ${bridgeContract.address}`);
    
    // 2. Deploy LendingPool
    console.log('\nDeploying LendingPool contract...');
    
    const lendingTokenAddress = deploymentConfig.tokens[ENVIRONMENT].lendingToken;
    const collateralTokenAddress = deploymentConfig.tokens[ENVIRONMENT].collateralToken;
    
    const lendingPoolFactory = new ethers.ContractFactory(
      lendingPoolArtifact.abi, 
      lendingPoolArtifact.bytecode, 
      wallet
    );
    
    const lendingPoolContract = await lendingPoolFactory.deploy(
      lendingTokenAddress,
      collateralTokenAddress,
      bridgeContract.address
    );
    await lendingPoolContract.deployed();
    
    console.log(`LendingPool deployed to: ${lendingPoolContract.address}`);
    
    // Save deployment info
    const deploymentInfo = {
      networkName: ENVIRONMENT,
      explorer: deploymentConfig.networks[ENVIRONMENT].explorer,
      deployer: address,
      bridgeAddress: bridgeContract.address,
      lendingPoolAddress: lendingPoolContract.address,
      timestamp: new Date().toISOString()
    };
    
    saveDeploymentInfo(deploymentInfo);
    
    return {
      bridgeAddress: bridgeContract.address,
      lendingPoolAddress: lendingPoolContract.address
    };
    
  } catch (error) {
    console.error('Error deploying contracts:', error);
    throw error;
  }
}

/**
 * Update environment variables with contract addresses
 */
function updateEnvironmentVariables(contractAddresses) {
  console.log('\nUpdating environment variables...');
  
  const envPath = path.join(__dirname, '..', '.env');
  
  try {
    // Read existing .env file
    let envContent = '';
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf8');
    }
    
    // Update contract addresses
    const updates = {
      BRIDGE_ADDRESS: contractAddresses.bridgeAddress,
      LENDING_POOL_ADDRESS: contractAddresses.lendingPoolAddress
    };
    
    // Replace or add variables
    for (const [key, value] of Object.entries(updates)) {
      const regex = new RegExp(`^${key}=.*$`, 'm');
      
      if (regex.test(envContent)) {
        envContent = envContent.replace(regex, `${key}=${value}`);
      } else {
        envContent += `\n${key}=${value}`;
      }
    }
    
    // Write updated .env file
    fs.writeFileSync(envPath, envContent);
    
    // Reload environment variables
    dotenv.config();
    
    console.log('Environment variables updated successfully.');
    
  } catch (error) {
    console.error('Error updating environment variables:', error);
    throw error;
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
 * Start backend, AI model, and frontend services
 */
function startServices() {
  console.log('\nStarting services...');
  
  // Start backend server
  console.log('Starting backend server...');
  backendProcess = spawn('node', ['server.js'], {
    cwd: path.join(__dirname, '..', 'backend'),
    stdio: 'inherit',
    detached: true
  });
  
  // Start AI model API
  console.log('Starting AI model API...');
  aiModelProcess = spawn('python', ['app.py'], {
    cwd: path.join(__dirname, '..', 'ai-model', 'api'),
    stdio: 'inherit',
    detached: true
  });
  
  // Start frontend
  console.log('Starting frontend...');
  frontendProcess = spawn('npm', ['start'], {
    cwd: path.join(__dirname, '..', 'frontend'),
    stdio: 'inherit',
    detached: true
  });
  
  // Handle cleanup on exit
  process.on('exit', stopServices);
  process.on('SIGINT', () => {
    stopServices();
    process.exit();
  });
  
  console.log('All services started successfully.');
}

/**
 * Stop all services
 */
function stopServices() {
  console.log('\nStopping services...');
  
  if (backendProcess) {
    process.kill(-backendProcess.pid);
    backendProcess = null;
  }
  
  if (aiModelProcess) {
    process.kill(-aiModelProcess.pid);
    aiModelProcess = null;
  }
  
  if (frontendProcess) {
    process.kill(-frontendProcess.pid);
    frontendProcess = null;
  }
  
  console.log('All services stopped.');
}

// Execute deployment if run directly
if (require.main === module) {
  deploy()
    .then(() => {
      // Keep process running to maintain services
      console.log('\nPress Ctrl+C to stop all services and exit.');
    })
    .catch(error => {
      console.error(error);
      stopServices();
      process.exit(1);
    });
}

module.exports = { deploy, stopServices };
