/**
 * IOTA SDK Wallet Wrapper
 * 
 * This file provides a simplified interface to the IOTA SDK Wallet functionality.
 * Enhanced with improved error handling, transaction monitoring, and resilience features.
 */

const { Wallet, CoinType } = require('@iota/sdk');
const logger = require('./utils/logger');
const config = require('./config');
const { withExponentialBackoff, withTimeout } = require('./client');

// Cache for account instances to avoid recreating them
const accountCache = new Map();

/**
 * Create an IOTA Wallet instance with enhanced resilience
 * @param {string} network - The network to connect to (mainnet/testnet)
 * @returns {Promise<Wallet>} The IOTA Wallet instance
 */
async function createWallet(network = config.DEFAULT_NETWORK) {
  return await withExponentialBackoff(async () => {
    try {
      logger.info(`Creating IOTA wallet for network: ${network}`);
      
      const walletOptions = config.getWalletOptions(network);
      
      // Enhanced Stronghold password validation
      if (walletOptions.secretManager?.stronghold?.password) {
        const passwordEvaluation = config.STRONGHOLD_CONFIG.evaluatePasswordStrength(
          walletOptions.secretManager.stronghold.password
        );
        
        if (!config.STRONGHOLD_CONFIG.validatePassword(walletOptions.secretManager.stronghold.password)) {
          logger.warn(`Stronghold password does not meet security requirements (strength: ${passwordEvaluation.strength}, score: ${passwordEvaluation.score}).`);
          logger.warn('Password must be at least 12 characters with uppercase, lowercase, number, and special characters.');
        } else {
          logger.info(`Using secure Stronghold password (strength: ${passwordEvaluation.strength}).`);
        }
      } else {
        logger.warn('No Stronghold password provided, secure operations may fail');
        logger.warn('Set STRONGHOLD_PASSWORD in your .env file with a strong password');
      }
      
      // Check if stronghold file exists
      const fs = require('fs');
      const strongholdPath = walletOptions.secretManager?.stronghold?.snapshotPath;
      
      if (strongholdPath && !fs.existsSync(strongholdPath)) {
        logger.info(`Stronghold file not found at ${strongholdPath}. A new one will be created.`);
      }
      
      // Create wallet instance with proper error handling
      const wallet = new Wallet(walletOptions);
      
      // Verify wallet is working with improved error handling
      try {
        await wallet.storeMnemonic("", { overwrite: false }); // Just a test call, won't actually store anything
        logger.info('IOTA wallet initialized successfully with Stronghold integration');
      } catch (verifyError) {
        // Handle specific stronghold verification errors
        if (verifyError.message && verifyError.message.includes('mnemonic already stored')) {
          logger.info('IOTA wallet initialized successfully (mnemonic already exists)');
        } else {
          throw verifyError; // Re-throw if it's a different error
        }
      }
      
      return wallet;
    } catch (error) {
      logger.error(`Error initializing IOTA wallet: ${error.message}`);
      
      // Enhanced error handling with more specific messages
      if (error.message && error.message.includes('stronghold')) {
        throw new Error(`Stronghold error: ${error.message}. Check your password and stronghold file.`);
      } else if (error.message && error.message.includes('password')) {
        throw new Error(`Stronghold password error: ${error.message}. Ensure your password is correct.`);
      } else if (error.message && error.message.includes('connect')) {
        throw new Error(`Network connection error: ${error.message}. Check your network settings and verify IOTA node availability.`);
      } else if (error.message && error.message.includes('storage')) {
        throw new Error(`Storage error: ${error.message}. Check your storage path and permissions.`);
      } else if (error.message && error.message.includes('timeout')) {
        throw new Error(`Connection timeout: ${error.message}. The network may be congested or the node may be unavailable.`);
      } else {
        throw error;
      }
    }
  });
}

/**
 * Get or create an account in the wallet with enhanced resilience
 * @param {Wallet} wallet - The IOTA wallet instance
 * @param {string} alias - The account alias/name
 * @param {Object} options - Additional account options
 * @returns {Promise<Account>} The account
 */
async function getOrCreateAccount(wallet, alias = 'Default Account', options = {}) {
  // Check cache first
  const cacheKey = `${wallet.getOptions().storagePath}_${alias}`;
  if (accountCache.has(cacheKey)) {
    logger.debug(`Using cached account: ${alias}`);
    return accountCache.get(cacheKey);
  }
  
  return await withExponentialBackoff(async () => {
    try {
      logger.info(`Looking for account: ${alias}`);
      
      // Try to find existing account
      const accounts = await wallet.getAccounts();
      const existingAccount = accounts.find(account => account.alias() === alias);
      
      if (existingAccount) {
        logger.info(`Using existing account: ${alias}`);
        
        // Cache the account
        accountCache.set(cacheKey, existingAccount);
        
        return existingAccount;
      }
      
      // Merge provided options with defaults
      const accountOptions = {
        alias,
        coinType: options.coinType || CoinType.Shimmer,
        // Enhanced account options
        allowReattachment: options.allowReattachment !== false,
        allowMaxDepth: options.allowMaxDepth !== false,
        allowZeroGradeResp: true,
        allowZeroAmount: false,
        allowZeroOutput: false,
        // Additional security options
        signingStrategy: options.signingStrategy || 'default', // Options: 'default', 'edsca', 'qs'
        syncOnlyMostBasicOutputs: options.syncOnlyBasic === true
      };
      
      logger.info(`Creating new account: ${alias}`);
      
      // Create new account with enhanced options
      const account = await wallet.createAccount(accountOptions);
      
      // Initialize the account (sync with the network)
      logger.info(`Syncing account ${alias} with the network...`);
      await account.sync();
      
      // Cache the account
      accountCache.set(cacheKey, account);
      
      return account;
    } catch (error) {
      logger.error(`Error getting or creating account: ${error.message}`);
      
      if (error.message && error.message.includes('permission')) {
        throw new Error('Permission denied: Check your stronghold file permissions');
      } else if (error.message && error.message.includes('alias already exists')) {
        // This shouldn't happen since we check for existing accounts, but just in case
        // Try to get the account again
        const accounts = await wallet.getAccounts();
        const existingAccount = accounts.find(account => account.alias() === alias);
        if (existingAccount) {
          logger.warn(`Account ${alias} already exists, returning existing account`);
          
          // Cache the account
          accountCache.set(cacheKey, existingAccount);
          
          return existingAccount;
        }
      }
      
      throw error;
    }
  });
}

/**
 * Generate a new address for an account with enhanced resilience
 * @param {Account} account - The account
 * @param {Object} options - Address generation options
 * @returns {Promise<string>} The generated address
 */
async function generateAddress(account, options = {}) {
  return await withExponentialBackoff(async () => {
    try {
      logger.info(`Generating new address for account: ${account.alias()}`);
      
      // Enhanced address options with defaults
      const addressOptions = {
        internal: options.internal === true, // Default to external address
        ledgerNanoPrompt: options.ledgerNanoPrompt === true, // Default to false
        options: {
          metadata: options.metadata || 'Generated by IntelliLend Platform',
          // Additional options
          returnAddress: true,
          nonceNumber: options.nonceNumber || 0,
        }
      };
      
      const addressResponse = await account.generateAddress(addressOptions);
      const address = addressResponse.address;
      
      logger.info(`Generated new address: ${address}`);
      return address;
    } catch (error) {
      logger.error(`Error generating address: ${error.message}`);
      
      if (error.message && error.message.includes('stronghold')) {
        throw new Error('Stronghold error: Check your password and stronghold file');
      } else if (error.message && error.message.includes('unlock')) {
        throw new Error('Wallet locked: Stronghold is locked, please unlock first');
      }
      
      throw error;
    }
  });
}

/**
 * Get account balance with enhanced resilience and detailed reporting
 * @param {Account} account - The account
 * @param {Object} options - Balance query options
 * @returns {Promise<object>} The account balance
 */
async function getBalance(account, options = {}) {
  return await withExponentialBackoff(async () => {
    try {
      logger.info(`Getting balance for account: ${account.alias()}`);
      
      // Sync account before getting balance if requested
      if (options.syncFirst === true) {
        logger.debug('Syncing account before getting balance');
        await account.sync();
      }
      
      // Enhanced balance options
      const balanceOptions = {
        includeStorageDeposit: options.includeStorageDeposit !== false,
        filterStorageDepositReturn: options.filterStorageDepositReturn === true,
        filterIncomingStorageDepositReturn: options.filterIncomingStorageDepositReturn === true,
        // Advanced filters
        filterByAddress: options.filterByAddress,
        filterByNativeToken: options.filterByNativeToken
      };
      
      // Use withTimeout to ensure balance query doesn't hang
      const balance = await withTimeout(
        account.getBalance(balanceOptions),
        options.timeout || 30000 // 30 second timeout by default
      );
      
      // Format values for display and logging
      const baseToken = balance.baseCoin;
      const totalBase = BigInt(baseToken.total) / BigInt(1000000);
      const availableBase = BigInt(baseToken.available) / BigInt(1000000);
      
      // Get network info to determine token symbol
      const networkInfo = account.client().getNetworkInfo();
      const tokenSymbol = networkInfo?.bech32Hrp?.toUpperCase() || 'SMR';
      
      logger.info(`Account balance: ${totalBase} ${tokenSymbol} (${availableBase} ${tokenSymbol} available)`);
      
      // Also report any native tokens if present
      if (balance.nativeTokens && balance.nativeTokens.length > 0) {
        logger.info(`Account has ${balance.nativeTokens.length} native tokens`);
        balance.nativeTokens.forEach(token => {
          logger.debug(`- Token ${token.id}: ${token.available} available of ${token.total} total`);
        });
      }
      
      // Add formatted amounts to the response for easier consumption
      return {
        ...balance,
        formatted: {
          total: totalBase.toString(),
          available: availableBase.toString(),
          tokenSymbol,
          nativeTokens: balance.nativeTokens?.map(token => ({
            id: token.id,
            total: token.total,
            available: token.available
          })) || []
        }
      };
    } catch (error) {
      logger.error(`Error getting account balance: ${error.message}`);
      
      // Check if error is due to timeout
      if (error.message && error.message.includes('timed out')) {
        throw new Error(`Balance query timed out: The network may be congested. Try again later.`);
      }
      
      throw error;
    }
  });
}

/**
 * Send tokens from an account with enhanced resilience and transaction monitoring
 * @param {Account} account - The account
 * @param {string} amount - The amount to send (in SMR)
 * @param {string} address - The recipient address
 * @param {Object} options - Transaction options
 * @returns {Promise<object>} The transaction result
 */
async function sendTokens(account, amount, address, options = {}) {
  return await withExponentialBackoff(async () => {
    try {
      // Input validation with precise error messages
      if (!amount) {
        throw new Error('Amount is required');
      }
      
      if (isNaN(Number(amount)) || Number(amount) <= 0) {
        throw new Error('Invalid amount: must be a positive number');
      }
      
      if (!address) {
        throw new Error('Recipient address is required');
      }
      
      // Validate address format based on network
      const networkInfo = account.client().getNetworkInfo();
      const validPrefix = networkInfo?.bech32Hrp || 'smr';
      
      if (!address.startsWith(`${validPrefix}1`)) {
        throw new Error(`Invalid address format: must be a valid ${validPrefix.toUpperCase()} address starting with ${validPrefix}1`);
      }
      
      // Sync account before sending if requested
      if (options.syncFirst === true) {
        logger.debug('Syncing account before sending tokens');
        await account.sync();
      }
      
      // Convert amount to smallest unit (glow)
      const amountInGlow = BigInt(Math.floor(Number(amount) * 1000000));
      
      logger.info(`Sending ${amount} ${validPrefix.toUpperCase()} to ${address}...`);
      
      // Enhanced transaction options
      const transaction = {
        address,
        amount: amountInGlow.toString(),
        // Optional metadata
        tag: options.tag || 'IntelliLend',
        metadata: options.metadata || 'Sent via IntelliLend Platform',
        // Additional options
        allowMicroAmount: options.allowMicroAmount === true,
        mandatoryInputs: options.mandatoryInputs,
        timelockUnixTime: options.timelock
      };
      
      // Create a promise that can be resolved by the callback
      let callbackPromise = null;
      if (options.statusCallback) {
        callbackPromise = new Promise((resolve) => {
          // Call status callback with initial status
          options.statusCallback({
            status: 'sending',
            message: `Sending ${amount} ${validPrefix.toUpperCase()} to ${address}`,
            timestamp: Date.now()
          });
        });
      }
      
      // Send the transaction with timeout
      const sendPromise = withTimeout(
        account.send(transaction),
        options.timeout || 60000 // 60 second timeout by default
      );
      
      // Wait for transaction to be sent
      const result = await sendPromise;
      
      logger.info(`Transaction sent successfully! Block ID: ${result.blockId}`);
      
      // Call status callback with sent status
      if (options.statusCallback) {
        options.statusCallback({
          status: 'sent',
          message: `Transaction sent successfully! Block ID: ${result.blockId}`,
          blockId: result.blockId,
          transactionId: result.transactionId,
          timestamp: Date.now()
        });
      }
      
      // Monitor the transaction if requested
      if (options.monitor === true) {
        logger.info(`Monitoring transaction ${result.blockId} for confirmation...`);
        
        // Start transaction monitoring in the background
        monitorTransaction(account, result.blockId, options.statusCallback, {
          maxDuration: options.monitorDuration || 300000, // 5 minutes by default
          checkInterval: options.checkInterval || 10000, // 10 seconds by default
          maxRetries: options.maxRetries || 5
        }).catch(error => {
          logger.error(`Error monitoring transaction: ${error.message}`);
        });
      }
      
      return {
        ...result,
        // Add additional useful information
        amount,
        address,
        formattedAmount: `${amount} ${validPrefix.toUpperCase()}`,
        timestamp: Date.now(),
        monitoring: options.monitor === true
      };
    } catch (error) {
      logger.error(`Error sending tokens: ${error.message}`);
      
      // Enhance error messages for common issues
      if (error.message && error.message.includes('insufficient funds')) {
        throw new Error('Insufficient funds: Check your balance and try again');
      } else if (error.message && error.message.includes('network')) {
        throw new Error('Network error: Check your connection and try again');
      } else if (error.message && error.message.includes('timed out')) {
        throw new Error(`Transaction timed out: The network may be congested. Check explorer to see if transaction was submitted.`);
      }
      
      throw error;
    }
  });
}

/**
 * Monitor a transaction for confirmation status changes
 * @param {Account} account - The account
 * @param {string} blockId - The block ID to monitor
 * @param {Function} statusCallback - Callback function for status updates
 * @param {Object} options - Monitoring options
 * @returns {Promise<object>} Final confirmation status
 */
async function monitorTransaction(account, blockId, statusCallback, options = {}) {
  const {
    maxDuration = 300000, // 5 minutes
    checkInterval = 10000, // 10 seconds
    maxRetries = 5
  } = options;
  
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    let retries = 0;
    let lastStatus = null;
    
    // Function to check confirmation status
    const checkStatus = async () => {
      try {
        // Check if max duration has been exceeded
        if (Date.now() - startTime > maxDuration) {
          const timeoutStatus = {
            status: 'timeout',
            message: `Monitoring timed out after ${maxDuration/1000} seconds`,
            blockId
          };
          
          if (statusCallback) {
            statusCallback(timeoutStatus);
          }
          
          logger.warn(`Transaction monitoring timed out for block ${blockId}`);
          return resolve(timeoutStatus);
        }
        
        // Check block inclusion
        const inclusion = await account.client().blockMetadata(blockId);
        
        // Determine status based on metadata
        let status = 'pending';
        if (inclusion.milestone_timestamp_booked) {
          status = 'confirmed';
        } else if (inclusion.is_conflicting) {
          status = 'conflicting';
        }
        
        // If status has changed, call the callback
        if (!lastStatus || lastStatus !== status) {
          lastStatus = status;
          
          const statusUpdate = {
            status,
            message: `Block ${blockId} is ${status}`,
            blockId,
            inclusion,
            timestamp: Date.now()
          };
          
          if (statusCallback) {
            statusCallback(statusUpdate);
          }
          
          logger.info(`Transaction status update for ${blockId}: ${status}`);
        }
        
        // If confirmed or conflicting, we're done
        if (status === 'confirmed' || status === 'conflicting') {
          const finalStatus = {
            status,
            message: `Transaction ${status}`,
            blockId,
            inclusion,
            timestamp: Date.now()
          };
          
          logger.info(`Transaction ${blockId} ${status}`);
          return resolve(finalStatus);
        }
        
        // Schedule next check
        setTimeout(checkStatus, checkInterval);
      } catch (error) {
        retries++;
        logger.error(`Error checking transaction status (retry ${retries}/${maxRetries}): ${error.message}`);
        
        if (retries >= maxRetries) {
          const errorStatus = {
            status: 'error',
            message: `Error monitoring transaction: ${error.message}`,
            blockId,
            timestamp: Date.now()
          };
          
          if (statusCallback) {
            statusCallback(errorStatus);
          }
          
          return reject(error);
        }
        
        // Retry with exponential backoff
        setTimeout(checkStatus, checkInterval * Math.pow(2, retries));
      }
    };
    
    // Start checking status
    checkStatus();
  });
}

/**
 * Create and broadcast a transaction with custom outputs
 * @param {Account} account - The account
 * @param {Array} outputs - Array of output objects
 * @param {Object} options - Transaction options
 * @returns {Promise<object>} The transaction result
 */
async function createTransaction(account, outputs, options = {}) {
  return await withExponentialBackoff(async () => {
    try {
      logger.info(`Creating transaction with ${outputs.length} outputs`);
      
      // Validate outputs
      if (!Array.isArray(outputs) || outputs.length === 0) {
        throw new Error('At least one output is required');
      }
      
      // Prepare outputs according to SDK requirements
      const preparedOutputs = outputs.map(output => {
        if (!output.address) {
          throw new Error('Address is required for all outputs');
        }
        
        if (!output.amount && !output.assets) {
          throw new Error('Either amount or assets are required for all outputs');
        }
        
        const preparedOutput = {
          address: output.address,
          amount: output.amount ? output.amount.toString() : "0",
          // Optional fields
          tag: output.tag,
          metadata: output.metadata,
          assets: output.assets,
          unlockConditions: output.unlockConditions
        };
        
        return preparedOutput;
      });
      
      // Sync account before creating transaction if requested
      if (options.syncFirst === true) {
        logger.debug('Syncing account before creating transaction');
        await account.sync();
      }
      
      // Create a transaction with prepared outputs
      const transaction = {
        outputs: preparedOutputs,
        // Additional options
        allowMicroAmount: options.allowMicroAmount === true,
        mandatoryInputs: options.mandatoryInputs,
        timelockUnixTime: options.timelock
      };
      
      // Send transaction
      const result = await withTimeout(
        account.prepareTransaction(transaction),
        options.timeout || 60000 // 60 second timeout by default
      );
      
      // Sign and submit the transaction
      const blockId = await account.submitAndSign(result.transaction);
      
      logger.info(`Transaction submitted successfully! Block ID: ${blockId}`);
      
      // Monitor the transaction if requested
      if (options.monitor === true) {
        logger.info(`Monitoring transaction ${blockId} for confirmation...`);
        
        // Start transaction monitoring in the background
        monitorTransaction(account, blockId, options.statusCallback, {
          maxDuration: options.monitorDuration || 300000, // 5 minutes by default
          checkInterval: options.checkInterval || 10000, // 10 seconds by default
          maxRetries: options.maxRetries || 5
        }).catch(error => {
          logger.error(`Error monitoring transaction: ${error.message}`);
        });
      }
      
      return {
        blockId,
        transactionId: blockId, // For consistency with sendTokens
        preparedTransaction: result,
        timestamp: Date.now(),
        monitoring: options.monitor === true
      };
    } catch (error) {
      logger.error(`Error creating transaction: ${error.message}`);
      
      // Enhance error messages for common issues
      if (error.message && error.message.includes('insufficient funds')) {
        throw new Error('Insufficient funds: Check your balance and try again');
      } else if (error.message && error.message.includes('network')) {
        throw new Error('Network error: Check your connection and try again');
      } else if (error.message && error.message.includes('timed out')) {
        throw new Error(`Transaction timed out: The network may be congested. Try again later.`);
      }
      
      throw error;
    }
  });
}

/**
 * Burn native tokens
 * @param {Account} account - The account
 * @param {string} tokenId - The ID of the token to burn
 * @param {string} amount - The amount to burn
 * @param {Object} options - Transaction options
 * @returns {Promise<object>} The transaction result
 */
async function burnNativeTokens(account, tokenId, amount, options = {}) {
  return await withExponentialBackoff(async () => {
    try {
      logger.info(`Burning ${amount} of token ${tokenId}`);
      
      // Input validation
      if (!tokenId) {
        throw new Error('Token ID is required');
      }
      
      if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
        throw new Error('Invalid amount: must be a positive number');
      }
      
      // Sync account before burning tokens if requested
      if (options.syncFirst === true) {
        logger.debug('Syncing account before burning tokens');
        await account.sync();
      }
      
      // Create transaction to burn tokens
      const burnTransaction = {
        address: await account.addresses()[0], // Send to own address
        amount: "0", // No IOTA tokens
        assets: {
          nativeTokens: [
            {
              id: tokenId,
              amount: amount.toString()
            }
          ]
        },
        burn: true // Indicate this is a burn transaction
      };
      
      // Submit transaction
      const result = await account.send(burnTransaction);
      
      logger.info(`Tokens burned successfully! Block ID: ${result.blockId}`);
      
      // Monitor the transaction if requested
      if (options.monitor === true) {
        logger.info(`Monitoring burn transaction ${result.blockId} for confirmation...`);
        
        // Start transaction monitoring in the background
        monitorTransaction(account, result.blockId, options.statusCallback, {
          maxDuration: options.monitorDuration || 300000,
          checkInterval: options.checkInterval || 10000,
          maxRetries: options.maxRetries || 5
        }).catch(error => {
          logger.error(`Error monitoring burn transaction: ${error.message}`);
        });
      }
      
      return {
        ...result,
        // Add additional useful information
        tokenId,
        amount,
        timestamp: Date.now(),
        monitoring: options.monitor === true
      };
    } catch (error) {
      logger.error(`Error burning tokens: ${error.message}`);
      throw error;
    }
  });
}

/**
 * Get transaction history for an account
 * @param {Account} account - The account
 * @param {Object} options - Query options
 * @returns {Promise<Array>} Transaction history
 */
async function getTransactionHistory(account, options = {}) {
  return await withExponentialBackoff(async () => {
    try {
      logger.info(`Getting transaction history for account: ${account.alias()}`);
      
      // Sync account before getting history if requested
      if (options.syncFirst === true) {
        logger.debug('Syncing account before getting transaction history');
        await account.sync();
      }
      
      // Prepare filter options
      const filterOptions = {
        // Filter by type if specified
        // 0: all, 1: received, 2: sent
        type: options.type !== undefined ? options.type : 0,
        
        // Additional filters
        from: options.from, // Start date
        to: options.to, // End date
        limit: options.limit || 50, // Max number of results
        offset: options.offset || 0, // Pagination offset
        
        // Advanced filters
        filterValue: options.minValue, // Minimum value
        filterTagData: options.tag, // Filter by tag
        filterMessageData: options.message // Filter by message data
      };
      
      // Get transaction history
      const transactions = await account.transactions(filterOptions);
      
      logger.info(`Found ${transactions.length} transactions`);
      
      // Process and format transactions for better consumption
      const formattedTransactions = transactions.map(tx => {
        // Format amount
        const networkInfo = account.client().getNetworkInfo();
        const tokenSymbol = networkInfo?.bech32Hrp?.toUpperCase() || 'SMR';
        const amountBase = BigInt(tx.amount) / BigInt(1000000);
        
        return {
          id: tx.transactionId,
          blockId: tx.blockId,
          incoming: tx.incoming,
          amount: tx.amount,
          formattedAmount: `${amountBase.toString()} ${tokenSymbol}`,
          timestamp: new Date(tx.timestamp).toISOString(),
          address: tx.address,
          tag: tx.tag,
          confirmed: !!tx.inclusionState,
          inclusionState: tx.inclusionState || 'pending'
        };
      });
      
      return formattedTransactions;
    } catch (error) {
      logger.error(`Error getting transaction history: ${error.message}`);
      throw error;
    }
  });
}

/**
 * Listen for account events (deposits, withdrawals, etc.)
 * @param {Account} account - The account
 * @param {Function} callback - Callback function for events
 * @returns {Promise<void>}
 */
async function listenToAccountEvents(account, callback) {
  try {
    logger.info(`Setting up event listener for account: ${account.alias()}`);
    
    // Add event listener for new output events
    account.client().on('newOutput', (event) => {
      try {
        logger.debug('New output event received');
        
        // Check if this output is for our account
        const outputData = event.output;
        const ourAddresses = account.addresses().map(addr => addr.address);
        
        if (outputData.address && ourAddresses.includes(outputData.address)) {
          // Format the event data for the callback
          const eventData = {
            type: 'newOutput',
            address: outputData.address,
            amount: outputData.amount,
            outputId: event.id,
            timestamp: Date.now()
          };
          
          logger.info(`New deposit detected: ${eventData.amount} to ${eventData.address}`);
          
          // Call the callback with the event data
          callback(eventData);
        }
      } catch (error) {
        logger.error(`Error processing output event: ${error.message}`);
      }
    });
    
    // Add event listener for transaction confirmation events
    account.client().on('transactionConfirmed', (event) => {
      try {
        logger.debug('Transaction confirmed event received');
        
        // Format the event data for the callback
        const eventData = {
          type: 'transactionConfirmed',
          transactionId: event.transactionId,
          blockId: event.blockId,
          timestamp: Date.now()
        };
        
        logger.info(`Transaction ${eventData.transactionId} confirmed`);
        
        // Call the callback with the event data
        callback(eventData);
      } catch (error) {
        logger.error(`Error processing confirmation event: ${error.message}`);
      }
    });
    
    logger.info('Account event listeners set up successfully');
  } catch (error) {
    logger.error(`Error setting up account event listeners: ${error.message}`);
    throw error;
  }
}

/**
 * Create a new signing key for an account
 * @param {Account} account - The account
 * @param {string} keyType - Type of key to create (ed25519, secp256k1, etc.)
 * @param {Object} options - Key generation options
 * @returns {Promise<object>} The generated key
 */
async function createSigningKey(account, keyType = 'ed25519', options = {}) {
  return await withExponentialBackoff(async () => {
    try {
      logger.info(`Creating new ${keyType} signing key for account: ${account.alias()}`);
      
      // Generate the key
      const keyPair = await account.generateSigningKey({
        type: keyType,
        ...options
      });
      
      logger.info(`Signing key generated successfully`);
      
      return {
        publicKey: keyPair.publicKey,
        keyType,
        generated: Date.now()
      };
    } catch (error) {
      logger.error(`Error creating signing key: ${error.message}`);
      throw error;
    }
  });
}

module.exports = {
  // Core wallet functionality
  createWallet,
  getOrCreateAccount,
  generateAddress,
  getBalance,
  sendTokens,
  
  // Transaction monitoring
  monitorTransaction,
  getTransactionHistory,
  
  // Advanced transaction operations
  createTransaction,
  burnNativeTokens,
  
  // Account events
  listenToAccountEvents,
  
  // Cryptographic functions
  createSigningKey
};
