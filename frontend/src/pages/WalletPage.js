import React, { useState, useEffect } from 'react';
import { 
  Container, 
  Typography, 
  Box, 
  Grid, 
  Paper, 
  Divider, 
  Button,
  Card,
  CardContent,
  CardHeader,
  Tabs,
  Tab,
  Alert,
  CircularProgress,
  useTheme
} from '@mui/material';
import { 
  Send as SendIcon, 
  AccountBalanceWallet as WalletIcon,
  Refresh as RefreshIcon,
  LayersClear as ReceiveIcon,
  Sync as TransactionIcon,
  Shield as SecurityIcon
} from '@mui/icons-material';
import { useIoTA } from '../context/IoTAContext';
import { useSnackbar } from '../context/SnackbarContext';
import IoTAWallet from '../components/iota/IoTAWallet';
import IoTATransactions from '../components/iota/IoTATransactions';

// This will be our new tabbed interface for the wallet page
function TabPanel(props) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`wallet-tabpanel-${index}`}
      aria-labelledby={`wallet-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ py: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

const WalletPage = () => {
  const theme = useTheme();
  const { isConnected, address, balance, getBalance, initConnection, isConnecting } = useIoTA();
  const { showSnackbar } = useSnackbar();
  const [activeTab, setActiveTab] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Refresh balance periodically
  useEffect(() => {
    if (isConnected && address) {
      const refreshInterval = setInterval(() => {
        getBalance(address).catch(console.error);
      }, 30000); // refresh every 30 seconds
      
      return () => clearInterval(refreshInterval);
    }
  }, [isConnected, address, getBalance]);

  // Handle manual refresh
  const handleRefresh = async () => {
    if (!isConnected || isRefreshing) return;
    
    setIsRefreshing(true);
    try {
      await getBalance(address);
      showSnackbar('Balance updated successfully', 'success');
    } catch (error) {
      console.error('Error refreshing balance:', error);
      showSnackbar('Failed to refresh balance', 'error');
    } finally {
      setIsRefreshing(false);
    }
  };

  // Handle tab changes
  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  // Handle wallet connect
  const handleConnectWallet = () => {
    initConnection();
  };

  return (
    <Container maxWidth="xl">
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom sx={{ fontWeight: 'medium' }}>
          IOTA Wallet
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Manage your IOTA tokens, send transactions, and view your transaction history
        </Typography>
      </Box>

      {!isConnected ? (
        <Paper 
          sx={{ 
            p: 4, 
            textAlign: 'center',
            borderRadius: 2,
            bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)',
            border: `1px solid ${theme.palette.divider}`
          }}
        >
          <WalletIcon sx={{ fontSize: 60, color: 'primary.main', mb: 2, opacity: 0.7 }} />
          <Typography variant="h6" gutterBottom>
            Connect Your IOTA Wallet
          </Typography>
          <Typography variant="body1" color="text.secondary" paragraph sx={{ maxWidth: 500, mx: 'auto', mb: 3 }}>
            Connect your IOTA wallet to view your balance, send tokens, and manage your transactions. 
            We support connections to Firefly, TanglePay, and Bloom wallets.
          </Typography>
          <Button 
            variant="contained" 
            color="primary" 
            size="large"
            onClick={handleConnectWallet}
            disabled={isConnecting}
            startIcon={isConnecting ? <CircularProgress size={20} color="inherit" /> : <WalletIcon />}
            sx={{ borderRadius: 2, px: 3 }}
          >
            {isConnecting ? 'Connecting...' : 'Connect Wallet'}
          </Button>
        </Paper>
      ) : (
        <>
          {/* Wallet Overview Card */}
          <Grid container spacing={3}>
            <Grid item xs={12} md={4}>
              <Card 
                elevation={0} 
                sx={{ 
                  borderRadius: 2, 
                  overflow: 'hidden',
                  border: `1px solid ${theme.palette.divider}`,
                  height: '100%'
                }}
              >
                <CardHeader 
                  title="Wallet Overview" 
                  action={
                    <Button
                      startIcon={<RefreshIcon />}
                      size="small"
                      onClick={handleRefresh}
                      disabled={isRefreshing}
                    >
                      {isRefreshing ? 'Refreshing...' : 'Refresh'}
                    </Button>
                  }
                  sx={{ 
                    borderBottom: `1px solid ${theme.palette.divider}`,
                    '& .MuiCardHeader-title': {
                      fontSize: '1.1rem'
                    }
                  }}
                />
                <CardContent>
                  {/* Render the IoTAWallet component here */}
                  <IoTAWallet />
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={12} md={8}>
              <Card 
                elevation={0} 
                sx={{ 
                  borderRadius: 2, 
                  overflow: 'hidden',
                  border: `1px solid ${theme.palette.divider}`,
                  height: '100%'
                }}
              >
                <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                  <Tabs 
                    value={activeTab} 
                    onChange={handleTabChange} 
                    aria-label="wallet tabs"
                    sx={{
                      '& .MuiTab-root': {
                        fontSize: '0.875rem',
                        minHeight: 48,
                        px: 3
                      }
                    }}
                  >
                    <Tab label="Transactions" icon={<TransactionIcon />} iconPosition="start" />
                    <Tab label="Send" icon={<SendIcon />} iconPosition="start" />
                    <Tab label="Receive" icon={<ReceiveIcon />} iconPosition="start" />
                    <Tab label="Security" icon={<SecurityIcon />} iconPosition="start" />
                  </Tabs>
                </Box>
                
                <TabPanel value={activeTab} index={0}>
                  <IoTATransactions address={address} />
                </TabPanel>
                
                <TabPanel value={activeTab} index={1}>
                  <Box sx={{ maxWidth: 500, mx: 'auto' }}>
                    <Typography variant="h6" gutterBottom>
                      Send IOTA Tokens
                    </Typography>
                    <Typography variant="body2" color="text.secondary" paragraph>
                      Please use your connected wallet's interface to send tokens. This ensures maximum security for your transactions.
                    </Typography>
                    <Alert severity="info" sx={{ mb: 2 }}>
                      For security reasons, transactions should be initiated and confirmed through your official wallet application.
                    </Alert>
                    <Button
                      variant="contained"
                      color="primary"
                      startIcon={<SendIcon />}
                      fullWidth
                      sx={{ mb: 2, borderRadius: 2 }}
                      onClick={() => showSnackbar('Please use your connected wallet to send tokens', 'info')}
                    >
                      Open Wallet to Send
                    </Button>
                  </Box>
                </TabPanel>
                
                <TabPanel value={activeTab} index={2}>
                  <Box sx={{ maxWidth: 500, mx: 'auto', textAlign: 'center' }}>
                    <Typography variant="h6" gutterBottom>
                      Receive IOTA Tokens
                    </Typography>
                    <Paper 
                      elevation={0} 
                      sx={{ 
                        p: 3, 
                        mb: 3, 
                        borderRadius: 2,
                        border: `1px dashed ${theme.palette.divider}`,
                        bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.01)'
                      }}
                    >
                      <Typography 
                        variant="body2" 
                        component="div" 
                        sx={{ 
                          wordBreak: 'break-all', 
                          fontFamily: 'monospace',
                          fontSize: '0.9rem' 
                        }}
                      >
                        {address}
                      </Typography>
                    </Paper>
                    <Button
                      variant="outlined"
                      startIcon={<ReceiveIcon />}
                      onClick={() => {
                        navigator.clipboard.writeText(address);
                        showSnackbar('Address copied to clipboard', 'success');
                      }}
                    >
                      Copy Address
                    </Button>
                  </Box>
                </TabPanel>
                
                <TabPanel value={activeTab} index={3}>
                  <Box sx={{ maxWidth: 600, mx: 'auto' }}>
                    <Typography variant="h6" gutterBottom>
                      Wallet Security
                    </Typography>
                    
                    <Alert severity="warning" sx={{ mb: 3 }}>
                      Never share your seed phrase or private keys with anyone, including applications or websites claiming to be associated with IOTA.
                    </Alert>
                    
                    <Grid container spacing={2}>
                      <Grid item xs={12}>
                        <Paper sx={{ p: 2, borderRadius: 2 }}>
                          <Typography variant="subtitle1" gutterBottom>
                            Security Best Practices
                          </Typography>
                          <Divider sx={{ mb: 2 }} />
                          <Box component="ul" sx={{ pl: 2 }}>
                            <li>
                              <Typography variant="body2" paragraph>
                                Always verify transactions before confirming them. Check recipient addresses carefully.
                              </Typography>
                            </li>
                            <li>
                              <Typography variant="body2" paragraph>
                                Keep your wallet software updated to the latest version.
                              </Typography>
                            </li>
                            <li>
                              <Typography variant="body2" paragraph>
                                Consider using hardware wallets for storing large amounts of tokens.
                              </Typography>
                            </li>
                            <li>
                              <Typography variant="body2">
                                Be cautious with connection requests and only authorize trusted applications.
                              </Typography>
                            </li>
                          </Box>
                        </Paper>
                      </Grid>
                    </Grid>
                  </Box>
                </TabPanel>
              </Card>
            </Grid>
          </Grid>
        </>
      )}
    </Container>
  );
};

export default WalletPage;