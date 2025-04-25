/**
 * IntelliLend Demo Script
 * 
 * This script demonstrates the core functionality of the IntelliLend platform
 * including AI-powered risk assessment, cross-chain liquidity, and privacy-preserving
 * identity verification.
 */

const { ethers } = require('ethers');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const figlet = require('figlet');
const inquirer = require('inquirer');

// Contract ABIs
const LendingPoolABI = require('../abis/LendingPool.json');
const ZKVerifierABI = require('../abis/ZKVerifier.json');
const CrossChainLiquidityABI = require('../abis/CrossChainLiquidity.json');

// Load environment variables
dotenv.config();

// Configuration
const RPC_URL = process.env.IOTA_EVM_RPC_URL || 'http://localhost:8545';
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const LENDING_POOL_ADDRESS = process.env.LENDING_POOL_ADDRESS;
const ZK_VERIFIER_ADDRESS = process.env.ZK_VERIFIER_ADDRESS;
const CROSS_CHAIN_LIQUIDITY_ADDRESS = process.env.CROSS_CHAIN_LIQUIDITY_ADDRESS;

// Demo users
const users = [
  {
    name: 'Alice',
    address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    privateKey: '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d',
    profile: {
      riskScore: 25,
      collateral: '200',
      deposits: '100',
      borrows: '50'
    }
  },
  {
    name: 'Bob',
    address: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
    privateKey: '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a',
    profile: {
      riskScore: 45,
      collateral: '100',
      deposits: '50',
      borrows: '30'
    }
  },
  {
    name: 'Charlie',
    address: '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
    privateKey: '0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6',
    profile: {
      riskScore: 65,
      collateral: '50',
      deposits: '20',
      borrows: '15'
    }
  }
];

// Setup provider and signer
let provider;
let signer;
let lendingPool;
let zkVerifier;
let crossChainLiquidity;
let selectedUser;

/**
 * Initialize the demo
 */
async function init() {
  console.log(chalk.blue(figlet.textSync('IntelliLend', { horizontalLayout: 'full' })));
  console.log(chalk.cyan('AI-Powered DeFi Lending Platform on IOTA\n'));
  
  try {
    // Connect to blockchain
    provider = new ethers.providers.JsonRpcProvider(RPC_URL);
    
    // Check connection
    await provider.getBlockNumber();
    console.log(chalk.green('✓ Connected to IOTA EVM network'));
    
    // Load contracts if addresses are provided
    if (LENDING_POOL_ADDRESS) {
      lendingPool = new ethers.Contract(LENDING_POOL_ADDRESS, LendingPoolABI, provider);
      console.log(chalk.green('✓ Lending Pool contract loaded'));
    } else {
      console.log(chalk.yellow('⚠ Lending Pool address not provided, using mock functionality'));
    }
    
    if (ZK_VERIFIER_ADDRESS) {
      zkVerifier = new ethers.Contract(ZK_VERIFIER_ADDRESS, ZKVerifierABI, provider);
      console.log(chalk.green('✓ ZK Verifier contract loaded'));
    } else {
      console.log(chalk.yellow('⚠ ZK Verifier address not provided, using mock functionality'));
    }
    
    if (CROSS_CHAIN_LIQUIDITY_ADDRESS) {
      crossChainLiquidity = new ethers.Contract(CROSS_CHAIN_LIQUIDITY_ADDRESS, CrossChainLiquidityABI, provider);
      console.log(chalk.green('✓ Cross-Chain Liquidity contract loaded'));
    } else {
      console.log(chalk.yellow('⚠ Cross-Chain Liquidity address not provided, using mock functionality'));
    }
    
    // Show demo menu
    await showMainMenu();
  } catch (error) {
    console.error(chalk.red('Error initializing demo:'), error);
    console.log(chalk.yellow('Falling back to mock implementation for demonstration purposes'));
    
    // Continue with mock functionality
    await showMainMenu();
  }
}

/**
 * Show main menu
 */
async function showMainMenu() {
  console.log('\n' + chalk.cyan('=== IntelliLend Demo Menu ==='));
  
  const { action } = await inquirer.prompt({
    type: 'list',
    name: 'action',
    message: 'Select an action:',
    choices: [
      { name: '👤 Select User', value: 'select_user' },
      { name: '🧠 AI Risk Assessment Demo', value: 'risk_assessment' },
      { name: '🔒 Privacy-Preserving Identity Demo', value: 'privacy_identity' },
      { name: '⛓️ Cross-Chain Liquidity Demo', value: 'cross_chain' },
      { name: '💰 Lending Operations Demo', value: 'lending_operations' },
      { name: '📊 Run Full Demo Scenario', value: 'full_demo' },
      { name: '❌ Exit', value: 'exit' }
    ]
  });
  
  switch (action) {
    case 'select_user':
      await selectUser();
      break;
    case 'risk_assessment':
      await riskAssessmentDemo();
      break;
    case 'privacy_identity':
      await privacyIdentityDemo();
      break;
    case 'cross_chain':
      await crossChainDemo();
      break;
    case 'lending_operations':
      await lendingOperationsDemo();
      break;
    case 'full_demo':
      await runFullDemo();
      break;
    case 'exit':
      console.log(chalk.green('Thank you for exploring IntelliLend!'));
      process.exit(0);
      break;
  }
  
  // Return to main menu after completion
  await showMainMenu();
}

/**
 * Select a user for the demo
 */
async function selectUser() {
  const { user } = await inquirer.prompt({
    type: 'list',
    name: 'user',
    message: 'Select a user:',
    choices: users.map(user => ({ name: `${user.name} (${user.address.slice(0, 8)}...)`, value: user.name }))
  });
  
  selectedUser = users.find(u => u.name === user);
  
  // Set up signer for the selected user
  try {
    const wallet = new ethers.Wallet(selectedUser.privateKey, provider);
    signer = wallet;
    
    // Connect contracts to signer
    if (lendingPool) lendingPool = lendingPool.connect(signer);
    if (zkVerifier) zkVerifier = zkVerifier.connect(signer);
    if (crossChainLiquidity) crossChainLiquidity = crossChainLiquidity.connect(signer);
    
    console.log(chalk.green(`Selected user: ${selectedUser.name} (${selectedUser.address})`));
    
    // Display user profile
    console.log('\n' + chalk.cyan('=== User Profile ==='));
    console.log(chalk.white(`Risk Score: ${selectedUser.profile.riskScore}`));
    console.log(chalk.white(`Collateral: ${selectedUser.profile.collateral} IOTA`));
    console.log(chalk.white(`Deposits: ${selectedUser.profile.deposits} IOTA`));
    console.log(chalk.white(`Borrows: ${selectedUser.profile.borrows} IOTA`));
  } catch (error) {
    console.error(chalk.red('Error setting up user:'), error);
  }
}

/**
 * AI Risk Assessment Demo
 */
async function riskAssessmentDemo() {
  if (!selectedUser) {
    console.log(chalk.yellow('⚠ Please select a user first'));
    await selectUser();
  }
  
  console.log('\n' + chalk.cyan('=== AI Risk Assessment Demo ==='));
  console.log(chalk.white('Running AI risk assessment for user: ' + selectedUser.name));
  
  // Simulate AI analysis
  console.log(chalk.white('\nCollecting on-chain data...'));
  await simulateProgress(20);
  
  console.log(chalk.white('\nAnalyzing transaction patterns...'));
  await simulateProgress(30);
  
  console.log(chalk.white('\nEvaluating borrowing history...'));
  await simulateProgress(25);
  
  console.log(chalk.white('\nAssessing collateral quality...'));
  await simulateProgress(15);
  
  console.log(chalk.white('\nGenerating risk assessment...'));
  await simulateProgress(10);
  
  // Display risk assessment
  const riskScore = selectedUser.profile.riskScore;
  let riskCategory, riskColor;
  
  if (riskScore < 30) {
    riskCategory = 'Low Risk';
    riskColor = chalk.green;
  } else if (riskScore < 50) {
    riskCategory = 'Medium Risk';
    riskColor = chalk.yellow;
  } else if (riskScore < 70) {
    riskCategory = 'High Risk';
    riskColor = chalk.magenta;
  } else {
    riskCategory = 'Very High Risk';
    riskColor = chalk.red;
  }
  
  console.log('\n' + chalk.cyan('=== Risk Assessment Results ==='));
  console.log(riskColor(`Risk Score: ${riskScore}/100 (${riskCategory})`));
  
  // Display interest rate based on risk
  const baseRate = 3;
  const riskPremium = Math.floor(riskScore / 10);
  const interestRate = baseRate + riskPremium;
  
  console.log(chalk.white(`\nRecommended Interest Rate: ${interestRate}%`));
  console.log(chalk.white(`- Base Rate: ${baseRate}%`));
  console.log(chalk.white(`- Risk Premium: ${riskPremium}%`));
  
  // Display top risk factors
  console.log('\n' + chalk.cyan('=== Top Risk Factors ==='));
  
  // Different risk factors for each user
  if (selectedUser.name === 'Alice') {
    console.log(chalk.white('- Low collateralization ratio (30%)'));
    console.log(chalk.white('- Limited transaction history'));
  } else if (selectedUser.name === 'Bob') {
    console.log(chalk.white('- Moderate wallet balance volatility'));
    console.log(chalk.white('- Unverified identity status'));
    console.log(chalk.white('- Multiple active loans (3)'));
  } else if (selectedUser.name === 'Charlie') {
    console.log(chalk.white('- Previous loan default detected'));
    console.log(chalk.white('- High wallet balance volatility'));
    console.log(chalk.white('- Low collateral diversity'));
    console.log(chalk.white('- Irregular payment patterns'));
  }
  
  // Display personalized recommendations
  console.log('\n' + chalk.cyan('=== AI Recommendations ==='));
  
  if (selectedUser.name === 'Alice') {
    console.log(chalk.white('1. Increase your collateral by at least 50 IOTA to improve your risk score'));
    console.log(chalk.white('2. Maintain consistent transaction activity for at least 30 more days'));
    console.log(chalk.white('3. Complete identity verification for an immediate 10-point risk reduction'));
  } else if (selectedUser.name === 'Bob') {
    console.log(chalk.white('1. Maintain more stable wallet balances to show financial stability'));
    console.log(chalk.white('2. Complete identity verification for improved borrowing terms'));
    console.log(chalk.white('3. Consider consolidating your existing loans'));
  } else if (selectedUser.name === 'Charlie') {
    console.log(chalk.white('1. Add diverse collateral types to reduce liquidation risk'));
    console.log(chalk.white('2. Maintain consistent repayment schedule for current loans'));
    console.log(chalk.white('3. Build positive credit history with small, regular repayments'));
    console.log(chalk.white('4. Complete advanced identity verification'));
  }
  
  // Update risk score on-chain if connected to real contract
  if (lendingPool && selectedUser) {
    try {
      console.log('\n' + chalk.white('Updating risk score on-chain...'));
      
      // Check current on-chain risk score
      const currentScore = await lendingPool.riskScores(selectedUser.address);
      console.log(chalk.white(`Current on-chain risk score: ${currentScore}`));
      
      // Update risk score
      const tx = await lendingPool.updateRiskScore(selectedUser.address, riskScore);
      console.log(chalk.green(`Transaction hash: ${tx.hash}`));
      
      // Wait for confirmation
      await tx.wait();
      console.log(chalk.green('✓ Risk score updated successfully on-chain'));
      
      // Verify update
      const newScore = await lendingPool.riskScores(selectedUser.address);
      console.log(chalk.white(`New on-chain risk score: ${newScore}`));
    } catch (error) {
      console.error(chalk.red('Error updating risk score on-chain:'), error);
    }
  }
  
  // Wait for user to continue
  await pressAnyKey('Press any key to continue...');
}

/**
 * Privacy-Preserving Identity Demo
 */
async function privacyIdentityDemo() {
  if (!selectedUser) {
    console.log(chalk.yellow('⚠ Please select a user first'));
    await selectUser();
  }
  
  console.log('\n' + chalk.cyan('=== Privacy-Preserving Identity Demo ==='));
  console.log(chalk.white(`Demonstrating zero-knowledge identity verification for ${selectedUser.name}`));
  
  // Display identity verification options
  console.log('\n' + chalk.cyan('=== Available Verification Methods ==='));
  console.log(chalk.white('1. IOTA Zero-Knowledge Identity'));
  console.log(chalk.white('2. DLT Identity Framework'));
  console.log(chalk.white('3. Decentralized Biometric Verification'));
  
  const { method } = await inquirer.prompt({
    type: 'list',
    name: 'method',
    message: 'Select a verification method:',
    choices: [
      { name: 'IOTA Zero-Knowledge Identity', value: 'iota_zk' },
      { name: 'DLT Identity Framework', value: 'dlt_id' },
      { name: 'Decentralized Biometric Verification', value: 'biometric' }
    ]
  });
  
  const { level } = await inquirer.prompt({
    type: 'list',
    name: 'level',
    message: 'Select verification level:',
    choices: [
      { name: 'Basic Verification', value: 1 },
      { name: 'Advanced Verification', value: 2 },
      { name: 'Full Verification', value: 3 }
    ]
  });
  
  // Simulate verification process
  console.log('\n' + chalk.white('Initializing verification session...'));
  await simulateProgress(15);
  
  console.log('\n' + chalk.white('Generating zero-knowledge proof of identity...'));
  await simulateProgress(40);
  
  console.log('\n' + chalk.white('Verifying proof on-chain without revealing personal data...'));
  await simulateProgress(30);
  
  // Display a sample proof (for demonstration)
  console.log('\n' + chalk.cyan('=== Zero-Knowledge Proof ==='));
  console.log(chalk.gray('Proof: 0x7f8e9d3a2b1c4f5e6d7c8b9a0f1e2d3c4b5a6f7e8d9c0b1a2f3e4d5c6b7a8f9e0...'));
  console.log(chalk.gray('Public Inputs: [user address, timestamp, challenge]'));
  console.log(chalk.gray(`Verification Method: ${method}`));
  console.log(chalk.gray(`Verification Level: ${level}`));
  
  // Simulate contract interaction
  if (zkVerifier && selectedUser) {
    try {
      console.log('\n' + chalk.white('Submitting proof to ZK Verifier contract...'));
      
      // Mock proof data
      const proofType = ethers.utils.keccak256(
        ethers.utils.toUtf8Bytes(method === 'iota_zk' ? 'IDENTITY_VERIFICATION' : 
                                 method === 'dlt_id' ? 'DLT_IDENTITY' : 'BIOMETRIC_VERIFICATION')
      );
      
      const mockProof = ethers.utils.randomBytes(128);
      const mockPublicInputs = ethers.utils.defaultAbiCoder.encode(
        ['address', 'uint256', 'bytes32'],
        [selectedUser.address, Date.now(), ethers.utils.randomBytes(32)]
      );
      
      // Simulate verification
      console.log(chalk.white('Waiting for on-chain verification...'));
      
      // If using actual contract
      // const tx = await zkVerifier.verifyProof(proofType, mockProof, mockPublicInputs, selectedUser.address);
      // await tx.wait();
      
      // Simulate delay
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      console.log(chalk.green('✓ Identity verified successfully!'));
      
      // Update risk score based on verification level
      let riskReduction;
      if (level === 1) riskReduction = 5;
      else if (level === 2) riskReduction = 10;
      else riskReduction = 20;
      
      const newRiskScore = Math.max(0, selectedUser.profile.riskScore - riskReduction);
      
      console.log('\n' + chalk.cyan('=== Risk Score Impact ==='));
      console.log(chalk.white(`Previous Risk Score: ${selectedUser.profile.riskScore}`));
      console.log(chalk.white(`Risk Score Reduction: -${riskReduction} points`));
      console.log(chalk.white(`New Risk Score: ${newRiskScore}`));
      
      // Update user profile
      selectedUser.profile.riskScore = newRiskScore;
      
      // Update lending terms
      const baseRate = 3;
      const newRiskPremium = Math.floor(newRiskScore / 10);
      const newInterestRate = baseRate + newRiskPremium;
      
      console.log('\n' + chalk.cyan('=== Updated Lending Terms ==='));
      console.log(chalk.white(`New Interest Rate: ${newInterestRate}%`));
      console.log(chalk.white(`Borrowing Power Increase: +${level * 15}%`));
    } catch (error) {
      console.error(chalk.red('Error during identity verification:'), error);
    }
  } else {
    // Simulate success for demo
    await new Promise(resolve => setTimeout(resolve, 2000));
    console.log(chalk.green('✓ Identity verified successfully! (Simulation)'));
    
    // Update risk score based on verification level
    let riskReduction;
    if (level === 1) riskReduction = 5;
    else if (level === 2) riskReduction = 10;
    else riskReduction = 20;
    
    const newRiskScore = Math.max(0, selectedUser.profile.riskScore - riskReduction);
    
    console.log('\n' + chalk.cyan('=== Risk Score Impact ==='));
    console.log(chalk.white(`Previous Risk Score: ${selectedUser.profile.riskScore}`));
    console.log(chalk.white(`Risk Score Reduction: -${riskReduction} points`));
    console.log(chalk.white(`New Risk Score: ${newRiskScore}`));
    
    // Update user profile
    selectedUser.profile.riskScore = newRiskScore;
    
    // Update lending terms
    const baseRate = 3;
    const newRiskPremium = Math.floor(newRiskScore / 10);
    const newInterestRate = baseRate + newRiskPremium;
    
    console.log('\n' + chalk.cyan('=== Updated Lending Terms ==='));
    console.log(chalk.white(`New Interest Rate: ${newInterestRate}%`));
    console.log(chalk.white(`Borrowing Power Increase: +${level * 15}%`));
  }
  
  // Wait for user to continue
  await pressAnyKey('Press any key to continue...');
}

/**
 * Cross-Chain Liquidity Demo
 */
async function crossChainDemo() {
  if (!selectedUser) {
    console.log(chalk.yellow('⚠ Please select a user first'));
    await selectUser();
  }
  
  console.log('\n' + chalk.cyan('=== Cross-Chain Liquidity Demo ==='));
  console.log(chalk.white(`Demonstrating cross-chain liquidity management for ${selectedUser.name}`));
  
  // Display supported chains
  const supportedChains = [
    { id: '1', name: 'IOTA EVM', active: true, liquidity: '800', bridgeAddress: '0x...' },
    { id: '2', name: 'Ethereum', active: true, liquidity: '200', bridgeAddress: '0x...' },
    { id: '3', name: 'Shimmer', active: true, liquidity: '150', bridgeAddress: '0x...' }
  ];
  
  console.log('\n' + chalk.cyan('=== Supported Chains ==='));
  supportedChains.forEach(chain => {
    console.log(chalk.white(`- ${chain.name} (${chain.liquidity} IOTA Liquidity)`));
  });
  
  // Display liquidity pools
  const liquidityPools = [
    { symbol: 'IOTA', totalLiquidity: '1000', allocatedLiquidity: '700', utilizationRate: 0.7, apy: 0.085, active: true },
    { symbol: 'MIOTA', totalLiquidity: '500', allocatedLiquidity: '300', utilizationRate: 0.6, apy: 0.075, active: true },
    { symbol: 'iotaUSD', totalLiquidity: '2000', allocatedLiquidity: '1200', utilizationRate: 0.6, apy: 0.06, active: true }
  ];
  
  console.log('\n' + chalk.cyan('=== Liquidity Pools ==='));
  liquidityPools.forEach(pool => {
    console.log(chalk.white(`- ${pool.symbol}: ${pool.totalLiquidity} total, ${pool.allocatedLiquidity} allocated (${pool.apy * 100}% APY)`));
  });
  
  // Prompt for action
  const { action } = await inquirer.prompt({
    type: 'list',
    name: 'action',
    message: 'Select an action:',
    choices: [
      { name: 'Add Liquidity', value: 'add' },
      { name: 'Transfer Across Chains', value: 'transfer' },
      { name: 'View Strategies', value: 'strategies' },
      { name: 'Return to Main Menu', value: 'return' }
    ]
  });
  
  if (action === 'return') {
    return;
  }
  
  if (action === 'add') {
    // Prompt for token and amount
    const { token } = await inquirer.prompt({
      type: 'list',
      name: 'token',
      message: 'Select token:',
      choices: liquidityPools.map(pool => pool.symbol)
    });
    
    const { amount } = await inquirer.prompt({
      type: 'input',
      name: 'amount',
      message: 'Enter amount to add:',
      validate: value => !isNaN(parseFloat(value)) && parseFloat(value) > 0 ? true : 'Please enter a valid amount'
    });
    
    // Simulate adding liquidity
    console.log('\n' + chalk.white(`Adding ${amount} ${token} to liquidity pool...`));
    
    if (crossChainLiquidity && selectedUser) {
      try {
        // If using actual contract
        // const tx = await crossChainLiquidity.addLiquidity(token, ethers.utils.parseEther(amount));
        // await tx.wait();
        
        // Simulate delay
        await simulateProgress(30);
        
        console.log(chalk.green(`✓ Successfully added ${amount} ${token} to liquidity pool!`));
        
        // Update pool
        const pool = liquidityPools.find(p => p.symbol === token);
        pool.totalLiquidity = (parseFloat(pool.totalLiquidity) + parseFloat(amount)).toString();
        
        console.log(chalk.white(`\nNew ${token} liquidity: ${pool.totalLiquidity} ${token}`));
        console.log(chalk.white(`Expected annual yield: ${(parseFloat(amount) * pool.apy).toFixed(2)} ${token} (${pool.apy * 100}% APY)`));
      } catch (error) {
        console.error(chalk.red('Error adding liquidity:'), error);
      }
    } else {
      // Simulate success for demo
      await simulateProgress(30);
      
      console.log(chalk.green(`✓ Successfully added ${amount} ${token} to liquidity pool! (Simulation)`));
      
      // Update pool
      const pool = liquidityPools.find(p => p.symbol === token);
      pool.totalLiquidity = (parseFloat(pool.totalLiquidity) + parseFloat(amount)).toString();
      
      console.log(chalk.white(`\nNew ${token} liquidity: ${pool.totalLiquidity} ${token}`));
      console.log(chalk.white(`Expected annual yield: ${(parseFloat(amount) * pool.apy).toFixed(2)} ${token} (${pool.apy * 100}% APY)`));
    }
  }
  
  if (action === 'transfer') {
    // Prompt for token, amount, and destination
    const { token } = await inquirer.prompt({
      type: 'list',
      name: 'token',
      message: 'Select token to transfer:',
      choices: liquidityPools.map(pool => pool.symbol)
    });
    
    const { amount } = await inquirer.prompt({
      type: 'input',
      name: 'amount',
      message: 'Enter amount to transfer:',
      validate: value => !isNaN(parseFloat(value)) && parseFloat(value) > 0 ? true : 'Please enter a valid amount'
    });
    
    const { destination } = await inquirer.prompt({
      type: 'list',
      name: 'destination',
      message: 'Select destination chain:',
      choices: supportedChains.filter(chain => chain.name !== 'IOTA EVM').map(chain => chain.name)
    });
    
    // Simulate cross-chain transfer
    console.log('\n' + chalk.white(`Initiating transfer of ${amount} ${token} to ${destination}...`));
    
    if (crossChainLiquidity && selectedUser) {
      try {
        // If using actual contract
        // const destChain = supportedChains.find(chain => chain.name === destination);
        // const recipientBytes = ethers.utils.hexZeroPad(selectedUser.address, 32);
        // const tx = await crossChainLiquidity.initiateTransfer(
        //   destChain.id,
        //   recipientBytes,
        //   token,
        //   ethers.utils.parseEther(amount)
        // );
        // await tx.wait();
        
        // Simulate cross-chain communication
        console.log('\n' + chalk.white('Preparing cross-chain message...'));
        await simulateProgress(15);
        
        console.log('\n' + chalk.white('Sending message to bridge contract...'));
        await simulateProgress(20);
        
        console.log('\n' + chalk.white(`Transferring assets to ${destination} chain...`));
        await simulateProgress(40);
        
        console.log('\n' + chalk.white('Finalizing transfer on destination chain...'));
        await simulateProgress(25);
        
        console.log(chalk.green(`✓ Successfully initiated cross-chain transfer of ${amount} ${token} to ${destination}!`));
        
        // Display transfer details
        const transferId = '0x' + Math.random().toString(16).slice(2, 10);
        
        console.log('\n' + chalk.cyan('=== Transfer Details ==='));
        console.log(chalk.white(`Transfer ID: ${transferId}`));
        console.log(chalk.white(`From: IOTA EVM`));
        console.log(chalk.white(`To: ${destination}`));
        console.log(chalk.white(`Asset: ${token}`));
        console.log(chalk.white(`Amount: ${amount} ${token}`));
        console.log(chalk.white(`Status: In Progress`));
        console.log(chalk.white(`Estimated Completion Time: ~10 minutes`));
      } catch (error) {
        console.error(chalk.red('Error initiating cross-chain transfer:'), error);
      }
    } else {
      // Simulate success for demo
      console.log('\n' + chalk.white('Preparing cross-chain message...'));
      await simulateProgress(15);
      
      console.log('\n' + chalk.white('Sending message to bridge contract...'));
      await simulateProgress(20);
      
      console.log('\n' + chalk.white(`Transferring assets to ${destination} chain...`));
      await simulateProgress(40);
      
      console.log('\n' + chalk.white('Finalizing transfer on destination chain...'));
      await simulateProgress(25);
      
      console.log(chalk.green(`✓ Successfully initiated cross-chain transfer of ${amount} ${token} to ${destination}! (Simulation)`));
      
      // Display transfer details
      const transferId = '0x' + Math.random().toString(16).slice(2, 10);
      
      console.log('\n' + chalk.cyan('=== Transfer Details ==='));
      console.log(chalk.white(`Transfer ID: ${transferId}`));
      console.log(chalk.white(`From: IOTA EVM`));
      console.log(chalk.white(`To: ${destination}`));
      console.log(chalk.white(`Asset: ${token}`));
      console.log(chalk.white(`Amount: ${amount} ${token}`));
      console.log(chalk.white(`Status: In Progress`));
      console.log(chalk.white(`Estimated Completion Time: ~10 minutes`));
    }
  }
  
  if (action === 'strategies') {
    // Display yield strategies
    const strategies = [
      { 
        id: 'strategy1', 
        name: 'Yield Aggregator', 
        description: 'Automatically allocates funds to the highest yielding protocols', 
        apy: 12.5, 
        risk: 'Medium',
        active: true
      },
      { 
        id: 'strategy2', 
        name: 'Liquidity Provider', 
        description: 'Provides liquidity to DEXes for trading fees', 
        apy: 8.2, 
        risk: 'Low',
        active: true
      },
      { 
        id: 'strategy3', 
        name: 'Flash Loan Provider', 
        description: 'Generates fees by providing flash loans', 
        apy: 5.7, 
        risk: 'Low',
        active: true
      }
    ];
    
    console.log('\n' + chalk.cyan('=== AI-Optimized Yield Strategies ==='));
    strategies.forEach(strategy => {
      console.log('\n' + chalk.white(`${strategy.name} (${strategy.apy}% APY, ${strategy.risk} Risk)`));
      console.log(chalk.gray(`- ${strategy.description}`));
    });
    
    // Prompt for strategy allocation
    const { strategy } = await inquirer.prompt({
      type: 'list',
      name: 'strategy',
      message: 'Select a strategy to allocate funds:',
      choices: strategies.map(s => ({ name: `${s.name} (${s.apy}% APY, ${s.risk} Risk)`, value: s.id }))
    });
    
    const { token } = await inquirer.prompt({
      type: 'list',
      name: 'token',
      message: 'Select token:',
      choices: liquidityPools.map(pool => pool.symbol)
    });
    
    const { amount } = await inquirer.prompt({
      type: 'input',
      name: 'amount',
      message: 'Enter amount to allocate:',
      validate: value => !isNaN(parseFloat(value)) && parseFloat(value) > 0 ? true : 'Please enter a valid amount'
    });
    
    // Simulate strategy allocation
    const selectedStrategy = strategies.find(s => s.id === strategy);
    
    console.log('\n' + chalk.white(`Allocating ${amount} ${token} to ${selectedStrategy.name} strategy...`));
    
    if (crossChainLiquidity && selectedUser) {
      try {
        // If using actual contract
        // const tx = await crossChainLiquidity.executeStrategy(token, selectedStrategy.name, ethers.utils.parseEther(amount));
        // await tx.wait();
        
        // Simulate delay
        await simulateProgress(50);
        
        console.log(chalk.green(`✓ Successfully allocated ${amount} ${token} to ${selectedStrategy.name} strategy!`));
        
        // Display expected returns
        const expectedAnnualYield = parseFloat(amount) * (selectedStrategy.apy / 100);
        
        console.log('\n' + chalk.cyan('=== Expected Returns ==='));
        console.log(chalk.white(`Annual Yield: ${expectedAnnualYield.toFixed(2)} ${token} (${selectedStrategy.apy}% APY)`));
        console.log(chalk.white(`Monthly Yield: ${(expectedAnnualYield / 12).toFixed(2)} ${token}`));
        console.log(chalk.white(`Risk Level: ${selectedStrategy.risk}`));
      } catch (error) {
        console.error(chalk.red('Error allocating to strategy:'), error);
      }
    } else {
      // Simulate success for demo
      await simulateProgress(50);
      
      console.log(chalk.green(`✓ Successfully allocated ${amount} ${token} to ${selectedStrategy.name} strategy! (Simulation)`));
      
      // Display expected returns
      const expectedAnnualYield = parseFloat(amount) * (selectedStrategy.apy / 100);
      
      console.log('\n' + chalk.cyan('=== Expected Returns ==='));
      console.log(chalk.white(`Annual Yield: ${expectedAnnualYield.toFixed(2)} ${token} (${selectedStrategy.apy}% APY)`));
      console.log(chalk.white(`Monthly Yield: ${(expectedAnnualYield / 12).toFixed(2)} ${token}`));
      console.log(chalk.white(`Risk Level: ${selectedStrategy.risk}`));
    }
  }
  
  // Wait for user to continue
  await pressAnyKey('Press any key to continue...');
}

/**
 * Lending Operations Demo
 */
async function lendingOperationsDemo() {
  if (!selectedUser) {
    console.log(chalk.yellow('⚠ Please select a user first'));
    await selectUser();
  }
  
  console.log('\n' + chalk.cyan('=== Lending Operations Demo ==='));
  console.log(chalk.white(`Demonstrating lending operations for ${selectedUser.name}`));
  
  // Display user's lending profile
  console.log('\n' + chalk.cyan('=== Lending Profile ==='));
  console.log(chalk.white(`Deposits: ${selectedUser.profile.deposits} IOTA`));
  console.log(chalk.white(`Borrows: ${selectedUser.profile.borrows} IOTA`));
  console.log(chalk.white(`Collateral: ${selectedUser.profile.collateral} IOTA`));
  
  // Calculate health factor
  const collateralValue = parseFloat(selectedUser.profile.collateral);
  const borrowValue = parseFloat(selectedUser.profile.borrows);
  const liquidationThreshold = 0.83; // 83%
  
  const healthFactor = borrowValue > 0 ? 
    (collateralValue * liquidationThreshold) / borrowValue : 
    999; // Very high if no borrows
  
  let healthColor;
  if (healthFactor >= 2) healthColor = chalk.green;
  else if (healthFactor >= 1.5) healthColor = chalk.greenBright;
  else if (healthFactor >= 1.1) healthColor = chalk.yellow;
  else healthColor = chalk.red;
  
  console.log(healthColor(`Health Factor: ${healthFactor.toFixed(2)}`));
  
  // Calculate interest rate
  const baseRate = 3;
  const riskPremium = Math.floor(selectedUser.profile.riskScore / 10);
  const interestRate = baseRate + riskPremium;
  
  console.log(chalk.white(`Current Interest Rate: ${interestRate}%`));
  console.log(chalk.white(`- Base Rate: ${baseRate}%`));
  console.log(chalk.white(`- Risk Premium: ${riskPremium}%`));
  
  // Calculate borrowing power
  const maxBorrowRatio = 0.75; // 75%
  const maxBorrow = collateralValue * maxBorrowRatio;
  const remainingBorrowPower = maxBorrow - borrowValue;
  
  console.log(chalk.white(`Available Borrowing Power: ${remainingBorrowPower.toFixed(2)} IOTA`));
  
  // Prompt for action
  const { action } = await inquirer.prompt({
    type: 'list',
    name: 'action',
    message: 'Select an action:',
    choices: [
      { name: 'Deposit', value: 'deposit' },
      { name: 'Borrow', value: 'borrow' },
      { name: 'Repay', value: 'repay' },
      { name: 'Withdraw', value: 'withdraw' },
      { name: 'Add Collateral', value: 'add_collateral' },
      { name: 'Remove Collateral', value: 'remove_collateral' },
      { name: 'Return to Main Menu', value: 'return' }
    ]
  });
  
  if (action === 'return') {
    return;
  }
  
  // Handle deposit
  if (action === 'deposit') {
    const { amount } = await inquirer.prompt({
      type: 'input',
      name: 'amount',
      message: 'Enter amount to deposit:',
      validate: value => !isNaN(parseFloat(value)) && parseFloat(value) > 0 ? true : 'Please enter a valid amount'
    });
    
    console.log('\n' + chalk.white(`Depositing ${amount} IOTA...`));
    
    if (lendingPool && selectedUser) {
      try {
        // If using actual contract
        // const tx = await lendingPool.deposit(ethers.utils.parseEther(amount));
        // await tx.wait();
        
        // Simulate delay
        await simulateProgress(20);
        
        console.log(chalk.green(`✓ Successfully deposited ${amount} IOTA!`));
        
        // Update user profile
        selectedUser.profile.deposits = (parseFloat(selectedUser.profile.deposits) + parseFloat(amount)).toString();
        
        // Display updated profile
        console.log('\n' + chalk.cyan('=== Updated Lending Profile ==='));
        console.log(chalk.white(`Deposits: ${selectedUser.profile.deposits} IOTA`));
        console.log(chalk.white(`Borrows: ${selectedUser.profile.borrows} IOTA`));
      } catch (error) {
        console.error(chalk.red('Error depositing:'), error);
      }
    } else {
      // Simulate success for demo
      await simulateProgress(20);
      
      console.log(chalk.green(`✓ Successfully deposited ${amount} IOTA! (Simulation)`));
      
      // Update user profile
      selectedUser.profile.deposits = (parseFloat(selectedUser.profile.deposits) + parseFloat(amount)).toString();
      
      // Display updated profile
      console.log('\n' + chalk.cyan('=== Updated Lending Profile ==='));
      console.log(chalk.white(`Deposits: ${selectedUser.profile.deposits} IOTA`));
      console.log(chalk.white(`Borrows: ${selectedUser.profile.borrows} IOTA`));
    }
  }
  
  // Handle borrow
  if (action === 'borrow') {
    const { amount } = await inquirer.prompt({
      type: 'input',
      name: 'amount',
      message: 'Enter amount to borrow:',
      validate: value => {
        const parsedValue = parseFloat(value);
        if (isNaN(parsedValue) || parsedValue <= 0) return 'Please enter a valid amount';
        if (parsedValue > remainingBorrowPower) return `Exceeds borrowing power (max: ${remainingBorrowPower.toFixed(2)} IOTA)`;
        return true;
      }
    });
    
    console.log('\n' + chalk.white(`Borrowing ${amount} IOTA at ${interestRate}% interest rate...`));
    
    if (lendingPool && selectedUser) {
      try {
        // If using actual contract
        // const tx = await lendingPool.borrow(ethers.utils.parseEther(amount));
        // await tx.wait();
        
        // Simulate delay
        await simulateProgress(30);
        
        console.log(chalk.green(`✓ Successfully borrowed ${amount} IOTA!`));
        
        // Update user profile
        selectedUser.profile.borrows = (parseFloat(selectedUser.profile.borrows) + parseFloat(amount)).toString();
        
        // Calculate new health factor
        const newBorrowValue = parseFloat(selectedUser.profile.borrows);
        const newHealthFactor = (collateralValue * liquidationThreshold) / newBorrowValue;
        
        // Display updated profile
        console.log('\n' + chalk.cyan('=== Updated Lending Profile ==='));
        console.log(chalk.white(`Deposits: ${selectedUser.profile.deposits} IOTA`));
        console.log(chalk.white(`Borrows: ${selectedUser.profile.borrows} IOTA`));
        
        let newHealthColor;
        if (newHealthFactor >= 2) newHealthColor = chalk.green;
        else if (newHealthFactor >= 1.5) newHealthColor = chalk.greenBright;
        else if (newHealthFactor >= 1.1) newHealthColor = chalk.yellow;
        else newHealthColor = chalk.red;
        
        console.log(newHealthColor(`Health Factor: ${newHealthFactor.toFixed(2)}`));
        
        if (newHealthFactor < 1.5) {
          console.log(chalk.yellow('\n⚠ Warning: Your health factor is getting low. Consider adding more collateral to avoid liquidation risk.'));
        }
      } catch (error) {
        console.error(chalk.red('Error borrowing:'), error);
      }
    } else {
      // Simulate success for demo
      await simulateProgress(30);
      
      console.log(chalk.green(`✓ Successfully borrowed ${amount} IOTA! (Simulation)`));
      
      // Update user profile
      selectedUser.profile.borrows = (parseFloat(selectedUser.profile.borrows) + parseFloat(amount)).toString();
      
      // Calculate new health factor
      const newBorrowValue = parseFloat(selectedUser.profile.borrows);
      const newHealthFactor = newBorrowValue > 0 ? (collateralValue * liquidationThreshold) / newBorrowValue : 999;
      
      // Display updated profile
      console.log('\n' + chalk.cyan('=== Updated Lending Profile ==='));
      console.log(chalk.white(`Deposits: ${selectedUser.profile.deposits} IOTA`));
      console.log(chalk.white(`Borrows: ${selectedUser.profile.borrows} IOTA`));
      
      let newHealthColor;
      if (newHealthFactor >= 2) newHealthColor = chalk.green;
      else if (newHealthFactor >= 1.5) newHealthColor = chalk.greenBright;
      else if (newHealthFactor >= 1.1) newHealthColor = chalk.yellow;
      else newHealthColor = chalk.red;
      
      console.log(newHealthColor(`Health Factor: ${newHealthFactor.toFixed(2)}`));
      
      if (newHealthFactor < 1.5) {
        console.log(chalk.yellow('\n⚠ Warning: Your health factor is getting low. Consider adding more collateral to avoid liquidation risk.'));
      }
    }
  }
  
  // Handle repay
  if (action === 'repay') {
    const maxRepay = parseFloat(selectedUser.profile.borrows);
    
    if (maxRepay <= 0) {
      console.log(chalk.yellow('\n⚠ You have no outstanding borrows to repay.'));
      await pressAnyKey('Press any key to continue...');
      return;
    }
    
    const { amount } = await inquirer.prompt({
      type: 'input',
      name: 'amount',
      message: 'Enter amount to repay:',
      validate: value => {
        const parsedValue = parseFloat(value);
        if (isNaN(parsedValue) || parsedValue <= 0) return 'Please enter a valid amount';
        if (parsedValue > maxRepay) return `Exceeds outstanding borrow (max: ${maxRepay.toFixed(2)} IOTA)`;
        return true;
      }
    });
    
    console.log('\n' + chalk.white(`Repaying ${amount} IOTA...`));
    
    if (lendingPool && selectedUser) {
      try {
        // If using actual contract
        // const tx = await lendingPool.repay(ethers.utils.parseEther(amount));
        // await tx.wait();
        
        // Simulate delay
        await simulateProgress(25);
        
        console.log(chalk.green(`✓ Successfully repaid ${amount} IOTA!`));
        
        // Update user profile
        selectedUser.profile.borrows = (parseFloat(selectedUser.profile.borrows) - parseFloat(amount)).toString();
        
        // Calculate new health factor
        const newBorrowValue = parseFloat(selectedUser.profile.borrows);
        const newHealthFactor = newBorrowValue > 0 ? (collateralValue * liquidationThreshold) / newBorrowValue : 999;
        
        // Display updated profile
        console.log('\n' + chalk.cyan('=== Updated Lending Profile ==='));
        console.log(chalk.white(`Deposits: ${selectedUser.profile.deposits} IOTA`));
        console.log(chalk.white(`Borrows: ${selectedUser.profile.borrows} IOTA`));
        
        let newHealthColor;
        if (newHealthFactor >= 2) newHealthColor = chalk.green;
        else if (newHealthFactor >= 1.5) newHealthColor = chalk.greenBright;
        else if (newHealthFactor >= 1.1) newHealthColor = chalk.yellow;
        else newHealthColor = chalk.red;
        
        console.log(newHealthColor(`Health Factor: ${newHealthFactor.toFixed(2)}`));
      } catch (error) {
        console.error(chalk.red('Error repaying:'), error);
      }
    } else {
      // Simulate success for demo
      await simulateProgress(25);
      
      console.log(chalk.green(`✓ Successfully repaid ${amount} IOTA! (Simulation)`));
      
      // Update user profile
      selectedUser.profile.borrows = (parseFloat(selectedUser.profile.borrows) - parseFloat(amount)).toString();
      
      // Calculate new health factor
      const newBorrowValue = parseFloat(selectedUser.profile.borrows);
      const newHealthFactor = newBorrowValue > 0 ? (collateralValue * liquidationThreshold) / newBorrowValue : 999;
      
      // Display updated profile
      console.log('\n' + chalk.cyan('=== Updated Lending Profile ==='));
      console.log(chalk.white(`Deposits: ${selectedUser.profile.deposits} IOTA`));
      console.log(chalk.white(`Borrows: ${selectedUser.profile.borrows} IOTA`));
      
      let newHealthColor;
      if (newHealthFactor >= 2) newHealthColor = chalk.green;
      else if (newHealthFactor >= 1.5) newHealthColor = chalk.greenBright;
      else if (newHealthFactor >= 1.1) newHealthColor = chalk.yellow;
      else newHealthColor = chalk.red;
      
      console.log(newHealthColor(`Health Factor: ${newHealthFactor.toFixed(2)}`));
    }
  }
  
  // Handle withdraw
  if (action === 'withdraw') {
    const maxWithdraw = parseFloat(selectedUser.profile.deposits);
    
    if (maxWithdraw <= 0) {
      console.log(chalk.yellow('\n⚠ You have no deposits to withdraw.'));
      await pressAnyKey('Press any key to continue...');
      return;
    }
    
    const { amount } = await inquirer.prompt({
      type: 'input',
      name: 'amount',
      message: 'Enter amount to withdraw:',
      validate: value => {
        const parsedValue = parseFloat(value);
        if (isNaN(parsedValue) || parsedValue <= 0) return 'Please enter a valid amount';
        if (parsedValue > maxWithdraw) return `Exceeds deposits (max: ${maxWithdraw.toFixed(2)} IOTA)`;
        return true;
      }
    });
    
    console.log('\n' + chalk.white(`Withdrawing ${amount} IOTA...`));
    
    if (lendingPool && selectedUser) {
      try {
        // If using actual contract
        // const tx = await lendingPool.withdraw(ethers.utils.parseEther(amount));
        // await tx.wait();
        
        // Simulate delay
        await simulateProgress(20);
        
        console.log(chalk.green(`✓ Successfully withdrew ${amount} IOTA!`));
        
        // Update user profile
        selectedUser.profile.deposits = (parseFloat(selectedUser.profile.deposits) - parseFloat(amount)).toString();
        
        // Display updated profile
        console.log('\n' + chalk.cyan('=== Updated Lending Profile ==='));
        console.log(chalk.white(`Deposits: ${selectedUser.profile.deposits} IOTA`));
        console.log(chalk.white(`Borrows: ${selectedUser.profile.borrows} IOTA`));
      } catch (error) {
        console.error(chalk.red('Error withdrawing:'), error);
      }
    } else {
      // Simulate success for demo
      await simulateProgress(20);
      
      console.log(chalk.green(`✓ Successfully withdrew ${amount} IOTA! (Simulation)`));
      
      // Update user profile
      selectedUser.profile.deposits = (parseFloat(selectedUser.profile.deposits) - parseFloat(amount)).toString();
      
      // Display updated profile
      console.log('\n' + chalk.cyan('=== Updated Lending Profile ==='));
      console.log(chalk.white(`Deposits: ${selectedUser.profile.deposits} IOTA`));
      console.log(chalk.white(`Borrows: ${selectedUser.profile.borrows} IOTA`));
    }
  }
  
  // Handle add collateral
  if (action === 'add_collateral') {
    const { amount } = await inquirer.prompt({
      type: 'input',
      name: 'amount',
      message: 'Enter amount of collateral to add:',
      validate: value => !isNaN(parseFloat(value)) && parseFloat(value) > 0 ? true : 'Please enter a valid amount'
    });
    
    console.log('\n' + chalk.white(`Adding ${amount} IOTA as collateral...`));
    
    if (lendingPool && selectedUser) {
      try {
        // If using actual contract
        // const tx = await lendingPool.addCollateral(ethers.utils.parseEther(amount));
        // await tx.wait();
        
        // Simulate delay
        await simulateProgress(25);
        
        console.log(chalk.green(`✓ Successfully added ${amount} IOTA as collateral!`));
        
        // Update user profile
        selectedUser.profile.collateral = (parseFloat(selectedUser.profile.collateral) + parseFloat(amount)).toString();
        
        // Calculate new health factor
        const newCollateralValue = parseFloat(selectedUser.profile.collateral);
        const newHealthFactor = borrowValue > 0 ? (newCollateralValue * liquidationThreshold) / borrowValue : 999;
        
        // Display updated profile
        console.log('\n' + chalk.cyan('=== Updated Lending Profile ==='));
        console.log(chalk.white(`Collateral: ${selectedUser.profile.collateral} IOTA`));
        console.log(chalk.white(`Borrows: ${selectedUser.profile.borrows} IOTA`));
        
        let newHealthColor;
        if (newHealthFactor >= 2) newHealthColor = chalk.green;
        else if (newHealthFactor >= 1.5) newHealthColor = chalk.greenBright;
        else if (newHealthFactor >= 1.1) newHealthColor = chalk.yellow;
        else newHealthColor = chalk.red;
        
        console.log(newHealthColor(`Health Factor: ${newHealthFactor.toFixed(2)}`));
        
        // Display new borrowing power
        const newMaxBorrowRatio = 0.75; // 75%
        const newMaxBorrow = newCollateralValue * newMaxBorrowRatio;
        const newRemainingBorrowPower = newMaxBorrow - borrowValue;
        
        console.log(chalk.white(`Available Borrowing Power: ${newRemainingBorrowPower.toFixed(2)} IOTA (+${(newRemainingBorrowPower - remainingBorrowPower).toFixed(2)})`));
      } catch (error) {
        console.error(chalk.red('Error adding collateral:'), error);
      }
    } else {
      // Simulate success for demo
      await simulateProgress(25);
      
      console.log(chalk.green(`✓ Successfully added ${amount} IOTA as collateral! (Simulation)`));
      
      // Update user profile
      selectedUser.profile.collateral = (parseFloat(selectedUser.profile.collateral) + parseFloat(amount)).toString();
      
      // Calculate new health factor
      const newCollateralValue = parseFloat(selectedUser.profile.collateral);
      const newHealthFactor = borrowValue > 0 ? (newCollateralValue * liquidationThreshold) / borrowValue : 999;
      
      // Display updated profile
      console.log('\n' + chalk.cyan('=== Updated Lending Profile ==='));
      console.log(chalk.white(`Collateral: ${selectedUser.profile.collateral} IOTA`));
      console.log(chalk.white(`Borrows: ${selectedUser.profile.borrows} IOTA`));
      
      let newHealthColor;
      if (newHealthFactor >= 2) newHealthColor = chalk.green;
      else if (newHealthFactor >= 1.5) newHealthColor = chalk.greenBright;
      else if (newHealthFactor >= 1.1) newHealthColor = chalk.yellow;
      else newHealthColor = chalk.red;
      
      console.log(newHealthColor(`Health Factor: ${newHealthFactor.toFixed(2)}`));
      
      // Display new borrowing power
      const newMaxBorrowRatio = 0.75; // 75%
      const newMaxBorrow = newCollateralValue * newMaxBorrowRatio;
      const newRemainingBorrowPower = newMaxBorrow - borrowValue;
      
      console.log(chalk.white(`Available Borrowing Power: ${newRemainingBorrowPower.toFixed(2)} IOTA (+${(newRemainingBorrowPower - remainingBorrowPower).toFixed(2)})`));
    }
  }
  
  // Handle remove collateral
  if (action === 'remove_collateral') {
    // Calculate maximum removable collateral
    const requiredCollateral = borrowValue / maxBorrowRatio;
    const removableCollateral = Math.max(0, collateralValue - requiredCollateral);
    
    if (removableCollateral <= 0) {
      console.log(chalk.yellow('\n⚠ You cannot remove any collateral without repaying some loans first.'));
      await pressAnyKey('Press any key to continue...');
      return;
    }
    
    const { amount } = await inquirer.prompt({
      type: 'input',
      name: 'amount',
      message: 'Enter amount of collateral to remove:',
      validate: value => {
        const parsedValue = parseFloat(value);
        if (isNaN(parsedValue) || parsedValue <= 0) return 'Please enter a valid amount';
        if (parsedValue > removableCollateral) return `Exceeds removable collateral (max: ${removableCollateral.toFixed(2)} IOTA)`;
        return true;
      }
    });
    
    console.log('\n' + chalk.white(`Removing ${amount} IOTA of collateral...`));
    
    if (lendingPool && selectedUser) {
      try {
        // If using actual contract
        // const tx = await lendingPool.removeCollateral(ethers.utils.parseEther(amount));
        // await tx.wait();
        
        // Simulate delay
        await simulateProgress(25);
        
        console.log(chalk.green(`✓ Successfully removed ${amount} IOTA of collateral!`));
        
        // Update user profile
        selectedUser.profile.collateral = (parseFloat(selectedUser.profile.collateral) - parseFloat(amount)).toString();
        
        // Calculate new health factor
        const newCollateralValue = parseFloat(selectedUser.profile.collateral);
        const newHealthFactor = borrowValue > 0 ? (newCollateralValue * liquidationThreshold) / borrowValue : 999;
        
        // Display updated profile
        console.log('\n' + chalk.cyan('=== Updated Lending Profile ==='));
        console.log(chalk.white(`Collateral: ${selectedUser.profile.collateral} IOTA`));
        console.log(chalk.white(`Borrows: ${selectedUser.profile.borrows} IOTA`));
        
        let newHealthColor;
        if (newHealthFactor >= 2) newHealthColor = chalk.green;
        else if (newHealthFactor >= 1.5) newHealthColor = chalk.greenBright;
        else if (newHealthFactor >= 1.1) newHealthColor = chalk.yellow;
        else newHealthColor = chalk.red;
        
        console.log(newHealthColor(`Health Factor: ${newHealthFactor.toFixed(2)}`));
        
        if (newHealthFactor < 1.5) {
          console.log(chalk.yellow('\n⚠ Warning: Your health factor is getting low. Consider adding more collateral to avoid liquidation risk.'));
        }
      } catch (error) {
        console.error(chalk.red('Error removing collateral:'), error);
      }
    } else {
      // Simulate success for demo
      await simulateProgress(25);
      
      console.log(chalk.green(`✓ Successfully removed ${amount} IOTA of collateral! (Simulation)`));
      
      // Update user profile
      selectedUser.profile.collateral = (parseFloat(selectedUser.profile.collateral) - parseFloat(amount)).toString();
      
      // Calculate new health factor
      const newCollateralValue = parseFloat(selectedUser.profile.collateral);
      const newHealthFactor = borrowValue > 0 ? (newCollateralValue * liquidationThreshold) / borrowValue : 999;
      
      // Display updated profile
      console.log('\n' + chalk.cyan('=== Updated Lending Profile ==='));
      console.log(chalk.white(`Collateral: ${selectedUser.profile.collateral} IOTA`));
      console.log(chalk.white(`Borrows: ${selectedUser.profile.borrows} IOTA`));
      
      let newHealthColor;
      if (newHealthFactor >= 2) newHealthColor = chalk.green;
      else if (newHealthFactor >= 1.5) newHealthColor = chalk.greenBright;
      else if (newHealthFactor >= 1.1) newHealthColor = chalk.yellow;
      else newHealthColor = chalk.red;
      
      console.log(newHealthColor(`Health Factor: ${newHealthFactor.toFixed(2)}`));
      
      if (newHealthFactor < 1.5) {
        console.log(chalk.yellow('\n⚠ Warning: Your health factor is getting low. Consider adding more collateral to avoid liquidation risk.'));
      }
    }
  }
  
  // Wait for user to continue
  await pressAnyKey('Press any key to continue...');
}

/**
 * Run a full demo scenario
 */
async function runFullDemo() {
  console.log('\n' + chalk.cyan('=== Full IntelliLend Demo Scenario ==='));
  console.log(chalk.white('This will walk through a complete user journey with IntelliLend.'));
  
  // Select a user (default to Alice)
  selectedUser = users.find(u => u.name === 'Alice');
  console.log(chalk.white(`\nDemo user: ${selectedUser.name} (${selectedUser.address})`));
  
  // Display user profile
  console.log('\n' + chalk.cyan('=== Initial User Profile ==='));
  console.log(chalk.white(`Risk Score: ${selectedUser.profile.riskScore}`));
  console.log(chalk.white(`Collateral: ${selectedUser.profile.collateral} IOTA`));
  console.log(chalk.white(`Deposits: ${selectedUser.profile.deposits} IOTA`));
  console.log(chalk.white(`Borrows: ${selectedUser.profile.borrows} IOTA`));
  
  await pressAnyKey('Press any key to run AI risk assessment...');
  
  // Step 1: Run AI risk assessment
  console.log('\n' + chalk.cyan('STEP 1: AI Risk Assessment'));
  console.log(chalk.white('Running AI risk assessment...'));
  
  // Simulate AI analysis
  console.log(chalk.white('\nCollecting on-chain data...'));
  await simulateProgress(20);
  
  console.log(chalk.white('\nAnalyzing transaction patterns...'));
  await simulateProgress(30);
  
  console.log(chalk.white('\nEvaluating borrowing history...'));
  await simulateProgress(25);
  
  console.log(chalk.white('\nAssessing collateral quality...'));
  await simulateProgress(15);
  
  console.log(chalk.white('\nGenerating risk assessment...'));
  await simulateProgress(10);
  
  // Display risk assessment
  const riskScore = selectedUser.profile.riskScore;
  
  console.log('\n' + chalk.cyan('=== Risk Assessment Results ==='));
  console.log(chalk.green(`Risk Score: ${riskScore}/100 (Low Risk)`));
  
  await pressAnyKey('Press any key to continue to identity verification...');
  
  // Step 2: Privacy-preserving identity verification
  console.log('\n' + chalk.cyan('STEP 2: Privacy-Preserving Identity Verification'));
  console.log(chalk.white('Performing zero-knowledge identity verification...'));
  
  // Simulate verification process
  console.log('\n' + chalk.white('Initializing verification session...'));
  await simulateProgress(15);
  
  console.log('\n' + chalk.white('Generating zero-knowledge proof of identity...'));
  await simulateProgress(40);
  
  console.log('\n' + chalk.white('Verifying proof on-chain without revealing personal data...'));
  await simulateProgress(30);
  
  console.log(chalk.green('✓ Identity verified successfully at Advanced level!'));
  
  // Update risk score based on verification
  const riskReduction = 10; // Advanced level
  const newRiskScore = Math.max(0, selectedUser.profile.riskScore - riskReduction);
  
  console.log('\n' + chalk.cyan('=== Risk Score Impact ==='));
  console.log(chalk.white(`Previous Risk Score: ${selectedUser.profile.riskScore}`));
  console.log(chalk.white(`Risk Score Reduction: -${riskReduction} points`));
  console.log(chalk.white(`New Risk Score: ${newRiskScore}`));
  
  // Update user profile
  selectedUser.profile.riskScore = newRiskScore;
  
  await pressAnyKey('Press any key to continue to lending operations...');
  
  // Step 3: Lending operations
  console.log('\n' + chalk.cyan('STEP 3: Lending Operations'));
  
  // Add more collateral
  const collateralToAdd = 50;
  console.log(chalk.white(`Adding ${collateralToAdd} IOTA as collateral...`));
  await simulateProgress(25);
  
  console.log(chalk.green(`✓ Successfully added ${collateralToAdd} IOTA as collateral!`));
  
  // Update user profile
  selectedUser.profile.collateral = (parseFloat(selectedUser.profile.collateral) + collateralToAdd).toString();
  
  // Display updated profile
  console.log('\n' + chalk.cyan('=== Updated Lending Profile ==='));
  console.log(chalk.white(`Collateral: ${selectedUser.profile.collateral} IOTA`));
  
  // Calculate new health factor and borrowing power
  const collateralValue = parseFloat(selectedUser.profile.collateral);
  const borrowValue = parseFloat(selectedUser.profile.borrows);
  const liquidationThreshold = 0.83; // 83%
  const maxBorrowRatio = 0.75; // 75%
  
  const healthFactor = borrowValue > 0 ? 
    (collateralValue * liquidationThreshold) / borrowValue : 999;
  
  console.log(chalk.green(`Health Factor: ${healthFactor.toFixed(2)}`));
  
  const maxBorrow = collateralValue * maxBorrowRatio;
  const remainingBorrowPower = maxBorrow - borrowValue;
  
  console.log(chalk.white(`Available Borrowing Power: ${remainingBorrowPower.toFixed(2)} IOTA`));
  
  // Borrow more funds
  const borrowAmount = 75;
  console.log('\n' + chalk.white(`Borrowing ${borrowAmount} IOTA...`));
  await simulateProgress(30);
  
  console.log(chalk.green(`✓ Successfully borrowed ${borrowAmount} IOTA!`));
  
  // Update user profile
  selectedUser.profile.borrows = (parseFloat(selectedUser.profile.borrows) + borrowAmount).toString();
  
  // Calculate new health factor
  const newBorrowValue = parseFloat(selectedUser.profile.borrows);
  const newHealthFactor = (collateralValue * liquidationThreshold) / newBorrowValue;
  
  // Display updated profile
  console.log('\n' + chalk.cyan('=== Updated Lending Profile ==='));
  console.log(chalk.white(`Collateral: ${selectedUser.profile.collateral} IOTA`));
  console.log(chalk.white(`Borrows: ${selectedUser.profile.borrows} IOTA`));
  console.log(chalk.yellow(`Health Factor: ${newHealthFactor.toFixed(2)}`));
  
  await pressAnyKey('Press any key to continue to cross-chain operations...');
  
  // Step 4: Cross-chain liquidity
  console.log('\n' + chalk.cyan('STEP 4: Cross-Chain Liquidity Management'));
  
  // Display supported chains
  const supportedChains = [
    { id: '1', name: 'IOTA EVM', active: true, liquidity: '800', bridgeAddress: '0x...' },
    { id: '2', name: 'Ethereum', active: true, liquidity: '200', bridgeAddress: '0x...' },
    { id: '3', name: 'Shimmer', active: true, liquidity: '150', bridgeAddress: '0x...' }
  ];
  
  console.log(chalk.white('Supported blockchain networks:'));
  supportedChains.forEach(chain => {
    console.log(chalk.white(`- ${chain.name}`));
  });
  
  // Transfer across chains
  const transferAmount = 25;
  const destinationChain = 'Ethereum';
  
  console.log('\n' + chalk.white(`Initiating cross-chain transfer of ${transferAmount} IOTA to ${destinationChain}...`));
  
  console.log('\n' + chalk.white('Preparing cross-chain message...'));
  await simulateProgress(15);
  
  console.log('\n' + chalk.white('Sending message to bridge contract...'));
  await simulateProgress(20);
  
  console.log('\n' + chalk.white(`Transferring assets to ${destinationChain} chain...`));
  await simulateProgress(40);
  
  console.log('\n' + chalk.white('Finalizing transfer on destination chain...'));
  await simulateProgress(25);
  
  console.log(chalk.green(`✓ Successfully transferred ${transferAmount} IOTA to ${destinationChain}!`));
  
  await pressAnyKey('Press any key to continue to yield strategies...');
  
  // Step 5: Yield strategies
  console.log('\n' + chalk.cyan('STEP 5: AI-Optimized Yield Strategies'));
  
  // Display yield strategies
  const strategies = [
    { 
      id: 'strategy1', 
      name: 'Yield Aggregator', 
      description: 'Automatically allocates funds to the highest yielding protocols', 
      apy: 12.5, 
      risk: 'Medium',
      active: true
    },
    { 
      id: 'strategy2', 
      name: 'Liquidity Provider', 
      description: 'Provides liquidity to DEXes for trading fees', 
      apy: 8.2, 
      risk: 'Low',
      active: true
    }
  ];
  
  console.log(chalk.white('AI-optimized yield strategies:'));
  strategies.forEach(strategy => {
    console.log(chalk.white(`- ${strategy.name} (${strategy.apy}% APY, ${strategy.risk} Risk)`));
  });
  
  // Allocate to strategy
  const strategyAmount = 50;
  const selectedStrategy = strategies[1]; // Low risk strategy
  
  console.log('\n' + chalk.white(`Allocating ${strategyAmount} IOTA to ${selectedStrategy.name} strategy...`));
  await simulateProgress(30);
  
  console.log(chalk.green(`✓ Successfully allocated ${strategyAmount} IOTA to yield strategy!`));
  
  // Display expected returns
  const annualYield = strategyAmount * (selectedStrategy.apy / 100);
  
  console.log('\n' + chalk.cyan('=== Expected Returns ==='));
  console.log(chalk.white(`Annual Yield: ${annualYield.toFixed(2)} IOTA (${selectedStrategy.apy}% APY)`));
  console.log(chalk.white(`Monthly Yield: ${(annualYield / 12).toFixed(2)} IOTA`));
  
  await pressAnyKey('Press any key to view summary...');
  
  // Final summary
  console.log('\n' + chalk.cyan('=== IntelliLend Demo Summary ==='));
  console.log(chalk.white('Completed full user journey:'));
  console.log(chalk.white('1. AI-powered risk assessment (reduced risk score from 25 to 15)'));
  console.log(chalk.white('2. Privacy-preserving identity verification using zero-knowledge proofs'));
  console.log(chalk.white('3. Lending operations (added collateral, borrowed funds)'));
  console.log(chalk.white('4. Cross-chain liquidity management'));
  console.log(chalk.white('5. AI-optimized yield strategies'));
  
  console.log('\n' + chalk.green('IntelliLend successfully integrates AI, privacy, and cross-chain capabilities on IOTA!'));
  
  await pressAnyKey('Press any key to return to the main menu...');
}

/**
 * Display a progress bar for operations
 */
async function simulateProgress(durationSeconds) {
  const progressBar = Array(20).fill('▯');
  const totalSteps = durationSeconds * 5; // Update 5 times per second
  const stepDuration = 1000 / 5; // milliseconds
  
  process.stdout.write('[' + progressBar.join('') + '] 0%');
  
  for (let step = 1; step <= totalSteps; step++) {
    await new Promise(resolve => setTimeout(resolve, stepDuration));
    
    const progress = Math.floor((step / totalSteps) * 100);
    const filledCount = Math.floor((step / totalSteps) * progressBar.length);
    
    progressBar.fill('▮', 0, filledCount);
    progressBar.fill('▯', filledCount);
    
    process.stdout.cursorTo(0);
    process.stdout.write('[' + progressBar.join('') + '] ' + progress + '%');
  }
  
  process.stdout.write('\n');
}

/**
 * Wait for any key press
 */
async function pressAnyKey(message) {
  console.log('\n' + chalk.gray(message));
  
  return new Promise(resolve => {
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.once('data', () => {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      resolve();
    });
  });
}

// Start the demo
init();
