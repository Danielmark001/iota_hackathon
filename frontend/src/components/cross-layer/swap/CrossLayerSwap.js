import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  TextField,
  MenuItem,
  Button,
  CircularProgress,
  Alert,
  Stepper,
  Step,
  StepLabel,
  Divider,
  IconButton,
  Tooltip,
  Link,
  Chip
} from '@mui/material';
import {
  SwapHoriz,
  ArrowDownward,
  AccountBalanceWallet,
  CheckCircleOutline,
  InfoOutlined,
  Refresh,
  ContentCopy,
  OpenInNew,
  Error,
  Warning
} from '@mui/icons-material';

// Contexts
import { useIoTA } from '../../../context/IoTAContext';
import { useWeb3 } from '../../../context/Web3Context';
import { useSnackbar } from '../../../context/SnackbarContext';

// Services
import apiService from '../../../services/apiService';

/**
 * CrossLayerSwap Component
 * 
 * Provides a user interface for transferring assets between IOTA L1 (Move) and L2 (EVM) layers.
 * Integrates with both IOTA wallet and EVM wallet for cross-layer transfers.
 */
const CrossLayerSwap = () => {
  // Context hooks
  const { 
    isConnected: isIotaConnected, 
    address: iotaAddress, 
    balance: iotaBalance,
    network,
    networkInfo,
    getTransactionExplorerUrl,
    sendTokens: sendIotaTransaction,
    initConnection: connectIotaWallet
  } = useIoTA();
  
  const { 
    isConnected: isEvmConnected, 
    currentAccount, 
    balance: evmBalance, 
    chainId,
    connectWallet: connectEvmWallet,
    sendTransaction: sendEvmTransaction
  } = useWeb3();
  
  const { showSnackbar } = useSnackbar();
  
  // State for swap form
  const [swapDirection, setSwapDirection] = useState('L1ToL2'); // L1ToL2 or L2ToL1
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [txHash, setTxHash] = useState('');
  const [estimatedGas, setEstimatedGas] = useState(0);
  const [estimatedTime, setEstimatedTime] = useState('2-5 minutes');
  const [error, setError] = useState('');
  const [transferStatus, setTransferStatus] = useState('idle'); // idle, pending, success, failed
  const [processingDetails, setProcessingDetails] = useState([]);
  
  // Steps for the swap process
  const steps = [
    'Initiate Transfer', 
    'Processing', 
    'Complete'
  ];
  
  // Fetch gas estimates when direction changes
  useEffect(() => {
    fetchGasEstimates();
  }, [swapDirection]);
  
  // Fetch estimated gas and confirmation time
  const fetchGasEstimates = async () => {
    try {
      setError('');
      
      // Make API call to get gas estimates
      const response = await apiService.getGasEstimates();
      setEstimatedGas(swapDirection === 'L1ToL2' ? response.l1ToL2Gas : response.l2ToL1Gas);
      setEstimatedTime(swapDirection === 'L1ToL2' ? '2-5 minutes' : '5-10 minutes');
    } catch (error) {
      console.error('Error fetching gas estimates:', error);
      setError('Could not fetch gas estimates. Using default values.');
      
      // Set default values
      setEstimatedGas(swapDirection === 'L1ToL2' ? 0.001 : 0.005);
      setEstimatedTime(swapDirection === 'L1ToL2' ? '2-5 minutes' : '5-10 minutes');
    }
  };
  
  // Check if wallets are connected for the selected direction
  const checkWalletConnections = () => {
    if (swapDirection === 'L1ToL2' && !isIotaConnected) {
      setError('IOTA wallet must be connected for Layer 1 to Layer 2 transfers');
      return false;
    }
    
    if (swapDirection === 'L2ToL1' && !isEvmConnected) {
      setError('EVM wallet must be connected for Layer 2 to Layer 1 transfers');
      return false;
    }
    
    setError('');
    return true;
  };
  
  // Handle swap direction change
  const handleDirectionChange = (event) => {
    setSwapDirection(event.target.value);
    setActiveStep(0);
    setTxHash('');
    setTransferStatus('idle');
    setError('');
    setAmount('');
    setProcessingDetails([]);
  };
  
  // Handle amount change
  const handleAmountChange = (event) => {
    // Only allow numbers with up to 6 decimal places
    const value = event.target.value;
    if (value === '' || /^\d+(\.\d{0,6})?$/.test(value)) {
      setAmount(value);
    }
  };
  
  // Handle max amount button
  const handleMaxAmount = () => {
    if (swapDirection === 'L1ToL2' && iotaBalance) {
      // Set max to 99% of balance to account for gas (for IOTA L1)
      const available = parseFloat(iotaBalance.baseCoins) / 1_000_000;
      const maxAmount = Math.max(0, available * 0.99).toFixed(6);
      setAmount(maxAmount);
    } else if (swapDirection === 'L2ToL1' && evmBalance) {
      // Set max to 99% of balance to account for gas (for EVM L2)
      const maxAmount = Math.max(0, evmBalance * 0.99).toFixed(6);
      setAmount(maxAmount);
    }
  };
  
  // Add processing detail for status updates
  const addProcessingDetail = (message, status = 'info') => {
    setProcessingDetails(prev => [
      { message, status, timestamp: new Date().toISOString() },
      ...prev
    ]);
  };
  
  // Handle swap button click
  const handleSwap = async () => {
    // Validate inputs
    if (!amount || parseFloat(amount) <= 0) {
      setError('Please enter a valid amount');
      return;
    }
    
    // Check wallet connections
    if (!checkWalletConnections()) {
      return;
    }
    
    // Check sufficient balance for L1 -> L2
    if (swapDirection === 'L1ToL2') {
      const available = parseFloat(iotaBalance.baseCoins) / 1_000_000;
      if (parseFloat(amount) > available) {
        setError(`Insufficient IOTA balance. Available: ${available.toFixed(6)} SMR`);
        return;
      }
    }
    
    // Check sufficient balance for L2 -> L1
    if (swapDirection === 'L2ToL1' && (parseFloat(amount) > evmBalance)) {
      setError(`Insufficient EVM balance. Available: ${evmBalance.toFixed(6)} SMR`);
      return;
    }
    
    setLoading(true);
    setError('');
    setActiveStep(1);
    setTransferStatus('pending');
    setProcessingDetails([]);
    
    try {
      let txResult;
      
      if (swapDirection === 'L1ToL2') {
        // L1 to L2 transfer
        addProcessingDetail('Initiating Layer 1 to Layer 2 transfer');
        
        // Call the bridge API to transfer from L1 to L2
        try {
          // Get the destination address (EVM wallet)
          const toAddress = currentAccount || '';
          if (!toAddress) {
            addProcessingDetail('No EVM wallet detected. Will use same user identifier on L2.', 'warning');
          } else {
            addProcessingDetail(`Target EVM address: ${toAddress}`);
          }
          
          txResult = await apiService.initiateL1ToL2Transfer({
            fromAddress: iotaAddress,
            toAddress: toAddress,
            amount: parseFloat(amount),
            timestamp: Date.now()
          });
          
          addProcessingDetail(`Bridge initialized with transfer ID: ${txResult.transferId}`);
          addProcessingDetail(`Bridge address: ${txResult.bridgeAddress}`);
        } catch (bridgeError) {
          console.error('Bridge initialization error:', bridgeError);
          addProcessingDetail(`Bridge initialization error: ${bridgeError.message}`, 'error');
          throw new Error(`Bridge error: ${bridgeError.message}`);
        }
        
        // Confirm with IOTA wallet
        if (isIotaConnected) {
          try {
            addProcessingDetail('Sending transaction from IOTA wallet...');
            
            const iotaTx = await sendIotaTransaction(
              txResult.bridgeAddress,
              parseFloat(amount),
              { tag: txResult.transferId }
            );
            
            setTxHash(iotaTx.blockId);
            addProcessingDetail(`Transaction sent! Block ID: ${iotaTx.blockId}`, 'success');
            
            // Generate explorer link
            const explorerUrl = getTransactionExplorerUrl(iotaTx.blockId);
            addProcessingDetail(`View on Explorer: ${explorerUrl}`);
            
            // Start polling for confirmation
            pollForConfirmation(txResult.transferId, 'L1ToL2');
          } catch (iotaError) {
            console.error('IOTA transaction error:', iotaError);
            addProcessingDetail(`IOTA transaction failed: ${iotaError.message}`, 'error');
            throw new Error(`IOTA transaction failed: ${iotaError.message}`);
          }
        } else {
          addProcessingDetail('IOTA wallet not connected. Cannot complete transaction.', 'error');
          throw new Error('IOTA wallet not connected');
        }
      } else {
        // L2 to L1 transfer
        addProcessingDetail('Initiating Layer 2 to Layer 1 transfer');
        
        // Call the bridge API to transfer from L2 to L1
        try {
          // Get the destination address (IOTA wallet)
          const toAddress = iotaAddress || '';
          if (!toAddress) {
            addProcessingDetail('No IOTA wallet detected. Will use same user identifier on L1.', 'warning');
          } else {
            addProcessingDetail(`Target IOTA address: ${toAddress}`);
          }
          
          txResult = await apiService.initiateL2ToL1Transfer({
            fromAddress: currentAccount,
            toAddress: toAddress,
            amount: parseFloat(amount),
            timestamp: Date.now()
          });
          
          addProcessingDetail(`Bridge initialized with transfer ID: ${txResult.transferId}`);
          addProcessingDetail(`Bridge address: ${txResult.bridgeAddress}`);
        } catch (bridgeError) {
          console.error('Bridge initialization error:', bridgeError);
          addProcessingDetail(`Bridge initialization error: ${bridgeError.message}`, 'error');
          throw new Error(`Bridge error: ${bridgeError.message}`);
        }
        
        // Confirm with EVM wallet
        if (isEvmConnected) {
          try {
            addProcessingDetail('Sending transaction from EVM wallet...');
            
            const evmTx = await sendEvmTransaction({
              to: txResult.bridgeAddress,
              value: parseFloat(amount),
              data: txResult.calldata || '0x'
            });
            
            setTxHash(evmTx.hash);
            addProcessingDetail(`Transaction sent! Hash: ${evmTx.hash}`, 'success');
            
            // Generate explorer link - use EVM explorer for L2
            const explorerUrl = getTransactionExplorerUrl(evmTx.hash, 'l2');
            addProcessingDetail(`View on Explorer: ${explorerUrl}`);
            
            // Start polling for confirmation
            pollForConfirmation(txResult.transferId, 'L2ToL1');
          } catch (evmError) {
            console.error('EVM transaction error:', evmError);
            addProcessingDetail(`EVM transaction failed: ${evmError.message}`, 'error');
            throw new Error(`EVM transaction failed: ${evmError.message}`);
          }
        } else {
          addProcessingDetail('EVM wallet not connected. Cannot complete transaction.', 'error');
          throw new Error('EVM wallet not connected');
        }
      }
      
      showSnackbar('Transfer initiated successfully', 'success');
    } catch (error) {
      console.error('Error initiating transfer:', error);
      setError(error.message || 'Error initiating transfer. Please try again.');
      setTransferStatus('failed');
      setActiveStep(0);
      addProcessingDetail(`Transfer failed: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };
  
  // Poll for transfer confirmation
  const pollForConfirmation = async (transferId, direction) => {
    let attempts = 0;
    const maxAttempts = 60; // 5 minutes (5s interval)
    const pollInterval = 5000; // 5 seconds
    
    const checkStatus = async () => {
      if (attempts >= maxAttempts) {
        addProcessingDetail('Transfer is taking longer than expected. Monitoring will continue in the background.', 'warning');
        showSnackbar('Transfer is taking longer than expected. You can check status in the transaction history.', 'warning');
        return;
      }
      
      try {
        addProcessingDetail(`Checking transfer status... (attempt ${attempts + 1})`);
        const status = await apiService.getTransferStatus(transferId);
        
        addProcessingDetail(`Current status: ${status.status}`);
        
        if (status.status === 'Confirmed' || status.status === 'Processed') {
          setTransferStatus('success');
          setActiveStep(2);
          addProcessingDetail(`Transfer completed successfully!`, 'success');
          showSnackbar('Transfer completed successfully!', 'success');
          return;
        } else if (status.status === 'Failed') {
          setTransferStatus('failed');
          setError('Transfer failed. Please check the transaction history for details.');
          addProcessingDetail('Transfer failed. Please try again or contact support.', 'error');
          showSnackbar('Transfer failed. Please check details.', 'error');
          return;
        }
        
        // If still pending, continue polling
        attempts++;
        setTimeout(checkStatus, pollInterval);
      } catch (error) {
        console.error('Error checking transfer status:', error);
        addProcessingDetail(`Error checking status: ${error.message}. Will retry.`, 'warning');
        // Continue polling despite error
        attempts++;
        setTimeout(checkStatus, pollInterval);
      }
    };
    
    // Start polling
    setTimeout(checkStatus, pollInterval);
  };
  
  // Reset the form
  const handleReset = () => {
    setAmount('');
    setActiveStep(0);
    setTxHash('');
    setTransferStatus('idle');
    setError('');
    setProcessingDetails([]);
  };
  
  // Format address for display
  const formatAddress = (address) => {
    if (!address) return '';
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  };
  
  // Copy to clipboard
  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(
      () => showSnackbar('Copied to clipboard!', 'success'),
      () => showSnackbar('Failed to copy', 'error')
    );
  };
  
  // Render the source and destination wallets section
  const renderWallets = () => {
    const sourceIsL1 = swapDirection === 'L1ToL2';
    const destIsL1 = swapDirection === 'L2ToL1';
    
    const sourceAddress = sourceIsL1 ? iotaAddress : currentAccount;
    const destAddress = destIsL1 ? iotaAddress : currentAccount;
    
    const sourceBalance = sourceIsL1 
      ? (iotaBalance ? parseFloat(iotaBalance.baseCoins) / 1_000_000 : 0) 
      : evmBalance;
    const sourceConnected = sourceIsL1 ? isIotaConnected : isEvmConnected;
    const destConnected = destIsL1 ? isIotaConnected : isEvmConnected;
    
    return (
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {/* Source Wallet */}
        <Grid item xs={12} md={5}>
          <Card variant="outlined" sx={{ 
            borderColor: sourceConnected ? 'primary.main' : 'divider',
            boxShadow: sourceConnected ? '0 0 0 1px rgba(25, 118, 210, 0.3)' : 'none',
            transition: 'all 0.2s'
          }}>
            <CardContent>
              <Typography variant="subtitle1" gutterBottom sx={{ 
                display: 'flex', 
                alignItems: 'center',
                color: sourceConnected ? 'primary.main' : 'text.secondary'
              }}>
                <AccountBalanceWallet sx={{ mr: 1, fontSize: 20 }} />
                Source ({sourceIsL1 ? 'Layer 1 - IOTA' : 'Layer 2 - EVM'})
                {sourceConnected && (
                  <Chip 
                    label="Connected" 
                    color="success" 
                    size="small" 
                    sx={{ ml: 'auto' }}
                  />
                )}
              </Typography>
              
              {sourceConnected ? (
                <>
                  <Box sx={{ display: 'flex', alignItems: 'center', mt: 2, mb: 1 }}>
                    <Typography variant="body2" sx={{ fontFamily: 'monospace', mr: 1 }}>
                      {formatAddress(sourceAddress)}
                    </Typography>
                    <IconButton size="small" onClick={() => copyToClipboard(sourceAddress)}>
                      <ContentCopy fontSize="small" />
                    </IconButton>
                  </Box>
                  
                  <Typography variant="body2" sx={{ mt: 1, display: 'flex', alignItems: 'center' }}>
                    <strong>Balance:</strong>
                    <Typography 
                      component="span" 
                      variant="body2" 
                      fontWeight="bold" 
                      ml={1}
                      color={sourceBalance < parseFloat(amount || 0) ? 'error.main' : 'inherit'}
                    >
                      {sourceBalance ? sourceBalance.toFixed(6) : '0'} {sourceIsL1 ? 'SMR' : 'SMR'}
                    </Typography>
                  </Typography>
                </>
              ) : (
                <Button 
                  variant="outlined" 
                  size="small"
                  sx={{ mt: 1 }}
                  onClick={sourceIsL1 ? connectIotaWallet : connectEvmWallet}
                >
                  Connect {sourceIsL1 ? 'IOTA' : 'EVM'} Wallet
                </Button>
              )}
            </CardContent>
          </Card>
        </Grid>
        
        {/* Arrow */}
        <Grid item xs={12} md={2} sx={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center',
          minHeight: { xs: '50px', md: 'auto' }
        }}>
          <Paper
            elevation={0}
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: { xs: 40, md: 50 },
              height: { xs: 40, md: 50 },
              borderRadius: '50%',
              bgcolor: 'background.subtle',
              border: '1px solid',
              borderColor: 'divider'
            }}
          >
            <ArrowDownward sx={{ display: { xs: 'block', md: 'none' } }} />
            <SwapHoriz sx={{ display: { xs: 'none', md: 'block' } }} />
          </Paper>
        </Grid>
        
        {/* Destination Wallet */}
        <Grid item xs={12} md={5}>
          <Card variant="outlined" sx={{ 
            borderColor: destConnected ? 'secondary.main' : 'divider',
            boxShadow: destConnected ? '0 0 0 1px rgba(156, 39, 176, 0.3)' : 'none',
            transition: 'all 0.2s'
          }}>
            <CardContent>
              <Typography variant="subtitle1" gutterBottom sx={{ 
                display: 'flex', 
                alignItems: 'center',
                color: destConnected ? 'secondary.main' : 'text.secondary'
              }}>
                <AccountBalanceWallet sx={{ mr: 1, fontSize: 20 }} />
                Destination ({destIsL1 ? 'Layer 1 - IOTA' : 'Layer 2 - EVM'})
                {destConnected && (
                  <Chip 
                    label="Connected" 
                    color="success" 
                    size="small" 
                    sx={{ ml: 'auto' }}
                  />
                )}
              </Typography>
              
              {destConnected ? (
                <Box sx={{ display: 'flex', alignItems: 'center', mt: 2 }}>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace', mr: 1 }}>
                    {formatAddress(destAddress)}
                  </Typography>
                  <IconButton size="small" onClick={() => copyToClipboard(destAddress)}>
                    <ContentCopy fontSize="small" />
                  </IconButton>
                </Box>
              ) : (
                <Button 
                  variant="outlined" 
                  size="small"
                  sx={{ mt: 1 }}
                  onClick={destIsL1 ? connectIotaWallet : connectEvmWallet}
                >
                  Connect {destIsL1 ? 'IOTA' : 'EVM'} Wallet
                </Button>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    );
  };
  
  // Get status icon based on status type
  const getStatusIcon = (status) => {
    switch (status) {
      case 'success':
        return <CheckCircleOutline fontSize="small" color="success" />;
      case 'error':
        return <Error fontSize="small" color="error" />;
      case 'warning':
        return <Warning fontSize="small" color="warning" />;
      default:
        return <InfoOutlined fontSize="small" color="info" />;
    }
  };
  
  return (
    <Box sx={{ width: '100%' }}>
      <Paper elevation={2} sx={{ p: 3, borderRadius: 2 }}>
        <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
          <SwapHoriz sx={{ mr: 1 }} color="primary" />
          Transfer Assets Between Layers
        </Typography>
        
        <Typography variant="body2" color="text.secondary" paragraph>
          Move your assets seamlessly between IOTA Layer 1 (Move) and Layer 2 (EVM).
        </Typography>
        
        {/* Layer Swap Direction Selector */}
        <Box sx={{ mb: 3 }}>
          <TextField
            select
            fullWidth
            label="Transfer Direction"
            value={swapDirection}
            onChange={handleDirectionChange}
            variant="outlined"
            disabled={activeStep > 0}
          >
            <MenuItem value="L1ToL2">Layer 1 (IOTA) to Layer 2 (EVM)</MenuItem>
            <MenuItem value="L2ToL1">Layer 2 (EVM) to Layer 1 (IOTA)</MenuItem>
          </TextField>
        </Box>
        
        {/* Wallet Information */}
        {renderWallets()}
        
        {/* Stepper */}
        <Stepper activeStep={activeStep} sx={{ mb: 3 }}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>
        
        {/* Step Content */}
        <Box sx={{ mb: 3 }}>
          {activeStep === 0 && (
            <>
              {/* Amount Input */}
              <Grid container spacing={2} alignItems="center">
                <Grid item xs={12} sm={8}>
                  <TextField
                    fullWidth
                    label="Amount"
                    value={amount}
                    onChange={handleAmountChange}
                    variant="outlined"
                    type="text"
                    placeholder="0.00"
                    InputProps={{
                      endAdornment: (
                        <Typography variant="body2" color="text.secondary">
                          SMR
                        </Typography>
                      ),
                    }}
                    disabled={loading}
                    error={
                      (swapDirection === 'L1ToL2' && 
                       iotaBalance && 
                       parseFloat(amount || 0) > parseFloat(iotaBalance.baseCoins) / 1_000_000) ||
                      (swapDirection === 'L2ToL1' && 
                       evmBalance && 
                       parseFloat(amount || 0) > evmBalance)
                    }
                    helperText={
                      (swapDirection === 'L1ToL2' && 
                       iotaBalance && 
                       parseFloat(amount || 0) > parseFloat(iotaBalance.baseCoins) / 1_000_000) ?
                        `Insufficient IOTA balance. Available: ${(parseFloat(iotaBalance.baseCoins) / 1_000_000).toFixed(6)} SMR` :
                      (swapDirection === 'L2ToL1' && 
                       evmBalance && 
                       parseFloat(amount || 0) > evmBalance) ?
                        `Insufficient EVM balance. Available: ${evmBalance.toFixed(6)} SMR` :
                        ''
                    }
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Button
                    fullWidth
                    variant="outlined"
                    onClick={handleMaxAmount}
                    disabled={loading || 
                      (!isIotaConnected && swapDirection === 'L1ToL2') || 
                      (!isEvmConnected && swapDirection === 'L2ToL1')}
                  >
                    Max
                  </Button>
                </Grid>
              </Grid>
              
              {/* Fee and Time Estimate */}
              <Box sx={{ mt: 2, mb: 3, p: 2, bgcolor: 'background.subtle', borderRadius: 1 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Transfer Details
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">
                      Estimated Gas Fee:
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2">
                      ~{estimatedGas} SMR
                    </Typography>
                  </Grid>
                  
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">
                      Estimated Time:
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2">
                      {estimatedTime}
                    </Typography>
                  </Grid>
                  
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">
                      Will Receive:
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" fontWeight="medium">
                      {amount ? (parseFloat(amount) - estimatedGas).toFixed(6) : '0.00'} SMR
                    </Typography>
                  </Grid>
                </Grid>
              </Box>
              
              {error && (
                <Alert severity="error" sx={{ mb: 3 }}>
                  {error}
                </Alert>
              )}
              
              {/* Action Buttons */}
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
                <Button
                  variant="contained"
                  color="primary"
                  disabled={
                    loading || 
                    !amount || 
                    parseFloat(amount) <= 0 ||
                    (swapDirection === 'L1ToL2' && 
                     iotaBalance && 
                     parseFloat(amount) > parseFloat(iotaBalance.baseCoins) / 1_000_000) ||
                    (swapDirection === 'L2ToL1' && 
                     evmBalance && 
                     parseFloat(amount) > evmBalance)
                  }
                  onClick={handleSwap}
                  startIcon={loading ? <CircularProgress size={20} /> : <SwapHoriz />}
                >
                  {loading ? 'Processing...' : 'Transfer'}
                </Button>
              </Box>
            </>
          )}
          
          {activeStep === 1 && (
            <Box sx={{ p: 2 }}>
              <Box sx={{ textAlign: 'center', p: 3 }}>
                <CircularProgress sx={{ mb: 2 }} />
                <Typography variant="h6" gutterBottom>
                  Processing Transfer
                </Typography>
                <Typography variant="body2" color="text.secondary" paragraph>
                  Your transfer is being processed. This may take {estimatedTime}.
                </Typography>
              </Box>
              
              {/* Processing details log */}
              <Box sx={{ mt: 3, maxHeight: '300px', overflowY: 'auto', bgcolor: 'background.default', borderRadius: 1, p: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Processing Log
                </Typography>
                {processingDetails.map((detail, index) => (
                  <Box 
                    key={index} 
                    sx={{ 
                      display: 'flex', 
                      alignItems: 'flex-start', 
                      mb: 1,
                      borderLeft: '2px solid',
                      borderLeftColor: detail.status === 'success' ? 'success.main' : 
                                       detail.status === 'error' ? 'error.main' :
                                       detail.status === 'warning' ? 'warning.main' : 
                                       'info.main',
                      pl: 1,
                      py: 0.5
                    }}
                  >
                    {getStatusIcon(detail.status)}
                    <Box sx={{ ml: 1 }}>
                      <Typography variant="body2">
                        {detail.message}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {new Date(detail.timestamp).toLocaleTimeString()}
                      </Typography>
                    </Box>
                  </Box>
                ))}
                {processingDetails.length === 0 && (
                  <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
                    No processing details yet
                  </Typography>
                )}
              </Box>
              
              {txHash && (
                <Box sx={{ mt: 2, p: 2, bgcolor: 'background.subtle', borderRadius: 1, textAlign: 'left' }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Transaction Hash
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Typography variant="body2" sx={{ fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {txHash}
                    </Typography>
                    <IconButton size="small" onClick={() => copyToClipboard(txHash)}>
                      <ContentCopy fontSize="small" />
                    </IconButton>
                    <IconButton 
                      size="small" 
                      component={Link} 
                      href={
                        swapDirection === 'L1ToL2' 
                          ? getTransactionExplorerUrl(txHash, 'l1')
                          : getTransactionExplorerUrl(txHash, 'l2')
                      }
                      target="_blank"
                    >
                      <OpenInNew fontSize="small" />
                    </IconButton>
                  </Box>
                </Box>
              )}
              
              {error && (
                <Alert severity="error" sx={{ mt: 3 }}>
                  {error}
                </Alert>
              )}
            </Box>
          )}
          
          {activeStep === 2 && (
            <Box sx={{ textAlign: 'center', p: 3 }}>
              <CheckCircleOutline color="success" sx={{ fontSize: 48, mb: 2 }} />
              <Typography variant="h6" gutterBottom>
                Transfer Complete
              </Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                Your assets have been successfully transferred between layers.
              </Typography>
              
              {txHash && (
                <Box sx={{ mt: 2, p: 2, bgcolor: 'background.subtle', borderRadius: 1, textAlign: 'left' }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Transaction Hash
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Typography variant="body2" sx={{ fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {txHash}
                    </Typography>
                    <IconButton size="small" onClick={() => copyToClipboard(txHash)}>
                      <ContentCopy fontSize="small" />
                    </IconButton>
                    <IconButton 
                      size="small" 
                      component={Link} 
                      href={
                        swapDirection === 'L1ToL2' 
                          ? getTransactionExplorerUrl(txHash, 'l1')
                          : getTransactionExplorerUrl(txHash, 'l2')
                      }
                      target="_blank"
                    >
                      <OpenInNew fontSize="small" />
                    </IconButton>
                  </Box>
                </Box>
              )}
              
              <Box sx={{ mt: 3 }}>
                <Button
                  variant="outlined"
                  startIcon={<Refresh />}
                  onClick={handleReset}
                >
                  New Transfer
                </Button>
              </Box>
            </Box>
          )}
        </Box>
        
        {/* Information Box */}
        <Alert severity="info" icon={<InfoOutlined />} sx={{ mt: 4 }}>
          <Typography variant="body2">
            <strong>About Cross-Layer Transfers</strong><br />
            Transfers between layers typically take {estimatedTime} to complete. Layer 1 to Layer 2 transfers are processed via the IOTA Tangle and then bridged to the EVM chain. Layer 2 to Layer 1 transfers are processed via the EVM chain and then bridged to the IOTA Tangle.
          </Typography>
        </Alert>
      </Paper>
    </Box>
  );
};

export default CrossLayerSwap;