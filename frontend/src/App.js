import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { CssBaseline, Box } from '@mui/material';
import Header from './components/layout/Header';
import Footer from './components/layout/Footer';
import Dashboard from './pages/Dashboard';
import DepositPage from './pages/DepositPage';
import BorrowPage from './pages/BorrowPage';
import IdentityPage from './pages/IdentityPage';
import RiskAssessmentPage from './pages/RiskAssessmentPage';
import PortfolioPage from './pages/PortfolioPage';
import SettingsPage from './pages/SettingsPage';
import LandingPage from './pages/LandingPage';
import NotFound from './pages/NotFound';
import LoadingBackdrop from './components/ui/LoadingBackdrop';
import { IoTAProvider } from './context/IoTAContext';
import { ThemeProvider } from './context/ThemeContext';
import { SnackbarProvider } from './context/SnackbarContext';
import { Web3Provider } from './context/Web3Context';

function App() {
  // DEVELOPMENT MODE: No authentication required, all routes accessible
  console.log("⚠️ DEV MODE: Authentication bypassed, all routes accessible");

  // Direct component rendering for development
  return (
    <ThemeProvider>
      <SnackbarProvider>
        <Web3Provider>
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
                  
                  {/* 404 route */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Box>
              <Footer />
              <LoadingBackdrop />
            </div>
          </IoTAProvider>
        </Web3Provider>
      </SnackbarProvider>
    </ThemeProvider>
  );
}

export default App;
