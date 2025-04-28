import React from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  Alert,
  Divider,
  CircularProgress,
  Chip,
  useTheme
} from '@mui/material';
import {
  RestartAlt as RestartIcon,
  SettingsEthernet as NetworkIcon,
  ContentCopy as CopyIcon,
  LinkOff as LinkOffIcon
} from '@mui/icons-material';
import { useWeb3 } from '../../context/Web3Context';
import { CONTRACT_ADDRESSES, NETWORK_CONFIG } from '../../config/contracts';

const ConnectionErrorFallback = ({ onRetry, showDetails = true }) => {
  const theme = useTheme();
  const { currentAccount, chainId, connectionError, switchNetwork, isConnecting } = useWeb3();

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <Paper 
      elevation={2}
      sx={{
        p: 3,
        borderRadius: 2,
        maxWidth: '100%',
        border: `1px solid ${theme.palette.divider}`,
        background: theme.palette.mode === 'dark' 
          ? 'linear-gradient(145deg, rgba(26, 43, 69, 0.95) 0%, rgba(18, 31, 53, 0.95) 100%)' 
          : 'linear-gradient(145deg, rgba(255, 255, 255, 0.95) 0%, rgba(249, 250, 251, 0.95) 100%)',
        position: 'relative',
        overflow: 'hidden',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 4,
          background: 'linear-gradient(90deg, #7C5DD6 0%, #33CFBA 100%)',
        }
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <LinkOffIcon 
          color="error" 
          fontSize="large" 
          sx={{ 
            mr: 2,
            p: 1,
            borderRadius: '50%',
            backgroundColor: theme.palette.mode === 'dark' 
              ? 'rgba(244, 67, 54, 0.1)' 
              : 'rgba(244, 67, 54, 0.08)',
          }}
        />
        <Typography variant="h5" component="h2" fontWeight={600}>
          Failed to connect to blockchain contracts
        </Typography>
      </Box>
      
      <Alert severity="warning" sx={{ mb: 3, borderRadius: 2 }}>
        We're unable to establish a connection to the IOTA blockchain contracts. You're currently viewing the application in offline mode with mock data.
      </Alert>
      
      <Typography variant="body1" color="text.secondary" paragraph>
        You can continue browsing with limited functionality, or try reconnecting by clicking the button below. 
        If the problem persists, make sure you're connected to the correct network (IOTA EVM Testnet).
      </Typography>
      
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Button
          variant="contained"
          startIcon={isConnecting ? <CircularProgress size={20} color="inherit" /> : <RestartIcon />}
          onClick={onRetry}
          disabled={isConnecting}
          sx={{ 
            minWidth: 150,
            background: 'linear-gradient(90deg, #7C5DD6 0%, #33CFBA 100%)',
            '&:hover': {
              background: 'linear-gradient(90deg, #6C4DC6 0%, #23BFAA 100%)',
            },
          }}
        >
          {isConnecting ? 'Connecting...' : 'Retry Connection'}
        </Button>
        
        <Button
          variant="outlined"
          startIcon={<NetworkIcon />}
          onClick={switchNetwork}
          disabled={isConnecting}
          sx={{ minWidth: 150 }}
        >
          Switch Network
        </Button>
      </Box>
      
      {showDetails && (
        <>
          <Divider sx={{ my: 3 }} />
          
          <Typography variant="subtitle2" fontWeight={600} gutterBottom>
            Connection Details
          </Typography>
          
          <Box sx={{ mt: 1, mb: 3 }}>
            <Box sx={{ 
              p: 2, 
              borderRadius: 2, 
              bgcolor: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)', 
              mb: 2,
              display: 'flex',
              flexDirection: 'column',
              gap: 1.5
            }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="body2" color="text.secondary">Network:</Typography>
                <Chip 
                  label={NETWORK_CONFIG.chainName} 
                  size="small" 
                  color="primary" 
                  variant="outlined"
                  sx={{ fontWeight: 500 }}
                />
              </Box>
              
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="body2" color="text.secondary">Chain ID:</Typography>
                <Typography variant="body2" fontFamily="monospace">
                  {parseInt(NETWORK_CONFIG.chainId, 16)} ({NETWORK_CONFIG.chainId})
                </Typography>
              </Box>
              
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="body2" color="text.secondary">RPC URL:</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Typography variant="body2" fontFamily="monospace" noWrap sx={{ maxWidth: 200 }}>
                    {NETWORK_CONFIG.rpcUrls[0]}
                  </Typography>
                  <Button 
                    size="small" 
                    sx={{ minWidth: 'auto', ml: 1 }}
                    onClick={() => copyToClipboard(NETWORK_CONFIG.rpcUrls[0])}
                  >
                    <CopyIcon fontSize="small" />
                  </Button>
                </Box>
              </Box>
              
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="body2" color="text.secondary">Current Chain ID:</Typography>
                <Typography variant="body2" fontFamily="monospace">
                  {chainId || 'Not connected'}
                </Typography>
              </Box>
              
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="body2" color="text.secondary">Account:</Typography>
                <Typography variant="body2" fontFamily="monospace" noWrap sx={{ maxWidth: 200 }}>
                  {currentAccount || 'Not connected'}
                </Typography>
              </Box>
            </Box>
            
            <Typography variant="subtitle2" fontWeight={600} gutterBottom>
              Contract Addresses
            </Typography>
            
            <Box sx={{ 
              p: 2, 
              borderRadius: 2, 
              bgcolor: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)', 
              display: 'flex',
              flexDirection: 'column',
              gap: 1.5
            }}>
              {Object.entries(CONTRACT_ADDRESSES).map(([key, value]) => (
                <Box 
                  key={key} 
                  sx={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center' 
                  }}
                >
                  <Typography variant="body2" color="text.secondary">{key}:</Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Typography variant="body2" fontFamily="monospace" noWrap sx={{ maxWidth: 200 }}>
                      {value}
                    </Typography>
                    <Button 
                      size="small" 
                      sx={{ minWidth: 'auto', ml: 1 }}
                      onClick={() => copyToClipboard(value)}
                    >
                      <CopyIcon fontSize="small" />
                    </Button>
                  </Box>
                </Box>
              ))}
            </Box>
          </Box>
          
          <Box sx={{ mt: 3 }}>
            <Alert severity="info" sx={{ borderRadius: 2 }}>
              <Typography variant="body2">
                Error message: {connectionError || "Failed to connect to blockchain contracts"}
              </Typography>
            </Alert>
          </Box>
        </>
      )}
    </Paper>
  );
};

export default ConnectionErrorFallback;
