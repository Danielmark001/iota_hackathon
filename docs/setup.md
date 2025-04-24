# IntelliLend Project Setup Guide

This guide will help you set up and run the IntelliLend project for the IOTA hackathon.

## Prerequisites

- Node.js (v14 or later)
- Python (v3.8 or later)
- IOTA CLI tools
- Git

## Project Structure

The project consists of the following components:

- Smart Contracts (EVM and Move)
- AI Risk Assessment Model
- Backend API Server
- Frontend Web Application

## Installation Steps

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/intellilend.git
cd intellilend
```

### 2. Install Dependencies

#### Backend

```bash
# In the project root
npm install

# Install Python dependencies for the AI model
cd ai-model
pip install -r requirements.txt
cd ..
```

#### Frontend

```bash
cd frontend
npm install
cd ..
```

### 3. Environment Setup

Create a `.env` file in the project root:

```
PORT=3001
IOTA_EVM_RPC_URL=https://evm-test.iota.org:443
PRIVATE_KEY=your_private_key_here
LENDING_POOL_ADDRESS=deployed_contract_address
```

### 4. Deploy Smart Contracts

#### EVM Smart Contracts

1. Compile the Solidity contracts:

```bash
cd smart-contracts/evm
npx hardhat compile
```

2. Deploy to IOTA EVM Testnet:

```bash
npx hardhat run scripts/deploy.js --network iotaTestnet
```

#### Move Smart Contracts

1. Compile the Move contracts:

```bash
cd smart-contracts/move
iota move compile
```

2. Deploy to IOTA Testnet:

```bash
iota move publish
```

### 5. Train the AI Model

```bash
cd ai-model
python risk_model.py
```

This will train the model and save it to `risk_model.joblib`.

### 6. Start the Backend Server

```bash
# In the project root
npm run start:server
```

The server will start on port 3001 (or the port specified in your .env file).

### 7. Start the Frontend Application

```bash
cd frontend
npm start
```

The frontend will start on port 3000 and open in your default browser.

## Testing

### Smart Contract Tests

```bash
cd smart-contracts/evm
npx hardhat test
```

### AI Model Tests

```bash
cd ai-model
python test_model.py
```

### Backend API Tests

```bash
# In the project root
npm test
```

## Deployment to IOTA Testnet

1. Ensure you have IOTA testnet tokens in your wallet.
2. Deploy the smart contracts as described in step 4.
3. Update the contract addresses in your `.env` file.
4. Deploy the backend to your preferred hosting service.
5. Deploy the frontend to your preferred hosting service.

## Resources

- [IOTA Documentation](https://docs.iota.org/)
- [IOTA EVM Documentation](https://evm.iota.org/)
- [Move Programming Language Guide](https://docs.iota.org/developer/iota-101/move-overview/)
- [IOTA Developer Discord](https://discord.gg/iota-builders)

## Troubleshooting

If you encounter any issues during setup or deployment, please check the following:

1. Ensure you have the correct versions of Node.js and Python installed.
2. Verify that your IOTA EVM RPC URL is correct and accessible.
3. Make sure you have sufficient testnet tokens for deployment.
4. Check that all environment variables are set correctly.

For additional help, please reach out on the IOTA Developer Discord.
