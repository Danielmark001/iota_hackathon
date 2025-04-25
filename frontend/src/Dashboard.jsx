import React, { useState, useEffect } from 'react';
import { styled } from '@mui/material/styles';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Grid from '@mui/material/Grid';
import CircularProgress from '@mui/material/CircularProgress';
import Container from '@mui/material/Container';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardHeader from '@mui/material/CardHeader';
import Button from '@mui/material/Button';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Alert from '@mui/material/Alert';
import Snackbar from '@mui/material/Snackbar';

// Import our services
import apiService from './services/api';
import iotaService from './services/iota';

const Item = styled(Paper)(({ theme }) => ({
  backgroundColor: theme.palette.mode === 'dark' ? '#1A2027' : '#fff',
  ...theme.typography.body2,
  padding: theme.spacing(2),
  textAlign: 'center',
  color: theme.palette.text.secondary,
}));

export default function Dashboard() {
  // State variables
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [userAddress, setUserAddress] = useState('');
  const [userData, setUserData] = useState(null);
  const [marketData, setMarketData] = useState(null);
  const [nodeHealth, setNodeHealth] = useState(false);
  const [apiHealth, setApiHealth] = useState(false);
  const [notification, setNotification] = useState({ open: false, message: '', severity: 'info' });

  // Check API and node health on load
  useEffect(() => {
    const checkHealth = async () => {
      try {
        // Check API health
        const apiHealthStatus = await apiService.checkApiHealth();
        setApiHealth(apiHealthStatus);

        // Check IOTA node health
        const nodeHealthStatus = await iotaService.checkNodeHealth();
        setNodeHealth(nodeHealthStatus);

        // Load market data
        if (apiHealthStatus) {
          const market = await apiService.getMarketData();
          setMarketData(market);
        } else {
          // Fallback to mock data if API is not available
          setMarketData({
            totalDeposits: 500000,
            totalBorrows: 350000,
            totalCollateral: 750000,
            utilizationRate: 70
          });
        }

        setLoading(false);
      } catch (error) {
        console.error('Error checking health:', error);
        setLoading(false);
        
        // Use mock data as fallback
        setMarketData({
          totalDeposits: 500000,
          totalBorrows: 350000,
          totalCollateral: 750000,
          utilizationRate: 70
        });
        
        // Show error notification
        setNotification({
          open: true,
          message: 'Failed to connect to services. Using demo mode.',
          severity: 'warning'
        });
      }
    };

    checkHealth();
  }, []);

  // Connect wallet and load user data
  const handleConnect = async () => {
    try {
      setLoading(true);
      
      // Connect IOTA wallet
      const wallet = await iotaService.connectWallet();
      setUserAddress(wallet.address);
      setConnected(true);

      // Try to get user data from API if healthy
      if (apiHealth) {
        try {
          const user = await apiService.getUserData(wallet.address);
          setUserData(user);
        } catch (error) {
          console.warn('Could not fetch user data from API, using simulated data');
          // Fallback to simulated data
          setUserData({
            deposits: 1000,
            borrows: 500,
            collateral: 2000,
            riskScore: 35,
            interestRate: 5.5,
            healthFactor: 3.32
          });
        }
      } else {
        // Use simulated data if API is not available
        setUserData({
          deposits: 1000,
          borrows: 500,
          collateral: 2000,
          riskScore: 35,
          interestRate: 5.5,
          healthFactor: 3.32
        });
      }

      setLoading(false);
      
      // Show success notification
      setNotification({
        open: true,
        message: 'Wallet connected successfully!',
        severity: 'success'
      });
    } catch (error) {
      console.error('Error connecting wallet:', error);
      setLoading(false);
      
      // Show error notification
      setNotification({
        open: true,
        message: 'Failed to connect wallet. Please try again.',
        severity: 'error'
      });
    }
  };

  // Handle deposit action
  const handleDeposit = async () => {
    setNotification({
      open: true,
      message: 'Deposit functionality coming soon!',
      severity: 'info'
    });
  };

  // Handle borrow action
  const handleBorrow = async () => {
    setNotification({
      open: true,
      message: 'Borrow functionality coming soon!',
      severity: 'info'
    });
  };

  // Handle notification close
  const handleCloseNotification = () => {
    setNotification({ ...notification, open: false });
  };

  // Display IOTA SDK info
  const handleLearnMore = () => {
    setNotification({
      open: true,
      message: `Connected to IOTA testnet: ${iotaService.IOTA_NODE_URL}`,
      severity: 'info'
    });
  };

  return (
    <Box sx={{ flexGrow: 1 }}>
      {/* App Bar */}
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            IntelliLend on IOTA
          </Typography>
          
          {/* Connection status indicators */}
          <Box sx={{ display: 'flex', alignItems: 'center', mr: 2 }}>
            <Box sx={{ 
              width: 10, 
              height: 10, 
              borderRadius: '50%', 
              bgcolor: apiHealth ? 'success.main' : 'error.main',
              mr: 1
            }} />
            <Typography variant="body2" sx={{ mr: 2 }}>
              API
            </Typography>
            
            <Box sx={{ 
              width: 10, 
              height: 10, 
              borderRadius: '50%', 
              bgcolor: nodeHealth ? 'success.main' : 'error.main',
              mr: 1
            }} />
            <Typography variant="body2" sx={{ mr: 2 }}>
              IOTA Node
            </Typography>
          </Box>
          
          {/* Connect wallet button */}
          {!connected ? (
            <Button 
              color="inherit" 
              onClick={handleConnect}
              disabled={loading}
            >
              Connect Wallet
            </Button>
          ) : (
            <Typography variant="body1">
              {userAddress.substring(0, 6)}...{userAddress.substring(userAddress.length - 4)}
            </Typography>
          )}
        </Toolbar>
      </AppBar>
      
      {/* Main content */}
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', my: 10 }}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            <Typography variant="h4" component="h1" gutterBottom>
              Dashboard
            </Typography>
            
            <Grid container spacing={3}>
              {/* Market Stats */}
              <Grid item xs={12}>
                <Card>
                  <CardHeader title="Market Overview" />
                  <CardContent>
                    <Grid container spacing={2}>
                      <Grid item xs={12} sm={3}>
                        <Item>
                          <Typography variant="h6" color="primary">
                            ${marketData.totalDeposits.toLocaleString()}
                          </Typography>
                          <Typography variant="body2">Total Deposits</Typography>
                        </Item>
                      </Grid>
                      <Grid item xs={12} sm={3}>
                        <Item>
                          <Typography variant="h6" color="secondary">
                            ${marketData.totalBorrows.toLocaleString()}
                          </Typography>
                          <Typography variant="body2">Total Borrows</Typography>
                        </Item>
                      </Grid>
                      <Grid item xs={12} sm={3}>
                        <Item>
                          <Typography variant="h6" color="success.main">
                            ${marketData.totalCollateral.toLocaleString()}
                          </Typography>
                          <Typography variant="body2">Total Collateral</Typography>
                        </Item>
                      </Grid>
                      <Grid item xs={12} sm={3}>
                        <Item>
                          <Typography variant="h6" color="info.main">
                            {marketData.utilizationRate}%
                          </Typography>
                          <Typography variant="body2">Utilization Rate</Typography>
                        </Item>
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>
              </Grid>
              
              {/* User Stats (if connected) */}
              {connected && userData && (
                <Grid item xs={12}>
                  <Card>
                    <CardHeader title="Your Position" />
                    <CardContent>
                      <Grid container spacing={2}>
                        <Grid item xs={12} sm={2}>
                          <Item>
                            <Typography variant="h6" color="primary">
                              ${userData.deposits}
                            </Typography>
                            <Typography variant="body2">Your Deposits</Typography>
                          </Item>
                        </Grid>
                        <Grid item xs={12} sm={2}>
                          <Item>
                            <Typography variant="h6" color="secondary">
                              ${userData.borrows}
                            </Typography>
                            <Typography variant="body2">Your Borrows</Typography>
                          </Item>
                        </Grid>
                        <Grid item xs={12} sm={2}>
                          <Item>
                            <Typography variant="h6" color="success.main">
                              ${userData.collateral}
                            </Typography>
                            <Typography variant="body2">Your Collateral</Typography>
                          </Item>
                        </Grid>
                        <Grid item xs={12} sm={2}>
                          <Item>
                            <Typography variant="h6" color="info.main">
                              {userData.riskScore}/100
                            </Typography>
                            <Typography variant="body2">Risk Score</Typography>
                          </Item>
                        </Grid>
                        <Grid item xs={12} sm={2}>
                          <Item>
                            <Typography variant="h6" color="warning.main">
                              {userData.interestRate}%
                            </Typography>
                            <Typography variant="body2">Interest Rate</Typography>
                          </Item>
                        </Grid>
                        <Grid item xs={12} sm={2}>
                          <Item>
                            <Typography variant="h6" color={userData.healthFactor >= 1.5 ? 'success.main' : 'error.main'}>
                              {userData.healthFactor.toFixed(2)}
                            </Typography>
                            <Typography variant="body2">Health Factor</Typography>
                          </Item>
                        </Grid>
                      </Grid>
                    </CardContent>
                  </Card>
                </Grid>
              )}
              
              {/* Actions */}
              <Grid item xs={12} md={6}>
                <Card>
                  <CardHeader title="Supply" />
                  <CardContent>
                    <Typography variant="body1" paragraph>
                      Supply assets to earn interest and use as collateral on the IOTA network.
                    </Typography>
                    <Button 
                      variant="contained" 
                      color="primary" 
                      disabled={!connected}
                      onClick={handleDeposit}
                    >
                      Supply
                    </Button>
                  </CardContent>
                </Card>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <Card>
                  <CardHeader title="Borrow" />
                  <CardContent>
                    <Typography variant="body1" paragraph>
                      Borrow assets with your supplied collateral using the IOTA network.
                    </Typography>
                    <Button 
                      variant="contained" 
                      color="secondary" 
                      disabled={!connected}
                      onClick={handleBorrow}
                    >
                      Borrow
                    </Button>
                  </CardContent>
                </Card>
              </Grid>
              
              {/* IOTA SDK Integration */}
              <Grid item xs={12}>
                <Card>
                  <CardHeader title="IOTA SDK Integration" />
                  <CardContent>
                    <Typography variant="body1" paragraph>
                      This platform uses IOTA SDK for native IOTA functionality, providing secure and efficient interactions with the IOTA network.
                      {nodeHealth && (
                        <span> Connected to the IOTA Testnet and ready for use.</span>
                      )}
                    </Typography>
                    <Button 
                      variant="outlined" 
                      color="primary"
                      onClick={handleLearnMore}
                    >
                      Learn More
                    </Button>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </>
        )}
        
        {/* Footer */}
        <Box mt={8}>
          <Typography variant="body2" color="text.secondary" align="center">
            © IntelliLend {new Date().getFullYear()} - Built on IOTA
          </Typography>
        </Box>
      </Container>
      
      {/* Notification Snackbar */}
      <Snackbar 
        open={notification.open} 
        autoHideDuration={6000} 
        onClose={handleCloseNotification}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert 
          onClose={handleCloseNotification} 
          severity={notification.severity}
          sx={{ width: '100%' }}
        >
          {notification.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
