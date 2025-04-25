/**
 * IntelliLend Deployment Script for IOTA
 * 
 * This script deploys the IntelliLend smart contracts to the IOTA network
 * and properly configures them to work with the IOTA L1/L2 architecture.
 */

const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { createClient } = require('../iota-sdk/client');
const { createWallet, getOrCreateAccount, generateAddress } = require('../iota-sdk/wallet');

// Load environment variables
dotenv.config();

// Contract ABIs and bytecode
const LendingPoolArtifact = require('../artifacts/contracts/LendingPool.sol/LendingPool.json');
const ZKVerifierArtifact = require('../artifacts/contracts/ZKVerifier.sol/ZKVerifier.json');
const ZKCrossLayerBridgeArtifact = require('../artifacts/contracts/ZKCrossLayerBridge.sol/ZKCrossLayerBridge.json');

// Initialize IOTA SDK
async function initializeIotaSdk() {
  const network = process.env.IOTA_NETWORK || 'testnet';
  console.log(`Connecting to IOTA ${network}...`);
  
  const iotaClient = await createClient(network);
  console.log('IOTA client connected successfully');
  
  // Initialize wallet if stronghold password is set
  if (!process.env.STRONGHOLD_PASSWORD) {
    throw new Error('STRONGHOLD_PASSWORD is required for deployment');
  }
  
  const iotaWallet = await createWallet(network);
  const iotaAccount = await getOrCreateAccount(iotaWallet, 'IntelliLend-Deployer');
  console.log('IOTA wallet initialized successfully');
  
  // Log account information
  const balance = await iotaAccount.getBalance();
  const smrBalance = BigInt(balance.baseCoin.available) / BigInt(1000000);
  console.log(`Account balance: ${smrBalance} SMR`);
  
  if (smrBalance < 1) {
    throw new Error('Insufficient SMR balance for deployment. Please fund your account.');
  }
  
  return { iotaClient, iotaWallet, iotaAccount };
}

// Deploy smart contracts to IOTA EVM
async function deployContracts() {
  console.log('Starting contract deployment to IOTA EVM...');
  
  // Connect to IOTA EVM provider
  const provider = new ethers.providers.JsonRpcProvider(process.env.IOTA_EVM_RPC_URL);
  
  // Set up wallet for deployment
  if (!process.env.PRIVATE_KEY) {
    throw new Error('PRIVATE_KEY is required for deployment');
  }
  
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  const deployerAddress = wallet.address;
  
  console.log(`Deploying from address: ${deployerAddress}`);
  
  // Get network and account info
  const network = await provider.getNetwork();
  console.log(`Connected to network: ${network.name} (${network.chainId})`);
  
  const balance = await wallet.getBalance();
  console.log(`Deployer balance: ${ethers.utils.formatEther(balance)} ETH`);
  
  if (balance.lt(ethers.utils.parseEther('0.1'))) {
    throw new Error('Insufficient ETH balance for deployment');
  }
  
  // Deploy ZKVerifier first
  console.log('Deploying ZKVerifier...');
  const zkVerifierFactory = new ethers.ContractFactory(
    ZKVerifierArtifact.abi,
    ZKVerifierArtifact.bytecode,
    wallet
  );
  
  const zkVerifier = await zkVerifierFactory.deploy(deployerAddress);
  await zkVerifier.deployed();
  console.log(`ZKVerifier deployed to: ${zkVerifier.address}`);
  
  // Deploy ZKCrossLayerBridge
  console.log('Deploying ZKCrossLayerBridge...');
  const zkBridgeFactory = new ethers.ContractFactory(
    ZKCrossLayerBridgeArtifact.abi,
    ZKCrossLayerBridgeArtifact.bytecode,
    wallet
  );
  
  const zkBridge = await zkBridgeFactory.deploy(deployerAddress);
  await zkBridge.deployed();
  console.log(`ZKCrossLayerBridge deployed to: ${zkBridge.address}`);
  
  // Create tokens on IOTA for lending and collateral (in a real deployment, we would use existing tokens)
  console.log('Creating mock tokens for testing...');
  // This would be implemented with real token contracts in a production environment
  
  // Deploy LendingPool with tokens and bridge
  console.log('Deploying LendingPool...');
  const lendingPoolFactory = new ethers.ContractFactory(
    LendingPoolArtifact.abi,
    LendingPoolArtifact.bytecode,
    wallet
  );
  
  // For demo purposes, we'll use the deployer address as token addresses
  // In a real deployment, we would use real token addresses
  const lendingPool = await lendingPoolFactory.deploy(
    deployerAddress, // lendingToken (placeholder)
    deployerAddress, // collateralToken (placeholder)
    zkBridge.address
  );
  await lendingPool.deployed();
  console.log(`LendingPool deployed to: ${lendingPool.address}`);
  
  // Configure roles and permissions
  console.log('Configuring contract roles and permissions...');
  
  // Grant bridge role to lending pool in ZK bridge
  const RELAYER_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("RELAYER_ROLE"));
  await zkBridge.grantRole(RELAYER_ROLE, lendingPool.address);
  console.log('Granted RELAYER_ROLE to LendingPool in ZKCrossLayerBridge');
  
  // Set verifier for risk score updates in ZK bridge
  await zkBridge.setVerifier('RISK_SCORE_UPDATE', zkVerifier.address);
  console.log('Set ZKVerifier for risk score updates in ZKCrossLayerBridge');
  
  // Return deployed contract addresses
  return {
    lendingPool: lendingPool.address,
    zkVerifier: zkVerifier.address,
    zkBridge: zkBridge.address
  };
}

// Deploy Move modules to IOTA L1
async function deployMoveModules(iotaAccount) {
  console.log('Deploying Move modules to IOTA L1...');
  
  // This would be implemented with IOTA Move module deployment
  // For now, we'll just print a placeholder message
  console.log('Move module deployment not implemented yet');
  
  return {
    moduleId: '0x' + '0'.repeat(64)
  };
}

// Update .env file with deployed addresses
async function updateEnvFile(contracts) {
  console.log('Updating .env file with contract addresses...');
  
  const envPath = path.resolve('.env');
  let envContent = await fs.promises.readFile(envPath, 'utf8');
  
  // Update contract addresses
  envContent = envContent.replace(/LENDING_POOL_ADDRESS=.*/g, `LENDING_POOL_ADDRESS=${contracts.lendingPool}`);
  envContent = envContent.replace(/ZK_VERIFIER_ADDRESS=.*/g, `ZK_VERIFIER_ADDRESS=${contracts.zkVerifier}`);
  envContent = envContent.replace(/ZK_BRIDGE_ADDRESS=.*/g, `ZK_BRIDGE_ADDRESS=${contracts.zkBridge}`);
  
  // Write updated .env file
  await fs.promises.writeFile(envPath, envContent);
  console.log('.env file updated with contract addresses');
}

// Main deployment function
async function main() {
  try {
    console.log('======== IntelliLend IOTA Deployment ========');
    
    // Initialize IOTA SDK
    const { iotaClient, iotaWallet, iotaAccount } = await initializeIotaSdk();
    
    // Deploy smart contracts to IOTA EVM
    const deployedContracts = await deployContracts();
    
    // Deploy Move modules to IOTA L1
    const moveModules = await deployMoveModules(iotaAccount);
    
    // Update .env file with deployed addresses
    await updateEnvFile(deployedContracts);
    
    console.log('\n======== Deployment Summary ========');
    console.log(`LendingPool deployed to: ${deployedContracts.lendingPool}`);
    console.log(`ZKVerifier deployed to: ${deployedContracts.zkVerifier}`);
    console.log(`ZKCrossLayerBridge deployed to: ${deployedContracts.zkBridge}`);
    console.log(`Move module ID: ${moveModules.moduleId}`);
    console.log('\nDeployment completed successfully!');
    console.log('====================================');
  } catch (error) {
    console.error('Deployment failed:', error);
    process.exit(1);
  }
}

// Run the deployment
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Unhandled error during deployment:', error);
    process.exit(1);
  });
