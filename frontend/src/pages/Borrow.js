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
  Tabs,
  LinearProgress,
  Collapse
} from '@mui/material';
import { 
  ArrowForward as ArrowForwardIcon,
  ArrowDownward as ArrowDownwardIcon,
  ArrowUpward as ArrowUpwardIcon,
  Info as InfoIcon,
  AccountBalance as AccountBalanceIcon,
  History as HistoryIcon,
  Warning as WarningIcon,
  Check as CheckIcon,
  VerifiedUser as VerifiedUserIcon,
  LocalAtm as LocalAtmIcon,
  Percent as PercentIcon,
  Update as UpdateIcon,
  MonetizationOn as MonetizationOnIcon,
  ErrorOutline as ErrorOutlineIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  ShowChart as ShowChartIcon
} from '@mui/icons-material';
import { useWeb3 } from '../context/Web3Context';
import ConnectionErrorFallback from '../components/ui/ConnectionErrorFallback';
import { useNavigate } from 'react-router-dom';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';

// Mock assets data
const mockAssets = [
  { 
    name: 'IOTA', 
    symbol: 'MIOTA', 
    icon: '/assets/tokens/iota.svg', 
    balance: 4500, 
    balanceUsd: 1209.15,
    borrowRate: 5.8,
    ltv: 0.75,
    liquidationThreshold: 0.80,
    liquidationPenalty: 0.05,
    liquidityAvailable: 2500000,
    color: '#00BFA5'
  },
  { 
    name: 'Ethereum', 
    symbol: 'ETH', 
    icon: '/assets/tokens/eth.svg', 
    balance: 0.542, 
    balanceUsd: 1001.98,
    borrowRate: 3.9,
    ltv: 0.80,
    liquidationThreshold: 0.85,
    liquidationPenalty: 0.075,
    liquidityAvailable: 5000000,
    color: '#627EEA'
  },
  { 
    name: 'USDT', 
    symbol: 'USDT', 
    icon: '/assets/tokens/usdt.svg', 
    balance: 2500, 
    balanceUsd: 2500,
    borrowRate: 7.2,
    ltv: 0.9,
    liquidationThreshold: 0.93,
    liquidationPenalty: 0.03,
    liquidityAvailable: 10000000,
    color: '#26A17B'
  },
  { 
    name: 'USDC', 
    symbol: 'USDC', 
    icon: '/assets/tokens/usdc.svg', 
    balance: 1800, 
    balanceUsd: 1800,
    borrowRate: 6.9,
    ltv: 0.9,
    liquidationThreshold: 0.93,
    liquidationPenalty: 0.03,
    liquidityAvailable: 8000000,
    color: '#2775CA'
  }
];

// Mock borrowing history
const mockBorrowHistory = [
  {
    token: 'USDT',
    amount: 850,
    amountUsd: 850,
    timestamp: '2025-04-22T16:42:10Z',
    status: 'completed',
    txHash: '0xa1b2c3d4e5f6g7h8i9j0'
  },
  {
    token: 'USDC',
    amount: 500,
    amountUsd: 500,
    timestamp: '2025-04-18T11:23:45Z',
    status: 'completed',
    txHash: '0xk1l2m3n4o5p6q7r8s9t0'
  }
];

// Mock collateral data
const mockCollateral = [
  { 
    name: 'IOTA', 
    symbol: 'MIOTA', 
    icon: '/assets/tokens/iota.svg', 
    amount: 3000, 
    valueUsd: 806.10,
    collateralFactor: 0.75,
    color: '#00BFA5'
  },
  { 
    name: 'Ethereum', 
    symbol: 'ETH', 
    icon: '/assets/tokens/eth.svg', 
    amount: 0.4, 
    valueUsd: 739.80,
    collateralFactor: 0.8,
    color: '#627EEA'
  }
];

// Calculate total collateral value
const totalCollateralValue = mockCollateral.reduce((sum, asset) => sum + asset.valueUsd, 0);

// Calculate total borrowing value
const totalBorrowValue = mockBorrowHistory.reduce((sum, item) => sum + item.amountUsd, 0);

// Calculate borrowing power
const calculateBorrowingPower = () => {
  return mockCollateral.reduce((sum, asset) => sum + (asset.valueUsd * asset.collateralFactor), 0);
};

// Calculate health factor
const calculateHealthFactor = () => {
  if (totalBorrowValue === 0) return Infinity;
  
  const liquidationThresholdValue = mockCollateral.reduce(
    (sum, asset) => {
      const assetData = mockAssets.find(a => a.symbol === asset.symbol);
      return sum + (asset.valueUsd * (assetData?.liquidationThreshold || 0.8));
    }, 0);
  
  return liquidationThresholdValue / totalBorrowValue;
};

// Borrow component with improved UI
const Borrow = () => {
  const { connectionError, connectWallet, isConnected, useMockData } = useWeb3();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isTablet = useMediaQuery(theme.breakpoints.down('lg'));
  const navigate = useNavigate();
  
  // Component state
  const [selectedAsset, setSelectedAsset] = useState(mockAssets[2]); // Default to USDT
  const [borrowAmount, setBorrowAmount] = useState('');
  const [borrowAmountUsd, setBorrowAmountUsd] = useState('');
  const [sliderValue, setSliderValue] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [borrowSuccess, setBorrowSuccess] = useState(false);
  const [tabValue, setTabValue] = useState(0);
  const [expandedRisk, setExpandedRisk] = useState(false);
  
  // Calculate borrowing power
  const borrowingPower = calculateBorrowingPower();
  
  // Calculate health factor
  const healthFactor = calculateHealthFactor();
  
  // Calculate borrowing limit
  const borrowLimit = borrowingPower - totalBorrowValue;
  
  // Calculate utilization
  const utilizationRate = borrowLimit > 0 ? (totalBorrowValue / borrowingPower) * 100 : 0;
  
  // Calculate projected health factor
  const calculateProjectedHealthFactor = () => {
    if (!borrowAmount || isNaN(borrowAmount) || parseFloat(borrowAmount) <= 0) {
      return healthFactor;
    }
    
    const newBorrowValue = totalBorrowValue + parseFloat(borrowAmountUsd || 0);
    
    if (newBorrowValue === 0) return Infinity;
    
    const liquidationThresholdValue = mockCollateral.reduce(
      (sum, asset) => {
        const assetData = mockAssets.find(a => a.symbol === asset.symbol);
        return sum + (asset.valueUsd * (assetData?.liquidationThreshold || 0.8));
      }, 0);
    
    return liquidationThresholdValue / newBorrowValue;
  };
  
  // Projected health factor
  const projectedHealthFactor = calculateProjectedHealthFactor();
  
  // Calculate health factor status
  const getHealthFactorStatus = (factor) => {
    if (factor === Infinity) return 'healthy';
    if (factor >= 2) return 'healthy';
    if (factor >= 1.5) return 'good';
    if (factor >= 1.1) return 'warning';
    return 'danger';
  };
  
  // Current health factor status
  const healthFactorStatus = getHealthFactorStatus(healthFactor);
  
  // Projected health factor status
  const projectedHealthFactorStatus = getHealthFactorStatus(projectedHealthFactor);
  
  // Calculate USD value when borrow amount changes
  useEffect(() => {
    if (borrowAmount && !isNaN(borrowAmount) && selectedAsset) {
      const price = selectedAsset.balanceUsd / selectedAsset.balance;
      setBorrowAmountUsd((parseFloat(borrowAmount) * price).toFixed(2));
    } else {
      setBorrowAmountUsd('');
    }
  }, [borrowAmount, selectedAsset]);
  
  // Handle asset selection change
  const handleAssetChange = (event) => {
    const selected = mockAssets.find(asset => asset.symbol === event.target.value);
    setSelectedAsset(selected);
    setBorrowAmount('');
    setSliderValue(0);
  };
  
  // Handle direct amount input
  const handleAmountChange = (event) => {
    const value = event.target.value;
    if (value === '' || (/^\d*\.?\d*$/.test(value) && !isNaN(value))) {
      setBorrowAmount(value);
      
      // Update slider value
      if (value === '' || parseFloat(value) === 0) {
        setSliderValue(0);
      } else {
        const amountUsd = parseFloat(value) * (selectedAsset.balanceUsd / selectedAsset.balance);
        const percentage = Math.min((amountUsd / borrowLimit) * 100, 100);
        setSliderValue(percentage);
      }
    }
  };
  
  // Handle slider change
  const handleSliderChange = (event, newValue) => {
    setSliderValue(newValue);
    
    if (borrowLimit > 0 && selectedAsset) {
      const amountUsd = (borrowLimit * newValue) / 100;
      const price = selectedAsset.balanceUsd / selectedAsset.balance;
      const amount = (amountUsd / price).toFixed(
        selectedAsset.symbol === 'MIOTA' ? 0 : 
        selectedAsset.symbol === 'ETH' ? 6 : 2
      );
      setBorrowAmount(amount);
    }
  };
  
  // Handle borrow submission
  const handleBorrow = () => {
    if (!borrowAmount || parseFloat(borrowAmount) <= 0) return;
    
    setIsProcessing(true);
    
    // Simulate borrow process
    setTimeout(() => {
      setIsProcessing(false);
      setBorrowSuccess(true);
      
      // Reset form after 3 seconds
      setTimeout(() => {
        setBorrowSuccess(false);
        setBorrowAmount('');
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
  
  // Format health factor
  const formatHealthFactor = (factor) => {
    if (factor === Infinity) return '∞';
    return factor.toFixed(2);
  };
  
  // Prepare data for collateral pie chart
  const pieChartData = mockCollateral.map(asset => ({
    name: asset.symbol,
    value: asset.valueUsd,
    color: asset.color
  }));
  
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
        Borrow Assets
      </Typography>
      <Typography variant="body1" color="text.secondary" paragraph>
        Borrow assets against your deposited collateral with competitive interest rates.
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
          <Tab label="Borrow" />
          <Tab label="Your Borrowings" />
        </Tabs>
      </Box>
      
      {tabValue === 0 ? (
        <Grid container spacing={3}>
          {/* Borrow Form */}
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
                title="Borrow Form" 
                titleTypographyProps={{ 
                  variant: 'h6', 
                  fontWeight: 600,
                  sx: { mt: 0.5 }
                }}
                action={
                  <Tooltip title="Borrow assets against your collateral">
                    <IconButton size="small">
                      <InfoIcon />
                    </IconButton>
                  </Tooltip>
                }
              />
              <Divider />
              <CardContent>
                {isConnected || useMockData ? (
                  borrowSuccess ? (
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
                        Borrow Successful!
                      </Typography>
                      <Typography variant="body2" color="text.secondary" paragraph>
                        You have successfully borrowed {borrowAmount} {selectedAsset?.symbol} (${borrowAmountUsd})
                      </Typography>
                      <Button
                        variant="outlined"
                        onClick={() => setTabValue(1)}
                        startIcon={<HistoryIcon />}
                        sx={{ mt: 2, borderRadius: '10px' }}
                      >
                        View Your Borrowings
                      </Button>
                    </Box>
                  ) : (
                    <Box>
                      {/* Borrowing Status */}
                      <Paper
                        elevation={0}
                        sx={{
                          p: 2,
                          mb: 3,
                          borderRadius: '12px',
                          background: theme.palette.mode === 'dark'
                            ? 'linear-gradient(145deg, rgba(26, 32, 46, 0.7) 0%, rgba(33, 41, 59, 0.7) 100%)'
                            : 'linear-gradient(145deg, rgba(249, 250, 251, 0.7) 0%, rgba(240, 242, 245, 0.7) 100%)',
                          border: `1px solid ${alpha(theme.palette.divider, 0.8)}`,
                        }}
                      >
                        <Grid container spacing={2}>
                          <Grid item xs={12} sm={4}>
                            <Typography variant="body2" color="text.secondary" gutterBottom>
                              Borrowing Power
                            </Typography>
                            <Typography variant="h6" fontWeight={700}>
                              ${borrowingPower.toFixed(2)}
                            </Typography>
                          </Grid>
                          <Grid item xs={12} sm={4}>
                            <Typography variant="body2" color="text.secondary" gutterBottom>
                              Borrowed
                            </Typography>
                            <Typography variant="h6" fontWeight={700}>
                              ${totalBorrowValue.toFixed(2)}
                            </Typography>
                          </Grid>
                          <Grid item xs={12} sm={4}>
                            <Typography variant="body2" color="text.secondary" gutterBottom>
                              Available to Borrow
                            </Typography>
                            <Typography variant="h6" fontWeight={700}>
                              ${borrowLimit.toFixed(2)}
                            </Typography>
                          </Grid>
                          <Grid item xs={12}>
                            <Box sx={{ mb: 1, mt: 1, display: 'flex', justifyContent: 'space-between' }}>
                              <Typography variant="body2" color="text.secondary">
                                Utilization
                              </Typography>
                              <Typography variant="body2" fontWeight={500}>
                                {utilizationRate.toFixed(2)}%
                              </Typography>
                            </Box>
                            <LinearProgress 
                              variant="determinate" 
                              value={utilizationRate} 
                              sx={{
                                height: 8,
                                borderRadius: 4,
                                backgroundColor: alpha(theme.palette.primary.main, 0.1),
                                '& .MuiLinearProgress-bar': {
                                  borderRadius: 4,
                                  background: 'linear-gradient(90deg, #4C3F91, #00BFA5)',
                                }
                              }}
                            />
                          </Grid>
                        </Grid>
                      </Paper>
                      
                      {/* Asset Selection */}
                      <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                        Select Asset to Borrow
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
                              <Chip 
                                label={`${asset.borrowRate}% APR`} 
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
                          </MenuItem>
                        ))}
                      </TextField>
                      
                      {/* Amount Input */}
                      <Grid container spacing={2} sx={{ mb: 2 }}>
                        <Grid item xs={12} sm={6}>
                          <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                            Amount to Borrow
                          </Typography>
                          <TextField
                            fullWidth
                            value={borrowAmount}
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
                              Available: ${borrowLimit.toFixed(2)}
                            </Typography>
                          )}
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                            Value in USD
                          </Typography>
                          <TextField
                            fullWidth
                            value={borrowAmountUsd}
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
                            label={`${sliderValue.toFixed(0)}%`} 
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
                      
                      {/* Health Factor Info */}
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
                        <Box 
                          sx={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'space-between',
                            cursor: 'pointer',
                          }}
                          onClick={() => setExpandedRisk(!expandedRisk)}
                        >
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <Chip 
                              size="small" 
                              icon={<InfoIcon fontSize="small" />} 
                              label="Risk Parameters" 
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
                          <IconButton size="small">
                            {expandedRisk ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                          </IconButton>
                        </Box>
                        
                        <Collapse in={expandedRisk}>
                          <Box sx={{ mt: 2 }}>
                            <Grid container spacing={2}>
                              <Grid item xs={12} sm={6}>
                                <Box sx={{ 
                                  p: 1.5, 
                                  borderRadius: '10px',
                                  border: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
                                  bgcolor: alpha(theme.palette.background.paper, 0.5),
                                }}>
                                  <Typography variant="body2" color="text.secondary" gutterBottom>
                                    Current Health Factor
                                  </Typography>
                                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                    <Box 
                                      sx={{ 
                                        width: 10, 
                                        height: 10, 
                                        borderRadius: '50%', 
                                        mr: 1,
                                        bgcolor: 
                                          healthFactorStatus === 'healthy' ? theme.palette.success.main :
                                          healthFactorStatus === 'good' ? theme.palette.success.light :
                                          healthFactorStatus === 'warning' ? theme.palette.warning.main :
                                          theme.palette.error.main
                                      }} 
                                    />
                                    <Typography variant="h6" fontWeight={700}>
                                      {formatHealthFactor(healthFactor)}
                                    </Typography>
                                  </Box>
                                </Box>
                              </Grid>
                              <Grid item xs={12} sm={6}>
                                <Box sx={{ 
                                  p: 1.5, 
                                  borderRadius: '10px',
                                  border: `1px dashed ${alpha(theme.palette.divider, 0.7)}`,
                                  bgcolor: alpha(theme.palette.background.paper, 0.5),
                                }}>
                                  <Typography variant="body2" color="text.secondary" gutterBottom>
                                    Projected Health Factor
                                  </Typography>
                                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                    <Box 
                                      sx={{ 
                                        width: 10, 
                                        height: 10, 
                                        borderRadius: '50%', 
                                        mr: 1,
                                        bgcolor: 
                                          projectedHealthFactorStatus === 'healthy' ? theme.palette.success.main :
                                          projectedHealthFactorStatus === 'good' ? theme.palette.success.light :
                                          projectedHealthFactorStatus === 'warning' ? theme.palette.warning.main :
                                          theme.palette.error.main
                                      }} 
                                    />
                                    <Typography 
                                      variant="h6" 
                                      fontWeight={700}
                                      color={
                                        projectedHealthFactorStatus === 'healthy' ? 'success.main' :
                                        projectedHealthFactorStatus === 'good' ? 'success.light' :
                                        projectedHealthFactorStatus === 'warning' ? 'warning.main' :
                                        'error.main'
                                      }
                                    >
                                      {formatHealthFactor(projectedHealthFactor)}
                                    </Typography>
                                  </Box>
                                </Box>
                              </Grid>
                            </Grid>
                            
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
                              Health Factor indicates the safety of your loan relative to the liquidation threshold.
                              <br />
                              • &gt;= 2: Very safe position
                              <br />
                              • 1.5 - 2: Safe position
                              <br />
                              • 1.1 - 1.5: Caution, consider adding collateral
                              <br />
                              • &lt; 1.1: High risk of liquidation
                            </Typography>
                          </Box>
                        </Collapse>
                      </Paper>
                      
                      {/* Interest Rate Info */}
                      <Paper
                        elevation={0}
                        sx={{
                          p: 2,
                          mb: 3,
                          borderRadius: '12px',
                          bgcolor: alpha(selectedAsset?.color || theme.palette.info.main, 0.05),
                          border: `1px solid ${alpha(selectedAsset?.color || theme.palette.info.main, 0.1)}`
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                          <Chip 
                            size="small" 
                            icon={<PercentIcon />} 
                            label="Interest Rate" 
                            sx={{ 
                              borderRadius: '6px',
                              backgroundColor: alpha(selectedAsset?.color || theme.palette.info.main, 0.15),
                              color: selectedAsset?.color || theme.palette.info.main,
                              fontWeight: 500,
                              fontSize: '0.75rem',
                              '& .MuiChip-icon': {
                                color: 'inherit'
                              }
                            }} 
                          />
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'baseline' }}>
                          <Typography 
                            variant="h5" 
                            fontWeight={700} 
                            sx={{ color: selectedAsset?.color || theme.palette.info.main }}
                          >
                            {selectedAsset?.borrowRate}%
                          </Typography>
                          <Typography variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                            APR
                          </Typography>
                        </Box>
                        <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                          Interest rates are variable and depend on market conditions.
                          Interest accrues every block and is added to your debt.
                        </Typography>
                      </Paper>
                      
                      {/* Low Health Factor Warning */}
                      {projectedHealthFactor < 1.5 && (
                        <Alert 
                          severity={projectedHealthFactor < 1.1 ? "error" : "warning"}
                          sx={{ 
                            mb: 3, 
                            borderRadius: '10px',
                            backgroundColor: projectedHealthFactor < 1.1 
                              ? alpha(theme.palette.error.main, 0.05)
                              : alpha(theme.palette.warning.main, 0.05),
                            border: `1px solid ${
                              projectedHealthFactor < 1.1 
                                ? alpha(theme.palette.error.main, 0.2)
                                : alpha(theme.palette.warning.main, 0.2)
                            }`
                          }}
                        >
                          <Typography variant="body2">
                            {projectedHealthFactor < 1.1 
                              ? "Warning: This loan would create a high risk of liquidation. Consider borrowing less or adding more collateral."
                              : "Caution: This loan would result in a less safe position. Consider adjusting the amount or adding more collateral."}
                          </Typography>
                        </Alert>
                      )}
                      
                      {/* Submit Button */}
                      <Button
                        variant="contained"
                        fullWidth
                        size="large"
                        startIcon={isProcessing ? null : <ArrowDownwardIcon />}
                        onClick={handleBorrow}
                        disabled={
                          !borrowAmount || 
                          parseFloat(borrowAmount) <= 0 || 
                          parseFloat(borrowAmountUsd) > borrowLimit ||
                          projectedHealthFactor < 1.03 ||
                          isProcessing
                        }
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
                          'Borrow'
                        )}
                      </Button>
                      
                      {parseFloat(borrowAmountUsd) > borrowLimit && (
                        <Typography variant="caption" color="error" sx={{ display: 'block', mt: 1, textAlign: 'center' }}>
                          The requested amount exceeds your borrowing limit
                        </Typography>
                      )}
                    </Box>
                  )
                ) : (
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 4 }}>
                    <AccountBalanceIcon sx={{ fontSize: 48, color: 'primary.main', mb: 2, opacity: 0.7 }} />
                    <Typography variant="body1" gutterBottom align="center">
                      Connect your wallet to borrow assets
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
          
          {/* Collateral Information */}
          <Grid item xs={12} md={5} lg={4}>
            <Card 
              elevation={0}
              sx={{ 
                borderRadius: '16px', 
                border: `1px solid ${alpha(theme.palette.divider, 0.8)}`,
                boxShadow: `0 4px 20px ${alpha(theme.palette.common.black, 0.05)}`,
                transition: 'all 0.3s ease',
                mb: 3,
                '&:hover': {
                  boxShadow: `0 8px 25px ${alpha(theme.palette.common.black, 0.08)}`,
                  borderColor: alpha(theme.palette.primary.main, 0.2),
                }
              }}
            >
              <CardHeader 
                title="Your Collateral" 
                titleTypographyProps={{ variant: 'h6', fontWeight: 600 }}
              />
              <Divider />
              <CardContent>
                {(isConnected || useMockData) && mockCollateral.length > 0 ? (
                  <>
                    <Box sx={{ height: 180, mb: 2 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={pieChartData}
                            cx="50%"
                            cy="50%"
                            innerRadius={50}
                            outerRadius={70}
                            paddingAngle={2}
                            dataKey="value"
                          >
                            {pieChartData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <RechartsTooltip 
                            formatter={(value, name) => [`$${value.toFixed(2)}`, name]}
                            contentStyle={{
                              backgroundColor: theme.palette.background.paper,
                              borderRadius: 8,
                              border: `1px solid ${theme.palette.divider}`,
                              boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </Box>
                    
                    <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                      Collateral Assets
                    </Typography>
                    <List disablePadding>
                      {mockCollateral.map((asset, index) => (
                        <React.Fragment key={asset.symbol}>
                          <ListItem sx={{ px: 0, py: 1 }}>
                            <ListItemIcon sx={{ minWidth: 40 }}>
                              <Box
                                component="img"
                                src={asset.icon}
                                alt={asset.symbol}
                                sx={{ 
                                  width: 28, 
                                  height: 28,
                                  borderRadius: '50%',
                                }}
                                onError={(e) => {
                                  e.target.src = `https://via.placeholder.com/28/CCCCCC/FFFFFF?text=${asset.symbol.charAt(0)}`;
                                }}
                              />
                            </ListItemIcon>
                            <ListItemText 
                              primary={`${asset.amount.toLocaleString()} ${asset.symbol}`}
                              secondary={`$${asset.valueUsd.toFixed(2)}`}
                              primaryTypographyProps={{ fontWeight: 500 }}
                            />
                            <Chip 
                              label={`${(asset.collateralFactor * 100).toFixed(0)}%`} 
                              size="small" 
                              sx={{ 
                                fontWeight: 600,
                                backgroundColor: alpha(asset.color, 0.1),
                                color: asset.color,
                                borderRadius: '8px',
                                fontSize: '0.7rem'
                              }} 
                            />
                          </ListItem>
                          {index < mockCollateral.length - 1 && <Divider component="li" />}
                        </React.Fragment>
                      ))}
                    </List>
                    
                    <Box sx={{ mt: 2, mb: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <Typography variant="body2" fontWeight={500}>
                        Total Collateral Value
                      </Typography>
                      <Typography variant="h6" fontWeight={700}>
                        ${totalCollateralValue.toFixed(2)}
                      </Typography>
                    </Box>
                    
                    <Button
                      variant="outlined"
                      fullWidth
                      onClick={() => navigate('/deposit')}
                      startIcon={<ArrowUpwardIcon />}
                      sx={{
                        mt: 2,
                        borderRadius: '10px',
                      }}
                    >
                      Deposit More Collateral
                    </Button>
                  </>
                ) : (
                  <Box sx={{ textAlign: 'center', py: 3 }}>
                    <ErrorOutlineIcon sx={{ fontSize: 48, color: 'text.secondary', opacity: 0.5, mb: 2 }} />
                    <Typography variant="body1" gutterBottom>
                      No collateral found
                    </Typography>
                    <Typography variant="body2" color="text.secondary" paragraph>
                      You need to deposit assets as collateral before borrowing
                    </Typography>
                    <Button
                      variant="contained"
                      onClick={() => navigate('/deposit')}
                      startIcon={<ArrowUpwardIcon />}
                      sx={{ mt: 1, borderRadius: '10px' }}
                    >
                      Deposit Collateral
                    </Button>
                  </Box>
                )}
              </CardContent>
            </Card>
            
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
                title="Borrowing Information" 
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
                      primary="Variable Interest Rates" 
                      secondary="Interest rates adjust based on market conditions"
                      primaryTypographyProps={{ fontWeight: 600 }}
                    />
                  </ListItem>
                  <Divider component="li" />
                  <ListItem sx={{ px: 0, py: 1.5 }}>
                    <ListItemIcon sx={{ minWidth: 42 }}>
                      <Avatar sx={{ bgcolor: alpha(theme.palette.info.main, 0.1), color: theme.palette.info.main, width: 34, height: 34 }}>
                        <ShowChartIcon fontSize="small" />
                      </Avatar>
                    </ListItemIcon>
                    <ListItemText 
                      primary="Health Factor" 
                      secondary="Maintain a health factor above 1.0 to avoid liquidation"
                      primaryTypographyProps={{ fontWeight: 600 }}
                    />
                  </ListItem>
                  <Divider component="li" />
                  <ListItem sx={{ px: 0, py: 1.5 }}>
                    <ListItemIcon sx={{ minWidth: 42 }}>
                      <Avatar sx={{ bgcolor: alpha(theme.palette.warning.main, 0.1), color: theme.palette.warning.main, width: 34, height: 34 }}>
                        <WarningIcon fontSize="small" />
                      </Avatar>
                    </ListItemIcon>
                    <ListItemText 
                      primary="Liquidation Risk" 
                      secondary="Your collateral may be liquidated if health factor < 1.0"
                      primaryTypographyProps={{ fontWeight: 600 }}
                    />
                  </ListItem>
                  <Divider component="li" />
                  <ListItem sx={{ px: 0, py: 1.5 }}>
                    <ListItemIcon sx={{ minWidth: 42 }}>
                      <Avatar sx={{ bgcolor: alpha(theme.palette.primary.main, 0.1), color: theme.palette.primary.main, width: 34, height: 34 }}>
                        <MonetizationOnIcon fontSize="small" />
                      </Avatar>
                    </ListItemIcon>
                    <ListItemText 
                      primary="Flexible Repayments" 
                      secondary="Repay all or part of your loan at any time"
                      primaryTypographyProps={{ fontWeight: 600 }}
                    />
                  </ListItem>
                </List>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      ) : (
        <Grid container spacing={3}>
          {/* Borrowing History */}
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
                title="Your Borrowings" 
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
                    {/* Borrowing Status */}
                    <Box sx={{ mb: 3 }}>
                      <Paper
                        elevation={0}
                        sx={{
                          p: 2,
                          borderRadius: '12px',
                          background: theme.palette.mode === 'dark'
                            ? 'linear-gradient(145deg, rgba(26, 32, 46, 0.7) 0%, rgba(33, 41, 59, 0.7) 100%)'
                            : 'linear-gradient(145deg, rgba(249, 250, 251, 0.7) 0%, rgba(240, 242, 245, 0.7) 100%)',
                          border: `1px solid ${alpha(theme.palette.divider, 0.8)}`,
                        }}
                      >
                        <Grid container spacing={2}>
                          <Grid item xs={12} sm={4}>
                            <Typography variant="body2" color="text.secondary" gutterBottom>
                              Total Collateral Value
                            </Typography>
                            <Typography variant="h6" fontWeight={700}>
                              ${totalCollateralValue.toFixed(2)}
                            </Typography>
                          </Grid>
                          <Grid item xs={12} sm={4}>
                            <Typography variant="body2" color="text.secondary" gutterBottom>
                              Total Borrowed
                            </Typography>
                            <Typography variant="h6" fontWeight={700}>
                              ${totalBorrowValue.toFixed(2)}
                            </Typography>
                          </Grid>
                          <Grid item xs={12} sm={4}>
                            <Typography variant="body2" color="text.secondary" gutterBottom>
                              Health Factor
                            </Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                              <Box 
                                sx={{ 
                                  width: 10, 
                                  height: 10, 
                                  borderRadius: '50%', 
                                  mr: 1,
                                  bgcolor: 
                                    healthFactorStatus === 'healthy' ? theme.palette.success.main :
                                    healthFactorStatus === 'good' ? theme.palette.success.light :
                                    healthFactorStatus === 'warning' ? theme.palette.warning.main :
                                    theme.palette.error.main
                                }} 
                              />
                              <Typography 
                                variant="h6" 
                                fontWeight={700}
                                color={
                                  healthFactorStatus === 'healthy' ? 'success.main' :
                                  healthFactorStatus === 'good' ? 'success.light' :
                                  healthFactorStatus === 'warning' ? 'warning.main' :
                                  'error.main'
                                }
                              >
                                {formatHealthFactor(healthFactor)}
                              </Typography>
                            </Box>
                          </Grid>
                          <Grid item xs={12}>
                            <Box sx={{ mb: 1, mt: 1, display: 'flex', justifyContent: 'space-between' }}>
                              <Typography variant="body2" color="text.secondary">
                                Utilization
                              </Typography>
                              <Typography variant="body2" fontWeight={500}>
                                {utilizationRate.toFixed(2)}%
                              </Typography>
                            </Box>
                            <LinearProgress 
                              variant="determinate" 
                              value={utilizationRate} 
                              sx={{
                                height: 8,
                                borderRadius: 4,
                                backgroundColor: alpha(theme.palette.primary.main, 0.1),
                                '& .MuiLinearProgress-bar': {
                                  borderRadius: 4,
                                  background: 'linear-gradient(90deg, #4C3F91, #00BFA5)',
                                }
                              }}
                            />
                          </Grid>
                        </Grid>
                      </Paper>
                    </Box>
                    
                    <Box sx={{ mb: 3 }}>
                      <Typography variant="subtitle2" gutterBottom>
                        Currently Borrowed
                      </Typography>
                      <Grid container spacing={2}>
                        {mockBorrowHistory.map((item) => {
                          const assetData = mockAssets.find(a => a.symbol === item.token);
                          
                          return (
                            <Grid item xs={12} sm={6} md={4} key={`${item.token}-${item.timestamp}`}>
                              <Paper
                                elevation={0}
                                sx={{
                                  p: 2,
                                  borderRadius: '12px',
                                  border: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
                                  background: theme.palette.mode === 'dark'
                                    ? `linear-gradient(135deg, ${alpha(assetData?.color || '#4C3F91', 0.15)} 0%, ${alpha(theme.palette.background.paper, 0.9)} 100%)`
                                    : `linear-gradient(135deg, ${alpha(assetData?.color || '#00BFA5', 0.07)} 0%, ${theme.palette.background.paper} 100%)`,
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
                                    background: `radial-gradient(circle, ${alpha(assetData?.color || '#4C3F91', 0.15)} 0%, transparent 70%)`,
                                    pointerEvents: 'none',
                                  }
                                }}
                              >
                                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                                  <Box
                                    component="img"
                                    src={assetData?.icon}
                                    alt={item.token}
                                    sx={{ 
                                      width: 28, 
                                      height: 28, 
                                      mr: 1,
                                      borderRadius: '50%',
                                    }}
                                    onError={(e) => {
                                      e.target.src = `https://via.placeholder.com/28/CCCCCC/FFFFFF?text=${item.token.charAt(0)}`;
                                    }}
                                  />
                                  <Typography variant="subtitle2" fontWeight={600}>
                                    {item.token}
                                  </Typography>
                                </Box>
                                <Typography variant="h6" fontWeight={700} gutterBottom>
                                  {item.amount.toLocaleString()}
                                </Typography>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                                  <Typography variant="body2" color="text.secondary">
                                    ${item.amountUsd.toLocaleString()}
                                  </Typography>
                                  <Chip 
                                    label={`${assetData?.borrowRate || 5}% APR`} 
                                    size="small" 
                                    sx={{ 
                                      fontWeight: 600,
                                      backgroundColor: alpha(assetData?.color || '#4C3F91', 0.1),
                                      color: assetData?.color || '#4C3F91',
                                      borderRadius: '8px',
                                      fontSize: '0.7rem'
                                    }} 
                                  />
                                </Box>
                                <Button
                                  variant="outlined"
                                  fullWidth
                                  size="small"
                                  sx={{
                                    mt: 2,
                                    borderRadius: '8px',
                                    borderColor: alpha(assetData?.color || theme.palette.primary.main, 0.5),
                                    color: assetData?.color || theme.palette.primary.main,
                                  }}
                                >
                                  Repay
                                </Button>
                              </Paper>
                            </Grid>
                          );
                        })}
                        <Grid item xs={12} sm={6} md={4}>
                          <Paper
                            elevation={0}
                            sx={{
                              p: 2,
                              borderRadius: '12px',
                              border: `1px dashed ${alpha(theme.palette.primary.main, 0.3)}`,
                              backgroundColor: alpha(theme.palette.primary.main, 0.02),
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              justifyContent: 'center',
                              height: '100%',
                              minHeight: 158,
                              cursor: 'pointer',
                              transition: 'all 0.2s ease',
                              '&:hover': {
                                backgroundColor: alpha(theme.palette.primary.main, 0.05),
                                transform: 'translateY(-2px)'
                              }
                            }}
                            onClick={() => setTabValue(0)}
                          >
                            <ArrowDownwardIcon sx={{ color: theme.palette.primary.main, mb: 1, opacity: 0.8 }} />
                            <Typography variant="body2" fontWeight={500} textAlign="center">
                              Borrow More Assets
                            </Typography>
                          </Paper>
                        </Grid>
                      </Grid>
                    </Box>
                    
                    <Typography variant="subtitle2" gutterBottom>
                      Borrowing History
                    </Typography>
                    {mockBorrowHistory.length > 0 ? (
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
                          {mockBorrowHistory.map((transaction, index) => (
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
                                    <ArrowDownwardIcon 
                                      fontSize="small" 
                                      sx={{ 
                                        color: theme.palette.info.main,
                                        p: 0.5,
                                        borderRadius: '50%',
                                        backgroundColor: alpha(theme.palette.info.main, 0.1)
                                      }} 
                                    />
                                  </Box>
                                  <Box>
                                    <Typography variant="body2" fontWeight={500}>
                                      Borrow {transaction.token}
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
                              {index < mockBorrowHistory.length - 1 && (
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
                          No borrowing history found
                        </Typography>
                      </Box>
                    )}
                  </>
                ) : (
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 4 }}>
                    <AccountBalanceIcon sx={{ fontSize: 48, color: 'primary.main', mb: 2, opacity: 0.7 }} />
                    <Typography variant="body1" gutterBottom align="center">
                      Connect your wallet to view your borrowings
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

export default Borrow;