import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { CssBaseline, Box } from '@mui/material';
import Header from './components/layout/Header';
import Footer from './components/layout/Footer';
import NetworkIndicator from './components/ui/NetworkIndicator';
import Dashboard from './pages/Dashboard';
import DepositPage from './pages/DepositPage';
import BorrowPage from './pages/BorrowPage';
import IdentityPage from './pages/EnhancedIdentityPage';
import RiskAssessmentPage from './pages/RiskAssessmentPage';
import PortfolioPage from './pages/PortfolioPage';
import SettingsPage from './pages/SettingsPage';
import LandingPage from './pages/LandingPage';
import NotFound from './pages/NotFound';
import MessagingPage from './pages/MessagingPage';
import CrossLayerPage from './pages/CrossLayerPage';
import SwapPage from './pages/SwapPage';
import StakingPage from './pages/StakingPage';
import LiquidationAlertsPage from './pages/LiquidationAlertsPage';
import TransactionHistoryPage from './pages/TransactionHistoryPage';
import ExplainableAIPage from './pages/ExplainableAIPage';
import LoadingBackdrop from './components/ui/LoadingBackdrop';
import { IoTAProvider } from './context/IoTAContext';
import { ThemeProvider } from './context/ThemeContext';
import { SnackbarProvider } from './context/SnackbarContext';
import { Web3Provider } from './context/Web3Context';
// Import IOTA dApp Kit
import { IotaProvider, WalletProvider } from '@iota/dapp-kit';

function App() {
  // DEVELOPMENT MODE: No authentication required, all routes accessible
  console.log("⚠️ DEV MODE: Authentication bypassed, all routes accessible");

  // Get environment specific configuration
  const isDevEnv = process.env.NODE_ENV === 'development';
  const network = process.env.REACT_APP_IOTA_NETWORK || 'testnet';

  // IOTA dApp Kit configuration with enhanced error handling and wallet support
  const iotaConfig = {
    network: network, // Use configured network, defaulting to testnet
    wallets: ['firefly', 'tanglepay', 'bloom'], // Support multiple wallet types
    autoConnect: false, // Don't auto-connect, let user choose when to connect
    onError: (error) => {
      console.error('IOTA dApp Kit error:', error);
      
      // Provide more user-friendly error messages
      if (error.message && error.message.includes('wallet not found')) {
        console.warn('Please install the Firefly, TanglePay, or Bloom wallet extension');
      } else if (error.message && error.message.includes('user rejected')) {
        console.warn('Connection request was rejected by the user');
      } else if (error.message && error.message.includes('timeout')) {
        console.warn('Wallet connection timed out. Please try again.');
      }
    }
  };

  return (
    <ThemeProvider>
      <SnackbarProvider>
        <Web3Provider>
          {/* Add IOTA dApp Kit providers with enhanced configuration */}
          <IotaProvider config={iotaConfig}>
            <WalletProvider>
              <IoTAProvider>
                <CssBaseline />
                <div className="app-container">
                  <Header />
                  {/* Add network indicator for better environment awareness */}
                  <NetworkIndicator 
                    network={network} 
                    isDevEnv={isDevEnv} 
                  />
                  <Box className="content-wrapper">
                    <Routes>
                      {/* Public routes */}
                      <Route path="/" element={<LandingPage />} />
                      
                      {/* All routes directly accessible for development */}
                      <Route path="/dashboard" element={<Dashboard />} />
                      <Route path="/deposit" element={<DepositPage />} />
                      <Route path="/borrow" element={<BorrowPage />} />
                      <Route path="/identity" element={<IdentityPage />} />
                      <Route path="/risk" element={<RiskAssessmentPage />} />
                      <Route path="/portfolio" element={<PortfolioPage />} />
                      <Route path="/settings" element={<SettingsPage />} />
                      <Route path="/messaging" element={<MessagingPage />} />
                      <Route path="/cross-layer" element={<CrossLayerPage />} />
                      <Route path="/swap" element={<SwapPage />} />
                      <Route path="/staking" element={<StakingPage />} />
                      <Route path="/liquidation-alerts" element={<LiquidationAlertsPage />} />
                      <Route path="/transactions" element={<TransactionHistoryPage />} />
                      <Route path="/ai-dashboard" element={<ExplainableAIPage />} />
                      
                      {/* 404 route */}
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </Box>
                  <Footer />
                  <LoadingBackdrop />
                </div>
              </IoTAProvider>
            </WalletProvider>
          </IotaProvider>
        </Web3Provider>
      </SnackbarProvider>
    </ThemeProvider>
  );
}

export default App;
