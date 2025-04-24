# IntelliLend Deployment Guide

This guide provides step-by-step instructions for deploying the IntelliLend platform to the IOTA testnet or mainnet.

## Prerequisites

Before deploying, ensure you have:

1. Node.js (v14+) installed
2. Python (v3.8+) installed
3. An IOTA EVM-compatible wallet with IOTA tokens for gas fees
4. Basic knowledge of smart contract deployment
5. Git installed

## Step 1: Set Up Your Environment

1. Edit the `.env` file in the project root directory:

```
# IOTA Network
IOTA_EVM_RPC_URL=https://evm.wasp.shimmer.network/evm/jsonrpc

# Contract Addresses (will be populated after deployment)
LENDING_POOL_ADDRESS=
BRIDGE_ADDRESS=

# Wallet (replace with your wallet private key)
PRIVATE_KEY=your_private_key_here

# Server Ports
BACKEND_PORT=3001
AI_MODEL_PORT=5000
FRONTEND_PORT=3000

# AI Model
AI_MODEL_API=http://localhost:5000
```

Replace `your_private_key_here` with your actual wallet private key.

> ⚠️ **Security Warning**: Never share your private key or commit it to version control. For production deployments, use environment variables or secret management services.

## Step 2: Install Dependencies

Run the following commands to install all required dependencies:

```bash
# Install project dependencies
npm install

# Install Python dependencies for AI model
cd ai-model
pip install -r requirements.txt
cd ..
```

## Step 3: Test Deployment Setup

Before deploying to the blockchain, test your deployment setup:

```bash
node scripts/test-deploy.js
```

Fix any issues reported by the test before proceeding.

## Step 4: Deploy Smart Contracts

Deploy the smart contracts to the IOTA EVM network:

```bash
node scripts/deploy.js
```

This will:
1. Deploy the CrossLayerBridge contract
2. Deploy the LendingPool contract
3. Update your `.env` file with the contract addresses
4. Save deployment information in the `deployments` directory

## Step 5: Start the Services

After successful contract deployment, start the backend services:

```bash
# Start the backend API
npm run start:backend

# Start the AI model API (in a new terminal)
npm run start:ai

# Start the frontend (in a new terminal)
npm run start:frontend
```

Alternatively, start all services with a single command:

```bash
npm run start
```

## Step 6: Verify Deployment

1. Verify that the contracts are deployed correctly by checking:
   - The contract addresses in your `.env` file
   - The deployment information in the `deployments` directory
   - The contract transactions on the [IOTA EVM Explorer](https://explorer.wasp.shimmer.network/)

2. Verify that the services are running:
   - Backend API: http://localhost:3001
   - AI Model API: http://localhost:5000
   - Frontend: http://localhost:3000

## Production Deployment

For production deployment, consider:

1. Using a dedicated server or cloud service (AWS, GCP, Azure)
2. Setting up proper security measures (SSL, firewalls, etc.)
3. Implementing CI/CD pipelines
4. Setting up monitoring and alerting
5. Using a production-grade database instead of file storage
6. Implementing proper error handling and logging

## Troubleshooting

### Common Issues

1. **Connection error to IOTA EVM**:
   - Verify that the RPC URL is correct
   - Check if the IOTA EVM network is online
   - Ensure your firewall allows the connection

2. **Deployment transaction fails**:
   - Ensure your wallet has sufficient funds for gas
   - Check if the contract compilation is successful
   - Verify that the contract parameters are correct

3. **Services not starting**:
   - Check if the required ports are available
   - Ensure that all dependencies are installed
   - Verify that the environment variables are set correctly

## Maintenance

After deployment, regularly:

1. Monitor contract activities
2. Update the AI model with new data
3. Apply security patches
4. Backup deployment information
5. Monitor service performance

---

For more help, refer to the [README.md](../README.md) or contact the development team.
