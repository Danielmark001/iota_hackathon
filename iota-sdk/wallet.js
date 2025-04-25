/**
 * IOTA SDK Wallet Wrapper
 * 
 * This file provides a simplified interface to the IOTA SDK Wallet functionality.
 */

const { Wallet, CoinType } = require('@iota/sdk');
const config = require('./config');

/**
 * Create an IOTA Wallet instance
 * @param {string} network - The network to connect to (mainnet/testnet)
 * @returns {Promise<Wallet>} The IOTA Wallet instance
 */
async function createWallet(network = config.DEFAULT_NETWORK) {
  try {
    const walletOptions = config.getWalletOptions(network);
    
    // Create wallet instance with proper error handling
    try {
      const wallet = new Wallet(walletOptions);
      console.log('IOTA wallet initialized successfully');
      return wallet;
    } catch (error) {
      console.error('Error initializing IOTA wallet:', error);
      // Provide more specific error message based on error type
      if (error.message && error.message.includes('stronghold')) {
        throw new Error('Stronghold password or file issue: ' + error.message);
      } else if (error.message && error.message.includes('connect')) {
        throw new Error('Network connection error: ' + error.message);
      } else {
        throw error;
      }
    }
  } catch (error) {
    console.error('Error creating IOTA wallet:', error);
    throw error;
  }
}

/**
 * Get or create an account in the wallet
 * @param {Wallet} wallet - The IOTA wallet instance
 * @param {string} alias - The account alias/name
 * @returns {Promise<Account>} The account
 */
async function getOrCreateAccount(wallet, alias = 'Default Account') {
  try {
    // Try to find existing account
    const accounts = await wallet.getAccounts();
    const existingAccount = accounts.find(account => account.alias === alias);
    
    if (existingAccount) {
      console.log(`Using existing account: ${alias}`);
      return existingAccount;
    }
    
    // Create new account with enhanced options
    console.log(`Creating new account: ${alias}`);
    return await wallet.createAccount({
      alias,
      coinType: CoinType.Shimmer,
      allowReattachment: true,
      allowMaxDepth: true,
      allowZeroGradeResp: true,
      allowZeroAmount: false,
      allowZeroOutput: false
    });
  } catch (error) {
    console.error('Error getting or creating account:', error);
    if (error.message && error.message.includes('permission')) {
      throw new Error('Permission denied: Check your stronghold file permissions');
    }
    throw error;
  }
}

/**
 * Generate a new address for an account
 * @param {Account} account - The account
 * @returns {Promise<string>} The generated address
 */
async function generateAddress(account) {
  try {
    // Generate address with advanced options
    const addressOptions = {
      internal: false, // External address (can receive funds)
      ledgerNanoPrompt: false // Don't prompt ledger users
    };
    
    const addressResponse = await account.generateAddress(addressOptions);
    const address = addressResponse.address;
    
    console.log(`Generated new address: ${address}`);
    return address;
  } catch (error) {
    console.error('Error generating address:', error);
    throw error;
  }
}

/**
 * Get account balance
 * @param {Account} account - The account
 * @returns {Promise<object>} The account balance
 */
async function getBalance(account) {
  try {
    // Get balance with specific options
    const balanceOptions = {
      includeStorageDeposit: true,
      filterStorageDepositReturn: false
    };
    
    const balance = await account.getBalance(balanceOptions);
    
    // Format values for display (handle potentially very large numbers safely)
    const totalSMR = BigInt(balance.baseCoin.total) / BigInt(1000000);
    const availableSMR = BigInt(balance.baseCoin.available) / BigInt(1000000);
    
    console.log(`Account balance: ${totalSMR} SMR (${availableSMR} SMR available)`);
    
    // Also report any native tokens if present
    if (balance.nativeTokens && balance.nativeTokens.length > 0) {
      console.log('Native tokens:');
      balance.nativeTokens.forEach(token => {
        console.log(`- ${token.id}: ${token.available}`);
      });
    }
    
    return balance;
  } catch (error) {
    console.error('Error getting account balance:', error);
    throw error;
  }
}

/**
 * Send tokens from an account
 * @param {Account} account - The account
 * @param {string} amount - The amount to send (in SMR)
 * @param {string} address - The recipient address
 * @returns {Promise<object>} The transaction result
 */
async function sendTokens(account, amount, address) {
  try {
    // Input validation
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      throw new Error('Invalid amount: must be a positive number');
    }
    
    if (!address || !address.startsWith('smr1')) {
      throw new Error('Invalid address: must be a valid Shimmer address');
    }
    
    // Convert SMR to smallest unit (glow)
    // Handle string numbers by multiplying as numbers first, then convert to BigInt
    const amountInGlow = BigInt(Math.floor(Number(amount) * 1000000));
    
    console.log(`Sending ${amount} SMR to ${address}...`);
    
    // Create transaction with advanced options
    const transaction = {
      address: address,
      amount: amountInGlow.toString(),
      tag: 'IntelliLend', // Optional tag for identification
      metadata: 'Sent via IntelliLend Platform' // Optional metadata
    };
    
    const result = await account.send(transaction);
    
    console.log(`Transaction sent successfully!`);
    console.log(`Block ID: ${result.blockId}`);
    console.log(`Transaction ID: ${result.transactionId}`);
    
    return result;
  } catch (error) {
    console.error('Error sending tokens:', error);
    // Enhance error messages for common issues
    if (error.message && error.message.includes('insufficient funds')) {
      throw new Error('Insufficient funds: Check your balance and try again');
    } else if (error.message && error.message.includes('network')) {
      throw new Error('Network error: Check your connection and try again');
    }
    throw error;
  }
}

module.exports = {
  createWallet,
  getOrCreateAccount,
  generateAddress,
  getBalance,
  sendTokens
};
