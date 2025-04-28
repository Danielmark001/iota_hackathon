import React from 'react';
import { 
  Box, 
  Typography, 
  Button, 
  Divider, 
  Skeleton, 
  Chip, 
  Paper,
  Grid,
  Avatar,
  IconButton,
  Tooltip,
  useTheme,
  alpha
} from '@mui/material';
import { 
  AccountBalanceWallet as WalletIcon,
  ContentCopy as CopyIcon,
  OpenInNew as ExternalLinkIcon,
  ArrowForward as ArrowForwardIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { useIoTA } from '../../context/IoTAContext';
import { useSnackbar } from '../../context/SnackbarContext';
import { Link as RouterLink } from 'react-router-dom';

const IoTAWalletBalance = ({ address, balance, loading = false, detailed = false }) => {
  const theme = useTheme();
  const { getBalance, getExplorerUrl } = useIoTA();
  const { showSnackbar } = useSnackbar();
  
  // If address is not passed as prop, try to use the context address
  const walletAddress = address;
  
  const handleCopyAddress = () => {
    if (walletAddress) {
      navigator.clipboard.writeText(walletAddress)
        .then(() => showSnackbar('Address copied to clipboard', 'success'))
        .catch(err => showSnackbar('Failed to copy address', 'error'));
    }
  };
  
  const handleRefreshBalance = async () => {
    try {
      await getBalance();
      showSnackbar('Balance updated', 'success');
    } catch (error) {
      showSnackbar('Failed to update balance', 'error');
    }
  };
  
  const handleOpenExplorer = () => {
    if (walletAddress) {
      const url = getExplorerUrl();
      window.open(url, '_blank');
    }
  };
  
  // Shortened address display
  const shortAddress = walletAddress ? 
    `${walletAddress.substring(0, 6)}...${walletAddress.substring(walletAddress.length - 4)}` : 
    '';
  
  // Display placeholder if no address
  if (!walletAddress) {
    return (
      <Box sx={{ textAlign: 'center', py: 2 }}>
        <Box sx={{ 
          width: 60, 
          height: 60, 
          borderRadius: '50%', 
          bgcolor: theme.palette.mode === 'dark' ? alpha(theme.palette.primary.main, 0.1) : alpha(theme.palette.primary.light, 0.1),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          mx: 'auto',
          mb: 2
        }}>
          <WalletIcon color="primary" sx={{ fontSize: 28 }} />
        </Box>
        <Typography variant="subtitle1" gutterBottom fontWeight="medium">
          No Wallet Connected
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Connect your IOTA wallet to view your balance
        </Typography>
        <Button
          variant="contained"
          color="primary"
          component={RouterLink}
          to="/wallet"
          sx={{ 
            px: 3, 
            py: 1, 
            borderRadius: '20px',
            boxShadow: 'none',
            '&:hover': {
              boxShadow: theme.shadows[2]
            }
          }}
        >
          Connect Wallet
        </Button>
      </Box>
    );
  }
  
  // Detailed version with additional information
  if (detailed) {
    return (
      <Box>
        {/* Address Section */}
        <Paper
          elevation={0}
          sx={{
            p: 2,
            mb: 3,
            borderRadius: 2,
            border: `1px solid ${theme.palette.divider}`,
            background: theme.palette.mode === 'dark' 
              ? `linear-gradient(135deg, ${alpha(theme.palette.primary.dark, 0.3)} 0%, ${alpha(theme.palette.background.paper, 0.5)} 100%)` 
              : `linear-gradient(135deg, ${alpha(theme.palette.primary.light, 0.2)} 0%, ${alpha(theme.palette.background.paper, 0.5)} 100%)`
          }}
        >
          <Typography variant="subtitle2" color="text.secondary" fontWeight="medium" gutterBottom>
            Address
          </Typography>
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between', 
            mb: 1 
          }}>
            <Typography
              variant="body2"
              sx={{
                fontFamily: "monospace",
                wordBreak: "break-all"
              }}
            >
              {loading ? <Skeleton width="100%" /> : walletAddress}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Tooltip title="Copy Address">
              <IconButton 
                size="small" 
                onClick={handleCopyAddress} 
                sx={{ mr: 1 }}
              >
                <CopyIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="View in Explorer">
              <IconButton 
                size="small" 
                onClick={handleOpenExplorer}
              >
                <ExternalLinkIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        </Paper>
        
        {/* Balance Section */}
        <Paper
          elevation={0}
          sx={{
            mb: 3,
            borderRadius: 2,
            border: `1px solid ${theme.palette.divider}`,
            overflow: 'hidden'
          }}
        >
          <Box sx={{ bgcolor: theme.palette.mode === 'dark' ? 'rgba(0,0,0,0.1)' : 'rgba(0,0,0,0.02)', py: 1.5, px: 2, borderBottom: `1px solid ${theme.palette.divider}` }}>
            <Typography variant="subtitle2" fontWeight="medium">
              Balance
            </Typography>
          </Box>
          <Box sx={{ p: 2 }}>
            <Box sx={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              p: 3,
              borderRadius: 2,
              bgcolor: theme.palette.mode === 'dark' ? alpha(theme.palette.primary.main, 0.1) : alpha(theme.palette.primary.light, 0.1),
              mb: 2
            }}>
              <Typography variant="h4" fontWeight="bold" color="primary">
                {loading ? <Skeleton width={120} /> : balance?.baseCoinsFormatted || '0 SMR'}
              </Typography>
              <Tooltip title="Refresh Balance">
                <IconButton 
                  onClick={handleRefreshBalance}
                  color="primary"
                  size="small"
                  sx={{ 
                    bgcolor: theme.palette.mode === 'dark' ? alpha(theme.palette.common.white, 0.05) : alpha(theme.palette.common.white, 0.5),
                    '&:hover': {
                      bgcolor: theme.palette.mode === 'dark' ? alpha(theme.palette.common.white, 0.1) : alpha(theme.palette.common.white, 0.7),
                    }
                  }}
                >
                  <RefreshIcon />
                </IconButton>
              </Tooltip>
            </Box>
            
            {balance?.nativeTokens?.length > 0 && (
              <>
                <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                  Native Tokens ({balance.nativeTokens.length})
                </Typography>
                <Box sx={{ 
                  p: 2, 
                  borderRadius: 2,
                  bgcolor: theme.palette.mode === 'dark' ? alpha(theme.palette.common.white, 0.03) : alpha(theme.palette.common.black, 0.02),
                  border: `1px solid ${theme.palette.divider}` 
                }}>
                  <Grid container spacing={1}>
                    {balance.nativeTokens.map((token, index) => (
                      <Grid item key={index}>
                        <Chip
                          label={`${token.id.substring(0, 8)}... (${token.amount})`}
                          size="small"
                          sx={{ fontWeight: 'medium' }}
                        />
                      </Grid>
                    ))}
                  </Grid>
                </Box>
              </>
            )}
          </Box>
        </Paper>
        
        {/* Network Section */}
        <Paper
          elevation={0}
          sx={{
            borderRadius: 2,
            border: `1px solid ${theme.palette.divider}`,
            overflow: 'hidden'
          }}
        >
          <Box sx={{ bgcolor: theme.palette.mode === 'dark' ? 'rgba(0,0,0,0.1)' : 'rgba(0,0,0,0.02)', py: 1.5, px: 2, borderBottom: `1px solid ${theme.palette.divider}` }}>
            <Typography variant="subtitle2" fontWeight="medium">
              Network Information
            </Typography>
          </Box>
          <Box sx={{ p: 2 }}>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2" color="text.secondary">Network</Typography>
                  <Typography variant="body2" fontWeight="medium">Shimmer Testnet</Typography>
                </Box>
                <Divider />
              </Grid>
              <Grid item xs={12}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2" color="text.secondary">Node</Typography>
                  <Typography variant="body2" fontWeight="medium">api.testnet.shimmer.network</Typography>
                </Box>
                <Divider />
              </Grid>
              <Grid item xs={12}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2" color="text.secondary">Protocol</Typography>
                  <Typography variant="body2" fontWeight="medium">Stardust</Typography>
                </Box>
                <Divider />
              </Grid>
              <Grid item xs={12}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2" color="text.secondary">Status</Typography>
                  <Chip
                    label="Connected"
                    size="small"
                    color="success"
                    sx={{
                      height: 20,
                      fontSize: '0.65rem',
                      fontWeight: 'medium'
                    }}
                  />
                </Box>
              </Grid>
            </Grid>
          </Box>
        </Paper>
      </Box>
    );
  }
  
  // Standard (compact) version
  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Avatar 
            sx={{ 
              width: 36, 
              height: 36, 
              mr: 1.5, 
              bgcolor: theme.palette.primary.main
            }}
          >
            <WalletIcon sx={{ fontSize: 20 }} />
          </Avatar>
          <Box>
            <Typography variant="subtitle2" fontWeight="medium">
              {shortAddress}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Shimmer Testnet
            </Typography>
          </Box>
        </Box>
        <Box>
          <Tooltip title="View in Explorer">
            <IconButton 
              size="small" 
              onClick={handleOpenExplorer}
              sx={{ 
                color: theme.palette.text.secondary,
                '&:hover': {
                  color: theme.palette.primary.main
                }
              }}
            >
              <ExternalLinkIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>
      
      <Divider sx={{ mb: 2 }} />
      
      <Box sx={{ 
        px: 3, 
        py: 2, 
        mb: 2, 
        borderRadius: 2,
        bgcolor: theme.palette.mode === 'dark' ? alpha(theme.palette.primary.main, 0.1) : alpha(theme.palette.primary.light, 0.1),
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        flexDirection: 'column'
      }}>
        <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5 }}>
          BALANCE
        </Typography>
        <Typography variant="h5" fontWeight="bold" sx={{ mb: 0.5 }}>
          {loading ? <Skeleton width={100} /> : balance?.baseCoinsFormatted || '0 SMR'}
        </Typography>
        <Button
          size="small"
          startIcon={<RefreshIcon fontSize="small" />}
          onClick={handleRefreshBalance}
          sx={{ mt: 1, fontWeight: 'medium', fontSize: '0.75rem' }}
        >
          Refresh
        </Button>
      </Box>
      
      {balance?.nativeTokens?.length > 0 && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
            Native Tokens ({balance.nativeTokens.length})
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            {balance.nativeTokens.slice(0, 3).map((token, index) => (
              <Chip
                key={index}
                label={`${token.id.substring(0, 6)}...`}
                size="small"
                sx={{ fontSize: '0.65rem' }}
              />
            ))}
            {balance.nativeTokens.length > 3 && (
              <Chip
                label={`+${balance.nativeTokens.length - 3} more`}
                size="small"
                sx={{ fontSize: '0.65rem' }}
              />
            )}
          </Box>
        </Box>
      )}
    </Box>
  );
};

export default IoTAWalletBalance;