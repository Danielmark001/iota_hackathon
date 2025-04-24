/**
 * IntelliLend Local Development Setup
 * 
 * This script sets up a local development environment for testing without deploying to the blockchain.
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Process handlers
let backendProcess = null;
let aiModelProcess = null;
let frontendProcess = null;

/**
 * Setup local development environment
 */
async function setupLocal() {
  console.log('===============================================');
  console.log('IntelliLend Local Development Setup');
  console.log('===============================================');
  
  try {
    // Create mock contract addresses for local development
    console.log('Setting up mock contract addresses...');
    updateEnvWithMockAddresses();
    
    // Prepare directories
    console.log('Preparing directories...');
    createRequiredDirectories();
    
    // Set up backend
    console.log('Setting up backend...');
    setupBackend();
    
    // Set up AI model
    console.log('Setting up AI model...');
    setupAiModel();
    
    // Start services
    console.log('Starting services...');
    startServices();
    
    console.log('===============================================');
    console.log('Local development setup completed!');
    console.log('===============================================');
    console.log('Services:');
    console.log(`- Backend API: http://localhost:${process.env.BACKEND_PORT || 3001}`);
    console.log(`- AI Model API: http://localhost:${process.env.AI_MODEL_PORT || 5000}`);
    console.log(`- Frontend: http://localhost:${process.env.FRONTEND_PORT || 3000}`);
    console.log('===============================================');
    console.log('Press Ctrl+C to stop all services and exit.');
    
  } catch (error) {
    console.error('Local setup failed:', error);
    process.exit(1);
  }
}

/**
 * Update .env file with mock contract addresses
 */
function updateEnvWithMockAddresses() {
  const envPath = path.join(__dirname, '..', '.env');
  
  try {
    // Read existing .env file
    let envContent = '';
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf8');
    }
    
    // Generate mock addresses
    const mockBridgeAddress = '0x' + '1'.repeat(40);
    const mockLendingPoolAddress = '0x' + '2'.repeat(40);
    
    // Update contract addresses
    const updates = {
      BRIDGE_ADDRESS: mockBridgeAddress,
      LENDING_POOL_ADDRESS: mockLendingPoolAddress,
      LOCAL_DEV: 'true'
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
    
    console.log('Environment updated with mock contract addresses.');
    
  } catch (error) {
    console.error('Error updating environment variables:', error);
    throw error;
  }
}

/**
 * Create required directories
 */
function createRequiredDirectories() {
  const directories = [
    path.join(__dirname, '..', 'ai-model', 'models'),
    path.join(__dirname, '..', 'deployments'),
    path.join(__dirname, '..', 'logs')
  ];
  
  for (const dir of directories) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}

/**
 * Set up backend files
 */
function setupBackend() {
  // Create abis directory if it doesn't exist
  const abisDir = path.join(__dirname, '..', 'abis');
  if (!fs.existsSync(abisDir)) {
    fs.mkdirSync(abisDir, { recursive: true });
  }
  
  // Create mock ABI files
  const lendingPoolAbi = [
    { "inputs": [{"name": "user", "type": "address"}], "name": "deposits", "outputs": [{"name": "", "type": "uint256"}], "stateMutability": "view", "type": "function" },
    { "inputs": [{"name": "user", "type": "address"}], "name": "borrows", "outputs": [{"name": "", "type": "uint256"}], "stateMutability": "view", "type": "function" },
    { "inputs": [{"name": "user", "type": "address"}], "name": "collaterals", "outputs": [{"name": "", "type": "uint256"}], "stateMutability": "view", "type": "function" },
    { "inputs": [{"name": "user", "type": "address"}], "name": "riskScores", "outputs": [{"name": "", "type": "uint256"}], "stateMutability": "view", "type": "function" },
    { "inputs": [{"name": "user", "type": "address"}], "name": "calculateInterestRate", "outputs": [{"name": "", "type": "uint256"}], "stateMutability": "view", "type": "function" },
    { "inputs": [{"name": "user", "type": "address"}], "name": "getHealthFactor", "outputs": [{"name": "", "type": "uint256"}], "stateMutability": "view", "type": "function" },
    { "inputs": [{"name": "user", "type": "address"}, {"name": "score", "type": "uint256"}], "name": "updateRiskScore", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
    { "inputs": [{"name": "amount", "type": "uint256"}], "name": "deposit", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
    { "inputs": [{"name": "amount", "type": "uint256"}], "name": "borrow", "outputs": [], "stateMutability": "nonpayable", "type": "function" }
  ];
  
  const bridgeAbi = [
    { "inputs": [{"name": "targetAddress", "type": "bytes32"}, {"name": "messageType", "type": "string"}, {"name": "payload", "type": "bytes"}, {"name": "gasLimit", "type": "uint256"}], "name": "sendMessageToL1", "outputs": [{"name": "", "type": "bytes32"}], "stateMutability": "payable", "type": "function" },
    { "inputs": [{"name": "sender", "type": "address"}], "name": "getMessageIdsBySender", "outputs": [{"name": "", "type": "bytes32[]"}], "stateMutability": "view", "type": "function" }
  ];
  
  fs.writeFileSync(path.join(abisDir, 'LendingPool.json'), JSON.stringify(lendingPoolAbi, null, 2));
  fs.writeFileSync(path.join(abisDir, 'CrossLayerBridge.json'), JSON.stringify(bridgeAbi, null, 2));
  
  // Create config file
  const configDir = path.join(__dirname, '..', 'frontend', 'src');
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
  
  const configContent = `// Frontend configuration
export const API_URL = 'http://localhost:${process.env.BACKEND_PORT || 3001}';
export const LENDING_POOL_ADDRESS = '${process.env.LENDING_POOL_ADDRESS || '0x' + '2'.repeat(40)}';
export const BRIDGE_ADDRESS = '${process.env.BRIDGE_ADDRESS || '0x' + '1'.repeat(40)}';
export const NETWORK_NAME = 'Local Development';
`;
  
  fs.writeFileSync(path.join(configDir, 'config.js'), configContent);
}

/**
 * Set up AI model
 */
function setupAiModel() {
  // Create a mock trained model if it doesn't exist
  const modelsDir = path.join(__dirname, '..', 'ai-model', 'models');
  const modelPath = path.join(modelsDir, 'risk_model.joblib');
  
  if (!fs.existsSync(modelPath)) {
    // Create empty file as a placeholder
    fs.writeFileSync(modelPath, '');
    console.log('Created placeholder for AI model. In a real setup, this would be a trained model.');
  }
}

/**
 * Start services
 */
function startServices() {
  console.log('Starting backend server...');
  backendProcess = spawn('node', ['server.js'], {
    cwd: path.join(__dirname, '..', 'backend'),
    stdio: 'inherit',
    detached: true
  });
  
  console.log('Starting AI model API...');
  const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
  aiModelProcess = spawn(pythonCmd, ['app.py'], {
    cwd: path.join(__dirname, '..', 'ai-model', 'api'),
    stdio: 'inherit',
    detached: true
  });
  
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

// Execute if run directly
if (require.main === module) {
  setupLocal()
    .then(() => {
      // Keep process running
      console.log('\nPress Ctrl+C to stop all services and exit.');
    })
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = { setupLocal, stopServices };
