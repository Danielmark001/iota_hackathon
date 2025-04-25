# IntelliLend - AI-Powered DeFi Lending Platform on IOTA

![IntelliLend Logo](./docs/images/logo.png)

## Project Overview

IntelliLend is an intelligent lending protocol built for the IOTA DefAI Hackathon that leverages IOTA's unique dual-layer architecture and AI to revolutionize DeFi lending. It uses machine learning to assess borrower risk, optimize interest rates, and enhance the security and efficiency of lending operations.

## Key Features

### AI Risk Assessment Engine
- **Advanced Machine Learning**: Evaluates borrower risk based on on-chain activity
- **Dynamic Interest Rates**: Personalized rates based on risk scoring and market conditions
- **Early Warning System**: Detects potential defaults before they happen
- **Reinforcement Learning**: Optimizes interest rates in real-time based on market conditions

### Smart Contract Infrastructure
- **Dual-Layer Security**: Leverages IOTA's architecture for secure asset representation
- **Zero-Knowledge Proofs**: Privacy-preserving credit scoring and identity verification
- **Enhanced Cross-Layer Bridge**: Secure communication between EVM and Move layers
- **Liquidation Protection**: AI-powered early warning system to prevent liquidations

### Privacy-Preserving Identity Integration
- **Zero-Knowledge Identity Verification**: Prove credentials without revealing sensitive data
- **Private Credit Scoring**: Get accurate risk assessments without compromising privacy
- **Encrypted Cross-Layer Messaging**: Secure communication between layers

### Cross-Chain Liquidity Module
- **Multi-Chain Support**: Aggregate liquidity from different blockchain networks
- **AI Yield Optimization**: Automatically rebalance liquidity for maximum returns
- **Dynamic Strategy Allocation**: Adjust strategies based on market conditions
- **Risk-Adjusted Yields**: Balance risk and return based on user preferences

### User Experience
- **Intuitive Dashboard**: Clean, modern interface for borrowers and lenders
- **Real-Time Analytics**: Live updates on position health and market conditions
- **Risk Visualization**: Clear representation of risk factors and health metrics
- **Transparent AI Decisions**: Understand how AI influences lending decisions

## Technical Architecture

### System Components

1. **Layer 2 (IOTA EVM)**
   - LendingPool.sol: Main contract for lending and borrowing
   - ZKCrossLayerBridge.sol: Enhanced bridge for secure cross-layer communication
   - CrossChainLiquidity.sol: Module for cross-chain liquidity aggregation

2. **Layer 1 (IOTA Move)**
   - enhanced_asset.move: Advanced asset representation with privacy features
   - zk_verifier.move: Zero-knowledge proof verification module

3. **AI Components**
   - risk_model.py: Advanced risk assessment model with multiple prediction components
   - ai-helper.js: Interface between the AI model and the platform

4. **Frontend**
   - React-based dashboard with real-time analytics
   - Integration with IOTA wallet for seamless transactions

### AI Model Architecture

Our AI risk assessment engine consists of multiple specialized models:

1. **Risk Classifier**: Categorizes borrowers into risk levels (Low, Medium, High, Very High)
2. **Default Predictor**: Estimates probability of default based on on-chain behavior
3. **Time Series Models**: Predicts future behavior based on historical patterns
4. **Interest Rate Optimizer**: Uses reinforcement learning to optimize interest rates

The models analyze 40+ features including:
- Transaction patterns
- Wallet behavior
- Lending history
- Repayment patterns
- Cross-chain activity
- Market conditions

## Demo Instructions

### Prerequisites

- Node.js (v16+)
- Python (v3.8+)
- Hardhat
- IOTA EVM-compatible wallet

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/intellilend.git
   cd intellilend
   ```

2. Install dependencies:
   ```bash
   npm install
   cd ai-model && pip install -r requirements.txt && cd ..
   ```

3. Set up environment variables:
   ```bash
   cp .env.example .env
   # Edit .env with your credentials
   ```

### Running the Demo

1. Start the AI model service:
   ```bash
   npm run start:ai
   ```

2. Deploy the contracts to the IOTA EVM testnet:
   ```bash
   npm run deploy:testnet
   ```

3. Run the demo script:
   ```bash
   npm run demo
   ```

4. Start the frontend:
   ```bash
   npm run start:frontend
   ```

5. Access the dashboard at http://localhost:3000

## Project Structure

```
intellilend/
├── ai-model/                  # AI risk assessment models
│   ├── api/                   # Flask API for risk model
│   ├── data-processing/       # Data processing utilities
│   ├── feature-engineering/   # Feature extraction and engineering
│   ├── models/                # Trained model storage
│   ├── ai-helper.js           # JavaScript interface for AI
│   └── risk_model.py          # Enhanced risk assessment model
│
├── backend/                   # Node.js backend services
│   ├── controllers/           # API controllers
│   ├── models/                # Data models
│   ├── routes/                # API routes
│   └── services/              # Business logic
│
├── config/                    # Configuration files
│
├── deployments/               # Deployment artifacts
│
├── docs/                      # Documentation
│   ├── images/                # Images and diagrams
│   └── api/                   # API documentation
│
├── frontend/                  # React frontend
│   ├── public/                # Static assets
│   └── src/                   # Source code
│       ├── components/        # React components
│       ├── pages/             # Page components
│       ├── hooks/             # Custom React hooks
│       └── services/          # API services
│
├── scripts/                   # Deployment and utility scripts
│   └── demo.js                # Demo script
│
├── smart-contracts/           # Smart contracts
│   ├── bridge/                # Cross-layer bridge contracts
│   │   ├── CrossLayerBridge.sol       # Basic bridge implementation
│   │   └── ZKCrossLayerBridge.sol     # Enhanced bridge with ZK proofs
│   │
│   ├── evm/                   # IOTA EVM smart contracts
│   │   ├── contracts/         # Core contracts
│   │   ├── interfaces/        # Contract interfaces
│   │   ├── libraries/         # Solidity libraries
│   │   ├── LendingPool.sol    # Main lending contract
│   │   └── CrossChainLiquidity.sol    # Cross-chain module
│   │
│   └── move/                  # IOTA Move modules
│       ├── sources/           # Move source files
│       ├── tests/             # Move tests
│       ├── asset.move         # Basic asset module
│       └── enhanced_asset.move # Enhanced asset module with ZK proofs
│
├── tests/                     # Testing scripts
├── .env                       # Environment variables
├── .gitignore                 # Git ignore file
├── hardhat.config.js          # Hardhat configuration
├── package.json               # Node.js dependencies
└── README.md                  # Project documentation
```

## Key Technical Innovations

1. **Integrated Cross-Layer Security**
   - Leveraging IOTA's dual-layer architecture for enhanced security
   - Secure cross-layer messaging using zero-knowledge proofs
   - Privacy-preserving communication between EVM and Move layers

2. **AI-Enhanced DeFi**
   - Advanced machine learning for risk assessment
   - Reinforcement learning for interest rate optimization
   - Time-series prediction for early warning signals
   - Privacy-preserving AI scoring

3. **Cross-Chain Liquidity Optimization**
   - AI-driven yield optimization across chains
   - Risk-adjusted liquidity allocation
   - Automated rebalancing based on market conditions
   - Unified liquidity pool across blockchain networks

4. **Privacy-Preserving Credit System**
   - Zero-knowledge proofs for credit scoring
   - Private identity verification
   - Selective disclosure of verified claims
   - Anonymous but verifiable risk assessment

## Future Enhancements

1. **Enhanced AI Models**
   - Integration with more data sources
   - Federated learning for privacy-preserving training
   - Advanced fraud detection
   - Economic simulation-based risk assessment

2. **Expanded Cross-Chain Support**
   - Integration with additional blockchain networks
   - Cross-chain collateralization
   - Chain-agnostic lending pools
   - Multi-chain yield optimization

3. **Governance and Tokenomics**
   - DAO-based governance model
   - Dynamic protocol parameters
   - Incentivized risk assessment
   - Token-based governance voting

4. **Advanced User Features**
   - Personalized lending strategies
   - Portfolio diversification tools
   - Risk hedging mechanisms
   - Credit score improvement recommendations

## Contributing

We welcome contributions from the community! Please check out our [Contribution Guidelines](./CONTRIBUTING.md) to get started.

## License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.

## Acknowledgements

This project was created for the IOTA DefAI Hackathon 2023. We'd like to thank the IOTA Foundation for their support and the opportunity to build on the IOTA ecosystem.

## Team

- Daniel Johnson - Smart Contract Developer
- Ana Garcia - AI/ML Engineer
- Michael Chen - Frontend Developer
- Sarah Parker - Move Developer
- Robert Kim - Product Designer

## Contact

For any questions or feedback, please reach out to team@intellilend.io or join our Discord community.
