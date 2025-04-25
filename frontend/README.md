# IntelliLend Frontend

This is the frontend application for IntelliLend, an AI-Powered DeFi Lending Platform on IOTA.

## Overview

The IntelliLend frontend is a React-based web application that allows users to:

- View portfolio and market data
- Deposit assets to earn interest
- Borrow assets against collateral
- Verify identity using zero-knowledge proofs
- View AI-powered risk assessments
- Receive personalized recommendations

## Technology Stack

- React 18
- Material UI 5
- Ethers.js 5
- React Router 6
- Chart.js
- Axios

## Project Structure

```
frontend/
├── public/              # Public assets
├── src/                 # Source code
│   ├── assets/          # Images, icons, etc.
│   ├── components/      # Reusable components
│   │   ├── dashboard/   # Dashboard-specific components
│   │   ├── forms/       # Form components
│   │   ├── layout/      # Layout components
│   │   └── ui/          # UI components
│   ├── context/         # React context providers
│   ├── pages/           # Page components
│   ├── services/        # API services
│   └── utils/           # Utility functions
├── .env                 # Environment variables
└── package.json         # Dependencies
```

## Getting Started

1. Install dependencies:

```bash
npm install
```

2. Start the development server:

```bash
npm start
```

3. Build for production:

```bash
npm run build
```

## Main Features

### AI Risk Assessment

The frontend integrates with the IntelliLend AI model to display risk assessments and personalized recommendations for users.

### Zero-Knowledge Identity Verification

Users can verify their identity without exposing personal data using zero-knowledge proofs.

### Cross-Chain Liquidity

Visualization and management of liquidity across multiple chains through IOTA's cross-chain capabilities.

### Dual-Layer Architecture

Interfaces with both IOTA's Layer 1 (Move) and Layer 2 (IOTA EVM) for enhanced security and efficiency.

## UI Components

- **Dashboard**: Overview of user's portfolio, risk assessment, and market data
- **Deposit Page**: Supply assets to earn interest
- **Borrow Page**: Borrow assets against collateral
- **Identity Page**: Verify identity using zero-knowledge proofs
- **Risk Assessment Page**: Detailed view of AI risk assessment
- **Portfolio Page**: Manage supplied and borrowed assets
- **Settings Page**: Configure app preferences

## Environment Variables

The frontend requires the following environment variables:

- `REACT_APP_API_URL`: Backend API URL
- `REACT_APP_IOTA_EVM_RPC_URL`: IOTA EVM RPC URL
- `REACT_APP_CHAIN_ID`: IOTA EVM Chain ID

## Design Principles

1. **User-centric**: Simple, intuitive interface for both DeFi beginners and experts
2. **Transparency**: Clear visualization of AI-powered decisions
3. **Privacy-first**: Zero-knowledge proofs for identity verification
4. **Responsive**: Works on desktop and mobile devices
5. **Accessible**: Follows WAI-ARIA guidelines for accessibility

## Contributing

See the project [CONTRIBUTING.md](../CONTRIBUTING.md) file for contribution guidelines.
