import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  Button, 
  Card, 
  CardContent, 
  TextField,
  CircularProgress,
  Divider,
  Grid,
  Chip,
  Link,
  Stack,
  Paper
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import SendIcon from '@mui/icons-material/Send';
import RefreshIcon from '@mui/icons-material/Refresh';
import { useIoTA } from '../../context/IoTAContext';
import { useSnackbar } from '../../context/SnackbarContext';

const IoTAWallet = () => {
  const { 
    isConnected, 
    isConnecting, 
    network, 
    networkInfo,
    address, 
    balance, 
    generateAddress, 
    getBalance, 
    sendTokens,
    getExplorerUrl,
    submitData
  } = useIoTA();
  
  const { showSnackbar } = useSnackbar();
  
  // Local state for send tokens form
  const [recipientAddress, setRecipientAddress] = useState('');
  const [sendAmount, setSendAmount] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Handle form submission
  const handleSendTokens = async (e) => {
    e.preventDefault();
    
    if (!recipientAddress || !sendAmount) {
      showSnackbar('Please provide recipient address and amount', 'error');
      return;
    }
    
    try {
      setIsSending(true);
      
      // Send tokens
      const result = await sendTokens(recipientAddress, sendAmount);
      
      if (result) {
        showSnackbar(`Successfully sent ${sendAmount} SMR to ${recipientAddress.slice(0, 10)}...`, 'success');
        // Reset form
        setRecipientAddress('');
        setSendAmount('');
      } else {
        showSnackbar('Transaction failed', 'error');
      }
    } catch (error) {
      console.error('Error sending tokens:', error);
      showSnackbar(`Error: ${error.message || 'Failed to send tokens'}`, 'error');
    } finally {
      setIsSending(false);
    }
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
      setIsRefreshing(true);
      await getBalance();
      setIsRefreshing(false);
    }
  };
  
  // Generate new address if none exists
  const handleGenerateAddress = async () => {
    try {
      await generateAddress();
    } catch (error) {
      console.error('Error generating address:', error);
      showSnackbar(`Error: ${error.message || 'Failed to generate address'}`, 'error');
    }
  };
  
  // Open explorer
  const handleOpenExplorer = () => {
    if (address) {
      const url = getExplorerUrl();
      window.open(url, '_blank');
    }
  };
  
  // Format balance for display
  const formatBalance = (balanceValue) => {
    if (!balanceValue) return '0 SMR';
    return balanceValue;
  };
  
  return (
    <Card variant="outlined" sx={{ mb: 3 }}>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6" component="div">
            IOTA Wallet
          </Typography>
          <Chip 
            label={isConnected ? `Connected to ${networkInfo.name}` : 'Disconnected'} 
            color={isConnected ? 'success' : 'error'} 
            variant="outlined" 
            size="small"
          />
        </Box>
        
        <Divider sx={{ mb: 2 }} />
        
        {isConnecting ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', my: 3 }}>
            <CircularProgress size={40} />
          </Box>
        ) : (
          <>
            {!address ? (
              <Box sx={{ textAlign: 'center', my: 2 }}>
                <Typography variant="body2" sx={{ mb: 2 }}>
                  No IOTA address found. Generate a new one to start using IOTA features.
                </Typography>
                <Button 
                  variant="contained" 
                  onClick={handleGenerateAddress}
                  disabled={!isConnected}
                >
                  Generate Address
                </Button>
              </Box>
            ) : (
              <>
                <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Your IOTA Address
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <Typography 
                      variant="body2" 
                      sx={{ 
                        fontFamily: 'monospace', 
                        overflowWrap: 'break-word',
                        flex: 1
                      }}
                    >
                      {address}
                    </Typography>
                    <Stack direction="row" spacing={1}>
                      <Button 
                        size="small" 
                        startIcon={<ContentCopyIcon />} 
                        onClick={handleCopyAddress}
                      >
                        Copy
                      </Button>
                      <Button 
                        size="small" 
                        startIcon={<OpenInNewIcon />} 
                        onClick={handleOpenExplorer}
                      >
                        Explorer
                      </Button>
                    </Stack>
                  </Box>
                </Paper>
                
                <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Typography variant="subtitle2" color="text.secondary">
                      Balance
                    </Typography>
                    <Button 
                      size="small" 
                      startIcon={<RefreshIcon />} 
                      onClick={handleRefreshBalance}
                      disabled={isRefreshing}
                    >
                      {isRefreshing ? 'Refreshing...' : 'Refresh'}
                    </Button>
                  </Box>
                  <Typography variant="h5" component="div" gutterBottom>
                    {formatBalance(balance.baseCoinsFormatted)}
                  </Typography>
                  
                  {balance.nativeTokens && balance.nativeTokens.length > 0 && (
                    <Box sx={{ mt: 2 }}>
                      <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                        Native Tokens
                      </Typography>
                      {balance.nativeTokens.map((token, index) => (
                        <Box key={index} sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                          <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                            {token.id.slice(0, 10)}...
                          </Typography>
                          <Typography variant="body2">
                            {token.amount}
                          </Typography>
                        </Box>
                      ))}
                    </Box>
                  )}
                </Paper>
                
                <Divider sx={{ my: 2 }} />
                
                <Typography variant="subtitle1" gutterBottom>
                  Send Tokens
                </Typography>
                
                <Box component="form" onSubmit={handleSendTokens} noValidate sx={{ mt: 1 }}>
                  <TextField
                    margin="normal"
                    required
                    fullWidth
                    id="recipient"
                    label="Recipient Address"
                    name="recipient"
                    value={recipientAddress}
                    onChange={(e) => setRecipientAddress(e.target.value)}
                    variant="outlined"
                    size="small"
                    disabled={isSending}
                  />
                  <TextField
                    margin="normal"
                    required
                    fullWidth
                    name="amount"
                    label="Amount (SMR)"
                    type="number"
                    id="amount"
                    value={sendAmount}
                    onChange={(e) => setSendAmount(e.target.value)}
                    variant="outlined"
                    size="small"
                    disabled={isSending}
                    inputProps={{ min: 0, step: "0.000001" }}
                  />
                  <Button
                    type="submit"
                    fullWidth
                    variant="contained"
                    sx={{ mt: 2 }}
                    disabled={isSending || !recipientAddress || !sendAmount || !isConnected}
                    startIcon={<SendIcon />}
                  >
                    {isSending ? 'Sending...' : 'Send Tokens'}
                  </Button>
                </Box>
              </>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default IoTAWallet;
