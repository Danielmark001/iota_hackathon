import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  Grid, 
  Card, 
  CardContent, 
  CardHeader,
  Divider,
  Button,
  TextField,
  MenuItem,
  InputAdornment,
  Slider,
  Stack,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Avatar,
  CircularProgress,
  Alert,
  Paper,
  alpha,
  useTheme,
  useMediaQuery,
  IconButton,
  Tooltip,
  Tab,
  Tabs
} from '@mui/material';
import { 
  ArrowForward as ArrowForwardIcon,
  ArrowUpward as ArrowUpwardIcon,
  Info as InfoIcon,
  AccountBalance as AccountBalanceIcon,
  History as HistoryIcon,
  CalendarToday as CalendarTodayIcon,
  Warning as WarningIcon,
  Check as CheckIcon,
  VerifiedUser as VerifiedUserIcon,
  LocalAtm as LocalAtmIcon,
  Percent as PercentIcon,
  Update as UpdateIcon
} from '@mui/icons-material';
import { useWeb3 } from '../context/Web3Context';
import ConnectionErrorFallback from '../components/ui/ConnectionErrorFallback';
import { useNavigate } from 'react-router-dom';

// Mock assets data
const mockAssets = [
  { 
    name: 'IOTA', 
    symbol: 'MIOTA', 
    icon: '/assets/tokens/iota.svg', 
    balance: 4500, 
    balanceUsd: 1209.15,
    depositRate: 4.2,
    liquidityAvailable: 2500000,
    color: '#00BFA5'
  },
  { 
    name: 'Ethereum', 
    symbol: 'ETH', 
    icon: '/assets/tokens/eth.svg', 
    balance: 0.542, 
    balanceUsd: 1001.98,
    depositRate: 2.8,
    liquidityAvailable: 5000000,
    color: '#627EEA'
  },
  { 
    name: 'USDT', 
    symbol: 'USDT', 
    icon: '/assets/tokens/usdt.svg', 
    balance: 2500, 
    balanceUsd: 2500,
    depositRate: 5.1,
    liquidityAvailable: 10000000,
    color: '#26A17B'
  },
  { 
    name: 'USDC', 
    symbol: 'USDC', 
    icon: '/assets/tokens/usdc.svg', 
    balance: 1800, 
    balanceUsd: 1800,
    depositRate: 4.9,
    liquidityAvailable: 8000000,
    color: '#2775CA'
  }
];

// Mock deposit history
const mockDepositHistory = [
  {
    token: 'IOTA',
    amount: 1500,
    amountUsd: 402.75,
    timestamp: '2025-04-25T14:32:10Z',
    status: 'completed',
    txHash: '0x1a2b3c4d5e6f7g8h9i0j'
  },
  {
    token: 'ETH',
    amount: 0.25,
    amountUsd: 462.5,
    timestamp: '2025-04-20T09:15:45Z',
    status: 'completed',
    txHash: '0xk1l2m3n4o5p6q7r8s9t0'
  },
  {
    token: 'USDT',
    amount: 500,
    amountUsd: 500,
    timestamp: '2025-04-15T18:45:22Z',
    status: 'completed',
    txHash: '0xu1v2w3x4y5z6a7b8c9d0'
  }
];

// Deposit component with improved UI
const Deposit = () => {
  const { connectionError, connectWallet, isConnected, useMockData } = useWeb3();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isTablet = useMediaQuery(theme.breakpoints.down('lg'));
  const navigate = useNavigate();
  
  // Component state
  const [selectedAsset, setSelectedAsset] = useState(mockAssets[0]);
  const [depositAmount, setDepositAmount] = useState('');
  const [depositAmountUsd, setDepositAmountUsd] = useState('');
  const [sliderValue, setSliderValue] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [depositSuccess, setDepositSuccess] = useState(false);
  const [tabValue, setTabValue] = useState(0);
  
  // Calculate USD value when deposit amount changes
  useEffect(() => {
    if (depositAmount && !isNaN(depositAmount) && selectedAsset) {
      const price = selectedAsset.balanceUsd / selectedAsset.balance;
      setDepositAmountUsd((parseFloat(depositAmount) * price).toFixed(2));
    } else {
      setDepositAmountUsd('');
    }
  }, [depositAmount, selectedAsset]);
  
  // Handle asset selection change
  const handleAssetChange = (event) => {
    const selected = mockAssets.find(asset => asset.symbol === event.target.value);
    setSelectedAsset(selected);
    setDepositAmount('');
    setSliderValue(0);
  };
  
  // Handle direct amount input
  const handleAmountChange = (event) => {
    const value = event.target.value;
    if (value === '' || (/^\d*\.?\d*$/.test(value) && !isNaN(value))) {
      setDepositAmount(value);
      
      // Update slider value
      if (value === '' || parseFloat(value) === 0) {
        setSliderValue(0);
      } else if (selectedAsset && selectedAsset.balance > 0) {
        const percentage = Math.min((parseFloat(value) / selectedAsset.balance) * 100, 100);
        setSliderValue(percentage);
      }
    }
  };
  
  // Handle slider change
  const handleSliderChange = (event, newValue) => {
    setSliderValue(newValue);
    
    if (selectedAsset && selectedAsset.balance > 0) {
      const amount = (selectedAsset.balance * newValue / 100).toFixed(
        selectedAsset.symbol === 'MIOTA' ? 0 : 
        selectedAsset.symbol === 'ETH' ? 6 : 2
      );
      setDepositAmount(amount);
    }
  };
  
  // Handle deposit submission
  const handleDeposit = () => {
    if (!depositAmount || parseFloat(depositAmount) <= 0) return;
    
    setIsProcessing(true);
    
    // Simulate deposit process
    setTimeout(() => {
      setIsProcessing(false);
      setDepositSuccess(true);
      
      // Reset form after 3 seconds
      setTimeout(() => {
        setDepositSuccess(false);
        setDepositAmount('');
        setSliderValue(0);
      }, 3000);
    }, 2000);
  };
  
  // Handle tab change
  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };
  
  // Format timestamp
  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };
  
  if (connectionError) {
    return <ConnectionErrorFallback onRetry={connectWallet} />;
  }

  return (
    <Box>
      <Typography variant="h4" component="h1" fontWeight={700} gutterBottom sx={{
        background: 'linear-gradient(90deg, #4C3F91 0%, #00BFA5 100%)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        display: 'inline-block',
      }}>
        Deposit Assets
      </Typography>
      <Typography variant="body1" color="text.secondary" paragraph>
        Deposit your assets to earn interest and use as collateral for borrowing.
      </Typography>
      
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs 
          value={tabValue} 
          onChange={handleTabChange}
          sx={{
            '& .MuiTabs-indicator': {
              height: 3,
              borderRadius: '3px 3px 0 0',
              background: 'linear-gradient(90deg, #4C3F91, #00BFA5)',
            },
            '& .MuiTab-root': {
              fontWeight: 600,
              textTransform: 'none',
              transition: 'all 0.2s ease',
              '&:hover': {
                backgroundColor: alpha(theme.palette.primary.main, 0.05),
              },
            },
          }}
        >
          <Tab label="Deposit" />
          <Tab label="Your Deposits" />
        </Tabs>
      </Box>
      
      {tabValue === 0 ? (
        <Grid container spacing={3}>
          {/* Deposit Form */}
          <Grid item xs={12} md={7} lg={8}>
            <Card 
              elevation={0}
              sx={{ 
                borderRadius: '16px', 
                border: `1px solid ${alpha(theme.palette.divider, 0.8)}`,
                boxShadow: `0 4px 20px ${alpha(theme.palette.common.black, 0.05)}`,
                position: 'relative',
                overflow: 'hidden',
                transition: 'all 0.3s ease',
                '&:hover': {
                  boxShadow: `0 8px 25px ${alpha(theme.palette.common.black, 0.08)}`,
                  borderColor: alpha(theme.palette.primary.main, 0.2),
                },
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: '8px',
                  background: 'linear-gradient(90deg, #4C3F91, #00BFA5)',
                  borderRadius: '16px 16px 0 0',
                }
              }}
            >
              <CardHeader 
                title="Deposit Form" 
                titleTypographyProps={{ 
                  variant: 'h6', 
                  fontWeight: 600,
                  sx: { mt: 0.5 }
                }}
                action={
                  <Tooltip title="Deposits earn interest and can be used as collateral for borrowing">
                    <IconButton size="small">
                      <InfoIcon />
                    </IconButton>
                  </Tooltip>
                }
              />
              <Divider />
              <CardContent>
                {isConnected || useMockData ? (
                  depositSuccess ? (
                    <Box sx={{ textAlign: 'center', py: 4 }}>
                      <Avatar
                        sx={{
                          width: 60,
                          height: 60,
                          backgroundColor: 'success.light',
                          margin: '0 auto 16px',
                        }}
                      >
                        <CheckIcon fontSize="large" />
                      </Avatar>
                      <Typography variant="h6" gutterBottom>
                        Deposit Successful!
                      </Typography>
                      <Typography variant="body2" color="text.secondary" paragraph>
                        You have successfully deposited {depositAmount} {selectedAsset?.symbol} (${depositAmountUsd})
                      </Typography>
                      <Button
                        variant="outlined"
                        onClick={() => setTabValue(1)}
                        startIcon={<HistoryIcon />}
                        sx={{ mt: 2, borderRadius: '10px' }}
                      >
                        View Transaction History
                      </Button>
                    </Box>
                  ) : (
                    <Box>
                      {/* Asset Selection */}
                      <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                        Select Asset
                      </Typography>
                      <TextField
                        select
                        fullWidth
                        value={selectedAsset?.symbol || ''}
                        onChange={handleAssetChange}
                        sx={{ 
                          mb: 3,
                          '& .MuiOutlinedInput-root': {
                            borderRadius: '10px',
                          }
                        }}
                        SelectProps={{
                          MenuProps: {
                            PaperProps: {
                              sx: { 
                                borderRadius: '10px',
                                mt: 0.5,
                                boxShadow: '0 8px 20px rgba(0,0,0,0.1)',
                              }
                            }
                          }
                        }}
                      >
                        {mockAssets.map((asset) => (
                          <MenuItem key={asset.symbol} value={asset.symbol}>
                            <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                              <Box
                                component="img"
                                src={asset.icon}
                                alt={asset.symbol}
                                sx={{ 
                                  width: 24, 
                                  height: 24, 
                                  mr: 1,
                                  borderRadius: '50%',
                                }}
                                onError={(e) => {
                                  e.target.src = `https://via.placeholder.com/24/CCCCCC/FFFFFF?text=${asset.symbol.charAt(0)}`;
                                }}
                              />
                              <Box sx={{ flexGrow: 1 }}>
                                <Typography variant="body2" fontWeight={500}>
                                  {asset.name} ({asset.symbol})
                                </Typography>
                              </Box>
                              <Typography variant="body2" color="text.secondary">
                                Balance: {asset.balance.toLocaleString()} {asset.symbol}
                              </Typography>
                            </Box>
                          </MenuItem>
                        ))}
                      </TextField>
                      
                      {/* Amount Input */}
                      <Grid container spacing={2} sx={{ mb: 2 }}>
                        <Grid item xs={12} sm={6}>
                          <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                            Amount
                          </Typography>
                          <TextField
                            fullWidth
                            value={depositAmount}
                            onChange={handleAmountChange}
                            placeholder="0.00"
                            InputProps={{
                              endAdornment: (
                                <InputAdornment position="end">
                                  <Typography fontWeight={500}>{selectedAsset?.symbol}</Typography>
                                </InputAdornment>
                              ),
                              sx: {
                                borderRadius: '10px',
                              }
                            }}
                            sx={{ mb: 1 }}
                          />
                          {selectedAsset && (
                            <Typography variant="caption" color="text.secondary">
                              Available: {selectedAsset.balance.toLocaleString()} {selectedAsset.symbol}
                            </Typography>
                          )}
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                            Value in USD
                          </Typography>
                          <TextField
                            fullWidth
                            value={depositAmountUsd}
                            disabled
                            InputProps={{
                              startAdornment: (
                                <InputAdornment position="start">$</InputAdornment>
                              ),
                              sx: {
                                borderRadius: '10px',
                                bgcolor: alpha(theme.palette.action.disabled, 0.05)
                              }
                            }}
                            sx={{ mb: 1 }}
                          />
                        </Grid>
                      </Grid>
                      
                      {/* Amount Slider */}
                      <Box sx={{ px: 1, mb: 3 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                          <Typography variant="body2" color="text.secondary">0%</Typography>
                          <Typography variant="body2" color="text.secondary">100%</Typography>
                        </Box>
                        <Slider
                          value={sliderValue}
                          onChange={handleSliderChange}
                          sx={{
                            color: selectedAsset?.color || theme.palette.primary.main,
                            '& .MuiSlider-thumb': {
                              width: 20,
                              height: 20,
                              backgroundColor: '#fff',
                              border: `2px solid ${selectedAsset?.color || theme.palette.primary.main}`,
                              '&:hover, &.Mui-focusVisible': {
                                boxShadow: `0px 0px 0px 8px ${alpha(selectedAsset?.color || theme.palette.primary.main, 0.1)}`
                              }
                            }
                          }}
                        />
                        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 1 }}>
                          <Chip 
                            label={`${sliderValue}%`} 
                            size="small" 
                            sx={{ 
                              fontWeight: 600,
                              bgcolor: alpha(selectedAsset?.color || theme.palette.primary.main, 0.1),
                              color: selectedAsset?.color || theme.palette.primary.main,
                              borderRadius: '8px',
                            }} 
                          />
                        </Box>
                      </Box>
                      
                      {/* Quick Amount Buttons */}
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 3 }}>
                        {[25, 50, 75, 100].map((percent) => (
                          <Button
                            key={percent}
                            variant="outlined"
                            size="small"
                            onClick={() => handleSliderChange(null, percent)}
                            sx={{
                              borderRadius: '8px',
                              borderColor: alpha(selectedAsset?.color || theme.palette.primary.main, 0.5),
                              color: selectedAsset?.color || theme.palette.primary.main,
                              '&:hover': {
                                borderColor: selectedAsset?.color || theme.palette.primary.main,
                                backgroundColor: alpha(selectedAsset?.color || theme.palette.primary.main, 0.05),
                              }
                            }}
                          >
                            {percent}%
                          </Button>
                        ))}
                      </Box>
                      
                      {/* Deposit Information */}
                      <Paper
                        elevation={0}
                        sx={{
                          p: 2,
                          mb: 3,
                          borderRadius: '12px',
                          bgcolor: theme.palette.mode === 'dark' 
                            ? alpha(theme.palette.primary.main, 0.05) 
                            : alpha(theme.palette.primary.light, 0.05),
                          border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                          <Chip 
                            size="small" 
                            icon={<PercentIcon />} 
                            label="Interest Rate" 
                            sx={{ 
                              borderRadius: '6px',
                              backgroundColor: theme.palette.mode === 'dark' 
                                ? alpha(theme.palette.primary.main, 0.1) 
                                : alpha(theme.palette.primary.light, 0.2),
                              color: theme.palette.mode === 'dark' 
                                ? theme.palette.primary.light 
                                : theme.palette.primary.dark,
                              fontWeight: 500,
                              fontSize: '0.75rem',
                              '& .MuiChip-icon': {
                                color: 'inherit'
                              }
                            }} 
                          />
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'baseline' }}>
                          <Typography variant="h5" fontWeight={700} color="primary">
                            {selectedAsset?.depositRate}%
                          </Typography>
                          <Typography variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                            APY
                          </Typography>
                        </Box>
                        <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                          Deposit this asset to earn interest and use as collateral for borrowing. 
                          Interest accrues daily and is distributed automatically.
                        </Typography>
                      </Paper>
                      
                      {/* Submit Button */}
                      <Button
                        variant="contained"
                        fullWidth
                        size="large"
                        startIcon={isProcessing ? null : <ArrowUpwardIcon />}
                        onClick={handleDeposit}
                        disabled={!depositAmount || parseFloat(depositAmount) <= 0 || isProcessing}
                        sx={{
                          borderRadius: '10px',
                          py: 1.5,
                          background: `linear-gradient(90deg, ${selectedAsset?.color || '#4C3F91'}, ${alpha(selectedAsset?.color || '#00BFA5', 0.8)})`,
                          transition: 'all 0.3s ease',
                          position: 'relative',
                          overflow: 'hidden',
                          '&::before': !isProcessing && {
                            content: '""',
                            position: 'absolute',
                            top: 0,
                            left: '-100%',
                            width: '100%',
                            height: '100%',
                            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)',
                            transition: 'all 0.5s ease',
                          },
                          '&:hover::before': !isProcessing && {
                            left: '100%',
                          }
                        }}
                      >
                        {isProcessing ? (
                          <CircularProgress size={24} color="inherit" />
                        ) : (
                          'Deposit'
                        )}
                      </Button>
                    </Box>
                  )
                ) : (
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 4 }}>
                    <AccountBalanceIcon sx={{ fontSize: 48, color: 'primary.main', mb: 2, opacity: 0.7 }} />
                    <Typography variant="body1" gutterBottom align="center">
                      Connect your wallet to make deposits
                    </Typography>
                    <Button 
                      variant="contained"
                      onClick={connectWallet}
                      sx={{ mt: 2, borderRadius: '10px' }}
                    >
                      Connect Wallet
                    </Button>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>
          
          {/* Information Card */}
          <Grid item xs={12} md={5} lg={4}>
            <Card 
              elevation={0}
              sx={{ 
                borderRadius: '16px', 
                border: `1px solid ${alpha(theme.palette.divider, 0.8)}`,
                boxShadow: `0 4px 20px ${alpha(theme.palette.common.black, 0.05)}`,
                transition: 'all 0.3s ease',
                '&:hover': {
                  boxShadow: `0 8px 25px ${alpha(theme.palette.common.black, 0.08)}`,
                  borderColor: alpha(theme.palette.primary.main, 0.2),
                }
              }}
            >
              <CardHeader 
                title="Deposit Information" 
                titleTypographyProps={{ variant: 'h6', fontWeight: 600 }}
              />
              <Divider />
              <CardContent>
                <List disablePadding>
                  <ListItem sx={{ px: 0, py: 1.5 }}>
                    <ListItemIcon sx={{ minWidth: 42 }}>
                      <Avatar sx={{ bgcolor: alpha(theme.palette.success.main, 0.1), color: theme.palette.success.main, width: 34, height: 34 }}>
                        <PercentIcon fontSize="small" />
                      </Avatar>
                    </ListItemIcon>
                    <ListItemText 
                      primary="Earn Interest" 
                      secondary="Earn competitive interest rates on your deposited assets"
                      primaryTypographyProps={{ fontWeight: 600 }}
                    />
                  </ListItem>
                  <Divider component="li" />
                  <ListItem sx={{ px: 0, py: 1.5 }}>
                    <ListItemIcon sx={{ minWidth: 42 }}>
                      <Avatar sx={{ bgcolor: alpha(theme.palette.info.main, 0.1), color: theme.palette.info.main, width: 34, height: 34 }}>
                        <VerifiedUserIcon fontSize="small" />
                      </Avatar>
                    </ListItemIcon>
                    <ListItemText 
                      primary="Use as Collateral" 
                      secondary="Deposited assets can be used as collateral for borrowing"
                      primaryTypographyProps={{ fontWeight: 600 }}
                    />
                  </ListItem>
                  <Divider component="li" />
                  <ListItem sx={{ px: 0, py: 1.5 }}>
                    <ListItemIcon sx={{ minWidth: 42 }}>
                      <Avatar sx={{ bgcolor: alpha(theme.palette.warning.main, 0.1), color: theme.palette.warning.main, width: 34, height: 34 }}>
                        <UpdateIcon fontSize="small" />
                      </Avatar>
                    </ListItemIcon>
                    <ListItemText 
                      primary="Flexible Withdrawals" 
                      secondary="Withdraw your assets at any time, subject to available liquidity"
                      primaryTypographyProps={{ fontWeight: 600 }}
                    />
                  </ListItem>
                  <Divider component="li" />
                  <ListItem sx={{ px: 0, py: 1.5 }}>
                    <ListItemIcon sx={{ minWidth: 42 }}>
                      <Avatar sx={{ bgcolor: alpha(theme.palette.primary.main, 0.1), color: theme.palette.primary.main, width: 34, height: 34 }}>
                        <LocalAtmIcon fontSize="small" />
                      </Avatar>
                    </ListItemIcon>
                    <ListItemText 
                      primary="Daily Interest" 
                      secondary="Interest accrues daily and is automatically added to your balance"
                      primaryTypographyProps={{ fontWeight: 600 }}
                    />
                  </ListItem>
                </List>
                
                <Alert 
                  severity="info" 
                  sx={{ 
                    mt: 2, 
                    borderRadius: '10px',
                    backgroundColor: alpha(theme.palette.info.main, 0.05),
                    border: `1px solid ${alpha(theme.palette.info.main, 0.2)}`,
                    '& .MuiAlert-icon': {
                      color: theme.palette.info.main
                    }
                  }}
                >
                  <Typography variant="body2">
                    Remember to consider the risk profile of assets before depositing.
                  </Typography>
                </Alert>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      ) : (
        <Grid container spacing={3}>
          {/* Deposit History */}
          <Grid item xs={12}>
            <Card 
              elevation={0}
              sx={{ 
                borderRadius: '16px', 
                border: `1px solid ${alpha(theme.palette.divider, 0.8)}`,
                boxShadow: `0 4px 20px ${alpha(theme.palette.common.black, 0.05)}`,
                position: 'relative',
                overflow: 'hidden',
                transition: 'all 0.3s ease',
                '&:hover': {
                  boxShadow: `0 8px 25px ${alpha(theme.palette.common.black, 0.08)}`,
                  borderColor: alpha(theme.palette.primary.main, 0.2),
                },
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: '8px',
                  background: 'linear-gradient(90deg, #4C3F91, #00BFA5)',
                  borderRadius: '16px 16px 0 0',
                }
              }}
            >
              <CardHeader 
                title="Your Deposits" 
                titleTypographyProps={{ 
                  variant: 'h6', 
                  fontWeight: 600,
                  sx: { mt: 0.5 }
                }}
                action={
                  <Button 
                    startIcon={<UpdateIcon />}
                    sx={{ borderRadius: '10px' }}
                  >
                    Refresh
                  </Button>
                }
              />
              <Divider />
              <CardContent>
                {isConnected || useMockData ? (
                  <>
                    <Box sx={{ mb: 3 }}>
                      <Typography variant="subtitle2" gutterBottom>
                        Active Deposits
                      </Typography>
                      <Grid container spacing={2}>
                        {mockAssets.filter(asset => asset.balance > 0).map((asset) => (
                          <Grid item xs={12} sm={6} md={4} lg={3} key={asset.symbol}>
                            <Paper
                              elevation={0}
                              sx={{
                                p: 2,
                                borderRadius: '12px',
                                border: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
                                background: theme.palette.mode === 'dark'
                                  ? `linear-gradient(135deg, ${alpha(asset.color, 0.15)} 0%, ${alpha(theme.palette.background.paper, 0.9)} 100%)`
                                  : `linear-gradient(135deg, ${alpha(asset.color, 0.07)} 0%, ${theme.palette.background.paper} 100%)`,
                                position: 'relative',
                                overflow: 'hidden',
                                '&::after': {
                                  content: '""',
                                  position: 'absolute',
                                  bottom: 0,
                                  right: 0,
                                  width: 60,
                                  height: 60,
                                  borderRadius: '50%',
                                  background: `radial-gradient(circle, ${alpha(asset.color, 0.15)} 0%, transparent 70%)`,
                                  pointerEvents: 'none',
                                }
                              }}
                            >
                              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                                <Box
                                  component="img"
                                  src={asset.icon}
                                  alt={asset.symbol}
                                  sx={{ 
                                    width: 28, 
                                    height: 28, 
                                    mr: 1,
                                    borderRadius: '50%',
                                  }}
                                  onError={(e) => {
                                    e.target.src = `https://via.placeholder.com/28/CCCCCC/FFFFFF?text=${asset.symbol.charAt(0)}`;
                                  }}
                                />
                                <Typography variant="subtitle2" fontWeight={600}>
                                  {asset.symbol}
                                </Typography>
                              </Box>
                              <Typography variant="h6" fontWeight={700} gutterBottom>
                                {asset.balance.toLocaleString()}
                              </Typography>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                                <Typography variant="body2" color="text.secondary">
                                  ${asset.balanceUsd.toLocaleString()}
                                </Typography>
                                <Chip 
                                  label={`${asset.depositRate}% APY`} 
                                  size="small" 
                                  sx={{ 
                                    fontWeight: 600,
                                    backgroundColor: alpha(asset.color, 0.1),
                                    color: asset.color,
                                    borderRadius: '8px',
                                    fontSize: '0.7rem'
                                  }} 
                                />
                              </Box>
                            </Paper>
                          </Grid>
                        ))}
                      </Grid>
                    </Box>
                    
                    <Typography variant="subtitle2" gutterBottom>
                      Deposit History
                    </Typography>
                    {mockDepositHistory.length > 0 ? (
                      <Box sx={{ overflowX: 'auto' }}>
                        <Box sx={{ 
                          minWidth: 600,
                          '& .history-row': {
                            transition: 'all 0.2s ease',
                            '&:hover': {
                              backgroundColor: alpha(theme.palette.primary.main, 0.05),
                            }
                          }
                        }}>
                          {mockDepositHistory.map((transaction, index) => (
                            <React.Fragment key={transaction.txHash}>
                              <Box 
                                className="history-row"
                                sx={{ 
                                  display: 'flex', 
                                  alignItems: 'center', 
                                  py: 2,
                                  px: 1,
                                  borderRadius: '8px',
                                }}
                              >
                                <Box sx={{ display: 'flex', alignItems: 'center', width: '25%' }}>
                                  <Box sx={{ mr: 1, display: 'flex' }}>
                                    <ArrowUpwardIcon 
                                      fontSize="small" 
                                      sx={{ 
                                        color: theme.palette.success.main,
                                        p: 0.5,
                                        borderRadius: '50%',
                                        backgroundColor: alpha(theme.palette.success.main, 0.1)
                                      }} 
                                    />
                                  </Box>
                                  <Box>
                                    <Typography variant="body2" fontWeight={500}>
                                      Deposit {transaction.token}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                      {formatDate(transaction.timestamp)}
                                    </Typography>
                                  </Box>
                                </Box>
                                <Box sx={{ width: '20%' }}>
                                  <Typography variant="body2" fontWeight={500}>
                                    {transaction.amount.toLocaleString()} {transaction.token}
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary">
                                    ${transaction.amountUsd.toLocaleString()}
                                  </Typography>
                                </Box>
                                <Box sx={{ width: '15%' }}>
                                  <Chip 
                                    label={transaction.status === 'completed' ? 'Completed' : 'Pending'} 
                                    size="small" 
                                    color={transaction.status === 'completed' ? 'success' : 'warning'}
                                    sx={{ 
                                      borderRadius: '8px',
                                      fontWeight: 500,
                                      fontSize: '0.7rem'
                                    }} 
                                  />
                                </Box>
                                <Box sx={{ width: '40%', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  <Typography variant="caption" color="text.secondary">
                                    Tx: {transaction.txHash}
                                  </Typography>
                                </Box>
                              </Box>
                              {index < mockDepositHistory.length - 1 && (
                                <Divider sx={{ opacity: 0.6 }} />
                              )}
                            </React.Fragment>
                          ))}
                        </Box>
                      </Box>
                    ) : (
                      <Box sx={{ textAlign: 'center', py: 4 }}>
                        <HistoryIcon sx={{ fontSize: 48, color: 'text.secondary', opacity: 0.5, mb: 2 }} />
                        <Typography variant="body2" color="text.secondary">
                          No deposit history found
                        </Typography>
                      </Box>
                    )}
                  </>
                ) : (
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 4 }}>
                    <AccountBalanceIcon sx={{ fontSize: 48, color: 'primary.main', mb: 2, opacity: 0.7 }} />
                    <Typography variant="body1" gutterBottom align="center">
                      Connect your wallet to view your deposits
                    </Typography>
                    <Button 
                      variant="contained"
                      onClick={connectWallet}
                      sx={{ mt: 2, borderRadius: '10px' }}
                    >
                      Connect Wallet
                    </Button>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}
    </Box>
  );
};

export default Deposit;