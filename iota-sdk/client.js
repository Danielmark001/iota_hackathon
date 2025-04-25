/**
 * IOTA SDK Client Wrapper
 * 
 * This file provides a simplified interface to the IOTA SDK Client functionality.
 */

const { Client, initLogger } = require('@iota/sdk');
const config = require('./config');

// Initialize logging for better debugging
initLogger({
  name: 'IntelliLend-IOTA-Client',
  levelFilter: 'info', // Options: trace, debug, info, warn, error
  targetExclusions: ['sync']
});

/**
 * Create an IOTA Client instance
 * @param {string} network - The network to connect to (mainnet/testnet)
 * @returns {Promise<Client>} The IOTA Client instance
 */
async function createClient(network = config.DEFAULT_NETWORK) {
  try {
    const clientOptions = config.getClientOptions(network);
    
    // Add advanced options to client configuration
    const enhancedOptions = {
      ...clientOptions,
      ignoreNodeHealth: false,
      nodeSyncEnabled: true,
      quorumSize: 3, // Require consensus from 3 nodes for increased security
      minPowScore: 1000, // Set minimum PoW score
      fallbackToLocalPow: true, // Use local PoW if remote is unavailable
      localPow: true // Enable local proof of work
    };
    
    // Create client instance with better error handling
    let client;
    try {
      client = new Client(enhancedOptions);
    } catch (error) {
      console.error('Failed to initialize IOTA Client:', error);
      if (error.message && error.message.includes('connect')) {
        throw new Error(`Connection error to network ${network}: ${error.message}`);
      } else {
        throw error;
      }
    }
    
    // Test connection with timeout
    try {
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Connection timeout')), 10000)
      );
      
      const infoPromise = client.getInfo();
      const info = await Promise.race([infoPromise, timeoutPromise]);
      
      // More detailed node information
      console.log(`Connected to IOTA node: ${info.nodeInfo.name} (${info.nodeInfo.version})`);
      console.log(`Node health: ${info.nodeInfo.status.isHealthy ? 'Healthy' : 'Unhealthy'}`);
      console.log(`Protocol version: ${info.nodeInfo.protocol.version}`);
      console.log(`Network: ${info.nodeInfo.protocol.networkName || network}`);
      
      return client;
    } catch (error) {
      console.error('Error connecting to IOTA node:', error);
      throw new Error(`Failed to connect to IOTA node: ${error.message}`);
    }
  } catch (error) {
    console.error('Error creating IOTA client:', error);
    throw error;
  }
}

/**
 * Generate a Bech32 address for the given account and address indices
 * @param {Client} client - The IOTA client instance
 * @param {number} accountIndex - Account index
 * @param {number} addressIndex - Address index
 * @returns {Promise<string>} The Bech32 address
 */
async function generateAddress(client, accountIndex = 0, addressIndex = 0) {
  try {
    // Input validation
    if (accountIndex < 0 || addressIndex < 0) {
      throw new Error('Account and address indices must be non-negative');
    }
    
    // Get seed from the client's configuration
    const secretManager = client.getSecretManager();
    
    // Generate Bech32 address with proper parameters
    const addressOptions = {
      coinType: 4219, // Shimmer coin type
      accountIndex,
      addressIndex,
      bech32Hrp: 'smr', // Human-readable part for Shimmer
      includeInternal: false // External address
    };
    
    const addressObject = await client.generateBech32Address(secretManager, addressOptions);
    return addressObject;
  } catch (error) {
    console.error('Error generating address:', error);
    // Enhance error message for common issues
    if (error.message && error.message.includes('seed')) {
      throw new Error('Seed access error: Check stronghold configuration');
    }
    throw error;
  }
}

/**
 * Get balance for a Bech32 address
 * @param {Client} client - The IOTA client instance
 * @param {string} address - The Bech32 address
 * @returns {Promise<object>} The balance of the address
 */
async function getBalance(client, address) {
  try {
    // Input validation
    if (!address || !address.startsWith('smr1')) {
      throw new Error('Invalid address format: must be a valid Shimmer address');
    }
    
    // Query balance with retries for network resilience
    let attempts = 0;
    const maxAttempts = 3;
    let balance;
    
    while (attempts < maxAttempts) {
      try {
        balance = await client.getAddressBalance(address);
        break;
      } catch (error) {
        attempts++;
        if (attempts >= maxAttempts) throw error;
        
        // Exponential backoff before retry
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempts)));
        console.log(`Retrying balance query (${attempts}/${maxAttempts})...`);
      }
    }
    
    // Format for better readability
    const smrAmount = BigInt(balance.baseCoins) / BigInt(1000000);
    console.log(`Balance for ${address}: ${smrAmount} SMR`);
    
    // Add additional token information if present
    if (balance.nativeTokens && balance.nativeTokens.length > 0) {
      console.log('Native tokens:');
      balance.nativeTokens.forEach(token => {
        console.log(`- Token ID: ${token.id.slice(0, 10)}...`);
        console.log(`  Amount: ${token.amount}`);
      });
    }
    
    return balance;
  } catch (error) {
    console.error('Error getting balance:', error);
    // Provide more helpful error messages
    if (error.message && error.message.includes('not found')) {
      throw new Error('Address not found on the network or has no transactions');
    }
    throw error;
  }
}

/**
 * Submit a block to the IOTA network
 * @param {Client} client - The IOTA client instance
 * @param {object} blockData - The block data to submit
 * @returns {Promise<object>} The block ID
 */
async function submitBlock(client, blockData) {
  try {
    // Input validation
    if (!blockData || typeof blockData !== 'object') {
      throw new Error('Invalid block data: must be a valid object');
    }
    
    // Enhance block with appropriate options if not provided
    const enhancedBlock = {
      ...blockData,
      // Add defaults if not specified
      parents: blockData.parents || null, // Use null to let the node choose parents
      payload: blockData.payload || null,
      tag: blockData.tag || null
    };
    
    // Submit with error handling
    const result = await client.submitBlock(enhancedBlock);
    
    // Log successful submission
    console.log(`Block submitted successfully with ID: ${result.blockId}`);
    
    // Optionally check block inclusion (commented out as it may take time)
    // const inclusion = await client.checkBlockInclusion(result.blockId);
    // console.log(`Block inclusion state: ${inclusion.state}`);
    
    return result;
  } catch (error) {
    console.error('Error submitting block:', error);
    
    // Provide detailed error information based on common issues
    if (error.message && error.message.includes('rejected')) {
      throw new Error('Block rejected by the node. Verify block structure.');
    } else if (error.message && error.message.includes('timeout')) {
      throw new Error('Block submission timed out. The network may be congested.');
    }
    
    throw error;
  }
}

/**
 * Get network information
 * @param {Client} client - The IOTA client instance
 * @returns {Promise<object>} Network information
 */
async function getNetworkInfo(client) {
  try {
    const info = await client.getInfo();
    const protocol = await client.getProtocolParameters();
    
    // Combine relevant information
    return {
      nodeInfo: info.nodeInfo,
      protocol: protocol,
      baseToken: protocol.baseToken,
      networkName: protocol.networkName,
      bech32Hrp: protocol.bech32Hrp,
      networkId: protocol.networkId
    };
  } catch (error) {
    console.error('Error getting network information:', error);
    throw error;
  }
}

/**
 * Get tips from the network
 * @param {Client} client - The IOTA client instance
 * @returns {Promise<string[]>} Block IDs of tips
 */
async function getTips(client) {
  try {
    return await client.getTips();
  } catch (error) {
    console.error('Error getting tips:', error);
    throw error;
  }
}

module.exports = {
  createClient,
  generateAddress,
  getBalance,
  submitBlock,
  getNetworkInfo,
  getTips
};
