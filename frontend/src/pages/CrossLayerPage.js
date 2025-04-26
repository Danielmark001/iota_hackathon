import React from 'react';
import {
  Container,
  Typography,
  Box,
  Paper,
  Divider,
  Alert
} from '@mui/material';

// Components
import CrossLayerDashboard from '../components/cross-layer/CrossLayerDashboard';

// Contexts
import { useIoTA } from '../context/IoTAContext';
import { useWeb3 } from '../context/Web3Context';

/**
 * CrossLayerPage Component
 * 
 * This page displays the Cross-Layer Dashboard for monitoring transactions,
 * bridge messages, and liquidation events across both IOTA L1 and L2 layers.
 */
const CrossLayerPage = () => {
  const { isConnected: isIotaConnected } = useIoTA();
  const { isConnected: isEvmConnected } = useWeb3();
  
  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      {/* Page header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Cross-Layer Dashboard
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Monitor transactions, bridge messages, and liquidation events across both IOTA L1 (Move) and L2 (EVM) layers.
        </Typography>
      </Box>
      
      {/* Main content */}
      <Paper elevation={2} sx={{ p: 3, borderRadius: 2 }}>
        {!isIotaConnected && !isEvmConnected ? (
          <Alert severity="info" sx={{ mb: 3 }}>
            <Typography variant="body1">
              Connect at least one wallet (IOTA or EVM) to view cross-layer data.
            </Typography>
          </Alert>
        ) : null}
        
        <CrossLayerDashboard />
      </Paper>
    </Container>
  );
};

export default CrossLayerPage;
