import React from 'react';
import {
  Container,
  Typography,
  Box,
  Paper,
  Grid,
  Alert,
  AlertTitle,
  Link
} from '@mui/material';
import { WarningAmber } from '@mui/icons-material';

// Components
import LiquidationMonitor from '../components/liquidation/LiquidationMonitor';

// Contexts
import { useIoTA } from '../context/IoTAContext';
import { useWeb3 } from '../context/Web3Context';

/**
 * LiquidationAlertsPage Component
 * 
 * This page displays the Liquidation Monitor and provides information
 * about automated liquidation monitoring and alerts.
 */
const LiquidationAlertsPage = () => {
  const { isConnected: isIotaConnected } = useIoTA();
  const { isConnected: isEvmConnected } = useWeb3();
  
  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      {/* Page header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <WarningAmber fontSize="large" color="warning" />
          Liquidation Monitoring
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Monitor positions at risk of liquidation and receive real-time alerts via IOTA Streams
        </Typography>
      </Box>
      
      {/* Main content */}
      <Grid container spacing={4}>
        {/* Liquidation Monitor */}
        <Grid item xs={12} lg={8}>
          <LiquidationMonitor />
        </Grid>
        
        {/* Information sidebar */}
        <Grid item xs={12} lg={4}>
          <Paper elevation={2} sx={{ p: 3, borderRadius: 2 }}>
            <Typography variant="h6" gutterBottom>
              About Liquidation Monitoring
            </Typography>
            
            <Typography variant="body2" paragraph>
              The Liquidation Monitor helps you track your positions that may be at risk of liquidation,
              providing real-time alerts through secure IOTA Streams channels.
            </Typography>
            
            <Alert severity="info" sx={{ mb: 3 }}>
              <AlertTitle>IOTA Streams Integration</AlertTitle>
              Connect your IOTA wallet to receive secure, encrypted alerts through IOTA Streams technology.
            </Alert>
            
            <Typography variant="subtitle2" gutterBottom>
              How it works:
            </Typography>
            
            <Box component="ol" sx={{ pl: 2 }}>
              <Box component="li">
                <Typography variant="body2" paragraph>
                  <strong>Real-time monitoring:</strong> Your positions are continuously checked against current market prices.
                </Typography>
              </Box>
              <Box component="li">
                <Typography variant="body2" paragraph>
                  <strong>Risk assessment:</strong> Health factors below your threshold generate alerts.
                </Typography>
              </Box>
              <Box component="li">
                <Typography variant="body2" paragraph>
                  <strong>Secure notifications:</strong> Alerts are sent through encrypted IOTA Streams channels.
                </Typography>
              </Box>
              <Box component="li">
                <Typography variant="body2" paragraph>
                  <strong>Cross-layer visibility:</strong> Monitor positions on both IOTA L1 and L2.
                </Typography>
              </Box>
            </Box>
            
            <Typography variant="subtitle2" sx={{ mt: 2 }} gutterBottom>
              Recommended Actions:
            </Typography>
            
            <Box component="ul" sx={{ pl: 2 }}>
              <Box component="li">
                <Typography variant="body2">
                  Add more collateral to increase your health factor
                </Typography>
              </Box>
              <Box component="li">
                <Typography variant="body2">
                  Repay part of your loan to reduce your risk
                </Typography>
              </Box>
              <Box component="li">
                <Typography variant="body2">
                  Set up alerts at conservative thresholds for early warnings
                </Typography>
              </Box>
            </Box>
            
            <Box sx={{ mt: 3, p: 2, bgcolor: 'background.subtle', borderRadius: 1 }}>
              <Typography variant="subtitle2" gutterBottom>
                What is a Health Factor?
              </Typography>
              <Typography variant="body2">
                The health factor represents the safety of your position against liquidation. 
                A value of 1.0 or below triggers liquidation. The higher the value, the safer your position.
              </Typography>
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
};

export default LiquidationAlertsPage;