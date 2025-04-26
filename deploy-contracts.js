/**
 * IntelliLend Smart Contract Deployment Script
 * 
 * This script deploys the IntelliLend smart contracts to the IOTA Shimmer EVM testnet
 * and saves the deployed addresses to the .env file.
 */

const hre = require("hardhat");
const fs = require("fs");
const path = require("path");
const { ethers } = require("hardhat");
const dotenv = require("dotenv");

// Load environment variables
dotenv.config();

async function main() {
  console.log("===============================================");
  console.log("IntelliLend Smart Contract Deployment");
  console.log("===============================================");
  
  // Get network information
  const network = hre.network.name;
  const [deployer] = await ethers.getSigners();
  const deployerAddress = await deployer.getAddress();
  
  console.log(`Deploying contracts on: ${network}`);
  console.log(`Deployer address: ${deployerAddress}`);
  console.log(`Account balance: ${ethers.utils.formatEther(await deployer.getBalance())} ETH`);
  console.log("===============================================");
  
  // Deploy all contracts
  
  // 1. ZK Verifier
  console.log("\n1. Deploying ZK Verifier...");
  const ZKVerifier = await ethers.getContractFactory("ZKVerifier");
  const zkVerifier = await ZKVerifier.deploy();
  await zkVerifier.deployed();
  console.log(`   ZK Verifier deployed to: ${zkVerifier.address}`);
  
  // 2. Cross-Layer Bridge
  console.log("\n2. Deploying Cross-Layer Bridge...");
  const CrossLayerBridge = await ethers.getContractFactory("CrossLayerBridge");
  const bridge = await CrossLayerBridge.deploy();
  await bridge.deployed();
  console.log(`   Cross-Layer Bridge deployed to: ${bridge.address}`);
  
  // 3. Lending Pool
  console.log("\n3. Deploying Lending Pool...");
  const LendingPool = await ethers.getContractFactory("LendingPool");
  const lendingPool = await LendingPool.deploy(
    zkVerifier.address,
    bridge.address
  );
  await lendingPool.deployed();
  console.log(`   Lending Pool deployed to: ${lendingPool.address}`);
  
  // 4. Liquidation Auction
  console.log("\n4. Deploying Liquidation Auction...");
  const LiquidationAuction = await ethers.getContractFactory("LiquidationAuction");
  const liquidationAuction = await LiquidationAuction.deploy(lendingPool.address);
  await liquidationAuction.deployed();
  console.log(`   Liquidation Auction deployed to: ${liquidationAuction.address}`);
  
  // 5. Initialize the Lending Pool with Liquidation Auction address
  console.log("\n5. Initializing Lending Pool...");
  await lendingPool.setLiquidationAuction(liquidationAuction.address);
  console.log(`   Lending Pool initialized with Liquidation Auction address`);
  
  // 6. Deploy Risk Bridge (for cross-layer risk assessment)
  console.log("\n6. Deploying Risk Bridge...");
  const RiskBridge = await ethers.getContractFactory("RiskBridge");
  const riskBridge = await RiskBridge.deploy(
    lendingPool.address,
    bridge.address
  );
  await riskBridge.deployed();
  console.log(`   Risk Bridge deployed to: ${riskBridge.address}`);
  
  // 7. Set Risk Bridge on Lending Pool
  console.log("\n7. Setting Risk Bridge on Lending Pool...");
  await lendingPool.setRiskBridge(riskBridge.address);
  console.log(`   Risk Bridge set on Lending Pool`);
  
  // Update .env file with deployed contract addresses
  console.log("\nUpdating .env file with deployed contract addresses...");
  updateEnvFile({
    LENDING_POOL_ADDRESS: lendingPool.address,
    ZK_VERIFIER_ADDRESS: zkVerifier.address,
    ZK_BRIDGE_ADDRESS: bridge.address,
    LIQUIDATION_AUCTION_ADDRESS: liquidationAuction.address,
    RISK_BRIDGE_ADDRESS: riskBridge.address,
    USE_MOCKS: "false" // Set to false since we're using real contracts now
  });
  
  console.log("\n===============================================");
  console.log("Deployment complete!");
  console.log("===============================================");
  console.log("Deployed Contracts:");
  console.log(`- Lending Pool: ${lendingPool.address}`);
  console.log(`- ZK Verifier: ${zkVerifier.address}`);
  console.log(`- Cross-Layer Bridge: ${bridge.address}`);
  console.log(`- Liquidation Auction: ${liquidationAuction.address}`);
  console.log(`- Risk Bridge: ${riskBridge.address}`);
  console.log("===============================================");
  console.log("\nContract addresses have been saved to .env file.");
  console.log("\nVerify contracts on block explorer with:");
  console.log(`npx hardhat verify --network ${network} ${zkVerifier.address}`);
  console.log(`npx hardhat verify --network ${network} ${bridge.address}`);
  console.log(`npx hardhat verify --network ${network} ${lendingPool.address} ${zkVerifier.address} ${bridge.address}`);
  console.log(`npx hardhat verify --network ${network} ${liquidationAuction.address} ${lendingPool.address}`);
  console.log(`npx hardhat verify --network ${network} ${riskBridge.address} ${lendingPool.address} ${bridge.address}`);
}

/**
 * Update .env file with new values
 * @param {Object} newValues - New values to set in .env file
 */
function updateEnvFile(newValues) {
  const envPath = path.join(__dirname, '.env');
  
  // Read current .env file
  let envContent = '';
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf8');
  }
  
  // Parse current variables
  const envVars = {};
  
  // Parse existing values
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      envVars[match[1].trim()] = match[2].trim();
    }
  });
  
  // Update with new values
  Object.assign(envVars, newValues);
  
  // Create new .env content
  const newEnvContent = Object.entries(envVars)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  
  // Write back to .env file
  fs.writeFileSync(envPath, newEnvContent);
}

// Execute deployment
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Deployment failed:", error);
    process.exit(1);
  });
