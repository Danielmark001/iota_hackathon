import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  Card, 
  CardContent, 
  CircularProgress,
  Divider,
  List,
  ListItem,
  ListItemText,
  Chip,
  IconButton,
  Tooltip,
  Paper
} from '@mui/material';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import RefreshIcon from '@mui/icons-material/Refresh';
import { useIoTA } from '../../context/IoTAContext';
import { useSnackbar } from '../../context/SnackbarContext';
import apiService from '../../services/apiService';

// Mock transaction data for development
const MOCK_TRANSACTIONS = [
  {
    blockId: '0x1a2b3c4d5e6f',
    messageType: 'RISK_SCORE_UPDATE',
    data: {
      address: '0x71C7656EC7ab88b098defB751B7401B5f6d8976F',
      score: 45,
      timestamp: Date.now() - 86400000 * 2 // 2 days ago
    }
  },
  {
    blockId: '0x2b3c4d5e6f7a',
    messageType: 'IDENTITY_VERIFICATION',
    data: {
      address: '0x71C7656EC7ab88b098defB751B7401B5f6d8976F',
      verified: true,
      timestamp: Date.now() - 86400000 * 5 // 5 days ago
    }
  },
  {
    blockId: '0x3c4d5e6f7a8b',
    messageType: 'COLLATERAL_CHANGE',
    data: {
      address: '0x71C7656EC7ab88b098defB751B7401B5f6d8976F',
      oldValue: 150,
      newValue: 200,
      timestamp: Date.now() - 86400000 * 10 // 10 days ago
    }
  }
];

const IoTATransactions = ({ address }) => {
  const { isConnected, networkInfo } = useIoTA();
  const { showSnackbar } = useSnackbar();
  
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // Fetch transactions
  const fetchTransactions = async () => {
    try {
      setLoading(true);
      
      // In a real implementation, we would fetch from the backend
      // For development, we'll use mock data
      setTimeout(() => {
        setTransactions(MOCK_TRANSACTIONS);
        setLoading(false);
      }, 1000);
      
      // Real implementation would be something like:
      // const response = await apiService.getIotaTransactions(address);
      // setTransactions(response.transactions);
    } catch (error) {
      console.error('Error fetching IOTA transactions:', error);
      showSnackbar('Failed to fetch transactions', 'error');
      setLoading(false);
    }
  };
  
  // Load transactions on component mount
  useEffect(() => {
    if (isConnected && address) {
      fetchTransactions();
    }
  }, [isConnected, address]);
  
  // Format timestamp
  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleString();
  };
  
  // Get color for message type
  const getMessageTypeColor = (type) => {
    switch (type) {
      case 'RISK_SCORE_UPDATE':
        return 'primary';
      case 'IDENTITY_VERIFICATION':
        return 'success';
      case 'COLLATERAL_CHANGE':
        return 'secondary';
      default:
        return 'default';
    }
  };
  
  // Open transaction in explorer
  const openInExplorer = (blockId) => {
    window.open(`${networkInfo.explorer}/block/${blockId}`, '_blank');
  };
  
  return (
    <Card variant="outlined">
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6" component="div">
            IOTA Transactions
          </Typography>
          <IconButton onClick={fetchTransactions} disabled={loading || !isConnected}>
            <RefreshIcon />
          </IconButton>
        </Box>
        
        <Divider sx={{ mb: 2 }} />
        
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', my: 3 }}>
            <CircularProgress size={30} />
          </Box>
        ) : (
          <>
            {transactions.length > 0 ? (
              <List sx={{ width: '100%', bgcolor: 'background.paper' }}>
                {transactions.map((tx, index) => (
                  <Paper key={index} variant="outlined" sx={{ mb: 2, p: 0 }}>
                    <ListItem
                      secondaryAction={
                        <Tooltip title="View in Explorer">
                          <IconButton edge="end" onClick={() => openInExplorer(tx.blockId)}>
                            <OpenInNewIcon />
                          </IconButton>
                        </Tooltip>
                      }
                    >
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="body1" component="span">
                              Block ID: {tx.blockId.slice(0, 10)}...
                            </Typography>
                            <Chip
                              label={tx.messageType}
                              size="small"
                              color={getMessageTypeColor(tx.messageType)}
                            />
                          </Box>
                        }
                        secondary={
                          <Box sx={{ mt: 1 }}>
                            <Typography variant="body2" component="span" sx={{ display: 'block' }}>
                              {formatTimestamp(tx.data.timestamp)}
                            </Typography>
                            <Typography 
                              variant="body2" 
                              sx={{ 
                                color: 'text.secondary',
                                fontFamily: 'monospace',
                                fontSize: '0.7rem',
                                mt: 0.5
                              }}
                            >
                              {tx.messageType === 'RISK_SCORE_UPDATE' && `Risk Score: ${tx.data.score}`}
                              {tx.messageType === 'IDENTITY_VERIFICATION' && `Verification: ${tx.data.verified ? 'Approved' : 'Rejected'}`}
                              {tx.messageType === 'COLLATERAL_CHANGE' && `Collateral: ${tx.data.oldValue} → ${tx.data.newValue}`}
                            </Typography>
                          </Box>
                        }
                      />
                    </ListItem>
                  </Paper>
                ))}
              </List>
            ) : (
              <Box sx={{ textAlign: 'center', my: 3 }}>
                <Typography variant="body2" color="text.secondary">
                  No transactions found for this address.
                </Typography>
              </Box>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default IoTATransactions;
