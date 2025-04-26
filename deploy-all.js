/**
 * IntelliLend Platform Deployment Script
 * 
 * This script deploys all components of the IntelliLend platform to the IOTA network,
 * including Move modules, EVM smart contracts, and backend services.
 */

const path = require('path');
const { execSync } = require('child_process');
const fs = require('fs');
const dotenv = require('dotenv');
const { ethers } = require('ethers');
const { createClient } = require('./iota-sdk/client');
const { createWallet, getOrCreateAccount } = require('./iota-sdk/wallet');
const { createIdentityBridge } = require('./iota-sdk/identity-bridge');

// Load environment variables
dotenv.config();

// Configuration
const NETWORK = process.env.IOTA_NETWORK || 'testnet';
const EVM_RPC_URL = process.env.IOTA_EVM_RPC_URL || 'https://api.testnet.shimmer.network/evm';
const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY;
const ADMIN_ADDRESS = process.env.ADMIN_ADDRESS;

// Record deployment results
const deploymentResults = {
  move: {},
  evm: {},
  backend: {}
};

/**
 * Main deployment function
 */
async function main() {
  console.log(`Deploying IntelliLend platform to IOTA ${NETWORK}...`);
  
  try {
    // Step 1: Initialize IOTA client and account
    console.log('Step 1: Initializing IOTA client and account...');
    const { client, nodeManager } = await createClient(NETWORK);
    console.log('IOTA client initialized successfully');
    
    // Create wallet and account if STRONGHOLD_PASSWORD is provided
    let account = null;
    if (process.env.STRONGHOLD_PASSWORD) {
      const wallet = await createWallet(NETWORK);
      account = await getOrCreateAccount(wallet, 'IntelliLendDeployer');
      console.log('IOTA wallet and account initialized successfully');
    }
    
    // Step 2: Deploy Move modules
    console.log('Step 2: Deploying Move modules...');
    const moveDeploymentResults = await deployMoveModules(client);
    deploymentResults.move = moveDeploymentResults;
    
    // Step 3: Deploy EVM smart contracts
    console.log('Step 3: Deploying EVM smart contracts...');
    const evmDeploymentResults = await deployEVMContracts();
    deploymentResults.evm = evmDeploymentResults;
    
    // Step 4: Deploy backend components
    console.log('Step 4: Deploying backend components...');
    const backendDeploymentResults = await deployBackendComponents(client, account);
    deploymentResults.backend = backendDeploymentResults;
    
    // Step 5: Initialize IOTA Identity Bridge
    console.log('Step 5: Initializing IOTA Identity Bridge...');
    const bridgeResult = await initializeIdentityBridge(
      client, 
      account, 
      deploymentResults.evm.zkVerifier
    );
    deploymentResults.bridge = bridgeResult;
    
    // Update .env file with all deployment addresses
    console.log('Updating .env file with deployment addresses...');
    updateEnvFile(deploymentResults);
    
    // Write deployment summary to file
    console.log('Writing deployment summary...');
    const summaryPath = path.resolve(__dirname, 'deployment-summary.json');
    fs.writeFileSync(summaryPath, JSON.stringify(deploymentResults, null, 2));
    
    console.log('Deployment completed successfully!');
    console.log(`Deployment summary saved to ${summaryPath}`);
    
    // Print key addresses
    console.log('\nDEPLOYMENT ADDRESSES:');
    console.log('MOVE MODULES:');
    Object.entries(deploymentResults.move).forEach(([name, address]) => {
      console.log(`- ${name}: ${address}`);
    });
    
    console.log('\nEVM CONTRACTS:');
    Object.entries(deploymentResults.evm).forEach(([name, address]) => {
      console.log(`- ${name}: ${address}`);
    });
    
  } catch (error) {
    console.error('Deployment failed:', error);
    process.exit(1);
  }
}

/**
 * Deploy Move modules to IOTA L1
 */
async function deployMoveModules(client) {
  try {
    console.log('Building Move modules...');
    
    // Execute move-modules deploy.js
    const moveModulesDeployPath = path.resolve(__dirname, 'move-modules', 'deploy.js');
    const moveDeployOutput = execSync(`node ${moveModulesDeployPath}`, { encoding: 'utf8' });
    console.log(moveDeployOutput);
    
    // Parse output to extract contract addresses
    const moveDeploymentRegex = /MOVE_([A-Z_]+)_ADDRESS: (0x[a-fA-F0-9]+)/g;
    let match;
    const moveAddresses = {};
    
    while ((match = moveDeploymentRegex.exec(moveDeployOutput)) !== null) {
      const name = match[1];
      const address = match[2];
      moveAddresses[name] = address;
    }
    
    console.log('Move modules deployed successfully!');
    
    // Create and submit block to IOTA Tangle to record the deployment
    const blockData = {
      payload: {
        type: 1, // Tagged data
        tag: Buffer.from('MOVE_DEPLOYMENT').toString('hex'),
        data: Buffer.from(JSON.stringify({
          network: NETWORK,
          timestamp: new Date().toISOString(),
          modules: moveAddresses
        })).toString('hex')
      }
    };
    
    // Submit the record to Tangle
    const blockSubmission = await client.submitBlock(blockData);
    console.log(`Move deployment record submitted to Tangle: ${blockSubmission.blockId}`);
    
    return moveAddresses;
  } catch (error) {
    console.error('Move modules deployment failed:', error);
    throw error;
  }
}

/**
 * Deploy EVM smart contracts
 */
async function deployEVMContracts() {
  try {
    console.log('Deploying EVM smart contracts...');
    
    // Connect to IOTA EVM network
    const provider = new ethers.providers.JsonRpcProvider(EVM_RPC_URL);
    
    // Create wallet from private key
    if (!DEPLOYER_PRIVATE_KEY) {
      throw new Error('DEPLOYER_PRIVATE_KEY not set in .env file');
    }
    
    const wallet = new ethers.Wallet(DEPLOYER_PRIVATE_KEY, provider);
    const deployer = wallet.connect(provider);
    
    // Get chain ID
    const chainId = (await provider.getNetwork()).chainId;
    console.log(`Connected to IOTA EVM network with chain ID: ${chainId}`);
    
    // Deploy LendingPool first
    console.log('Deploying LendingPool contract...');
    const LendingPoolFactory = new ethers.ContractFactory(
      require('./abis/LendingPool.json').abi,
      require('./abis/LendingPool.json').bytecode,
      deployer
    );
    
    // Deploy LendingPool with Admin address
    const adminAddress = ADMIN_ADDRESS || deployer.address;
    const lendingPool = await LendingPoolFactory.deploy(adminAddress);
    await lendingPool.deployed();
    console.log(`LendingPool deployed at: ${lendingPool.address}`);
    
    // Deploy ZKVerifier
    console.log('Deploying ZKVerifier contract...');
    const ZKVerifierFactory = new ethers.ContractFactory(
      require('./abis/ZKVerifier.json').abi,
      require('./abis/ZKVerifier.json').bytecode,
      deployer
    );
    
    const zkVerifier = await ZKVerifierFactory.deploy(lendingPool.address);
    await zkVerifier.deployed();
    console.log(`ZKVerifier deployed at: ${zkVerifier.address}`);
    
    // Deploy IOTAIdentityBridge
    console.log('Deploying IOTAIdentityBridge contract...');
    const IOTAIdentityBridgeFactory = new ethers.ContractFactory(
      require('./abis/IOTAIdentityBridge.json').abi,
      require('./abis/IOTAIdentityBridge.json').bytecode,
      deployer
    );
    
    const iotaIdentityBridge = await IOTAIdentityBridgeFactory.deploy(zkVerifier.address);
    await iotaIdentityBridge.deployed();
    console.log(`IOTAIdentityBridge deployed at: ${iotaIdentityBridge.address}`);
    
    // Deploy CrossLayerBridge
    console.log('Deploying CrossLayerBridge contract...');
    const CrossLayerBridgeFactory = new ethers.ContractFactory(
      require('./abis/CrossLayerBridge.json').abi,
      require('./abis/CrossLayerBridge.json').bytecode,
      deployer
    );
    
    // Set initial oracles (just deployer for now)
    const initialOracles = [deployer.address];
    const crossLayerBridge = await CrossLayerBridgeFactory.deploy(
      initialOracles,
      NETWORK,
      10 // L1 confirmation blocks
    );
    await crossLayerBridge.deployed();
    console.log(`CrossLayerBridge deployed at: ${crossLayerBridge.address}`);
    
    // Deploy LiquidationAuction
    console.log('Deploying LiquidationAuction contract...');
    const LiquidationAuctionFactory = new ethers.ContractFactory(
      require('./abis/LiquidationAuction.json').abi,
      require('./abis/LiquidationAuction.json').bytecode,
      deployer
    );
    
    const liquidationAuction = await LiquidationAuctionFactory.deploy(
      lendingPool.address,
      // For simplicity, we're using the same token addresses for lending and collateral
      lendingPool.address, // Lending token address (should be IOTA ERC20)
      lendingPool.address, // Collateral token address (should be IOTA ERC20)
      iotaIdentityBridge.address // Passing Identity Bridge as IOTAStreams
    );
    await liquidationAuction.deployed();
    console.log(`LiquidationAuction deployed at: ${liquidationAuction.address}`);
    
    // Deploy FlashLoanProtection
    console.log('Deploying FlashLoanProtection contract...');
    const FlashLoanProtectionFactory = new ethers.ContractFactory(
      require('./abis/FlashLoanProtection.json').abi,
      require('./abis/FlashLoanProtection.json').bytecode,
      deployer
    );
    
    const flashLoanProtection = await FlashLoanProtectionFactory.deploy(
      lendingPool.address,
      iotaIdentityBridge.address, // Passing Identity Bridge as IOTAStreams
      ethers.utils.parseEther("1000") // Large transaction threshold
    );
    await flashLoanProtection.deployed();
    console.log(`FlashLoanProtection deployed at: ${flashLoanProtection.address}`);
    
    // Return all deployed contract addresses
    return {
      lendingPool: lendingPool.address,
      zkVerifier: zkVerifier.address,
      iotaIdentityBridge: iotaIdentityBridge.address,
      crossLayerBridge: crossLayerBridge.address,
      liquidationAuction: liquidationAuction.address,
      flashLoanProtection: flashLoanProtection.address
    };
  } catch (error) {
    console.error('EVM contracts deployment failed:', error);
    throw error;
  }
}

/**
 * Deploy backend components
 */
async function deployBackendComponents(client, account) {
  try {
    console.log('Initializing backend components...');
    
    // We don't actually deploy backend, but we can initialize some components
    // such as IOTA Streams channels
    
    // Create IOTA Streams channel for secure messaging
    console.log('Creating IOTA Streams channel...');
    const streams = require('./iota-sdk/streams');
    const streamsService = new streams.IOTAStreams(client, account);
    
    // Generate seed for channel creation
    const seed = crypto.randomBytes(32);
    const channelId = 'intellilend-channel';
    const author = 'IntelliLend Platform';
    const channel = await streamsService.createChannel(channelId, author);
    
    console.log(`Streams channel created with ID: ${channelId}`);
    console.log(`Channel address: ${streamsService.getChannelAddress(channel)}`);
    
    return {
      streamsChannel: channelId,
      streamsAddress: streamsService.getChannelAddress(channel)
    };
  } catch (error) {
    console.error('Backend components initialization failed:', error);
    throw error;
  }
}

/**
 * Initialize IOTA Identity Bridge
 */
async function initializeIdentityBridge(client, account, zkVerifierAddress) {
  try {
    console.log('Initializing IOTA Identity Bridge...');
    
    // Create IOTA Identity Bridge instance
    const bridge = await createIdentityBridge(NETWORK, {
      evmRpcUrl: EVM_RPC_URL,
      walletOptions: {
        accountName: 'IdentityBridge',
        strongholdPassword: process.env.STRONGHOLD_PASSWORD
      }
    });
    
    // Connect to deployed bridge contract
    const provider = new ethers.providers.JsonRpcProvider(EVM_RPC_URL);
    const wallet = new ethers.Wallet(DEPLOYER_PRIVATE_KEY, provider);
    const deployer = wallet.connect(provider);
    
    const bridgeContract = await bridge.connectToBridge(
      deploymentResults.evm.iotaIdentityBridge,
      deployer
    );
    
    console.log('IOTA Identity Bridge initialized and connected to contract');
    
    return {
      bridgeContractAddress: deploymentResults.evm.iotaIdentityBridge
    };
  } catch (error) {
    console.error('IOTA Identity Bridge initialization failed:', error);
    throw error;
  }
}

/**
 * Update .env file with deployment addresses
 */
function updateEnvFile(deploymentResults) {
  try {
    // Read current .env file
    const envPath = path.resolve(__dirname, '.env');
    let envContent = '';
    
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf8');
    }
    
    // Update Move modules addresses
    Object.entries(deploymentResults.move).forEach(([name, address]) => {
      const variableName = `MOVE_${name}_ADDRESS`;
      const regex = new RegExp(`^${variableName}=.*$`, 'm');
      
      if (regex.test(envContent)) {
        // Update existing variable
        envContent = envContent.replace(regex, `${variableName}=${address}`);
      } else {
        // Add new variable
        envContent += `\n${variableName}=${address}`;
      }
    });
    
    // Update EVM contract addresses
    Object.entries(deploymentResults.evm).forEach(([name, address]) => {
      const variableName = name.toUpperCase().replace(/([A-Z])/g, '_$1').replace(/^_/, '');
      const regex = new RegExp(`^${variableName}_ADDRESS=.*$`, 'm');
      
      if (regex.test(envContent)) {
        // Update existing variable
        envContent = envContent.replace(regex, `${variableName}_ADDRESS=${address}`);
      } else {
        // Add new variable
        envContent += `\n${variableName}_ADDRESS=${address}`;
      }
    });
    
    // Update backend component addresses
    if (deploymentResults.backend.streamsChannel) {
      const regex = new RegExp(`^STREAMS_CHANNEL_ID=.*$`, 'm');
      if (regex.test(envContent)) {
        envContent = envContent.replace(regex, `STREAMS_CHANNEL_ID=${deploymentResults.backend.streamsChannel}`);
      } else {
        envContent += `\nSTREAMS_CHANNEL_ID=${deploymentResults.backend.streamsChannel}`;
      }
    }
    
    if (deploymentResults.backend.streamsAddress) {
      const regex = new RegExp(`^STREAMS_CHANNEL_ADDRESS=.*$`, 'm');
      if (regex.test(envContent)) {
        envContent = envContent.replace(regex, `STREAMS_CHANNEL_ADDRESS=${deploymentResults.backend.streamsAddress}`);
      } else {
        envContent += `\nSTREAMS_CHANNEL_ADDRESS=${deploymentResults.backend.streamsAddress}`;
      }
    }
    
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
