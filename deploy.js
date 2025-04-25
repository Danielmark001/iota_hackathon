/**
 * Combined Deployment Script for IntelliLend
 * 
 * This script deploys all components of the IntelliLend platform in development mode:
 * 1. Backend API server with mock data
 * 2. Frontend application in development mode
 */

const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Global process objects
let backendProcess = null;
let frontendProcess = null;

/**
 * Main deployment function
 */
async function deploy() {
  console.log('===============================================');
  console.log('IntelliLend Development Deployment');
  console.log('===============================================');
  
  try {
    // 1. Install dependencies
    console.log('\n1. Installing dependencies...');
    await installDependencies();
    
    // 2. Setup environment if needed
    console.log('\n2. Setting up environment...');
    await setupEnvironment();
    
    // 3. Start backend server
    console.log('\n3. Starting backend server with mock data...');
    await startBackendServer();
    
    // 4. Start frontend application
    console.log('\n4. Starting frontend application in development mode...');
    await startFrontend();
    
    console.log('\n===============================================');
    console.log('Development environment ready!');
    console.log('===============================================');
    console.log('Services:');
    console.log(`- Backend API: http://localhost:${process.env.BACKEND_PORT || 3001}`);
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
 * Install dependencies
 */
async function installDependencies() {
  try {
    console.log('Installing project dependencies...');
    
    // Check if node_modules exists in backend and frontend
    const backendModules = path.join(__dirname, 'backend', 'node_modules');
    const frontendModules = path.join(__dirname, 'frontend', 'node_modules');
    
    if (!fs.existsSync(backendModules)) {
      console.log('Installing backend dependencies...');
      execSync('npm install', { 
        cwd: __dirname,
        stdio: 'inherit'
      });
    } else {
      console.log('Backend dependencies already installed.');
    }
    
    if (!fs.existsSync(frontendModules)) {
      console.log('Installing frontend dependencies...');
      execSync('npm install', { 
        cwd: path.join(__dirname, 'frontend'),
        stdio: 'inherit'
      });
    } else {
      console.log('Frontend dependencies already installed.');
    }
    
    console.log('All dependencies installed successfully.');
  } catch (error) {
    console.error('Error installing dependencies:', error);
    throw error;
  }
}

/**
 * Setup environment
 */
async function setupEnvironment() {
  try {
    // Check if .env file exists
    const envPath = path.join(__dirname, '.env');
    
    if (!fs.existsSync(envPath)) {
      console.log('Creating .env file with development settings...');
      
      const envContent = `# IntelliLend Development Environment
# IOTA EVM Testnet Network
IOTA_EVM_RPC_URL=https://json-rpc.evm.testnet.iotaledger.net

# Contract Addresses (placeholder for development)
LENDING_POOL_ADDRESS=0x1111111111111111111111111111111111111111
ZK_VERIFIER_ADDRESS=0x2222222222222222222222222222222222222222
ZK_BRIDGE_ADDRESS=0x3333333333333333333333333333333333333333

# Server Ports
BACKEND_PORT=3001
FRONTEND_PORT=3000

# Use mock implementations for development
USE_MOCKS=true
`;
      
      fs.writeFileSync(envPath, envContent);
      console.log('.env file created successfully.');
      
      // Reload environment variables
      dotenv.config();
    } else {
      console.log('.env file already exists.');
    }
  } catch (error) {
    console.error('Error setting up environment:', error);
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
      stdio: 'inherit',
      env: {
        ...process.env,
        USE_MOCKS: 'true'
      }
    });
    
    // Give it a moment to start
    await new Promise(resolve => setTimeout(resolve, 2000));
    
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
    console.log('Starting frontend development server...');
    
    // Start frontend development server
    frontendProcess = spawn('node', ['dev-server.js'], {
      cwd: path.join(__dirname, 'frontend'),
      stdio: 'inherit'
    });
    
    console.log('Frontend development server started successfully.');
  } catch (error) {
    console.error('Error starting frontend:', error);
    throw error;
  }
}

/**
 * Stop all services
 */
function stopAllServices() {
  console.log('\nStopping all services...');
  
  if (backendProcess) {
    backendProcess.kill();
    backendProcess = null;
  }
  
  if (frontendProcess) {
    frontendProcess.kill();
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
deploy().catch(error => {
  console.error(error);
  stopAllServices();
  process.exit(1);
});
