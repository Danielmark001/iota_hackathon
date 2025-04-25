# IntelliLend Quick Start Guide

This guide will help you quickly set up and run the IntelliLend demo to showcase the platform's features.

## Prerequisites

- Node.js (v16+)
- Python (v3.8+)
- Git

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/intellilend.git
   cd intellilend
   ```

2. Install JavaScript dependencies:
   ```bash
   npm install
   ```

3. Install Python dependencies:
   ```bash
   cd ai-model
   pip install -r requirements.txt
   cd ..
   ```

4. Create necessary directories:
   ```bash
   mkdir -p reports
   mkdir -p ai-model/models
   ```

## Running the Demo

### Option 1: Full End-to-End Demo

The end-to-end demo simulates the complete workflow of the IntelliLend platform, including contract deployment, user activities, AI risk assessment, cross-layer messaging, and liquidation scenarios.

```bash
# Start a local Hardhat node
npx hardhat node

# In a new terminal, run the demo script
node scripts/fixed-demo.js
```

### Option 2: Frontend Demo

To see the dashboard interface without running the blockchain simulation:

```bash
# Start the frontend
npm run start:frontend

# Access the dashboard at http://localhost:3000
```

### Option 3: AI Model Demo

To test the AI risk assessment model independently:

```bash
# Start the AI model API
cd ai-model
python -m api.app

# In a new terminal, test the API
curl -X POST http://localhost:5000/assess-risk \
  -H "Content-Type: application/json" \
  -d '{"address":"0x1234","transaction_count":50,"wallet_age_days":100,"repayment_ratio":0.9,"default_count":0,"wallet_balance_volatility":0.1}'
```

## Key Demo Components

The demo showcases the following key features:

1. **Smart Contract Infrastructure**
   - Lending pool operations (deposit, borrow, repay)
   - Cross-layer communication between EVM and Move
   - Privacy-preserving zero-knowledge proofs

2. **AI Risk Assessment**
   - Dynamic risk scoring based on on-chain activity
   - Early warning signals for potential defaults
   - Interest rate optimization

3. **Cross-Chain Liquidity**
   - Aggregating liquidity from multiple chains
   - AI-driven yield optimization
   - Automated rebalancing strategies

4. **Liquidation Protection**
   - Risk-based liquidation thresholds
   - Early warning system for at-risk positions
   - AI-optimized liquidation parameters

## Troubleshooting

### Common Issues

1. **Error: Cannot find module**
   - Make sure you've run `npm install` in the root directory

2. **Error: Cannot connect to Hardhat node**
   - Ensure you're running a Hardhat node in a separate terminal with `npx hardhat node`

3. **Python ModuleNotFoundError**
   - Make sure you've installed all dependencies with `pip install -r requirements.txt`

### Getting Help

If you encounter any issues, please:

1. Check the error logs in the terminal
2. Refer to the documentation in the `docs` directory
3. Create an issue on the GitHub repository

## Next Steps

After running the demo, explore the codebase to understand how the different components work together:

- `smart-contracts/`: All Solidity and Move contracts
- `ai-model/`: AI risk assessment models and API
- `frontend/`: React-based user interface
- `scripts/`: Demo and deployment scripts

The comprehensive dashboard visualization provides a clear view of how the AI-powered risk assessment enhances the lending protocol's efficiency and security.
