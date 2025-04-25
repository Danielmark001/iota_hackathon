/**
 * IOTA SDK Client Example
 * 
 * This example demonstrates how to use the IOTA SDK client functionality to:
 * 1. Connect to an IOTA node
 * 2. Get node information
 * 3. Generate a Bech32 address
 * 4. Check address balance
 * 5. Submit a basic block
 * 
 * Prerequisites:
 * - npm install @iota/sdk
 */

require('dotenv').config();
const { client } = require('../index');

async function runClientExample() {
  console.log('========================================');
  console.log('IOTA SDK Client Example');
  console.log('========================================');
  
  try {
    // Initialize the client (testnet)
    console.log('\n1. Creating client instance on testnet...');
    const iotaClient = await client.createClient('testnet');
    
    // Get node info
    console.log('\n2. Getting node information...');
    const info = await iotaClient.getInfo();
    console.log(`Connected to: ${info.nodeInfo.name} (${info.nodeInfo.version})`);
    console.log(`Node health: ${info.nodeInfo.status.isHealthy ? 'Healthy' : 'Unhealthy'}`);
    console.log(`Protocol version: ${info.nodeInfo.protocol.version}`);
    
    // Generate an address
    console.log('\n3. Generating a Bech32 address...');
    const address = await client.generateAddress(iotaClient);
    console.log(`Generated address: ${address}`);
    
    // Check address balance
    console.log('\n4. Checking address balance...');
    const balance = await client.getBalance(iotaClient, address);
    console.log(`Address balance: ${BigInt(balance.baseCoins) / BigInt(1000000)} SMR`);
    
    // Create and submit a block
    console.log('\n5. Creating and submitting a block...');
    
    // This is a simplified example - actual block construction would use the SDK's
    // block building capabilities. Here we create a basic tagged data block.
    const blockData = {
      type: 'TaggedData',
      tag: Buffer.from('IntelliLend Example').toString('hex'),
      data: Buffer.from(JSON.stringify({
        application: 'IntelliLend',
        timestamp: new Date().toISOString(),
        message: 'Hello IOTA!'
      })).toString('hex')
    };
    
    const blockResponse = await client.submitBlock(iotaClient, blockData);
    console.log(`Block submitted with ID: ${blockResponse.blockId}`);
    
  } catch (error) {
    console.error('Error in client example:', error);
  }
}

// Run the example if directly executed
if (require.main === module) {
  runClientExample()
    .then(() => console.log('\nClient example completed.'))
    .catch(err => console.error('Example failed:', err));
}

module.exports = { runClientExample };
