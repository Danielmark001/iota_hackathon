# IntelliLend on IOTA

IntelliLend is an AI-powered lending protocol built on IOTA. It uses machine learning to assess borrower risk, optimize collateralization, and facilitate cross-layer communication between IOTA L1 (using Move) and L2 (using EVM).

## Features

- **IOTA Network Integration**: Connect to the IOTA network for fast, secure, and low-fee transactions
- **AI Risk Assessment**: Machine learning models assess borrower risk for better loan terms
- **Cross-Layer Communication**: Seamless interaction between IOTA L1 (Move) and L2 (EVM)
- **Privacy-Preserving Verification**: Zero-knowledge proofs for private data verification
- **Dual-Network Functionality**: Operate on both IOTA EVM and IOTA L1 (via Move modules)

## Architecture

The IntelliLend platform consists of the following components:

### Backend

- **Server**: Express.js server handling API requests, AI integration, and IOTA operations
- **IOTA SDK**: Full integration with the IOTA TypeScript SDK for Tangle operations
- **AI Model**: Risk assessment models predicting borrower risk scores

### Frontend

- **Web Interface**: React-based UI for platform interaction
- **Wallet Integration**: Connect to both EVM and IOTA wallets
- **Dashboard**: Monitor lending/borrowing activity and view risk assessments

### Smart Contracts

- **EVM Contracts**: Solidity contracts for the lending protocol running on IOTA EVM
- **Move Modules**: Move smart contracts for IOTA L1 integration

## Setup and Installation

### Prerequisites

- Node.js 16+
- npm or yarn
- Access to IOTA network (testnet/mainnet)
- Stronghold wallet password (for IOTA wallet functionality)

### Environment Variables

Create a `.env` file in the root directory with the following variables:

```
# Network Configuration
IOTA_NETWORK=testnet  # Options: mainnet, testnet, devnet
IOTA_EVM_RPC_URL=https://api.testnet.shimmer.network/evm

# Wallet Configuration
STRONGHOLD_PASSWORD=your_secure_password
STRONGHOLD_SNAPSHOT_PATH=./wallet.stronghold
IOTA_STORAGE_PATH=./wallet-database

# Contract Addresses
LENDING_POOL_ADDRESS=0x...
ZK_VERIFIER_ADDRESS=0x...
ZK_BRIDGE_ADDRESS=0x...
MOVE_LENDING_POOL_ADDRESS=0x...
MOVE_RISK_BRIDGE_ADDRESS=0x...

# API Configuration
PORT=3002
```

### Installation

1. Clone the repository:
```
git clone https://github.com/yourusername/intellilend-iota.git
cd intellilend-iota
```

2. Install dependencies:
```
npm install
```

3. Deploy smart contracts (if not already deployed):
```
node deploy.js
```

4. Deploy Move modules to IOTA L1:
```
cd move-modules
node deploy.js
```

5. Start the backend server:
```
node run-backend.bat
```

6. Start the frontend:
```
node run-frontend.bat
```

## IOTA Integration

The platform integrates with IOTA in the following ways:

### IOTA SDK

- Full implementation of IOTA SDK for JavaScript/TypeScript
- Node connections with fallback and redundancy
- Wallet operations using Stronghold for secure key management
- Tangle interactions for data storage and retrieval

### IOTA L1 (Move Modules)

- `lending_pool.move`: Implements the core lending protocol on IOTA L1
- `risk_bridge.move`: Facilitates cross-layer communication for risk scores

### IOTA EVM (Solidity)

- Lending protocol contracts deployed on IOTA EVM
- ZK verifier for privacy-preserving risk assessments
- Cross-layer bridge for communication with L1

### Cross-Layer Communication

Risk assessments and other critical data are recorded on both L1 (Tangle) and L2 (EVM), providing:

1. Data redundancy and security
2. Optimal performance for different operations
3. Fallback mechanisms when one layer is congested

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.
