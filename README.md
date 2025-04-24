# IntelliLend - AI-Powered DeFi Lending Platform on IOTA

![IntelliLend Logo](./docs/images/logo.png)

IntelliLend is an intelligent lending protocol that leverages IOTA's unique dual-layer architecture and AI to revolutionize DeFi lending. It uses machine learning to assess borrower risk, optimize interest rates, and enhance the security and efficiency of lending operations.

## Features

- **AI Risk Assessment**: Advanced machine learning model evaluates borrower risk based on on-chain activity
- **Dual-Layer Security**: Leverages IOTA's unique architecture for secure asset representation
- **Dynamic Interest Rates**: Personalized rates based on risk scoring and market conditions
- **Cross-Layer Communication**: Seamless integration between EVM (Layer 2) and Move (Layer 1)
- **Privacy-Preserving Credit Scoring**: Get accurate risk assessments without compromising privacy

## Project Components

### Smart Contract Infrastructure
- Lending pools on IOTA EVM using Solidity
- Collateral management, loan issuance, and liquidation mechanisms
- Secure asset representation on Layer 1 using Move's object-centric model
- Cross-layer communication for enhanced security and efficiency

### AI Risk Assessment Engine
- Machine learning model to assess borrower risk based on on-chain activity
- Transaction pattern analysis, wallet history, and repayment behavior
- Dynamic interest rate model that adjusts based on risk scores
- Early warning systems for potential defaults

### Privacy-Preserving Identity Integration
- IOTA's identity framework for secure user verification
- Privacy-preserving credit scoring
- Zero-knowledge proofs for sharing necessary data without compromising privacy

### Cross-Chain Liquidity Module
- IOTA's cross-chain capabilities for liquidity aggregation
- AI to optimize capital efficiency across different pools and platforms
- Automated strategies for yield optimization

### User Interface
- Intuitive dashboard for borrowers and lenders
- Personalized risk assessments and recommendations
- Visualizations of lending activity and market conditions
- Transparency into how AI influences lending decisions

## Setup Instructions

### Prerequisites

- Node.js (v14+)
- Python (v3.8+)
- IOTA EVM-compatible wallet with IOTA tokens
- Git

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/intellilend.git
   cd intellilend
   ```

2. Run the setup script:
   ```bash
   node scripts/setup.js
   ```

   This will:
   - Install dependencies for all components
   - Create default configuration files
   - Set up the environment
   - Train the AI model with simulated data

3. Configure your environment:
   - Edit the `.env` file with your specific settings
   - Add your wallet private key (for development only)
   - Configure IOTA EVM RPC URLs

### Smart Contract Deployment

Deploy the smart contracts to the IOTA EVM network:

```bash
node scripts/deploy-contracts.js
```

This will:
- Deploy the CrossLayerBridge contract
- Deploy the LendingPool contract
- Update your `.env` file with the contract addresses

### Starting the Services

1. Start the backend API:
   ```bash
   npm run start:backend
   ```

2. Start the AI model API:
   ```bash
   npm run start:ai
   ```

3. Start the frontend:
   ```bash
   npm run start:frontend
   ```

4. Access the application at http://localhost:3000

## Project Structure

- `/smart-contracts`: Smart contract code (EVM and Move)
  - `/evm`: Solidity contracts for IOTA EVM (Layer 2)
  - `/move`: Move language modules for IOTA Layer 1
  - `/bridge`: Cross-layer bridge implementation
- `/ai-model`: AI/ML models for risk assessment
  - `/api`: Flask API for the risk model
  - `/data-processing`: Data processing utilities
  - `/models`: Trained model storage
- `/frontend`: React.js web interface
- `/backend`: Node.js API services
- `/docs`: Documentation
- `/scripts`: Deployment and setup scripts

## Development Guide

### Working with the Move Layer

1. Update the Move modules in `smart-contracts/move/`
2. Test changes with the Move SDK
3. Deploy to IOTA Layer 1

### Working with the EVM Layer

1. Modify Solidity contracts in `smart-contracts/evm/`
2. Test with Hardhat or Truffle
3. Deploy to IOTA EVM using the deployment script

### Enhancing the AI Model

1. Update the model in `ai-model/risk_model.py`
2. Add new features for improved risk assessment
3. Retrain the model with real or simulated data
4. Update the API endpoints as needed

### Frontend Development

1. Modify React components in `frontend/src/`
2. Test changes locally
3. Ensure UI integration with backend and blockchain

## Testing

Run unit tests for all components:

```bash
npm test
```

### Testing Smart Contracts

```bash
cd smart-contracts
npm run test
```

### Testing the AI Model

```bash
cd ai-model
python -m unittest discover tests
```

### Testing the Backend

```bash
cd backend
npm test
```

## Resources

- IOTA Documentation: https://docs.iota.org/
- IOTA EVM: https://evm.iota.org/
- Developer Discord: https://discord.gg/iota-builders
- Tutorials: https://docs.iota.org/developer/getting-started

## License

MIT

## Acknowledgements

This project was created for the IOTA DefAI Hackathon 2023.