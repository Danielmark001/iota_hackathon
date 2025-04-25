/**
 * IOTA SDK Wallet Example
 * 
 * This example demonstrates how to use the IOTA SDK wallet functionality to:
 * 1. Create and initialize a wallet
 * 2. Create/access an account
 * 3. Generate addresses
 * 4. Check balances
 * 5. Send tokens
 * 
 * Prerequisites:
 * - npm install @iota/sdk
 * - Set environment variables for STRONGHOLD_PASSWORD
 */

require('dotenv').config();
const { wallet } = require('../index');

// Set a default recipient address - replace with an actual IOTA address for testing
const DEFAULT_RECIPIENT = 'smr1qrv74z9xxqc3rvux8u0h6hmhx6hzcecfsjguf7lrqvqk9ffkp7glfupf6dv';

async function runWalletExample() {
  console.log('========================================');
  console.log('IOTA SDK Wallet Example');
  console.log('========================================');
  
  try {
    // Initialize the wallet (testnet)
    console.log('\n1. Creating wallet instance on testnet...');
    const iotaWallet = await wallet.createWallet('testnet');
    
    // Create or access an account
    console.log('\n2. Creating/accessing an account...');
    const account = await wallet.getOrCreateAccount(iotaWallet, 'Example Account');
    
    // Generate a new address
    console.log('\n3. Generating a new address...');
    const address = await wallet.generateAddress(account);
    
    // Get account balance
    console.log('\n4. Checking account balance...');
    const balance = await wallet.getBalance(account);
    
    // Display wallet info
    console.log('\n========================================');
    console.log('Wallet Summary:');
    console.log('========================================');
    console.log(`Account: Example Account`);
    console.log(`Address: ${address}`);
    console.log(`Total Balance: ${BigInt(balance.baseCoin.total) / BigInt(1000000)} SMR`);
    console.log(`Available Balance: ${BigInt(balance.baseCoin.available) / BigInt(1000000)} SMR`);
    console.log('========================================');
    
    // Send tokens (if balance available)
    if (BigInt(balance.baseCoin.available) > BigInt(0)) {
      console.log('\n5. Sending tokens...');
      
      // Amount to send (0.1 SMR)
      const sendAmount = '0.1';
      const recipient = process.env.RECIPIENT_ADDRESS || DEFAULT_RECIPIENT;
      
      console.log(`Sending ${sendAmount} SMR to ${recipient}`);
      const result = await wallet.sendTokens(account, sendAmount, recipient);
      
      console.log('\nTransaction completed!');
      console.log(`Block ID: ${result.blockId}`);
      console.log(`Transaction ID: ${result.transactionId}`);
    } else {
      console.log('\n5. Skipping send tokens - insufficient balance');
      console.log('To receive tokens, fund the address shown above using the Shimmer Testnet Faucet:');
      console.log('https://faucet.testnet.shimmer.network/');
    }
    
  } catch (error) {
    console.error('Error in wallet example:', error);
  }
}

// Run the example if directly executed
if (require.main === module) {
  if (!process.env.STRONGHOLD_PASSWORD) {
    console.error('Error: STRONGHOLD_PASSWORD environment variable is required.');
    console.error('Please set it in your .env file.');
    process.exit(1);
  }
  
  runWalletExample()
    .then(() => console.log('\nWallet example completed.'))
    .catch(err => console.error('Example failed:', err));
}

module.exports = { runWalletExample };
