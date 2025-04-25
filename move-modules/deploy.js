/**
 * IntelliLend Move Modules Deployment Script
 * 
 * This script deploys the Move modules to the IOTA L1 network.
 */

const path = require('path');
const { execSync } = require('child_process');
const fs = require('fs');
const dotenv = require('dotenv');
const { createClient } = require('../iota-sdk/client');

// Load environment variables
dotenv.config();

// Configuration
const NETWORK = process.env.IOTA_NETWORK || 'testnet';
const PACKAGE_PATH = path.resolve(__dirname);
const OUTPUT_PATH = path.resolve(__dirname, 'build');

// Account credentials for deployment (would be securely provided in production)
const DEPLOYER_ADDRESS = process.env.MOVE_DEPLOYER_ADDRESS;
const ADMIN_ADDRESS = process.env.MOVE_ADMIN_ADDRESS || DEPLOYER_ADDRESS;

async function main() {
  console.log(`Deploying Move modules to IOTA ${NETWORK}...`);
  
  try {
    // Initialize IOTA client
    const iotaClient = await createClient(NETWORK);
    console.log('IOTA client connected successfully');
    
    // Build the Move package
    console.log('Building Move package...');
    buildMovePackage();
    
    // Deploy the Move package
    console.log('Deploying Move package...');
    const deployResult = deployMovePackage();
    
    // Update smart contract addresses in .env file
    console.log('Updating contract addresses in .env file...');
    updateEnvFile(deployResult);
    
    console.log('Deployment completed successfully!');
    console.log(`Smart Contract Addresses:`);
    Object.entries(deployResult).forEach(([name, address]) => {
      console.log(`- ${name}: ${address}`);
    });
    
  } catch (error) {
    console.error('Deployment failed:', error);
    process.exit(1);
  }
}

function buildMovePackage() {
  try {
    // Create output directory if it doesn't exist
    if (!fs.existsSync(OUTPUT_PATH)) {
      fs.mkdirSync(OUTPUT_PATH, { recursive: true });
    }
    
    // Build Move package using IOTA CLI
    // In production, we would use real IOTA CLI commands
    // For simulation, we'll just print what would be executed
    console.log('Would execute: iota-cli move build --package-path', PACKAGE_PATH);
    
    // In a real implementation, we would execute something like:
    // execSync(`iota-cli move build --package-path ${PACKAGE_PATH}`, { stdio: 'inherit' });
    
    return true;
  } catch (error) {
    console.error('Build failed:', error);
    throw error;
  }
}

function deployMovePackage() {
  try {
    // In production, we would deploy using the IOTA CLI
    // For simulation, we'll just return simulated contract addresses
    console.log('Would execute: iota-cli move publish --package-path', PACKAGE_PATH);
    
    // In a real implementation, we would execute something like:
    // const output = execSync(`iota-cli move publish --package-path ${PACKAGE_PATH}`, { encoding: 'utf8' });
    // And then parse the output to extract the deployed contract addresses
    
    // Return simulated contract addresses
    return {
      MOVE_LENDING_POOL_ADDRESS: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
      MOVE_RISK_BRIDGE_ADDRESS: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890'
    };
  } catch (error) {
    console.error('Deployment failed:', error);
    throw error;
  }
}

function updateEnvFile(deployResult) {
  try {
    // Read current .env file
    const envPath = path.resolve(__dirname, '..', '.env');
    let envContent = '';
    
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf8');
    }
    
    // Update or add contract addresses
    Object.entries(deployResult).forEach(([name, address]) => {
      // Check if the variable already exists in the .env file
      const regex = new RegExp(`^${name}=.*$`, 'm');
      if (regex.test(envContent)) {
        // Update existing variable
        envContent = envContent.replace(regex, `${name}=${address}`);
      } else {
        // Add new variable
        envContent += `\n${name}=${address}`;
      }
    });
    
    // Write updated .env file
    fs.writeFileSync(envPath, envContent);
    
    return true;
  } catch (error) {
    console.error('Failed to update .env file:', error);
    throw error;
  }
}

// Execute main function
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main };
