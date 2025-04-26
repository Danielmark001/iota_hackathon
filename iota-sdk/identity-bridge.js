/**
 * IOTA Identity Bridge
 * 
 * This module provides a bridge between EVM smart contracts and IOTA Identity DID framework.
 * It enables verification of DIDs, credentials, and proofs using the IOTA Identity framework.
 */

const { createClient } = require('./client');
const { getOrCreateAccount } = require('./wallet');
const Identity = require('./identity');
const logger = require('./utils/logger');
const ethers = require('ethers');

class IOTAIdentityBridge {
    /**
     * Initialize the IOTA Identity Bridge
     * @param {Object} client - IOTA client instance
     * @param {Object} account - IOTA account for wallet operations (optional)
     * @param {Object} evmProvider - Ethereum provider for contract interaction
     */
    constructor(client, account = null, evmProvider = null) {
        this.client = client;
        this.account = account;
        this.provider = evmProvider;
        this.identity = new Identity(client, account);
        this.didCache = new Map();
        
        logger.info('IOTA Identity Bridge initialized');
    }
    
    /**
     * Deploy the Identity Bridge contract to the EVM network
     * @param {string} zkVerifierAddress - Address of the ZKVerifier contract
     * @param {Object} signer - Ethereum signer for contract deployment
     * @returns {Object} Deployed contract
     */
    async deployBridgeContract(zkVerifierAddress, signer) {
        logger.info('Deploying IOTA Identity Bridge contract...');
        
        try {
            // Load contract ABI and bytecode
            const abi = require('../abis/IOTAIdentityBridge.json').abi;
            const bytecode = require('../abis/IOTAIdentityBridge.json').bytecode;
            
            // Create contract factory
            const factory = new ethers.ContractFactory(abi, bytecode, signer);
            
            // Deploy contract
            const contract = await factory.deploy(zkVerifierAddress);
            await contract.deployed();
            
            logger.info(`IOTA Identity Bridge deployed at: ${contract.address}`);
            
            return contract;
        } catch (error) {
            logger.error(`Error deploying Identity Bridge contract: ${error.message}`);
            throw error;
        }
    }
    
    /**
     * Connect to an existing Identity Bridge contract
     * @param {string} bridgeAddress - Address of the Identity Bridge contract
     * @param {Object} signer - Ethereum signer for contract interaction
     * @returns {Object} Contract instance
     */
    async connectToBridge(bridgeAddress, signer) {
        logger.info(`Connecting to IOTA Identity Bridge at ${bridgeAddress}...`);
        
        try {
            // Load contract ABI
            const abi = require('../abis/IOTAIdentityBridge.json').abi;
            
            // Create contract instance
            const contract = new ethers.Contract(bridgeAddress, abi, signer);
            
            logger.info('Connected to IOTA Identity Bridge contract');
            
            return contract;
        } catch (error) {
            logger.error(`Error connecting to Identity Bridge contract: ${error.message}`);
            throw error;
        }
    }
    
    /**
     * Register a DID for a user
     * @param {string} userAddress - Ethereum address of the user
     * @param {string} did - The DID to register
     * @param {Object} contract - Identity Bridge contract instance
     * @returns {Object} Transaction receipt
     */
    async registerDID(userAddress, did, contract) {
        logger.info(`Registering DID ${did} for user ${userAddress}...`);
        
        try {
            // Generate proof of DID ownership using IOTA Identity
            const proof = await this.identity.generateDIDProof(did);
            
            // Convert DID to bytes32
            const didBytes = ethers.utils.id(did);
            
            // Register DID via contract
            const tx = await contract.registerDID(userAddress, didBytes, proof);
            const receipt = await tx.wait();
            
            logger.info(`DID registered successfully: ${receipt.transactionHash}`);
            
            // Cache the DID for future use
            this.didCache.set(userAddress, did);
            
            return receipt;
        } catch (error) {
            logger.error(`Error registering DID: ${error.message}`);
            throw error;
        }
    }
    
    /**
     * Verify a DID
     * @param {string} did - The DID to verify
     * @param {Object} proof - Proof of DID ownership
     * @returns {boolean} Verification result
     */
    async verifyDID(did, proof) {
        logger.info(`Verifying DID: ${did}`);
        
        try {
            // Use IOTA Identity to verify the DID and proof
            const result = await this.identity.verifyDID(did, proof);
            
            logger.info(`DID verification result: ${result}`);
            
            return result;
        } catch (error) {
            logger.error(`Error verifying DID: ${error.message}`);
            return false;
        }
    }
    
    /**
     * Get credential for a user
     * @param {string} userAddress - Ethereum address of the user
     * @param {string} credentialType - Type of credential to get
     * @returns {Object} The credential
     */
    async getCredential(userAddress, credentialType) {
        logger.info(`Getting ${credentialType} credential for user ${userAddress}...`);
        
        try {
            // Get user's DID
            let did = this.didCache.get(userAddress);
            
            if (!did) {
                // If not in cache, try to fetch from Tangle
                did = await this.identity.findDIDByAddress(userAddress);
                
                if (did) {
                    this.didCache.set(userAddress, did);
                } else {
                    throw new Error(`No DID found for user ${userAddress}`);
                }
            }
            
            // Get credential for the DID
            const credential = await this.identity.getCredential(did, credentialType);
            
            logger.info(`Credential retrieved successfully for ${did}`);
            
            return credential;
        } catch (error) {
            logger.error(`Error getting credential: ${error.message}`);
            throw error;
        }
    }
    
    /**
     * Verify a credential
     * @param {Object} credential - The credential to verify
     * @returns {boolean} Verification result
     */
    async verifyCredential(credential) {
        logger.info(`Verifying credential: ${credential.id}`);
        
        try {
            // Use IOTA Identity to verify the credential
            const result = await this.identity.verifyCredential(credential);
            
            logger.info(`Credential verification result: ${result.verified}`);
            
            return result.verified;
        } catch (error) {
            logger.error(`Error verifying credential: ${error.message}`);
            return false;
        }
    }
    
    /**
     * Resolve a credential from the Tangle
     * @param {string} credentialId - ID of the credential to resolve
     * @returns {Object} The resolved credential
     */
    async resolveCredential(credentialId) {
        logger.info(`Resolving credential: ${credentialId}`);
        
        try {
            // Use IOTA Identity to resolve the credential
            const credential = await this.identity.resolveCredential(credentialId);
            
            logger.info(`Credential resolved successfully: ${credentialId}`);
            
            return credential;
        } catch (error) {
            logger.error(`Error resolving credential: ${error.message}`);
            throw error;
        }
    }
    
    /**
     * Generate a zero-knowledge proof from a credential
     * @param {Object} credential - The credential to use
     * @param {Array} revealedAttributes - Attributes to reveal
     * @returns {Object} The zero-knowledge proof
     */
    async generateZKProof(credential, revealedAttributes) {
        logger.info(`Generating ZK proof for credential: ${credential.id}`);
        
        try {
            // Use IOTA Identity to generate a ZK proof
            const proof = await this.identity.createZKProof(credential, revealedAttributes);
            
            logger.info(`ZK proof generated successfully`);
            
            return proof;
        } catch (error) {
            logger.error(`Error generating ZK proof: ${error.message}`);
            throw error;
        }
    }
    
    /**
     * Verify a zero-knowledge proof
     * @param {Object} proof - The proof to verify
     * @returns {boolean} Verification result
     */
    async verifyZKProof(proof) {
        logger.info(`Verifying ZK proof: ${proof.id}`);
        
        try {
            // Use IOTA Identity to verify the ZK proof
            const result = await this.identity.verifyZKProof(proof);
            
            logger.info(`ZK proof verification result: ${result.verified}`);
            
            return result.verified;
        } catch (error) {
            logger.error(`Error verifying ZK proof: ${error.message}`);
            return false;
        }
    }
    
    /**
     * Listen for DID registration events from the contract
     * @param {Object} contract - Identity Bridge contract instance
     * @param {Function} callback - Callback function for events
     */
    listenForDIDRegistrations(contract, callback) {
        logger.info('Setting up listener for DID registration events...');
        
        try {
            // Listen for DID registered events
            contract.on('DIDRegistered', (user, did, timestamp, event) => {
                logger.info(`DID registered event: ${did} for user ${user}`);
                
                // Cache the DID
                this.didCache.set(user, ethers.utils.parseBytes32String(did));
                
                // Call the callback
                callback({
                    user,
                    did: ethers.utils.parseBytes32String(did),
                    timestamp: timestamp.toNumber(),
                    transactionHash: event.transactionHash
                });
            });
            
            logger.info('DID registration listener set up successfully');
        } catch (error) {
            logger.error(`Error setting up DID registration listener: ${error.message}`);
            throw error;
        }
    }
    
    /**
     * Create a new ABI function for the Identity Bridge contract
     * @returns {Object} Contract ABI
     */
    static generateContractABI() {
        return [
            // Bridge functions
            "function verifyDID(bytes32 did, bytes proof) external view returns (bool)",
            "function getVerificationMethod(bytes32 did, bytes32 methodId) external view returns (bytes)",
            "function resolveCredential(bytes32 credentialId) external view returns (bytes)",
            "function registerDID(address user, bytes32 did, bytes proof) external returns (bool)",
            "function verifyCredential(bytes credential) external view returns (bool)",
            "function verifyZKProof(bytes proof) external view returns (bool)",
            
            // Events
            "event DIDRegistered(address indexed user, bytes32 indexed did, uint256 timestamp)",
            "event CredentialVerified(address indexed user, bytes32 indexed credentialId, bool success, uint256 timestamp)",
            "event ZKProofVerified(address indexed user, bytes32 indexed proofId, bool success, uint256 timestamp)"
        ];
    }
}

/**
 * Create an IOTA Identity Bridge instance
 * @param {string} network - IOTA network to connect to
 * @param {Object} options - Additional options
 * @returns {Promise<IOTAIdentityBridge>} The bridge instance
 */
async function createIdentityBridge(network, options = {}) {
    try {
        logger.info(`Creating IOTA Identity Bridge for network: ${network}`);
        
        // Create IOTA client
        const { client, nodeManager } = await createClient(network);
        
        // Create account if wallet options are provided
        let account = null;
        if (options.walletOptions) {
            const wallet = await createWallet(network, options.walletOptions);
            account = await getOrCreateAccount(wallet, options.walletOptions.accountName || 'Identity Bridge');
        }
        
        // Create EVM provider if options are provided
        let provider = null;
        if (options.evmRpcUrl) {
            provider = new ethers.providers.JsonRpcProvider(options.evmRpcUrl);
        }
        
        // Create and return bridge
        const bridge = new IOTAIdentityBridge(client, account, provider);
        
        logger.info('IOTA Identity Bridge created successfully');
        
        return bridge;
    } catch (error) {
        logger.error(`Error creating Identity Bridge: ${error.message}`);
        throw error;
    }
}

module.exports = {
    IOTAIdentityBridge,
    createIdentityBridge
};
