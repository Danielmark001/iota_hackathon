import React from 'react';
import { 
  Box, 
  Typography, 
  Button, 
  Chip, 
  Avatar, 
  IconButton,
  Tooltip,
  useTheme,
  alpha,
  Skeleton,
  Card,
  CardContent,
  Grid,
  Paper,
  Badge
} from '@mui/material';
import { 
  AccountBalanceWallet as WalletIcon,
  ContentCopy as CopyIcon,
  OpenInNew as ExternalLinkIcon,
  Refresh as RefreshIcon,
  CheckCircleOutline as VerifiedIcon,
  Error as ErrorIcon,
  ArrowUpward as ArrowUpIcon,
  ArrowDownward as ArrowDownIcon,
  Bolt as BoltIcon
} from '@mui/icons-material';
import { useIoTA } from '../../context/IoTAContext';
import { useSnackbar } from '../../context/SnackbarContext';

const WalletStatus = ({ compact = false }) => {
  const theme = useTheme();
  const { 
    isConnected, 
    isConnecting, 
    address, 
    balance, 
    walletType,
    initConnection,
    networkInfo,
    getBalance,
    getExplorerUrl,
    connectionError
  } = useIoTA();
  const { showSnackbar } = useSnackbar();
  
  // Handle connect wallet
  const handleConnectWallet = () => {
    initConnection();
  };
  
  // Handle copy address to clipboard
  const handleCopyAddress = () => {
    if (address) {
      navigator.clipboard.writeText(address)
        .then(() => showSnackbar('Address copied to clipboard', 'success'))
        .catch(err => showSnackbar('Failed to copy address', 'error'));
    }
  };
  
  // Handle refresh balance
  const handleRefreshBalance = async () => {
    if (address) {
      try {
        await getBalance();
        showSnackbar('Balance updated', 'success');
      } catch (error) {
        showSnackbar('Failed to refresh balance', 'error');
      }
    }
  };
  
  // Open explorer
  const handleOpenExplorer = () => {
    if (address) {
      const url = getExplorerUrl();
      window.open(url, '_blank');
    }
  };

  // Shortened address display
  const shortAddress = address ? 
    `${address.substring(0, 6)}...${address.substring(address.length - 4)}` : 
    '';

  // Wallet indicator color based on type
  const getWalletColor = () => {
    switch (walletType) {
      case 'firefly':
        return '#0FC1B7';
      case 'tanglepay':
        return '#3568DD';
      case 'bloom':
        return '#8962FF';
      default:
        return theme.palette.primary.main;
    }
  };

  // Compact view for sidebar when collapsed
  if (compact) {
    return (
      <Box 
        sx={{ 
          p: 2, 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center'
        }}
      >
        {isConnected ? (
          <Tooltip title={`Connected: ${shortAddress}`} arrow placement="right">
            <Badge
              overlap="circular"
              anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
              badgeContent={
                <Box
                  sx={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    bgcolor: 'success.main',
                    border: `2px solid ${theme.palette.background.paper}`,
                    boxShadow: '0 0 0 2px rgba(34, 197, 94, 0.2)'
                  }}
                />
              }
            >
              <Avatar 
                sx={{ 
                  width: 46, 
                  height: 46,
                  bgcolor: getWalletColor(),
                  fontSize: '0.9rem',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                  border: `2px solid ${theme.palette.background.paper}`,
                  boxShadow: `0 4px 12px ${alpha(getWalletColor(), 0.3)}`,
                  '&:hover': {
                    transform: 'scale(1.08)',
                    boxShadow: `0 6px 16px ${alpha(getWalletColor(), 0.4)}`,
                  }
                }}
                onClick={() => handleOpenExplorer()}
              >
                {walletType?.charAt(0).toUpperCase() || 'W'}
              </Avatar>
            </Badge>
          </Tooltip>
        ) : (
          <Tooltip title="Connect IOTA Wallet" arrow placement="right">
            <IconButton
              color="primary"
              onClick={handleConnectWallet}
              disabled={isConnecting}
              sx={{ 
                p: 1.5,
                width: 46,
                height: 46,
                borderRadius: '14px',
                backgroundColor: theme.palette.mode === 'dark' 
                  ? alpha(theme.palette.primary.main, 0.15) 
                  : alpha(theme.palette.primary.light, 0.15),
                boxShadow: `0 4px 12px ${alpha(theme.palette.primary.main, 0.2)}`,
                transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                '&:hover': {
                  backgroundColor: theme.palette.mode === 'dark' 
                    ? alpha(theme.palette.primary.main, 0.25) 
                    : alpha(theme.palette.primary.light, 0.25),
                  transform: 'translateY(-2px)',
                  boxShadow: `0 6px 16px ${alpha(theme.palette.primary.main, 0.3)}`,
                }
              }}
            >
              <WalletIcon fontSize="medium" />
            </IconButton>
          </Tooltip>
        )}
      </Box>
    );
  }

  // Full wallet status view
  return (
    <Card 
      elevation={0} 
      sx={{ 
        mx: 2.5,
        my: 2, 
        borderRadius: '18px',
        border: `1px solid ${theme.palette.mode === 'dark' 
          ? alpha(theme.palette.primary.main, 0.2) 
          : alpha(theme.palette.primary.main, 0.15)}`,
        position: 'relative',
        overflow: 'visible',
        background: theme.palette.mode === 'dark' 
          ? `linear-gradient(145deg, ${alpha(theme.palette.background.paper, 0.9)} 0%, ${alpha(theme.palette.background.paper, 0.7)} 100%)` 
          : `linear-gradient(145deg, ${alpha(theme.palette.common.white, 0.95)} 0%, ${alpha(theme.palette.common.white, 0.85)} 100%)`,
        backdropFilter: 'blur(10px)',
        boxShadow: theme.palette.mode === 'dark' 
          ? '0 4px 20px rgba(0, 0, 0, 0.2)' 
          : '0 4px 20px rgba(90, 48, 181, 0.08)',
        transition: 'all 0.3s ease',
        '&:hover': {
          boxShadow: theme.palette.mode === 'dark' 
            ? '0 8px 25px rgba(0, 0, 0, 0.3)' 
            : '0 8px 25px rgba(90, 48, 181, 0.12)',
          transform: 'translateY(-2px)',
        }
      }}
    >
      {isConnected ? (
        <>
          {/* Connection Status Indicator */}
          <Box
            sx={{
              position: 'absolute',
              top: -12,
              right: 20,
              bgcolor: 'success.main',
              color: '#fff',
              borderRadius: '12px',
              px: 1.6,
              py: 0.5,
              fontSize: '0.75rem',
              fontWeight: 600,
              letterSpacing: '0.03em',
              boxShadow: '0 4px 10px rgba(34, 197, 94, 0.3)',
              border: `2px solid ${theme.palette.background.paper}`,
              display: 'flex',
              alignItems: 'center',
              zIndex: 1
            }}
          >
            <Box
              sx={{
                width: 6,
                height: 6,
                bgcolor: '#fff',
                borderRadius: '50%',
                mr: 0.7,
                boxShadow: '0 0 0 2px rgba(255, 255, 255, 0.3)',
                animation: 'pulse 2s infinite',
                '@keyframes pulse': {
                  '0%': { boxShadow: '0 0 0 0 rgba(255, 255, 255, 0.7)' },
                  '70%': { boxShadow: '0 0 0 6px rgba(255, 255, 255, 0)' },
                  '100%': { boxShadow: '0 0 0 0 rgba(255, 255, 255, 0)' }
                }
              }}
            />
            Connected
          </Box>

          <CardContent sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Avatar 
                  sx={{ 
                    width: 44, 
                    height: 44, 
                    mr: 2, 
                    bgcolor: getWalletColor(),
                    color: '#fff',
                    fontSize: '0.9rem',
                    fontWeight: 'bold',
                    border: `2px solid ${theme.palette.mode === 'dark' 
                      ? alpha(theme.palette.common.white, 0.1) 
                      : alpha(theme.palette.common.white, 0.8)}`,
                    boxShadow: `0 4px 12px ${alpha(getWalletColor(), 0.3)}`,
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      transform: 'scale(1.05)',
                      boxShadow: `0 6px 14px ${alpha(getWalletColor(), 0.4)}`,
                    }
                  }}
                >
                  {walletType?.charAt(0).toUpperCase() || 'W'}
                </Avatar>
                <Box>
                  <Typography 
                    variant="subtitle1" 
                    sx={{ 
                      fontWeight: 600, 
                      fontSize: '1rem',
                      letterSpacing: '-0.01em',
                    }} 
                    noWrap
                  >
                    {shortAddress}
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                    <Chip 
                      label={networkInfo?.name || 'Testnet'} 
                      size="small"
                      sx={{ 
                        height: 20, 
                        fontSize: '0.65rem', 
                        bgcolor: theme.palette.mode === 'dark' 
                          ? alpha(theme.palette.primary.main, 0.25) 
                          : alpha(theme.palette.primary.light, 0.2),
                        color: theme.palette.mode === 'dark' 
                          ? theme.palette.primary.light 
                          : theme.palette.primary.main,
                        fontWeight: 600,
                        letterSpacing: '0.02em',
                        border: `1px solid ${theme.palette.mode === 'dark' 
                          ? alpha(theme.palette.primary.main, 0.3) 
                          : alpha(theme.palette.primary.light, 0.3)}`,
                        '& .MuiChip-label': { px: 1 }
                      }}
                    />
                    <Typography
                      variant="caption"
                      sx={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        color: theme.palette.success.main,
                        fontWeight: 600,
                        fontSize: '0.7rem',
                      }}
                    >
                      <VerifiedIcon sx={{ fontSize: 14, mr: 0.3 }} />
                      Verified
                    </Typography>
                  </Box>
                </Box>
              </Box>
              <Box sx={{ display: 'flex' }}>
                <Tooltip title="Copy Address" arrow>
                  <IconButton 
                    size="small" 
                    onClick={handleCopyAddress}
                    sx={{ 
                      mx: 0.5,
                      width: 32,
                      height: 32,
                      color: theme.palette.mode === 'dark' 
                        ? alpha(theme.palette.common.white, 0.7) 
                        : alpha(theme.palette.common.black, 0.6),
                      backgroundColor: theme.palette.mode === 'dark' 
                        ? alpha(theme.palette.common.white, 0.08) 
                        : alpha(theme.palette.common.black, 0.04),
                      borderRadius: '10px',
                      transition: 'all 0.2s ease',
                      '&:hover': {
                        color: theme.palette.primary.main,
                        backgroundColor: theme.palette.mode === 'dark' 
                          ? alpha(theme.palette.common.white, 0.12) 
                          : alpha(theme.palette.common.black, 0.07),
                        transform: 'translateY(-2px)',
                      }
                    }}
                  >
                    <CopyIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="View in Explorer" arrow>
                  <IconButton 
                    size="small" 
                    onClick={handleOpenExplorer}
                    sx={{ 
                      width: 32,
                      height: 32,
                      color: theme.palette.mode === 'dark' 
                        ? alpha(theme.palette.common.white, 0.7) 
                        : alpha(theme.palette.common.black, 0.6),
                      backgroundColor: theme.palette.mode === 'dark' 
                        ? alpha(theme.palette.common.white, 0.08) 
                        : alpha(theme.palette.common.black, 0.04),
                      borderRadius: '10px',
                      transition: 'all 0.2s ease',
                      '&:hover': {
                        color: theme.palette.primary.main,
                        backgroundColor: theme.palette.mode === 'dark' 
                          ? alpha(theme.palette.common.white, 0.12) 
                          : alpha(theme.palette.common.black, 0.07),
                        transform: 'translateY(-2px)',
                      }
                    }}
                  >
                    <ExternalLinkIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
            </Box>
            
            <Box
              sx={{
                p: 2.5,
                borderRadius: 4,
                background: theme.palette.mode === 'dark'
                  ? `linear-gradient(135deg, ${alpha(theme.palette.primary.dark, 0.5)} 0%, ${alpha(theme.palette.primary.main, 0.2)} 100%)`
                  : `linear-gradient(135deg, ${alpha(theme.palette.primary.light, 0.4)} 0%, ${alpha(theme.palette.primary.main, 0.1)} 100%)`,
                border: `1px solid ${theme.palette.mode === 'dark' 
                  ? alpha(theme.palette.primary.main, 0.4) 
                  : alpha(theme.palette.primary.light, 0.6)}`,
                boxShadow: `0 8px 24px ${theme.palette.mode === 'dark' 
                  ? 'rgba(0,0,0,0.3)' 
                  : 'rgba(90,48,181,0.15)'}`,
                position: 'relative',
                overflow: 'hidden',
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: '100%',
                  background: theme.palette.mode === 'dark'
                    ? 'linear-gradient(to right, rgba(90, 48, 181, 0.1) 0%, rgba(0, 191, 165, 0.05) 100%)'
                    : 'linear-gradient(to right, rgba(90, 48, 181, 0.05) 0%, rgba(0, 191, 165, 0.02) 100%)',
                  opacity: 0.8,
                  zIndex: 0,
                },
              }}
            >
              <Box
                sx={{
                  position: 'absolute',
                  top: 0,
                  right: 0,
                  p: 1.5,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 2,
                }}
              >
                <Tooltip title="Refresh Balance" arrow>
                  <IconButton
                    size="small"
                    onClick={handleRefreshBalance}
                    sx={{
                      color: theme.palette.mode === 'dark' 
                        ? alpha(theme.palette.common.white, 0.9) 
                        : theme.palette.primary.main,
                      backgroundColor: theme.palette.mode === 'dark' 
                        ? alpha(theme.palette.common.white, 0.15) 
                        : alpha(theme.palette.common.white, 0.9),
                      border: `1px solid ${theme.palette.mode === 'dark' 
                        ? alpha(theme.palette.primary.main, 0.4) 
                        : alpha(theme.palette.primary.light, 0.6)}`,
                      '&:hover': {
                        backgroundColor: theme.palette.mode === 'dark' 
                          ? alpha(theme.palette.common.white, 0.25) 
                          : alpha(theme.palette.common.white, 1),
                        transform: 'rotate(30deg)',
                      },
                      transition: 'all 0.3s ease',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                      width: 32,
                      height: 32,
                      borderRadius: '10px',
                    }}
                  >
                    <RefreshIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
              <Box sx={{ mb: 1, position: 'relative', zIndex: 1 }}>
                <Typography 
                  variant="caption" 
                  sx={{ 
                    fontWeight: 600, 
                    opacity: 0.9,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    fontSize: '0.7rem',
                  }}
                >
                  TOTAL BALANCE
                </Typography>
              </Box>
              <Typography 
                variant="h4" 
                sx={{ 
                  fontWeight: 700, 
                  mb: 1,
                  position: 'relative', 
                  zIndex: 1,
                  letterSpacing: '-0.02em',
                }}
              >
                {balance?.baseCoinsFormatted || '0 SMR'}
              </Typography>
              <Box sx={{ display: 'flex', gap: 1.5, mt: 2.5, position: 'relative', zIndex: 1 }}>
                <Button
                  variant="contained"
                  disableElevation
                  size="small"
                  startIcon={<ArrowUpIcon />}
                  sx={{
                    borderRadius: '12px',
                    textTransform: 'none',
                    fontWeight: 600,
                    px: 2,
                    py: 0.8,
                    fontSize: '0.875rem',
                    boxShadow: theme.palette.mode === 'dark' 
                      ? '0 4px 12px rgba(0, 0, 0, 0.3)' 
                      : '0 4px 12px rgba(90, 48, 181, 0.2)',
                    background: theme.palette.mode === 'dark'
                      ? `linear-gradient(90deg, ${alpha(theme.palette.primary.main, 0.9)} 0%, ${alpha(theme.palette.primary.dark, 0.9)} 100%)`
                      : `linear-gradient(90deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
                    border: `1px solid ${theme.palette.mode === 'dark' 
                      ? alpha(theme.palette.primary.light, 0.2) 
                      : alpha(theme.palette.primary.dark, 0.2)}`,
                    transition: 'all 0.25s ease',
                    '&:hover': {
                      boxShadow: theme.palette.mode === 'dark' 
                        ? '0 6px 16px rgba(0, 0, 0, 0.4)' 
                        : '0 6px 16px rgba(90, 48, 181, 0.3)',
                      transform: 'translateY(-2px)',
                    },
                  }}
                >
                  Send
                </Button>
                <Button
                  variant="contained"
                  disableElevation
                  size="small"
                  color="secondary"
                  startIcon={<ArrowDownIcon />}
                  sx={{
                    borderRadius: '12px',
                    textTransform: 'none',
                    fontWeight: 600,
                    px: 2,
                    py: 0.8,
                    fontSize: '0.875rem',
                    boxShadow: theme.palette.mode === 'dark' 
                      ? '0 4px 12px rgba(0, 0, 0, 0.3)' 
                      : '0 4px 12px rgba(0, 191, 165, 0.2)',
                    background: theme.palette.mode === 'dark'
                      ? `linear-gradient(90deg, ${alpha(theme.palette.secondary.main, 0.9)} 0%, ${alpha(theme.palette.secondary.dark, 0.9)} 100%)`
                      : `linear-gradient(90deg, ${theme.palette.secondary.main} 0%, ${theme.palette.secondary.dark} 100%)`,
                    border: `1px solid ${theme.palette.mode === 'dark' 
                      ? alpha(theme.palette.secondary.light, 0.2) 
                      : alpha(theme.palette.secondary.dark, 0.2)}`,
                    transition: 'all 0.25s ease',
                    '&:hover': {
                      boxShadow: theme.palette.mode === 'dark' 
                        ? '0 6px 16px rgba(0, 0, 0, 0.4)' 
                        : '0 6px 16px rgba(0, 191, 165, 0.3)',
                      transform: 'translateY(-2px)',
                    },
                  }}
                >
                  Receive
                </Button>
                <Tooltip title="Quick Actions" arrow>
                  <IconButton
                    size="small"
                    sx={{
                      backgroundColor: theme.palette.mode === 'dark' 
                        ? alpha(theme.palette.common.white, 0.15) 
                        : alpha(theme.palette.common.white, 0.9),
                      border: `1px solid ${theme.palette.mode === 'dark' 
                        ? alpha(theme.palette.common.white, 0.2) 
                        : alpha(theme.palette.common.black, 0.08)}`,
                      width: 34,
                      height: 34,
                      borderRadius: '10px',
                      transition: 'all 0.25s ease',
                      '&:hover': {
                        backgroundColor: theme.palette.mode === 'dark' 
                          ? alpha(theme.palette.common.white, 0.25) 
                          : alpha(theme.palette.common.white, 1),
                        transform: 'translateY(-2px)',
                        boxShadow: '0 4px 8px rgba(0,0,0,0.15)',
                      },
                      boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
                    }}
                  >
                    <BoltIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
            </Box>
              
            {balance?.nativeTokens?.length > 0 && (
              <Box
                sx={{
                  mt: 2.5,
                  p: 2.5,
                  borderRadius: '16px',
                  backgroundColor: theme.palette.mode === 'dark' 
                    ? alpha(theme.palette.common.white, 0.05) 
                    : alpha(theme.palette.background.subtle, 0.7),
                  border: `1px solid ${theme.palette.mode === 'dark' 
                    ? alpha(theme.palette.secondary.main, 0.2) 
                    : alpha(theme.palette.secondary.light, 0.4)}`,
                  boxShadow: theme.palette.mode === 'dark' 
                    ? '0 4px 20px rgba(0, 0, 0, 0.15)' 
                    : '0 4px 20px rgba(0, 191, 165, 0.1)',
                  position: 'relative',
                  overflow: 'hidden',
                  '&::before': {
                    content: '""',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: '100%',
                    background: theme.palette.mode === 'dark'
                      ? 'linear-gradient(to right, rgba(0, 191, 165, 0.1) 0%, rgba(90, 48, 181, 0.05) 100%)'
                      : 'linear-gradient(to right, rgba(0, 191, 165, 0.05) 0%, rgba(90, 48, 181, 0.02) 100%)',
                    opacity: 0.8,
                    zIndex: 0,
                  },
                }}
              >
                <Typography 
                  variant="caption" 
                  sx={{ 
                    fontWeight: 600, 
                    opacity: 0.9,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    fontSize: '0.7rem',
                    display: 'block', 
                    mb: 1.5,
                    position: 'relative',
                    zIndex: 1,
                  }}
                >
                  NATIVE TOKENS
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, position: 'relative', zIndex: 1 }}>
                  {balance.nativeTokens.map((token, index) => (
                    <Chip
                      key={index}
                      label={`${token.id.substring(0, 6)}... (${token.amount})`}
                      size="small"
                      sx={{
                        fontSize: '0.75rem',
                        fontWeight: 500,
                        borderRadius: '10px',
                        backgroundColor: theme.palette.mode === 'dark' 
                          ? alpha(theme.palette.secondary.main, 0.2) 
                          : alpha(theme.palette.secondary.light, 0.15),
                        color: theme.palette.mode === 'dark' 
                          ? theme.palette.secondary.light 
                          : theme.palette.secondary.dark,
                        border: `1px solid ${theme.palette.mode === 'dark' 
                          ? alpha(theme.palette.secondary.main, 0.4) 
                          : alpha(theme.palette.secondary.light, 0.4)}`,
                        transition: 'all 0.2s ease',
                        py: 0.8,
                        '&:hover': {
                          backgroundColor: theme.palette.mode === 'dark' 
                            ? alpha(theme.palette.secondary.main, 0.3) 
                            : alpha(theme.palette.secondary.light, 0.25),
                          transform: 'translateY(-1px)',
                        }
                      }}
                    />
                  ))}
                </Box>
              </Box>
            )}
          </CardContent>
        </>
      ) : (
        <CardContent sx={{ p: 3.5, textAlign: 'center' }}>
          <Box
            sx={{
              width: 96,
              height: 96,
              borderRadius: '50%',
              background: theme.palette.mode === 'dark'
                ? `linear-gradient(135deg, ${alpha(theme.palette.primary.dark, 0.5)} 0%, ${alpha(theme.palette.primary.main, 0.2)} 100%)`
                : `linear-gradient(135deg, ${alpha(theme.palette.primary.light, 0.4)} 0%, ${alpha(theme.palette.primary.main, 0.1)} 100%)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mx: 'auto',
              mb: 3,
              boxShadow: `0 8px 30px ${theme.palette.mode === 'dark' 
                ? 'rgba(0,0,0,0.3)' 
                : 'rgba(90,48,181,0.15)'}`,
              border: `2px solid ${theme.palette.mode === 'dark' 
                ? alpha(theme.palette.primary.main, 0.4) 
                : alpha(theme.palette.primary.light, 0.6)}`,
              animation: 'pulse-subtle 3s infinite',
              '@keyframes pulse-subtle': {
                '0%': { boxShadow: `0 8px 30px ${theme.palette.mode === 'dark' 
                  ? 'rgba(0,0,0,0.3)' 
                  : 'rgba(90,48,181,0.15)'}` },
                '50%': { boxShadow: `0 8px 30px ${theme.palette.mode === 'dark' 
                  ? 'rgba(90,48,181,0.4)' 
                  : 'rgba(90,48,181,0.25)'}` },
                '100%': { boxShadow: `0 8px 30px ${theme.palette.mode === 'dark' 
                  ? 'rgba(0,0,0,0.3)' 
                  : 'rgba(90,48,181,0.15)'}` },
              },
            }}
          >
            <WalletIcon
              sx={{
                fontSize: 48,
                color: theme.palette.mode === 'dark' 
                  ? alpha(theme.palette.primary.light, 0.9) 
                  : theme.palette.primary.main,
                filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))',
              }}
            />
          </Box>
          
          <Typography 
            variant="h5" 
            sx={{ 
              mb: 1.5, 
              fontWeight: 700,
              letterSpacing: '-0.02em',
            }}
          >
            Connect Wallet
          </Typography>
          
          <Typography 
            variant="body1"
            color="text.secondary"
            sx={{ 
              mb: 3.5,
              mx: 'auto',
              maxWidth: '85%',
              lineHeight: 1.6,
              fontSize: '0.95rem',
            }}
          >
            Connect your IOTA wallet to access IntelliLend and start managing your digital assets with AI-powered tools
          </Typography>
          
          {connectionError && (
            <Box
              sx={{
                mb: 3,
                p: 2.5,
                borderRadius: '14px',
                bgcolor: alpha(theme.palette.error.main, 0.1),
                border: `1px solid ${alpha(theme.palette.error.main, 0.3)}`,
                display: 'flex',
                alignItems: 'center',
                boxShadow: `0 4px 12px ${alpha(theme.palette.error.main, 0.15)}`,
              }}
            >
              <ErrorIcon color="error" sx={{ mr: 1.5, fontSize: 22 }} />
              <Typography 
                variant="body2" 
                color="error.main"
                sx={{ fontWeight: 500 }}
              >
                {connectionError}
              </Typography>
            </Box>
          )}
          
          <Button
            variant="contained"
            disableElevation
            fullWidth
            onClick={handleConnectWallet}
            disabled={isConnecting}
            sx={{
              borderRadius: '14px',
              py: 1.5,
              fontWeight: 600,
              fontSize: '1rem',
              boxShadow: theme.palette.mode === 'dark' 
                ? '0 4px 20px rgba(0, 0, 0, 0.4)' 
                : '0 4px 20px rgba(90, 48, 181, 0.25)',
              background: theme.palette.mode === 'dark'
                ? `linear-gradient(90deg, ${alpha(theme.palette.primary.main, 0.95)} 0%, ${alpha(theme.palette.secondary.dark, 0.95)} 100%)`
                : `linear-gradient(90deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.dark} 100%)`,
              border: `1px solid ${theme.palette.mode === 'dark' 
                ? alpha(theme.palette.primary.light, 0.2) 
                : alpha(theme.palette.primary.dark, 0.2)}`,
              transition: 'all 0.3s ease',
              '&:hover': {
                boxShadow: theme.palette.mode === 'dark' 
                  ? '0 8px 30px rgba(0, 0, 0, 0.5)' 
                  : '0 8px 30px rgba(90, 48, 181, 0.35)',
                transform: 'translateY(-3px)',
                background: theme.palette.mode === 'dark'
                  ? `linear-gradient(90deg, ${alpha(theme.palette.primary.light, 0.95)} 0%, ${alpha(theme.palette.secondary.main, 0.95)} 100%)`
                  : `linear-gradient(90deg, ${theme.palette.primary.light} 0%, ${theme.palette.secondary.main} 100%)`,
              },
              '&:active': {
                transform: 'translateY(-1px)',
                boxShadow: theme.palette.mode === 'dark' 
                  ? '0 4px 20px rgba(0, 0, 0, 0.4)' 
                  : '0 4px 20px rgba(90, 48, 181, 0.25)',
              },
              '&.Mui-disabled': {
                background: theme.palette.mode === 'dark'
                  ? 'rgba(255, 255, 255, 0.12)'
                  : 'rgba(0, 0, 0, 0.12)',
              }
            }}
            startIcon={
              <WalletIcon 
                sx={{ 
                  fontSize: '1.5rem',
                  filter: 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3))',
                }} 
              />
            }
          >
            {isConnecting ? 'Connecting...' : 'Connect Wallet'}
          </Button>
          
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', mt: 4, gap: 1.5 }}>
            <Tooltip title="Firefly Wallet" arrow>
              <Chip
                label="Firefly"
                size="small"
                sx={{
                  borderRadius: '10px',
                  height: 28,
                  backgroundColor: theme.palette.mode === 'dark' ? alpha('#0FC1B7', 0.2) : alpha('#0FC1B7', 0.1),
                  color: '#0FC1B7',
                  border: `1px solid ${alpha('#0FC1B7', 0.4)}`,
                  fontWeight: 600,
                  fontSize: '0.75rem',
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    backgroundColor: theme.palette.mode === 'dark' ? alpha('#0FC1B7', 0.3) : alpha('#0FC1B7', 0.15),
                    transform: 'translateY(-1px)',
                    boxShadow: `0 2px 6px ${alpha('#0FC1B7', 0.3)}`,
                  }
                }}
              />
            </Tooltip>
            <Tooltip title="TanglePay Wallet" arrow>
              <Chip
                label="TanglePay"
                size="small"
                sx={{
                  borderRadius: '10px',
                  height: 28,
                  backgroundColor: theme.palette.mode === 'dark' ? alpha('#3568DD', 0.2) : alpha('#3568DD', 0.1),
                  color: '#3568DD',
                  border: `1px solid ${alpha('#3568DD', 0.4)}`,
                  fontWeight: 600,
                  fontSize: '0.75rem',
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    backgroundColor: theme.palette.mode === 'dark' ? alpha('#3568DD', 0.3) : alpha('#3568DD', 0.15),
                    transform: 'translateY(-1px)',
                    boxShadow: `0 2px 6px ${alpha('#3568DD', 0.3)}`,
                  }
                }}
              />
            </Tooltip>
            <Tooltip title="Bloom Wallet" arrow>
              <Chip
                label="Bloom"
                size="small"
                sx={{
                  borderRadius: '10px',
                  height: 28,
                  backgroundColor: theme.palette.mode === 'dark' ? alpha('#8962FF', 0.2) : alpha('#8962FF', 0.1),
                  color: '#8962FF',
                  border: `1px solid ${alpha('#8962FF', 0.4)}`,
                  fontWeight: 600,
                  fontSize: '0.75rem',
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    backgroundColor: theme.palette.mode === 'dark' ? alpha('#8962FF', 0.3) : alpha('#8962FF', 0.15),
                    transform: 'translateY(-1px)',
                    boxShadow: `0 2px 6px ${alpha('#8962FF', 0.3)}`,
                  }
                }}
              />
            </Tooltip>
          </Box>
        </CardContent>
      )}
    </Card>
  );
};

export default WalletStatus;