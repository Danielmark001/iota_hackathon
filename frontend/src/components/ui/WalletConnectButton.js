import React, { useState } from 'react';
import { 
  Button, 
  Box, 
  Menu, 
  MenuItem, 
  Typography, 
  CircularProgress, 
  Avatar, 
  Divider,
  Tooltip 
} from '@mui/material';
import { 
  AccountBalanceWallet, 
  ContentCopy, 
  ExitToApp, 
  Check 
} from '@mui/icons-material';
import { useWeb3 } from '../../context/Web3Context';
import { useAuth } from '../../context/AuthContext';
import { useSnackbar } from '../../context/SnackbarContext';

const WalletConnectButton = () => {
  const { currentAccount, isConnecting, chainId } = useWeb3();
  const { login, logout } = useAuth();
  const { showSnackbar } = useSnackbar();
  
  const [anchorEl, setAnchorEl] = useState(null);
  const [copySuccess, setCopySuccess] = useState(false);
  
  // Format address for display
  const formatAddress = (address) => {
    if (!address) return '';
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  };
  
  // Handle click to open menu
  const handleClick = (event) => {
    setAnchorEl(event.currentTarget);
  };
  
  // Handle menu close
  const handleClose = () => {
    setAnchorEl(null);
  };
  
  // Copy address to clipboard
  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(currentAccount);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
      showSnackbar('Address copied to clipboard', 'success');
    } catch (err) {
      showSnackbar('Failed to copy address', 'error');
    }
    handleClose();
  };
  
  // Get network name
  const getNetworkName = (id) => {
    switch (id) {
      case 1:
        return 'Ethereum Mainnet';
      case 4212:
        return 'IOTA EVM Testnet';
      default:
        return 'Unknown Network';
    }
  };
  
  // Determine network color
  const getNetworkColor = (id) => {
    switch (id) {
      case 4212:
        return 'success';
      case 1:
        return 'primary';
      default:
        return 'warning';
    }
  };
  
  // If not connected, show connect button
  if (!currentAccount) {
    return (
      <Button
        variant="contained"
        color="primary"
        onClick={login}
        disabled={isConnecting}
        startIcon={isConnecting ? <CircularProgress size={20} color="inherit" /> : <AccountBalanceWallet />}
        sx={{ py: 1 }}
      >
        {isConnecting ? 'Connecting...' : 'Connect Wallet'}
      </Button>
    );
  }
  
  // If connected, show account button and menu
  return (
    <>
      <Box sx={{ display: 'flex', alignItems: 'center' }}>
        <Tooltip title={getNetworkName(chainId)} arrow>
          <Box
            sx={{
              width: 12,
              height: 12,
              borderRadius: '50%',
              backgroundColor: `${getNetworkColor(chainId)}.main`,
              mr: 1
            }}
          />
        </Tooltip>
        <Button
          variant="outlined"
          color="primary"
          onClick={handleClick}
          startIcon={
            <Avatar
              sx={{
                width: 24,
                height: 24,
                bgcolor: 'primary.main',
                fontSize: '0.75rem'
              }}
            >
              {currentAccount.substring(2, 4).toUpperCase()}
            </Avatar>
          }
          sx={{ borderRadius: 2, py: 1 }}
        >
          {formatAddress(currentAccount)}
        </Button>
      </Box>
      
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        PaperProps={{
          elevation: 3,
          sx: {
            borderRadius: 2,
            minWidth: 200,
            overflow: 'visible',
            mt: 1,
            '&:before': {
              content: '""',
              display: 'block',
              position: 'absolute',
              top: 0,
              right: 14,
              width: 10,
              height: 10,
              bgcolor: 'background.paper',
              transform: 'translateY(-50%) rotate(45deg)',
              zIndex: 0,
            },
          },
        }}
      >
        <MenuItem sx={{ p: 1.5 }}>
          <Box sx={{ width: '100%' }}>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom fontSize={12}>
              Connected to {getNetworkName(chainId)}
            </Typography>
            <Typography variant="body2" fontWeight="medium" sx={{ wordBreak: 'break-all' }}>
              {currentAccount}
            </Typography>
          </Box>
        </MenuItem>
        
        <Divider />
        
        <MenuItem onClick={copyToClipboard}>
          {copySuccess ? (
            <Check fontSize="small" color="success" sx={{ mr: 1 }} />
          ) : (
            <ContentCopy fontSize="small" sx={{ mr: 1 }} />
          )}
          <Typography variant="body2">Copy Address</Typography>
        </MenuItem>
        
        <MenuItem onClick={logout}>
          <ExitToApp fontSize="small" sx={{ mr: 1 }} />
          <Typography variant="body2">Disconnect</Typography>
        </MenuItem>
      </Menu>
    </>
  );
};

export default WalletConnectButton;
