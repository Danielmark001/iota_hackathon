/**
 * IntelliLend Setup Script
 * 
 * This script automates the setup and deployment of the IntelliLend project.
 */

const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Default configuration
const DEFAULT_CONFIG = {
  IOTA_EVM_RPC_URL: 'https://evm.wasp.sc.iota.org',
  BACKEND_PORT: 3001,
  AI_MODEL_PORT: 5000,
  FRONTEND_PORT: 3000
};

/**
 * Main setup function
 */
async function setup() {
  console.log('=============================================');
  console.log('IntelliLend - AI-Powered DeFi Lending Platform');
  console.log('=============================================');
  console.log('Starting setup process...\n');
  
  try {
    // 1. Check environment and create .env file if needed
    await setupEnvironment();
    
    // 2. Install dependencies
    await installDependencies();
    
    // 3. Deploy smart contracts (if wallet is configured)
    await deployContracts();
    
    // 4. Train AI model
    await setupAiModel();
    
    // 5. Start services
    await startServices();
    
    console.log('\n=============================================');
    console.log('Setup completed successfully!');
    console.log('=============================================');
    console.log('You can now use the IntelliLend platform:');
    console.log(`- Backend API: http://localhost:${process.env.BACKEND_PORT || DEFAULT_CONFIG.BACKEND_PORT}`);
    console.log(`- AI Model API: http://localhost:${process.env.AI_MODEL_PORT || DEFAULT_CONFIG.AI_MODEL_PORT}`);
    console.log(`- Frontend: http://localhost:${process.env.FRONTEND_PORT || DEFAULT_CONFIG.FRONTEND_PORT}`);
    console.log('=============================================');

  } catch (error) {
    console.error('Error during setup:', error);
    process.exit(1);
  }
}

/**
 * Setup environment and .env file
 */
async function setupEnvironment() {
  console.log('Setting up environment variables...');
  
  // Check if .env file exists
  const envPath = path.join(__dirname, '..', '.env');
  
  if (!fs.existsSync(envPath)) {
    console.log('No .env file found. Creating one with default values...');
    
    // Generate a random private key for testing
    const wallet = ethers.Wallet.createRandom();
    
    // Create default .env content
    const envContent = `# IntelliLend Configuration
# Generated on ${new Date().toISOString()}

# IOTA Network
IOTA_EVM_RPC_URL=${DEFAULT_CONFIG.IOTA_EVM_RPC_URL}

# Contract Addresses (will be populated after deployment)
LENDING_POOL_ADDRESS=0x0000000000000000000000000000000000000000
BRIDGE_ADDRESS=0x0000000000000000000000000000000000000000

# Wallet (for testing only, replace with your own for production)
PRIVATE_KEY=${wallet.privateKey}
TEST_WALLET_PRIVATE_KEY=${wallet.privateKey}

# Server Ports
BACKEND_PORT=${DEFAULT_CONFIG.BACKEND_PORT}
AI_MODEL_PORT=${DEFAULT_CONFIG.AI_MODEL_PORT}
FRONTEND_PORT=${DEFAULT_CONFIG.FRONTEND_PORT}

# AI Model
AI_MODEL_API=http://localhost:${DEFAULT_CONFIG.AI_MODEL_PORT}
`;
    
    // Write .env file
    fs.writeFileSync(envPath, envContent);
    console.log('Created .env file with default values.');
    console.log(`Generated test wallet address: ${wallet.address}`);
    console.log('IMPORTANT: For production, replace the private key with your own!');
  } else {
    console.log('Found existing .env file.');
  }
  
  // Reload environment variables
  dotenv.config();
  
  console.log('Environment setup complete.');
}

/**
 * Install project dependencies
 */
async function installDependencies() {
  console.log('\nInstalling project dependencies...');
  
  try {
    // Install main project dependencies
    console.log('Installing main dependencies...');
    execSync('npm install', { stdio: 'inherit', cwd: path.join(__dirname, '..') });
    
    // Install frontend dependencies
    console.log('Installing frontend dependencies...');
    if (fs.existsSync(path.join(__dirname, '..', 'frontend', 'package.json'))) {
      execSync('npm install', { stdio: 'inherit', cwd: path.join(__dirname, '..', 'frontend') });
    }
    
    // Install Python dependencies for AI model
    console.log('Installing AI model dependencies...');
    try {
      execSync('pip install -r requirements.txt', { 
        stdio: 'inherit', 
        cwd: path.join(__dirname, '..', 'ai-model') 
      });
    } catch (error) {
      console.warn('Could not install Python dependencies. You might need to install them manually:');
      console.warn('cd ai-model && pip install -r requirements.txt');
    }
    
    console.log('Dependencies installed successfully.');
  } catch (error) {
    console.error('Error installing dependencies:', error);
    throw error;
  }
}

/**
 * Deploy smart contracts
 */
async function deployContracts() {
  console.log('\nChecking for smart contract deployment...');
  
  // Check if we have a private key configured
  if (!process.env.PRIVATE_KEY || process.env.PRIVATE_KEY.includes('0x0000000000000000000000000000000000000000')) {
    console.log('No valid private key found in .env file. Skipping contract deployment.');
    console.log('To deploy contracts, add your private key to the .env file and run:');
    console.log('node scripts/deploy-contracts.js');
    return;
  }
  
  // Check if contracts are already deployed
  if (process.env.LENDING_POOL_ADDRESS && 
      !process.env.LENDING_POOL_ADDRESS.includes('0x0000000000000000000000000000000000000000') &&
      process.env.BRIDGE_ADDRESS && 
      !process.env.BRIDGE_ADDRESS.includes('0x0000000000000000000000000000000000000000')) {
    console.log('Smart contracts already deployed:');
    console.log(`- Lending Pool: ${process.env.LENDING_POOL_ADDRESS}`);
    console.log(`- Bridge: ${process.env.BRIDGE_ADDRESS}`);
    return;
  }
  
  console.log('Would you like to deploy the smart contracts now? (yes/no)');
  // In a real script, we would wait for user input here
  // For this example, we'll just simulate a "no" response
  console.log('Skipping contract deployment for now.');
  console.log('To deploy contracts manually, run:');
  console.log('node scripts/deploy-contracts.js');
}

/**
 * Setup and train the AI model
 */
async function setupAiModel() {
  console.log('\nSetting up AI model...');
  
  // Check if model file exists
  const modelPath = path.join(__dirname, '..', 'ai-model', 'models', 'risk_model.joblib');
  
  if (!fs.existsSync(path.dirname(modelPath))) {
    fs.mkdirSync(path.dirname(modelPath), { recursive: true });
  }
  
  if (!fs.existsSync(modelPath)) {
    console.log('No trained model found. Training model with simulated data...');
    
    try {
      // Run the training script
      execSync('python -c "from risk_model import *; X, y = simulate_training_data(1000); model = RiskAssessmentModel(); model.train(X, y); model.save_model(\'models/risk_model.joblib\')"', {
        stdio: 'inherit',
        cwd: path.join(__dirname, '..', 'ai-model')
      });
      
      console.log('AI model trained and saved successfully.');
    } catch (error) {
      console.warn('Could not train AI model. You might need to train it manually:');
      console.warn('cd ai-model && python train_model.py');
    }
  } else {
    console.log('Found existing trained model.');
  }
  
  // Create requirements.txt if it doesn't exist
  const requirementsPath = path.join(__dirname, '..', 'ai-model', 'requirements.txt');
  
  if (!fs.existsSync(requirementsPath)) {
    const requirements = `numpy>=1.20.0
pandas>=1.3.0
scikit-learn>=1.0.0
joblib>=1.0.0
flask>=2.0.0
requests>=2.25.0
python-dotenv>=0.19.0
`;
    
    fs.writeFileSync(requirementsPath, requirements);
    console.log('Created requirements.txt for AI model.');
  }
  
  console.log('AI model setup complete.');
}

/**
 * Start all services
 */
async function startServices() {
  console.log('\nWould you like to start all services now? (yes/no)');
  // In a real script, we would wait for user input here
  // For this example, we'll just simulate a "no" response
  console.log('Skipping service startup for now.');
  console.log('To start services manually:');
  console.log('- Backend: npm run start:backend');
  console.log('- AI Model: npm run start:ai');
  console.log('- Frontend: npm run start:frontend');
}

// Execute the setup
if (require.main === module) {
  setup()
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = { setup };
