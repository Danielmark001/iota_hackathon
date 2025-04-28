import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  Skeleton, 
  Divider, 
  Chip, 
  IconButton, 
  Tooltip, 
  Paper,
  useTheme,
  alpha,
  Button,
  Grid
} from '@mui/material';
import { 
  CallMade as CallMadeIcon,
  CallReceived as CallReceivedIcon,
  ContentCopy as CopyIcon,
  OpenInNew as ExternalLinkIcon,
  History as HistoryIcon,
  MoreHoriz as MoreIcon,
  ArrowForward as ArrowForwardIcon,
  FilterList as FilterIcon,
  Search as SearchIcon
} from '@mui/icons-material';
import { useIoTA } from '../../context/IoTAContext';
import { useSnackbar } from '../../context/SnackbarContext';
import { Link as RouterLink } from 'react-router-dom';

const TransactionHistory = ({ address, limit = 5 }) => {
  const theme = useTheme();
  const { getTransactionHistory, getTransactionExplorerUrl } = useIoTA();
  const { showSnackbar } = useSnackbar();
  
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const walletAddress = address;
  
  // Load transaction history
  useEffect(() => {
    if (!walletAddress) {
      setLoading(false);
      return;
    }
    
    const fetchTransactions = async () => {
      try {
        setLoading(true);
        const history = await getTransactionHistory();
        setTransactions(history);
        setError(null);
      } catch (err) {
        console.error('Error fetching transaction history:', err);
        setError('Failed to load transaction history');
        
        // Mock data for development/testing
        setTransactions([
          {
            blockId: 'block1',
            transactionId: 'tx1',
            amount: '100',
            recipient: '0x123...456',
            timestamp: Date.now() - 3600000,
            status: 'confirmed',
            direction: 'outgoing'
          },
          {
            blockId: 'block2',
            transactionId: 'tx2',
            amount: '50',
            recipient: walletAddress,
            timestamp: Date.now() - 86400000,
            status: 'confirmed',
            direction: 'incoming'
          },
          {
            blockId: 'block3',
            transactionId: 'tx3',
            amount: '200',
            recipient: '0x789...012',
            timestamp: Date.now() - 172800000,
            status: 'confirmed',
            direction: 'outgoing'
          },
          {
            blockId: 'block4',
            transactionId: 'tx4',
            amount: '75',
            recipient: walletAddress,
            timestamp: Date.now() - 259200000,
            status: 'confirmed',
            direction: 'incoming'
          },
          {
            blockId: 'block5',
            transactionId: 'tx5',
            amount: '150',
            recipient: '0x345...678',
            timestamp: Date.now() - 345600000,
            status: 'confirmed',
            direction: 'outgoing'
          },
        ]);
      } finally {
        setLoading(false);
      }
    };
    
    fetchTransactions();
  }, [walletAddress, getTransactionHistory]);
  
  // Copy transaction ID
  const handleCopyTxId = (txId) => {
    navigator.clipboard.writeText(txId)
      .then(() => showSnackbar('Transaction ID copied to clipboard', 'success'))
      .catch(() => showSnackbar('Failed to copy transaction ID', 'error'));
  };
  
  // Open transaction in explorer
  const handleOpenInExplorer = (txId) => {
    const url = getTransactionExplorerUrl(txId);
    window.open(url, '_blank');
  };
  
  // Format timestamp to relative time
  const formatTimeAgo = (timestamp) => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    
    const date = new Date(timestamp);
    return date.toLocaleDateString();
  };
  
  // Show placeholder if there's no address
  if (!walletAddress) {
    return (
      <Box sx={{ textAlign: 'center', p: 3 }}>
        <HistoryIcon sx={{ fontSize: 40, color: 'text.secondary', opacity: 0.6, mb: 1 }} />
        <Typography variant="subtitle1" gutterBottom>
          No Wallet Connected
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Connect your wallet to view transaction history
        </Typography>
      </Box>
    );
  }
  
  // Show loading skeleton
  if (loading) {
    return (
      <Box>
        {[...Array(3)].map((_, index) => (
          <Box key={index} sx={{ mb: 2 }}>
            <Grid container spacing={2} alignItems="center">
              <Grid item>
                <Skeleton variant="circular" width={40} height={40} />
              </Grid>
              <Grid item xs>
                <Skeleton width="60%" height={24} />
                <Skeleton width="40%" height={20} />
              </Grid>
              <Grid item>
                <Skeleton width={80} height={40} />
              </Grid>
            </Grid>
            {index < 2 && <Divider sx={{ my: 2 }} />}
          </Box>
        ))}
      </Box>
    );
  }
  
  // Show error message
  if (error) {
    return (
      <Box sx={{ textAlign: 'center', p: 3, color: 'text.secondary' }}>
        <Typography variant="body2" gutterBottom color="error">
          {error}
        </Typography>
        <Typography variant="body2">
          Showing sample data for demonstration purposes.
        </Typography>
      </Box>
    );
  }
  
  // Show empty state
  if (transactions.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', p: 3 }}>
        <Box 
          sx={{ 
            width: 70, 
            height: 70, 
            borderRadius: '50%', 
            bgcolor: theme.palette.mode === 'dark' ? alpha(theme.palette.primary.main, 0.1) : alpha(theme.palette.primary.light, 0.1),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            mx: 'auto',
            mb: 2
          }}
        >
          <HistoryIcon color="primary" sx={{ fontSize: 30 }} />
        </Box>
        <Typography variant="subtitle1" gutterBottom>
          No Transactions Yet
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Your transaction history will appear here
        </Typography>
        <Button
          variant="outlined"
          color="primary"
          component={RouterLink}
          to="/deposit"
          sx={{ borderRadius: 2 }}
        >
          Make Your First Transaction
        </Button>
      </Box>
    );
  }
  
  // Show transactions
  return (
    <Box>
      {/* Optional Filter Controls */}
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        mb: 2, 
        px: 2, 
        pb: 2,
        borderBottom: `1px solid ${theme.palette.divider}`
      }}>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Chip 
            label="All" 
            color="primary" 
            size="small" 
            sx={{ 
              fontWeight: 'medium',
              px: 1
            }} 
          />
          <Chip 
            label="Sent" 
            size="small" 
            variant="outlined" 
            sx={{ 
              color: theme.palette.text.secondary,
              fontWeight: 'medium',
              px: 1
            }} 
          />
          <Chip 
            label="Received" 
            size="small" 
            variant="outlined" 
            sx={{ 
              color: theme.palette.text.secondary,
              fontWeight: 'medium',
              px: 1
            }} 
          />
        </Box>
        <IconButton size="small" sx={{ color: theme.palette.text.secondary }}>
          <FilterIcon fontSize="small" />
        </IconButton>
      </Box>
      
      {/* Transaction List */}
      <Box sx={{ px: 2 }}>
        {transactions.slice(0, limit).map((tx, index) => (
          <React.Fragment key={tx.transactionId || index}>
            <Box sx={{ my: 2 }}>
              <Grid container spacing={2} alignItems="center">
                <Grid item>
                  <Box 
                    sx={{ 
                      width: 40, 
                      height: 40, 
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      bgcolor: tx.direction === 'outgoing' 
                        ? (theme.palette.mode === 'dark' ? alpha(theme.palette.error.dark, 0.2) : alpha(theme.palette.error.light, 0.2))
                        : (theme.palette.mode === 'dark' ? alpha(theme.palette.success.dark, 0.2) : alpha(theme.palette.success.light, 0.2))
                    }}
                  >
                    {tx.direction === 'outgoing' 
                      ? <CallMadeIcon sx={{ color: theme.palette.error.main, fontSize: 20 }} />
                      : <CallReceivedIcon sx={{ color: theme.palette.success.main, fontSize: 20 }} />}
                  </Box>
                </Grid>
                <Grid item xs>
                  <Typography variant="subtitle2" fontWeight="medium">
                    {tx.direction === 'outgoing' ? 'Sent' : 'Received'} SMR
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {formatTimeAgo(tx.timestamp)} • {tx.status.charAt(0).toUpperCase() + tx.status.slice(1)}
                  </Typography>
                </Grid>
                <Grid item>
                  <Typography 
                    variant="subtitle2" 
                    fontWeight="bold"
                    color={tx.direction === 'outgoing' ? 'error.main' : 'success.main'}
                  >
                    {tx.direction === 'outgoing' ? '-' : '+'}{tx.amount} SMR
                  </Typography>
                </Grid>
                <Grid item>
                  <Box sx={{ display: 'flex' }}>
                    <Tooltip title="Copy Transaction ID">
                      <IconButton 
                        size="small" 
                        onClick={() => handleCopyTxId(tx.transactionId)}
                        sx={{ 
                          color: theme.palette.text.secondary,
                          '&:hover': { color: theme.palette.primary.main }
                        }}
                      >
                        <CopyIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="View in Explorer">
                      <IconButton 
                        size="small" 
                        onClick={() => handleOpenInExplorer(tx.transactionId)}
                        sx={{ 
                          color: theme.palette.text.secondary,
                          '&:hover': { color: theme.palette.primary.main }
                        }}
                      >
                        <ExternalLinkIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </Grid>
              </Grid>
            </Box>
            {index < Math.min(transactions.length, limit) - 1 && (
              <Divider />
            )}
          </React.Fragment>
        ))}
      </Box>
      
      {/* View All Link */}
      {transactions.length > limit && (
        <Box sx={{ textAlign: 'center', mt: 2, p: 2, borderTop: `1px solid ${theme.palette.divider}` }}>
          <Button
            component={RouterLink}
            to="/transactions"
            endIcon={<ArrowForwardIcon />}
            sx={{ textTransform: 'none' }}
          >
            View all transactions
          </Button>
        </Box>
      )}
    </Box>
  );
};

export default TransactionHistory;