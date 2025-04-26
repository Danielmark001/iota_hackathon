import React, { useState, useEffect } from 'react';
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
  Grid,
  Link,
  Tooltip,
  IconButton
} from '@mui/material';
import {
  AccountBalanceWallet,
  LinkOff,
  Check,
  Warning,
  Info,
  OpenInNew,
  ContentCopy,
  Refresh
} from '@mui/icons-material';

// Import IOTA context
import { useIoTA } from '../../context/IoTAContext';

/**
 * WalletConnection component
 * 
 * Allows users to connect to IOTA wallets like Firefly, TanglePay, and Bloom
 */
const WalletConnection = () => {
  const { 
    isConnected, 
    isConnecting, 
    address, 
    balance, 
    walletStatus,
    network,
    networkInfo,
    walletType,
    connectionError,
    initConnection, 
    disconnectWallet,
    getExplorerUrl,
    getAvailableWallets
  } = useIoTA();
  
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedWallet, setSelectedWallet] = useState(null);
  const [availableWallets, setAvailableWallets] = useState([]);
  const [networkBadgeText, setNetworkBadgeText] = useState('');
  
  // Set available wallets when component mounts
  useEffect(() => {
    setAvailableWallets(getAvailableWallets());
  }, [getAvailableWallets]);
  
  // Update network badge text when network changes
  useEffect(() => {
    if (network === 'mainnet') {
      setNetworkBadgeText('MainNet');
    } else if (network === 'testnet') {
      setNetworkBadgeText('TestNet');
    } else if (network === 'devnet') {
      setNetworkBadgeText('DevNet');
    }
  }, [network]);
  
  // Open wallet connection dialog
  const handleOpenDialog = () => {
    setDialogOpen(true);
    // Update available wallets when opening dialog
    setAvailableWallets(getAvailableWallets());
  };
  
  // Close wallet connection dialog
  const handleCloseDialog = () => {
    setDialogOpen(false);
    setSelectedWallet(null);
  };
  
  // Connect to wallet
  const handleConnectWallet = async (walletType) => {
    setSelectedWallet(walletType);
    await initConnection(walletType);
    if (walletStatus === 'connected') {
      handleCloseDialog();
    }
  };
  
  // Disconnect wallet
  const handleDisconnectWallet = async () => {
    await disconnectWallet();
  };
  
  // Copy to clipboard
  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
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
          endIcon={
            <Chip 
              size="small" 
              label={networkBadgeText} 
              color={network === 'mainnet' ? 'success' : network === 'testnet' ? 'warning' : 'info'}
            />
          }
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
      <Dialog 
        open={dialogOpen} 
        onClose={handleCloseDialog} 
        maxWidth="sm" 
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2,
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)'
          }
        }}
      >
        <DialogTitle sx={{ 
          display: 'flex', 
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid',
          borderColor: 'divider',
          pb: 2
        }}>
          <Box display="flex" alignItems="center">
            <AccountBalanceWallet sx={{ mr: 1, color: 'primary.main' }} />
            IOTA Wallet Connection
          </Box>
          <Chip 
            size="small" 
            label={networkBadgeText} 
            color={network === 'mainnet' ? 'success' : network === 'testnet' ? 'warning' : 'info'}
          />
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          {isConnected ? (
            <Box>
              <Alert 
                severity="success" 
                sx={{ mb: 2 }}
                icon={<Check fontSize="inherit" />}
                action={
                  <IconButton 
                    aria-label="close" 
                    color="inherit" 
                    size="small" 
                    onClick={handleDisconnectWallet}
                  >
                    <LinkOff fontSize="inherit" />
                  </IconButton>
                }
              >
                Wallet Connected Successfully
              </Alert>
              
              <Paper variant="outlined" sx={{ p: 2, mb: 3, borderRadius: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Connected Wallet
                  </Typography>
                  {walletType && (
                    <Chip 
                      label={walletType.charAt(0).toUpperCase() + walletType.slice(1)} 
                      color="primary" 
                      size="small" 
                      variant="outlined"
                    />
                  )}
                </Box>
                
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <Typography variant="body2" fontWeight="medium">
                    Address
                  </Typography>
                  <Box 
                    sx={{ 
                      ml: 'auto', 
                      display: 'flex', 
                      alignItems: 'center',
                      bgcolor: 'background.subtle',
                      borderRadius: 1,
                      px: 1,
                      py: 0.5
                    }}
                  >
                    <Typography 
                      variant="body2" 
                      fontFamily="monospace"
                      sx={{ 
                        overflow: 'hidden', 
                        textOverflow: 'ellipsis', 
                        maxWidth: { xs: '150px', sm: '250px' } 
                      }}
                    >
                      {address}
                    </Typography>
                    <Tooltip title="Copy to clipboard">
                      <IconButton 
                        size="small" 
                        onClick={() => copyToClipboard(address)}
                        sx={{ ml: 0.5 }}
                      >
                        <ContentCopy fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="View in explorer">
                      <IconButton 
                        size="small"
                        component={Link}
                        href={getExplorerUrl(address)}
                        target="_blank"
                        rel="noopener"
                        sx={{ ml: 0.5 }}
                      >
                        <OpenInNew fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </Box>
                
                <Divider sx={{ my: 2 }} />
                
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Typography variant="subtitle2" color="text.secondary">
                      Balance
                    </Typography>
                    <Typography variant="h6" fontWeight="bold">
                      {formattedBalance()}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="subtitle2" color="text.secondary">
                      Network
                    </Typography>
                    <Typography variant="body1">
                      {networkInfo?.name}
                    </Typography>
                  </Grid>
                </Grid>
                
                {balance?.nativeTokens?.length > 0 && (
                  <Box mt={2}>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                      Native Tokens
                    </Typography>
                    <List dense disablePadding>
                      {balance.nativeTokens.map((token, index) => (
                        <ListItem key={token.id || index} disablePadding sx={{ py: 0.5 }}>
                          <ListItemText 
                            primary={token.name || token.id.substring(0, 12) + '...'}
                            secondary={`Balance: ${token.available || 0}`}
                            primaryTypographyProps={{ variant: 'body2' }}
                            secondaryTypographyProps={{ variant: 'caption' }}
                          />
                        </ListItem>
                      ))}
                    </List>
                  </Box>
                )}
              </Paper>
              
              <Typography variant="body2" color="text.secondary" paragraph>
                Your IOTA wallet is connected. You can now use IntelliLend's features including identity verification, lending, borrowing, and cross-layer operations.
              </Typography>
            </Box>
          ) : (
            <Box>
              {connectionError && (
                <Alert severity="error" sx={{ mb: 3 }}>
                  {connectionError}
                </Alert>
              )}
              
              <Alert 
                severity="info" 
                sx={{ mb: 3 }}
                icon={<Info fontSize="inherit" />}
              >
                Connect your IOTA wallet to use IntelliLend's features. Choose one of the available wallets below.
              </Alert>
              
              <List sx={{ mb: 3 }}>
                {availableWallets.map((wallet, index) => (
                  <Paper 
                    key={wallet.name} 
                    variant="outlined" 
                    sx={{ 
                      mb: 2,
                      borderColor: selectedWallet === wallet.name.toLowerCase() ? 'primary.main' : 'divider',
                      bgcolor: selectedWallet === wallet.name.toLowerCase() ? 'primary.light' : 'transparent',
                      opacity: !wallet.installed && isConnecting ? 0.6 : 1,
                      transition: 'all 0.2s'
                    }}
                  >
                    <ListItem 
                      button 
                      onClick={() => handleConnectWallet(wallet.name.toLowerCase())}
                      disabled={isConnecting || (selectedWallet && selectedWallet !== wallet.name.toLowerCase())}
                    >
                      <ListItemAvatar>
                        <Avatar 
                          alt={wallet.name} 
                          src={wallet.logo} 
                          sx={{ 
                            bgcolor: wallet.installed ? 'primary.main' : 'grey.400',
                            color: 'white'
                          }}
                        >
                          {wallet.name.charAt(0)}
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText 
                        primary={<Typography fontWeight="medium">{wallet.name}</Typography>} 
                        secondary={
                          <>
                            {wallet.description}
                            {!wallet.installed && (
                              <Typography variant="caption" component="div" sx={{ mt: 0.5, color: 'warning.main' }}>
                                Not detected. <Link href={wallet.installUrl} target="_blank" rel="noopener noreferrer">Install</Link>
                              </Typography>
                            )}
                          </>
                        }
                      />
                      {isConnecting && selectedWallet === wallet.name.toLowerCase() && (
                        <CircularProgress size={24} />
                      )}
                      {wallet.installed && (
                        <Chip 
                          label="Available" 
                          size="small" 
                          color="success" 
                          variant="outlined"
                          sx={{ ml: 1 }}
                        />
                      )}
                    </ListItem>
                  </Paper>
                ))}
              </List>
              
              <Box sx={{ bgcolor: 'background.subtle', p: 2, borderRadius: 1 }}>
                <Typography variant="body2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center' }}>
                  <Info fontSize="small" sx={{ mr: 1 }} />
                  Don't have an IOTA wallet? 
                </Typography>
                <Box mt={1}>
                  <Button 
                    href="https://firefly.iota.org/" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    endIcon={<OpenInNew />}
                    variant="outlined"
                    size="small"
                    sx={{ mr: 1, mt: 1 }}
                  >
                    Get Firefly
                  </Button>
                  <Button 
                    href="https://tanglepay.com/" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    endIcon={<OpenInNew />}
                    variant="outlined"
                    size="small"
                    sx={{ mr: 1, mt: 1 }}
                  >
                    Get TanglePay
                  </Button>
                  <Button 
                    href="https://bloomwallet.io/" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    endIcon={<OpenInNew />}
                    variant="outlined"
                    size="small"
                    sx={{ mt: 1 }}
                  >
                    Get Bloom
                  </Button>
                </Box>
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2, borderTop: '1px solid', borderColor: 'divider' }}>
          {isConnected ? (
            <>
              <Button 
                onClick={handleDisconnectWallet} 
                color="error" 
                startIcon={<LinkOff />}
                sx={{ mr: 'auto' }}
              >
                Disconnect
              </Button>
              <Button 
                onClick={handleCloseDialog} 
                color="primary"
                variant="contained"
              >
                Close
              </Button>
            </>
          ) : (
            <>
              <Button 
                onClick={() => setAvailableWallets(getAvailableWallets())}
                startIcon={<Refresh />}
                sx={{ mr: 'auto' }}
                disabled={isConnecting}
              >
                Refresh
              </Button>
              <Button 
                onClick={handleCloseDialog} 
                color="primary"
              >
                Cancel
              </Button>
            </>
          )}
        </DialogActions>
      </Dialog>
    </>
  );
};

export default WalletConnection;
