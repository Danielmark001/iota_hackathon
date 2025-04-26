import React from 'react';
import {
  Container,
  Typography,
  Box,
  Grid,
  Alert,
  AlertTitle
} from '@mui/material';
import { StarRate } from '@mui/icons-material';

// Components
import StakingInterface from '../components/staking/StakingInterface';

// Contexts
import { useIoTA } from '../context/IoTAContext';

/**
 * StakingPage Component
 * 
 * This page displays the IOTA Staking Interface for users to stake IOTA tokens
 * directly from the platform to earn additional yield.
 */
const StakingPage = () => {
  const { isConnected: isIotaConnected } = useIoTA();
  
  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      {/* Page header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <StarRate fontSize="large" color="warning" />
          IOTA Staking
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Stake your IOTA tokens to earn additional yield while maintaining liquidity for lending and borrowing
        </Typography>
      </Box>
      
      {/* Warning for non-connected wallet */}
      {!isIotaConnected && (
        <Alert severity="info" sx={{ mb: 4 }}>
          <AlertTitle>IOTA Wallet Required</AlertTitle>
          <Typography variant="body2">
            You need to connect an IOTA wallet to use the staking features. Connect your wallet to start earning rewards.
          </Typography>
        </Alert>
      )}
      
      {/* Main content */}
      <StakingInterface />
      
    </Container>
  );
};

export default StakingPage;