# IntelliLend Deployment Guide

This guide provides steps to deploy and run the IntelliLend DeFi lending platform.

## Project Structure

- `abis/`: Smart contract ABIs
- `frontend/`: React frontend application
- `backend/`: Backend server
- `smart-contracts/`: Solidity smart contracts

## Fixes Applied

1. Fixed import paths in `Web3Context.js`:
   - Updated paths from `../../abis/LendingPool.json` to `../abis/LendingPool.json`

2. Added missing icon imports in `IdentityPage.js`:
   - Added Assessment, TrendingDown, TrendingUp, and AccountBalanceWallet to imports

3. Fixed `PortfolioPage.js` issues:
   - Added LinearProgress to @mui/material imports
   - Reordered imports to ensure all imports are at the top of the file

4. Modified Web3Provider to provide mock data for development:
   - Allows app to work without wallet connection in development

## Running the Frontend

1. Start the frontend server:
   ```
   node start-frontend.js
   ```

2. Access the application at:
   ```
   http://localhost:3000
   ```

## Development Notes

- For production, update the mock Web3Provider in `frontend/src/context/Web3Context.js` to use real wallet connections
- Configure API endpoints in `frontend/src/services/apiService.js`
- Update smart contract addresses in environment variables

## Troubleshooting

If you encounter "address already in use" errors when starting the server:

1. Find processes using port 3000:
   ```
   netstat -ano | findstr :3000
   ```

2. Kill the processes:
   ```
   taskkill /PID <PID> /F
   ```

## Deploying to Production

1. Build the frontend:
   ```
   cd frontend
   npm run build
   ```

2. Deploy the backend:
   ```
   node deploy-backend.js
   ```

3. Deploy the frontend:
   ```
   node deploy-frontend.js
   ```
