/**
 * IntelliLend Demo Script
 * 
 * This script simulates the interaction between all components of the IntelliLend platform:
 * - EVM Smart Contracts (Lending Pool, Cross-Layer Bridge, Cross-Chain Liquidity)
 * - Move Layer Module (Asset Representation)
 * - AI Risk Assessment Model
 * 
 * It demonstrates a complete lending and borrowing cycle with cross-chain liquidity,
 * privacy-preserving credit scoring, and AI-powered risk assessment.
 */

const { ethers } = require('hardhat');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const chalk = require('chalk');

// Import AI helper functions
// Note: In a real implementation, you would import from the actual AI helper module
// For demo purposes, we'll define simple mock functions

// Mock AI helper functions for the demo
const mockAIFunctions = {
    // Assess risk based on user data
    assessRisk: async (userData) => {
        // Simple model for demo purposes
        const score = Math.min(100, Math.max(0, Math.floor(
            50 + // Base score
            (userData.transaction_count / 10) - // More transactions = better
            (userData.default_count * 15) + // Defaults are bad
            ((userData.repayment_ratio - 0.7) * 100) - // Higher repayment ratio = better
            (userData.wallet_balance_volatility * 30) + // Volatility is risky
            (userData.lending_protocol_interactions) // More interactions = better
        )));
        
        return score;
    },
    
    // Predict default probability
    predictDefaultProbability: async (userData) => {
        // Simple model for demo purposes
        const probability = Math.min(1, Math.max(0,
            0.05 + // Base probability
            (userData.default_count * 0.1) - // More defaults = higher probability
            ((userData.repayment_ratio - 0.7) * 0.3) + // Lower repayment = higher probability
            (userData.wallet_balance_volatility * 0.2) // More volatility = higher probability
        ));
        
        return probability;
    },
    
    // Optimize interest rate
    optimizeInterestRate: async (userData, marketConditions) => {
        // Base rate
        let baseRate = 0.03;
        
        // Add risk premium based on user data
        const riskScore = await mockAIFunctions.assessRisk(userData);
        const riskPremium = (riskScore / 100) * 0.1;
        
        // Add market volatility factor
        const volatilityFactor = marketConditions.volatility * 0.05;
        
        // Add utilization factor
        const utilizationFactor = (1 - marketConditions.liquidityRatio) * 0.05;
        
        // Calculate optimal rate
        const optimalRate = baseRate + riskPremium + volatilityFactor + utilizationFactor;
        
        return optimalRate;
    },
    
    // Generate early warning signals
    generateEarlyWarningSignals: async (userData) => {
        const warnings = {};
        
        // Check for high default count
        if (userData.default_count > 0) {
            warnings.previous_defaults = {
                severity: 'medium',
                value: userData.default_count,
                description: 'User has defaulted on previous loans'
            };
        }
        
        // Check for low repayment ratio
        if (userData.repayment_ratio < 0.8) {
            warnings.low_repayment = {
                severity: 'high',
                value: userData.repayment_ratio,
                description: 'User has a history of incomplete loan repayments'
            };
        }
        
        // Check for high wallet volatility
        if (userData.wallet_balance_volatility > 0.3) {
            warnings.high_volatility = {
                severity: 'medium',
                value: userData.wallet_balance_volatility,
                description: 'User has high wallet balance volatility'
            };
        }
        
        return warnings;
    }
};

// Configuration
const config = {
    // Network settings
    iotaEvmRpc: process.env.IOTA_EVM_RPC || 'http://localhost:8545',
    iotaL1Node: process.env.IOTA_L1_NODE || 'http://localhost:14265',
    
    // Token settings
    tokenDecimals: 18,
    initialMint: ethers.utils.parseEther('1000000'), // 1 million tokens
    
    // User settings
    numUsers: 5,
    initialBalance: ethers.utils.parseEther('10000'), // 10,000 tokens per user
    
    // Lending settings
    depositAmount: ethers.utils.parseEther('5000'),
    borrowAmount: ethers.utils.parseEther('3000'),
    collateralAmount: ethers.utils.parseEther('8000'),
    
    // AI settings
    aiEndpoint: process.env.AI_ENDPOINT || 'http://localhost:5000',
    
    // Cross-chain settings
    targetChainId: 1, // IOTA EVM Chain ID
    
    // Demo settings
    verbose: true,
    simulateDelay: true
};

// Main demo function
async function runDemo() {
    console.log(chalk.blue('='.repeat(80)));
    console.log(chalk.blue('|') + ' '.repeat(30) + chalk.white.bold('INTELLILEND DEMO') + ' '.repeat(30) + chalk.blue('|'));
    console.log(chalk.blue('='.repeat(80)));
    
    console.log(chalk.cyan('\n[1/7] Setting up environment...'));
    
    // Deploy contracts and setup
    const {
        owner,
        users,
        lendingToken,
        collateralToken,
        bridge,
        lendingPool,
        crossChainLiquidity,
        riskAssessment
    } = await setupEnvironment();
    
    await delay(1000);
    
    console.log(chalk.cyan('\n[2/7] Simulating user activities...'));
    
    // Simulate user activities
    await simulateUserActivities(users, lendingToken, collateralToken, lendingPool);
    
    await delay(1000);
    
    console.log(chalk.cyan('\n[3/7] Running AI risk assessment...'));
    
    // Run AI risk assessment
    await runAIRiskAssessment(users, riskAssessment, lendingPool);
    
    await delay(1000);
    
    console.log(chalk.cyan('\n[4/7] Testing cross-layer communication...'));
    
    // Test cross-layer communication
    await testCrossLayerCommunication(users, bridge, lendingPool);
    
    await delay(1000);
    
    console.log(chalk.cyan('\n[5/7] Demonstrating cross-chain liquidity...'));
    
    // Demonstrate cross-chain liquidity
    await demonstrateCrossChainLiquidity(users, lendingToken, crossChainLiquidity);
    
    await delay(1000);
    
    console.log(chalk.cyan('\n[6/7] Testing liquidation scenario...'));
    
    // Test liquidation scenario
    await testLiquidation(users, lendingToken, collateralToken, lendingPool);
    
    await delay(1000);
    
    console.log(chalk.cyan('\n[7/7] Generating performance metrics...'));
    
    // Generate performance metrics
    await generatePerformanceMetrics(
        owner,
        users,
        lendingToken,
        collateralToken,
        lendingPool,
        crossChainLiquidity,
        riskAssessment
    );
    
    console.log(chalk.green('\nDemo completed successfully!'));
    console.log(chalk.blue('='.repeat(80)));
}

/**
 * Set up the demo environment
 */
async function setupEnvironment() {
    // Get signers
    const [owner, ...allUsers] = await ethers.getSigners();
    const users = allUsers.slice(0, config.numUsers);
    
    // Deploy token contracts
    console.log(chalk.gray('  Deploying token contracts...'));
    const LendingToken = await ethers.getContractFactory('IERC20');
    const lendingToken = await LendingToken.deploy('IOTA Lending Token', 'ILT');
    await lendingToken.deployed();
    
    const CollateralToken = await ethers.getContractFactory('IERC20');
    const collateralToken = await CollateralToken.deploy('IOTA Collateral Token', 'ICT');
    await collateralToken.deployed();
    
    // Mint tokens to owner
    await lendingToken.mint(owner.address, config.initialMint);
    await collateralToken.mint(owner.address, config.initialMint);
    
    // Deploy bridge
    console.log(chalk.gray('  Deploying cross-layer bridge...'));
    const ZKCrossLayerBridge = await ethers.getContractFactory('ZKCrossLayerBridge');
    const bridge = await ZKCrossLayerBridge.deploy(owner.address);
    await bridge.deployed();
    
    // Deploy AI risk assessment
    console.log(chalk.gray('  Deploying AI risk assessment...'));
    const AIRiskAssessment = await ethers.getContractFactory('AIRiskAssessment');
    const riskAssessment = await AIRiskAssessment.deploy(owner.address);
    await riskAssessment.deployed();
    
    // Deploy lending pool
    console.log(chalk.gray('  Deploying lending pool...'));
    const LendingPool = await ethers.getContractFactory('LendingPool');
    const lendingPool = await LendingPool.deploy(
        lendingToken.address,
        collateralToken.address,
        bridge.address
    );
    await lendingPool.deployed();
    
    // Deploy cross-chain liquidity
    console.log(chalk.gray('  Deploying cross-chain liquidity module...'));
    const CrossChainLiquidity = await ethers.getContractFactory('CrossChainLiquidity');
    const crossChainLiquidity = await CrossChainLiquidity.deploy(
        bridge.address,
        riskAssessment.address,
        lendingPool.address
    );
    await crossChainLiquidity.deployed();
    
    // Setup contracts and permissions
    console.log(chalk.gray('  Setting up permissions and configurations...'));
    
    // Grant roles to contracts
    await bridge.grantRole(await bridge.ORACLE_ROLE(), owner.address);
    await bridge.grantRole(await bridge.RELAYER_ROLE(), owner.address);
    await bridge.grantRole(await bridge.ZK_VERIFIER_ROLE(), owner.address);
    
    // Register bridge with risk assessment
    await riskAssessment.registerBridge(bridge.address);
    
    // Set lending pool as admin for risk assessment
    await riskAssessment.setLendingPool(lendingPool.address);
    
    // Register cross-chain liquidity with bridge
    await bridge.registerCrossChainModule(crossChainLiquidity.address);
    
    // Register tokens with cross-chain liquidity
    await crossChainLiquidity.registerAsset(
        lendingToken.address,
        config.targetChainId,
        ethers.utils.formatBytes32String('IOTA_LENDING_TOKEN')
    );
    await crossChainLiquidity.registerAsset(
        collateralToken.address,
        config.targetChainId,
        ethers.utils.formatBytes32String('IOTA_COLLATERAL_TOKEN')
    );
    
    // Setup demo users
    console.log(chalk.gray('  Setting up demo users...'));
    for (const user of users) {
        // Transfer tokens to users
        await lendingToken.transfer(user.address, config.initialBalance);
        await collateralToken.transfer(user.address, config.initialBalance);
        
        // Approve tokens for lending pool
        await lendingToken.connect(user).approve(lendingPool.address, ethers.constants.MaxUint256);
        await collateralToken.connect(user).approve(lendingPool.address, ethers.constants.MaxUint256);
        
        // Approve tokens for cross-chain liquidity
        await lendingToken.connect(user).approve(crossChainLiquidity.address, ethers.constants.MaxUint256);
        await collateralToken.connect(user).approve(crossChainLiquidity.address, ethers.constants.MaxUint256);
    }
    
    // Log contract addresses
    console.log(chalk.gray('  Deployment complete. Contract addresses:'));
    console.log(chalk.gray(`    Lending Token: ${lendingToken.address}`));
    console.log(chalk.gray(`    Collateral Token: ${collateralToken.address}`));
    console.log(chalk.gray(`    Bridge: ${bridge.address}`));
    console.log(chalk.gray(`    Lending Pool: ${lendingPool.address}`));
    console.log(chalk.gray(`    Cross-Chain Liquidity: ${crossChainLiquidity.address}`));
    console.log(chalk.gray(`    Risk Assessment: ${riskAssessment.address}`));
    
    return {
        owner,
        users,
        lendingToken,
        collateralToken,
        bridge,
        lendingPool,
        crossChainLiquidity,
        riskAssessment
    };
}

/**
 * Simulate user activities (deposits, borrows, repayments)
 */
async function simulateUserActivities(users, lendingToken, collateralToken, lendingPool) {
    console.log(chalk.gray('  Simulating deposits and collateral...'));
    
    // User 0: Deposit & Add Collateral
    await lendingToken.connect(users[0]).approve(lendingPool.address, config.depositAmount);
    await lendingPool.connect(users[0]).deposit(config.depositAmount);
    console.log(chalk.gray(`    User ${users[0].address.substring(0, 6)}... deposited ${ethers.utils.formatEther(config.depositAmount)} tokens`));
    
    await collateralToken.connect(users[0]).approve(lendingPool.address, config.collateralAmount);
    await lendingPool.connect(users[0]).addCollateral(config.collateralAmount);
    console.log(chalk.gray(`    User ${users[0].address.substring(0, 6)}... added ${ethers.utils.formatEther(config.collateralAmount)} collateral`));
    
    // User 1: Deposit & Add Collateral
    await lendingToken.connect(users[1]).approve(lendingPool.address, config.depositAmount.mul(2));
    await lendingPool.connect(users[1]).deposit(config.depositAmount.mul(2));
    console.log(chalk.gray(`    User ${users[1].address.substring(0, 6)}... deposited ${ethers.utils.formatEther(config.depositAmount.mul(2))} tokens`));
    
    await collateralToken.connect(users[1]).approve(lendingPool.address, config.collateralAmount.mul(2));
    await lendingPool.connect(users[1]).addCollateral(config.collateralAmount.mul(2));
    console.log(chalk.gray(`    User ${users[1].address.substring(0, 6)}... added ${ethers.utils.formatEther(config.collateralAmount.mul(2))} collateral`));
    
    await delay(500);
    
    console.log(chalk.gray('\n  Simulating borrowing...'));
    
    // User 2: Borrow
    await collateralToken.connect(users[2]).approve(lendingPool.address, config.collateralAmount);
    await lendingPool.connect(users[2]).addCollateral(config.collateralAmount);
    console.log(chalk.gray(`    User ${users[2].address.substring(0, 6)}... added ${ethers.utils.formatEther(config.collateralAmount)} collateral`));
    
    await lendingPool.connect(users[2]).borrow(config.borrowAmount);
    console.log(chalk.gray(`    User ${users[2].address.substring(0, 6)}... borrowed ${ethers.utils.formatEther(config.borrowAmount)} tokens`));
    
    // User 3: Borrow
    await collateralToken.connect(users[3]).approve(lendingPool.address, config.collateralAmount.div(2));
    await lendingPool.connect(users[3]).addCollateral(config.collateralAmount.div(2));
    console.log(chalk.gray(`    User ${users[3].address.substring(0, 6)}... added ${ethers.utils.formatEther(config.collateralAmount.div(2))} collateral`));
    
    await lendingPool.connect(users[3]).borrow(config.borrowAmount.div(2));
    console.log(chalk.gray(`    User ${users[3].address.substring(0, 6)}... borrowed ${ethers.utils.formatEther(config.borrowAmount.div(2))} tokens`));
    
    await delay(500);
    
    console.log(chalk.gray('\n  Simulating repayments...'));
    
    // User 2: Partial Repay
    const repayAmount = config.borrowAmount.div(4);
    await lendingToken.connect(users[2]).approve(lendingPool.address, repayAmount);
    await lendingPool.connect(users[2]).repay(repayAmount);
    console.log(chalk.gray(`    User ${users[2].address.substring(0, 6)}... repaid ${ethers.utils.formatEther(repayAmount)} tokens`));
    
    // Query current state
    const user2Borrow = await lendingPool.borrows(users[2].address);
    const user2Collateral = await lendingPool.collaterals(users[2].address);
    console.log(chalk.gray(`    Current state for User ${users[2].address.substring(0, 6)}...:`));
    console.log(chalk.gray(`      Borrowed: ${ethers.utils.formatEther(user2Borrow)} tokens`));
    console.log(chalk.gray(`      Collateral: ${ethers.utils.formatEther(user2Collateral)} tokens`));
    
    // Get health factor
    const healthFactor = await lendingPool.getHealthFactor(users[2].address);
    console.log(chalk.gray(`      Health Factor: ${healthFactor / 100}`)); // Convert basis points to decimal
}

/**
 * Run AI risk assessment on users
 */
async function runAIRiskAssessment(users, riskAssessment, lendingPool) {
    console.log(chalk.gray('  Generating user transaction data...'));
    
    // Generate mock transaction data for users
    const userTransactionData = [];
    for (const user of users) {
        // Generate random transaction data to simulate on-chain activity
        const userData = {
            address: user.address,
            transaction_count: Math.floor(Math.random() * 100) + 20,
            avg_transaction_value: Math.random() * 1000 + 100,
            wallet_age_days: Math.floor(Math.random() * 500) + 30,
            previous_loans_count: Math.floor(Math.random() * 5),
            repayment_ratio: Math.random() * 0.3 + 0.7, // 70%-100% repayment
            default_count: Math.floor(Math.random() * 2),
            collateral_diversity: Math.floor(Math.random() * 4) + 1,
            cross_chain_activity: Math.floor(Math.random() * 5),
            lending_protocol_interactions: Math.floor(Math.random() * 10) + 5,
            wallet_balance_volatility: Math.random() * 0.4
        };
        userTransactionData.push(userData);
    }
    
    console.log(chalk.gray('  Running AI risk assessment model...'));
    
    // Run AI risk assessment
    for (const userData of userTransactionData) {
        try {
            // Call the AI model to assess risk
            const riskScore = await mockAIFunctions.assessRisk(userData);
            const defaultProbability = await mockAIFunctions.predictDefaultProbability(userData);
            const optimizedRate = await mockAIFunctions.optimizeInterestRate(userData, { 
                volatility: 0.2, 
                liquidityRatio: 0.7 
            });
            const warnings = await mockAIFunctions.generateEarlyWarningSignals(userData);
            
            console.log(chalk.gray(`    User ${userData.address.substring(0, 6)}... risk assessment:`));
            console.log(chalk.gray(`      Risk Score: ${riskScore}`));
            console.log(chalk.gray(`      Default Probability: ${(defaultProbability * 100).toFixed(2)}%`));
            console.log(chalk.gray(`      Optimized Interest Rate: ${(optimizedRate * 100).toFixed(2)}%`));
            
            if (Object.keys(warnings).length > 0) {
                console.log(chalk.gray(`      Warnings: ${Object.keys(warnings).length} detected`));
                for (const [key, warning] of Object.entries(warnings)) {
                    console.log(chalk.yellow(`        - ${key}: ${warning.severity} - ${warning.description}`));
                }
            } else {
                console.log(chalk.gray(`      Warnings: None`));
            }
            
            // Update risk score in the lending pool via risk assessment contract
            await riskAssessment.updateUserRiskScore(userData.address, riskScore);
            console.log(chalk.gray(`      Updated risk score on-chain`));
            
            await delay(300);
        } catch (error) {
            console.error(chalk.red(`    Error assessing risk for user ${userData.address}: ${error.message}`));
        }
    }
    
    // Log that we're simulating the ZK proof part
    console.log(chalk.gray('\n  Simulating zero-knowledge proof verification for credit scores...'));
    console.log(chalk.gray('    (In a real implementation, users would generate ZK proofs locally)'));
    
    // Simulate ZK proof verification
    for (let i = 0; i < 2; i++) {
        const user = users[i];
        console.log(chalk.gray(`    Verifying ZK proof for User ${user.address.substring(0, 6)}...`));
        
        // Mock proof data
        const proofData = {
            user: user.address,
            score_commitment: ethers.utils.hexlify(ethers.utils.randomBytes(32)),
            zk_proof: ethers.utils.hexlify(ethers.utils.randomBytes(128)),
            public_input: ethers.utils.hexlify(ethers.utils.randomBytes(32))
        };
        
        // Submit proof to risk assessment
        await riskAssessment.submitCreditScoreProof(
            proofData.user,
            proofData.score_commitment,
            proofData.zk_proof,
            proofData.public_input
        );
        
        console.log(chalk.gray(`      Proof verified successfully`));
        
        await delay(300);
    }
}

/**
 * Test cross-layer communication between EVM and Move
 */
async function testCrossLayerCommunication(users, bridge, lendingPool) {
    console.log(chalk.gray('  Simulating cross-layer message passing...'));
    
    // Simulate risk score update message from L2 (EVM) to L1 (Move)
    const user = users[0];
    const messageType = "RISK_SCORE_UPDATE";
    const payload = ethers.utils.defaultAbiCoder.encode(
        ["address", "uint256"],
        [user.address, 75] // Address and risk score
    );
    
    // Target address (in a real implementation, this would be the Move module address)
    const targetAddress = ethers.utils.formatBytes32String("INTELLILEND_ASSET_MODULE");
    
    console.log(chalk.gray(`    Sending ${messageType} message for User ${user.address.substring(0, 6)}...`));
    
    // Send message via bridge
    const tx = await bridge.sendMessageToL1(
        targetAddress,
        messageType,
        payload,
        2000000, // gas limit
        { value: ethers.utils.parseEther("0.01") } // Pay for message fee
    );
    
    await tx.wait();
    
    // Get message ID from logs (simplified)
    const messageId = ethers.utils.hexlify(ethers.utils.randomBytes(32));
    
    console.log(chalk.gray(`      Message sent successfully (ID: ${messageId.substring(0, 10)}...)`));
    
    await delay(500);
    
    // Simulate message confirmation
    console.log(chalk.gray('  Simulating message confirmation from oracles...'));
    
    // Oracle 1 confirmation
    await bridge.confirmMessage(messageId, "0x00"); // Simplified signature
    console.log(chalk.gray(`    Oracle 1 confirmed message`));
    
    // Oracle 2 confirmation
    await bridge.confirmMessage(messageId, "0x01"); // Simplified signature
    console.log(chalk.gray(`    Oracle 2 confirmed message`));
    
    // Oracle 3 confirmation
    await bridge.confirmMessage(messageId, "0x02"); // Simplified signature
    console.log(chalk.gray(`    Oracle 3 confirmed message`));
    
    console.log(chalk.gray(`    Message processing complete with required confirmations`));
    
    await delay(500);
    
    // Simulate message coming back from L1 (Move) to L2 (EVM)
    console.log(chalk.gray('\n  Simulating message from L1 (Move) to L2 (EVM)...'));
    
    // Simulate a collateral change message
    const l1MessageType = "COLLATERAL_CHANGE";
    const l1Payload = ethers.utils.defaultAbiCoder.encode(
        ["address", "uint256"],
        [user.address, ethers.utils.parseEther("10000")] // Address and new collateral amount
    );
    
    // Sender on L1 (in a real implementation, this would be the Move module address)
    const sender = ethers.utils.formatBytes32String("INTELLILEND_ASSET_MODULE");
    
    // L1 timestamp
    const l1Timestamp = Math.floor(Date.now() / 1000);
    
    // Oracle signature (simplified)
    const signature = "0x00";
    
    console.log(chalk.gray(`    Processing ${l1MessageType} message from L1 for User ${user.address.substring(0, 6)}...`));
    
    // Process message
    await bridge.processMessageFromL1(
        sender,
        l1MessageType,
        l1Payload,
        l1Timestamp,
        signature
    );
    
    console.log(chalk.gray(`    Message processed successfully`));
    
    // Check the updated state
    const updatedCollateral = await lendingPool.collaterals(user.address);
    console.log(chalk.gray(`    Updated collateral for User ${user.address.substring(0, 6)}: ${ethers.utils.formatEther(updatedCollateral)} tokens`));
}

/**
 * Demonstrate cross-chain liquidity functionality
 */
async function demonstrateCrossChainLiquidity(users, lendingToken, crossChainLiquidity) {
    console.log(chalk.gray('  Setting up yield strategies...'));
    
    // Register yield strategies
    await crossChainLiquidity.registerStrategy(
        lendingToken.address,
        "Conservative Lending",
        700, // 7% APY
        20, // Low risk
        ethers.utils.parseEther("1000"),
        ethers.utils.parseEther("1000000"),
        users[4].address // Use last user as mock strategy controller
    );
    
    await crossChainLiquidity.registerStrategy(
        lendingToken.address,
        "Balanced Yield",
        1200, // 12% APY
        50, // Medium risk
        ethers.utils.parseEther("5000"),
        ethers.utils.parseEther("2000000"),
        users[4].address
    );
    
    await crossChainLiquidity.registerStrategy(
        lendingToken.address,
        "Aggressive Growth",
        2500, // 25% APY
        80, // High risk
        ethers.utils.parseEther("10000"),
        ethers.utils.parseEther("5000000"),
        users[4].address
    );
    
    console.log(chalk.gray('  Simulating liquidity provision...'));
    
    // User 0 provides liquidity
    const liquidityAmount = ethers.utils.parseEther("20000");
    await lendingToken.connect(users[0]).approve(crossChainLiquidity.address, liquidityAmount);
    await crossChainLiquidity.connect(users[0]).addLiquidity(lendingToken.address, liquidityAmount);
    console.log(chalk.gray(`    User ${users[0].address.substring(0, 6)}... provided ${ethers.utils.formatEther(liquidityAmount)} tokens`));
    
    // User 1 provides liquidity
    const liquidityAmount2 = ethers.utils.parseEther("15000");
    await lendingToken.connect(users[1]).approve(crossChainLiquidity.address, liquidityAmount2);
    await crossChainLiquidity.connect(users[1]).addLiquidity(lendingToken.address, liquidityAmount2);
    console.log(chalk.gray(`    User ${users[1].address.substring(0, 6)}... provided ${ethers.utils.formatEther(liquidityAmount2)} tokens`));
    
    await delay(500);
    
    console.log(chalk.gray('\n  Simulating cross-chain deposit...'));
    
    // Simulate cross-chain deposit from another chain
    await crossChainLiquidity.processCrossChainDeposit(
        config.targetChainId,
        ethers.utils.formatBytes32String('IOTA_LENDING_TOKEN'),
        ethers.utils.parseEther("5000"),
        users[2].address
    );
    
    console.log(chalk.gray(`    Processed cross-chain deposit of 5,000 tokens for User ${users[2].address.substring(0, 6)}...`));
    
    await delay(500);
    
    console.log(chalk.gray('\n  Updating market conditions...'));
    
    // Update market conditions
    await crossChainLiquidity.updateMarketConditions(70, 20, 40);
    console.log(chalk.gray('    Market conditions updated: High volatility, Positive trend, Medium risk'));
    
    await delay(500);
    
    console.log(chalk.gray('\n  Simulating rebalancing...'));
    
    // Trigger rebalance
    await crossChainLiquidity.rebalance(lendingToken.address);
    console.log(chalk.gray('    Rebalanced liquidity allocation based on market conditions'));
    
    // Get current asset details
    const assetDetails = await crossChainLiquidity.getAssetDetails(lendingToken.address);
    console.log(chalk.gray(`    Current allocation: ${ethers.utils.formatEther(assetDetails.allocatedLiquidity)} tokens`));
    console.log(chalk.gray(`    Utilization rate: ${assetDetails.utilizationRate / 100}%`));
    console.log(chalk.gray(`    Current strategy: ${assetDetails.currentStrategyIndex}`));
    
    await delay(500);
    
    console.log(chalk.gray('\n  Simulating yield harvesting...'));
    
    // Simulate yield harvesting
    // (In a real implementation, this would call the strategy controller to harvest yield)
    console.log(chalk.gray('    Harvesting yield from strategies...'));
    
    // Mock yield data
    const harvestedYield = ethers.utils.parseEther("2500");
    const fee = harvestedYield.mul(10).div(100); // 10% fee
    const netYield = harvestedYield.sub(fee);
    
    console.log(chalk.gray(`    Harvested ${ethers.utils.formatEther(harvestedYield)} tokens`));
    console.log(chalk.gray(`    Protocol fee: ${ethers.utils.formatEther(fee)} tokens`));
    console.log(chalk.gray(`    Net yield distributed: ${ethers.utils.formatEther(netYield)} tokens`));
}

/**
 * Test liquidation scenario
 */
async function testLiquidation(users, lendingToken, collateralToken, lendingPool) {
    // Setup a user for liquidation (User 4)
    const user = users[4];
    const liquidator = users[3];
    
    console.log(chalk.gray('  Setting up liquidation scenario...'));
    
    // User adds minimal collateral
    const collateralAmount = ethers.utils.parseEther("10000");
    await collateralToken.connect(user).approve(lendingPool.address, collateralAmount);
    await lendingPool.connect(user).addCollateral(collateralAmount);
    console.log(chalk.gray(`    User ${user.address.substring(0, 6)}... added ${ethers.utils.formatEther(collateralAmount)} collateral`));
    
    // User borrows maximum allowed
    const maxBorrowAmount = ethers.utils.parseEther("8000");
    await lendingPool.connect(user).borrow(maxBorrowAmount);
    console.log(chalk.gray(`    User ${user.address.substring(0, 6)}... borrowed ${ethers.utils.formatEther(maxBorrowAmount)} tokens`));
    
    // Check health factor - should be close to liquidation threshold
    const healthFactor = await lendingPool.getHealthFactor(user.address);
    console.log(chalk.gray(`    Initial health factor: ${healthFactor / 100}`));
    
    // Update user's risk score to make position undercollateralized
    console.log(chalk.gray('\n  Updating risk score to trigger liquidation...'));
    await lendingPool.updateRiskScore(user.address, 90); // High risk score
    console.log(chalk.gray(`    Updated risk score to 90 (High Risk)`));
    
    // Check health factor after risk update - should be below liquidation threshold
    const newHealthFactor = await lendingPool.getHealthFactor(user.address);
    console.log(chalk.gray(`    New health factor: ${newHealthFactor / 100}`));
    
    // Check if position is healthy
    const isHealthy = await lendingPool.isPositionHealthy(user.address);
    console.log(chalk.gray(`    Position healthy: ${isHealthy}`));
    
    await delay(500);
    
    // Liquidator setup
    console.log(chalk.gray('\n  Preparing liquidator...'));
    
    // Transfer tokens to liquidator
    const repayAmount = ethers.utils.parseEther("4000");
    await lendingToken.connect(users[0]).transfer(liquidator.address, repayAmount);
    
    // Approve tokens for lending pool
    await lendingToken.connect(liquidator).approve(lendingPool.address, repayAmount);
    
    console.log(chalk.gray(`    Liquidator ${liquidator.address.substring(0, 6)}... prepared with ${ethers.utils.formatEther(repayAmount)} tokens`));
    
    // Perform liquidation
    console.log(chalk.gray('\n  Executing liquidation...'));
    await lendingPool.connect(liquidator).liquidate(user.address, repayAmount);
    
    // Check updated state
    const userBorrow = await lendingPool.borrows(user.address);
    const userCollateral = await lendingPool.collaterals(user.address);
    const liquidatorCollateral = await collateralToken.balanceOf(liquidator.address);
    
    console.log(chalk.gray(`    Liquidation complete`));
    console.log(chalk.gray(`    User ${user.address.substring(0, 6)}... remaining debt: ${ethers.utils.formatEther(userBorrow)} tokens`));
    console.log(chalk.gray(`    User ${user.address.substring(0, 6)}... remaining collateral: ${ethers.utils.formatEther(userCollateral)} tokens`));
    console.log(chalk.gray(`    Liquidator ${liquidator.address.substring(0, 6)}... received: ${ethers.utils.formatEther(liquidatorCollateral)} collateral tokens`));
    
    // Check health factor after liquidation
    const finalHealthFactor = await lendingPool.getHealthFactor(user.address);
    console.log(chalk.gray(`    Final health factor: ${finalHealthFactor / 100}`));
}

/**
 * Generate performance metrics for the protocol
 */
async function generatePerformanceMetrics(
    owner,
    users,
    lendingToken,
    collateralToken,
    lendingPool,
    crossChainLiquidity,
    riskAssessment
) {
    console.log(chalk.gray('  Calculating protocol performance metrics...'));
    
    // Get total deposits
    const totalDeposits = await lendingPool.totalDeposits();
    
    // Get total borrows
    const totalBorrows = await lendingPool.totalBorrows();
    
    // Get total collateral
    const totalCollateral = await lendingPool.totalCollateral();
    
    // Calculate utilization rate
    const utilizationRate = totalDeposits.eq(0) ? 0 : totalBorrows.mul(100).div(totalDeposits);
    
    // Calculate collateralization ratio
    const collateralizationRatio = totalBorrows.eq(0) ? ethers.constants.MaxUint256 : totalCollateral.mul(100).div(totalBorrows);
    
    // Get cross-chain liquidity metrics
    const assetDetails = await crossChainLiquidity.getAssetDetails(lendingToken.address);
    
    // Generate report
    console.log(chalk.cyan('\nIntelliLend Protocol Performance Metrics:'));
    console.log(chalk.cyan('----------------------------------------'));
    console.log(chalk.white(`Total Deposits: ${ethers.utils.formatEther(totalDeposits)} tokens`));
    console.log(chalk.white(`Total Borrows: ${ethers.utils.formatEther(totalBorrows)} tokens`));
    console.log(chalk.white(`Total Collateral: ${ethers.utils.formatEther(totalCollateral)} tokens`));
    console.log(chalk.white(`Utilization Rate: ${utilizationRate}%`));
    console.log(chalk.white(`Collateralization Ratio: ${collateralizationRatio}%`));
    console.log(chalk.white(`Cross-Chain Liquidity: ${ethers.utils.formatEther(assetDetails.totalLiquidity)} tokens`));
    console.log(chalk.white(`Allocated Liquidity: ${ethers.utils.formatEther(assetDetails.allocatedLiquidity)} tokens`));
    console.log(chalk.white(`Strategy Utilization Rate: ${assetDetails.utilizationRate / 100}%`));
    
    // Write to file
    const report = {
        timestamp: new Date().toISOString(),
        metrics: {
            totalDeposits: ethers.utils.formatEther(totalDeposits),
            totalBorrows: ethers.utils.formatEther(totalBorrows),
            totalCollateral: ethers.utils.formatEther(totalCollateral),
            utilizationRate: utilizationRate.toString(),
            collateralizationRatio: collateralizationRatio.toString(),
            crossChainLiquidity: ethers.utils.formatEther(assetDetails.totalLiquidity),
            allocatedLiquidity: ethers.utils.formatEther(assetDetails.allocatedLiquidity),
            strategyUtilizationRate: (assetDetails.utilizationRate / 100).toString()
        }
    };
    
    // Ensure reports directory exists
    const reportsDir = path.join(__dirname, '../reports');
    if (!fs.existsSync(reportsDir)) {
        fs.mkdirSync(reportsDir, { recursive: true });
    }
    
    fs.writeFileSync(
        path.join(reportsDir, 'performance_metrics.json'),
        JSON.stringify(report, null, 2)
    );
    
    console.log(chalk.green('\nPerformance metrics saved to reports/performance_metrics.json'));
}

/**
 * Helper function for simulation delays
 */
async function delay(ms) {
    if (config.simulateDelay) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Run the demo
runDemo()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(chalk.red(`Error running demo: ${error.message}`));
        console.error(error);
        process.exit(1);
    });
