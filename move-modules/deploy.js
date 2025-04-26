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
    console.log(`Connecting to IOTA ${NETWORK}...`);
    const { client, nodeManager } = await createClient(NETWORK);
    console.log('IOTA client connected successfully');
    
    // Get network info to confirm connection
    const networkInfo = await client.getInfo();
    console.log(`Connected to node: ${networkInfo.nodeInfo.name} (${networkInfo.nodeInfo.version})`);
    console.log(`Network health: ${networkInfo.nodeInfo.status.isHealthy ? 'Healthy' : 'Unhealthy'}`);
    
    // Build the Move package
    console.log('Building Move package...');
    buildMovePackage();
    
    // Deploy the Move package
    console.log('Deploying Move package...');
    const deployResult = await deployMovePackage(client);
    
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
    console.log('Executing: iota-cli move build --package-path', PACKAGE_PATH);
    execSync(`iota-cli move build --package-path ${PACKAGE_PATH}`, { stdio: 'inherit' });
    
    return true;
  } catch (error) {
    console.error('Build failed:', error);
    throw error;
  }
}

async function deployMovePackage(client) {
  try {
    console.log('Executing: iota-cli move publish --package-path', PACKAGE_PATH, `--network ${NETWORK}`);
    
    // Execute the deployment command and capture output
    const output = execSync(`iota-cli move publish --package-path ${PACKAGE_PATH} --network ${NETWORK}`, { encoding: 'utf8' });
    console.log("Deployment output:", output);
    
    // Parse the output to extract contract addresses
    // The format will depend on the IOTA CLI output
    const addresses = parseAddressesFromOutput(output);
    
    // Create and submit block to IOTA Tangle to record the deployment
    const blockData = {
      payload: {
        type: 1, // Tagged data
        tag: Buffer.from('MOVE_DEPLOYMENT').toString('hex'),
        data: Buffer.from(JSON.stringify({
          network: NETWORK,
          timestamp: new Date().toISOString(),
          addresses
        })).toString('hex')
      }
    };
    
    // Submit the record to Tangle
    const blockSubmission = await client.submitBlock(blockData);
    console.log(`Deployment record submitted to Tangle: ${blockSubmission.blockId}`);
    
    return addresses;
  } catch (error) {
    console.error('Deployment failed:', error);
    throw error;
  }
}

function parseAddressesFromOutput(output) {
  try {
    // Real implementation would parse the IOTA CLI output format
    // Example pattern matching for addresses (will need to be adjusted based on actual output)
    const lendingPoolPattern = /LendingPool published at: (0x[a-fA-F0-9]+)/;
    const riskBridgePattern = /RiskBridge published at: (0x[a-fA-F0-9]+)/;
    
    let addresses = {};
    
    // Extract LendingPool address
    const lendingPoolMatch = output.match(lendingPoolPattern);
    if (lendingPoolMatch && lendingPoolMatch[1]) {
      addresses.MOVE_LENDING_POOL_ADDRESS = lendingPoolMatch[1];
    }
    
    // Extract RiskBridge address
    const riskBridgeMatch = output.match(riskBridgePattern);
    if (riskBridgeMatch && riskBridgeMatch[1]) {
      addresses.MOVE_RISK_BRIDGE_ADDRESS = riskBridgeMatch[1];
    }
    
    // If no addresses found, throw error
    if (Object.keys(addresses).length === 0) {
      throw new Error('Failed to parse contract addresses from output');
    }
    
    return addresses;
  } catch (error) {
    console.error('Error parsing deployment output:', error);
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
