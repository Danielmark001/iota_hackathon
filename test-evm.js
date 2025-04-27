const dotenv = require('dotenv');
const { ethers } = require('ethers');

// Load environment variables
dotenv.config();

async function run() {
  try {
    console.log('Testing IOTA EVM connection...');
    
    // Get EVM RPC URL - use the latest known working URL
    const evmRpcUrl = 'https://iota-testnet-evm.public.blastapi.io';
    console.log(`Connecting to IOTA EVM at: ${evmRpcUrl}`);
    
    // Create provider
    const provider = new ethers.providers.JsonRpcProvider(evmRpcUrl);
    
    // Get network information
    const network = await provider.getNetwork();
    console.log('Connected to EVM network successfully!');
    console.log(`Network name: ${network.name}`);
    console.log(`Chain ID: ${network.chainId}`);
    
    // Get block number
    const blockNumber = await provider.getBlockNumber();
    console.log(`Current block number: ${blockNumber}`);
    
    console.log('IOTA EVM connection test successful!');
  } catch (error) {
    console.error('Error connecting to IOTA EVM network:', error);
  }
}

run()
  .then(() => console.log('Test complete'))
  .catch(err => console.error('Test failed:', err));
