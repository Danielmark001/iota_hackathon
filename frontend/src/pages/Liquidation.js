import React from 'react';
import { Box, Typography, Paper, Grid } from '@mui/material';
import { useWeb3 } from '../context/Web3Context';
import ConnectionErrorFallback from '../components/ui/ConnectionErrorFallback';

const Liquidation = () => {
  const { connectionError, connectWallet } = useWeb3();

  if (connectionError) {
    return <ConnectionErrorFallback onRetry={connectWallet} />;
  }

  return (
    <Box>
      <Typography variant="h4" component="h1" fontWeight={700} gutterBottom>
        Liquidation Alerts
      </Typography>
      <Typography variant="body1" color="text.secondary" paragraph>
        Monitor potential liquidation risks and manage your collateral positions.
      </Typography>
      
      <Grid container spacing={3} sx={{ mt: 2 }}>
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Active Alerts
            </Typography>
            <Typography variant="body2">
              Your active liquidation alerts will be displayed here.
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Position Health
            </Typography>
            <Typography variant="body2">
              Your position health and liquidation thresholds will be displayed here.
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Market Conditions
            </Typography>
            <Typography variant="body2">
              Relevant market conditions affecting liquidation risk will be displayed here.
            </Typography>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Liquidation;
