# IntelliLend: AI-Powered DeFi Lending Platform on IOTA

![IntelliLend Logo](docs/images/logo.png)

**Team:** [<img src="https://github.com/Danielmark001.png" height="20" width="20" /> Daniel Mark](https://github.com/Danielmark001) |
[<img src="https://github.com/WilliamN40.png" height="20" width="20" /> William Notowibowo](https://github.com/WilliamN40) |

**Docs:** 
[Project Report](https://github.com/Danielmark001/iota-hackathon/blob/main/uml%20diagram/uml-sequence-diagram.png) 

## 🏆 IOTA DefAI Hackathon Project

IntelliLend is an intelligent lending protocol that leverages IOTA's unique architecture and AI to revolutionize DeFi lending. The platform uses machine learning to assess borrower risk, optimize interest rates, and enhance the security and efficiency of lending operations across the IOTA ecosystem.

## 🔍 Project Overview

IntelliLend stands out by:

- **Utilizing IOTA's dual-layer architecture** for enhanced security and efficiency
- **Incorporating AI** to create dynamic, personalized lending experiences
- **Preserving user privacy** while providing accurate risk assessment
- **Optimizing capital efficiency** through cross-chain integration
- **Creating a more inclusive lending system** with sophisticated risk models beyond simple collateralization

## 🏗️ Architecture

IntelliLend leverages IOTA's unique dual-layer architecture:

### Layer 1: IOTA Mainnet (Move)
- Secure asset representation using Move's object-centric model
- Enhanced identity framework integration
- Robust security guarantees for collateral

### Layer 2: IOTA EVM
- Lending pool operations using Solidity
- AI risk assessment integration
- Cross-chain liquidity module
- Zero-knowledge identity verification

### Cross-Layer Communication
- Secure bridge between Layer 1 and Layer 2
- Real-time synchronization of critical data
- Enhanced security for lending operations

## 🧠 AI Integration

IntelliLend integrates advanced AI capabilities:

- **Risk Assessment Engine**: Machine learning models analyze on-chain activity to determine personalized risk scores
- **Default Prediction**: Time-series analysis to identify potential defaults before they occur
- **Interest Rate Optimization**: Reinforcement learning to optimize interest rates for both lenders and borrowers
- **Collateral Quality Analysis**: AI evaluation of collateral stability and quality

## 🔐 Privacy Features

- **Zero-Knowledge Identity Verification**: Prove identity without revealing sensitive information
- **Privacy-Preserving Credit Scoring**: Get credit assessments without exposing personal data
- **Secure On-Chain Reputation**: Build lending reputation without compromising privacy

## ⛓️ Cross-Chain Capabilities

- **Aggregate Liquidity**: Access liquidity from multiple chains through IOTA's cross-chain integration
- **Capital Optimization**: AI algorithms allocate capital for maximum efficiency and returns
- **Seamless Asset Transfer**: Move assets between chains without losing value

## 🚀 Getting Started

See the [QUICK-START.md](QUICK-START.md) file for detailed setup instructions.

### Prerequisites

- Node.js v16+
- npm v8+
- Python 3.8+ (for AI model)
- Git

### Quick Installation

```bash
# Clone repository
git clone https://github.com/yourusername/iota-hackathon.git
cd iota-hackathon

# Install dependencies
npm run install-all

# Configure environment
cp .env.example .env
# Edit .env with your settings

# Run demo
npm run demo
```

## 📊 Demo & Screenshots

### Interactive CLI Demo

Run our comprehensive demo to explore all features:

```bash
npm run demo
```

This will guide you through:
- AI risk assessment
- Privacy-preserving identity verification
- Cross-chain liquidity management
- Lending operations
- Yield strategy optimization

### Web Interface

![Dashboard Screenshot](docs/images/dashboard.png)

Our web interface provides a user-friendly way to interact with the protocol.

## 📁 Project Structure

```
intellilend/
├── smart-contracts/           # Smart contracts
│   ├── evm/                   # IOTA EVM contracts (Solidity)
│   ├── move/                  # IOTA Layer 1 assets (Move)
│   └── bridge/                # Cross-layer bridge contracts
├── ai-model/                  # Machine learning models
│   ├── models/                # Trained ML models
│   ├── data-processing/       # Data processing utilities
│   └── risk_model.py          # Main risk assessment model
├── backend/                   # API server and business logic
├── frontend/                  # React-based user interface
├── scripts/                   # Utility scripts and demos
├── docs/                      # Documentation
└── tests/                     # Test suites
```

## 🧪 Running Tests

```bash
npm test
```

## 📄 Documentation

For detailed documentation, see the [docs folder](docs/).

- [Technical Architecture](docs/architecture.md)
- [AI Model Documentation](docs/ai-model.md)
- [Smart Contract API](docs/smart-contracts.md)
- [Frontend Guide](docs/frontend-guide.md)

## 🔗 Resources

- [IOTA Documentation](https://docs.iota.org/)
- [IOTA EVM](https://evm.iota.org/)
- [Move Programming Language](https://docs.iota.org/shimmer/smart-contracts/guide/move/getting_started)
- [IOTA Identity Framework](https://wiki.iota.org/identity.rs/introduction)


## 📣 Feedback and Contributions

Feedback and contributions are welcome! Please feel free to submit a pull request or open an issue on GitHub.

## 📜 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
