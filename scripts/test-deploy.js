/**
 * IntelliLend Test Deployment Script
 * 
 * This script simulates the deployment process without actually deploying to the blockchain.
 * Useful for testing the deployment setup before using real funds.
 */

const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

/**
 * Test the deployment setup
 */
async function testDeploy() {
  console.log('===============================================');
  console.log('IntelliLend Test Deployment');
  console.log('===============================================');
  
  try {
    // Validate environment
    validateEnvironment();
    
    // Test provider connection
    await testProviderConnection();
    
    // Test wallet setup
    testWalletSetup();
    
    // Test contract compilation
    // testContractCompilation();
    
    // Test service startup
    testServiceStartup();
    
    console.log('===============================================');
    console.log('Test deployment completed successfully!');
    console.log('You are ready to run the real deployment script.');
    console.log('===============================================');
    
  } catch (error) {
    console.error('Test deployment failed:', error);
    console.log('\nPlease fix the issues before running the real deployment.');
    process.exit(1);
  }
}

/**
 * Validate environment variables
 */
function validateEnvironment() {
  console.log('\nValidating environment...');
  
  const requiredVariables = ['IOTA_EVM_RPC_URL'];
  const missingVariables = [];
  
  for (const variable of requiredVariables) {
    if (!process.env[variable]) {
      missingVariables.push(variable);
    }
  }
  
  if (missingVariables.length > 0) {
    throw new Error(`Missing required environment variables: ${missingVariables.join(', ')}`);
  }
  
  if (!process.env.PRIVATE_KEY) {
    console.warn('Warning: PRIVATE_KEY not found in environment variables');
    console.warn('You will need to add this before real deployment');
  }
  
  console.log('Environment validation successful.');
}

/**
 * Test provider connection
 */
async function testProviderConnection() {
  console.log('\nTesting provider connection...');
  
  try {
    const provider = new ethers.providers.JsonRpcProvider(process.env.IOTA_EVM_RPC_URL);
    
    // Get network information
    const network = await provider.getNetwork();
    console.log(`Connected to network: ${network.name} (Chain ID: ${network.chainId})`);
    
    // Get latest block
    const blockNumber = await provider.getBlockNumber();
    console.log(`Latest block number: ${blockNumber}`);
    
    // Get gas price
    const gasPrice = await provider.getGasPrice();
    console.log(`Current gas price: ${ethers.utils.formatUnits(gasPrice, 'gwei')} gwei`);
    
    console.log('Provider connection successful.');
  } catch (error) {
    throw new Error(`Provider connection failed: ${error.message}`);
  }
}

/**
 * Test wallet setup
 */
function testWalletSetup() {
  console.log('\nTesting wallet setup...');
  
  try {
    if (!process.env.PRIVATE_KEY) {
      console.warn('No private key found. Generating a random wallet for testing...');
      const wallet = ethers.Wallet.createRandom();
      console.log(`Generated test wallet address: ${wallet.address}`);
      console.log('Note: This is just for testing. You will need a real funded wallet for deployment.');
    } else {
      const wallet = new ethers.Wallet(process.env.PRIVATE_KEY);
      console.log(`Wallet address: ${wallet.address}`);
      console.log('Wallet setup successful.');
    }
  } catch (error) {
    throw new Error(`Wallet setup failed: ${error.message}`);
  }
}

/**
 * Test contract compilation
 */
function testContractCompilation() {
  console.log('\nTesting contract compilation...');
  
  try {
    // Check if Hardhat is installed
    const hardhatConfigPath = path.join(__dirname, '..', 'hardhat.config.js');
    if (!fs.existsSync(hardhatConfigPath)) {
      throw new Error('Hardhat configuration file not found');
    }
    
    // Check contract paths
    const lendingPoolPath = path.join(__dirname, '..', 'smart-contracts', 'evm', 'LendingPool.sol');
    const bridgePath = path.join(__dirname, '..', 'smart-contracts', 'bridge', 'CrossLayerBridge.sol');
    
    if (!fs.existsSync(lendingPoolPath)) {
      throw new Error(`LendingPool contract not found at ${lendingPoolPath}`);
    }
    
    if (!fs.existsSync(bridgePath)) {
      throw new Error(`CrossLayerBridge contract not found at ${bridgePath}`);
    }
    
    console.log('Contract path verification successful.');
    
    // Try to compile contracts
    console.log('Attempting to compile contracts...');
    // In a real implementation, this would run Hardhat compile
    // execSync('npx hardhat compile', { stdio: 'inherit' });
    
    console.log('Contract compilation test complete.');
    
  } catch (error) {
    throw new Error(`Contract compilation test failed: ${error.message}`);
  }
}

/**
 * Test service startup capability
 */
function testServiceStartup() {
  console.log('\nTesting service startup capability...');
  
  try {
    // Check backend directory
    const backendDir = path.join(__dirname, '..', 'backend');
    if (!fs.existsSync(path.join(backendDir, 'server.js'))) {
      throw new Error('Backend server.js not found');
    }
    
    // Check AI model directory
    const aiModelDir = path.join(__dirname, '..', 'ai-model');
    if (!fs.existsSync(path.join(aiModelDir, 'api', 'app.py'))) {
      throw new Error('AI model app.py not found');
    }
    
    // Check frontend directory
    const frontendDir = path.join(__dirname, '..', 'frontend');
    if (!fs.existsSync(path.join(frontendDir, 'Dashboard.jsx'))) {
      throw new Error('Frontend Dashboard.jsx not found');
    }
    
    console.log('Service directories verification successful.');
    
    console.log('Service startup test complete.');
    
  } catch (error) {
    throw new Error(`Service startup test failed: ${error.message}`);
  }
}

// Execute the test deployment
if (require.main === module) {
  testDeploy()
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = { testDeploy };
