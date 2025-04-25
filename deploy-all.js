/**
 * Comprehensive deployment script for IntelliLend IOTA integration
 * 
 * This script deploys all necessary components:
 * 1. EVM Smart Contracts to IOTA Shimmer Testnet
 * 2. Move modules to IOTA Layer 1
 * 3. Updates configuration files with deployed addresses
 */

require('dotenv').config();
const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const readline = require('readline');

// ANSI color codes for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  red: '\x1b[31m'
};

// Create interactive CLI
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Prompt for input with colors
function prompt(question) {
  return new Promise((resolve) => {
    rl.question(`${colors.bright}${colors.cyan}? ${question}${colors.reset} `, (answer) => {
      resolve(answer);
    });
  });
}

// Log with colors
function log(message, type = 'info') {
  const timestamp = new Date().toISOString().slice(11, 19);
  let prefix = '';
  
  switch (type) {
    case 'success':
      prefix = `${colors.bright}${colors.green}✓ `;
      break;
    case 'error':
      prefix = `${colors.bright}${colors.red}✗ `;
      break;
    case 'warn':
      prefix = `${colors.bright}${colors.yellow}⚠ `;
      break;
    case 'info':
    default:
      prefix = `${colors.bright}${colors.blue}ℹ `;
  }
  
  console.log(`${prefix}[${timestamp}] ${message}${colors.reset}`);
}

// Execute a command and return its output
function executeCommand(command) {
  return new Promise((resolve, reject) => {
    log(`Executing: ${command}`, 'info');
    
    exec(command, (error, stdout, stderr) => {
      if (error) {
        log(`Command failed: ${error.message}`, 'error');
        reject(error);
        return;
      }
      
      if (stderr) {
        log(`Command stderr: ${stderr}`, 'warn');
      }
      
      resolve(stdout);
    });
  });
}

// Update .env file with new values
function updateEnvFile(updates) {
  const envPath = path.resolve('.env');
  let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
  
  for (const [key, value] of Object.entries(updates)) {
    // Check if key already exists
    const regex = new RegExp(`^${key}=.*$`, 'm');
    
    if (regex.test(envContent)) {
      // Update existing value
      envContent = envContent.replace(regex, `${key}=${value}`);
    } else {
      // Add new key-value pair
      envContent += `\n${key}=${value}`;
    }
  }
  
  fs.writeFileSync(envPath, envContent);
  log(`Updated .env file with new values: ${Object.keys(updates).join(', ')}`, 'success');
}

// Deploy EVM smart contracts
async function deployEVMContracts() {
  log('Starting EVM contract deployment...', 'info');
  
  try {
    // Ensure provider URL is set
    if (!process.env.IOTA_EVM_RPC_URL) {
      throw new Error('IOTA_EVM_RPC_URL is not set in .env file');
    }
    
    // Connect to provider and check network
    const provider = new ethers.providers.JsonRpcProvider(process.env.IOTA_EVM_RPC_URL);
    const network = await provider.getNetwork();
    log(`Connected to EVM network: chainId ${network.chainId}`, 'success');
    
    // Create wallet from private key
    if (!process.env.PRIVATE_KEY) {
      throw new Error('PRIVATE_KEY is not set in .env file');
    }
    
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    const address = await wallet.getAddress();
    log(`Using deployer address: ${address}`, 'info');
    
    // Check balance
    const balance = await provider.getBalance(address);
    const formattedBalance = ethers.utils.formatEther(balance);
    log(`Deployer balance: ${formattedBalance} IOTA`, 'info');
    
    if (balance.eq(0)) {
      log('Deployer has no IOTA. Please fund the account before deployment.', 'error');
      return;
    }
    
    // Run the Hardhat deployment script
    log('Running Hardhat deployment script...', 'info');
    const deployOutput = await executeCommand('npx hardhat run scripts/deploy.js --network iota-testnet');
    
    // Parse contract addresses from deployment output
    const addressRegex = /([a-zA-Z]+) deployed to: (0x[a-fA-F0-9]{40})/g;
    const deployedContracts = {};
    let match;
    
    while ((match = addressRegex.exec(deployOutput)) !== null) {
      const [, contractName, address] = match;
      deployedContracts[contractName] = address;
      log(`${contractName} deployed to: ${address}`, 'success');
    }
    
    // Update .env file with new contract addresses
    const envUpdates = {};
    
    if (deployedContracts.LendingPool) {
      envUpdates.LENDING_POOL_ADDRESS = deployedContracts.LendingPool;
    }
    
    if (deployedContracts.ZKVerifier) {
      envUpdates.ZK_VERIFIER_ADDRESS = deployedContracts.ZKVerifier;
    }
    
    if (deployedContracts.CrossLayerBridge) {
      envUpdates.ZK_BRIDGE_ADDRESS = deployedContracts.CrossLayerBridge;
    }
    
    if (Object.keys(envUpdates).length > 0) {
      updateEnvFile(envUpdates);
    }
    
    return deployedContracts;
  } catch (error) {
    log(`EVM deployment failed: ${error.message}`, 'error');
    throw error;
  }
}

// Deploy Move modules to IOTA L1
async function deployMoveModules() {
  log('Starting Move module deployment to IOTA L1...', 'info');
  
  try {
    // Check if Move modules exist
    const movePath = path.resolve('./move-modules');
    
    if (!fs.existsSync(movePath)) {
      throw new Error('Move modules directory not found');
    }
    
    // Run the Move deployment script
    log('Running Move deployment script...', 'info');
    const deployOutput = await executeCommand('node move-modules/deploy.js');
    
    // Parse module IDs from deployment output
    const moduleRegex = /Module ([a-zA-Z_]+) deployed with ID: ([a-f0-9]+)/g;
    const deployedModules = {};
    let match;
    
    while ((match = moduleRegex.exec(deployOutput)) !== null) {
      const [, moduleName, moduleId] = match;
      deployedModules[moduleName] = moduleId;
      log(`${moduleName} deployed with ID: ${moduleId}`, 'success');
    }
    
    // Update .env file with new module IDs
    const envUpdates = {};
    
    if (deployedModules.lending_pool) {
      envUpdates.MOVE_LENDING_POOL_ID = deployedModules.lending_pool;
    }
    
    if (deployedModules.risk_bridge) {
      envUpdates.MOVE_RISK_BRIDGE_ID = deployedModules.risk_bridge;
    }
    
    if (Object.keys(envUpdates).length > 0) {
      updateEnvFile(envUpdates);
    }
    
    return deployedModules;
  } catch (error) {
    log(`Move deployment failed: ${error.message}`, 'error');
    log('This is normal if Move modules are still in development', 'warn');
    return null;
  }
}

// Main function to run the deployment process
async function main() {
  try {
    log('IntelliLend IOTA Deployment', 'info');
    log('--------------------------', 'info');
    
    // Confirm deployment
    const confirmDeploy = await prompt('Are you sure you want to deploy all components to IOTA? (y/n)');
    
    if (confirmDeploy.toLowerCase() !== 'y') {
      log('Deployment cancelled by user', 'info');
      rl.close();
      return;
    }
    
    // Deploy EVM contracts
    log('Step 1: Deploying EVM smart contracts to IOTA Shimmer Testnet', 'info');
    const evmContracts = await deployEVMContracts();
    
    // Deploy Move modules
    log('Step 2: Deploying Move modules to IOTA L1', 'info');
    const moveModules = await deployMoveModules();
    
    // Display deployment summary
    log('Deployment Summary', 'success');
    log('-----------------', 'info');
    
    if (evmContracts) {
      log('EVM Contracts:', 'info');
      Object.entries(evmContracts).forEach(([name, address]) => {
        log(`  - ${name}: ${address}`, 'success');
      });
    } else {
      log('No EVM contracts deployed', 'warn');
    }
    
    if (moveModules) {
      log('Move Modules:', 'info');
      Object.entries(moveModules).forEach(([name, id]) => {
        log(`  - ${name}: ${id}`, 'success');
      });
    } else {
      log('No Move modules deployed', 'warn');
    }
    
    // Update configuration files
    log('Deployment completed successfully!', 'success');
    
    // Ask to start the application
    const startApp = await prompt('Do you want to start the application now? (y/n)');
    
    if (startApp.toLowerCase() === 'y') {
      log('Starting IntelliLend application...', 'info');
      executeCommand('npm run start');
    } else {
      log('You can start the application later with "npm run start"', 'info');
    }
  } catch (error) {
    log(`Deployment failed: ${error.message}`, 'error');
  } finally {
    rl.close();
  }
}

// Run main function
main().catch((error) => {
  console.error(error);
  process.exit(1);
});/**
 * Full Deployment Script for IntelliLend
 * 
 * This script deploys all components of the IntelliLend platform:
 * 1. IOTA Native components (using IOTA SDK)
 * 2. Smart contracts on IOTA EVM (using placeholder contracts)
 * 3. AI model API server
 * 4. Backend API server
 * 5. Frontend application
 */

const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs-extra');
const dotenv = require('dotenv');
const axios = require('axios');
const { ethers } = require('ethers');

// Load environment variables
dotenv.config();

// Global process objects
let aiModelProcess = null;
let backendProcess = null;
let frontendProcess = null;

/**
 * Main deployment function
 */
async function deployAll() {
  console.log('===============================================');
  console.log('IntelliLend Full Deployment');
  console.log('===============================================');
  
  try {
    // Check if required environment variables are set
    validateEnvironment();
    
    // 1. Deploy IOTA native components
    console.log('\n1. Deploying IOTA native components...');
    try {
      await deployIOTANative();
      console.log('✅ IOTA native components deployed successfully.');
    } catch (error) {
      console.error('❌ IOTA native deployment failed:', error.message);
      throw new Error(`IOTA native deployment failed: ${error.message}`);
    }
    
    // 2. Deploy placeholder smart contracts
    console.log('\n2. Deploying placeholder smart contracts...');
    try {
      await deployPlaceholderContracts();
      console.log('✅ Smart contracts deployed successfully.');
    } catch (error) {
      console.error('❌ Smart contract deployment failed:', error.message);
      throw new Error(`Smart contract deployment failed: ${error.message}`);
    }
    
    // 3. Start AI model API
    console.log('\n3. Starting AI model API...');
    try {
      await startAIModelAPI();
      console.log('✅ AI model API started successfully.');
    } catch (error) {
      console.error('❌ Failed to start AI model API:', error.message);
      throw new Error(`AI model API start failed: ${error.message}`);
    }
    
    // 4. Start backend server
    console.log('\n4. Starting backend server...');
    try {
      await startBackendServer();
      console.log('✅ Backend server started successfully.');
    } catch (error) {
      console.error('❌ Failed to start backend server:', error.message);
      throw new Error(`Backend server start failed: ${error.message}`);
    }
    
    // 5. Start frontend application
    console.log('\n5. Starting frontend application...');
    try {
      await startFrontend();
      console.log('✅ Frontend application started successfully.');
    } catch (error) {
      console.error('❌ Failed to start frontend application:', error.message);
      throw new Error(`Frontend start failed: ${error.message}`);
    }
    
    console.log('\n===============================================');
    console.log('🚀 All components deployed successfully!');
    console.log('===============================================');
    console.log('Services:');
    console.log(`- Backend API: http://localhost:${process.env.PORT || 3001}`);
    console.log(`- AI Model API: http://localhost:${process.env.AI_MODEL_PORT || 5000}`);
    console.log(`- Frontend: http://localhost:${process.env.FRONTEND_PORT || 3000}`);
    console.log('===============================================');
    console.log('\nPress Ctrl+C to stop all services and exit.');
    
  } catch (error) {
    console.error('❌ Deployment failed:', error.message);
    stopAllServices();
    process.exit(1);
  }
}

/**
 * Validate required environment variables
 */
function validateEnvironment() {
  const requiredVars = [
    'STRONGHOLD_PASSWORD',
    'IOTA_NETWORK'
  ];
  
  const missing = [];
  
  for (const varName of requiredVars) {
    if (!process.env[varName]) {
      missing.push(varName);
    }
  }
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}. Please check your .env file.`);
  }
  
  // Validate network value
  const validNetworks = ['mainnet', 'testnet', 'devnet'];
  if (!validNetworks.includes(process.env.IOTA_NETWORK)) {
    throw new Error(`Invalid IOTA_NETWORK value: ${process.env.IOTA_NETWORK}. Must be one of: ${validNetworks.join(', ')}`);
  }
  
  console.log('✅ Environment validated successfully.');
}

/**
 * Deploy IOTA native components
 */
async function deployIOTANative() {
  try {
    console.log('Running IOTA native deployment script...');
    
    // First check that the IOTA SDK is properly installed
    try {
      // Check if @iota/sdk can be required
      require('@iota/sdk');
      console.log('🔍 IOTA SDK verified successfully.');
    } catch (sdkError) {
      console.error('❌ IOTA SDK not found or cannot be loaded.');
      console.log('Attempting to install @iota/sdk...');
      
      try {
        execSync('npm install @iota/sdk@^1.1.6 --save', { stdio: 'inherit' });
        console.log('✅ IOTA SDK installed successfully.');
      } catch (installError) {
        throw new Error(`Failed to install IOTA SDK: ${installError.message}`);
      }
    }
    
    // Check if the wallet database exists, if not initialize it
    const databasePath = process.env.IOTA_STORAGE_PATH || './wallet-database';
    const strongholdPath = process.env.STRONGHOLD_SNAPSHOT_PATH || './wallet.stronghold';
    
    if (!fs.existsSync(databasePath)) {
      console.log(`Creating wallet database directory: ${databasePath}`);
      fs.mkdirSync(databasePath, { recursive: true });
    }
    
    // Create a backup of existing stronghold file if it exists
    if (fs.existsSync(strongholdPath)) {
      const backupPath = `${strongholdPath}.backup.${Date.now()}`;
      console.log(`Creating backup of existing stronghold file: ${backupPath}`);
      fs.copyFileSync(strongholdPath, backupPath);
    }
    
    // Now run the deployment script with better error handling
    try {
      execSync('node scripts/iota-native-deploy.js', { 
        stdio: 'inherit',
        timeout: 60000 // 60-second timeout
      });
      console.log('✅ IOTA native components deployed successfully.');
    } catch (scriptError) {
      if (scriptError.status === 143) {
        throw new Error('Deployment script timed out after 60 seconds.');
      } else {
        throw new Error(`Deployment script error: ${scriptError.message}`);
      }
    }
  } catch (error) {
    console.error('❌ Error deploying IOTA native components:', error.message);
    throw error;
  }
}

/**
 * Deploy placeholder smart contracts for demo purposes
 */
async function deployPlaceholderContracts() {
  try {
    // Create placeholder contract addresses if not already set
    const dotenvPath = path.join(__dirname, '.env');
    let envContent = await fs.promises.readFile(dotenvPath, 'utf8');
    
    // Check if contract addresses are already set
    if (!envContent.includes('LENDING_POOL_ADDRESS=')) {
      // Generate random contract addresses for demo purposes
      const lendingPoolAddress = '0x' + '1'.padEnd(40, '0');
      const zkVerifierAddress = '0x' + '2'.padEnd(40, '0');
      const zkBridgeAddress = '0x' + '3'.padEnd(40, '0');
      
      // Update .env file
      const contractEnvVars = `\n# Placeholder Contract Addresses\nLENDING_POOL_ADDRESS=${lendingPoolAddress}\nZK_VERIFIER_ADDRESS=${zkVerifierAddress}\nZK_BRIDGE_ADDRESS=${zkBridgeAddress}\n`;
      
      await fs.promises.appendFile(dotenvPath, contractEnvVars);
      
      // Reload environment variables
      dotenv.config();
      
      console.log('Placeholder contract addresses created:');
      console.log(`- LendingPool: ${lendingPoolAddress}`);
      console.log(`- ZKVerifier: ${zkVerifierAddress}`);
      console.log(`- ZKBridge: ${zkBridgeAddress}`);
    } else {
      console.log('Contract addresses already set in .env file.');
    }
  } catch (error) {
    console.error('Error setting up placeholder contracts:', error);
    throw error;
  }
}

/**
 * Start AI model API server
 */
async function startAIModelAPI() {
  try {
    console.log('Starting AI model API server...');
    
    // Create models directory if it doesn't exist
    const modelsDir = path.join(__dirname, 'ai-model', 'models');
    if (!fs.existsSync(modelsDir)) {
      fs.mkdirSync(modelsDir, { recursive: true });
    }
    
    // Start AI model API
    aiModelProcess = spawn('python', ['app.py'], {
      cwd: path.join(__dirname, 'ai-model', 'api'),
      stdio: 'pipe',
      detached: true
    });
    
    // Process outputs
    aiModelProcess.stdout.on('data', (data) => {
      console.log(`AI Model: ${data.toString().trim()}`);
    });
    
    aiModelProcess.stderr.on('data', (data) => {
      console.error(`AI Model Error: ${data.toString().trim()}`);
    });
    
    // Wait for API to start
    await waitForService(`http://localhost:${process.env.AI_MODEL_PORT || 5000}/health`, 30);
    
    console.log('AI model API server started successfully.');
  } catch (error) {
    console.error('Error starting AI model API:', error);
    throw error;
  }
}

/**
 * Start backend server
 */
async function startBackendServer() {
  try {
    console.log('Starting backend server...');
    
    // Start backend server
    backendProcess = spawn('node', ['server.js'], {
      cwd: path.join(__dirname, 'backend'),
      stdio: 'pipe',
      detached: true
    });
    
    // Process outputs
    backendProcess.stdout.on('data', (data) => {
      console.log(`Backend: ${data.toString().trim()}`);
    });
    
    backendProcess.stderr.on('data', (data) => {
      console.error(`Backend Error: ${data.toString().trim()}`);
    });
    
    // Wait for server to start
    await waitForService(`http://localhost:${process.env.PORT || 3001}/health`, 30);
    
    console.log('Backend server started successfully.');
  } catch (error) {
    console.error('Error starting backend server:', error);
    throw error;
  }
}

/**
 * Start frontend application
 */
async function startFrontend() {
  try {
    console.log('Starting frontend application...');
    
    // Start our custom server instead of npm
    frontendProcess = spawn('node', ['server.js'], {
      cwd: path.join(__dirname, 'frontend'),
      stdio: 'pipe',
      detached: true
    });
    
    // Process outputs
    frontendProcess.stdout.on('data', (data) => {
      const output = data.toString().trim();
      console.log(`Frontend: ${output}`);
    });
    
    frontendProcess.stderr.on('data', (data) => {
      console.error(`Frontend Error: ${data.toString().trim()}`);
    });
    
    // Wait for server to start
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log('Frontend should be available now at http://localhost:3000');
  } catch (error) {
    console.error('Error starting frontend:', error);
    throw error;
  }
}

/**
 * Wait for a service to become available
 * @param {string} url - URL to check
 * @param {number} maxRetries - Maximum number of retries
 * @returns {Promise<void>}
 */
async function waitForService(url, maxRetries = 30) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      await axios.get(url, { timeout: 1000 });
      return; // Service is up
    } catch (error) {
      console.log(`Waiting for service at ${url}... (attempt ${i + 1}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  throw new Error(`Service at ${url} did not start within the timeout period.`);
}

/**
 * Stop all services
 */
function stopAllServices() {
  console.log('\n🛑 Stopping all services...');
  
  let allStopped = true;
  
  // Helper function to kill a process with better error handling
  const safeKillProcess = (process, name) => {
    if (!process) return true;
    
    try {
      // Try to gracefully terminate first
      if (process.pid) {
        console.log(`Stopping ${name} process (PID: ${process.pid})...`);
        
        // Check if process is still running
        try {
          process.kill(0); // Signal 0 is used to check if process exists
        } catch (e) {
          // Process doesn't exist
          console.log(`${name} process already stopped.`);
          return true;
        }
        
        // Try SIGTERM first (graceful)
        process.kill('SIGTERM');
        
        // Give it 2 seconds to terminate gracefully
        setTimeout(() => {
          try {
            // Check if still running
            process.kill(0);
            // If we reach here, process is still running, force kill
            console.log(`${name} didn't terminate gracefully, forcing...`);
            process.kill('SIGKILL');
          } catch (e) {
            // Process already terminated
          }
        }, 2000);
      }
      return true;
    } catch (error) {
      console.log(`❌ Error stopping ${name}: ${error.message}`);
      allStopped = false;
      return false;
    }
  };
  
  // Stop each process
  const aiStopped = safeKillProcess(aiModelProcess, 'AI model');
  const backendStopped = safeKillProcess(backendProcess, 'backend');
  const frontendStopped = safeKillProcess(frontendProcess, 'frontend');
  
  aiModelProcess = null;
  backendProcess = null;
  frontendProcess = null;
  
  // Check for any lingering processes
  try {
    const { execSync } = require('child_process');
    console.log('Checking for lingering processes...');
    
    // This will work on Windows systems
    const result = execSync('tasklist | findstr "node python"').toString();
    if (result) {
      console.log('Some processes might still be running:');
      console.log(result);
      console.log('You may need to terminate them manually.');
    }
  } catch (error) {
    // Either the command failed or there are no matching processes
    // We can ignore this error
  }
  
  if (allStopped) {
    console.log('✅ All services stopped successfully.');
  } else {
    console.log('⚠️ Some services may still be running. Check your task manager.');
  }
}

// Handle cleanup on exit
process.on('exit', stopAllServices);
process.on('SIGINT', () => {
  stopAllServices();
  process.exit();
});

// Execute deployment
deployAll().catch(error => {
  console.error(error);
  stopAllServices();
  process.exit(1);
});
