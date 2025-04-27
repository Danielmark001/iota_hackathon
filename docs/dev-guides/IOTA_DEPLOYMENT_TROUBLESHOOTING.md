# IOTA Integration: Deployment & Troubleshooting Guide

This guide provides comprehensive instructions for deploying and troubleshooting the IOTA integration in the IntelliLend platform.

## Table of Contents

- [Deployment Prerequisites](#deployment-prerequisites)
- [Environment Configuration](#environment-configuration)
- [Deployment Steps](#deployment-steps)
  - [Backend Deployment](#backend-deployment)
  - [AI Model Deployment](#ai-model-deployment)
  - [Frontend Deployment](#frontend-deployment)
- [Post-Deployment Verification](#post-deployment-verification)
- [Common Issues & Troubleshooting](#common-issues--troubleshooting)
  - [IOTA Connection Issues](#iota-connection-issues)
  - [Cross-Layer Communication Issues](#cross-layer-communication-issues)
  - [Wallet Integration Issues](#wallet-integration-issues)
  - [AI Model Integration Issues](#ai-model-integration-issues)
- [Performance Monitoring](#performance-monitoring)
- [Security Considerations](#security-considerations)
- [Scaling Guidelines](#scaling-guidelines)
- [Backup & Recovery](#backup--recovery)

## Deployment Prerequisites

Before deploying the IOTA integration, ensure you have:

1. **Node.js**: v16.x or higher
2. **Python**: v3.8 or higher (for AI model)
3. **Docker**: Latest stable version
4. **Git**: Latest version
5. **IOTA Node Access**: Access to Shimmer Testnet nodes
6. **Strong Network Connectivity**: Stable connection to IOTA network
7. **SSL Certificates**: For secure API endpoints
8. **Storage**: Minimum 50GB for database and logs

## Environment Configuration

Configure your environment variables in `.env` files:

### Backend Environment (.env)

```
# IOTA SDK Configuration
IOTA_NETWORK=testnet
IOTA_STORAGE_PATH=./wallet-database
STRONGHOLD_SNAPSHOT_PATH=./wallet.stronghold
STRONGHOLD_PASSWORD=SecureIOTAPassword123!

# IOTA EVM Configuration
IOTA_EVM_RPC_URL=https://api.testnet.shimmer.network/evm
PRIVATE_KEY=your_private_key_for_testnet

# AI Integration Configuration
USE_MOCKS=false
USE_LOCAL_MODEL=true
AI_MODEL_PATH=./ai-model/models
AI_API_URL=http://localhost:5000
AI_API_PORT=5000
ENABLE_CROSS_LAYER=true

# IOTA nodes for redundancy
IOTA_NODES=https://api.testnet.shimmer.network,https://testnet.shimmer.iota-1.workers.dev,https://shimmer-testnet.api.nodesail.io
IOTA_PERMANODE_URL=https://chrysalis.iota.org/api

# Contract Addresses on IOTA EVM Testnet
LENDING_POOL_ADDRESS=0x9A9f2CCfdE556A7E9Ff0848998Aa4a0CFD8863AE
ZK_VERIFIER_ADDRESS=0x68B1D87F95878fE05B998F19b66F4baba5De1aed
ZK_BRIDGE_ADDRESS=0x3Aa5ebB10DC797CAC828524e59A333d0A371443c
BRIDGE_ADDRESS=0x3Aa5ebB10DC797CAC828524e59A333d0A371443c

# IOTA Identity and Streams Configuration
IDENTITY_ISSUER_DID=did:iota:test:4rRNmF3xyazqecS5vp88MxsvKjsAGnGcJG5t3nA9Lmfn
IDENTITY_ISSUER_KEY_PATH=./identity-keys/issuer.json
STREAMS_SEED=your_secure_streams_seed_here
```

### AI Model Environment (config/iota_connection_config.json)

```json
{
  "network": "testnet",
  "nodes": [
    "https://api.testnet.shimmer.network",
    "https://testnet.shimmer.iota-1.workers.dev",
    "https://shimmer-testnet.api.nodesail.io"
  ],
  "evm_rpc_url": "https://api.shimmer.network/evm",
  "request_timeout": 30,
  "retry_attempts": 5,
  "retry_delay": 2,
  "connection_resilience": {
    "max_retries": 5,
    "initial_delay_ms": 1000,
    "max_delay_ms": 30000,
    "timeout_ms": 60000,
    "health_check_interval_ms": 60000,
    "node_unhealthy_threshold": 3,
    "node_recovery_time_ms": 300000,
    "quorum_min_nodes": 2,
    "quorum_percentage": 67
  }
}
```

### Frontend Environment (.env.production)

```
REACT_APP_API_URL=https://api.testnet.yourservice.com
REACT_APP_EVM_CHAIN_ID=1072
REACT_APP_IOTA_NETWORK=testnet
REACT_APP_EXPLORER_URL=https://explorer.shimmer.network/testnet
```

## Deployment Steps

### Backend Deployment

1. **Clone Repository**:
   ```bash
   git clone https://github.com/your-org/iota-hackathon.git
   cd iota-hackathon
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Create Stronghold**:
   ```bash
   # Generate a secure password
   # The following command will create a new wallet.stronghold file
   node scripts/create-stronghold.js
   ```

4. **Configure Environment**:
   - Copy `.env.example` to `.env`
   - Update the variables as shown in the Environment Configuration section
   - Ensure `USE_MOCKS=false` to use real IOTA network

5. **Create Identity Issuer**:
   ```bash
   # This will create identity-keys/issuer.json for IOTA Identity operations
   node scripts/create-identity-issuer.js
   ```

6. **Build Backend**:
   ```bash
   npm run build
   ```

7. **Configure Node.js Process Manager**:
   ```bash
   # Install PM2 if not already installed
   npm install -g pm2
   
   # Create ecosystem.config.js
   cp ecosystem.config.example.js ecosystem.config.js
   
   # Edit ecosystem.config.js to match your environment
   ```

8. **Start the Backend Service**:
   ```bash
   pm2 start ecosystem.config.js
   ```

### AI Model Deployment

1. **Set Up Python Environment**:
   ```bash
   cd ai-model
   python -m venv .venv
   source .venv/bin/activate  # On Windows: .venv\Scripts\activate
   pip install -r requirements.txt
   ```

2. **Configure AI Model**:
   - Ensure `config/iota_connection_config.json` is properly configured
   - Set `force_mainnet: false` in `config/iota_risk_model_config.json`

3. **Start the AI API Server**:
   ```bash
   # This starts the API server on port 5000
   python api/start_api.py
   ```

4. **Verify API is Running**:
   ```bash
   curl http://localhost:5000/health
   # Should return {"status": "ok", "timestamp": "..."}
   ```

5. **Configure PM2 for AI Server**:
   ```bash
   pm2 start api/start_api.py --name "iota-ai-api" --interpreter python
   ```

### Frontend Deployment

1. **Configure Frontend**:
   ```bash
   cd frontend
   cp .env.example .env.production
   # Edit .env.production with your settings
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Build Frontend**:
   ```bash
   npm run build
   ```

4. **Deploy to Web Server**:
   ```bash
   # Example with nginx
   cp -r build/* /var/www/html/
   
   # Or serve directly with serve
   npx serve -s build
   ```

## Post-Deployment Verification

After deployment, verify that all components are working correctly:

1. **Backend Health Check**:
   ```bash
   curl https://your-api-url/health
   
   # Expected output:
   # {
   #   "status": "healthy",
   #   "services": {
   #     "iota": {
   #       "status": "healthy",
   #       "network": "testnet"
   #     },
   #     ...
   #   }
   # }
   ```

2. **IOTA Node Connection**:
   ```bash
   curl https://your-api-url/api/iota/network-status
   
   # Verify that isHealthy is true
   ```

3. **Generate IOTA Address**:
   ```bash
   curl -X GET https://your-api-url/api/iota/address \
     -H "Authorization: Bearer YOUR_AUTH_TOKEN"
   
   # Should return a valid IOTA address
   ```

4. **AI Risk Assessment API**:
   ```bash
   curl -X POST https://your-api-url/api/risk-assessment \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
     -d '{"address": "0x1234...5678"}'
   
   # Should return a risk assessment
   ```

5. **Frontend Connection**:
   - Open the deployed frontend in a browser
   - Verify that you can connect wallets
   - Check the Cross-Layer dashboard
   - Verify risk assessment visualization

## Common Issues & Troubleshooting

### IOTA Connection Issues

#### Symptom: Cannot connect to IOTA network

**Possible causes and solutions:**

1. **Incorrect node URLs**:
   - Check that `IOTA_NODES` in `.env` contains working node URLs
   - Verify nodes are operational with:
     ```bash
     curl https://api.testnet.shimmer.network/health
     ```

2. **Network configuration mismatch**:
   - Ensure `IOTA_NETWORK=testnet` matches the node URLs
   - Check `iota_connection_config.json` has "network": "testnet"

3. **Firewall blocking connections**:
   - Check if outbound connections to IOTA nodes are blocked
   - Test with:
     ```bash
     telnet api.testnet.shimmer.network 443
     ```

4. **Node synchronization issues**:
   - Nodes might be out of sync
   - Try using different nodes in the IOTA_NODES list

#### Symptom: IOTA transactions stuck in pending state

**Possible causes and solutions:**

1. **Network congestion**:
   - Wait for network conditions to improve
   - Check network status at [IOTA Status Page](https://status.iota.org/)

2. **Incorrect PoW settings**:
   - Increase local PoW settings
   - Check if the Tangle is accepting transactions with your minimum PoW

3. **Transaction timeouts**:
   - Increase timeout settings in IOTA client configuration
   - Implement reattachment logic for pending transactions

### Cross-Layer Communication Issues

#### Symptom: Tokens not appearing on L2 after L1->L2 transfer

**Possible causes and solutions:**

1. **Bridge contract issues**:
   - Verify `BRIDGE_ADDRESS` is correct in `.env`
   - Check if the bridge contract is operational
   - Inspect the EVM transaction status

2. **Incomplete transaction flow**:
   - Check L1 transaction confirmation status
   - Verify bridge transaction confirmation status
   - Look for errors in backend logs related to the bridge

3. **Transaction not propagated**:
   - Check network connectivity between your backend and IOTA nodes
   - Verify bridge service is running
   - Inspect logs for cross-layer message propagation

4. **Circuit breaker activated**:
   - Check if any circuit breakers have been triggered
   - Look for errors related to circuit breakers in the logs
   - Reset circuit breakers if necessary

#### Symptom: Cross-Layer swaps failing with timeout errors

**Possible causes and solutions:**

1. **Timeout settings too low**:
   - Increase connection_resilience.timeout_ms in config
   - Increase monitoring duration for transactions

2. **Node connectivity issues**:
   - Check health of all nodes in your node pool
   - Add more redundant nodes to the configuration

3. **Insufficient gas for EVM operations**:
   - Increase gas limit for cross-layer transactions
   - Verify gas price settings are appropriate for current network conditions

### Wallet Integration Issues

#### Symptom: Cannot connect to IOTA wallets

**Possible causes and solutions:**

1. **Compatibility issues**:
   - Check if wallet supports the dApp connection protocol
   - Verify wallet is updated to the latest version
   - Test with a different wallet for comparison

2. **Permission issues**:
   - Ensure the frontend is requesting the correct permissions
   - Check browser console for dApp connection errors
   - Verify wallet has dApp connectivity enabled

3. **Network mismatch**:
   - Ensure the wallet is connected to the same network (testnet)
   - Check wallet settings for correct network configuration

4. **Browser issues**:
   - Try using a different browser
   - Clear browser cache and cookies
   - Disable browser extensions that might interfere

### AI Model Integration Issues

#### Symptom: AI Risk Assessment not using IOTA data

**Possible causes and solutions:**

1. **Configuration issues**:
   - Verify `USE_MOCKS=false` in `.env`
   - Check `force_mainnet: false` in `iota_risk_model_config.json`
   - Ensure AI model has correct IOTA configuration

2. **Data fetching issues**:
   - Check logs for IOTA data fetching errors
   - Verify that `ai_iota_connection.py` is properly connecting to nodes
   - Test data fetching endpoints directly

3. **API connectivity**:
   - Ensure AI API is running and accessible
   - Check for firewall or network issues between backend and AI API
   - Verify the correct `AI_API_URL` is configured

4. **Model not updated**:
   - Ensure the AI model has been trained with IOTA data
   - Check model version matches expected version

## Performance Monitoring

Monitor the following metrics to ensure optimal performance:

1. **IOTA Node Health**:
   - Set up monitoring for all IOTA nodes
   - Create alerts for node connection failures
   - Track node response times and health status

2. **Transaction Success Rate**:
   - Monitor percentage of successful cross-layer transactions
   - Track transaction completion times
   - Set up alerts for abnormal failure rates

3. **API Performance**:
   - Monitor API response times
   - Track error rates for all endpoints
   - Set up resource utilization monitoring

4. **AI Model Performance**:
   - Monitor inference times
   - Track risk assessment accuracy
   - Monitor real-time vs. historical data usage

## Security Considerations

Ensure the following security measures are in place:

1. **Stronghold Password**:
   - Use a strong, unique password for the Stronghold file
   - Rotate the password periodically
   - Store the password securely, not in plaintext

2. **Private Keys**:
   - Never expose private keys in logs or error messages
   - Use secure key management solutions
   - Restrict access to private key files

3. **Authentication**:
   - Use strong authentication for all APIs
   - Implement proper JWT token validation
   - Set appropriate token expiration times

4. **Network Security**:
   - Use SSL/TLS for all API endpoints
   - Implement proper CORS policies
   - Configure firewalls to restrict access

5. **ZK Proof Security**:
   - Verify proof generation parameters
   - Ensure proofs contain minimal necessary information
   - Validate proofs on both frontend and backend

## Scaling Guidelines

For scaling the IOTA integration:

1. **Horizontal Scaling**:
   - Deploy multiple API instances behind a load balancer
   - Ensure session stickiness for wallet connections
   - Distribute IOTA client connections across instances

2. **Database Scaling**:
   - Use sharding for transaction history
   - Implement caching for frequently accessed data
   - Consider time-series databases for metrics

3. **IOTA Connection Pooling**:
   - Implement connection pooling to IOTA nodes
   - Distribute operations across multiple nodes
   - Use dedicated nodes for high-priority operations

4. **AI Model Scaling**:
   - Deploy multiple AI API instances
   - Implement model serving with TensorFlow Serving or similar
   - Use GPU acceleration for inference where possible

## Backup & Recovery

Implement the following backup and recovery procedures:

1. **Stronghold Backup**:
   - Regularly backup the Stronghold file
   - Store backups in secure, encrypted storage
   - Test recovery procedures periodically

2. **Database Backups**:
   - Implement regular database backups
   - Store transaction history securely
   - Maintain multiple backup generations

3. **Configuration Backups**:
   - Keep secure backups of all configuration files
   - Document configuration changes
   - Use version control for configuration management

4. **Disaster Recovery Plan**:
   - Document step-by-step recovery procedures
   - Test recovery procedures regularly
   - Maintain offline copies of critical recovery information
