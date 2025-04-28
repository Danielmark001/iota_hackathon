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
  Collapse,
  TableContainer,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell
} from '@mui/material';
import { 
  ArrowForward as ArrowForwardIcon,
  Autorenew as AutorenewIcon,
  Info as InfoIcon,
  AccountBalance as AccountBalanceIcon,
  History as HistoryIcon,
  CalendarToday as CalendarTodayIcon,
  Warning as WarningIcon,
  Check as CheckIcon,
  VerifiedUser as VerifiedUserIcon,
  LocalAtm as LocalAtmIcon,
  Percent as PercentIcon,
  Update as UpdateIcon,
  StopCircle as StopCircleIcon,
  Lock as LockIcon,
  LockOpen as LockOpenIcon,
  HowToVote as HowToVoteIcon,
  Verified as VerifiedIcon,
  StarRate as StarRateIcon,
  RateReview as RateReviewIcon,
  SwapHoriz as SwapHorizIcon,
  Help as HelpIcon,
  TimelapseOutlined as TimelapseOutlinedIcon,
  Payments as PaymentsIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon
} from '@mui/icons-material';
import { useWeb3 } from '../context/Web3Context';
import ConnectionErrorFallback from '../components/ui/ConnectionErrorFallback';
import { useNavigate } from 'react-router-dom';
import { 
  BarChart, 
  Bar, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip, 
  Legend, 
  ResponsiveContainer,
  Cell
} from 'recharts';

// Mock staking pools data
const mockStakingPools = [
  { 
    id: 1,
    name: 'IOTA Core Staking', 
    asset: 'MIOTA', 
    assetIcon: '/assets/tokens/iota.svg',
    apy: 9.2,
    totalStaked: 12500000,
    totalStakedUsd: 3362500,
    minStakeAmount: 10,
    lockPeriods: [
      { days: 0, apy: 6.5 }, // Flexible
      { days: 30, apy: 8.2 },
      { days: 90, apy: 9.2 },
      { days: 180, apy: 10.5 },
      { days: 365, apy: 12.8 }
    ],
    protocol: 'IOTA Foundation',
    protocolIcon: '/assets/protocols/iota.svg',
    isVerified: true,
    color: '#00BFA5',
    description: 'Core staking pool for IOTA tokens. Earn rewards by contributing to network security.'
  },
  { 
    id: 2,
    name: 'Assembly Staking', 
    asset: 'ASMB', 
    assetIcon: '/assets/tokens/assembly.svg',
    apy: 12.5,
    totalStaked: 8500000,
    totalStakedUsd: 935000,
    minStakeAmount: 100,
    lockPeriods: [
      { days: 0, apy: 8.4 }, // Flexible
      { days: 30, apy: 10.2 },
      { days: 90, apy: 12.5 },
      { days: 180, apy: 14.8 },
      { days: 365, apy: 18.2 }
    ],
    protocol: 'Assembly',
    protocolIcon: '/assets/protocols/assembly.svg',
    isVerified: true,
    color: '#8B69FF',
    description: 'Earn ASMB rewards by participating in the Assembly network staking program.'
  },
  { 
    id: 3,
    name: 'Shimmer Staking', 
    asset: 'SMR', 
    assetIcon: '/assets/tokens/shimmer.svg', 
    apy: 8.7,
    totalStaked: 15800000,
    totalStakedUsd: 1738000,
    minStakeAmount: 100,
    lockPeriods: [
      { days: 0, apy: 5.8 }, // Flexible
      { days: 30, apy: 7.1 },
      { days: 90, apy: 8.7 },
      { days: 180, apy: 9.9 },
      { days: 365, apy: 11.5 }
    ],
    protocol: 'Shimmer',
    protocolIcon: '/assets/protocols/shimmer.svg',
    isVerified: true,
    color: '#25D8AB',
    description: 'Stake SMR tokens to earn rewards and participate in the Shimmer network governance.'
  },
  { 
    id: 4,
    name: 'IOTA-ETH LP Staking', 
    asset: 'MIOTA-ETH LP', 
    assetIcon: '/assets/tokens/iota-eth.svg',
    apy: 16.4,
    totalStaked: 5200000,
    totalStakedUsd: 5200000,
    minStakeAmount: 0.01,
    lockPeriods: [
      { days: 0, apy: 11.2 }, // Flexible
      { days: 30, apy: 13.8 },
      { days: 90, apy: 16.4 },
      { days: 180, apy: 18.9 },
      { days: 365, apy: 22.5 }
    ],
    protocol: 'TangleSwap',
    protocolIcon: '/assets/protocols/tangleswap.svg',
    isVerified: true,
    color: '#A37BFF',
    description: 'Provide liquidity to the IOTA-ETH pool and earn high yield rewards plus trading fees.'
  }
];

// Mock user stakes data
const mockUserStakes = [
  {
    poolId: 1,
    asset: 'MIOTA',
    assetIcon: '/assets/tokens/iota.svg',
    amount: 2500,
    valueUsd: 671.25,
    apy: 9.2,
    startDate: '2025-02-15T10:23:45Z',
    endDate: '2025-05-15T10:23:45Z', // 90 days
    lockDays: 90,
    pendingRewards: 42.8,
    pendingRewardsUsd: 11.49,
    status: 'active',
    color: '#00BFA5'
  },
  {
    poolId: 2,
    asset: 'ASMB',
    assetIcon: '/assets/tokens/assembly.svg',
    amount: 5000,
    valueUsd: 550,
    apy: 14.8,
    startDate: '2025-01-20T14:56:12Z',
    endDate: '2025-07-19T14:56:12Z', // 180 days
    lockDays: 180,
    pendingRewards: 302.5,
    pendingRewardsUsd: 33.28,
    status: 'active',
    color: '#8B69FF'
  }
];

// Mock staking history data
const mockStakingHistory = [
  {
    action: 'stake',
    asset: 'MIOTA',
    assetIcon: '/assets/tokens/iota.svg',
    amount: 2500,
    valueUsd: 671.25,
    timestamp: '2025-02-15T10:23:45Z',
    txHash: '0x1a2b3c4d5e6f7g8h9i0j',
    status: 'completed'
  },
  {
    action: 'stake',
    asset: 'ASMB',
    assetIcon: '/assets/tokens/assembly.svg',
    amount: 5000,
    valueUsd: 550,
    timestamp: '2025-01-20T14:56:12Z',
    txHash: '0xk1l2m3n4o5p6q7r8s9t0',
    status: 'completed'
  },
  {
    action: 'claim',
    asset: 'MIOTA',
    assetIcon: '/assets/tokens/iota.svg',
    amount: 25.5,
    valueUsd: 6.84,
    timestamp: '2025-03-15T09:12:33Z',
    txHash: '0xu1v2w3x4y5z6a7b8c9d0',
    status: 'completed'
  }
];

// Mock user assets data for staking
const mockUserAssets = [
  { 
    name: 'IOTA', 
    symbol: 'MIOTA', 
    icon: '/assets/tokens/iota.svg', 
    balance: 4500, 
    balanceUsd: 1209.15,
    color: '#00BFA5'
  },
  { 
    name: 'Assembly', 
    symbol: 'ASMB', 
    icon: '/assets/tokens/assembly.svg', 
    balance: 15000, 
    balanceUsd: 1650,
    color: '#8B69FF'
  },
  { 
    name: 'Shimmer', 
    symbol: 'SMR', 
    icon: '/assets/tokens/shimmer.svg', 
    balance: 8500, 
    balanceUsd: 935,
    color: '#25D8AB'
  }
];

// Mock historical APY data for charts
const mockApyHistory = [
  { day: 'Apr 21', MIOTA: 9.1, ASMB: 12.3, SMR: 8.5 },
  { day: 'Apr 22', MIOTA: 9.2, ASMB: 12.4, SMR: 8.6 },
  { day: 'Apr 23', MIOTA: 9.0, ASMB: 12.5, SMR: 8.7 },
  { day: 'Apr 24', MIOTA: 9.3, ASMB: 12.2, SMR: 8.4 },
  { day: 'Apr 25', MIOTA: 9.2, ASMB: 12.5, SMR: 8.7 },
  { day: 'Apr 26', MIOTA: 9.1, ASMB: 12.6, SMR: 8.9 },
  { day: 'Apr 27', MIOTA: 9.2, ASMB: 12.5, SMR: 8.7 }
];

// Staking component with improved UI
const Staking = () => {
  const { connectionError, connectWallet, isConnected, useMockData } = useWeb3();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isTablet = useMediaQuery(theme.breakpoints.down('lg'));
  const navigate = useNavigate();
  
  // Component state
  const [tabValue, setTabValue] = useState(0);
  const [selectedPool, setSelectedPool] = useState(null);
  const [stakeAmount, setStakeAmount] = useState('');
  const [selectedLockPeriod, setSelectedLockPeriod] = useState(0); // 0 means flexible
  const [isProcessing, setIsProcessing] = useState(false);
  const [stakeSuccess, setStakeSuccess] = useState(false);
  const [sliderValue, setSliderValue] = useState(0);
  const [expandedPoolId, setExpandedPoolId] = useState(null);
  
  // Calculate expected APY based on selected lock period
  const getExpectedApy = () => {
    if (!selectedPool) return 0;
    
    const period = selectedPool.lockPeriods[selectedLockPeriod];
    return period ? period.apy : 0;
  };
  
  // Calculate expected rewards
  const calculateExpectedRewards = () => {
    if (!stakeAmount || !selectedPool) return 0;
    
    const amount = parseFloat(stakeAmount);
    const apy = getExpectedApy();
    const days = selectedPool.lockPeriods[selectedLockPeriod].days;
    
    // Calculate daily rewards (APY / 365)
    const dailyRate = apy / 100 / 365;
    const rewards = amount * dailyRate * days;
    
    return days === 0 ? amount * (apy / 100) : rewards;
  };
  
  // Calculate USD value for staking amount
  const getStakeAmountUsd = () => {
    if (!stakeAmount || !selectedPool) return 0;
    
    const amount = parseFloat(stakeAmount);
    const asset = mockUserAssets.find(a => a.symbol === selectedPool.asset);
    
    if (!asset) return 0;
    
    const price = asset.balanceUsd / asset.balance;
    return amount * price;
  };
  
  // Handle pool selection
  const handleSelectPool = (pool) => {
    setSelectedPool(pool);
    setStakeAmount('');
    setSliderValue(0);
    setSelectedLockPeriod(0);
    setExpandedPoolId(null);
  };
  
  // Handle direct amount input
  const handleAmountChange = (event) => {
    const value = event.target.value;
    if (value === '' || (/^\d*\.?\d*$/.test(value) && !isNaN(value))) {
      setStakeAmount(value);
      
      // Update slider value
      if (value === '' || parseFloat(value) === 0) {
        setSliderValue(0);
      } else if (selectedPool) {
        const asset = mockUserAssets.find(a => a.symbol === selectedPool.asset);
        if (asset && asset.balance > 0) {
          const percentage = Math.min((parseFloat(value) / asset.balance) * 100, 100);
          setSliderValue(percentage);
        }
      }
    }
  };
  
  // Handle slider change
  const handleSliderChange = (event, newValue) => {
    setSliderValue(newValue);
    
    if (selectedPool) {
      const asset = mockUserAssets.find(a => a.symbol === selectedPool.asset);
      if (asset && asset.balance > 0) {
        const amount = (asset.balance * newValue / 100).toFixed(
          selectedPool.asset === 'MIOTA' ? 0 : 2
        );
        setStakeAmount(amount);
      }
    }
  };
  
  // Handle lock period change
  const handleLockPeriodChange = (event) => {
    setSelectedLockPeriod(event.target.value);
  };
  
  // Handle stake submission
  const handleStake = () => {
    if (!stakeAmount || parseFloat(stakeAmount) <= 0 || !selectedPool) return;
    
    setIsProcessing(true);
    
    // Simulate staking process
    setTimeout(() => {
      setIsProcessing(false);
      setStakeSuccess(true);
      
      // Reset form after 3 seconds
      setTimeout(() => {
        setStakeSuccess(false);
        setTabValue(1); // Switch to "Your Stakes" tab
      }, 3000);
    }, 2000);
  };
  
  // Handle tab change
  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };
  
  // Handle expand/collapse pool details
  const handleTogglePoolDetails = (poolId) => {
    setExpandedPoolId(expandedPoolId === poolId ? null : poolId);
  };
  
  // Format timestamp
  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString();
  };
  
  // Format remaining time
  const formatRemainingTime = (endDateStr) => {
    const endDate = new Date(endDateStr);
    const now = new Date();
    
    if (endDate <= now) return 'Unlocked';
    
    const diffTime = Math.abs(endDate - now);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return `${diffDays} days`;
  };
  
  // Format lock period
  const formatLockPeriod = (days) => {
    if (days === 0) return 'Flexible';
    if (days < 30) return `${days} days`;
    if (days === 30) return '1 month';
    if (days === 90) return '3 months';
    if (days === 180) return '6 months';
    if (days === 365) return '1 year';
    return `${days} days`;
  };
  
  // Calculate total staked value
  const getTotalStakedValue = () => {
    return mockUserStakes.reduce((sum, stake) => sum + stake.valueUsd, 0);
  };
  
  // Calculate total pending rewards
  const getTotalPendingRewards = () => {
    return mockUserStakes.reduce((sum, stake) => sum + stake.pendingRewardsUsd, 0);
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
        Staking
      </Typography>
      <Typography variant="body1" color="text.secondary" paragraph>
        Stake your assets to earn rewards and participate in network governance.
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
          <Tab label="Staking Pools" />
          <Tab label="Your Stakes" />
          <Tab label="Analytics" />
        </Tabs>
      </Box>
      
      {tabValue === 0 && (
        <Grid container spacing={3}>
          {/* Staking Pools */}
          {selectedPool ? (
            <>
              {/* Staking Form */}
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
                      background: `linear-gradient(90deg, ${selectedPool.color || '#4C3F91'}, ${alpha(selectedPool.color || '#00BFA5', 0.8)})`,
                      borderRadius: '16px 16px 0 0',
                    }
                  }}
                >
                  <CardHeader 
                    title={
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <Box 
                          component="img" 
                          src={selectedPool.assetIcon} 
                          alt={selectedPool.asset}
                          sx={{ 
                            width: 32, 
                            height: 32, 
                            mr: 1.5,
                            borderRadius: '50%'
                          }}
                          onError={(e) => {
                            e.target.src = `https://via.placeholder.com/32/CCCCCC/FFFFFF?text=${selectedPool.asset.charAt(0)}`;
                          }}
                        />
                        <Typography variant="h6" fontWeight={600}>
                          {selectedPool.name}
                        </Typography>
                        {selectedPool.isVerified && (
                          <Tooltip title="Verified Pool">
                            <VerifiedIcon 
                              fontSize="small" 
                              color="primary" 
                              sx={{ ml: 1, opacity: 0.8 }} 
                            />
                          </Tooltip>
                        )}
                      </Box>
                    }
                    titleTypographyProps={{ 
                      variant: 'h6', 
                      fontWeight: 600,
                      sx: { mt: 0.5 }
                    }}
                    action={
                      <Button
                        variant="outlined"
                        size="small"
                        startIcon={<ArrowForwardIcon />}
                        onClick={() => setSelectedPool(null)}
                        sx={{ borderRadius: '10px' }}
                      >
                        Back to Pools
                      </Button>
                    }
                  />
                  <Divider />
                  <CardContent>
                    {isConnected || useMockData ? (
                      stakeSuccess ? (
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
                            Staking Successful!
                          </Typography>
                          <Typography variant="body2" color="text.secondary" paragraph>
                            You have successfully staked {stakeAmount} {selectedPool.asset} in {selectedPool.name}.
                            {selectedPool.lockPeriods[selectedLockPeriod].days > 0 && (
                              <> Your funds will be locked for {formatLockPeriod(selectedPool.lockPeriods[selectedLockPeriod].days)}.</>
                            )}
                          </Typography>
                          <Button
                            variant="outlined"
                            onClick={() => setTabValue(1)}
                            startIcon={<HistoryIcon />}
                            sx={{ mt: 2, borderRadius: '10px' }}
                          >
                            View Your Stakes
                          </Button>
                        </Box>
                      ) : (
                        <Box>
                          <Typography variant="body2" color="text.secondary" paragraph>
                            {selectedPool.description}
                          </Typography>
                          
                          {/* Pool Info Cards */}
                          <Grid container spacing={2} sx={{ mb: 3 }}>
                            <Grid item xs={12} sm={6} md={3}>
                              <Paper 
                                elevation={0}
                                sx={{ 
                                  p: 1.5, 
                                  borderRadius: '12px',
                                  border: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
                                  background: theme.palette.mode === 'dark'
                                    ? alpha(selectedPool.color, 0.05)
                                    : alpha(selectedPool.color, 0.03),
                                }}
                              >
                                <Typography variant="caption" color="text.secondary">
                                  APY
                                </Typography>
                                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                  <Typography 
                                    variant="h6" 
                                    fontWeight={700}
                                    sx={{ 
                                      color: selectedPool.color,
                                      mr: 0.5
                                    }}
                                  >
                                    {selectedPool.apy}%
                                  </Typography>
                                  <Tooltip title="Annual Percentage Yield">
                                    <InfoIcon 
                                      fontSize="small" 
                                      sx={{ 
                                        color: theme.palette.text.secondary,
                                        opacity: 0.7,
                                        fontSize: '0.875rem'
                                      }} 
                                    />
                                  </Tooltip>
                                </Box>
                              </Paper>
                            </Grid>
                            <Grid item xs={12} sm={6} md={3}>
                              <Paper 
                                elevation={0}
                                sx={{ 
                                  p: 1.5, 
                                  borderRadius: '12px',
                                  border: `1px solid ${alpha(theme.palette.divider, 0.5)}`
                                }}
                              >
                                <Typography variant="caption" color="text.secondary">
                                  Total Staked
                                </Typography>
                                <Typography variant="h6" fontWeight={700}>
                                  ${selectedPool.totalStakedUsd.toLocaleString()}
                                </Typography>
                              </Paper>
                            </Grid>
                            <Grid item xs={12} sm={6} md={3}>
                              <Paper 
                                elevation={0}
                                sx={{ 
                                  p: 1.5, 
                                  borderRadius: '12px',
                                  border: `1px solid ${alpha(theme.palette.divider, 0.5)}`
                                }}
                              >
                                <Typography variant="caption" color="text.secondary">
                                  Min. Stake
                                </Typography>
                                <Typography variant="h6" fontWeight={700}>
                                  {selectedPool.minStakeAmount} {selectedPool.asset}
                                </Typography>
                              </Paper>
                            </Grid>
                            <Grid item xs={12} sm={6} md={3}>
                              <Paper 
                                elevation={0}
                                sx={{ 
                                  p: 1.5, 
                                  borderRadius: '12px',
                                  border: `1px solid ${alpha(theme.palette.divider, 0.5)}`
                                }}
                              >
                                <Typography variant="caption" color="text.secondary">
                                  Protocol
                                </Typography>
                                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                  <Box 
                                    component="img" 
                                    src={selectedPool.protocolIcon} 
                                    alt={selectedPool.protocol}
                                    sx={{ 
                                      width: 20, 
                                      height: 20, 
                                      mr: 1,
                                      borderRadius: '50%'
                                    }}
                                    onError={(e) => {
                                      e.target.src = `https://via.placeholder.com/20/CCCCCC/FFFFFF?text=${selectedPool.protocol.charAt(0)}`;
                                    }}
                                  />
                                  <Typography variant="body2" fontWeight={500}>
                                    {selectedPool.protocol}
                                  </Typography>
                                </Box>
                              </Paper>
                            </Grid>
                          </Grid>
                          
                          {/* Amount Input */}
                          <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                            Amount to Stake
                          </Typography>
                          <TextField
                            fullWidth
                            value={stakeAmount}
                            onChange={handleAmountChange}
                            placeholder="0.00"
                            InputProps={{
                              endAdornment: (
                                <InputAdornment position="end">
                                  <Typography fontWeight={500}>{selectedPool.asset}</Typography>
                                </InputAdornment>
                              ),
                              sx: {
                                borderRadius: '10px',
                              }
                            }}
                            sx={{ mb: 1 }}
                          />
                          
                          {selectedPool && (
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                              <Typography variant="caption" color="text.secondary">
                                Min: {selectedPool.minStakeAmount} {selectedPool.asset}
                              </Typography>
                              {(() => {
                                const asset = mockUserAssets.find(a => a.symbol === selectedPool.asset);
                                if (asset) {
                                  return (
                                    <Typography variant="caption" color="text.secondary">
                                      Available: {asset.balance.toLocaleString()} {asset.symbol}
                                    </Typography>
                                  );
                                }
                                return null;
                              })()}
                            </Box>
                          )}
                          
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
                                color: selectedPool.color,
                                '& .MuiSlider-thumb': {
                                  width: 20,
                                  height: 20,
                                  backgroundColor: '#fff',
                                  border: `2px solid ${selectedPool.color}`,
                                  '&:hover, &.Mui-focusVisible': {
                                    boxShadow: `0px 0px 0px 8px ${alpha(selectedPool.color, 0.1)}`
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
                                  bgcolor: alpha(selectedPool.color, 0.1),
                                  color: selectedPool.color,
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
                                  borderColor: alpha(selectedPool.color, 0.5),
                                  color: selectedPool.color,
                                  '&:hover': {
                                    borderColor: selectedPool.color,
                                    backgroundColor: alpha(selectedPool.color, 0.05),
                                  }
                                }}
                              >
                                {percent}%
                              </Button>
                            ))}
                          </Box>
                          
                          {/* Lock Period Selection */}
                          <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                            Lock Period
                          </Typography>
                          <TextField
                            select
                            fullWidth
                            value={selectedLockPeriod}
                            onChange={handleLockPeriodChange}
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
                            {selectedPool.lockPeriods.map((period, index) => (
                              <MenuItem key={period.days} value={index}>
                                <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                                  <Box sx={{ display: 'flex', alignItems: 'center', flexGrow: 1 }}>
                                    {period.days === 0 ? (
                                      <LockOpenIcon sx={{ mr: 1, color: theme.palette.text.secondary }} />
                                    ) : (
                                      <LockIcon sx={{ mr: 1, color: theme.palette.text.secondary }} />
                                    )}
                                    <Typography variant="body2" fontWeight={500}>
                                      {formatLockPeriod(period.days)}
                                    </Typography>
                                  </Box>
                                  <Chip 
                                    label={`${period.apy}% APY`} 
                                    size="small" 
                                    sx={{ 
                                      fontWeight: 600,
                                      backgroundColor: alpha(selectedPool.color, 0.1),
                                      color: selectedPool.color,
                                      borderRadius: '8px',
                                      fontSize: '0.7rem'
                                    }} 
                                  />
                                </Box>
                              </MenuItem>
                            ))}
                          </TextField>
                          
                          {/* Expected Rewards */}
                          <Paper
                            elevation={0}
                            sx={{
                              p: 2,
                              mb: 3,
                              borderRadius: '12px',
                              bgcolor: alpha(selectedPool.color, 0.05),
                              border: `1px solid ${alpha(selectedPool.color, 0.1)}`,
                              background: `linear-gradient(145deg, ${alpha(selectedPool.color, 0.05)} 0%, ${alpha(theme.palette.background.paper, 0.5)} 100%)`,
                            }}
                          >
                            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                              <Chip 
                                size="small" 
                                icon={<PercentIcon />} 
                                label="Expected Rewards" 
                                sx={{ 
                                  borderRadius: '6px',
                                  backgroundColor: alpha(selectedPool.color, 0.1),
                                  color: selectedPool.color,
                                  fontWeight: 500,
                                  fontSize: '0.75rem',
                                  '& .MuiChip-icon': {
                                    color: 'inherit'
                                  }
                                }} 
                              />
                            </Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                              <Typography 
                                variant="subtitle1" 
                                fontWeight={600}
                                sx={{ mr: 0.5 }}
                              >
                                Selected APY:
                              </Typography>
                              <Typography 
                                variant="h6" 
                                fontWeight={700}
                                sx={{ color: selectedPool.color }}
                              >
                                {getExpectedApy()}%
                              </Typography>
                            </Box>
                            
                            <Divider sx={{ my: 1.5, opacity: 0.6 }} />
                            
                            <Grid container spacing={2}>
                              <Grid item xs={12} sm={6}>
                                <Box>
                                  <Typography variant="body2" color="text.secondary" gutterBottom>
                                    Staking Amount
                                  </Typography>
                                  <Typography variant="body1" fontWeight={600}>
                                    {stakeAmount ? parseFloat(stakeAmount).toLocaleString() : '0'} {selectedPool.asset}
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary">
                                    ${getStakeAmountUsd().toFixed(2)}
                                  </Typography>
                                </Box>
                              </Grid>
                              <Grid item xs={12} sm={6}>
                                <Box>
                                  <Typography variant="body2" color="text.secondary" gutterBottom>
                                    Estimated Rewards
                                  </Typography>
                                  <Typography variant="body1" fontWeight={600} sx={{ color: selectedPool.color }}>
                                    {calculateExpectedRewards().toFixed(2)} {selectedPool.asset}
                                  </Typography>
                                  <Typography variant="caption" display="block">
                                    {selectedPool.lockPeriods[selectedLockPeriod].days === 0 
                                      ? 'Per Year (flexible)'
                                      : `For ${formatLockPeriod(selectedPool.lockPeriods[selectedLockPeriod].days)} lock period`
                                    }
                                  </Typography>
                                </Box>
                              </Grid>
                            </Grid>
                            
                            {selectedPool.lockPeriods[selectedLockPeriod].days > 0 && (
                              <Alert 
                                severity="info" 
                                icon={<LockIcon />}
                                sx={{ 
                                  mt: 2, 
                                  borderRadius: '8px',
                                  backgroundColor: alpha(theme.palette.info.main, 0.05),
                                  border: `1px solid ${alpha(theme.palette.info.main, 0.1)}`
                                }}
                              >
                                <Typography variant="body2">
                                  Your tokens will be locked for {formatLockPeriod(selectedPool.lockPeriods[selectedLockPeriod].days)} with {getExpectedApy()}% APY.
                                  Early withdrawal is not available for locked positions.
                                </Typography>
                              </Alert>
                            )}
                          </Paper>
                          
                          {/* Submit Button */}
                          <Button
                            variant="contained"
                            fullWidth
                            size="large"
                            startIcon={isProcessing ? null : <StarRateIcon />}
                            onClick={handleStake}
                            disabled={
                              !stakeAmount || 
                              parseFloat(stakeAmount) <= 0 || 
                              parseFloat(stakeAmount) < selectedPool.minStakeAmount ||
                              isProcessing
                            }
                            sx={{
                              borderRadius: '10px',
                              py: 1.5,
                              background: `linear-gradient(90deg, ${selectedPool.color}, ${alpha(selectedPool.color, 0.8)})`,
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
                              'Stake Now'
                            )}
                          </Button>
                          
                          {parseFloat(stakeAmount) < selectedPool.minStakeAmount && stakeAmount && (
                            <Typography variant="caption" color="error" sx={{ display: 'block', mt: 1, textAlign: 'center' }}>
                              Minimum stake amount is {selectedPool.minStakeAmount} {selectedPool.asset}
                            </Typography>
                          )}
                        </Box>
                      )
                    ) : (
                      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 4 }}>
                        <AccountBalanceIcon sx={{ fontSize: 48, color: 'primary.main', mb: 2, opacity: 0.7 }} />
                        <Typography variant="body1" gutterBottom align="center">
                          Connect your wallet to stake assets
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
              
              {/* Staking Info */}
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
                    title="Staking Information" 
                    titleTypographyProps={{ variant: 'h6', fontWeight: 600 }}
                  />
                  <Divider />
                  <CardContent>
                    <List disablePadding>
                      <ListItem sx={{ px: 0, py: 1.5 }}>
                        <ListItemIcon sx={{ minWidth: 42 }}>
                          <Avatar sx={{ bgcolor: alpha(selectedPool.color, 0.1), color: selectedPool.color, width: 34, height: 34 }}>
                            <PercentIcon fontSize="small" />
                          </Avatar>
                        </ListItemIcon>
                        <ListItemText 
                          primary="Earn Rewards" 
                          secondary="Earn competitive rewards on your staked assets"
                          primaryTypographyProps={{ fontWeight: 600 }}
                        />
                      </ListItem>
                      <Divider component="li" />
                      <ListItem sx={{ px: 0, py: 1.5 }}>
                        <ListItemIcon sx={{ minWidth: 42 }}>
                          <Avatar sx={{ bgcolor: alpha(theme.palette.info.main, 0.1), color: theme.palette.info.main, width: 34, height: 34 }}>
                            <HowToVoteIcon fontSize="small" />
                          </Avatar>
                        </ListItemIcon>
                        <ListItemText 
                          primary="Governance Participation" 
                          secondary="Participate in governance decisions and shape the future of the network"
                          primaryTypographyProps={{ fontWeight: 600 }}
                        />
                      </ListItem>
                      <Divider component="li" />
                      <ListItem sx={{ px: 0, py: 1.5 }}>
                        <ListItemIcon sx={{ minWidth: 42 }}>
                          <Avatar sx={{ bgcolor: alpha(theme.palette.success.main, 0.1), color: theme.palette.success.main, width: 34, height: 34 }}>
                            <AutorenewIcon fontSize="small" />
                          </Avatar>
                        </ListItemIcon>
                        <ListItemText 
                          primary="Automatic Compounding" 
                          secondary="Rewards are automatically compounded to maximize your returns"
                          primaryTypographyProps={{ fontWeight: 600 }}
                        />
                      </ListItem>
                      <Divider component="li" />
                      <ListItem sx={{ px: 0, py: 1.5 }}>
                        <ListItemIcon sx={{ minWidth: 42 }}>
                          <Avatar sx={{ bgcolor: alpha(theme.palette.warning.main, 0.1), color: theme.palette.warning.main, width: 34, height: 34 }}>
                            <LockIcon fontSize="small" />
                          </Avatar>
                        </ListItemIcon>
                        <ListItemText 
                          primary="Lock Periods" 
                          secondary="Lock your assets for higher APY. Longer locks = higher rewards"
                          primaryTypographyProps={{ fontWeight: 600 }}
                        />
                      </ListItem>
                    </List>
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
                    title="APY History" 
                    titleTypographyProps={{ variant: 'h6', fontWeight: 600 }}
                  />
                  <Divider />
                  <CardContent>
                    <Box sx={{ height: 240 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart
                          data={mockApyHistory}
                          margin={{
                            top: 5,
                            right: 20,
                            left: 0,
                            bottom: 5,
                          }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke={alpha(theme.palette.divider, 0.5)} />
                          <XAxis 
                            dataKey="day" 
                            tick={{ fontSize: 12 }}
                            stroke={theme.palette.text.secondary}
                          />
                          <YAxis 
                            tick={{ fontSize: 12 }}
                            stroke={theme.palette.text.secondary}
                            domain={['auto', 'auto']}
                          />
                          <RechartsTooltip 
                            formatter={(value) => [`${value}%`, 'APY']} 
                            contentStyle={{ 
                              backgroundColor: theme.palette.background.paper,
                              border: `1px solid ${theme.palette.divider}`,
                              borderRadius: '8px'
                            }}
                          />
                          <Line 
                            type="monotone" 
                            dataKey={selectedPool.asset} 
                            stroke={selectedPool.color} 
                            activeDot={{ r: 8 }} 
                            strokeWidth={2}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </Box>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', mt: 1 }}>
                      APY is variable and changes based on market conditions
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </>
          ) : (
            // Staking Pools List
            <Grid item xs={12}>
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
                  <Grid container spacing={3} alignItems="center">
                    <Grid item xs={12} md={8}>
                      <Box>
                        <Typography variant="h6" fontWeight={600} gutterBottom>
                          Start Staking to Earn Rewards
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Stake your assets to earn passive income and participate in network governance.
                          Our staking pools offer competitive APYs with flexible lock periods.
                        </Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={12} md={4} sx={{ textAlign: { xs: 'left', md: 'right' } }}>
                      {!isConnected && !useMockData && (
                        <Button 
                          variant="contained"
                          size="large"
                          onClick={connectWallet}
                          sx={{ 
                            borderRadius: '10px',
                            background: 'linear-gradient(90deg, #4C3F91, #00BFA5)',
                            px: 3
                          }}
                        >
                          Connect Wallet
                        </Button>
                      )}
                    </Grid>
                  </Grid>
                </Paper>
              </Box>
              
              <Grid container spacing={3}>
                {mockStakingPools.map((pool) => (
                  <Grid item xs={12} md={6} key={pool.id}>
                    <Card 
                      elevation={0}
                      sx={{ 
                        borderRadius: '16px', 
                        border: `1px solid ${alpha(theme.palette.divider, 0.8)}`,
                        boxShadow: `0 4px 20px ${alpha(theme.palette.common.black, 0.05)}`,
                        transition: 'all 0.3s ease',
                        position: 'relative',
                        overflow: 'hidden',
                        '&:hover': {
                          boxShadow: `0 8px 25px ${alpha(theme.palette.common.black, 0.08)}`,
                          borderColor: alpha(pool.color, 0.3),
                          transform: 'translateY(-3px)',
                        },
                        '&::before': {
                          content: '""',
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          right: 0,
                          height: '6px',
                          background: `linear-gradient(90deg, ${pool.color}, ${alpha(pool.color, 0.6)})`,
                          borderRadius: '16px 16px 0 0',
                        }
                      }}
                    >
                      <CardContent sx={{ pt: 3 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <Box 
                              component="img" 
                              src={pool.assetIcon} 
                              alt={pool.asset}
                              sx={{ 
                                width: 40, 
                                height: 40, 
                                mr: 2,
                                borderRadius: '50%'
                              }}
                              onError={(e) => {
                                e.target.src = `https://via.placeholder.com/40/CCCCCC/FFFFFF?text=${pool.asset.charAt(0)}`;
                              }}
                            />
                            <Box>
                              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                <Typography variant="h6" fontWeight={600}>
                                  {pool.name}
                                </Typography>
                                {pool.isVerified && (
                                  <Tooltip title="Verified Pool">
                                    <VerifiedIcon 
                                      fontSize="small" 
                                      color="primary" 
                                      sx={{ ml: 1, opacity: 0.8 }} 
                                    />
                                  </Tooltip>
                                )}
                              </Box>
                              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                <Box 
                                  component="img" 
                                  src={pool.protocolIcon} 
                                  alt={pool.protocol}
                                  sx={{ 
                                    width: 16, 
                                    height: 16, 
                                    mr: 1,
                                    borderRadius: '50%'
                                  }}
                                  onError={(e) => {
                                    e.target.src = `https://via.placeholder.com/16/CCCCCC/FFFFFF?text=${pool.protocol.charAt(0)}`;
                                  }}
                                />
                                <Typography variant="caption" color="text.secondary">
                                  {pool.protocol}
                                </Typography>
                              </Box>
                            </Box>
                          </Box>
                          <Chip 
                            label={`${pool.apy}% APY`} 
                            sx={{ 
                              fontWeight: 700,
                              backgroundColor: alpha(pool.color, 0.1),
                              color: pool.color,
                              borderRadius: '8px',
                              fontSize: '0.875rem',
                              px: 1
                            }} 
                          />
                        </Box>
                        
                        <Divider sx={{ my: 2 }} />
                        
                        <Box sx={{ mb: 2, mt: 3 }}>
                          <Grid container spacing={2}>
                            <Grid item xs={6}>
                              <Typography variant="body2" color="text.secondary" gutterBottom>
                                Total Staked
                              </Typography>
                              <Typography variant="body2" fontWeight={600}>
                                {pool.totalStaked.toLocaleString()} {pool.asset}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                ${pool.totalStakedUsd.toLocaleString()}
                              </Typography>
                            </Grid>
                            <Grid item xs={6}>
                              <Typography variant="body2" color="text.secondary" gutterBottom>
                                Minimum Stake
                              </Typography>
                              <Typography variant="body1" fontWeight={600}>
                                {pool.minStakeAmount} {pool.asset}
                              </Typography>
                            </Grid>
                          </Grid>
                        </Box>
                        
                        <Box 
                          sx={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'space-between', 
                            mt: 3, 
                            cursor: 'pointer',
                            bgcolor: alpha(theme.palette.background.paper, 0.5),
                            p: 1,
                            borderRadius: '8px'
                          }}
                          onClick={() => handleTogglePoolDetails(pool.id)}
                        >
                          <Typography variant="body2" fontWeight={500}>
                            {expandedPoolId === pool.id ? 'Hide Details' : 'View Details'}
                          </Typography>
                          <IconButton size="small">
                            {expandedPoolId === pool.id ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                          </IconButton>
                        </Box>
                        
                        <Collapse in={expandedPoolId === pool.id}>
                          <Box sx={{ mt: 2, mb: 1 }}>
                            <Typography variant="subtitle2" gutterBottom>
                              Lock Periods
                            </Typography>
                            <TableContainer component={Paper} elevation={0} sx={{ borderRadius: '10px' }}>
                              <Table size="small">
                                <TableHead>
                                  <TableRow>
                                    <TableCell sx={{ fontWeight: 600 }}>Period</TableCell>
                                    <TableCell align="right" sx={{ fontWeight: 600 }}>APY</TableCell>
                                  </TableRow>
                                </TableHead>
                                <TableBody>
                                  {pool.lockPeriods.map((period) => (
                                    <TableRow 
                                      key={period.days}
                                      sx={{ 
                                        '&:last-child td, &:last-child th': { border: 0 },
                                        backgroundColor: period.days === 90 ? alpha(pool.color, 0.05) : 'inherit'
                                      }}
                                    >
                                      <TableCell component="th" scope="row">
                                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                          {period.days === 0 ? (
                                            <LockOpenIcon fontSize="small" sx={{ mr: 1, opacity: 0.7 }} />
                                          ) : (
                                            <LockIcon fontSize="small" sx={{ mr: 1, opacity: 0.7 }} />
                                          )}
                                          {formatLockPeriod(period.days)}
                                        </Box>
                                      </TableCell>
                                      <TableCell align="right" sx={{ fontWeight: 500, color: period.days === 90 ? pool.color : 'inherit' }}>
                                        {period.apy}%
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </TableContainer>
                            
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                              {pool.description}
                            </Typography>
                          </Box>
                        </Collapse>
                        
                        <Button
                          variant="contained"
                          fullWidth
                          onClick={() => handleSelectPool(pool)}
                          sx={{
                            mt: 2,
                            borderRadius: '10px',
                            background: `linear-gradient(90deg, ${pool.color}, ${alpha(pool.color, 0.8)})`,
                            transition: 'all 0.3s ease',
                            py: 1.2,
                            '&:hover': {
                              background: `linear-gradient(90deg, ${pool.color}, ${alpha(pool.color, 0.9)})`,
                              boxShadow: `0 4px 12px ${alpha(pool.color, 0.3)}`,
                            }
                          }}
                        >
                          Stake Now
                        </Button>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </Grid>
          )}
        </Grid>
      )}
      
      {tabValue === 1 && (
        <Grid container spacing={3}>
          {/* Your Stakes */}
          <Grid item xs={12}>
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
                <Grid container spacing={3} alignItems="center">
                  <Grid item xs={12} md={4}>
                    <Box>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        Total Staked Value
                      </Typography>
                      <Typography variant="h5" fontWeight={700}>
                        ${getTotalStakedValue().toFixed(2)}
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <Box>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        Pending Rewards
                      </Typography>
                      <Typography variant="h5" fontWeight={700} sx={{ color: theme.palette.primary.main }}>
                        ${getTotalPendingRewards().toFixed(2)}
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={12} md={4} sx={{ textAlign: { xs: 'left', md: 'right' } }}>
                    <Button 
                      variant="contained"
                      onClick={() => setTabValue(0)}
                      startIcon={<StarRateIcon />}
                      sx={{ 
                        borderRadius: '10px',
                        background: 'linear-gradient(90deg, #4C3F91, #00BFA5)',
                        mr: 2
                      }}
                    >
                      Stake More
                    </Button>
                    {getTotalPendingRewards() > 0 && (
                      <Button 
                        variant="outlined"
                        startIcon={<VerifiedIcon />}
                        sx={{ borderRadius: '10px' }}
                      >
                        Claim All
                      </Button>
                    )}
                  </Grid>
                </Grid>
              </Paper>
            </Box>
            
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
                title="Your Active Stakes" 
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
                  mockUserStakes.length > 0 ? (
                    <Grid container spacing={3}>
                      {mockUserStakes.map((stake) => {
                        const pool = mockStakingPools.find(p => p.id === stake.poolId);
                        
                        return (
                          <Grid item xs={12} md={6} key={`${stake.asset}-${stake.startDate}`}>
                            <Paper
                              elevation={0}
                              sx={{
                                p: 3,
                                borderRadius: '12px',
                                border: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
                                background: theme.palette.mode === 'dark'
                                  ? `linear-gradient(135deg, ${alpha(stake.color, 0.15)} 0%, ${alpha(theme.palette.background.paper, 0.9)} 100%)`
                                  : `linear-gradient(135deg, ${alpha(stake.color, 0.07)} 0%, ${theme.palette.background.paper} 100%)`,
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
                                  background: `radial-gradient(circle, ${alpha(stake.color, 0.15)} 0%, transparent 70%)`,
                                  pointerEvents: 'none',
                                }
                              }}
                            >
                              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                <Box
                                  component="img"
                                  src={stake.assetIcon}
                                  alt={stake.asset}
                                  sx={{ 
                                    width: 32, 
                                    height: 32, 
                                    mr: 1.5,
                                    borderRadius: '50%',
                                  }}
                                  onError={(e) => {
                                    e.target.src = `https://via.placeholder.com/32/CCCCCC/FFFFFF?text=${stake.asset.charAt(0)}`;
                                  }}
                                />
                                <Typography variant="h6" fontWeight={600}>
                                  {pool?.name || `${stake.asset} Staking`}
                                </Typography>
                              </Box>
                              
                              <Divider sx={{ mb: 2 }} />
                              
                              <Grid container spacing={2}>
                                <Grid item xs={12} sm={6}>
                                  <Typography variant="body2" color="text.secondary" gutterBottom>
                                    Staked Amount
                                  </Typography>
                                  <Typography variant="h6" fontWeight={700}>
                                    {stake.amount.toLocaleString()} {stake.asset}
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary">
                                    ${stake.valueUsd.toFixed(2)}
                                  </Typography>
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                  <Typography variant="body2" color="text.secondary" gutterBottom>
                                    APY
                                  </Typography>
                                  <Typography variant="h6" fontWeight={700} sx={{ color: stake.color }}>
                                    {stake.apy}%
                                  </Typography>
                                  <Chip 
                                    label={stake.lockDays === 0 ? 'Flexible' : `Locked ${stake.lockDays} days`} 
                                    size="small" 
                                    icon={stake.lockDays === 0 ? <LockOpenIcon fontSize="small" /> : <LockIcon fontSize="small" />}
                                    sx={{ 
                                      mt: 0.5,
                                      fontWeight: 500,
                                      backgroundColor: stake.lockDays === 0 
                                        ? alpha(theme.palette.success.main, 0.1)
                                        : alpha(theme.palette.info.main, 0.1),
                                      color: stake.lockDays === 0 
                                        ? theme.palette.success.main
                                        : theme.palette.info.main,
                                      borderRadius: '6px',
                                      '& .MuiChip-icon': {
                                        color: 'inherit',
                                        fontSize: '0.875rem'
                                      }
                                    }} 
                                  />
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                  <Typography variant="body2" color="text.secondary" gutterBottom>
                                    Start Date
                                  </Typography>
                                  <Typography variant="body2">
                                    {formatDate(stake.startDate)}
                                  </Typography>
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                  <Typography variant="body2" color="text.secondary" gutterBottom>
                                    Time Remaining
                                  </Typography>
                                  <Typography variant="body2" fontWeight={500}>
                                    {formatRemainingTime(stake.endDate)}
                                  </Typography>
                                </Grid>
                              </Grid>
                              
                              <Divider sx={{ my: 2 }} />
                              
                              <Box sx={{ mb: 2 }}>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                  <Typography variant="body2" color="text.secondary">
                                    Pending Rewards
                                  </Typography>
                                  <Typography variant="body2" fontWeight={600} sx={{ color: stake.color }}>
                                    {stake.pendingRewards.toFixed(2)} {stake.asset}
                                  </Typography>
                                </Box>
                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'right' }}>
                                  ${stake.pendingRewardsUsd.toFixed(2)}
                                </Typography>
                              </Box>
                              
                              <Box sx={{ display: 'flex', gap: 1 }}>
                                <Button
                                  variant="contained"
                                  fullWidth
                                  size="small"
                                  sx={{
                                    borderRadius: '8px',
                                    background: `linear-gradient(90deg, ${stake.color}, ${alpha(stake.color, 0.8)})`,
                                  }}
                                >
                                  Claim Rewards
                                </Button>
                                {stake.lockDays === 0 && (
                                  <Button
                                    variant="outlined"
                                    fullWidth
                                    size="small"
                                    sx={{
                                      borderRadius: '8px',
                                      borderColor: alpha(stake.color, 0.5),
                                      color: stake.color,
                                    }}
                                  >
                                    Unstake
                                  </Button>
                                )}
                              </Box>
                            </Paper>
                          </Grid>
                        );
                      })}
                    </Grid>
                  ) : (
                    <Box sx={{ textAlign: 'center', py: 4 }}>
                      <AutorenewIcon sx={{ fontSize: 48, color: 'text.secondary', opacity: 0.5, mb: 2 }} />
                      <Typography variant="body1" gutterBottom>
                        No active stakes found
                      </Typography>
                      <Button 
                        variant="contained"
                        onClick={() => setTabValue(0)}
                        startIcon={<StarRateIcon />}
                        sx={{ mt: 2, borderRadius: '10px' }}
                      >
                        Stake Now
                      </Button>
                    </Box>
                  )
                ) : (
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 4 }}>
                    <AccountBalanceIcon sx={{ fontSize: 48, color: 'primary.main', mb: 2, opacity: 0.7 }} />
                    <Typography variant="body1" gutterBottom align="center">
                      Connect your wallet to view your stakes
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
            
            <Card 
              elevation={0}
              sx={{ 
                borderRadius: '16px', 
                border: `1px solid ${alpha(theme.palette.divider, 0.8)}`,
                boxShadow: `0 4px 20px ${alpha(theme.palette.common.black, 0.05)}`,
                position: 'relative',
                overflow: 'hidden',
                transition: 'all 0.3s ease',
                mt: 3,
                '&:hover': {
                  boxShadow: `0 8px 25px ${alpha(theme.palette.common.black, 0.08)}`,
                  borderColor: alpha(theme.palette.primary.main, 0.2),
                }
              }}
            >
              <CardHeader 
                title="Staking History" 
                titleTypographyProps={{ variant: 'h6', fontWeight: 600 }}
              />
              <Divider />
              <CardContent>
                {isConnected || useMockData ? (
                  mockStakingHistory.length > 0 ? (
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
                        {mockStakingHistory.map((transaction, index) => (
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
                                  {transaction.action === 'stake' ? (
                                    <StarRateIcon 
                                      fontSize="small" 
                                      sx={{ 
                                        color: theme.palette.primary.main,
                                        p: 0.5,
                                        borderRadius: '50%',
                                        backgroundColor: alpha(theme.palette.primary.main, 0.1)
                                      }} 
                                    />
                                  ) : (
                                    <PaymentsIcon 
                                      fontSize="small" 
                                      sx={{ 
                                        color: theme.palette.success.main,
                                        p: 0.5,
                                        borderRadius: '50%',
                                        backgroundColor: alpha(theme.palette.success.main, 0.1)
                                      }} 
                                    />
                                  )}
                                </Box>
                                <Box>
                                  <Typography variant="body2" fontWeight={500}>
                                    {transaction.action === 'stake' ? 'Stake' : 'Claim'} {transaction.asset}
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary">
                                    {formatDate(transaction.timestamp)}
                                  </Typography>
                                </Box>
                              </Box>
                              <Box sx={{ width: '20%' }}>
                                <Typography variant="body2" fontWeight={500}>
                                  {transaction.amount.toLocaleString()} {transaction.asset}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  ${transaction.valueUsd.toLocaleString()}
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
                            {index < mockStakingHistory.length - 1 && (
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
                        No staking history found
                      </Typography>
                    </Box>
                  )
                ) : (
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 4 }}>
                    <Typography variant="body2" color="text.secondary" align="center">
                      Connect your wallet to view your staking history
                    </Typography>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}
      
      {tabValue === 2 && (
        <Grid container spacing={3}>
          {/* Analytics */}
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
                title="Staking Analytics" 
                titleTypographyProps={{ 
                  variant: 'h6', 
                  fontWeight: 600,
                  sx: { mt: 0.5 }
                }}
              />
              <Divider />
              <CardContent>
                <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                  APY Comparison
                </Typography>
                <Box sx={{ height: 300, mb: 4 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={mockApyHistory}
                      margin={{
                        top: 5,
                        right: 30,
                        left: 10,
                        bottom: 5,
                      }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke={alpha(theme.palette.divider, 0.5)} />
                      <XAxis 
                        dataKey="day" 
                        tick={{ fontSize: 12 }}
                        stroke={theme.palette.text.secondary}
                      />
                      <YAxis 
                        tick={{ fontSize: 12 }}
                        stroke={theme.palette.text.secondary}
                      />
                      <RechartsTooltip 
                        formatter={(value) => [`${value}%`, 'APY']} 
                        contentStyle={{ 
                          backgroundColor: theme.palette.background.paper,
                          border: `1px solid ${theme.palette.divider}`,
                          borderRadius: '8px'
                        }}
                      />
                      <Legend />
                      <Line 
                        type="monotone" 
                        dataKey="MIOTA" 
                        stroke="#00BFA5" 
                        activeDot={{ r: 8 }} 
                        strokeWidth={2}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="ASMB" 
                        stroke="#8B69FF" 
                        activeDot={{ r: 8 }} 
                        strokeWidth={2}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="SMR" 
                        stroke="#25D8AB" 
                        activeDot={{ r: 8 }} 
                        strokeWidth={2}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </Box>
                
                <Divider sx={{ mb: 3 }} />
                
                <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                  Total Staked by Asset
                </Typography>
                <Box sx={{ height: 300 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={mockStakingPools.map(pool => ({
                        name: pool.asset,
                        value: pool.totalStakedUsd,
                        color: pool.color
                      }))}
                      margin={{
                        top: 5,
                        right: 30,
                        left: 20,
                        bottom: 5,
                      }}
                      barSize={60}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke={alpha(theme.palette.divider, 0.5)} />
                      <XAxis 
                        dataKey="name" 
                        scale="point" 
                        padding={{ left: 50, right: 50 }}
                        tick={{ fontSize: 12 }}
                        stroke={theme.palette.text.secondary}
                      />
                      <YAxis 
                        tick={{ fontSize: 12 }}
                        stroke={theme.palette.text.secondary}
                      />
                      <RechartsTooltip
                        formatter={(value) => [`$${value.toLocaleString()}`, 'Total Staked']}
                        contentStyle={{ 
                          backgroundColor: theme.palette.background.paper,
                          border: `1px solid ${theme.palette.divider}`,
                          borderRadius: '8px'
                        }}
                      />
                      <Bar dataKey="value">
                        {mockStakingPools.map((pool, index) => (
                          <Cell key={`cell-${index}`} fill={pool.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}
    </Box>
  );
};

export default Staking;