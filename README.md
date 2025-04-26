# IntelliLend: Advanced DeFi Risk Assessment with IOTA Integration

## Overview

IntelliLend is a sophisticated DeFi platform leveraging machine learning and AI to create an advanced risk assessment framework for lending and borrowing activities on the IOTA network. By analyzing on-chain data, cross-layer transactions, market conditions, and user behavior, it provides personalized risk profiles and lending recommendations.

This implementation uses real IOTA network connections (not mocks or simulators) and is production-ready for MainNet deployment.

## Key Features

- **AI-Powered Risk Assessment**: Uses machine learning to analyze on-chain and cross-layer data for comprehensive risk assessment
- **Real IOTA Network Integration**: Fully connects to the IOTA network (MainNet or TestNet) with no mocks or simulators
- **Cross-Layer Operations**: Seamlessly works with both IOTA L1 (Move) and L2 (EVM)
- **Zero-Knowledge Privacy**: Implements ZK proofs for privacy-preserving risk assessment
- **IOTA Identity Integration**: Uses IOTA's decentralized identity system for user verification
- **IOTA Streams Messaging**: Secure, encrypted communication between users and the platform
- **High-Performance Architecture**: Optimized with caching, connection pooling, and transaction batching

## Prerequisites

- Node.js (v16+)
- IOTA Wallet (Firefly) for testing
- Access to IOTA MainNet or TestNet nodes
- Stronghold password for secure key management

## Quick Start

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/intellilend.git
   cd intellilend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment variables by creating a `.env` file:
   ```
   # IOTA Network Configuration
   IOTA_NETWORK=mainnet  # Use 'testnet' for development
   IOTA_STORAGE_PATH=./wallet-database
   STRONGHOLD_SNAPSHOT_PATH=./wallet.stronghold
   STRONGHOLD_PASSWORD=YourSecurePassword123!  # Use a strong password

   # IOTA node endpoints for redundancy
   IOTA_NODES=https://api.shimmer.network,https://mainnet.shimmer.iota-1.workers.dev,https://shimmer-mainnet.api.nodesail.io

   # IOTA EVM (Layer 2) endpoint
   IOTA_EVM_RPC_URL=https://json-rpc.evm.shimmer.network
   
   # Contract Addresses (update after deployment)
   LENDING_POOL_ADDRESS=0x...
   ZK_VERIFIER_ADDRESS=0x...
   ZK_BRIDGE_ADDRESS=0x...
   BRIDGE_ADDRESS=0x...
   
   # Admin wallet (for deployment and admin operations)
   PRIVATE_KEY=YourPrivateKey  # Only required for admin operations
   ```

4. Start the backend and frontend services:
   ```bash
   # Start backend
   npm run backend
   
   # Start frontend in a separate terminal
   npm run frontend
   ```

5. Access the application at `http://localhost:3000`

## Production Deployment

For production deployment, follow these additional steps:

1. **Security Configuration**
   - Use a strong Stronghold password and secure recovery procedures
   - Enable HTTPS for all API endpoints
   - Set up proper firewall rules
   - Configure environment variables securely

2. **Network Redundancy**
   - Configure multiple IOTA nodes for redundancy
   - Set up monitoring for node health

3. **Deployment Process**
   - Run deployment script with production environment:
     ```bash
     NODE_ENV=production npm run deploy
     ```
   - Verify deployment with health checks:
     ```bash
     curl https://your-server-url/health
     ```

4. **Contract Deployment**
   - Deploy smart contracts to IOTA EVM:
     ```bash
     npm run deploy-contracts
     ```
   - Update contract addresses in environment variables

5. **Monitoring Setup**
   - Configure alerting for critical services
   - Set up logging and monitoring dashboards
   - Enable performance metrics collection

## Architecture

The system consists of the following components:

1. **Backend**
   - Express.js server
   - IOTA SDK integration
   - AI risk assessment models
   - Cross-layer aggregator
   
2. **Frontend**
   - React.js application
   - IOTA wallet connection UI
   - Risk visualization components
   
3. **IOTA Integration**
   - `client.js`: Enhanced IOTA client with failover and resilience
   - `wallet.js`: Secure wallet operations using Stronghold
   - `identity.js`: IOTA Identity framework integration
   - `streams.js`: IOTA Streams for secure messaging
   - `cross-layer.js`: Cross-layer communication between L1 and L2

4. **AI Models**
   - Advanced risk assessment models
   - On-chain data analysis
   - Zero-knowledge proof generation

## IOTA Integration Details

### Mainnet vs Testnet

The application can be configured to use either IOTA MainNet or TestNet:

- **MainNet**: Production environment using real IOTA tokens
  - Set `IOTA_NETWORK=mainnet` in `.env`
  - MainNet nodes: `https://api.shimmer.network,https://mainnet.shimmer.iota-1.workers.dev`

- **TestNet**: Development and testing environment
  - Set `IOTA_NETWORK=testnet` in `.env`
  - TestNet nodes: `https://api.testnet.shimmer.network,https://testnet.shimmer.iota-1.workers.dev`

### Stronghold Security

The application uses Stronghold for secure key management:

- **Password Requirements**: Strong password with at least 12 characters, uppercase, lowercase, numbers, and special characters
- **Snapshot Backup**: Automated secure backup with encryption
- **Recovery Procedures**: Secure recovery procedures for wallet restoration

### Performance Optimization

The application includes several optimizations:

- **Caching**: Smart caching of IOTA queries to reduce network calls
- **Connection Pooling**: Intelligent node selection and failover
- **Transaction Batching**: Efficient batching of transactions for better throughput
- **Circuit Breakers**: Prevents cascading failures during network issues

## API Documentation

### IOTA Endpoints

- `GET /api/iota/address`: Generate a new IOTA address
- `GET /api/iota/balance/:address`: Get balance for an address
- `POST /api/iota/send`: Send IOTA tokens
- `GET /api/iota/transaction/:transactionId/status`: Check transaction status
- `POST /api/iota/submit`: Submit data to IOTA Tangle
- `POST /api/iota/batch`: Submit transaction batch
- `GET /api/iota/network`: Get IOTA network information
- `GET /api/iota/transactions`: Get account transaction history

### Cross-Layer Endpoints

- `POST /api/cross-layer/send`: Send cross-layer message
- `GET /api/cross-layer/status/:messageId`: Check message status
- `GET /api/cross-layer/messages/:address`: Get cross-layer messages for user

### Risk Assessment Endpoints

- `POST /api/risk-assessment`: Generate risk assessment for user
- `GET /api/recommendations/:address`: Get AI recommendations for user
- `GET /api/model/performance`: Get model performance metrics
- `GET /api/model/feature-importance`: Get feature importance for AI model

## Troubleshooting

### Common Issues

1. **Connection Errors**
   - Check if IOTA nodes are accessible
   - Verify network configuration

2. **Wallet Errors**
   - Ensure Stronghold password is correct
   - Check file permissions on Stronghold snapshot

3. **Transaction Issues**
   - Verify sufficient funds in wallet
   - Check network congestion and retry

### Logs

Log files are stored in `./logs` directory:
- `iota-integration.log`: IOTA integration logs
- `backend.log`: Backend server logs
- `risk-assessment.log`: AI risk assessment logs

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a new Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Contact

For questions and support, please contact the IntelliLend team.