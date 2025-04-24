/**
 * Direct IntelliLend Contract Deployment Script
 * This is a simplified script that focuses only on contract deployment.
 */

const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

async function deploy() {
  console.log('===============================================');
  console.log('IntelliLend Direct Contract Deployment');
  console.log('===============================================');
  
  try {
    // Direct RPC URL
    const rpcUrl = 'https://json-rpc.evm.testnet.shimmer.network';
    console.log(`Using RPC URL: ${rpcUrl}`);
    
    // Connect to provider
    const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
    
    // Get network info
    console.log('Fetching network information...');
    const network = await provider.getNetwork();
    console.log(`Connected to network: ${network.name} (Chain ID: ${network.chainId})`);
    
    // Set up wallet
    const privateKey = process.env.PRIVATE_KEY;
    console.log('Setting up wallet...');
    const wallet = new ethers.Wallet(privateKey, provider);
    const address = wallet.address;
    console.log(`Deployer address: ${address}`);
    
    // Check balance
    console.log('Checking account balance...');
    const balance = await provider.getBalance(address);
    console.log(`Account balance: ${ethers.utils.formatEther(balance)} IOTA`);
    
    if (balance.eq(0)) {
      throw new Error('Account has no balance. Please fund your account before deploying contracts.');
    }
    
    // Mock contract artifacts
    console.log('Preparing contract artifacts...');
    const bridgeArtifact = {
      abi: [
        "function sendMessageToL1(bytes32 targetAddress, string calldata messageType, bytes calldata payload, uint256 gasLimit) external payable returns (bytes32)",
        "function getMessageIdsBySender(address sender) external view returns (bytes32[] memory)",
        "function messages(bytes32 messageId) external view returns (bytes32, address, bytes32, bytes, uint256, uint8, uint8, string, uint256, uint256)"
      ],
      bytecode: "0x608060405234801561001057600080fd5b50610a3c806100206000396000f3fe60806040..."
    };
    
    const lendingPoolArtifact = {
      abi: [
        "function deposits(address user) external view returns (uint256)",
        "function borrows(address user) external view returns (uint256)",
        "function collaterals(address user) external view returns (uint256)",
        "function riskScores(address user) external view returns (uint256)",
        "function calculateInterestRate(address user) external view returns (uint256)",
        "function getHealthFactor(address user) external view returns (uint256)",
        "function updateRiskScore(address user, uint256 score) external",
        "function deposit(uint256 amount) external",
        "function borrow(uint256 amount) external"
      ],
      bytecode: "0x608060405234801561001057600080fd5b50610c5e806100206000396000f3fe60806040..."
    };
    
    console.log('Deploying CrossLayerBridge contract...');
    const bridgeFactory = new ethers.ContractFactory(
      bridgeArtifact.abi, 
      bridgeArtifact.bytecode, 
      wallet
    );
    
    const bridgeContract = await bridgeFactory.deploy(address);
    console.log(`Waiting for CrossLayerBridge deployment transaction...`);
    await bridgeContract.deployed();
    
    console.log(`CrossLayerBridge deployed to: ${bridgeContract.address}`);
    
    console.log('Deploying LendingPool contract...');
    const lendingTokenAddress = "0x0000000000000000000000000000000000000000";
    const collateralTokenAddress = "0x0000000000000000000000000000000000000000";
    
    const lendingPoolFactory = new ethers.ContractFactory(
      lendingPoolArtifact.abi, 
      lendingPoolArtifact.bytecode, 
      wallet
    );
    
    const lendingPoolContract = await lendingPoolFactory.deploy(
      lendingTokenAddress,
      collateralTokenAddress,
      bridgeContract.address
    );
    
    console.log(`Waiting for LendingPool deployment transaction...`);
    await lendingPoolContract.deployed();
    
    console.log(`LendingPool deployed to: ${lendingPoolContract.address}`);
    
    // Update .env file
    console.log('Updating environment variables...');
    updateEnvFile({
      BRIDGE_ADDRESS: bridgeContract.address,
      LENDING_POOL_ADDRESS: lendingPoolContract.address
    });
    
    console.log('===============================================');
    console.log('Deployment completed successfully!');
    console.log('===============================================');
    console.log(`Bridge Address: ${bridgeContract.address}`);
    console.log(`LendingPool Address: ${lendingPoolContract.address}`);
    console.log('===============================================');
    
  } catch (error) {
    console.error('Deployment failed:', error);
    process.exit(1);
  }
}

/**
 * Update .env file with new values
 */
function updateEnvFile(updates) {
  const envPath = path.join(__dirname, '..', '.env');
  
  try {
    // Read existing .env file
    let envContent = '';
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf8');
    }
    
    // Update values
    for (const [key, value] of Object.entries(updates)) {
      // Check if key exists in .env
      const regex = new RegExp(`^${key}=.*$`, 'm');
      
      if (regex.test(envContent)) {
        // Replace existing value
        envContent = envContent.replace(regex, `${key}=${value}`);
      } else {
        // Add new value
        envContent += `\n${key}=${value}`;
      }
    }
    
    // Write updated .env file
    fs.writeFileSync(envPath, envContent);
    
    console.log('Environment variables updated successfully.');
    
  } catch (error) {
    console.error('Error updating .env file:', error);
  }
}

// Execute the deployment
if (require.main === module) {
  deploy()
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
}
