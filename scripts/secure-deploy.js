/**
 * Secure IntelliLend Deployment Script
 * 
 * This script deploys the IntelliLend contracts to the IOTA EVM network.
 * It reads the private key from the command line to avoid storing it in files.
 */

const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const readline = require('readline');

// Load environment variables
dotenv.config();

/**
 * Main deployment function
 */
async function deploy() {
  console.log('===============================================');
  console.log('IntelliLend Secure Deployment');
  console.log('===============================================');
  
  try {
    // Get private key securely
    const privateKey = await getPrivateKey();
    
    // Validate environment
    validateEnvironment();
    
    // Deploy smart contracts
    const contractAddresses = await deploySmartContracts(privateKey);
    
    // Update environment variables
    updateEnvironmentVariables(contractAddresses);
    
    console.log('===============================================');
    console.log('Deployment completed successfully!');
    console.log('===============================================');
    console.log(`Bridge Address: ${contractAddresses.bridgeAddress}`);
    console.log(`LendingPool Address: ${contractAddresses.lendingPoolAddress}`);
    console.log('===============================================');
    
  } catch (error) {
    console.error('Deployment failed:', error);
    process.exit(1);
  }
}

/**
 * Get private key securely from command line
 */
async function getPrivateKey() {
  // Check if we already have it in the environment
  if (process.env.PRIVATE_KEY && process.env.PRIVATE_KEY.length > 30) {
    return process.env.PRIVATE_KEY;
  }
  
  console.log('Private key not found in environment variables.');
  console.log('Enter your private key (input will be hidden):');
  
  // Create readline interface
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  // Disable echoing
  const originalSetPrompt = rl.setPrompt;
  rl.setPrompt = function(prompt, length) {
    originalSetPrompt.call(this, prompt, length);
    this._refreshLine = function() {
      this._refreshLine = originalSetPrompt.call(this)._refreshLine;
    };
  };
  
  // Get private key from user
  return new Promise((resolve) => {
    rl.question('> ', (answer) => {
      console.log(''); // New line for better formatting
      rl.close();
      resolve(answer);
    });
  });
}

/**
 * Validate environment variables
 */
function validateEnvironment() {
  console.log('\nValidating environment...');
  
  // Check for RPC URL
  if (!process.env.IOTA_EVM_RPC_URL) {
    throw new Error('IOTA_EVM_RPC_URL not found in environment variables');
  }
  
  console.log('Environment validation successful.\n');
}

/**
 * Deploy smart contracts to IOTA EVM
 */
async function deploySmartContracts(privateKey) {
  console.log('Deploying smart contracts to IOTA EVM...');
  
  // Connect to IOTA EVM network
  const provider = new ethers.providers.JsonRpcProvider(process.env.IOTA_EVM_RPC_URL);
  const wallet = new ethers.Wallet(privateKey, provider);
  const address = wallet.address;
  
  console.log(`Connected to IOTA EVM network: ${process.env.IOTA_EVM_RPC_URL}`);
  console.log(`Deployer address: ${address}`);
  
  // Check balance
  const balance = await provider.getBalance(address);
  console.log(`Account balance: ${ethers.utils.formatEther(balance)} IOTA`);
  
  if (balance.eq(0)) {