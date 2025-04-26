# IntelliLend IOTA Network Integration Guide

This guide explains how the IntelliLend platform has been fully integrated with the IOTA network, eliminating the use of mocks or simulators.

## Overview

IntelliLend now connects directly to the IOTA network (testnet) for all operations, using the official IOTA SDK and dApp Kit. This ensures that all transactions, identity verification, and cross-layer messaging are handled on the actual IOTA network rather than simulated environments.

## Key Components

### 1. IOTA SDK Integration

The backend uses the enhanced IOTA SDK wrapper located in the `iota-sdk` directory:

- **client.js**: Provides robust connection to IOTA nodes with failover, retry logic, and enhanced error handling
- **wallet.js**: Implements secure wallet functionality with Stronghold integration
- **identity.js**: Implements IOTA Identity framework for decentralized identity verification
- **streams.js**: Implements IOTA Streams for secure messaging and document sharing
- **cross-layer.js**: Handles cross-layer communication between IOTA L1 (Move) and L2 (EVM)

### 2. Frontend dApp Kit Integration

The frontend uses the official IOTA dApp Kit to connect directly to users' wallets:

- **IoTAContext.js**: Provides React context for interacting with IOTA wallets
- **WalletConnection.js**: UI component for connecting to wallets like Firefly
- **App.js**: Sets up the IOTA dApp Kit providers for wallet integration

### 3. Real Network Configuration

The application is configured to use the IOTA testnet network:

- Environment variables are set to connect to testnet endpoints
- No mocks or simulated data are used
- All operations use the real IOTA network with proper error handling

## Connection Flow

1. **Backend Initialization**:
   - Creates IOTA client with multiple node endpoints for redundancy
   - Initializes wallet with Stronghold for secure key management
   - Sets up Identity and Streams services
   - Implements cross-layer aggregator for L1/L2 communication

2. **Frontend Wallet Connection**:
   - Uses dApp Kit to connect directly to user wallets
   - Prioritizes direct wallet connections over backend proxying
   - Implements proper error handling for connection failures

3. **Transaction Processing**:
   - All transactions are submitted directly to the IOTA network
   - Block monitoring ensures transaction confirmation
   - Error handling for network issues with exponential backoff retry

## Testing Connection

To verify that the application is properly connected to the IOTA network:

1. Check the health endpoint: `GET /health`
   - Should report `iota.status` as `healthy`
   - Should show the correct network (testnet)

2. Generate an address: `GET /api/iota/address`
   - Should return a valid IOTA address
   - Address should be viewable in the IOTA explorer

3. Connect a wallet via the UI
   - Should connect directly to the Firefly wallet
   - Should display the wallet's balance correctly

## Configuration

The application uses the following environment variables for IOTA configuration:

```
# IOTA SDK Configuration
IOTA_NETWORK=testnet
IOTA_STORAGE_PATH=./wallet-database
STRONGHOLD_SNAPSHOT_PATH=./wallet.stronghold
STRONGHOLD_PASSWORD=SecureIOTAPassword123!

# IOTA network endpoints
IOTA_NODES=https://api.testnet.shimmer.network,https://testnet.shimmer.iota-1.workers.dev,https://shimmer-testnet.api.nodesail.io
```

## Debugging

If issues arise with the IOTA connection:

1. Check logs for IOTA-related errors:
   - Look for connection failures
   - Check for timeout issues
   - Verify Stronghold password is correct

2. Ensure required environment variables are set:
   - IOTA_NETWORK should be 'testnet'
   - STRONGHOLD_PASSWORD must be set
   - USE_MOCKS should be 'false'

3. Verify node endpoints are accessible:
   - Try connecting to node endpoints directly
   - Check if firewall is blocking connections

## Additional Resources

- [IOTA Documentation](https://docs.iota.org/)
- [IOTA SDK Documentation](https://wiki.iota.org/iota-sdk/welcome/)
- [dApp Kit Documentation](https://wiki.iota.org/shimmer/dapps/tools/firefly/wallet-endpoints/)
