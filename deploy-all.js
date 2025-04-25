/**
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
