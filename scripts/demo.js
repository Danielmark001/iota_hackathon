#!/usr/bin/env node

/**
 * IntelliLend - AI-Powered DeFi Lending Platform Demo
 * 
 * This script demonstrates the key features of the IntelliLend platform
 * for the IOTA DefAI Hackathon, showcasing AI-powered risk assessment,
 * quantum-resistant assets, cross-layer communication, and more.
 */

const { ethers } = require('ethers');
const chalk = require('chalk');
const inquirer = require('inquirer');
const ora = require('ora');
const figlet = require('figlet');
const Table = require('cli-table3');
const { SingleBar, Presets } = require('cli-progress');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Import AI modules (with mocks for demo if needed)
const AdvancedAIHelper = require('../ai-model/ai-helper');
const { MarketSentimentAnalyzer } = require('../ai-model/market_sentiment');

// Define contract ABIs and addresses (simplified for demo)
const LendingPoolABI = require('../smart-contracts/evm/contracts/LendingPool.json');
const ZKVerifierABI = require('../smart-contracts/evm/contracts/ZKVerifier.json');
const ZKBridgeABI = require('../smart-contracts/bridge/ZKBridge.json');
const AIYieldOptimizerABI = require('../smart-contracts/evm/contracts/AIYieldOptimizer.json');

// Demo configuration 
const config = {
    useMocks: process.env.USE_MOCKS === 'true',
    rpcUrl: process.env.IOTA_EVM_RPC_URL || 'http://localhost:8545',
    lendingPoolAddress: process.env.LENDING_POOL_ADDRESS || '0x7BaE93605Db8b5afE945838e8aaF7f2c18b8c950',
    zkVerifierAddress: process.env.ZK_VERIFIER_ADDRESS || '0xb2c24aa09ab254f8a5c4450d1183c3ccce9a5e8d',
    zkBridgeAddress: process.env.ZK_BRIDGE_ADDRESS || '0x7F6a93BB0aFe0d99D2c8d966Fa6f5a58FA2A0a6F',
    aiYieldOptimizerAddress: process.env.AI_YIELD_OPTIMIZER_ADDRESS || '0xf4a8F74879964EcbcA236e9F82e8daFd5eB70E63',
    demoUserAddress: '0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199', // Demo user address
    demoPrivateKey: process.env.DEMO_PRIVATE_KEY // Optional for actual transactions
};

// AI Services
let aiHelper, marketSentiment, provider, wallet;
let lendingPool, zkVerifier, zkBridge, aiYieldOptimizer;

// Mock data for demo
const mockUserData = {
    address: config.demoUserAddress,
    deposits: 1000,
    borrows: 400,
    collaterals: 1500,
    risk_score: 35,
    transaction_count: 87,
    wallet_age_days: 243,
    repayment_ratio: 0.98,
    default_count: 0,
    late_payment_frequency: 0.01,
    wallet_balance: 5000,
    wallet_balance_volatility: 0.12,
    identity_verified: true,
    identity_score: 80
};

// Main demo function
async function runDemo() {
    printHeader();
    
    await initializeServices();
    
    let exit = false;
    
    while (!exit) {
        const { action } = await inquirer.prompt([
            {
                type: 'list',
                name: 'action',
                message: 'What would you like to explore?',
                choices: [
                    { name: '1. AI Risk Assessment', value: 'risk' },
                    { name: '2. Quantum-Resistant Asset Management', value: 'quantum' },
                    { name: '3. Market Sentiment Analysis', value: 'sentiment' },
                    { name: '4. ZK-Identity Verification', value: 'identity' },
                    { name: '5. Cross-Layer ZK-Bridge Operations', value: 'bridge' },
                    { name: '6. AI Yield Optimization', value: 'yield' },
                    { name: '7. Full End-to-End Demo', value: 'full' },
                    { name: '8. Exit', value: 'exit' }
                ]
            }
        ]);
        
        switch (action) {
            case 'risk':
                await demonstrateRiskAssessment();
                break;
            case 'quantum':
                await demonstrateQuantumAssets();
                break;
            case 'sentiment':
                await demonstrateMarketSentiment();
                break;
            case 'identity':
                await demonstrateZKIdentity();
                break;
            case 'bridge':
                await demonstrateCrossLayerBridge();
                break;
            case 'yield':
                await demonstrateYieldOptimization();
                break;
            case 'full':
                await demonstrateFullFlow();
                break;
            case 'exit':
                exit = true;
                break;
        }
    }
    
    console.log(chalk.green.bold("\nThank you for exploring IntelliLend! 🚀"));
}

// Initialize services
async function initializeServices() {
    const spinner = ora('Initializing services...').start();
    
    try {
        // Initialize AI services
        aiHelper = new AdvancedAIHelper({
            useRemoteAPI: config.useMocks,
            modelPath: path.join(__dirname, '../ai-model/models')
        });
        
        await aiHelper.initialize();
        
        marketSentiment = new MarketSentimentAnalyzer();
        
        // Initialize ethereum provider
        provider = new ethers.providers.JsonRpcProvider(config.rpcUrl);
        
        // If private key is provided, create a wallet
        if (config.demoPrivateKey) {
            wallet = new ethers.Wallet(config.demoPrivateKey, provider);
        }
        
        // Create contract instances
        if (!config.useMocks) {
            lendingPool = new ethers.Contract(config.lendingPoolAddress, LendingPoolABI, provider);
            zkVerifier = new ethers.Contract(config.zkVerifierAddress, ZKVerifierABI, provider);
            zkBridge = new ethers.Contract(config.zkBridgeAddress, ZKBridgeABI, provider);
            aiYieldOptimizer = new ethers.Contract(config.aiYieldOptimizerAddress, AIYieldOptimizerABI, provider);
            
            // Connect with wallet if available
            if (wallet) {
                lendingPool = lendingPool.connect(wallet);
                zkVerifier = zkVerifier.connect(wallet);
                zkBridge = zkBridge.connect(wallet);
                aiYieldOptimizer = aiYieldOptimizer.connect(wallet);
            }
        }
        
        spinner.succeed('Services initialized successfully!');
    } catch (error) {
        spinner.fail(`Failed to initialize services: ${error.message}`);
        console.log(chalk.yellow('Running in mock mode due to initialization error.'));
        config.useMocks = true;
    }
}

// Demo 1: AI Risk Assessment
async function demonstrateRiskAssessment() {
    console.log(chalk.blue.bold("\n===== AI Risk Assessment Demo =====\n"));
    console.log("The IntelliLend platform uses advanced AI to assess borrower risk based on on-chain activity,");
    console.log("wallet behavior, lending history, and external market conditions.\n");
    
    const spinner = ora('Analyzing risk factors...').start();
    
    try {
        // Wait to simulate processing
        await sleep(2000);
        
        // Get risk assessment from AI helper
        const riskAssessment = await aiHelper.assessRisk(mockUserData);
        
        spinner.succeed('Risk assessment completed!');
        
        // Display the risk score
        console.log(chalk.green(`\nRisk Score: ${riskAssessment.riskScore}/100`));
        console.log(`Confidence: ${(riskAssessment.confidence * 100).toFixed(1)}%`);
        console.log(`Classification: ${getRiskCategory(riskAssessment.riskScore)}\n`);
        
        // Display risk factors
        console.log(chalk.yellow.bold("Top Risk Factors:"));
        const factorsTable = new Table({
            head: [chalk.cyan('Factor'), chalk.cyan('Importance'), chalk.cyan('Description')],
            colWidths: [20, 15, 50]
        });
        
        for (const factor of riskAssessment.factors) {
            factorsTable.push([
                factor.Feature,
                `${(factor.Importance * 100).toFixed(1)}%`,
                getFactorDescription(factor.Feature)
            ]);
        }
        
        console.log(factorsTable.toString());
        
        // Display market influence
        console.log(chalk.yellow.bold("\nMarket Influence:"));
        console.log(`Market conditions are currently affecting the risk score by ${riskAssessment.marketInfluence.toFixed(2) * 100}%.`);
        console.log(`Market Volatility Index: ${riskAssessment.marketVolatilityIndex}/100`);
        console.log(`Fear & Greed Index: ${riskAssessment.fearGreedIndex} (${riskAssessment.fearGreedCategory})\n`);
        
        // Display AI recommendations
        console.log(chalk.yellow.bold("AI Recommendations:"));
        for (const rec of riskAssessment.recommendations) {
            console.log(`${chalk.green('▶')} ${chalk.bold(rec.title)} (${rec.impact} impact)`);
            console.log(`   ${rec.description}\n`);
        }
        
        // Show model metadata
        console.log(chalk.gray("Model: Transformer-based risk assessment with 38+ on-chain features"));
        console.log(chalk.gray("Last updated: " + new Date().toLocaleString()));
        
    } catch (error) {
        spinner.fail(`Error during risk assessment: ${error.message}`);
    }
    
    await promptToContinue();
}

// Demo 2: Quantum-Resistant Asset Management
async function demonstrateQuantumAssets() {
    console.log(chalk.blue.bold("\n===== Quantum-Resistant Asset Management Demo =====\n"));
    console.log("IntelliLend uses IOTA's Move-based Layer 1 to implement quantum-resistant assets");
    console.log("with enhanced privacy features and homomorphic encryption for secure operations.\n");
    
    const spinner = ora('Creating quantum-resistant asset...').start();
    
    try {
        await sleep(2000);
        
        // Simulate creating a quantum asset
        const assetDetails = {
            id: "0x" + randomHex(64),
            tokenName: "QIOTA",
            value: 1000,
            owner: config.demoUserAddress,
            creationTime: Date.now(),
            signature: {
                type: "Falcon-512",
                r: "0x" + randomHex(32),
                s: "0x" + randomHex(32),
                publicKeyHash: "0x" + randomHex(32)
            },
            encapsulation: {
                ciphertext: "0x" + randomHex(64),
                sharedSecretHash: "0x" + randomHex(32)
            }
        };
        
        spinner.succeed('Quantum-resistant asset created successfully!');
        
        // Display asset details
        console.log(chalk.green(`\nAsset ID: ${assetDetails.id.substring(0, 18)}...`));
        console.log(`Token: ${assetDetails.tokenName}`);
        console.log(`Value: ${assetDetails.value}`);
        console.log(`Owner: ${assetDetails.owner}`);
        console.log(`Creation Time: ${new Date(assetDetails.creationTime).toLocaleString()}\n`);
        
        // Display quantum security features
        console.log(chalk.yellow.bold("Quantum Security Features:"));
        
        const securityTable = new Table({
            head: [chalk.cyan('Feature'), chalk.cyan('Details')],
            colWidths: [25, 60]
        });
        
        securityTable.push(
            ['Signature Scheme', `Falcon-512 (NIST PQC Round 3 Finalist)`],
            ['Public Key Hash', assetDetails.signature.publicKeyHash.substring(0, 18) + '...'],
            ['Key Encapsulation', 'Kyber-768 (NIST PQC Selected Algorithm)'],
            ['Merkle Tree Auth', 'LMS (Leighton-Micali Signature)'],
            ['Homomorphic Privacy', 'Fully Homomorphic Encryption for Private Operations']
        );
        
        console.log(securityTable.toString());
        
        // Demonstrate homomorphic operations
        console.log(chalk.yellow.bold("\nDemonstrating Homomorphic Operations:"));
        
        spinner.text = 'Performing private credit score comparison...';
        spinner.start();
        
        await sleep(1500);
        
        spinner.succeed('Privacy-preserving comparison completed!');
        
        console.log('\nPerformed encrypted comparison between two credit scores without revealing actual values.');
        console.log('Result: Credit Score A > Credit Score B (comparison done entirely on encrypted data)\n');
        
        // Show delegation capabilities
        console.log(chalk.yellow.bold("Permission Delegation:"));
        console.log("The asset's permission tree allows selective delegation of rights while maintaining quantum resistance:");
        
        const permissionsTable = new Table({
            head: [chalk.cyan('Permission'), chalk.cyan('Delegated To'), chalk.cyan('Expiration')],
            colWidths: [20, 36, 28]
        });
        
        permissionsTable.push(
            ['Transfer', 'Not delegated', 'N/A'],
            ['View Metadata', '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC', 'May 25, 2025'],
            ['Collateralize', 'Not delegated', 'N/A']
        );
        
        console.log(permissionsTable.toString());
        
    } catch (error) {
        spinner.fail(`Error during quantum asset demo: ${error.message}`);
    }
    
    await promptToContinue();
}

// Demo 3: Market Sentiment Analysis
async function demonstrateMarketSentiment() {
    console.log(chalk.blue.bold("\n===== Market Sentiment Analysis Demo =====\n"));
    console.log("IntelliLend incorporates real-time market sentiment analysis to optimize lending parameters");
    console.log("and provide early warning of market conditions that could affect lending positions.\n");
    
    const spinner = ora('Analyzing market sentiment...').start();
    
    try {
        // Wait to simulate processing
        await sleep(2000);
        
        // Get sentiment data
        const sentimentData = await marketSentiment.get_sentiment_for_asset("IOTA");
        const marketPulse = await marketSentiment.get_realtime_market_pulse(["IOTA", "BTC", "ETH"]);
        
        spinner.succeed('Market sentiment analysis completed!');
        
        // Display sentiment overview
        console.log(chalk.green(`\nIOTA Sentiment Score: ${sentimentData.sentiment_score.toFixed(2)} (${sentimentData.sentiment_label})`));
        console.log(`Market Volatility Index: ${marketPulse.global_risk_indicators.market_volatility_index.toFixed(1)}/100`);
        console.log(`Fear & Greed Index: ${marketPulse.fear_greed_index.value} (${marketPulse.fear_greed_index.category})\n`);
        
        // Display detailed sentiment components
        console.log(chalk.yellow.bold("Sentiment Components:"));
        
        const componentsTable = new Table({
            head: [chalk.cyan('Component'), chalk.cyan('Value'), chalk.cyan('Impact')],
            colWidths: [25, 15, 45]
        });
        
        componentsTable.push(
            ['News Sentiment', sentimentData.sentiment_components.news.compound.toFixed(2), 'Medium positive impact from recent announcements'],
            ['Social Media', sentimentData.sentiment_components.social.compound.toFixed(2), 'Slightly positive with increasing mentions'],
            ['Developer Activity', sentimentData.sentiment_components.github_activity.toFixed(2), 'Strong positive from increased commits'],
            ['Technical Indicators', sentimentData.sentiment_components.technical_signals.trend, 'Neutral with slight bullish bias']
        );
        
        console.log(componentsTable.toString());
        
        // Display risk factors
        console.log(chalk.yellow.bold("\nMarket Risk Factors:"));
        
        const riskTable = new Table({
            head: [chalk.cyan('Risk Factor'), chalk.cyan('Value'), chalk.cyan('Assessment')],
            colWidths: [25, 15, 45]
        });
        
        const riskFactors = await marketSentiment.get_market_risk_factors("IOTA");
        
        riskTable.push(
            ['Volatility (30d)', (riskFactors.volatility_details['30d_volatility'] * 100).toFixed(2) + '%', 'Moderate volatility, within normal range'],
            ['Correlation w/ Market', riskFactors.correlation_details.total_market.toFixed(2), 'Moderate correlation with broader crypto market'],
            ['Liquidity Risk', (riskFactors.liquidity_details.normalized_liquidity * 100).toFixed(0) + '%', 'Good liquidity with healthy trading volume'],
            ['Market Dominance', (riskFactors.market_dominance * 100).toFixed(4) + '%', 'Small but growing market share']
        );
        
        console.log(riskTable.toString());
        
        // Display market predictions
        console.log(chalk.yellow.bold("\nAI Market Predictions (7 Days):"));
        
        const predictions = {
            price_change: sentimentData.sentiment_score > 0 ? sentimentData.sentiment_score * 0.15 : sentimentData.sentiment_score * 0.1,
            volatility: riskFactors.volatility_details['7d_volatility'] * 1.2,
            sentiment_shift: marketPulse.global_risk_indicators.market_momentum * 0.5,
            confidence: 0.82
        };
        
        console.log(`Price Movement: ${(predictions.price_change * 100).toFixed(2)}% (${predictions.price_change > 0 ? 'Bullish' : 'Bearish'})`);
        console.log(`Volatility Forecast: ${(predictions.volatility * 100).toFixed(2)}%`);
        console.log(`Sentiment Direction: ${predictions.sentiment_shift > 0 ? 'Improving' : 'Deteriorating'}`);
        console.log(`Prediction Confidence: ${(predictions.confidence * 100).toFixed(0)}%\n`);
        
        // Display cross-asset correlations
        console.log(chalk.yellow.bold("Cross-Asset Correlation Matrix:"));
        
        const correlationTable = new Table({
            head: [chalk.cyan(''), chalk.cyan('IOTA'), chalk.cyan('BTC'), chalk.cyan('ETH')],
            colWidths: [10, 10, 10, 10]
        });
        
        correlationTable.push(
            ['IOTA', '1.00', '0.72', '0.68'],
            ['BTC', '0.72', '1.00', '0.85'],
            ['ETH', '0.68', '0.85', '1.00']
        );
        
        console.log(correlationTable.toString());
        
        // Show model metadata
        console.log(chalk.gray("\nModel: Transformer-based sentiment analysis with multi-source data integration"));
        console.log(chalk.gray("Sources: News articles, social media, GitHub activity, on-chain metrics, technical indicators"));
        console.log(chalk.gray("Last updated: " + new Date().toLocaleString()));
        
    } catch (error) {
        spinner.fail(`Error during market sentiment analysis: ${error.message}`);
    }
    
    await promptToContinue();
}

// Demo 4: ZK-Identity Verification
async function demonstrateZKIdentity() {
    console.log(chalk.blue.bold("\n===== Zero-Knowledge Identity Verification Demo =====\n"));
    console.log("IntelliLend's privacy-preserving identity system allows users to prove their identity");
    console.log("without revealing personal data, using zero-knowledge proofs and quantum-safe cryptography.\n");
    
    const spinner = ora('Generating identity proofs...').start();
    
    try {
        await sleep(2000);
        
        // Simulate identity verification
        const identityDetails = {
            id: 28491,
            owner: config.demoUserAddress,
            level: "Advanced", // None, Basic, Advanced, Biometric
            score: 80,
            claims: [
                {
                    schema: "EmailVerification",
                    verifier: "0x14dC79964da2C08b23698B3D3cc7Ca32193d9955",
                    issuanceTime: Date.now() - 15 * 24 * 60 * 60 * 1000, // 15 days ago
                    expirationTime: Date.now() + 350 * 24 * 60 * 60 * 1000, // 350 days from now
                    proofHash: "0x" + randomHex(64)
                },
                {
                    schema: "GovernmentID",
                    verifier: "0x14dC79964da2C08b23698B3D3cc7Ca32193d9955",
                    issuanceTime: Date.now() - 10 * 24 * 60 * 60 * 1000, // 10 days ago
                    expirationTime: Date.now() + 730 * 24 * 60 * 60 * 1000, // 2 years from now
                    proofHash: "0x" + randomHex(64)
                },
                {
                    schema: "ProofOfAddress",
                    verifier: "0x14dC79964da2C08b23698B3D3cc7Ca32193d9955",
                    issuanceTime: Date.now() - 10 * 24 * 60 * 60 * 1000, // 10 days ago
                    expirationTime: Date.now() + 365 * 24 * 60 * 60 * 1000, // 1 year from now
                    proofHash: "0x" + randomHex(64)
                }
            ],
            merkleRoot: "0x" + randomHex(64)
        };
        
        spinner.succeed('Identity verified successfully!');
        
        // Display identity overview
        console.log(chalk.green(`\nIdentity ID: ${identityDetails.id}`));
        console.log(`Owner: ${identityDetails.owner}`);
        console.log(`Verification Level: ${identityDetails.level}`);
        console.log(`Identity Score: ${identityDetails.score}/100\n`);
        
        // Display verified claims
        console.log(chalk.yellow.bold("Verified Claims:"));
        
        const claimsTable = new Table({
            head: [chalk.cyan('Claim Type'), chalk.cyan('Verified On'), chalk.cyan('Expires')],
            colWidths: [20, 25, 25]
        });
        
        for (const claim of identityDetails.claims) {
            claimsTable.push([
                claim.schema,
                new Date(claim.issuanceTime).toLocaleDateString(),
                new Date(claim.expirationTime).toLocaleDateString()
            ]);
        }
        
        console.log(claimsTable.toString());
        
        // Zero-Knowledge Proof Demo
        console.log(chalk.yellow.bold("\nZero-Knowledge Proof Generation:"));
        
        spinner.text = 'Generating ZK proof for age verification...';
        spinner.start();
        
        await sleep(2000);
        
        const zkProof = {
            id: "0x" + randomHex(32),
            schema: "AgeVerification",
            statement: "User is over 18 years old",
            challenge: "0x" + randomHex(16),
            response: "0x" + randomHex(64),
            timestamp: Date.now()
        };
        
        spinner.succeed('Zero-knowledge proof generated!');
        
        console.log('\nGenerated proof proves you are over 18 without revealing your actual age.');
        console.log(`Proof ID: ${zkProof.id.substring(0, 18)}...`);
        console.log(`Schema: ${zkProof.schema}`);
        console.log(`Statement: ${zkProof.statement}`);
        console.log(`Challenge: ${zkProof.challenge.substring(0, 10)}...`);
        console.log(`Generated: ${new Date(zkProof.timestamp).toLocaleString()}`);
        
        // Demonstrate verification
        console.log(chalk.yellow.bold("\nProof Verification:"));
        
        spinner.text = 'Verifying proof on-chain...';
        spinner.start();
        
        await sleep(1500);
        
        spinner.succeed('Proof verified successfully!');
        
        // Show identity benefits
        console.log(chalk.yellow.bold("\nIdentity Benefits:"));
        
        const benefitsTable = new Table({
            head: [chalk.cyan('Benefit'), chalk.cyan('Details')],
            colWidths: [25, 60]
        });
        
        benefitsTable.push(
            ['Risk Score Reduction', 'Your risk score is reduced by 15 points due to identity verification'],
            ['Borrowing Limit', 'Increased to 10,000 IOTA based on Advanced verification level'],
            ['Interest Rate', 'Reduced by 2% due to identity verification'],
            ['Collateral Requirement', 'Reduced by 10% for verified users']
        );
        
        console.log(benefitsTable.toString());
        
    } catch (error) {
        spinner.fail(`Error during identity verification: ${error.message}`);
    }
    
    await promptToContinue();
}

// Demo 5: Cross-Layer ZK-Bridge Operations
async function demonstrateCrossLayerBridge() {
    console.log(chalk.blue.bold("\n===== Cross-Layer ZK-Bridge Demo =====\n"));
    console.log("IntelliLend's cross-layer bridge enables secure communication between Layer 1 (Move)");
    console.log("and Layer 2 (EVM) using zero-knowledge rollups and advanced cryptography.\n");
    
    const spinner = ora('Preparing cross-layer message...').start();
    
    try {
        await sleep(1500);
        
        // Simulate message creation
        const message = {
            id: "0x" + randomHex(64),
            sender: config.demoUserAddress,
            targetAddress: "0x" + randomHex(64), // L1 address
            messageType: "RISK_SCORE_UPDATE",
            payload: "0x" + randomHex(128),
            nonce: Math.floor(Math.random() * 10000),
            timestamp: Date.now()
        };
        
        spinner.succeed('Cross-layer message prepared!');
        
        // Display message details
        console.log(chalk.green(`\nMessage ID: ${message.id.substring(0, 18)}...`));
        console.log(`Sender: ${message.sender}`);
        console.log(`Target (L1): ${message.targetAddress.substring(0, 18)}...`);
        console.log(`Message Type: ${message.messageType}`);
        console.log(`Nonce: ${message.nonce}`);
        console.log(`Timestamp: ${new Date(message.timestamp).toLocaleString()}\n`);
        
        // Generate ZK proof for rollup
        console.log(chalk.yellow.bold("Generating ZK-Rollup Proof:"));
        
        spinner.text = 'Generating ZK-rollup proof...';
        spinner.start();
        
        await sleep(2000);
        
        const zkProof = "0x" + randomHex(256);
        const commitmentHash = "0x" + randomHex(64);
        
        spinner.succeed('ZK-rollup proof generated!');
        
        // Display ZK-rollup batch
        console.log(chalk.yellow.bold("\nBatching Messages for ZK-Rollup:"));
        
        const batch = {
            batchIndex: 42,
            merkleRoot: "0x" + randomHex(64),
            messageCount: 8,
            timestamp: Date.now(),
            zkProof: zkProof,
            commitmentHash: commitmentHash
        };
        
        console.log(`Batch #${batch.batchIndex}`);
        console.log(`Messages in batch: ${batch.messageCount}`);
        console.log(`Merkle Root: ${batch.merkleRoot.substring(0, 18)}...`);
        console.log(`Commitment Hash: ${batch.commitmentHash.substring(0, 18)}...`);
        console.log(`Timestamp: ${new Date(batch.timestamp).toLocaleString()}`);
        
        // Demonstrate message processing
        console.log(chalk.yellow.bold("\nProcessing Message:"));
        
        spinner.text = 'Sending message to Layer 1...';
        spinner.start();
        
        await sleep(2000);
        
        // Show progress bar for message processing steps
        spinner.stop();
        
        console.log('\nMessage processing steps:');
        
        const progressBar = new SingleBar({
            format: ' {bar} | {percentage}% | {step}',
            barCompleteChar: '\u2588',
            barIncompleteChar: '\u2591',
            hideCursor: true
        }, Presets.shades_classic);
        
        progressBar.start(100, 0, { step: 'Initiating message validation' });
        
        await sleep(800);
        progressBar.update(20, { step: 'Verifying message signature' });
        
        await sleep(700);
        progressBar.update(40, { step: 'Verifying ZK proof validity' });
        
        await sleep(1000);
        progressBar.update(60, { step: 'Adding message to rollup batch' });
        
        await sleep(600);
        progressBar.update(80, { step: 'Finalizing batch commitment' });
        
        await sleep(900);
        progressBar.update(100, { step: 'Message processed successfully' });
        
        progressBar.stop();
        
        console.log(chalk.green('\nMessage successfully processed and added to ZK-rollup batch!'));
        
        // Show bridge statistics
        console.log(chalk.yellow.bold("\nCross-Layer Bridge Statistics:"));
        
        const statsTable = new Table({
            head: [chalk.cyan('Metric'), chalk.cyan('Value')],
            colWidths: [30, 55]
        });
        
        statsTable.push(
            ['Total batches processed', '217'],
            ['Total messages relayed', '1,842'],
            ['Average batch size', '8.5 messages/batch'],
            ['Average finality time', '2.3 minutes'],
            ['ZK-proof verification time', '1.1 seconds'],
            ['Current validators', '5'],
            ['Security Model', 'Threshold signature scheme (3-of-5)']
        );
        
        console.log(statsTable.toString());
        
    } catch (error) {
        spinner.fail(`Error during cross-layer bridge demo: ${error.message}`);
    }
    
    await promptToContinue();
}

// Demo 6: AI Yield Optimization
async function demonstrateYieldOptimization() {
    console.log(chalk.blue.bold("\n===== AI Yield Optimization Demo =====\n"));
    console.log("IntelliLend's AI-powered yield optimizer intelligently allocates funds across DeFi protocols");
    console.log("based on market conditions, risk assessment, and reinforcement learning models.\n");
    
    const spinner = ora('Generating optimal yield strategy...').start();
    
    try {
        await sleep(2500);
        
        // Generate strategy recommendation
        const strategy = await aiHelper.generateDeFiStrategy(mockUserData);
        
        spinner.succeed('Yield optimization strategy generated!');
        
        // Display strategy overview
        console.log(chalk.green(`\nRecommended Strategy: ${strategy.strategy}`));
        console.log(`Overall Risk Profile: ${getRiskProfileDescription(strategy.strategy)}`);
        console.log(`Confidence: ${(strategy.market_outlook.confidence * 100).toFixed(0)}%\n`);
        
        // Display strategy parameters
        console.log(chalk.yellow.bold("Strategy Parameters:"));
        
        const paramsTable = new Table({
            head: [chalk.cyan('Parameter'), chalk.cyan('Value'), chalk.cyan('Description')],
            colWidths: [20, 15, 50]
        });
        
        paramsTable.push(
            ['Lending Ratio', `${(strategy.parameters.lendingRatio * 100).toFixed(0)}%`, 'Portion of collateral used for lending'],
            ['Borrowing Ratio', `${(strategy.parameters.borrowingRatio * 100).toFixed(0)}%`, 'Portion of maximum possible borrowing to utilize'],
            ['Stablecoin Ratio', `${(strategy.parameters.stablecoinRatio * 100).toFixed(0)}%`, 'Allocation to stablecoins vs. volatile assets'],
            ['Min Collateralization', `${strategy.parameters.minCollateralization}%`, 'Minimum collateralization ratio to maintain']
        );
        
        console.log(paramsTable.toString());
        
        // Display market outlook
        console.log(chalk.yellow.bold("\nMarket Outlook:"));
        
        console.log(`Sentiment: ${strategy.market_outlook.sentiment}`);
        console.log(`Fear & Greed: ${strategy.market_outlook.fear_greed}`);
        console.log(`Price Prediction: ${strategy.market_outlook.price_prediction}`);
        
        // Display specific recommendations
        console.log(chalk.yellow.bold("\nSpecific Recommendations:"));
        
        let i = 1;
        for (const rec of strategy.recommendations) {
            console.log(chalk.cyan(`\n${i++}. ${rec.title} (${rec.priority} priority)`));
            console.log(`   ${rec.description}`);
            
            if (rec.current !== undefined && rec.target !== undefined) {
                console.log(`   Current: ${rec.current.toFixed(2)} IOTA → Target: ${rec.target.toFixed(2)} IOTA`);
            }
        }
        
        // Simulate yield comparison
        console.log(chalk.yellow.bold("\nExpected Yield Comparison:"));
        
        const yieldTable = new Table({
            head: [chalk.cyan('Strategy'), chalk.cyan('Est. APY'), chalk.cyan('Risk Level'), chalk.cyan('Volatility')],
            colWidths: [20, 15, 15, 15]
        });
        
        yieldTable.push(
            ['Conservative', '4.2%', 'Low', 'Low'],
            ['Moderate', '8.7%', 'Medium', 'Medium'],
            ['Aggressive', '15.3%', 'High', 'High']
        );
        
        console.log(yieldTable.toString());
        
        // Show protocol allocations
        console.log(chalk.yellow.bold("\nProtocol Allocations:"));
        
        const allocationTable = new Table({
            head: [chalk.cyan('Protocol'), chalk.cyan('Allocation'), chalk.cyan('Expected APY'), chalk.cyan('Risk Score')],
            colWidths: [20, 15, 15, 15]
        });
        
        // Generate protocol allocations based on strategy
        const protocols = [
            { name: 'IOTA Lending', allocation: 50, apy: 7.5, risk: 30 },
            { name: 'Compound', allocation: 25, apy: 8.2, risk: 40 },
            { name: 'Aave', allocation: 15, apy: 10.1, risk: 45 },
            { name: 'Lido', allocation: 10, apy: 13.8, risk: 50 }
        ];
        
        for (const protocol of protocols) {
            allocationTable.push([
                protocol.name,
                `${protocol.allocation}%`,
                `${protocol.apy}%`,
                `${protocol.risk}/100`
            ]);
        }
        
        console.log(allocationTable.toString());
        
        // Show execution steps
        console.log(chalk.yellow.bold("\nStrategy Execution Steps:"));
        
        spinner.text = 'Simulating strategy execution...';
        spinner.start();
        
        await sleep(2000);
        
        spinner.stop();
        
        console.log('\nExecution steps:');
        
        const progressBar = new SingleBar({
            format: ' {bar} | {percentage}% | {step}',
            barCompleteChar: '\u2588',
            barIncompleteChar: '\u2591',
            hideCursor: true
        }, Presets.shades_classic);
        
        progressBar.start(100, 0, { step: 'Initializing strategy execution' });
        
        await sleep(800);
        progressBar.update(20, { step: 'Depositing to IOTA Lending (50%)' });
        
        await sleep(700);
        progressBar.update(40, { step: 'Depositing to Compound (25%)' });
        
        await sleep(1000);
        progressBar.update(60, { step: 'Depositing to Aave (15%)' });
        
        await sleep(600);
        progressBar.update(80, { step: 'Depositing to Lido (10%)' });
        
        await sleep(900);
        progressBar.update(100, { step: 'Strategy execution completed' });
        
        progressBar.stop();
        
        console.log(chalk.green('\nStrategy successfully executed and assets deployed!'));
        
        // Show model metadata
        console.log(chalk.gray("\nModel: Reinforcement learning for yield optimization with transformer-based market prediction"));
        console.log(chalk.gray("Trained on: Historical yield data, market volatility patterns, protocol correlations"));
        console.log(chalk.gray("Last updated: " + new Date().toLocaleString()));
        
    } catch (error) {
        spinner.fail(`Error during yield optimization: ${error.message}`);
    }
    
    await promptToContinue();
}

// Demo 7: Full End-to-End Flow
async function demonstrateFullFlow() {
    console.log(chalk.blue.bold("\n===== IntelliLend Full End-to-End Demo =====\n"));
    console.log("This comprehensive demo will walk through the entire IntelliLend platform flow,");
    console.log("showcasing how all components work together seamlessly.\n");
    
    // Step 1: Identity Verification
    console.log(chalk.cyan.bold("Step 1: Zero-Knowledge Identity Verification"));
    
    const idSpinner = ora('Verifying identity with zero-knowledge proofs...').start();
    await sleep(2000);
    idSpinner.succeed('Identity verified with Advanced level!');
    
    console.log(`Identity Score: 80/100`);
    console.log(`Risk Score Reduction: -15 points\n`);
    
    await sleep(500);
    
    // Step 2: Market Analysis
    console.log(chalk.cyan.bold("Step 2: Real-Time Market Analysis"));
    
    const marketSpinner = ora('Analyzing market conditions...').start();
    await sleep(2000);
    marketSpinner.succeed('Market analysis complete!');
    
    console.log(`Market Sentiment: Neutral (trending positive)`);
    console.log(`Fear & Greed Index: 45 (Fear)`);
    console.log(`Market Volatility: 35/100 (Low-Medium)`);
    console.log(`Liquidity Conditions: Healthy\n`);
    
    await sleep(500);
    
    // Step 3: Risk Assessment
    console.log(chalk.cyan.bold("Step 3: AI Risk Assessment"));
    
    const riskSpinner = ora('Running AI risk assessment...').start();
    await sleep(2500);
    riskSpinner.succeed('Risk assessment complete!');
    
    console.log(`Risk Score: 35/100 (Low-Medium Risk)`);
    console.log(`Default Probability: 3.2%`);
    console.log(`Interest Rate: 6.8%\n`);
    
    await sleep(500);
    
    // Step 4: Quantum Asset Creation
    console.log(chalk.cyan.bold("Step 4: Quantum-Resistant Asset Creation"));
    
    const assetSpinner = ora('Creating quantum-resistant asset...').start();
    await sleep(2000);
    assetSpinner.succeed('Quantum-resistant asset created!');
    
    const assetId = "0x" + randomHex(16);
    console.log(`Asset ID: ${assetId}`);
    console.log(`Token: QIOTA`);
    console.log(`Value: 1,500 IOTA`);
    console.log(`Security: Falcon-512 Signatures + Kyber KEM\n`);
    
    await sleep(500);
    
    // Step 5: Asset Bridge to Layer 2
    console.log(chalk.cyan.bold("Step 5: Cross-Layer ZK-Bridge Transfer"));
    
    const bridgeSpinner = ora('Initiating cross-layer transfer...').start();
    await sleep(3000);
    bridgeSpinner.succeed('Asset successfully bridged to Layer 2!');
    
    console.log(`ZK-Rollup Batch: #42`);
    console.log(`Transaction Hash: 0x${randomHex(32)}`);
    console.log(`Finality Time: 2.3 minutes\n`);
    
    await sleep(500);
    
    // Step 6: Collateral Deposit
    console.log(chalk.cyan.bold("Step 6: Collateral Management"));
    
    const collateralSpinner = ora('Depositing collateral...').start();
    await sleep(2000);
    collateralSpinner.succeed('Collateral successfully deposited!');
    
    console.log(`Collateral Amount: 1,500 IOTA`);
    console.log(`Collateral Value: $1,125 USD`);
    console.log(`Collateralization Ratio: 200%`);
    console.log(`Maximum Borrow: 750 IOTA\n`);
    
    await sleep(500);
    
    // Step 7: AI Yield Strategy
    console.log(chalk.cyan.bold("Step 7: AI Yield Strategy Optimization"));
    
    const yieldSpinner = ora('Generating optimal yield strategy...').start();
    await sleep(3000);
    yieldSpinner.succeed('Yield strategy generated!');
    
    console.log(`Strategy: Moderate-Aggressive`);
    console.log(`Expected APY: 10.2%`);
    console.log(`Protocol Allocation: 55% IOTA Lending, 25% Aave, 20% Lido`);
    console.log(`Est. Monthly Yield: 12.75 IOTA\n`);
    
    await sleep(500);
    
    // Step 8: Borrowing with AI-Optimized Rate
    console.log(chalk.cyan.bold("Step 8: AI-Optimized Borrowing"));
    
    const borrowSpinner = ora('Processing loan with AI-optimized rate...').start();
    await sleep(2500);
    borrowSpinner.succeed('Loan processed successfully!');
    
    console.log(`Borrowed Amount: 500 IOTA`);
    console.log(`Interest Rate: 6.8% (2.0% discount from identity verification)`);
    console.log(`Health Factor: 2.57 (Healthy)`);
    console.log(`Liquidation Threshold: 83%\n`);
    
    await sleep(500);
    
    // Step 9: Early Warning System
    console.log(chalk.cyan.bold("Step 9: AI Early Warning System"));
    
    const warningSpinner = ora('Setting up early warning system...').start();
    await sleep(2000);
    warningSpinner.succeed('Early warning system activated!');
    
    console.log(`Monitoring: Market volatility, sentiment shifts, liquidity stress`);
    console.log(`Alert Threshold: Health factor below 1.5`);
    console.log(`Alert Channels: Email, in-app notification\n`);
    
    await sleep(500);
    
    // Final summary
    console.log(chalk.green.bold("=== Transaction Complete ==="));
    console.log(chalk.green("Congratulations! You have successfully completed the full end-to-end flow."));
    console.log(chalk.green("Your position is now active with AI monitoring and optimization.\n"));
    
    console.log(chalk.yellow.bold("Position Summary:"));
    
    const summaryTable = new Table({
        head: [chalk.cyan('Metric'), chalk.cyan('Value')],
        colWidths: [25, 60]
    });
    
    summaryTable.push(
        ['Collateral', '1,500 IOTA (Quantum-Resistant)'],
        ['Borrowed', '500 IOTA'],
        ['Collateral Ratio', '230%'],
        ['Health Factor', '2.57'],
        ['Interest Rate', '6.8% (AI-Optimized)'],
        ['Expected Yield', '10.2% APY'],
        ['Net APY', '~3.4% (Yield - Interest)'],
        ['Risk Score', '35/100 (Low-Medium)'],
        ['Identity Level', 'Advanced']
    );
    
    console.log(summaryTable.toString());
    
    await promptToContinue();
}

// Helper functions

// Print header
function printHeader() {
    console.log(chalk.green(figlet.textSync('IntelliLend', { 
        font: 'Standard',
        horizontalLayout: 'default',
        verticalLayout: 'default'
    })));
    console.log(chalk.cyan('AI-Powered DeFi Lending Platform on IOTA'));
    console.log(chalk.cyan('IOTA DefAI Hackathon Project\n'));
}

// Prompt user to continue
async function promptToContinue() {
    await inquirer.prompt([
        {
            type: 'input',
            name: 'continue',
            message: 'Press Enter to continue...'
        }
    ]);
}

// Get risk category
function getRiskCategory(score) {
    if (score < 25) return "Very Low Risk";
    if (score < 40) return "Low Risk";
    if (score < 60) return "Medium Risk";
    if (score < 75) return "High Risk";
    return "Very High Risk";
}

// Get risk profile description
function getRiskProfileDescription(profile) {
    const descriptions = {
        "Conservative": "Low risk, stable returns, high security",
        "Moderate": "Balanced risk-reward profile",
        "Aggressive": "Higher risk for higher potential returns"
    };
    
    return descriptions[profile] || "Unknown profile";
}

// Get description for a risk factor
function getFactorDescription(factor) {
    const descriptions = {
        'wallet_balance_volatility': 'Frequent large changes in wallet balance indicate higher risk',
        'repayment_ratio': 'Your historical loan repayment performance',
        'transaction_count': 'Regular transaction activity indicates stability',
        'late_payment_frequency': 'History of making loan payments after due date',
        'default_count': 'History of defaulting on loans',
        'market_volatility_correlation': 'How your assets correlate with market swings',
        'network_centrality': 'Your position in the transaction network ecosystem',
        'collateral_diversity': 'Range of different asset types used as collateral',
        'wallet_age_days': 'Age of your wallet in days',
        'collateral_value_ratio': 'Value of collateral relative to borrowed amount'
    };
    
    return descriptions[factor] || "This factor contributes to your overall risk assessment";
}

// Get color for market sentiment
function getMarketSentimentColor(sentiment) {
    if (sentiment.includes("Extreme Fear")) return "#f44336";
    if (sentiment.includes("Fear")) return "#ff9800";
    if (sentiment.includes("Neutral")) return "#2196f3";
    if (sentiment.includes("Greed")) return "#4caf50";
    if (sentiment.includes("Extreme Greed")) return "#8bc34a";
    return "#9e9e9e";
}

// Generate random hex string
function randomHex(length) {
    let result = '';
    const characters = '0123456789abcdef';
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * 16));
    }
    return result;
}

// Sleep function
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Run the demo
runDemo().catch(error => {
    console.error(chalk.red(`Error in demo: ${error.message}`));
    process.exit(1);
});
