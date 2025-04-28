import React from 'react';
import { Box, Typography, Paper, Grid } from '@mui/material';
import { useWeb3 } from '../context/Web3Context';
import ConnectionErrorFallback from '../components/ui/ConnectionErrorFallback';

const Transactions = () => {
  const { connectionError, connectWallet } = useWeb3();

  if (connectionError) {
    return <ConnectionErrorFallback onRetry={connectWallet} />;
  }

  return (
    <Box>
      <Typography variant="h4" component="h1" fontWeight={700} gutterBottom>
        Transaction History
      </Typography>
      <Typography variant="body1" color="text.secondary" paragraph>
        View and manage your transaction history across all platform activities.
      </Typography>
      
      <Grid container spacing={3} sx={{ mt: 2 }}>
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Recent Transactions
            </Typography>
            <Typography variant="body2">
              Your recent transactions will be displayed here.
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Platform Transactions
            </Typography>
            <Typography variant="body2">
              Your platform transactions (deposits, borrows, etc.) will be displayed here.
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Bridge Transactions
            </Typography>
            <Typography variant="body2">
              Your bridge transactions will be displayed here.
            </Typography>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Transactions;
