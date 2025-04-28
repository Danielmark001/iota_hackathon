import React from 'react';
import { Box, Typography, Paper, Grid } from '@mui/material';
import { useWeb3 } from '../context/Web3Context';
import ConnectionErrorFallback from '../components/ui/ConnectionErrorFallback';

const CrossLayer = () => {
  const { connectionError, connectWallet } = useWeb3();

  if (connectionError) {
    return <ConnectionErrorFallback onRetry={connectWallet} />;
  }

  return (
    <Box>
      <Typography variant="h4" component="h1" fontWeight={700} gutterBottom>
        Cross-Layer Bridge
      </Typography>
      <Typography variant="body1" color="text.secondary" paragraph>
        Transfer assets between IOTA Layer 1 and IOTA EVM Layer 2.
      </Typography>
      
      <Grid container spacing={3} sx={{ mt: 2 }}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              L1 to L2 Transfer
            </Typography>
            <Typography variant="body2">
              Transfer assets from IOTA Layer 1 to IOTA EVM Layer 2.
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              L2 to L1 Transfer
            </Typography>
            <Typography variant="body2">
              Transfer assets from IOTA EVM Layer 2 to IOTA Layer 1.
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Bridge Transactions
            </Typography>
            <Typography variant="body2">
              View and manage your bridge transactions.
            </Typography>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default CrossLayer;
