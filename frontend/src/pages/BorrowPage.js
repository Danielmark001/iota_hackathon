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
  CircularProgress,
  Chip,
  Tooltip,
  Alert,
  useTheme,
  LinearProgress,
} from '@mui/material';
import {
  AccountBalanceWallet,
  Info,
  ArrowForward,
  MonetizationOn,
  Security,
  Warning,
  TrendingUp,
  ArrowBack,
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

// Helper function to get color based on health factor
const getHealthColor = (healthFactor) => {
  if (healthFactor >= 1.7) return 'success';
  if (healthFactor >= 1.2) return 'warning';
  return 'error';
};

const BorrowPage = () => {
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
  const [maxBorrowAmount, setMaxBorrowAmount] = useState(0);
  const [percentageAmount, setPercentageAmount] = useState(0);
  const [estimatedHealthFactor, setEstimatedHealthFactor] = useState(0);
  
  // Fetch user profile and available assets
  useEffect(() => {
    const loadData = async () => {
      if (!currentAccount) return;
      
      setLoading(true);
      try {
        // Fetch user profile data
        const profileData = await apiService.getUserProfile(currentAccount);
        setUserProfile(profileData);
        
        // Calculate max borrow amount based on collateral and health factor
        // In a real app, this would come from the smart contract
        const maxBorrow = profileData.collateral * 0.7 - profileData.borrows;
        setMaxBorrowAmount(Math.max(0, maxBorrow));
        
        // Set initial health factor
        setEstimatedHealthFactor(profileData.healthFactor);
        
        // Mock fetch available assets (in a real app, would come from the API)
        const assets = [
          { symbol: 'MIOTA', name: 'IOTA', interestRate: 7.2, available: 150000 },
          { symbol: 'ETH', name: 'Ethereum', interestRate: 5.8, available: 500 },
          { symbol: 'USDT', name: 'Tether', interestRate: 12.1, available: 200000 },
          { symbol: 'DAI', name: 'DAI', interestRate: 10.5, available: 180000 },
        ];
        
        setAssetOptions(assets);
        
        // Set default asset
        if (assets.length > 0) {
          setSelectedAsset(assets[0].symbol);
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
    setSelectedAsset(event.target.value);
  };
  
  // Handle amount change
  const handleAmountChange = (event) => {
    const value = event.target.value;
    setAmount(value);
    
    // Calculate percentage of max borrow amount
    if (maxBorrowAmount > 0 && value) {
      const percent = (parseFloat(value) / maxBorrowAmount) * 100;
      setPercentageAmount(Math.min(percent, 100));
      
      // Estimate new health factor
      updateEstimatedHealthFactor(parseFloat(value));
    } else {
      setPercentageAmount(0);
      setEstimatedHealthFactor(userProfile?.healthFactor || 0);
    }
  };
  
  // Handle slider change
  const handleSliderChange = (_, newValue) => {
    setPercentageAmount(newValue);
    
    // Calculate amount based on percentage
    const newAmount = (maxBorrowAmount * newValue) / 100;
    setAmount(newAmount.toFixed(6));
    
    // Estimate new health factor
    updateEstimatedHealthFactor(newAmount);
  };
  
  // Handle max button click
  const handleMaxClick = () => {
    // Don't allow max to be higher than 80% of max borrow amount for safety
    const safeMaxBorrow = maxBorrowAmount * 0.8;
    setAmount(safeMaxBorrow.toFixed(6));
    setPercentageAmount(80);
    
    // Estimate new health factor
    updateEstimatedHealthFactor(safeMaxBorrow);
  };
  
  // Update estimated health factor based on new borrow amount
  const updateEstimatedHealthFactor = (newBorrowAmount) => {
    if (!userProfile) return;
    
    // Simple estimation: health factor decreases as borrow amount increases
    // In a real app, this would use the actual formula from the smart contract
    const totalBorrow = userProfile.borrows + newBorrowAmount;
    if (totalBorrow <= 0) {
      setEstimatedHealthFactor(userProfile.healthFactor);
      return;
    }
    
    const collateralValue = userProfile.collateral;
    const liquidationThreshold = 0.83; // Example value, would come from contract
    
    const newHealthFactor = (collateralValue * liquidationThreshold) / totalBorrow;
    setEstimatedHealthFactor(newHealthFactor);
  };
  
  // Handle submit - borrow funds
  const handleBorrow = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      showSnackbar('Please enter a valid amount', 'error');
      return;
    }
    
    if (parseFloat(amount) > maxBorrowAmount) {
      showSnackbar('Amount exceeds maximum borrow limit', 'error');
      return;
    }
    
    if (estimatedHealthFactor < 1.05) {
      showSnackbar('Borrowing this amount would put your position at risk', 'error');
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
        const tx = await lendingPool.borrow(amountInWei);
        await tx.wait();
        
        // Update state after successful borrow
        const updatedProfile = { ...userProfile };
        updatedProfile.borrows += parseFloat(amount);
        updatedProfile.healthFactor = estimatedHealthFactor;
        setUserProfile(updatedProfile);
        
        // Update max borrow amount
        const newMaxBorrow = updatedProfile.collateral * 0.7 - updatedProfile.borrows;
        setMaxBorrowAmount(Math.max(0, newMaxBorrow));
        
        // Clear form
        setAmount('');
        setPercentageAmount(0);
      }
      */
      
      // Simulate transaction delay
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Simulate successful transaction
      const updatedProfile = { ...userProfile };
      updatedProfile.borrows += parseFloat(amount);
      updatedProfile.healthFactor = estimatedHealthFactor;
      setUserProfile(updatedProfile);
      
      // Update max borrow amount
      const newMaxBorrow = updatedProfile.collateral * 0.7 - updatedProfile.borrows;
      setMaxBorrowAmount(Math.max(0, newMaxBorrow));
      
      // Clear form
      setAmount('');
      setPercentageAmount(0);
      
      // Show success message
      showSnackbar(`Successfully borrowed ${amount} ${selectedAsset}`, 'success');
    } catch (error) {
      console.error('Error borrowing funds:', error);
      showSnackbar('Failed to borrow funds. Please try again.', 'error');
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
  
  // Get the selected asset interest rate
  const getSelectedAssetInterestRate = () => {
    const asset = assetOptions.find(a => a.symbol === selectedAsset);
    return asset ? asset.interestRate : 0;
  };
  
  // Get text based on estimated health factor
  const getHealthFactorText = () => {
    if (estimatedHealthFactor >= 1.7) return 'Safe';
    if (estimatedHealthFactor >= 1.2) return 'Moderate Risk';
    if (estimatedHealthFactor >= 1.0) return 'High Risk';
    return 'Liquidation Risk';
  };
  
  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <LoadingBackdrop open={loading} message="Loading account data..." />
      
      {/* Page header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Borrow
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Borrow assets against your supplied collateral.
        </Typography>
      </Box>
      
      {/* Account summary cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Available Collateral"
            value={formatCurrency(userProfile?.collateral || 0)}
            icon={<Security fontSize="large" />}
            loading={loading}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Total Borrowed"
            value={formatCurrency(userProfile?.borrows || 0)}
            icon={<AccountBalanceWallet fontSize="large" />}
            loading={loading}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Borrow Limit"
            value={formatCurrency(maxBorrowAmount)}
            icon={<MonetizationOn fontSize="large" />}
            loading={loading}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Health Factor"
            value={userProfile?.healthFactor.toFixed(2) || '0.00'}
            secondaryValue={getHealthFactorText()}
            gradient={true}
            gradientType={getHealthColor(userProfile?.healthFactor || 0)}
            loading={loading}
          />
        </Grid>
      </Grid>
      
      {/* No collateral warning */}
      {userProfile && userProfile.collateral <= 0 && (
        <Alert severity="warning" sx={{ mb: 4 }}>
          <Typography variant="body1" fontWeight="medium">
            No Collateral Available
          </Typography>
          <Typography variant="body2">
            You need to supply assets as collateral before you can borrow.
          </Typography>
          <Button
            variant="outlined"
            size="small"
            component={RouterLink}
            to="/deposit"
            sx={{ mt: 1 }}
          >
            Supply Collateral
          </Button>
        </Alert>
      )}
      
      {/* Main content - Borrow form and info */}
      <Grid container spacing={4}>
        {/* Borrow form */}
        <Grid item xs={12} md={7}>
          <Paper elevation={2} sx={{ p: 3, borderRadius: 2 }}>
            <Typography variant="h5" gutterBottom>
              Borrow Assets
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
                  disabled={loading || processing || maxBorrowAmount <= 0}
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
                            label={`${option.interestRate}% APR`}
                            size="small"
                            color="secondary"
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
                  disabled={loading || processing || maxBorrowAmount <= 0}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <Button
                          variant="text"
                          size="small"
                          onClick={handleMaxClick}
                          disabled={loading || processing || maxBorrowAmount <= 0}
                        >
                          MAX
                        </Button>
                        <Typography variant="body2" sx={{ ml: 1 }}>
                          {selectedAsset}
                        </Typography>
                      </InputAdornment>
                    ),
                  }}
                  helperText={`Available to borrow: ${maxBorrowAmount.toFixed(6)} ${selectedAsset}`}
                />
              </Grid>
              
              {/* Amount slider */}
              <Grid item xs={12}>
                <Box sx={{ px: 1 }}>
                  <Slider
                    value={percentageAmount}
                    onChange={handleSliderChange}
                    disabled={loading || processing || maxBorrowAmount <= 0}
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
              
              {/* Health factor indicator */}
              <Grid item xs={12}>
                <Box sx={{ mb: 1 }}>
                  <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center' }}>
                    Health Factor
                    <Tooltip title="The health factor represents the safety of your loan relative to its collateral value. A value below 1.0 triggers liquidation.">
                      <Info color="action" fontSize="small" sx={{ ml: 1 }} />
                    </Tooltip>
                  </Typography>
                </Box>
                
                <Box sx={{ mb: 1 }}>
                  <LinearProgress
                    variant="determinate"
                    value={Math.min((estimatedHealthFactor / 2) * 100, 100)}
                    color={
                      estimatedHealthFactor >= 1.7
                        ? 'success'
                        : estimatedHealthFactor >= 1.2
                        ? 'warning'
                        : 'error'
                    }
                    sx={{ height: 8, borderRadius: 4 }}
                  />
                </Box>
                
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Typography variant="h6" color={getHealthColor(estimatedHealthFactor)} sx={{ mr: 1 }}>
                      {estimatedHealthFactor.toFixed(2)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {getHealthFactorText()}
                    </Typography>
                  </Box>
                  
                  {estimatedHealthFactor < 1.2 && (
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <Warning color="error" fontSize="small" sx={{ mr: 0.5 }} />
                      <Typography variant="body2" color="error.main">
                        High risk of liquidation
                      </Typography>
                    </Box>
                  )}
                </Box>
              </Grid>
              
              {/* Submit button */}
              <Grid item xs={12}>
                <Button
                  variant="contained"
                  color="secondary"
                  size="large"
                  fullWidth
                  onClick={handleBorrow}
                  disabled={
                    !amount || 
                    parseFloat(amount) <= 0 || 
                    parseFloat(amount) > maxBorrowAmount || 
                    estimatedHealthFactor < 1.05 || 
                    loading || 
                    processing ||
                    maxBorrowAmount <= 0
                  }
                  sx={{ mt: 1, py: 1.5 }}
                  startIcon={processing ? <CircularProgress size={20} color="inherit" /> : <AccountBalanceWallet />}
                >
                  {processing ? 'Processing...' : 'Borrow'}
                </Button>
              </Grid>
            </Grid>
          </Paper>
        </Grid>
        
        {/* Info panel */}
        <Grid item xs={12} md={5}>
          <Paper elevation={2} sx={{ p: 3, borderRadius: 2, height: '100%' }}>
            <Typography variant="h5" gutterBottom>
              Borrow Information
            </Typography>
            <Divider sx={{ mb: 3 }} />
            
            <Box sx={{ mb: 4 }}>
              <Typography variant="h6" gutterBottom>
                Transaction Summary
              </Typography>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  Borrow Rate
                </Typography>
                <Typography variant="body2" fontWeight="medium">
                  {getSelectedAssetInterestRate()}% APR
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  Risk Level
                </Typography>
                <Chip 
                  label={getHealthFactorText()}
                  size="small"
                  color={getHealthColor(estimatedHealthFactor)}
                />
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  Liquidation Threshold
                </Typography>
                <Typography variant="body2" fontWeight="medium">
                  83% LTV
                </Typography>
              </Box>
            </Box>
            
            <Alert 
              severity={estimatedHealthFactor < 1.2 ? "warning" : "info"} 
              sx={{ mb: 3 }}
            >
              <Typography variant="body2">
                {estimatedHealthFactor < 1.2 ? (
                  "Your position will be at risk if market conditions change. Consider borrowing less or adding more collateral."
                ) : (
                  "Interest rates are variable and may change based on market conditions. You can repay your loan at any time."
                )}
              </Typography>
            </Alert>
            
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" gutterBottom>
                AI Recommendations
              </Typography>
              <Paper variant="outlined" sx={{ p: 2, bgcolor: 'background.default' }}>
                <Box sx={{ display: 'flex', mb: 1 }}>
                  <TrendingUp color="primary" sx={{ mr: 1 }} />
                  <Typography variant="body2" fontWeight="medium">
                    Optimal Borrowing
                  </Typography>
                </Box>
                <Typography variant="body2" paragraph>
                  Based on your risk profile and current market conditions, the AI recommends borrowing no more than {(maxBorrowAmount * 0.65).toFixed(2)} {selectedAsset} to maintain a healthy position.
                </Typography>
                <Box sx={{ display: 'flex', mb: 1 }}>
                  <Security color="secondary" sx={{ mr: 1 }} />
                  <Typography variant="body2" fontWeight="medium">
                    Position Safety
                  </Typography>
                </Box>
                <Typography variant="body2">
                  To maintain a safe position, it's recommended to keep your Health Factor above 1.5. This provides a buffer against market volatility.
                </Typography>
              </Paper>
            </Box>
            
            <Divider sx={{ mb: 2 }} />
            
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Button
                variant="outlined"
                component={RouterLink}
                to="/dashboard"
                startIcon={<ArrowBack />}
              >
                Back to Dashboard
              </Button>
              <Button
                variant="outlined"
                color="primary"
                component={RouterLink}
                to="/deposit"
                endIcon={<MonetizationOn />}
              >
                Supply Collateral
              </Button>
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
};

export default BorrowPage;
