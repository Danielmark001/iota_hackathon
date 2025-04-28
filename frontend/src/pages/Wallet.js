import React from 'react';
import { Box, Typography, Paper, Grid } from '@mui/material';
import { useWeb3 } from '../context/Web3Context';
import ConnectionErrorFallback from '../components/ui/ConnectionErrorFallback';

const Wallet = () => {
  const { connectionError, connectWallet } = useWeb3();

  if (connectionError) {
    return <ConnectionErrorFallback onRetry={connectWallet} />;
  }

  return (
    <Box>
      <Typography variant="h4" component="h1" fontWeight={700} gutterBottom>
        IOTA Wallet
      </Typography>
      <Typography variant="body1" color="text.secondary" paragraph>
        Manage your IOTA wallet, view balances, and perform transactions.
      </Typography>
      
      <Grid container spacing={3} sx={{ mt: 2 }}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Wallet Balance
            </Typography>
            <Typography variant="body2">
              Your wallet balance information will be displayed here.
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Transaction History
            </Typography>
            <Typography variant="body2">
              Your transaction history will be displayed here.
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Send / Receive
            </Typography>
            <Typography variant="body2">
              Send and receive functionality will be implemented here.
            </Typography>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Wallet;
