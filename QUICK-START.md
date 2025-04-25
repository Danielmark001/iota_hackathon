# IntelliLend - AI-Powered DeFi Lending Platform on IOTA

## Quick Start Guide

This document provides instructions for setting up and running the IntelliLend demo for the IOTA DefAI Hackathon.

### Project Overview

IntelliLend is an intelligent lending protocol that leverages IOTA's unique architecture and AI to revolutionize DeFi lending. It uses machine learning to assess borrower risk, optimize interest rates, and enhance the security and efficiency of lending operations.

Key features:
- **AI Risk Assessment**: Advanced machine learning models analyze on-chain activity to determine personalized risk scores
- **Privacy-Preserving Identity**: Zero-knowledge proofs for secure user verification without compromising privacy
- **Cross-Chain Liquidity**: Leverage IOTA's cross-chain capabilities for optimal capital efficiency
- **Move-based Asset Security**: Secure asset representation using Move's object-centric model on Layer 1
- **Dynamic Interest Rates**: AI-optimized interest rates based on user risk profiles and market conditions

### System Requirements

- Node.js v16+ 
- npm v8+
- Python 3.8+ (for AI model)
- Git

### Installation

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/iota-hackathon.git
   cd iota-hackathon
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Install Python dependencies (for AI model):
   ```
   pip install -r ai-model/requirements.txt
   ```

4. Configure environment:
   ```
   cp .env.example .env
   ```
   
   Edit the `.env` file with your settings:
   ```
   # IOTA Network Configuration
   IOTA_EVM_RPC_URL=http://localhost:8545
   
   # Contract Addresses (optional, demo works with mock data if not provided)
   LENDING_POOL_ADDRESS=
   ZK_VERIFIER_ADDRESS=
   CROSS_CHAIN_LIQUIDITY_ADDRESS=
   
   # Demo Configuration
   USE_MOCKS=true
   ```

### Running the Demo

#### Demo CLI

We've created an interactive CLI demo that showcases all the major features of IntelliLend:

```
node scripts/demo.js
```

This interactive demo will walk you through:
- AI-powered risk assessment
- Privacy-preserving identity verification
- Cross-chain liquidity management
- Lending operations (deposit, borrow, repay, etc.)
- Yield optimization strategies

You can explore individual features or run a complete end-to-end scenario.

#### Web Frontend

To run the web frontend:

1. Start the backend server:
   ```
   npm run server
   ```

2. In a new terminal, start the frontend:
   ```
   npm run frontend
   ```

3. Open your browser and navigate to `http://localhost:3000`

### Project Structure

- `/smart-contracts` - Solidity and Move contracts
  - `/evm` - IOTA EVM Layer 2 contracts (Solidity)
  - `/move` - IOTA Layer 1 asset representation (Move)
  - `/bridge` - Cross-layer bridge contracts
- `/ai-model` - Machine learning models for risk assessment
- `/backend` - API server and business logic
- `/frontend` - React-based user interface
- `/scripts` - Utility scripts and demos

### Main Components

1. **LendingPool.sol**: Main contract for the lending protocol on IOTA EVM
2. **ZKVerifier.sol**: Contract to verify zero-knowledge proofs for privacy-preserving identity
3. **CrossChainLiquidity.sol**: Manages liquidity across multiple chains
4. **enhanced_asset.move**: Move implementation of secure asset representation
5. **risk_model.py**: AI model for risk assessment and interest rate optimization

### Running the Tests

```
npm test
```

### Deployment

For testnet deployment:

```
npx hardhat run scripts/deploy.js --network iota-testnet
```

### Additional Resources

- [IOTA Documentation](https://docs.iota.org/)
- [IOTA EVM](https://evm.iota.org/)
- [Move Programming Language](https://docs.iota.org/shimmer/smart-contracts/guide/move/getting_started)
- [IOTA Identity Framework](https://wiki.iota.org/identity.rs/introduction)

### Troubleshooting

- If you encounter issues with the demo, try enabling mock mode by setting `USE_MOCKS=true` in your `.env` file
- For Python dependencies issues, consider using a virtual environment: `python -m venv venv && source venv/bin/activate`
- Ensure you have the latest version of Node.js and npm installed

### Team

- Daniel Chen (Lead Developer)
- Team members: [Add your team members here]

---

Happy building with IOTA and AI! 🚀
