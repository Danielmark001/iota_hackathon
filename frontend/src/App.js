import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, alpha } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import Typography from '@mui/material/Typography';
import { SnackbarProvider } from './context/SnackbarContext';
import { Web3Provider } from './context/Web3Context';
import { IoTAProvider } from './context/IoTAContext';
import { AppThemeProvider, useAppTheme } from './context/ThemeContext';
import Header from './components/layout/Header';
import Sidebar from './components/layout/Sidebar';
import Footer from './components/layout/Footer';
import Dashboard from './pages/Dashboard';
import Deposit from './pages/Deposit';
import Borrow from './pages/Borrow';
import Portfolio from './pages/Portfolio';
import Wallet from './pages/Wallet';
import Identity from './pages/Identity';
import Risk from './pages/Risk';
import CrossLayer from './pages/CrossLayer';
import Settings from './pages/Settings';
import Staking from './pages/Staking';
import Transactions from './pages/Transactions';
import Liquidation from './pages/Liquidation';
import AIInsights from './pages/AIInsights';
import ContractVerification from './pages/ContractVerification';
import ExplainableAIPage from './pages/ExplainableAIPage';
import NotFound from './pages/NotFound';
import { Box, CircularProgress, Container } from '@mui/material';
import { getTheme } from './config/theme';

// Main layout component with theme selection and improved animations
const MainLayout = ({ children }) => {
  const { mode } = useAppTheme();
  const theme = getTheme(mode);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Simulate loading assets and resources
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 1000);
    
    return () => clearTimeout(timer);
  }, []);

  if (isLoading) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: '100vh',
            background: theme.palette.mode === 'dark' 
              ? 'linear-gradient(135deg, #121F35 0%, #1A2B45 100%)' 
              : 'linear-gradient(135deg, #F9FAFB 0%, #FFFFFF 100%)',
            position: 'relative',
            overflow: 'hidden',
            '&::before': {
              content: '""',
              position: 'absolute',
              top: '-50%',
              left: '-50%',
              right: '-50%',
              bottom: '-50%',
              background: 'radial-gradient(circle, rgba(0, 191, 165, 0.05) 0%, rgba(76, 63, 145, 0.05) 50%, rgba(0, 0, 0, 0) 70%)',
              animation: 'rotate 30s linear infinite',
              '@keyframes rotate': {
                '0%': { transform: 'rotate(0deg)' },
                '100%': { transform: 'rotate(360deg)' },
              },
              pointerEvents: 'none',
            },
          }}
        >
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 2,
              position: 'relative',
              zIndex: 2,
            }}
          >
            <Box 
              component="img" 
              src="/assets/iota-logo-icon.svg"
              alt="IOTA Logo" 
              sx={{ 
                width: 80, 
                height: 80,
                filter: theme.palette.mode === 'dark' ? 'brightness(1.8)' : 'none',
                animation: 'pulse 1.5s infinite ease-in-out',
                '@keyframes pulse': {
                  '0%': { transform: 'scale(1)' },
                  '50%': { transform: 'scale(1.1)' },
                  '100%': { transform: 'scale(1)' },
                },
              }} 
            />
            <Box sx={{ position: 'relative' }}>
              <CircularProgress
                size={48}
                thickness={3}
                sx={{
                  color: alpha(theme.palette.primary.main, 0.3),
                }}
              />
              <CircularProgress
                size={48}
                thickness={3}
                sx={{
                  color: theme.palette.primary.main,
                  position: 'absolute',
                  left: 0,
                  animationDuration: '2s',
                }}
              />
            </Box>
            <Typography 
              variant="body1" 
              sx={{ 
                mt: 2, 
                fontWeight: 500,
                background: 'linear-gradient(90deg, #4C3F91 0%, #00BFA5 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              Loading IntelliLend...
            </Typography>
          </Box>
        </Box>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box
        sx={{
          display: 'flex',
          minHeight: '100vh',
          background: theme.palette.mode === 'dark' 
            ? 'linear-gradient(135deg, #121F35 0%, #1A2B45 100%)' 
            : 'linear-gradient(135deg, #F9FAFB 0%, #FFFFFF 100%)',
          position: 'relative',
          '&::before': theme.palette.mode === 'dark' ? {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '30%',
            background: 'radial-gradient(circle at top right, rgba(0, 191, 165, 0.08) 0%, rgba(0, 0, 0, 0) 70%)',
            pointerEvents: 'none',
          } : {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '30%',
            background: 'radial-gradient(circle at top right, rgba(76, 63, 145, 0.06) 0%, rgba(255, 255, 255, 0) 70%)',
            pointerEvents: 'none',
          },
        }}
      >
        <Sidebar />
        <Box
          component="main"
          sx={{
            flexGrow: 1,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            position: 'relative',
            transition: 'all 0.3s ease',
          }}
        >
          <Header />
          <Container
            maxWidth="xl"
            sx={{
              flexGrow: 1,
              py: 3,
              px: { xs: 2, md: 3 },
              overflow: 'auto',
              position: 'relative',
              zIndex: 1,
              animation: 'fadeIn 0.5s ease-out',
              '@keyframes fadeIn': {
                '0%': { opacity: 0, transform: 'translateY(10px)' },
                '100%': { opacity: 1, transform: 'translateY(0)' },
              },
            }}
          >
            {children}
          </Container>
          <Footer />
        </Box>
      </Box>
    </ThemeProvider>
  );
};

function App() {
  return (
    <AppThemeProvider>
      <SnackbarProvider>
        <Web3Provider>
          <IoTAProvider>
            <Routes>
              <Route
                path="/"
                element={<Navigate to="/dashboard" replace />}
              />
              <Route
                path="/dashboard"
                element={
                  <MainLayout>
                    <Dashboard />
                  </MainLayout>
                }
              />
              <Route
                path="/deposit"
                element={
                  <MainLayout>
                    <Deposit />
                  </MainLayout>
                }
              />
              <Route
                path="/borrow"
                element={
                  <MainLayout>
                    <Borrow />
                  </MainLayout>
                }
              />
              <Route
                path="/portfolio"
                element={
                  <MainLayout>
                    <Portfolio />
                  </MainLayout>
                }
              />
              <Route
                path="/wallet"
                element={
                  <MainLayout>
                    <Wallet />
                  </MainLayout>
                }
              />
              <Route
                path="/identity"
                element={
                  <MainLayout>
                    <Identity />
                  </MainLayout>
                }
              />
              <Route
                path="/risk"
                element={
                  <MainLayout>
                    <Risk />
                  </MainLayout>
                }
              />
              <Route
                path="/cross-layer"
                element={
                  <MainLayout>
                    <CrossLayer />
                  </MainLayout>
                }
              />
              <Route
                path="/settings"
                element={
                  <MainLayout>
                    <Settings />
                  </MainLayout>
                }
              />
              <Route
                path="/staking"
                element={
                  <MainLayout>
                    <Staking />
                  </MainLayout>
                }
              />
              <Route
                path="/transactions"
                element={
                  <MainLayout>
                    <Transactions />
                  </MainLayout>
                }
              />
              <Route
                path="/liquidation-alerts"
                element={
                  <MainLayout>
                    <Liquidation />
                  </MainLayout>
                }
              />
              <Route
                path="/ai-dashboard"
                element={
                  <MainLayout>
                    <AIInsights />
                  </MainLayout>
                }
              />
              <Route
                path="/contract-verification"
                element={
                  <MainLayout>
                    <ContractVerification />
                  </MainLayout>
                }
              />
              {/* New route for Explainable AI */}
              <Route
                path="/explainable-ai"
                element={
                  <MainLayout>
                    <ExplainableAIPage />
                  </MainLayout>
                }
              />
              {/* Catch all for 404 */}
              <Route
                path="*"
                element={
                  <MainLayout>
                    <NotFound />
                  </MainLayout>
                }
              />
            </Routes>
          </IoTAProvider>
        </Web3Provider>
      </SnackbarProvider>
    </AppThemeProvider>
  );
}

export default App;