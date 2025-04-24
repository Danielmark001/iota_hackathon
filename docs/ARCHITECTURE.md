# IntelliLend Architecture

IntelliLend is an AI-powered DeFi lending platform built on IOTA's unique dual-layer architecture. This document outlines the architecture, components, and integrations of the IntelliLend protocol.

## System Architecture

IntelliLend leverages IOTA's dual-layer architecture to create a secure, efficient, and intelligent lending protocol:

1. **Layer 1 (Move)**: Secure asset representation and identity
2. **Layer 2 (EVM)**: Lending operations and user interactions
3. **Cross-Layer Bridge**: Communication between Layer 1 and Layer 2
4. **AI Risk Assessment**: Machine learning for borrower risk evaluation
5. **Frontend**: User interface for borrowers and lenders

![Architecture Diagram](./images/architecture.png)

## Layer 1 (Move) Components

The first layer of IntelliLend uses Move programming language on IOTA's Layer 1 for secure asset representation:

### Asset Module

The `asset.move` module handles secure asset representation with the following features:

- Object-centric model for assets
- Risk score storage and management
- Cross-layer message processing
- Asset registry for tracking all platform assets

Key structures:
- `LendingAsset`: Represents a lending asset with risk score
- `CrossLayerMessage`: Handles messages from Layer 2
- `AssetRegistry`: Tracks all assets in the system

## Layer 2 (EVM) Components

The second layer uses IOTA EVM with Solidity smart contracts:

### LendingPool Contract

The main contract for lending operations:

- Deposit and borrow functionality
- Collateral management
- Liquidation mechanism
- Dynamic interest rate model based on risk scores
- Integration with the AI risk assessment system

### CrossLayerBridge Contract

Handles communication between Layer 2 and Layer 1:

- Message passing between EVM and Move
- Security and fee management
- Message tracking and status updates

## Cross-Layer Integration

The cross-layer communication is a key innovation in IntelliLend, allowing for:

1. **Enhanced Security**: Critical asset data is secured on Layer 1 using Move's object-centric model
2. **Operational Efficiency**: Lending operations and user interactions happen on the EVM-compatible Layer 2
3. **Data Integrity**: Message passing ensures consistency across layers

Message Types:
- `RISK_SCORE_UPDATE`: Updates risk scores based on AI assessment
- `COLLATERAL_CHANGE`: Notifies Layer 1 of collateral status changes
- `LIQUIDATION`: Handles liquidation events across layers

## AI Risk Assessment System

IntelliLend uses machine learning to assess borrower risk based on on-chain activity:

### Risk Model

The risk assessment model:
- Analyzes transaction patterns and wallet history
- Evaluates repayment behavior and collateral management
- Provides personalized risk scores (0-100)
- Generates dynamic interest rates based on risk

### AI API Service

Exposes the risk model through an API:
- `/predict`: Predicts risk score for a user
- `/batch-predict`: Processes multiple users
- `/importance`: Returns feature importance

### Blockchain Data Collection

Fetches on-chain data for the AI model:
- Transaction history and patterns
- Wallet activity and age
- DeFi interaction history
- Cross-chain activity

## Frontend Application

The React-based frontend provides:

- User dashboard with position overview
- Risk visualization and explanations
- AI-generated recommendations
- Market statistics and trends
- Cross-layer bridge visualization

## Setup and Deployment

### Environment Setup

1. IOTA node connection
2. Environment variables configuration
3. Smart contract deployment (EVM)
4. Move module deployment (Layer 1)
5. AI model training and deployment
6. Frontend deployment

### Cross-Layer Bridge Setup

To enable cross-layer communication:

1. Deploy the `CrossLayerBridge.sol` contract on IOTA EVM
2. Configure the bridge in the `LendingPool.sol` contract
3. Configure Move modules to receive messages from Layer 2
4. Run test scripts to validate communication

## Security Considerations

1. **Dual-Layer Security**: Critical assets are secured on Layer 1
2. **AI Risk Assessment**: Reduces systemic risk through intelligent scoring
3. **Bridge Security**: Message authentication and replay protection
4. **Privacy Considerations**: Zero-knowledge proofs for sharing necessary data

## Future Development

1. **Enhanced AI Models**: More sophisticated ML techniques
2. **Cross-Chain Integration**: Expanded liquidity sources
3. **Zero-Knowledge Proofs**: Advanced privacy features
4. **DAO Governance**: Community management of risk parameters

## Resources

- [IOTA Documentation](https://docs.iota.org/)
- [IOTA EVM](https://evm.iota.org/)
- [Move Documentation](https://move-book.com/)
