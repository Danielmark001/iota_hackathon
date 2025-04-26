import React from 'react';
import {
  Container,
  Typography,
  Box,
  Alert,
  AlertTitle
} from '@mui/material';
import { HistoryToggleOff } from '@mui/icons-material';

// Components
import EnhancedTransactionHistory from '../components/transactions/EnhancedTransactionHistory';

// Contexts
import { useIoTA } from '../context/IoTAContext';
import { useWeb3 } from '../context/Web3Context';

/**
 * TransactionHistoryPage Component
 * 
 * This page displays the Enhanced Transaction History with comprehensive
 * filtering, visualization, and analytics across both IOTA layers.
 */
const TransactionHistoryPage = () => {
  const { isConnected: isIotaConnected } = useIoTA();
  const { isConnected: isEvmConnected } = useWeb3();
  
  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      {/* Page header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <HistoryToggleOff fontSize="large" color="primary" />
          Transaction History
        </Typography>
        <Typography variant="body1" color="text.secondary">
          View, filter, and analyze your transactions across both IOTA L1 and L2 layers
        </Typography>
      </Box>
      
      {/* Warning for non-connected wallets */}
      {!isIotaConnected && !isEvmConnected && (
        <Alert severity="info" sx={{ mb: 4 }}>
          <AlertTitle>No Wallets Connected</AlertTitle>
          <Typography variant="body2">
            Connect at least one wallet (IOTA or EVM) to view your transaction history.
          </Typography>
        </Alert>
      )}
      
      {/* Main content */}
      <EnhancedTransactionHistory />
    </Container>
  );
};

export default TransactionHistoryPage;