import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { CssBaseline, Box } from '@mui/material';
import Header from './components/layout/Header';
import Footer from './components/layout/Footer';
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
import ExplainableAIPage from './pages/ExplainableAIPage';
import ExplainableAIPage from './pages/ExplainableAIPage';
import ExplainableAIPage from './pages/ExplainableAIPage';
import ExplainableAIPage from './pages/ExplainableAIPage';
import ExplainableAIPage from './pages/ExplainableAIPage';
import ExplainableAIPage from './pages/ExplainableAIPage';
import ExplainableAIPage from './pages/ExplainableAIPage';
import ExplainableAIPage from './pages/ExplainableAIPage';
import ExplainableAIPage from './pages/ExplainableAIPage';
import ExplainableAIPage from './pages/ExplainableAIPage';
import ExplainableAIPage from './pages/ExplainableAIPage';
import ExplainableAIPage from './pages/ExplainableAIPage';
import ExplainableAIPage from './pages/ExplainableAIPage';
import ExplainableAIPage from './pages/ExplainableAIPage';
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

  // IOTA dApp Kit configuration
  const iotaConfig = {
    network: 'testnet', // Use testnet for development
    wallets: ['firefly'], // Allow Firefly wallet connection
    onError: (error) => console.error('IOTA dApp Kit error:', error)
  };

  // Direct component rendering for development
  return (
    <ThemeProvider>
      <SnackbarProvider>
        <Web3Provider>
          {/* Add IOTA dApp Kit providers */}
          <IotaProvider config={iotaConfig}>
            <WalletProvider>
              <IoTAProvider>
                <CssBaseline />
                <div className="app-container">
                  <Header />
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
