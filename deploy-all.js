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
const fs = require('fs');
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
    // 1. Deploy IOTA native components
    console.log('\n1. Deploying IOTA native components...');
    await deployIOTANative();
    
    // 2. Deploy placeholder smart contracts
    console.log('\n2. Deploying placeholder smart contracts...');
    await deployPlaceholderContracts();
    
    // 3. Start AI model API
    console.log('\n3. Starting AI model API...');
    await startAIModelAPI();
    
    // 4. Start backend server
    console.log('\n4. Starting backend server...');
    await startBackendServer();
    
    // 5. Start frontend application
    console.log('\n5. Starting frontend application...');
    await startFrontend();
    
    console.log('\n===============================================');
    console.log('All components deployed successfully!');
    console.log('===============================================');
    console.log('Services:');
    console.log(`- Backend API: http://localhost:${process.env.PORT || 3001}`);
    console.log(`- AI Model API: http://localhost:${process.env.AI_MODEL_PORT || 5000}`);
    console.log(`- Frontend: http://localhost:${process.env.FRONTEND_PORT || 3000}`);
    console.log('===============================================');
    console.log('\nPress Ctrl+C to stop all services and exit.');
    
  } catch (error) {
    console.error('Deployment failed:', error);
    stopAllServices();
    process.exit(1);
  }
}

/**
 * Deploy IOTA native components
 */
async function deployIOTANative() {
  try {
    console.log('Running IOTA native deployment script...');
    execSync('node scripts/iota-native-deploy.js', { stdio: 'inherit' });
    console.log('IOTA native components deployed successfully.');
  } catch (error) {
    console.error('Error deploying IOTA native components:', error);
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
  console.log('\nStopping all services...');
  
  if (aiModelProcess) {
    try {
      process.kill(-aiModelProcess.pid);
    } catch (error) {
      console.log(`Error stopping AI model: ${error.message}`);
    }
    aiModelProcess = null;
  }
  
  if (backendProcess) {
    try {
      process.kill(-backendProcess.pid);
    } catch (error) {
      console.log(`Error stopping backend: ${error.message}`);
    }
    backendProcess = null;
  }
  
  if (frontendProcess) {
    try {
      process.kill(-frontendProcess.pid);
    } catch (error) {
      console.log(`Error stopping frontend: ${error.message}`);
    }
    frontendProcess = null;
  }
  
  console.log('All services stopped.');
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
