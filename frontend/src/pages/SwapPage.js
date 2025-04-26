import React from 'react';
import {
  Container,
  Typography,
  Box,
  Paper,
  Divider,
  Grid,
  Alert,
  Link
} from '@mui/material';
import { SwapHoriz, Info } from '@mui/icons-material';

// Components
import CrossLayerSwap from '../components/cross-layer/swap/CrossLayerSwap';
import CrossLayerDashboard from '../components/cross-layer/CrossLayerDashboard';

// Contexts
import { useIoTA } from '../context/IoTAContext';
import { useWeb3 } from '../context/Web3Context';

/**
 * SwapPage Component
 * 
 * This page provides the Cross-Layer Swap interface for transferring assets
 * between IOTA L1 (Move) and L2 (EVM) layers, along with recent transaction history.
 */
const SwapPage = () => {
  const { isConnected: isIotaConnected } = useIoTA();
  const { isConnected: isEvmConnected } = useWeb3();
  
  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      {/* Page header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <SwapHoriz fontSize="large" color="primary" />
          Cross-Layer Swap
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Transfer assets seamlessly between IOTA Layer 1 (Move) and Layer 2 (EVM) networks
        </Typography>
      </Box>
      
      {/* Wallet Connection Alert */}
      {!isIotaConnected && !isEvmConnected && (
        <Alert severity="info" sx={{ mb: 3 }}>
          <Typography variant="body1">
            Connect at least one wallet (IOTA or EVM) to use the cross-layer swap functionality.
          </Typography>
        </Alert>
      )}
      
      {/* Main content */}
      <Grid container spacing={4}>
        {/* Swap Interface */}
        <Grid item xs={12} lg={6}>
          <CrossLayerSwap />
          
          {/* Additional Information */}
          <Paper elevation={2} sx={{ p: 3, borderRadius: 2, mt: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <Info color="info" sx={{ mr: 1 }} />
              <Typography variant="h6">
                About Cross-Layer Swaps
              </Typography>
            </Box>
            
            <Typography variant="body2" paragraph>
              Cross-layer swaps allow you to move your assets between IOTA's Layer 1 (Tangle/Move) and Layer 2 (EVM) networks.
              This gives you the flexibility to leverage different features on each layer.
            </Typography>
            
            <Typography variant="subtitle2" gutterBottom>Why use different layers?</Typography>
            <Box component="ul" sx={{ pl: 2 }}>
              <Box component="li">
                <Typography variant="body2">
                  <strong>Layer 1 (IOTA/Move):</strong> Feeless transactions, high security, and native IOTA features.
                </Typography>
              </Box>
              <Box component="li">
                <Typography variant="body2">
                  <strong>Layer 2 (EVM):</strong> Smart contract functionality, DApp ecosystem, and compatibility with Ethereum tools.
                </Typography>
              </Box>
            </Box>
            
            <Divider sx={{ my: 2 }} />
            
            <Typography variant="subtitle2" gutterBottom>How it works:</Typography>
            <Box component="ol" sx={{ pl: 2 }}>
              <Box component="li">
                <Typography variant="body2">
                  Assets are locked on the source layer.
                </Typography>
              </Box>
              <Box component="li">
                <Typography variant="body2">
                  The bridge contract verifies the transaction.
                </Typography>
              </Box>
              <Box component="li">
                <Typography variant="body2">
                  Equivalent assets are minted or released on the destination layer.
                </Typography>
              </Box>
            </Box>
            
            <Typography variant="body2" sx={{ mt: 2 }}>
              For more information on IOTA's cross-layer architecture, visit the{' '}
              <Link href="https://wiki.iota.org" target="_blank" rel="noopener">
                IOTA Wiki
              </Link>.
            </Typography>
          </Paper>
        </Grid>
        
        {/* Recent Transactions */}
        <Grid item xs={12} lg={6}>
          <Paper elevation={2} sx={{ p: 3, borderRadius: 2 }}>
            <Typography variant="h6" gutterBottom>
              Recent Cross-Layer Transactions
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              View your recent transactions between IOTA L1 and L2 layers.
            </Typography>
            
            <CrossLayerDashboard />
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
};

export default SwapPage;