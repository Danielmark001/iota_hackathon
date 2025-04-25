/**
 * AI Integration Module for IntelliLend
 * 
 * This module handles the integration between the IntelliLend platform's
 * smart contracts and the AI risk assessment models.
 */

const { ethers } = require('ethers');
const axios = require('axios');
const { spawn } = require('child_process');
const fs = require('fs/promises');
const path = require('path');

// Load contract ABIs
const LendingPoolABI = require('../../abis/LendingPool.json');
const ZKVerifierABI = require('../../abis/ZKVerifier.json');
const ZKCrossLayerBridgeABI = require('../../abis/ZKCrossLayerBridge.json');

// AI Model integration
class AIIntegration {
    /**
     * Initialize the AI integration module
     * @param {Object} config - Configuration options
     * @param {string} config.provider - Ethereum provider URL
     * @param {string} config.lendingPoolAddress - Address of the LendingPool contract
     * @param {string} config.zkVerifierAddress - Address of the ZKVerifier contract
     * @param {string} config.zkBridgeAddress - Address of the ZKCrossLayerBridge contract
     * @param {string} config.modelPath - Path to the AI models directory
     * @param {boolean} config.useLocalModel - Whether to use the local model or API
     * @param {string} config.apiUrl - URL of the AI risk assessment API (if not using local model)
     */
    constructor(config) {
        this.config = config;
        
        // Set up provider
        this.provider = new ethers.providers.JsonRpcProvider(config.provider);
        
        // Initialize contract interfaces
        this.lendingPool = new ethers.Contract(
            config.lendingPoolAddress,
            LendingPoolABI,
            this.provider
        );
        
        this.zkVerifier = new ethers.Contract(
            config.zkVerifierAddress,
            ZKVerifierABI,
            this.provider
        );
        
        this.zkBridge = new ethers.Contract(
            config.zkBridgeAddress,
            ZKCrossLayerBridgeABI,
            this.provider
        );
        
        this.modelPath = config.modelPath;
        this.useLocalModel = config.useLocalModel;
        this.apiUrl = config.apiUrl;
        
        // Cache for user data
        this.userDataCache = new Map();
        this.lastRiskScores = new Map();
        
        console.log('AI Integration initialized');
    }
    
    /**
     * Set wallet for transaction signing
     * @param {string} privateKey - Private key for the signing wallet
     */
    setWallet(privateKey) {
        this.wallet = new ethers.Wallet(privateKey, this.provider);
        this.lendingPool = this.lendingPool.connect(this.wallet);
        this.zkVerifier = this.zkVerifier.connect(this.wallet);
        this.zkBridge = this.zkBridge.connect(this.wallet);
        
        console.log('Wallet connected');
    }
    
    /**
     * Assess risk for a user
     * @param {string} userAddress - Ethereum address of the user
     * @param {Object} options - Options for risk assessment
     * @param {boolean} options.updateOnChain - Whether to update the risk score on-chain
     * @param {boolean} options.generateZkProof - Whether to generate a ZK proof for privacy
     * @param {boolean} options.useCachedData - Whether to use cached on-chain data
     * @returns {Promise<Object>} Risk assessment results
     */
    async assessRisk(userAddress, options = {}) {
        const {
            updateOnChain = false,
            generateZkProof = false,
            useCachedData = false
        } = options;
        
        console.log(`Assessing risk for user: ${userAddress}`);
        
        try {
            // Fetch on-chain data for the user
            const userData = await this.fetchUserData(userAddress, useCachedData);
            
            // Generate risk score using AI model
            const riskAssessment = await this.generateRiskScore(userAddress, userData);
            
            console.log(`Risk assessment generated for ${userAddress}: ${riskAssessment.riskScore}`);
            
            // Update on-chain risk score if requested
            if (updateOnChain) {
                // Check if risk score has changed significantly
                const currentOnChainScore = await this.lendingPool.riskScores(userAddress);
                const onChainScoreChanged = Math.abs(
                    currentOnChainScore - riskAssessment.riskScore
                ) >= 5; // Only update if changed by at least 5 points
                
                if (onChainScoreChanged) {
                    if (generateZkProof) {
                        // Generate ZK proof for privacy-preserving update
                        await this.updateRiskScoreWithZkProof(userAddress, riskAssessment);
                    } else {
                        // Regular risk score update
                        await this.updateRiskScore(userAddress, riskAssessment.riskScore);
                    }
                } else {
                    console.log('Risk score unchanged, skipping on-chain update');
                }
            }
            
            // Cache the last risk score
            this.lastRiskScores.set(userAddress, riskAssessment.riskScore);
            
            return riskAssessment;
        } catch (error) {
            console.error('Error in risk assessment:', error);
            throw error;
        }
    }
    
    /**
     * Fetch on-chain data for a user
     * @param {string} userAddress - Ethereum address of the user
     * @param {boolean} useCache - Whether to use cached data
     * @returns {Promise<Object>} User data
     */
    async fetchUserData(userAddress, useCache = false) {
        if (useCache && this.userDataCache.has(userAddress)) {
            console.log(`Using cached data for ${userAddress}`);
            return this.userDataCache.get(userAddress);
        }
        
        console.log(`Fetching on-chain data for ${userAddress}`);
        
        try {
            // Fetch basic lending data
            const [deposits, borrows, collaterals, riskScore] = await Promise.all([
                this.lendingPool.deposits(userAddress),
                this.lendingPool.borrows(userAddress),
                this.lendingPool.collaterals(userAddress),
                this.lendingPool.riskScores(userAddress)
            ]);
            
            // Convert to numbers
            const userData = {
                address: userAddress,
                deposits: ethers.utils.formatEther(deposits),
                borrows: ethers.utils.formatEther(borrows),
                collaterals: ethers.utils.formatEther(collaterals),
                riskScore: riskScore.toNumber(),
                timestamp: Date.now()
            };
            
            // Fetch transaction history (would be implemented based on available indexing)
            const txHistory = await this.fetchTransactionHistory(userAddress);
            userData.transactionHistory = txHistory;
            
            // Calculate derived metrics
            userData.collateralRatio = userData.borrows > 0 
                ? (userData.collaterals / userData.borrows) 
                : Infinity;
                
            userData.utilizationRatio = userData.deposits > 0 
                ? (userData.borrows / userData.deposits)
                : 0;
                
            // Get verification status from ZK Verifier
            try {
                const [isVerified, timestamp] = await this.zkVerifier.isProofVerified(
                    ethers.utils.keccak256(ethers.utils.toUtf8Bytes("IDENTITY_VERIFICATION")),
                    userAddress
                );
                
                userData.identityVerified = isVerified;
                userData.identityVerificationTime = timestamp.toNumber();
            } catch (error) {
                console.warn(`Could not fetch verification status for ${userAddress}`);
                userData.identityVerified = false;
                userData.identityVerificationTime = 0;
            }
            
            // Cache the data
            this.userDataCache.set(userAddress, userData);
            
            return userData;
        } catch (error) {
            console.error(`Error fetching data for ${userAddress}:`, error);
            throw error;
        }
    }
    
    /**
     * Fetch transaction history for a user
     * @param {string} userAddress - Ethereum address of the user
     * @returns {Promise<Array>} Transaction history
     */
    async fetchTransactionHistory(userAddress) {
        console.log(`Fetching transaction history for ${userAddress}`);
        
        try {
            // This would be implemented using a blockchain indexer or provider API
            // For demo purposes, we'll return a simulated history
            const history = [];
            
            // Simulate some transaction history
            const types = ['deposit', 'borrow', 'repay', 'withdraw'];
            const count = 5 + Math.floor(Math.random() * 10);
            
            for (let i = 0; i < count; i++) {
                const type = types[Math.floor(Math.random() * types.length)];
                const amount = (10 + Math.random() * 100).toFixed(2);
                const timestamp = Date.now() - Math.floor(Math.random() * 30 * 86400 * 1000); // Up to 30 days ago
                
                history.push({
                    type,
                    amount,
                    timestamp
                });
            }
            
            // Sort by timestamp, newest first
            history.sort((a, b) => b.timestamp - a.timestamp);
            
            return history;
        } catch (error) {
            console.error(`Error fetching transaction history for ${userAddress}:`, error);
            return [];
        }
    }
    
    /**
     * Generate a risk score using AI model
     * @param {string} userAddress - Ethereum address of the user
     * @param {Object} userData - User data for risk assessment
     * @returns {Promise<Object>} Risk assessment results
     */
    async generateRiskScore(userAddress, userData) {
        console.log(`Generating risk score for ${userAddress}`);
        
        try {
            let riskAssessment;
            
            if (this.useLocalModel) {
                // Use local Python model
                riskAssessment = await this.runLocalRiskModel(userData);
            } else {
                // Use remote API
                riskAssessment = await this.callRiskAPI(userData);
            }
            
            // Add metadata
            riskAssessment.timestamp = Date.now();
            riskAssessment.modelVersion = '1.2.0';
            
            return riskAssessment;
        } catch (error) {
            console.error(`Error generating risk score for ${userAddress}:`, error);
            
            // Fallback to a simple heuristic model
            return this.fallbackRiskCalculation(userData);
        }
    }
    
    /**
     * Run the local Python risk model
     * @param {Object} userData - User data for risk assessment
     * @returns {Promise<Object>} Risk assessment results
     */
    async runLocalRiskModel(userData) {
        return new Promise((resolve, reject) => {
            // Save user data to temporary file for Python model
            const tempFile = path.join(this.modelPath, `temp_${Date.now()}.json`);
            
            fs.writeFile(tempFile, JSON.stringify(userData))
                .then(() => {
                    // Run Python model process
                    const pythonProcess = spawn('python', [
                        path.join(this.modelPath, 'risk_model.py'),
                        '--input', tempFile,
                        '--mode', 'predict'
                    ]);
                    
                    let outputData = '';
                    let errorData = '';
                    
                    pythonProcess.stdout.on('data', (data) => {
                        outputData += data.toString();
                    });
                    
                    pythonProcess.stderr.on('data', (data) => {
                        errorData += data.toString();
                    });
                    
                    pythonProcess.on('close', (code) => {
                        // Clean up temporary file
                        fs.unlink(tempFile).catch(err => console.warn('Error deleting temp file:', err));
                        
                        if (code !== 0) {
                            console.error(`Python model exited with code ${code}`);
                            console.error(`Error: ${errorData}`);
                            reject(new Error(`Model execution failed with code ${code}: ${errorData}`));
                            return;
                        }
                        
                        try {
                            // Parse output JSON
                            const result = JSON.parse(outputData);
                            resolve(result);
                        } catch (error) {
                            console.error('Error parsing model output:', error);
                            reject(error);
                        }
                    });
                })
                .catch(reject);
        });
    }
    
    /**
     * Call the remote risk assessment API
     * @param {Object} userData - User data for risk assessment
     * @returns {Promise<Object>} Risk assessment results
     */
    async callRiskAPI(userData) {
        console.log(`Calling risk API for ${userData.address}`);
        
        try {
            const response = await axios.post(
                `${this.apiUrl}/api/risk-assessment`,
                userData
            );
            
            return response.data;
        } catch (error) {
            console.error('Error calling risk API:', error);
            throw error;
        }
    }
    
    /**
     * Fallback risk calculation when AI model fails
     * @param {Object} userData - User data for risk assessment
     * @returns {Object} Basic risk assessment
     */
    fallbackRiskCalculation(userData) {
        console.log(`Using fallback risk calculation for ${userData.address}`);
        
        // Simple heuristic based on collateral ratio and utilization
        let riskScore = 50; // Start with medium risk
        
        // Adjust based on collateral ratio
        if (userData.collateralRatio === Infinity) {
            // No borrows, very low risk
            riskScore -= 20;
        } else if (userData.collateralRatio > 2) {
            // Well collateralized
            riskScore -= 15;
        } else if (userData.collateralRatio > 1.5) {
            // Adequately collateralized
            riskScore -= 5;
        } else if (userData.collateralRatio < 1.2) {
            // Thinly collateralized
            riskScore += 15;
        }
        
        // Adjust based on utilization
        if (userData.utilizationRatio > 0.8) {
            // High utilization
            riskScore += 10;
        } else if (userData.utilizationRatio < 0.3) {
            // Low utilization
            riskScore -= 5;
        }
        
        // Adjust for identity verification
        if (userData.identityVerified) {
            riskScore -= 10;
        }
        
        // Ensure score is within bounds
        riskScore = Math.max(0, Math.min(100, riskScore));
        
        return {
            riskScore,
            confidence: 0.6, // Lower confidence for fallback
            factors: [
                { feature: 'collateral_ratio', importance: 0.4 },
                { feature: 'utilization', importance: 0.3 },
                { feature: 'identity_verified', importance: 0.2 }
            ],
            recommendations: [
                {
                    title: 'Add more collateral',
                    description: 'Consider adding more collateral to reduce your risk score',
                    impact: 'high'
                },
                {
                    title: 'Verify your identity',
                    description: 'Complete identity verification to improve your borrowing terms',
                    impact: 'medium'
                }
            ],
            isUsingFallback: true
        };
    }
    
    /**
     * Update a user's risk score on-chain
     * @param {string} userAddress - Ethereum address of the user
     * @param {number} riskScore - New risk score
     * @returns {Promise<Object>} Transaction receipt
     */
    async updateRiskScore(userAddress, riskScore) {
        console.log(`Updating on-chain risk score for ${userAddress} to ${riskScore}`);
        
        try {
            const tx = await this.lendingPool.updateRiskScore(userAddress, riskScore);
            const receipt = await tx.wait();
            
            console.log(`Risk score updated for ${userAddress}, tx: ${receipt.transactionHash}`);
            return receipt;
        } catch (error) {
            console.error(`Error updating risk score for ${userAddress}:`, error);
            throw error;
        }
    }
    
    /**
     * Update a user's risk score using ZK proof for privacy
     * @param {string} userAddress - Ethereum address of the user
     * @param {Object} riskAssessment - Risk assessment results
     * @returns {Promise<Object>} Transaction receipt
     */
    async updateRiskScoreWithZkProof(userAddress, riskAssessment) {
        console.log(`Updating risk score with ZK proof for ${userAddress}`);
        
        try {
            // Generate ZK proof for private risk score update
            const { proof, publicInputs } = await this.generateZkProof(
                userAddress,
                riskAssessment
            );
            
            // Send the proof to the ZK Verifier contract
            const proofType = ethers.utils.keccak256(
                ethers.utils.toUtf8Bytes("RISK_SCORE_UPDATE")
            );
            
            const tx = await this.zkVerifier.verifyProof(
                proofType,
                proof,
                publicInputs,
                userAddress
            );
            
            const receipt = await tx.wait();
            
            console.log(`ZK proof submitted for ${userAddress}, tx: ${receipt.transactionHash}`);
            
            // For cross-layer communication, send via ZK bridge
            if (this.config.enableCrossLayer) {
                await this.sendCrossLayerRiskUpdate(userAddress, proof, publicInputs);
            }
            
            return receipt;
        } catch (error) {
            console.error(`Error updating risk score with ZK proof for ${userAddress}:`, error);
            throw error;
        }
    }
    
    /**
     * Generate a ZK proof for privacy-preserving risk score update
     * @param {string} userAddress - Ethereum address of the user
     * @param {Object} riskAssessment - Risk assessment results
     * @returns {Promise<Object>} ZK proof and public inputs
     */
    async generateZkProof(userAddress, riskAssessment) {
        console.log(`Generating ZK proof for ${userAddress}`);
        
        try {
            // In a real implementation, this would call a ZK proving service
            // For demonstration, we'll generate a simulated proof
            
            // Public inputs: user address (public), current timestamp (public)
            // Private inputs: risk score (private), factors (private)
            
            const publicInputs = ethers.utils.defaultAbiCoder.encode(
                ['address', 'uint256'],
                [userAddress, Math.floor(Date.now() / 1000)]
            );
            
            // Simulate a ZK proof
            const proof = ethers.utils.randomBytes(128);
            
            return { proof, publicInputs };
        } catch (error) {
            console.error(`Error generating ZK proof for ${userAddress}:`, error);
            throw error;
        }
    }
    
    /**
     * Send a cross-layer risk update via ZK bridge
     * @param {string} userAddress - Ethereum address of the user
     * @param {Uint8Array} proof - ZK proof
     * @param {string} publicInputs - Public inputs for the proof
     * @returns {Promise<Object>} Transaction receipt
     */
    async sendCrossLayerRiskUpdate(userAddress, proof, publicInputs) {
        console.log(`Sending cross-layer risk update for ${userAddress}`);
        
        try {
            // Convert user address to bytes32 for Move layer
            const targetAddress = ethers.utils.hexZeroPad(userAddress, 32);
            
            // Create a private payload with the risk data
            // In a real implementation, this would be encrypted
            const payload = ethers.utils.defaultAbiCoder.encode(
                ['uint256', 'uint256'],
                [
                    this.lastRiskScores.get(userAddress),
                    Math.floor(Date.now() / 1000)
                ]
            );
            
            // Gas limit for message execution on L1
            const gasLimit = 3000000;
            
            // Get required fee
            const requiredFee = await this.zkBridge.callStatic.getMessageFee(
                targetAddress,
                'PRIVATE_RISK_SCORE',
                payload,
                proof,
                publicInputs,
                gasLimit
            );
            
            // Send the message with the required fee
            const tx = await this.zkBridge.sendPrivateMessageToL1(
                targetAddress,
                'PRIVATE_RISK_SCORE',
                payload,
                proof,
                publicInputs,
                gasLimit,
                { value: requiredFee }
            );
            
            const receipt = await tx.wait();
            
            console.log(`Cross-layer message sent for ${userAddress}, tx: ${receipt.transactionHash}`);
            return receipt;
        } catch (error) {
            console.error(`Error sending cross-layer message for ${userAddress}:`, error);
            throw error;
        }
    }
    
    /**
     * Listen for risk score update events
     * @param {Function} callback - Callback function when a risk score is updated
     * @returns {Object} Event listener
     */
    listenForRiskScoreUpdates(callback) {
        console.log('Setting up event listener for risk score updates');
        
        // Listen for RiskScoreUpdated events from the lending pool
        const filter = this.lendingPool.filters.RiskScoreUpdated();
        
        const listener = (user, newScore, event) => {
            console.log(`Risk score updated for ${user}: ${newScore}`);
            
            // Clear cache for this user
            this.userDataCache.delete(user);
            
            // Call callback with event data
            callback({
                user,
                newScore: newScore.toNumber(),
                oldScore: this.lastRiskScores.get(user),
                transactionHash: event.transactionHash,
                blockNumber: event.blockNumber,
                timestamp: Date.now()
            });
            
            // Update last score
            this.lastRiskScores.set(user, newScore.toNumber());
        };
        
        this.lendingPool.on(filter, listener);
        
        return {
            remove: () => {
                this.lendingPool.off(filter, listener);
            }
        };
    }
    
    /**
     * Get risk assessment recommendations for a user
     * @param {string} userAddress - Ethereum address of the user
     * @returns {Promise<Array>} Personalized recommendations
     */
    async getRecommendations(userAddress) {
        console.log(`Getting recommendations for ${userAddress}`);
        
        try {
            // Get user data
            const userData = await this.fetchUserData(userAddress, true);
            
            // Get risk assessment
            const riskAssessment = await this.generateRiskScore(userAddress, userData);
            
            return riskAssessment.recommendations || [];
        } catch (error) {
            console.error(`Error getting recommendations for ${userAddress}:`, error);
            return [];
        }
    }
    
    /**
     * Clear cached data for a user
     * @param {string} userAddress - Ethereum address of the user (or null for all users)
     */
    clearCache(userAddress = null) {
        if (userAddress) {
            console.log(`Clearing cache for ${userAddress}`);
            this.userDataCache.delete(userAddress);
        } else {
            console.log('Clearing all cached data');
            this.userDataCache.clear();
        }
    }
}

module.exports = AIIntegration;
