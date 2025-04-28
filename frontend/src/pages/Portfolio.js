import React from 'react';
import { Box, Typography, Paper, Grid } from '@mui/material';
import { useWeb3 } from '../context/Web3Context';
import ConnectionErrorFallback from '../components/ui/ConnectionErrorFallback';

const Portfolio = () => {
  const { connectionError, connectWallet } = useWeb3();

  if (connectionError) {
    return <ConnectionErrorFallback onRetry={connectWallet} />;
  }

  return (
    <Box>
      <Typography variant="h4" component="h1" fontWeight={700} gutterBottom>
        Your Portfolio
      </Typography>
      <Typography variant="body1" color="text.secondary" paragraph>
        View and manage your deposited assets, borrowed assets, and overall position.
      </Typography>
      
      <Grid container spacing={3} sx={{ mt: 2 }}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Deposits
            </Typography>
            <Typography variant="body2">
              Your deposit information will be displayed here.
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Borrows
            </Typography>
            <Typography variant="body2">
              Your borrow information will be displayed here.
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Position Health
            </Typography>
            <Typography variant="body2">
              Your overall position health and metrics will be displayed here.
            </Typography>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Portfolio;
