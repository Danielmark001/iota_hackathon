# IOTA SDK Integration for IntelliLend

This directory contains the IOTA SDK integration for the IntelliLend platform. The integration provides a bridge between the existing EVM-based functionality (using Hardhat) and native IOTA functionality using the IOTA SDK.

## Overview

The IOTA SDK integration allows IntelliLend to leverage the full power of the IOTA network, including:

- Native IOTA token transfers
- IOTA wallet management
- Direct interaction with IOTA nodes
- Secure key management with Stronghold

## Structure

The integration consists of the following components:

- `config.js` - Configuration settings for the IOTA SDK
- `client.js` - Client module wrapper for interacting with IOTA nodes
- `wallet.js` - Wallet module wrapper for account management
- `index.js` - Main export file

## Installation

To properly install the IOTA SDK, follow these steps:

1. Install the required dependencies:

```bash
# First, install node-abi which is required by the SDK
npm install node-abi --save-dev

# Then install the IOTA SDK
npm install @iota/sdk --save
```

2. If you encounter issues with the native build, you may need to install additional build tools:

**Windows:**
- Install Visual Studio Build Tools with C++ Desktop Development workload
- Install LLVM (version 16+)
- Set environment variable: `RUSTFLAGS="-C target-feature=+crt-static"`

**macOS:**
- Install Xcode Command Line Tools
- Install Homebrew
- Run: `brew install cmake openssl@1.1`

**Linux:**
- Install essential build tools: `sudo apt-get install build-essential cmake libssl-dev`
- Install libudev: `sudo apt-get install libudev-dev`

## Usage

### Client Module

The Client module provides low-level access to IOTA nodes:

```javascript
const { client } = require('./iota-sdk');

async function example() {
  // Create a client instance
  const iotaClient = await client.createClient('testnet');
  
  // Get node info
  const info = await iotaClient.getInfo();
  console.log(info);
  
  // Generate an address
  const address = await client.generateAddress(iotaClient);
  console.log(`Generated address: ${address}`);
}
```

### Wallet Module

The Wallet module provides high-level account management:

```javascript
const { wallet } = require('./iota-sdk');

async function example() {
  // Create a wallet instance
  const iotaWallet = await wallet.createWallet('testnet');
  
  // Get or create an account
  const account = await wallet.getOrCreateAccount(iotaWallet, 'MyAccount');
  
  // Generate an address
  const address = await wallet.generateAddress(account);
  
  // Get balance
  const balance = await wallet.getBalance(account);
  
  // Send tokens
  const result = await wallet.sendTokens(account, '1.0', recipientAddress);
}
```

## Integration with Existing Code

The IOTA SDK integration can be used alongside the existing Hardhat setup:

- Use Hardhat for EVM smart contract development and deployment
- Use IOTA SDK for native IOTA functionality
- The script `scripts/iota-native-deploy.js` demonstrates how to deploy the IOTA native components

## Environment Variables

Add the following to your `.env` file to configure the IOTA SDK:

```
# IOTA SDK Configuration
IOTA_NETWORK=testnet
IOTA_STORAGE_PATH=./wallet-database
STRONGHOLD_SNAPSHOT_PATH=./wallet.stronghold
STRONGHOLD_PASSWORD=your-secure-password
```

## Resources

- [IOTA SDK Documentation](https://wiki.iota.org/shimmer/iota-sdk/welcome/)
- [IOTA SDK GitHub Repository](https://github.com/iotaledger/iota-sdk)
- [IOTA Wiki](https://wiki.iota.org/)
