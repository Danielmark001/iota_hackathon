/**
 * IOTA SDK Wallet Wrapper
 * 
 * This file provides a simplified interface to the IOTA SDK Wallet functionality.
 */

// When properly installed, uncomment these lines:
// const { Wallet, CoinType } = require('@iota/sdk');

const config = require('./config');

/**
 * Create an IOTA Wallet instance
 * @param {string} network - The network to connect to (mainnet/testnet)
 * @returns {Promise<Wallet>} The IOTA Wallet instance
 */
async function createWallet(network = config.DEFAULT_NETWORK) {
  try {
    const walletOptions = config.getWalletOptions(network);
    
    // This is a placeholder until proper installation
    const Wallet = function(options) {
      this.options = options;
      
      this.getAccounts = async () => {
        return [];
      };
      
      this.createAccount = async (accountOptions) => {
        const account = {
          alias: accountOptions.alias || 'Account 1',
          addresses: [],
          
          generateAddress: async () => {
            const newAddress = `smr1qrv74z9xxqc3rvux8u0h6hmhx6hzcecfsjguf7lrqvqk9ffkp7glfupf6dv`;
            account.addresses.push(newAddress);
            return newAddress;
          },
          
          getBalance: async () => {
            return {
              baseCoin: {
                total: '1000000000',
                available: '1000000000'
              }
            };
          },
          
          send: async (amount, address) => {
            return {
              blockId: '0x' + Array(64).fill('0').join(''),
              transactionId: '0x' + Array(64).fill('1').join('')
            };
          }
        };
        
        return account;
      };
    };
    
    // Create wallet instance
    const wallet = new Wallet(walletOptions);
    console.log('IOTA wallet initialized successfully');
    
    return wallet;
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
    
    // Create new account
    console.log(`Creating new account: ${alias}`);
    return await wallet.createAccount({
      alias
    });
  } catch (error) {
    console.error('Error getting or creating account:', error);
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
    const address = await account.generateAddress();
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
    const balance = await account.getBalance();
    const totalSMR = BigInt(balance.baseCoin.total) / BigInt(1000000);
    const availableSMR = BigInt(balance.baseCoin.available) / BigInt(1000000);
    
    console.log(`Account balance: ${totalSMR} SMR (${availableSMR} SMR available)`);
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
    // Convert SMR to smallest unit (glow)
    // Handle string numbers by multiplying as numbers first, then convert to BigInt
    const amountInGlow = BigInt(Math.floor(Number(amount) * 1000000));
    
    console.log(`Sending ${amount} SMR to ${address}...`);
    const result = await account.send(amountInGlow.toString(), address);
    
    console.log(`Transaction sent successfully!`);
    console.log(`Block ID: ${result.blockId}`);
    console.log(`Transaction ID: ${result.transactionId}`);
    
    return result;
  } catch (error) {
    console.error('Error sending tokens:', error);
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
