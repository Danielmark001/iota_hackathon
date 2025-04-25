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

function App() {
  // DEVELOPMENT MODE: No authentication required, all routes accessible
  console.log("⚠️ DEV MODE: Authentication bypassed, all routes accessible");

  // Direct component rendering for development
  return (
    <>
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
      </div>
    </>
  );
}

export default App;
