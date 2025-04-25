/**
 * Cross-Chain Orchestrator for IntelliLend
 * 
 * This module orchestrates communication between IOTA EVM (Layer 2) and IOTA Move (Layer 1)
 * to ensure consistent state across both layers.
 */

const { ethers } = require('ethers');
const axios = require('axios');
const { EventEmitter } = require('events');
const crypto = require('crypto');

// Load contract ABIs
const CrossLayerBridgeABI = require('../../abis/CrossLayerBridge.json');
const ZKCrossLayerBridgeABI = require('../../abis/ZKCrossLayerBridge.json');
const LendingPoolABI = require('../../abis/LendingPool.json');

class CrossChainOrchestrator extends EventEmitter {
    /**
     * Initialize the cross-chain orchestrator
     * @param {Object} config - Configuration options
     */
    constructor(config) {
        super();
        this.config = config;
        
        // Initialize EVM provider
        this.evmProvider = new ethers.providers.JsonRpcProvider(config.evmRpcUrl);
        
        // Initialize contract interfaces
        this.bridge = new ethers.Contract(
            config.bridgeAddress,
            CrossLayerBridgeABI,
            this.evmProvider
        );
        
        this.zkBridge = new ethers.Contract(
            config.zkBridgeAddress,
            ZKCrossLayerBridgeABI,
            this.evmProvider
        );
        
        this.lendingPool = new ethers.Contract(
            config.lendingPoolAddress,
            LendingPoolABI,
            this.evmProvider
        );
        
        // IOTA Move API client
        this.moveApiUrl = config.moveApiUrl;
        
        // Message tracking
        this.pendingMessages = new Map();
        this.processedMessages = new Set();
        
        // Relay workers
        this.relayWorkers = new Map();
        
        console.log('Cross-Chain Orchestrator initialized');
    }
    
    /**
     * Set wallet for transaction signing
     * @param {string} privateKey - Private key for the signing wallet
     */
    setWallet(privateKey) {
        this.wallet = new ethers.Wallet(privateKey, this.evmProvider);
        this.bridge = this.bridge.connect(this.wallet);
        this.zkBridge = this.zkBridge.connect(this.wallet);
        this.lendingPool = this.lendingPool.connect(this.wallet);
        
        console.log('Wallet connected for cross-chain operations');
    }
    
    /**
     * Start the orchestrator
     */
    async start() {
        console.log('Starting Cross-Chain Orchestrator');
        
        try {
            // Subscribe to events from both layers
            this.subscribeToL2Events();
            await this.subscribeToL1Events();
            
            // Start monitoring pending messages
            this.startMessageMonitoring();
            
            // Check for any missed messages during downtime
            await this.checkMissedMessages();
            
            console.log('Cross-Chain Orchestrator started successfully');
            this.emit('started');
        } catch (error) {
            console.error('Failed to start Cross-Chain Orchestrator:', error);
            this.emit('error', error);
            throw error;
        }
    }
    
    /**
     * Stop the orchestrator
     */
    async stop() {
        console.log('Stopping Cross-Chain Orchestrator');
        
        // Clear all intervals
        for (const [messageId, worker] of this.relayWorkers.entries()) {
            clearInterval(worker.interval);
            console.log(`Stopped relay worker for message ${messageId}`);
        }
        
        // Unsubscribe from events
        this.unsubscribeFromL2Events();
        
        console.log('Cross-Chain Orchestrator stopped');
        this.emit('stopped');
    }
    
    /**
     * Subscribe to Layer 2 (EVM) events
     */
    subscribeToL2Events() {
        console.log('Subscribing to Layer 2 events');
        
        // Regular bridge events
        this.bridge.on('MessageSent', this.handleL2MessageSent.bind(this));
        this.bridge.on('MessageProcessed', this.handleL2MessageProcessed.bind(this));
        
        // ZK bridge events
        this.zkBridge.on('ZKMessageSent', this.handleL2ZKMessageSent.bind(this));
        this.zkBridge.on('ZKMessageProcessed', this.handleL2ZKMessageProcessed.bind(this));
        this.zkBridge.on('ZKProofVerified', this.handleL2ZKProofVerified.bind(this));
        
        // LendingPool events relevant for cross-chain
        this.lendingPool.on('RiskScoreUpdated', this.handleRiskScoreUpdated.bind(this));
        this.lendingPool.on('CollateralAdded', this.handleCollateralChanged.bind(this));
        this.lendingPool.on('CollateralRemoved', this.handleCollateralChanged.bind(this));
        this.lendingPool.on('Liquidation', this.handleLiquidationEvent.bind(this));
        
        console.log('Subscribed to Layer 2 events');
    }
    
    /**
     * Unsubscribe from Layer 2 (EVM) events
     */
    unsubscribeFromL2Events() {
        console.log('Unsubscribing from Layer 2 events');
        
        this.bridge.removeAllListeners();
        this.zkBridge.removeAllListeners();
        this.lendingPool.removeAllListeners();
        
        console.log('Unsubscribed from Layer 2 events');
    }
    
    /**
     * Subscribe to Layer 1 (Move) events
     */
    async subscribeToL1Events() {
        console.log('Subscribing to Layer 1 events');
        
        try {
            // Set up websocket connection to Move API for events
            // This is a placeholder - the actual implementation would depend on IOTA Move API
            const response = await axios.post(`${this.moveApiUrl}/subscribe`, {
                eventTypes: [
                    'EnhancedMessageReceived',
                    'ZeroKnowledgeProofVerified',
                    'CollateralStatusChanged',
                    'RiskScoreUpdated',
                    'Liquidation'
                ],
                callbackUrl: this.config.callbackUrl
            });
            
            console.log('Subscribed to Layer 1 events:', response.data);
        } catch (error) {
            console.error('Failed to subscribe to Layer 1 events:', error);
            throw error;
        }
    }
    
    /**
     * Check for missed messages during downtime
     */
    async checkMissedMessages() {
        console.log('Checking for missed messages during downtime');
        
        try {
            // Check Layer 2 pending messages
            const filter = this.bridge.filters.MessageSent();
            const events = await this.bridge.queryFilter(
                filter, 
                this.config.checkFromBlock || -10000, 
                'latest'
            );
            
            console.log(`Found ${events.length} potentially missed L2->L1 messages`);
            
            // Check status of each message
            for (const event of events) {
                const messageId = event.args.messageId;
                
                // Skip if already processed or being tracked
                if (this.processedMessages.has(messageId) || this.pendingMessages.has(messageId)) {
                    continue;
                }
                
                // Get message details
                try {
                    const message = await this.bridge.messages(messageId);
                    
                    // Only handle pending messages
                    if (message.status === 0) { // 0 = Pending
                        console.log(`Found missed pending message: ${messageId}`);
                        
                        // Add to pending messages
                        this.pendingMessages.set(messageId, {
                            id: messageId,
                            sender: message.sender,
                            targetAddress: message.targetAddress,
                            messageType: message.messageType,
                            timestamp: message.timestamp.toNumber(),
                            status: 'pending',
                            retryCount: 0,
                            lastChecked: Date.now()
                        });
                        
                        // Start relay worker for this message
                        this.startRelayWorker(messageId);
                    }
                } catch (error) {
                    console.error(`Error checking message ${messageId}:`, error);
                }
            }
            
            // Similarly, check for ZK bridge messages (simplified for brevity)
            
            // Check Layer 1 pending messages (would need IOTA Move API)
            await this.checkL1PendingMessages();
            
            console.log('Completed check for missed messages');
        } catch (error) {
            console.error('Error checking missed messages:', error);
            throw error;
        }
    }
    
    /**
     * Check Layer 1 pending messages
     */
    async checkL1PendingMessages() {
        console.log('Checking Layer 1 pending messages');
        
        try {
            // Call Move API to get pending messages
            const response = await axios.get(`${this.moveApiUrl}/pending-messages`);
            const pendingL1Messages = response.data.messages || [];
            
            console.log(`Found ${pendingL1Messages.length} pending L1->L2 messages`);
            
            // Process each pending message
            for (const message of pendingL1Messages) {
                // Check if already processed or being tracked
                if (this.processedMessages.has(message.id) || this.pendingMessages.has(message.id)) {
                    continue;
                }
                
                console.log(`Processing missed L1->L2 message: ${message.id}`);
                
                // Relay the message to L2
                await this.relayL1ToL2Message(message);
            }
        } catch (error) {
            console.error('Error checking L1 pending messages:', error);
            throw error;
        }
    }
    
    /**
     * Start monitoring pending messages
     */
    startMessageMonitoring() {
        console.log('Starting message monitoring');
        
        // Check message status every minute
        this.monitoringInterval = setInterval(() => {
            this.checkPendingMessages();
        }, 60000);
    }
    
    /**
     * Check status of all pending messages
     */
    async checkPendingMessages() {
        console.log(`Checking ${this.pendingMessages.size} pending messages`);
        
        for (const [messageId, message] of this.pendingMessages.entries()) {
            // Skip recently checked messages
            if (Date.now() - message.lastChecked < 30000) { // 30 seconds
                continue;
            }
            
            // Update last checked timestamp
            message.lastChecked = Date.now();
            this.pendingMessages.set(messageId, message);
            
            // Check message status
            if (message.direction === 'L2toL1') {
                await this.checkL2ToL1MessageStatus(messageId);
            } else {
                await this.checkL1ToL2MessageStatus(messageId);
            }
        }
    }
    
    /**
     * Check status of L2->L1 message
     * @param {string} messageId - Message ID
     */
    async checkL2ToL1MessageStatus(messageId) {
        console.log(`Checking L2->L1 message status: ${messageId}`);
        
        try {
            // Get message from bridge
            const message = await this.bridge.messages(messageId);
            
            // Update status based on bridge response
            if (message.status !== 0) { // 0 = Pending
                // Message is no longer pending
                console.log(`Message ${messageId} is now ${['Pending', 'Processed', 'Failed', 'Canceled'][message.status]}`);
                
                // Add to processed messages and remove from pending
                this.processedMessages.add(messageId);
                this.pendingMessages.delete(messageId);
                
                // Stop relay worker
                this.stopRelayWorker(messageId);
                
                // Emit event
                this.emit('messageStatusChanged', {
                    messageId,
                    status: ['Pending', 'Processed', 'Failed', 'Canceled'][message.status],
                    timestamp: Date.now()
                });
            }
        } catch (error) {
            console.error(`Error checking message ${messageId}:`, error);
        }
    }
    
    /**
     * Check status of L1->L2 message
     * @param {string} messageId - Message ID
     */
    async checkL1ToL2MessageStatus(messageId) {
        console.log(`Checking L1->L2 message status: ${messageId}`);
        
        try {
            // Call Move API to check message status
            const response = await axios.get(`${this.moveApiUrl}/message/${messageId}`);
            
            if (response.data.status !== 'pending') {
                console.log(`Message ${messageId} is now ${response.data.status}`);
                
                // Add to processed messages and remove from pending
                this.processedMessages.add(messageId);
                this.pendingMessages.delete(messageId);
                
                // Stop relay worker
                this.stopRelayWorker(messageId);
                
                // Emit event
                this.emit('messageStatusChanged', {
                    messageId,
                    status: response.data.status,
                    timestamp: Date.now()
                });
            }
        } catch (error) {
            console.error(`Error checking L1->L2 message ${messageId}:`, error);
        }
    }
    
    /**
     * Start relay worker for a message
     * @param {string} messageId - Message ID
     */
    startRelayWorker(messageId) {
        console.log(`Starting relay worker for message ${messageId}`);
        
        // Check if worker already exists
        if (this.relayWorkers.has(messageId)) {
            console.log(`Relay worker for message ${messageId} already exists`);
            return;
        }
        
        // Create worker
        const worker = {
            messageId,
            startTime: Date.now(),
            retryCount: 0,
            interval: setInterval(async () => {
                await this.relayMessage(messageId);
            }, 30000) // Try to relay every 30 seconds
        };
        
        // Store worker
        this.relayWorkers.set(messageId, worker);
    }
    
    /**
     * Stop relay worker for a message
     * @param {string} messageId - Message ID
     */
    stopRelayWorker(messageId) {
        console.log(`Stopping relay worker for message ${messageId}`);
        
        // Check if worker exists
        if (!this.relayWorkers.has(messageId)) {
            return;
        }
        
        // Stop interval
        clearInterval(this.relayWorkers.get(messageId).interval);
        
        // Remove worker
        this.relayWorkers.delete(messageId);
    }
    
    /**
     * Relay a message
     * @param {string} messageId - Message ID
     */
    async relayMessage(messageId) {
        console.log(`Attempting to relay message ${messageId}`);
        
        // Get message
        const message = this.pendingMessages.get(messageId);
        if (!message) {
            console.log(`Message ${messageId} no longer pending, stopping relay`);
            this.stopRelayWorker(messageId);
            return;
        }
        
        // Increment retry count
        message.retryCount++;
        this.pendingMessages.set(messageId, message);
        
        // Update worker retry count
        const worker = this.relayWorkers.get(messageId);
        if (worker) {
            worker.retryCount = message.retryCount;
            this.relayWorkers.set(messageId, worker);
        }
        
        try {
            // Relay based on direction
            if (message.direction === 'L2toL1') {
                await this.relayL2ToL1Message(messageId);
            } else {
                await this.relayL1ToL2Message(message);
            }
        } catch (error) {
            console.error(`Error relaying message ${messageId}:`, error);
            
            // Check if max retries reached
            if (message.retryCount >= this.config.maxRetries) {
                console.log(`Max retries reached for message ${messageId}, marking as failed`);
                
                // Mark as failed
                await this.markMessageAsFailed(messageId, 'Max retries reached');
                
                // Stop relay worker
                this.stopRelayWorker(messageId);
            }
        }
    }
    
    /**
     * Relay L2->L1 message
     * @param {string} messageId - Message ID
     */
    async relayL2ToL1Message(messageId) {
        console.log(`Relaying L2->L1 message: ${messageId}`);
        
        try {
            // Get message details from bridge
            const message = await this.bridge.messages(messageId);
            
            // Skip if already processed
            if (message.status !== 0) { // 0 = Pending
                console.log(`Message ${messageId} is already ${['Pending', 'Processed', 'Failed', 'Canceled'][message.status]}`);
                return;
            }
            
            // Relay to Move API
            const payload = {
                messageId,
                sender: message.sender,
                targetAddress: message.targetAddress,
                payload: message.payload,
                messageType: message.messageType,
                timestamp: message.timestamp.toNumber(),
                signature: await this.signMessage(messageId)
            };
            
            const response = await axios.post(`${this.moveApiUrl}/relay-message`, payload);
            
            console.log(`Relayed L2->L1 message ${messageId}, response:`, response.data);
            
            // If successful, mark as processing
            if (response.data.success) {
                console.log(`Message ${messageId} successfully relayed to L1`);
                
                // Update message status to processing
                const pendingMessage = this.pendingMessages.get(messageId);
                if (pendingMessage) {
                    pendingMessage.status = 'processing';
                    pendingMessage.lastRelayed = Date.now();
                    this.pendingMessages.set(messageId, pendingMessage);
                }
            }
        } catch (error) {
            console.error(`Error relaying L2->L1 message ${messageId}:`, error);
            throw error;
        }
    }
    
    /**
     * Relay L1->L2 message
     * @param {Object} message - Message object from L1
     */
    async relayL1ToL2Message(message) {
        console.log(`Relaying L1->L2 message: ${message.id}`);
        
        try {
            // Generate signature
            const signature = await this.signMessage(message.id);
            
            // Determine which bridge to use
            if (message.hasZKProof) {
                // Use ZK bridge for messages with ZK proofs
                const tx = await this.zkBridge.processPrivateMessageFromL1(
                    message.sender,
                    message.messageType,
                    message.payload,
                    message.zkProof,
                    message.publicInputs,
                    message.timestamp,
                    signature
                );
                
                await tx.wait();
            } else {
                // Use regular bridge for standard messages
                const tx = await this.bridge.processMessageFromL1(
                    message.sender,
                    message.messageType,
                    message.payload,
                    message.timestamp,
                    signature
                );
                
                await tx.wait();
            }
            
            console.log(`Successfully relayed L1->L2 message ${message.id}`);
            
            // Update message status
            const pendingMessage = this.pendingMessages.get(message.id);
            if (pendingMessage) {
                pendingMessage.status = 'processing';
                pendingMessage.lastRelayed = Date.now();
                this.pendingMessages.set(message.id, pendingMessage);
            }
            
            // Notify Move API of successful relay
            await axios.post(`${this.moveApiUrl}/confirm-relay`, {
                messageId: message.id,
                status: 'processing',
                transactionHash: tx.hash
            });
        } catch (error) {
            console.error(`Error relaying L1->L2 message ${message.id}:`, error);
            throw error;
        }
    }
    
    /**
     * Sign a message with the orchestrator's private key
     * @param {string} messageId - Message ID
     * @returns {Promise<string>} Signature
     */
    async signMessage(messageId) {
        // Ensure wallet is set
        if (!this.wallet) {
            throw new Error('Wallet not set');
        }
        
        // Create message hash
        const messageHash = ethers.utils.keccak256(
            ethers.utils.toUtf8Bytes(`IOTA_BRIDGE_RELAY_${messageId}`)
        );
        
        // Sign hash
        const signature = await this.wallet.signMessage(
            ethers.utils.arrayify(messageHash)
        );
        
        return signature;
    }
    
    /**
     * Mark a message as failed
     * @param {string} messageId - Message ID
     * @param {string} reason - Failure reason
     */
    async markMessageAsFailed(messageId, reason) {
        console.log(`Marking message ${messageId} as failed: ${reason}`);
        
        try {
            const message = this.pendingMessages.get(messageId);
            if (!message) {
                console.log(`Message ${messageId} not found in pending messages`);
                return;
            }
            
            if (message.direction === 'L2toL1') {
                // Call bridge to fail message
                const tx = await this.bridge.failTransfer(messageId, reason);
                await tx.wait();
            } else {
                // Notify Move API of failure
                await axios.post(`${this.moveApiUrl}/fail-message`, {
                    messageId,
                    reason
                });
            }
            
            // Update local state
            this.pendingMessages.delete(messageId);
            this.processedMessages.add(messageId);
            
            // Emit event
            this.emit('messageFailed', {
                messageId,
                reason,
                timestamp: Date.now()
            });
        } catch (error) {
            console.error(`Error marking message ${messageId} as failed:`, error);
            throw error;
        }
    }
    
    /**
     * Handle MessageSent event from Layer 2
     */
    handleL2MessageSent(messageId, sender, targetAddress, messageType, payload, timestamp, direction) {
        console.log(`L2 MessageSent: ${messageId} (${messageType})`);
        
        // Skip if already processed or being tracked
        if (this.processedMessages.has(messageId) || this.pendingMessages.has(messageId)) {
            return;
        }
        
        // Add to pending messages
        this.pendingMessages.set(messageId, {
            id: messageId,
            sender,
            targetAddress,
            messageType,
            timestamp: timestamp.toNumber(),
            payload,
            direction: 'L2toL1',
            status: 'pending',
            retryCount: 0,
            lastChecked: Date.now()
        });
        
        // Start relay worker
        this.startRelayWorker(messageId);
        
        // Emit event
        this.emit('newMessage', {
            messageId,
            sender,
            targetAddress,
            messageType,
            timestamp: timestamp.toNumber(),
            direction: 'L2toL1'
        });
    }
    
    /**
     * Handle MessageProcessed event from Layer 2
     */
    handleL2MessageProcessed(messageId, processor, timestamp, success) {
        console.log(`L2 MessageProcessed: ${messageId} (success: ${success})`);
        
        // Update message status
        if (this.pendingMessages.has(messageId)) {
            // Remove from pending and add to processed
            this.pendingMessages.delete(messageId);
            this.processedMessages.add(messageId);
            
            // Stop relay worker
            this.stopRelayWorker(messageId);
        }
        
        // Emit event
        this.emit('messageProcessed', {
            messageId,
            processor,
            timestamp: timestamp.toNumber(),
            success
        });
    }
    
    /**
     * Handle ZKMessageSent event from Layer 2
     */
    handleL2ZKMessageSent(messageId, sender, targetAddress, messageType, commitmentHash, timestamp, direction) {
        console.log(`L2 ZKMessageSent: ${messageId} (${messageType})`);
        
        // Similar to handleL2MessageSent but for ZK messages
        // Skip if already processed or being tracked
        if (this.processedMessages.has(messageId) || this.pendingMessages.has(messageId)) {
            return;
        }
        
        // Add to pending messages
        this.pendingMessages.set(messageId, {
            id: messageId,
            sender,
            targetAddress,
            messageType,
            timestamp: timestamp.toNumber(),
            commitmentHash,
            direction: 'L2toL1',
            isZK: true,
            status: 'pending',
            retryCount: 0,
            lastChecked: Date.now()
        });
        
        // Start relay worker
        this.startRelayWorker(messageId);
        
        // Emit event
        this.emit('newZKMessage', {
            messageId,
            sender,
            targetAddress,
            messageType,
            timestamp: timestamp.toNumber(),
            direction: 'L2toL1'
        });
    }
    
    /**
     * Handle ZKMessageProcessed event from Layer 2
     */
    handleL2ZKMessageProcessed(messageId, processor, timestamp, success, zkVerified) {
        console.log(`L2 ZKMessageProcessed: ${messageId} (success: ${success}, zkVerified: ${zkVerified})`);
        
        // Similar to handleL2MessageProcessed but for ZK messages
        if (this.pendingMessages.has(messageId)) {
            // Remove from pending and add to processed
            this.pendingMessages.delete(messageId);
            this.processedMessages.add(messageId);
            
            // Stop relay worker
            this.stopRelayWorker(messageId);
        }
        
        // Emit event
        this.emit('zkMessageProcessed', {
            messageId,
            processor,
            timestamp: timestamp.toNumber(),
            success,
            zkVerified
        });
    }
    
    /**
     * Handle ZKProofVerified event from Layer 2
     */
    handleL2ZKProofVerified(messageId, verifier, timestamp) {
        console.log(`L2 ZKProofVerified: ${messageId}`);
        
        // Update message status if in pending
        const message = this.pendingMessages.get(messageId);
        if (message) {
            message.zkVerified = true;
            message.lastChecked = Date.now();
            this.pendingMessages.set(messageId, message);
        }
        
        // Emit event
        this.emit('zkProofVerified', {
            messageId,
            verifier,
            timestamp: timestamp.toNumber()
        });
    }
    
    /**
     * Handle RiskScoreUpdated event from LendingPool
     */
    handleRiskScoreUpdated(user, newScore, event) {
        console.log(`RiskScoreUpdated: ${user} (${newScore})`);
        
        // Only relay if cross-layer sync is enabled
        if (!this.config.enableCrossLayerSync) {
            return;
        }
        
        // Create synthetic message ID
        const messageId = ethers.utils.keccak256(
            ethers.utils.defaultAbiCoder.encode(
                ['string', 'address', 'uint256', 'uint256'],
                ['RISK_SCORE', user, newScore, Date.now()]
            )
        );
        
        // Send cross-layer message
        this.sendCrossLayerRiskUpdate(messageId, user, newScore.toNumber());
    }
    
    /**
     * Handle CollateralAdded or CollateralRemoved events
     */
    handleCollateralChanged(user, amount, event) {
        const isAdded = event.event === 'CollateralAdded';
        console.log(`Collateral${isAdded ? 'Added' : 'Removed'}: ${user} (${ethers.utils.formatEther(amount)} IOTA)`);
        
        // Only relay if cross-layer sync is enabled
        if (!this.config.enableCrossLayerSync) {
            return;
        }
        
        // Create synthetic message ID
        const messageId = ethers.utils.keccak256(
            ethers.utils.defaultAbiCoder.encode(
                ['string', 'address', 'uint256', 'bool', 'uint256'],
                ['COLLATERAL_CHANGE', user, amount, isAdded, Date.now()]
            )
        );
        
        // Send cross-layer message
        this.sendCrossLayerCollateralUpdate(messageId, user, amount, isAdded);
    }
    
    /**
     * Handle Liquidation event
     */
    handleLiquidationEvent(liquidator, borrower, repayAmount, collateralAmount, event) {
        console.log(`Liquidation: ${borrower} by ${liquidator} (${ethers.utils.formatEther(repayAmount)} repaid, ${ethers.utils.formatEther(collateralAmount)} collateral)`);
        
        // Only relay if cross-layer sync is enabled
        if (!this.config.enableCrossLayerSync) {
            return;
        }
        
        // Create synthetic message ID
        const messageId = ethers.utils.keccak256(
            ethers.utils.defaultAbiCoder.encode(
                ['string', 'address', 'address', 'uint256', 'uint256', 'uint256'],
                ['LIQUIDATION', liquidator, borrower, repayAmount, collateralAmount, Date.now()]
            )
        );
        
        // Send cross-layer message
        this.sendCrossLayerLiquidationEvent(messageId, liquidator, borrower, repayAmount, collateralAmount);
    }
    
    /**
     * Send cross-layer risk score update
     * @param {string} messageId - Message ID
     * @param {string} user - User address
     * @param {number} score - Risk score
     */
    async sendCrossLayerRiskUpdate(messageId, user, score) {
        console.log(`Sending cross-layer risk update for ${user}: ${score}`);
        
        try {
            // Convert user address to bytes32 for Move layer
            const targetAddress = ethers.utils.hexZeroPad(user, 32);
            
            // Create payload
            const payload = ethers.utils.defaultAbiCoder.encode(
                ['address', 'uint256', 'uint256'],
                [user, score, Math.floor(Date.now() / 1000)]
            );
            
            // Gas limit for message execution on L1
            const gasLimit = 2000000;
            
            // Send the message
            const tx = await this.bridge.sendMessageToL1(
                targetAddress,
                'RISK_SCORE_UPDATE',
                payload,
                gasLimit
            );
            
            const receipt = await tx.wait();
            
            console.log(`Cross-layer risk update sent, tx: ${receipt.transactionHash}`);
            
            // Message tracking will be handled by the MessageSent event
        } catch (error) {
            console.error(`Error sending cross-layer risk update for ${user}:`, error);
            throw error;
        }
    }
    
    /**
     * Send cross-layer collateral update
     * @param {string} messageId - Message ID
     * @param {string} user - User address
     * @param {BigNumber} amount - Collateral amount
     * @param {boolean} isAdded - Whether collateral was added or removed
     */
    async sendCrossLayerCollateralUpdate(messageId, user, amount, isAdded) {
        console.log(`Sending cross-layer collateral update for ${user}: ${isAdded ? 'added' : 'removed'} ${ethers.utils.formatEther(amount)} IOTA`);
        
        try {
            // Convert user address to bytes32 for Move layer
            const targetAddress = ethers.utils.hexZeroPad(user, 32);
            
            // Create payload
            const payload = ethers.utils.defaultAbiCoder.encode(
                ['address', 'uint256', 'bool', 'uint256'],
                [user, amount, isAdded, Math.floor(Date.now() / 1000)]
            );
            
            // Gas limit for message execution on L1
            const gasLimit = 2000000;
            
            // Send the message
            const tx = await this.bridge.sendMessageToL1(
                targetAddress,
                'COLLATERAL_CHANGE',
                payload,
                gasLimit
            );
            
            const receipt = await tx.wait();
            
            console.log(`Cross-layer collateral update sent, tx: ${receipt.transactionHash}`);
            
            // Message tracking will be handled by the MessageSent event
        } catch (error) {
            console.error(`Error sending cross-layer collateral update for ${user}:`, error);
            throw error;
        }
    }
    
    /**
     * Send cross-layer liquidation event
     * @param {string} messageId - Message ID
     * @param {string} liquidator - Liquidator address
     * @param {string} borrower - Borrower address
     * @param {BigNumber} repayAmount - Repay amount
     * @param {BigNumber} collateralAmount - Collateral amount
     */
    async sendCrossLayerLiquidationEvent(messageId, liquidator, borrower, repayAmount, collateralAmount) {
        console.log(`Sending cross-layer liquidation event for ${borrower}`);
        
        try {
            // Convert borrower address to bytes32 for Move layer
            const targetAddress = ethers.utils.hexZeroPad(borrower, 32);
            
            // Create payload
            const payload = ethers.utils.defaultAbiCoder.encode(
                ['address', 'address', 'uint256', 'uint256', 'uint256'],
                [liquidator, borrower, repayAmount, collateralAmount, Math.floor(Date.now() / 1000)]
            );
            
            // Gas limit for message execution on L1
            const gasLimit = 2000000;
            
            // Send the message
            const tx = await this.bridge.sendMessageToL1(
                targetAddress,
                'LIQUIDATION',
                payload,
                gasLimit
            );
            
            const receipt = await tx.wait();
            
            console.log(`Cross-layer liquidation event sent, tx: ${receipt.transactionHash}`);
            
            // Message tracking will be handled by the MessageSent event
        } catch (error) {
            console.error(`Error sending cross-layer liquidation event for ${borrower}:`, error);
            throw error;
        }
    }
}

module.exports = CrossChainOrchestrator;
