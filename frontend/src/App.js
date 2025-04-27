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
import { createNetworkConfig, IotaClientProvider, WalletProvider } from '@iota/dapp-kit';
import { getFullnodeUrl } from '@iota/iota-sdk/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
// Import required CSS for dApp Kit components
import '@iota/dapp-kit/dist/index.css';

function App() {
  // DEVELOPMENT MODE: No authentication required, all routes accessible
  console.log("⚠️ DEV MODE: Authentication bypassed, all routes accessible");

  // Get environment specific configuration
  const isDevEnv = process.env.NODE_ENV === 'development';
  const network = process.env.REACT_APP_IOTA_NETWORK || 'testnet';

  // Create QueryClient for React Query
  const queryClient = new QueryClient();

  // Create network configuration for IOTA Client
  const { networkConfig } = createNetworkConfig({
    testnet: {
      url: getFullnodeUrl('testnet')
    },
    devnet: {
      url: getFullnodeUrl('testnet') // Fallback to testnet URL for devnet
    }
  });

  return (
    <ThemeProvider>
      <SnackbarProvider>
        <Web3Provider>
          {/* Add IOTA dApp Kit providers with correct configuration */}
          <QueryClientProvider client={queryClient}>
            <IotaClientProvider networks={networkConfig} defaultNetwork="testnet">
              <WalletProvider autoConnect={false}>
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
            </IotaClientProvider>
          </QueryClientProvider>
        </Web3Provider>
      </SnackbarProvider>
    </ThemeProvider>
  );
}

export default App;
