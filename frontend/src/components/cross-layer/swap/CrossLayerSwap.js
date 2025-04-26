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
  Link
} from '@mui/material';
import {
  SwapHoriz,
  ArrowDownward,
  AccountBalanceWallet,
  CheckCircleOutline,
  InfoOutlined,
  Refresh,
  ContentCopy,
  OpenInNew
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
    sendTransaction: sendIotaTransaction,
    connectWallet: connectIotaWallet
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
      const response = await apiService.getGasEstimates();
      setEstimatedGas(swapDirection === 'L1ToL2' ? response.l1ToL2Gas : response.l2ToL1Gas);
      setEstimatedTime(swapDirection === 'L1ToL2' ? '2-5 minutes' : '5-10 minutes');
    } catch (error) {
      console.error('Error fetching gas estimates:', error);
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
      const maxAmount = Math.max(0, iotaBalance.available * 0.99).toFixed(6);
      setAmount(maxAmount);
    } else if (swapDirection === 'L2ToL1' && evmBalance) {
      // Set max to 99% of balance to account for gas (for EVM L2)
      const maxAmount = Math.max(0, evmBalance * 0.99).toFixed(6);
      setAmount(maxAmount);
    }
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
    
    // Check sufficient balance
    if (swapDirection === 'L1ToL2' && (parseFloat(amount) > iotaBalance?.available)) {
      setError('Insufficient IOTA balance');
      return;
    }
    
    if (swapDirection === 'L2ToL1' && (parseFloat(amount) > evmBalance)) {
      setError('Insufficient EVM balance');
      return;
    }
    
    setLoading(true);
    setError('');
    setActiveStep(1);
    setTransferStatus('pending');
    
    try {
      let txResult;
      
      if (swapDirection === 'L1ToL2') {
        // Call the bridge API to transfer from L1 to L2
        txResult = await apiService.initiateL1ToL2Transfer({
          fromAddress: iotaAddress,
          toAddress: currentAccount || '', // If EVM wallet not connected, transfer to same user on L2
          amount: parseFloat(amount),
          timestamp: Date.now()
        });
        
        // Confirm with IOTA wallet
        if (isIotaConnected) {
          const iotaTx = await sendIotaTransaction({
            recipient: txResult.bridgeAddress,
            amount: parseFloat(amount),
            reference: txResult.transferId
          });
          
          setTxHash(iotaTx.blockId);
          
          // Start polling for confirmation
          pollForConfirmation(txResult.transferId, 'L1ToL2');
        }
      } else {
        // Call the bridge API to transfer from L2 to L1
        txResult = await apiService.initiateL2ToL1Transfer({
          fromAddress: currentAccount,
          toAddress: iotaAddress || '', // If IOTA wallet not connected, transfer to same user on L1
          amount: parseFloat(amount),
          timestamp: Date.now()
        });
        
        // Confirm with EVM wallet
        if (isEvmConnected) {
          const evmTx = await sendEvmTransaction({
            to: txResult.bridgeAddress,
            value: parseFloat(amount),
            data: txResult.calldata
          });
          
          setTxHash(evmTx.hash);
          
          // Start polling for confirmation
          pollForConfirmation(txResult.transferId, 'L2ToL1');
        }
      }
      
      showSnackbar('Transfer initiated successfully', 'success');
    } catch (error) {
      console.error('Error initiating transfer:', error);
      setError(error.message || 'Error initiating transfer. Please try again.');
      setTransferStatus('failed');
      setActiveStep(0);
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
        showSnackbar('Transfer is taking longer than expected. You can check status in the transaction history.', 'warning');
        return;
      }
      
      try {
        const status = await apiService.getTransferStatus(transferId);
        
        if (status.status === 'Confirmed' || status.status === 'Processed') {
          setTransferStatus('success');
          setActiveStep(2);
          showSnackbar('Transfer completed successfully!', 'success');
          return;
        } else if (status.status === 'Failed') {
          setTransferStatus('failed');
          setError('Transfer failed. Please check the transaction history for details.');
          return;
        }
        
        // If still pending, continue polling
        attempts++;
        setTimeout(checkStatus, pollInterval);
      } catch (error) {
        console.error('Error checking transfer status:', error);
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
    
    const sourceBalance = sourceIsL1 ? iotaBalance?.available : evmBalance;
    const sourceConnected = sourceIsL1 ? isIotaConnected : isEvmConnected;
    const destConnected = destIsL1 ? isIotaConnected : isEvmConnected;
    
    return (
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {/* Source Wallet */}
        <Grid item xs={12} md={5}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="subtitle1" gutterBottom>
                Source ({sourceIsL1 ? 'Layer 1 - IOTA' : 'Layer 2 - EVM'})
              </Typography>
              
              {sourceConnected ? (
                <>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <AccountBalanceWallet sx={{ mr: 1 }} color="primary" />
                    <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                      {formatAddress(sourceAddress)}
                    </Typography>
                    <IconButton size="small" onClick={() => copyToClipboard(sourceAddress)}>
                      <ContentCopy fontSize="small" />
                    </IconButton>
                  </Box>
                  
                  <Typography variant="body2">
                    Balance: {sourceBalance ? parseFloat(sourceBalance).toFixed(6) : '0'} {sourceIsL1 ? 'SMR' : 'SMR'}
                  </Typography>
                </>
              ) : (
                <Button 
                  variant="outlined" 
                  size="small"
                  onClick={sourceIsL1 ? connectIotaWallet : connectEvmWallet}
                >
                  Connect {sourceIsL1 ? 'IOTA' : 'EVM'} Wallet
                </Button>
              )}
            </CardContent>
          </Card>
        </Grid>
        
        {/* Arrow */}
        <Grid item xs={12} md={2} sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <ArrowDownward sx={{ display: { xs: 'block', md: 'none' } }} />
          <SwapHoriz sx={{ display: { xs: 'none', md: 'block' } }} />
        </Grid>
        
        {/* Destination Wallet */}
        <Grid item xs={12} md={5}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="subtitle1" gutterBottom>
                Destination ({destIsL1 ? 'Layer 1 - IOTA' : 'Layer 2 - EVM'})
              </Typography>
              
              {destConnected ? (
                <>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <AccountBalanceWallet sx={{ mr: 1 }} color="secondary" />
                    <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                      {formatAddress(destAddress)}
                    </Typography>
                    <IconButton size="small" onClick={() => copyToClipboard(destAddress)}>
                      <ContentCopy fontSize="small" />
                    </IconButton>
                  </Box>
                </>
              ) : (
                <Button 
                  variant="outlined" 
                  size="small"
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
  
  return (
    <Box sx={{ width: '100%' }}>
      <Paper elevation={2} sx={{ p: 3, borderRadius: 2 }}>
        <Typography variant="h6" gutterBottom>
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
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Button
                    fullWidth
                    variant="outlined"
                    onClick={handleMaxAmount}
                    disabled={loading || (!isIotaConnected && swapDirection === 'L1ToL2') || (!isEvmConnected && swapDirection === 'L2ToL1')}
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
                  disabled={loading || !amount || parseFloat(amount) <= 0}
                  onClick={handleSwap}
                  startIcon={loading ? <CircularProgress size={20} /> : <SwapHoriz />}
                >
                  {loading ? 'Processing...' : 'Transfer'}
                </Button>
              </Box>
            </>
          )}
          
          {activeStep === 1 && (
            <Box sx={{ textAlign: 'center', p: 3 }}>
              <CircularProgress sx={{ mb: 2 }} />
              <Typography variant="h6" gutterBottom>
                Processing Transfer
              </Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                Your transfer is being processed. This may take {estimatedTime}.
              </Typography>
              
              {txHash && (
                <Box sx={{ mt: 2, p: 2, bgcolor: 'background.subtle', borderRadius: 1, textAlign: 'left' }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Transaction Hash
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Typography variant="body2" sx={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>
                      {txHash}
                    </Typography>
                    <IconButton size="small" onClick={() => copyToClipboard(txHash)}>
                      <ContentCopy fontSize="small" />
                    </IconButton>
                    <IconButton 
                      size="small" 
                      component={Link} 
                      href={swapDirection === 'L1ToL2' 
                        ? `https://explorer.shimmer.network/testnet/block/${txHash}` 
                        : `https://explorer.shimmer.network/testnet/evm/tx/${txHash}`} 
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
                    <Typography variant="body2" sx={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>
                      {txHash}
                    </Typography>
                    <IconButton size="small" onClick={() => copyToClipboard(txHash)}>
                      <ContentCopy fontSize="small" />
                    </IconButton>
                    <IconButton 
                      size="small" 
                      component={Link} 
                      href={swapDirection === 'L1ToL2' 
                        ? `https://explorer.shimmer.network/testnet/block/${txHash}` 
                        : `https://explorer.shimmer.network/testnet/evm/tx/${txHash}`} 
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