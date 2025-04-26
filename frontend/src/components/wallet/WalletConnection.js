import React, { useState } from 'react';
import {
  Button,
  Typography,
  Box,
  CircularProgress,
  Paper,
  Divider,
  Chip,
  Alert,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid
} from '@mui/material';
import {
  AccountBalanceWallet,
  LinkOff,
  Check,
  Warning,
  Info,
  OpenInNew
} from '@mui/icons-material';

// Import IOTA context
import { useIoTA } from '../../context/IoTAContext';

/**
 * WalletConnection component
 * 
 * Allows users to connect to IOTA wallets like Firefly
 */
const WalletConnection = () => {
  const { 
    isConnected, 
    isConnecting, 
    address, 
    balance, 
    walletStatus,
    initConnection, 
    disconnectWallet,
    networkInfo
  } = useIoTA();
  
  const [dialogOpen, setDialogOpen] = useState(false);
  
  // Open wallet connection dialog
  const handleOpenDialog = () => {
    setDialogOpen(true);
  };
  
  // Close wallet connection dialog
  const handleCloseDialog = () => {
    setDialogOpen(false);
  };
  
  // Connect to wallet
  const handleConnectWallet = async () => {
    await initConnection();
    handleCloseDialog();
  };
  
  // Disconnect wallet
  const handleDisconnectWallet = async () => {
    await disconnectWallet();
  };
  
  // Render wallet button
  const renderWalletButton = () => {
    if (isConnected) {
      return (
        <Button
          variant="outlined"
          color="primary"
          onClick={handleOpenDialog}
          startIcon={<AccountBalanceWallet />}
          size="small"
        >
          {shortenAddress(address)}
        </Button>
      );
    }
    
    return (
      <Button
        variant="contained"
        color="primary"
        onClick={handleOpenDialog}
        startIcon={isConnecting ? <CircularProgress size={20} color="inherit" /> : <AccountBalanceWallet />}
        disabled={isConnecting}
      >
        Connect Wallet
      </Button>
    );
  };
  
  // Helper to shorten address for display
  const shortenAddress = (addr) => {
    if (!addr) return '';
    return addr.slice(0, 6) + '...' + addr.slice(-4);
  };
  
  // Format balance for display
  const formattedBalance = () => {
    if (!balance) return '0';
    return balance.baseCoinsFormatted || '0';
  };
  
  return (
    <>
      {renderWalletButton()}
      
      {/* Wallet Connection Dialog */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          IOTA Wallet Connection
        </DialogTitle>
        <DialogContent>
          {isConnected ? (
            <Box>
              <Alert severity="success" sx={{ mb: 2 }}>
                Wallet Connected
              </Alert>
              
              <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
                <Typography variant="subtitle2" color="text.secondary">
                  Connected Wallet
                </Typography>
                <Typography variant="h6">
                  {address}
                </Typography>
                
                <Divider sx={{ my: 2 }} />
                
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Typography variant="subtitle2" color="text.secondary">
                      Balance
                    </Typography>
                    <Typography variant="h6">
                      {formattedBalance()}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="subtitle2" color="text.secondary">
                      Network
                    </Typography>
                    <Chip 
                      label={networkInfo?.name || 'Testnet'} 
                      color="primary" 
                      size="small"
                    />
                  </Grid>
                </Grid>
              </Paper>
              
              <Typography variant="body2" color="text.secondary" paragraph>
                Your IOTA wallet is connected. You can now use IntelliLend's features including identity verification, lending, and borrowing.
              </Typography>
            </Box>
          ) : (
            <Box>
              <Alert severity="info" sx={{ mb: 3 }}>
                Connect your IOTA wallet to use IntelliLend's features
              </Alert>
              
              <Typography variant="body2" paragraph>
                Select a wallet to connect:
              </Typography>
              
              <List sx={{ mb: 3 }}>
                <Paper variant="outlined" sx={{ mb: 2 }}>
                  <ListItem 
                    button 
                    onClick={handleConnectWallet}
                    disabled={isConnecting}
                  >
                    <ListItemAvatar>
                      <Avatar alt="Firefly" sx={{ bgcolor: 'primary.main' }}>
                        F
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText 
                      primary="Firefly Wallet" 
                      secondary="IOTA's official wallet"
                    />
                    {isConnecting && <CircularProgress size={24} />}
                  </ListItem>
                </Paper>
                
                <Paper variant="outlined">
                  <ListItem button disabled>
                    <ListItemAvatar>
                      <Avatar alt="TanglePay" sx={{ bgcolor: 'grey.400' }}>
                        T
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText 
                      primary="TanglePay" 
                      secondary="Coming soon"
                    />
                    <Chip label="Soon" size="small" />
                  </ListItem>
                </Paper>
              </List>
              
              <Typography variant="body2" color="text.secondary">
                Don't have an IOTA wallet? 
                <Button 
                  href="https://firefly.iota.org/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  endIcon={<OpenInNew />}
                  sx={{ ml: 1 }}
                >
                  Get Firefly
                </Button>
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          {isConnected ? (
            <>
              <Button 
                onClick={handleDisconnectWallet} 
                color="error" 
                startIcon={<LinkOff />}
              >
                Disconnect
              </Button>
              <Button onClick={handleCloseDialog} color="primary">Close</Button>
            </>
          ) : (
            <Button onClick={handleCloseDialog} color="primary">Cancel</Button>
          )}
        </DialogActions>
      </Dialog>
    </>
  );
};

export default WalletConnection;
