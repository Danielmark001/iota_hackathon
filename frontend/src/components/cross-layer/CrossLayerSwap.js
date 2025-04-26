import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Card, 
  CardContent, 
  Typography, 
  TextField, 
  Button, 
  CircularProgress, 
  Stepper, 
  Step, 
  StepLabel,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Divider,
  Grid,
  Paper,
  Tooltip,
  IconButton,
  InputAdornment
} from '@mui/material';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import InfoIcon from '@mui/icons-material/Info';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';
import ErrorIcon from '@mui/icons-material/Error';
import RefreshIcon from '@mui/icons-material/Refresh';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import { useTheme } from '@mui/material/styles';

import { useWeb3 } from '../../context/Web3Context';
import { useIoTA } from '../../context/IoTAContext';
import { useSnackbar } from '../../context/SnackbarContext';
import SwapConfirmationModal from './SwapConfirmationModal';
import TransactionProgress from './TransactionProgress';
import NetworkFeeDisplay from './NetworkFeeDisplay';
import axios from 'axios';

// Steps in the swap process
const SWAP_STEPS = ['Select Assets', 'Preview Swap', 'Confirm', 'Processing', 'Complete'];

// Define L1 and L2 network names
const L1_NETWORK = 'IOTA L1';
const L2_NETWORK = 'IOTA L2 (EVM)';

/**
 * Enhanced Cross-Layer Swap component with improved UI and UX
 */
const CrossLayerSwap = () => {
  const theme = useTheme();
  const { isConnected: isWeb3Connected, address: evmAddress, balance: evmBalance, sendTransaction } = useWeb3();
  const { isConnected: isIotaConnected, address: iotaAddress, balance: iotaBalance, sendTokens } = useIoTA();
  const { showSnackbar } = useSnackbar();
  
  // State
  const [activeStep, setActiveStep] = useState(0);
  const [direction, setDirection] = useState('L1toL2'); // 'L1toL2' or 'L2toL1'
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [estimatedFee, setEstimatedFee] = useState(null);
  const [confirmationTime, setConfirmationTime] = useState(null);
  const [transactionStatus, setTransactionStatus] = useState(null); // 'pending', 'confirmed', 'failed'
  const [transactionHash, setTransactionHash] = useState(null);
  const [openConfirmModal, setOpenConfirmModal] = useState(false);
  const [swapHistory, setSwapHistory] = useState([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [refreshingBalances, setRefreshingBalances] = useState(false);
  
  // Error states
  const [amountError, setAmountError] = useState('');
  const [networkError, setNetworkError] = useState('');
  
  // Formatted balances for display
  const formattedBalances = {
    l1: iotaBalance?.baseCoinsFormatted || '0 SMR',
    l2: evmBalance?.formatted || '0 ETH'
  };
  
  // API endpoint - would be from env in production
  const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001';
  
  // Load swap history on component mount
  useEffect(() => {
    fetchSwapHistory();
  }, [iotaAddress, evmAddress]);
  
  // Fetch swap history from API
  const fetchSwapHistory = async () => {
    if (!iotaAddress && !evmAddress) return;
    
    setIsLoadingHistory(true);
    try {
      const address = iotaAddress || evmAddress;
      const response = await axios.get(`${apiUrl}/api/bridge/messages/${address}`);
      
      if (response.data?.messages) {
        setSwapHistory(response.data.messages);
      }
    } catch (error) {
      console.error('Error fetching swap history:', error);
      showSnackbar('Failed to load swap history', 'error');
    } finally {
      setIsLoadingHistory(false);
    }
  };
  
  // Refresh balances
  const refreshBalances = async () => {
    setRefreshingBalances(true);
    try {
      // The actual balance refresh logic will be handled by the context providers
      // This is just to trigger a UI update
      await Promise.all([
        iotaBalance?.refresh?.(),
        evmBalance?.refresh?.()
      ]);
      
      showSnackbar('Balances refreshed', 'success');
    } catch (error) {
      console.error('Error refreshing balances:', error);
      showSnackbar('Failed to refresh balances', 'error');
    } finally {
      setRefreshingBalances(false);
    }
  };
  
  // Calculate maximum amount based on selected direction and balances
  const calculateMaxAmount = () => {
    if (direction === 'L1toL2') {
      const balance = iotaBalance?.formatted?.available || 0;
      return Math.max(0, balance - 1); // Reserve 1 SMR for fees
    } else {
      const balance = parseFloat(evmBalance?.formatted || 0);
      return Math.max(0, balance - 0.01); // Reserve 0.01 ETH for gas
    }
  };
  
  // Set maximum amount
  const handleSetMaxAmount = () => {
    const maxAmount = calculateMaxAmount();
    setAmount(maxAmount.toString());
    validateAmount(maxAmount.toString());
  };
  
  // Swap direction
  const handleSwapDirection = () => {
    setDirection(prevDirection => 
      prevDirection === 'L1toL2' ? 'L2toL1' : 'L1toL2'
    );
    setAmount('');
    setAmountError('');
    setEstimatedFee(null);
    setConfirmationTime(null);
  };
  
  // Validate amount input
  const validateAmount = (value) => {
    if (!value) {
      setAmountError('Amount is required');
      return false;
    }
    
    const numValue = parseFloat(value);
    if (isNaN(numValue) || numValue <= 0) {
      setAmountError('Amount must be greater than 0');
      return false;
    }
    
    const maxAmount = calculateMaxAmount();
    if (numValue > maxAmount) {
      setAmountError(`Amount exceeds available balance (max: ${maxAmount})`);
      return false;
    }
    
    setAmountError('');
    return true;
  };
  
  // Handle amount change
  const handleAmountChange = (e) => {
    const value = e.target.value;
    setAmount(value);
    validateAmount(value);
  };
  
  // Estimate fees and confirmation time
  const estimateFeesAndTime = async () => {
    if (!validateAmount(amount)) return;
    
    setLoading(true);
    try {
      // In production, this would call an API to get real estimates
      const response = await axios.post(`${apiUrl}/api/bridge/estimate`, {
        direction,
        amount,
        fromAddress: direction === 'L1toL2' ? iotaAddress : evmAddress,
        toAddress: direction === 'L1toL2' ? evmAddress : iotaAddress
      });
      
      if (response.data) {
        setEstimatedFee(response.data.estimatedFee);
        setConfirmationTime(response.data.estimatedTime);
      }
    } catch (error) {
      console.error('Error estimating fees:', error);
      showSnackbar('Failed to estimate fees', 'error');
      
      // Fallback to reasonable defaults
      setEstimatedFee(direction === 'L1toL2' ? 0.1 : 0.001);
      setConfirmationTime(direction === 'L1toL2' ? 60 : 120);
    } finally {
      setLoading(false);
    }
  };
  
  // Check connection status
  const checkConnectionStatus = () => {
    if (direction === 'L1toL2' && !isIotaConnected) {
      setNetworkError('Please connect your IOTA wallet to proceed');
      return false;
    }
    
    if (direction === 'L2toL1' && !isWeb3Connected) {
      setNetworkError('Please connect your EVM wallet to proceed');
      return false;
    }
    
    if (direction === 'L1toL2' && !isWeb3Connected) {
      setNetworkError('Both IOTA and EVM wallets must be connected');
      return false;
    }
    
    if (direction === 'L2toL1' && !isIotaConnected) {
      setNetworkError('Both IOTA and EVM wallets must be connected');
      return false;
    }
    
    setNetworkError('');
    return true;
  };
  
  // Handle next step
  const handleNext = async () => {
    // Check connection status
    if (!checkConnectionStatus()) {
      return;
    }
    
    // Validate amount on first step
    if (activeStep === 0 && !validateAmount(amount)) {
      return;
    }
    
    // Estimate fees on first step
    if (activeStep === 0 && !estimatedFee) {
      await estimateFeesAndTime();
    }
    
    // Handle confirmation step
    if (activeStep === 2) {
      await processSwap();
      return;
    }
    
    // Open confirmation modal on step 1
    if (activeStep === 1) {
      setOpenConfirmModal(true);
      return;
    }
    
    setActiveStep((prevStep) => prevStep + 1);
  };
  
  // Handle back step
  const handleBack = () => {
    setActiveStep((prevStep) => prevStep - 1);
  };
  
  // Process the swap
  const processSwap = async () => {
    setLoading(true);
    setTransactionStatus('pending');
    setActiveStep(3); // Move to processing step
    
    try {
      // Perform the actual swap
      if (direction === 'L1toL2') {
        // L1 to L2 swap
        const result = await axios.post(`${apiUrl}/api/bridge/initiate`, {
          direction: 'L1toL2',
          amount,
          fromAddress: iotaAddress,
          toAddress: evmAddress
        });
        
        // Record transaction info
        setTransactionHash(result.data.messageId);
        
        // Monitor transaction status
        await monitorSwapTransaction(result.data.messageId);
      } else {
        // L2 to L1 swap
        const result = await axios.post(`${apiUrl}/api/bridge/initiate`, {
          direction: 'L2toL1',
          amount,
          fromAddress: evmAddress,
          toAddress: iotaAddress
        });
        
        // Record transaction info
        setTransactionHash(result.data.messageId);
        
        // Monitor transaction status
        await monitorSwapTransaction(result.data.messageId);
      }
    } catch (error) {
      console.error('Error processing swap:', error);
      showSnackbar('Swap failed: ' + (error.response?.data?.message || error.message), 'error');
      setTransactionStatus('failed');
    } finally {
      setLoading(false);
    }
  };
  
  // Monitor swap transaction status
  const monitorSwapTransaction = async (messageId) => {
    // Poll the transaction status until confirmed or failed
    const maxAttempts = 30;
    let attempts = 0;
    
    const checkStatus = async () => {
      try {
        const response = await axios.get(`${apiUrl}/api/bridge/status/${messageId}`);
        
        const status = response.data.status;
        if (status === 'confirmed') {
          setTransactionStatus('confirmed');
          setActiveStep(4); // Complete step
          
          // Refresh balances and history after successful swap
          await refreshBalances();
          await fetchSwapHistory();
          
          return;
        } else if (status === 'failed') {
          setTransactionStatus('failed');
          showSnackbar('Swap failed', 'error');
          return;
        }
        
        // Continue polling if not finalized
        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(checkStatus, 5000); // Check every 5 seconds
        } else {
          // Timeout after max attempts, but don't mark as failed
          // since it might still complete
          showSnackbar('Transaction is taking longer than expected. Check history for updates.', 'warning');
        }
      } catch (error) {
        console.error('Error checking swap status:', error);
        
        // Continue polling despite errors
        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(checkStatus, 5000);
        } else {
          showSnackbar('Failed to check swap status', 'error');
        }
      }
    };
    
    // Start checking
    checkStatus();
  };
  
  // Handle modal confirmation
  const handleConfirmSwap = () => {
    setOpenConfirmModal(false);
    setActiveStep(2); // Move to confirm step
  };
  
  // Reset the swap form
  const handleReset = () => {
    setActiveStep(0);
    setAmount('');
    setAmountError('');
    setEstimatedFee(null);
    setConfirmationTime(null);
    setTransactionStatus(null);
    setTransactionHash(null);
  };
  
  // Format time display
  const formatTime = (seconds) => {
    if (!seconds) return '?';
    
    if (seconds < 60) {
      return `~${seconds} seconds`;
    } else if (seconds < 3600) {
      return `~${Math.ceil(seconds / 60)} minutes`;
    } else {
      return `~${Math.ceil(seconds / 3600)} hours`;
    }
  };
  
  // Get source and destination info based on current direction
  const getNetworkInfo = () => {
    return {
      source: direction === 'L1toL2' ? {
        network: L1_NETWORK,
        address: iotaAddress,
        balance: formattedBalances.l1,
        connected: isIotaConnected
      } : {
        network: L2_NETWORK,
        address: evmAddress,
        balance: formattedBalances.l2,
        connected: isWeb3Connected
      },
      destination: direction === 'L1toL2' ? {
        network: L2_NETWORK,
        address: evmAddress,
        balance: formattedBalances.l2,
        connected: isWeb3Connected
      } : {
        network: L1_NETWORK,
        address: iotaAddress,
        balance: formattedBalances.l1,
        connected: isIotaConnected
      }
    };
  };
  
  // Network info for current swap
  const { source, destination } = getNetworkInfo();
  
  // Determine if the next button should be disabled
  const isNextDisabled = () => {
    if (loading) return true;
    if (activeStep === 0) return !amount || !!amountError || !!networkError;
    return false;
  };
  
  // Render step content
  const getStepContent = (step) => {
    switch (step) {
      case 0: // Select Assets
        return (
          <Box sx={{ mt: 2 }}>
            {/* Network Selection */}
            <Card variant="outlined" sx={{ mb: 2, position: 'relative' }}>
              <CardContent sx={{ position: 'relative' }}>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                  <Typography variant="h6">From</Typography>
                  
                  {/* Connection Status */}
                  <Box display="flex" alignItems="center">
                    <Typography variant="body2" color={source.connected ? 'success.main' : 'error.main'}>
                      {source.connected ? 'Connected' : 'Not Connected'}
                    </Typography>
                    {source.connected ? 
                      <CheckCircleIcon fontSize="small" color="success" sx={{ ml: 0.5 }} /> : 
                      <ErrorIcon fontSize="small" color="error" sx={{ ml: 0.5 }} />
                    }
                  </Box>
                </Box>
                
                <Box sx={{ p: 2, backgroundColor: theme.palette.background.paper, borderRadius: 1 }}>
                  <Typography variant="subtitle1" color="text.secondary">
                    {source.network}
                  </Typography>
                  
                  <Box display="flex" justifyContent="space-between" alignItems="center" mt={1}>
                    <Box>
                      <Typography variant="body2" color="text.secondary">Address</Typography>
                      <Typography variant="body2" sx={{ 
                        overflow: 'hidden', 
                        textOverflow: 'ellipsis',
                        maxWidth: '200px'
                      }}>
                        {source.address || 'Not connected'}
                      </Typography>
                    </Box>
                    
                    <Box textAlign="right">
                      <Typography variant="body2" color="text.secondary">Balance</Typography>
                      <Typography variant="body2">
                        {source.balance}
                      </Typography>
                    </Box>
                  </Box>
                </Box>
              </CardContent>
            </Card>
            
            {/* Swap Direction Button */}
            <Box display="flex" justifyContent="center" my={1}>
              <IconButton 
                onClick={handleSwapDirection}
                color="primary"
                size="large"
                sx={{ 
                  border: `1px solid ${theme.palette.divider}`,
                  p: 1
                }}
              >
                <SwapHorizIcon />
              </IconButton>
            </Box>
            
            {/* Destination */}
            <Card variant="outlined" sx={{ mb: 3, position: 'relative' }}>
              <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                  <Typography variant="h6">To</Typography>
                  
                  {/* Connection Status */}
                  <Box display="flex" alignItems="center">
                    <Typography variant="body2" color={destination.connected ? 'success.main' : 'error.main'}>
                      {destination.connected ? 'Connected' : 'Not Connected'}
                    </Typography>
                    {destination.connected ? 
                      <CheckCircleIcon fontSize="small" color="success" sx={{ ml: 0.5 }} /> : 
                      <ErrorIcon fontSize="small" color="error" sx={{ ml: 0.5 }} />
                    }
                  </Box>
                </Box>
                
                <Box sx={{ p: 2, backgroundColor: theme.palette.background.paper, borderRadius: 1 }}>
                  <Typography variant="subtitle1" color="text.secondary">
                    {destination.network}
                  </Typography>
                  
                  <Box display="flex" justifyContent="space-between" alignItems="center" mt={1}>
                    <Box>
                      <Typography variant="body2" color="text.secondary">Address</Typography>
                      <Typography variant="body2" sx={{ 
                        overflow: 'hidden', 
                        textOverflow: 'ellipsis',
                        maxWidth: '200px'
                      }}>
                        {destination.address || 'Not connected'}
                      </Typography>
                    </Box>
                    
                    <Box textAlign="right">
                      <Typography variant="body2" color="text.secondary">Balance</Typography>
                      <Typography variant="body2">
                        {destination.balance}
                      </Typography>
                    </Box>
                  </Box>
                </Box>
              </CardContent>
            </Card>
            
            {/* Amount Input */}
            <TextField
              label="Amount"
              fullWidth
              type="number"
              value={amount}
              onChange={handleAmountChange}
              error={!!amountError}
              helperText={amountError}
              disabled={loading}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <Button 
                      size="small" 
                      onClick={handleSetMaxAmount}
                      disabled={loading}
                    >
                      MAX
                    </Button>
                  </InputAdornment>
                ),
              }}
              sx={{ mb: 3 }}
            />
            
            {/* Network Error */}
            {networkError && (
              <Alert severity="error" sx={{ mb: 3 }}>
                {networkError}
              </Alert>
            )}
          </Box>
        );
        
      case 1: // Preview Swap
        return (
          <Box sx={{ mt: 2 }}>
            <Typography variant="h6" gutterBottom>
              Swap Preview
            </Typography>
            
            {/* Swap Summary Card */}
            <Card variant="outlined" sx={{ mb: 3 }}>
              <CardContent>
                <Grid container spacing={2}>
                  <Grid item xs={5}>
                    <Typography variant="body2" color="text.secondary">From</Typography>
                    <Typography variant="body1" gutterBottom>{source.network}</Typography>
                    <Typography variant="h6">{amount} {direction === 'L1toL2' ? 'SMR' : 'ETH'}</Typography>
                  </Grid>
                  
                  <Grid item xs={2} display="flex" justifyContent="center" alignItems="center">
                    <ArrowDownwardIcon />
                  </Grid>
                  
                  <Grid item xs={5} textAlign="right">
                    <Typography variant="body2" color="text.secondary">To</Typography>
                    <Typography variant="body1" gutterBottom>{destination.network}</Typography>
                    <Typography variant="h6">{amount} {direction === 'L1toL2' ? 'ETH' : 'SMR'}</Typography>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
            
            {/* Fee and Time Estimates */}
            <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
              <Typography variant="subtitle2" gutterBottom>
                Transaction Details
              </Typography>
              
              <Grid container spacing={1}>
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">
                    Network Fee
                  </Typography>
                </Grid>
                <Grid item xs={6} textAlign="right">
                  <Typography variant="body2">
                    {estimatedFee ? `~${estimatedFee} ${direction === 'L1toL2' ? 'SMR' : 'ETH'}` : 'Calculating...'}
                  </Typography>
                </Grid>
                
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">
                    Expected Time
                  </Typography>
                </Grid>
                <Grid item xs={6} textAlign="right">
                  <Typography variant="body2">
                    {confirmationTime ? formatTime(confirmationTime) : 'Calculating...'}
                  </Typography>
                </Grid>
                
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">
                    You Will Receive
                  </Typography>
                </Grid>
                <Grid item xs={6} textAlign="right">
                  <Typography variant="body2" fontWeight="bold">
                    {amount} {direction === 'L1toL2' ? 'ETH' : 'SMR'}
                  </Typography>
                </Grid>
              </Grid>
            </Paper>
            
            {/* Additional Information */}
            <Alert severity="info" sx={{ mb: 2 }}>
              <Typography variant="body2">
                Cross-layer swaps are final and cannot be reversed. Please verify all details before confirming.
              </Typography>
            </Alert>
          </Box>
        );
        
      case 2: // Confirm
        return (
          <Box sx={{ mt: 2, textAlign: 'center' }}>
            <Typography variant="h6" gutterBottom>
              Ready to Process
            </Typography>
            
            <Typography variant="body1" paragraph>
              Please confirm to proceed with the swap:
            </Typography>
            
            <Box sx={{ p: 2, backgroundColor: theme.palette.background.paper, borderRadius: 1, mb: 3 }}>
              <Typography variant="subtitle1" gutterBottom>
                {`${amount} ${direction === 'L1toL2' ? 'SMR' : 'ETH'} → ${amount} ${direction === 'L1toL2' ? 'ETH' : 'SMR'}`}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {`From ${source.network} to ${destination.network}`}
              </Typography>
            </Box>
            
            <Alert severity="warning" sx={{ mb: 3 }}>
              <Typography variant="body2">
                By confirming this swap, you acknowledge that you understand the risks involved.
              </Typography>
            </Alert>
          </Box>
        );
        
      case 3: // Processing
        return (
          <Box sx={{ mt: 2, textAlign: 'center' }}>
            <TransactionProgress 
              status={transactionStatus}
              transactionHash={transactionHash}
              direction={direction}
              network={direction === 'L1toL2' ? 'iota' : 'evm'}
            />
          </Box>
        );
        
      case 4: // Complete
        return (
          <Box sx={{ mt: 2, textAlign: 'center' }}>
            <Typography variant="h6" gutterBottom>
              Swap Complete!
            </Typography>
            
            <CheckCircleIcon 
              color="success" 
              sx={{ fontSize: 60, my: 2 }} 
            />
            
            <Typography variant="body1" paragraph>
              {`Successfully swapped ${amount} ${direction === 'L1toL2' ? 'SMR' : 'ETH'} to ${amount} ${direction === 'L1toL2' ? 'ETH' : 'SMR'}`}
            </Typography>
            
            <Box sx={{ p: 2, backgroundColor: theme.palette.background.paper, borderRadius: 1, mb: 3 }}>
              <Typography variant="subtitle2" gutterBottom>
                Transaction ID
              </Typography>
              <Typography variant="body2" sx={{ wordBreak: 'break-all' }}>
                {transactionHash}
              </Typography>
            </Box>
            
            <Button 
              variant="outlined" 
              onClick={handleReset}
              sx={{ mt: 2 }}
            >
              Start New Swap
            </Button>
          </Box>
        );
        
      default:
        return 'Unknown step';
    }
  };
  
  return (
    <Box>
      <Typography variant="h5" component="h2" gutterBottom>
        Cross-Layer Swap
        <Tooltip title="Swap tokens between IOTA Layer 1 and IOTA Layer 2 (EVM)">
          <IconButton size="small" sx={{ ml: 1 }}>
            <HelpOutlineIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Typography>
      
      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          {/* Main swap card */}
          <Card>
            <CardContent>
              {/* Stepper */}
              <Stepper activeStep={activeStep} alternativeLabel>
                {SWAP_STEPS.map((label) => (
                  <Step key={label}>
                    <StepLabel>{label}</StepLabel>
                  </Step>
                ))}
              </Stepper>
              
              {/* Step content */}
              {getStepContent(activeStep)}
              
              {/* Navigation buttons */}
              <Box sx={{ display: 'flex', justifyContent: 'space-between', pt: 2 }}>
                <Button
                  disabled={activeStep === 0 || activeStep > 2}
                  onClick={handleBack}
                  variant="outlined"
                >
                  Back
                </Button>
                
                <Box>
                  {/* Refresh button for balances */}
                  {activeStep === 0 && (
                    <Button
                      onClick={refreshBalances}
                      startIcon={<RefreshIcon />}
                      disabled={refreshingBalances}
                      variant="outlined"
                      sx={{ mr: 1 }}
                    >
                      {refreshingBalances ? 'Refreshing...' : 'Refresh Balances'}
                    </Button>
                  )}
                  
                  <Button
                    variant="contained"
                    disabled={isNextDisabled()}
                    onClick={handleNext}
                    startIcon={loading ? <CircularProgress size={20} /> : null}
                  >
                    {activeStep === 2 ? 'Confirm Swap' :
                     activeStep === 4 ? 'Done' :
                     'Next'}
                  </Button>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} md={4}>
          {/* Recent Transactions */}
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Recent Swaps
                <IconButton size="small" onClick={fetchSwapHistory} disabled={isLoadingHistory}>
                  <RefreshIcon fontSize="small" />
                </IconButton>
              </Typography>
              
              {isLoadingHistory ? (
                <Box display="flex" justifyContent="center" my={2}>
                  <CircularProgress size={24} />
                </Box>
              ) : swapHistory.length === 0 ? (
                <Typography variant="body2" color="text.secondary" textAlign="center" py={2}>
                  No swap history found
                </Typography>
              ) : (
                <>
                  {swapHistory.slice(0, 5).map((item, index) => (
                    <Paper key={index} variant="outlined" sx={{ p: 1.5, mb: 1 }}>
                      <Grid container spacing={1}>
                        <Grid item xs={12}>
                          <Typography variant="subtitle2">
                            {item.direction === 0 ? 'L2 → L1' : 'L1 → L2'}
                            {' '}
                            <Typography variant="caption" color="text.secondary">
                              {new Date(item.timestamp).toLocaleString()}
                            </Typography>
                          </Typography>
                        </Grid>
                        
                        <Grid item xs={6}>
                          <Typography variant="body2" color="text.secondary">Status</Typography>
                          <Box display="flex" alignItems="center">
                            {item.status === 'Confirmed' ? (
                              <CheckCircleIcon fontSize="small" color="success" sx={{ mr: 0.5 }} />
                            ) : item.status === 'Failed' ? (
                              <ErrorIcon fontSize="small" color="error" sx={{ mr: 0.5 }} />
                            ) : (
                              <WarningIcon fontSize="small" color="warning" sx={{ mr: 0.5 }} />
                            )}
                            <Typography variant="body2">{item.status}</Typography>
                          </Box>
                        </Grid>
                        
                        <Grid item xs={6} textAlign="right">
                          <Typography variant="body2" color="text.secondary">ID</Typography>
                          <Typography variant="body2" sx={{ 
                            overflow: 'hidden', 
                            textOverflow: 'ellipsis',
                            maxWidth: '100%'
                          }}>
                            {item.messageId.substring(0, 10)}...
                          </Typography>
                        </Grid>
                      </Grid>
                    </Paper>
                  ))}
                  
                  {swapHistory.length > 5 && (
                    <Typography variant="body2" textAlign="center" mt={1}>
                      + {swapHistory.length - 5} more transactions
                    </Typography>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
      
      {/* Confirmation Modal */}
      <SwapConfirmationModal
        open={openConfirmModal}
        onClose={() => setOpenConfirmModal(false)}
        onConfirm={handleConfirmSwap}
        sourceNetwork={source.network}
        destinationNetwork={destination.network}
        amount={amount}
        fee={estimatedFee}
        direction={direction}
      />
    </Box>
  );
};

export default CrossLayerSwap;
