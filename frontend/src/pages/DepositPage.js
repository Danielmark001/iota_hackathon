import React, { useState, useEffect } from 'react';
import {
  Container,
  Grid,
  Typography,
  Box,
  Button,
  Paper,
  TextField,
  Divider,
  MenuItem,
  InputAdornment,
  Slider,
  FormControlLabel,
  Switch,
  CircularProgress,
  Chip,
  Tooltip,
  Alert,
  useTheme,
} from '@mui/material';
import {
  Savings,
  Info,
  ArrowForward,
  MonetizationOn,
  AccountBalanceWallet,
  SwapHoriz,
  TrendingUp,
} from '@mui/icons-material';
import { Link as RouterLink } from 'react-router-dom';

// Components
import StatCard from '../components/dashboard/StatCard';
import LoadingBackdrop from '../components/ui/LoadingBackdrop';

// Contexts
import { useWeb3 } from '../context/Web3Context';
import { useSnackbar } from '../context/SnackbarContext';

// Services
import apiService from '../services/apiService';

const DepositPage = () => {
  const theme = useTheme();
  const { currentAccount, lendingPool } = useWeb3();
  const { showSnackbar } = useSnackbar();
  
  // Component state
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [userProfile, setUserProfile] = useState(null);
  const [assetOptions, setAssetOptions] = useState([]);
  const [selectedAsset, setSelectedAsset] = useState('');
  const [amount, setAmount] = useState('');
  const [balance, setBalance] = useState(0);
  const [depositAmount, setDepositAmount] = useState(0);
  const [percentageAmount, setPercentageAmount] = useState(0);
  const [enableCollateral, setEnableCollateral] = useState(true);
  
  // Fetch user profile and available assets
  useEffect(() => {
    const loadData = async () => {
      if (!currentAccount) return;
      
      setLoading(true);
      try {
        // Fetch user profile data
        const profileData = await apiService.getUserProfile(currentAccount);
        setUserProfile(profileData);
        
        // Mock fetch available assets (in a real app, would come from the API)
        const assets = [
          { symbol: 'MIOTA', name: 'IOTA', apy: 5.2, balance: 1000 },
          { symbol: 'ETH', name: 'Ethereum', apy: 3.8, balance: 2.5 },
          { symbol: 'USDT', name: 'Tether', apy: 8.5, balance: 1500 },
          { symbol: 'DAI', name: 'DAI', apy: 7.3, balance: 2000 },
        ];
        
        setAssetOptions(assets);
        
        // Set default asset
        if (assets.length > 0) {
          setSelectedAsset(assets[0].symbol);
          setBalance(assets[0].balance);
        }
      } catch (error) {
        console.error('Error loading data:', error);
        showSnackbar('Failed to load account data', 'error');
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, [currentAccount, showSnackbar]);
  
  // Handle asset change
  const handleAssetChange = (event) => {
    const symbol = event.target.value;
    setSelectedAsset(symbol);
    
    // Update balance for the selected asset
    const asset = assetOptions.find(a => a.symbol === symbol);
    if (asset) {
      setBalance(asset.balance);
    }
  };
  
  // Handle amount change
  const handleAmountChange = (event) => {
    const value = event.target.value;
    setAmount(value);
    
    // Calculate percentage of balance
    if (balance > 0 && value) {
      const percent = (parseFloat(value) / balance) * 100;
      setPercentageAmount(Math.min(percent, 100));
    } else {
      setPercentageAmount(0);
    }
  };
  
  // Handle slider change
  const handleSliderChange = (_, newValue) => {
    setPercentageAmount(newValue);
    
    // Calculate amount based on percentage
    const newAmount = (balance * newValue) / 100;
    setAmount(newAmount.toFixed(6));
  };
  
  // Handle max button click
  const handleMaxClick = () => {
    setAmount(balance.toString());
    setPercentageAmount(100);
  };
  
  // Handle submit - deposit funds
  const handleDeposit = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      showSnackbar('Please enter a valid amount', 'error');
      return;
    }
    
    if (parseFloat(amount) > balance) {
      showSnackbar('Insufficient balance', 'error');
      return;
    }
    
    setProcessing(true);
    try {
      // In a real app, this would interact with the smart contract
      // For demo, simulate a successful transaction
      
      // Example smart contract call (commented out for demo)
      /*
      if (lendingPool) {
        const amountInWei = ethers.utils.parseEther(amount);
        const tx = await lendingPool.deposit(amountInWei);
        await tx.wait();
        
        // Update balance after successful deposit
        const newBalance = balance - parseFloat(amount);
        setBalance(newBalance);
        
        // Clear form
        setAmount('');
        setPercentageAmount(0);
      }
      */
      
      // Simulate transaction delay
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Simulate successful transaction
      const newBalance = balance - parseFloat(amount);
      setBalance(newBalance);
      
      // Clear form
      setAmount('');
      setPercentageAmount(0);
      
      // Show success message
      showSnackbar(`Successfully deposited ${amount} ${selectedAsset}`, 'success');
    } catch (error) {
      console.error('Error depositing funds:', error);
      showSnackbar('Failed to deposit funds. Please try again.', 'error');
    } finally {
      setProcessing(false);
    }
  };
  
  // Format currency for display
  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  };
  
  // Get the selected asset APY
  const getSelectedAssetAPY = () => {
    const asset = assetOptions.find(a => a.symbol === selectedAsset);
    return asset ? asset.apy : 0;
  };
  
  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <LoadingBackdrop open={loading} message="Loading account data..." />
      
      {/* Page header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Deposit
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Supply assets to earn interest and use as collateral for borrowing.
        </Typography>
      </Box>
      
      {/* Account summary cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={4}>
          <StatCard
            title="Total Deposited"
            value={userProfile ? formatCurrency(userProfile.deposits) : '$0.00'}
            icon={<Savings fontSize="large" />}
            loading={loading}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <StatCard
            title="Total Borrowed"
            value={userProfile ? formatCurrency(userProfile.borrows) : '$0.00'}
            icon={<AccountBalanceWallet fontSize="large" />}
            loading={loading}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <StatCard
            title="Collateral"
            value={userProfile ? formatCurrency(userProfile.collateral) : '$0.00'}
            icon={<MonetizationOn fontSize="large" />}
            loading={loading}
          />
        </Grid>
      </Grid>
      
      {/* Main content - Deposit form and info */}
      <Grid container spacing={4}>
        {/* Deposit form */}
        <Grid item xs={12} md={7}>
          <Paper elevation={2} sx={{ p: 3, borderRadius: 2 }}>
            <Typography variant="h5" gutterBottom>
              Supply Assets
            </Typography>
            <Divider sx={{ mb: 3 }} />
            
            <Grid container spacing={3}>
              {/* Asset selector */}
              <Grid item xs={12}>
                <TextField
                  select
                  fullWidth
                  label="Asset"
                  value={selectedAsset}
                  onChange={handleAssetChange}
                  disabled={loading || processing}
                >
                  {assetOptions.map((option) => (
                    <MenuItem key={option.symbol} value={option.symbol}>
                      <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', justifyContent: 'space-between' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          {/* Placeholder for asset icon */}
                          <Box
                            sx={{
                              width: 24,
                              height: 24,
                              borderRadius: '50%',
                              bgcolor: 'primary.main',
                              mr: 1,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: 'white',
                              fontSize: '0.75rem',
                            }}
                          >
                            {option.symbol.substring(0, 1)}
                          </Box>
                          <Typography>{option.name}</Typography>
                        </Box>
                        <Box>
                          <Chip 
                            label={`${option.apy}% APY`}
                            size="small"
                            color="primary"
                            variant="outlined"
                          />
                        </Box>
                      </Box>
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
              
              {/* Amount input */}
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Amount"
                  value={amount}
                  onChange={handleAmountChange}
                  type="number"
                  disabled={loading || processing}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <Button
                          variant="text"
                          size="small"
                          onClick={handleMaxClick}
                          disabled={loading || processing}
                        >
                          MAX
                        </Button>
                        <Typography variant="body2" sx={{ ml: 1 }}>
                          {selectedAsset}
                        </Typography>
                      </InputAdornment>
                    ),
                  }}
                  helperText={`Balance: ${balance} ${selectedAsset}`}
                />
              </Grid>
              
              {/* Amount slider */}
              <Grid item xs={12}>
                <Box sx={{ px: 1 }}>
                  <Slider
                    value={percentageAmount}
                    onChange={handleSliderChange}
                    disabled={loading || processing}
                    marks={[
                      { value: 0, label: '0%' },
                      { value: 25, label: '25%' },
                      { value: 50, label: '50%' },
                      { value: 75, label: '75%' },
                      { value: 100, label: '100%' },
                    ]}
                    valueLabelDisplay="auto"
                    valueLabelFormat={(value) => `${value}%`}
                  />
                </Box>
              </Grid>
              
              {/* Use as collateral switch */}
              <Grid item xs={12}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={enableCollateral}
                        onChange={(e) => setEnableCollateral(e.target.checked)}
                        disabled={loading || processing}
                      />
                    }
                    label="Use as collateral"
                  />
                  <Tooltip title="Enable this asset as collateral to borrow against it. Some assets may not be eligible as collateral.">
                    <Info color="action" fontSize="small" sx={{ ml: 1 }} />
                  </Tooltip>
                </Box>
              </Grid>
              
              {/* Submit button */}
              <Grid item xs={12}>
                <Button
                  variant="contained"
                  color="primary"
                  size="large"
                  fullWidth
                  onClick={handleDeposit}
                  disabled={!amount || parseFloat(amount) <= 0 || parseFloat(amount) > balance || loading || processing}
                  sx={{ mt: 1, py: 1.5 }}
                  startIcon={processing ? <CircularProgress size={20} color="inherit" /> : <Savings />}
                >
                  {processing ? 'Processing...' : 'Supply'}
                </Button>
              </Grid>
            </Grid>
          </Paper>
        </Grid>
        
        {/* Info panel */}
        <Grid item xs={12} md={5}>
          <Paper elevation={2} sx={{ p: 3, borderRadius: 2, height: '100%' }}>
            <Typography variant="h5" gutterBottom>
              Supply Information
            </Typography>
            <Divider sx={{ mb: 3 }} />
            
            <Box sx={{ mb: 4 }}>
              <Typography variant="h6" gutterBottom>
                Transaction Summary
              </Typography>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  Supply Rate
                </Typography>
                <Typography variant="body2" fontWeight="medium">
                  {getSelectedAssetAPY()}% APY
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  Collateral
                </Typography>
                <Typography variant="body2" fontWeight="medium">
                  {enableCollateral ? 'Yes' : 'No'}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  Health Factor Change
                </Typography>
                <Typography variant="body2" fontWeight="medium" color="success.main">
                  {enableCollateral ? '+0.5' : 'No Change'}
                </Typography>
              </Box>
            </Box>
            
            <Alert severity="info" sx={{ mb: 3 }}>
              <Typography variant="body2">
                Supplying {selectedAsset} will earn you interest based on the current supply rate.
                {enableCollateral && ' This asset will also be enabled as collateral, which you can borrow against.'}
              </Typography>
            </Alert>
            
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" gutterBottom>
                AI Insights
              </Typography>
              <Paper variant="outlined" sx={{ p: 2, bgcolor: 'background.default' }}>
                <Box sx={{ display: 'flex', mb: 1 }}>
                  <TrendingUp color="primary" sx={{ mr: 1 }} />
                  <Typography variant="body2" fontWeight="medium">
                    Market Analysis
                  </Typography>
                </Box>
                <Typography variant="body2" paragraph>
                  {selectedAsset} has shown stable supply rates over the past 30 days with a
                  {getSelectedAssetAPY() > 5 ? ' high' : ' moderate'} APY compared to other assets.
                </Typography>
                <Box sx={{ display: 'flex', mb: 1 }}>
                  <SwapHoriz color="secondary" sx={{ mr: 1 }} />
                  <Typography variant="body2" fontWeight="medium">
                    Portfolio Recommendation
                  </Typography>
                </Box>
                <Typography variant="body2">
                  Based on your current portfolio, adding {selectedAsset} as collateral
                  {getSelectedAssetAPY() > 5 
                    ? ' is recommended due to its high yield.'
                    : ' provides diversification but consider higher yielding assets.'}
                </Typography>
              </Paper>
            </Box>
            
            <Divider sx={{ mb: 2 }} />
            
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Button
                variant="outlined"
                component={RouterLink}
                to="/dashboard"
                startIcon={<ArrowForward />}
              >
                Back to Dashboard
              </Button>
              <Button
                variant="outlined"
                color="secondary"
                component={RouterLink}
                to="/borrow"
                endIcon={<AccountBalanceWallet />}
              >
                Borrow
              </Button>
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
};

export default DepositPage;
