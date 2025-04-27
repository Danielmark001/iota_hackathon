const dotenv = require('dotenv');
const { Client } = require('@iota/sdk');

// Load environment variables
dotenv.config();

async function run() {
  try {
    console.log('Testing IOTA network connection...');
    
    // Get network from environment or default to testnet
    const network = process.env.IOTA_NETWORK || 'testnet';
    console.log(`Connecting to IOTA ${network}...`);
    
    // Define nodes - use the official IOTA testnet node
    const nodes = ['https://api.testnet.iotaledger.net'];
    console.log(`Using nodes: ${nodes.join(', ')}`);
    
    // Create client
    const client = new Client({
      nodes: nodes,
      localPow: true
    });
    
    // Get node information
    const info = await client.getInfo();
    console.log('Connected to IOTA node successfully!');
    console.log(`Node name: ${info.nodeInfo.name}`);
    console.log(`Node version: ${info.nodeInfo.version}`);
    console.log(`Node status: ${info.nodeInfo.status.isHealthy ? 'healthy' : 'unhealthy'}`);
    console.log(`Network: ${info.nodeInfo.protocol.networkName}`);
    
    console.log('IOTA connection test successful!');
  } catch (error) {
    console.error('Error connecting to IOTA network:', error);
  }
}

run()
  .then(() => console.log('Test complete'))
  .catch(err => console.error('Test failed:', err));
