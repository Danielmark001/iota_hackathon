import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  Alert,
  AlertTitle,
  Chip,
  Button,
  Switch,
  FormControlLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Divider,
  TextField,
  MenuItem,
  CircularProgress,
  Slider,
  Tooltip,
  useTheme
} from '@mui/material';
import {
  Notifications,
  NotificationsActive,
  NotificationsOff,
  Warning,
  Info,
  WarningAmber,
  Settings,
  Close,
  DeleteOutline,
  AddCircleOutline,
  Edit,
  Save,
  FilterList,
  Refresh
} from '@mui/icons-material';

// Contexts
import { useIoTA } from '../../context/IoTAContext';
import { useWeb3 } from '../../context/Web3Context';
import { useSnackbar } from '../../context/SnackbarContext';

// Services
import apiService from '../../services/apiService';
import iotaService from '../../services/iotaService';

/**
 * LiquidationMonitor Component
 * 
 * A real-time monitor for liquidation risks with IOTA Streams integration
 * for secure notifications and alerts when positions approach liquidation.
 */
const LiquidationMonitor = () => {
  const theme = useTheme();
  const { isConnected: isIotaConnected, address: iotaAddress } = useIoTA();
  const { currentAccount, isConnected: isEvmConnected } = useWeb3();
  const { showSnackbar } = useSnackbar();
  
  // State for liquidation monitoring
  const [loading, setLoading] = useState(false);
  const [positions, setPositions] = useState([]);
  const [riskThreshold, setRiskThreshold] = useState(1.5);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [streamChannel, setStreamChannel] = useState(null);
  const [alertHistory, setAlertHistory] = useState([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(60); // seconds
  const [intervalId, setIntervalId] = useState(null);
  const [addAlertOpen, setAddAlertOpen] = useState(false);
  const [newAlert, setNewAlert] = useState({
    positionId: '',
    threshold: 1.2,
    notificationType: 'all'
  });
  
  // Load positions and alert settings on component mount
  useEffect(() => {
    if (isEvmConnected && currentAccount) {
      loadPositions();
      loadAlertSettings();
      
      // Initialize Streams channel if IOTA is connected
      if (isIotaConnected && iotaAddress) {
        initializeStreamsChannel();
      }
    }
    
    return () => {
      // Clean up interval on unmount
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [isEvmConnected, currentAccount, isIotaConnected, iotaAddress]);
  
  // Set up automatic refresh
  useEffect(() => {
    if (intervalId) {
      clearInterval(intervalId);
    }
    
    if (refreshInterval > 0 && isEvmConnected) {
      const id = setInterval(() => {
        loadPositions(false); // Silent refresh (no loading indicator)
      }, refreshInterval * 1000);
      setIntervalId(id);
    }
    
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [refreshInterval, isEvmConnected]);
  
  // Load user's positions
  const loadPositions = async (showLoading = true) => {
    if (showLoading) {
      setLoading(true);
    }
    
    try {
      // Fetch positions from API
      const response = await apiService.getUserPositions(currentAccount);
      setPositions(response.positions || []);
      
      // Check for high-risk positions
      const highRiskPositions = response.positions.filter(pos => pos.healthFactor < riskThreshold);
      
      if (highRiskPositions.length > 0 && notificationsEnabled) {
        // Send alerts for high-risk positions
        highRiskPositions.forEach(position => {
          sendLiquidationAlert(position);
        });
      }
    } catch (error) {
      console.error('Error loading positions:', error);
      if (showLoading) {
        showSnackbar('Failed to load positions', 'error');
      }
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  };
  
  // Load alert settings from localStorage
  const loadAlertSettings = () => {
    try {
      const settings = localStorage.getItem(`liquidation_settings_${currentAccount}`);
      if (settings) {
        const parsedSettings = JSON.parse(settings);
        setRiskThreshold(parsedSettings.riskThreshold || 1.5);
        setNotificationsEnabled(parsedSettings.notificationsEnabled || false);
        setRefreshInterval(parsedSettings.refreshInterval || 60);
      }
      
      const history = localStorage.getItem(`liquidation_alerts_${currentAccount}`);
      if (history) {
        setAlertHistory(JSON.parse(history));
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };
  
  // Save alert settings to localStorage
  const saveAlertSettings = () => {
    try {
      const settings = {
        riskThreshold,
        notificationsEnabled,
        refreshInterval
      };
      
      localStorage.setItem(`liquidation_settings_${currentAccount}`, JSON.stringify(settings));
      showSnackbar('Settings saved successfully', 'success');
    } catch (error) {
      console.error('Error saving settings:', error);
      showSnackbar('Failed to save settings', 'error');
    }
  };
  
  // Initialize IOTA Streams channel for secure notifications
  const initializeStreamsChannel = async () => {
    try {
      // Check if we already have a channel stored
      const storedChannel = localStorage.getItem(`streams_channel_${currentAccount}`);
      
      if (storedChannel) {
        setStreamChannel(JSON.parse(storedChannel));
        return;
      }
      
      // Create a new channel
      const channel = await iotaService.createChannel({
        name: `LiquidationAlerts_${currentAccount.substring(0, 8)}`,
        description: 'Secure channel for liquidation alerts'
      });
      
      setStreamChannel(channel);
      localStorage.setItem(`streams_channel_${currentAccount}`, JSON.stringify(channel));
      
      showSnackbar('Secure notification channel created', 'success');
    } catch (error) {
      console.error('Error initializing Streams channel:', error);
      showSnackbar('Failed to create secure notification channel', 'error');
    }
  };
  
  // Send a liquidation alert through IOTA Streams
  const sendLiquidationAlert = async (position) => {
    // Add to local alert history first
    const newAlert = {
      id: `alert_${Date.now()}`,
      positionId: position.id,
      collateralSymbol: position.collateralSymbol,
      debtSymbol: position.debtSymbol,
      healthFactor: position.healthFactor,
      liquidationPrice: position.liquidationPrice,
      currentPrice: position.currentPrice,
      timestamp: Date.now(),
      read: false
    };
    
    const updatedHistory = [newAlert, ...alertHistory];
    setAlertHistory(updatedHistory);
    localStorage.setItem(`liquidation_alerts_${currentAccount}`, JSON.stringify(updatedHistory));
    
    // Display notification
    showSnackbar(`⚠️ Position at risk: ${position.collateralSymbol} collateral health factor ${position.healthFactor.toFixed(2)}`, 'warning');
    
    // Send through IOTA Streams if connected
    if (streamChannel && isIotaConnected) {
      try {
        await iotaService.sendMessage({
          channelId: streamChannel.channelId,
          messageType: 'LIQUIDATION_ALERT',
          content: {
            ...newAlert,
            userAddress: currentAccount
          }
        });
        
        console.log('Alert sent through IOTA Streams');
      } catch (error) {
        console.error('Error sending alert through Streams:', error);
      }
    }
  };
  
  // Handle notification toggle
  const handleNotificationsToggle = (event) => {
    const enabled = event.target.checked;
    setNotificationsEnabled(enabled);
    
    if (enabled && !streamChannel && isIotaConnected) {
      initializeStreamsChannel();
    }
  };
  
  // Handle risk threshold change
  const handleRiskThresholdChange = (event, newValue) => {
    setRiskThreshold(newValue);
  };
  
  // Handle refresh interval change
  const handleRefreshIntervalChange = (event) => {
    setRefreshInterval(parseInt(event.target.value));
  };
  
  // Mark alert as read
  const markAlertAsRead = (alertId) => {
    const updatedHistory = alertHistory.map(alert => 
      alert.id === alertId ? { ...alert, read: true } : alert
    );
    
    setAlertHistory(updatedHistory);
    localStorage.setItem(`liquidation_alerts_${currentAccount}`, JSON.stringify(updatedHistory));
  };
  
  // Clear all alerts
  const clearAllAlerts = () => {
    setAlertHistory([]);
    localStorage.setItem(`liquidation_alerts_${currentAccount}`, JSON.stringify([]));
    showSnackbar('All alerts cleared', 'success');
  };
  
  // Get health factor color
  const getHealthFactorColor = (factor) => {
    if (factor < 1.1) return theme.palette.error.main;
    if (factor < 1.5) return theme.palette.warning.main;
    return theme.palette.success.main;
  };
  
  // Settings dialog
  const SettingsDialog = () => (
    <Dialog 
      open={settingsOpen} 
      onClose={() => setSettingsOpen(false)}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>
        Liquidation Monitor Settings
        <IconButton
          edge="end"
          color="inherit"
          onClick={() => setSettingsOpen(false)}
          aria-label="close"
          sx={{ position: 'absolute', right: 8, top: 8 }}
        >
          <Close />
        </IconButton>
      </DialogTitle>
      
      <DialogContent dividers>
        <Typography variant="subtitle2" gutterBottom>
          Risk Threshold
        </Typography>
        <Box sx={{ px: 2, pb: 2 }}>
          <Slider
            value={riskThreshold}
            onChange={handleRiskThresholdChange}
            aria-labelledby="risk-threshold-slider"
            step={0.1}
            marks
            min={1.1}
            max={3.0}
            valueLabelDisplay="on"
            sx={{ 
              '& .MuiSlider-mark': { 
                backgroundColor: (theme) => theme.palette.primary.main 
              }
            }}
          />
          <Typography variant="caption" color="text.secondary">
            Alert when health factor drops below this threshold. Lower values indicate higher risk.
          </Typography>
        </Box>
        
        <Box sx={{ my: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            Refresh Interval
          </Typography>
          <TextField
            select
            fullWidth
            value={refreshInterval}
            onChange={handleRefreshIntervalChange}
            variant="outlined"
            size="small"
          >
            <MenuItem value={30}>30 seconds</MenuItem>
            <MenuItem value={60}>1 minute</MenuItem>
            <MenuItem value={300}>5 minutes</MenuItem>
            <MenuItem value={600}>10 minutes</MenuItem>
            <MenuItem value={1800}>30 minutes</MenuItem>
          </TextField>
          <Typography variant="caption" color="text.secondary">
            How often to check for liquidation risks.
          </Typography>
        </Box>
        
        <Box sx={{ my: 2 }}>
          <FormControlLabel
            control={
              <Switch
                checked={notificationsEnabled}
                onChange={handleNotificationsToggle}
                color="primary"
              />
            }
            label="Enable Alerts"
          />
          <Typography variant="caption" color="text.secondary" display="block">
            Receive alerts when positions are at risk of liquidation.
          </Typography>
        </Box>
        
        {notificationsEnabled && !isIotaConnected && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            <AlertTitle>IOTA wallet not connected</AlertTitle>
            Connect your IOTA wallet to receive secure notifications through IOTA Streams.
          </Alert>
        )}
        
        <Divider sx={{ my: 2 }} />
        
        <Typography variant="subtitle2" gutterBottom>
          Alert History
        </Typography>
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1 }}>
          <Button 
            size="small" 
            startIcon={<DeleteOutline />} 
            onClick={clearAllAlerts}
            disabled={alertHistory.length === 0}
          >
            Clear All
          </Button>
        </Box>
        
        {alertHistory.length > 0 ? (
          <List dense>
            {alertHistory.slice(0, 5).map((alert) => (
              <ListItem 
                key={alert.id} 
                button 
                onClick={() => markAlertAsRead(alert.id)}
                sx={{ 
                  bgcolor: alert.read ? 'transparent' : 'rgba(255, 152, 0, 0.08)',
                  borderLeft: alert.read ? 'none' : `4px solid ${theme.palette.warning.main}`
                }}
              >
                <ListItemText
                  primary={`${alert.collateralSymbol} position at risk`}
                  secondary={`Health factor: ${alert.healthFactor.toFixed(2)} - ${new Date(alert.timestamp).toLocaleString()}`}
                />
              </ListItem>
            ))}
            {alertHistory.length > 5 && (
              <Typography variant="caption" color="text.secondary" sx={{ pl: 2 }}>
                + {alertHistory.length - 5} more alerts
              </Typography>
            )}
          </List>
        ) : (
          <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
            No alerts recorded
          </Typography>
        )}
      </DialogContent>
      
      <DialogActions>
        <Button onClick={() => setSettingsOpen(false)}>Cancel</Button>
        <Button onClick={saveAlertSettings} variant="contained" color="primary">
          Save Settings
        </Button>
      </DialogActions>
    </Dialog>
  );
  
  return (
    <Box sx={{ width: '100%' }}>
      <Paper elevation={2} sx={{ p: 3, borderRadius: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <WarningAmber color="warning" />
            Liquidation Risk Monitor
          </Typography>
          
          <Box>
            <Tooltip title="Refresh">
              <IconButton onClick={() => loadPositions()} disabled={loading}>
                {loading ? <CircularProgress size={24} /> : <Refresh />}
              </IconButton>
            </Tooltip>
            <Tooltip title="Settings">
              <IconButton onClick={() => setSettingsOpen(true)}>
                <Settings />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
        
        {!isEvmConnected && (
          <Alert severity="info" sx={{ mb: 3 }}>
            <AlertTitle>Wallet not connected</AlertTitle>
            Connect your wallet to monitor liquidation risks.
          </Alert>
        )}
        
        {isEvmConnected && positions.length === 0 ? (
          <Alert severity="info" sx={{ mb: 3 }}>
            <AlertTitle>No active positions</AlertTitle>
            You don't have any active borrowing positions to monitor.
          </Alert>
        ) : (
          <>
            {/* Alert summary */}
            <Box sx={{ mb: 3 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={notificationsEnabled}
                    onChange={handleNotificationsToggle}
                    color="primary"
                  />
                }
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {notificationsEnabled ? 
                      <NotificationsActive color="primary" /> : 
                      <NotificationsOff color="action" />
                    }
                    <Typography>
                      {notificationsEnabled ? 'Alerts Enabled' : 'Alerts Disabled'}
                    </Typography>
                  </Box>
                }
              />
              
              {notificationsEnabled && !isIotaConnected && (
                <Alert severity="warning" sx={{ mt: 2 }}>
                  <AlertTitle>IOTA wallet not connected</AlertTitle>
                  Connect your IOTA wallet to receive secure notifications through IOTA Streams.
                </Alert>
              )}
            </Box>
            
            {/* Positions grid */}
            <Grid container spacing={2}>
              {positions.map((position) => (
                <Grid item xs={12} md={6} key={position.id}>
                  <Card 
                    variant="outlined"
                    sx={{ 
                      borderLeft: `4px solid ${getHealthFactorColor(position.healthFactor)}`,
                      transition: 'all 0.3s',
                      '&:hover': {
                        boxShadow: `0 0 0 1px ${getHealthFactorColor(position.healthFactor)}`
                      }
                    }}
                  >
                    <CardContent>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                        <Typography variant="subtitle1">
                          {position.collateralSymbol} Position
                        </Typography>
                        <Chip 
                          label={position.healthFactor < riskThreshold ? 'At Risk' : 'Safe'} 
                          color={position.healthFactor < riskThreshold ? 'warning' : 'success'}
                          size="small"
                        />
                      </Box>
                      
                      <Divider sx={{ my: 1 }} />
                      
                      <Grid container spacing={1} sx={{ mt: 1 }}>
                        <Grid item xs={6}>
                          <Typography variant="body2" color="text.secondary">
                            Collateral
                          </Typography>
                          <Typography variant="body1">
                            {parseFloat(position.collateralAmount).toFixed(2)} {position.collateralSymbol}
                          </Typography>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography variant="body2" color="text.secondary">
                            Debt
                          </Typography>
                          <Typography variant="body1">
                            {parseFloat(position.debtAmount).toFixed(2)} {position.debtSymbol}
                          </Typography>
                        </Grid>
                        
                        <Grid item xs={6}>
                          <Typography variant="body2" color="text.secondary">
                            Health Factor
                          </Typography>
                          <Typography 
                            variant="body1"
                            sx={{ 
                              color: getHealthFactorColor(position.healthFactor),
                              fontWeight: position.healthFactor < riskThreshold ? 'bold' : 'normal'
                            }}
                          >
                            {position.healthFactor.toFixed(2)}
                          </Typography>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography variant="body2" color="text.secondary">
                            Liquidation Price
                          </Typography>
                          <Typography variant="body1">
                            ${position.liquidationPrice.toFixed(2)}
                          </Typography>
                        </Grid>
                        
                        <Grid item xs={12}>
                          <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                            <Box sx={{ flexGrow: 1, mr: 1 }}>
                              <Slider
                                value={position.currentPrice}
                                min={0}
                                max={position.currentPrice * 2}
                                step={0.01}
                                disabled
                                marks={[
                                  { value: position.liquidationPrice, label: 'Liquidation' }
                                ]}
                                sx={{ 
                                  '& .MuiSlider-mark': { 
                                    height: '14px',
                                    width: '2px', 
                                    backgroundColor: theme.palette.error.main 
                                  },
                                  '& .MuiSlider-rail': { 
                                    opacity: 0.3,
                                    backgroundColor: theme.palette.warning.light
                                  }
                                }}
                              />
                            </Box>
                            <Typography variant="body2" sx={{ ml: 1, minWidth: '70px' }}>
                              ${position.currentPrice.toFixed(2)}
                            </Typography>
                          </Box>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center' }}>
                            {(((position.currentPrice - position.liquidationPrice) / position.currentPrice) * 100).toFixed(1)}% buffer to liquidation
                          </Typography>
                        </Grid>
                      </Grid>
                      
                      {position.healthFactor < riskThreshold && (
                        <Alert severity="warning" sx={{ mt: 2 }}>
                          <AlertTitle>Liquidation Risk</AlertTitle>
                          Consider adding more collateral or repaying some debt to avoid liquidation.
                        </Alert>
                      )}
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </>
        )}
        
        {/* Unread alerts summary */}
        {alertHistory.filter(a => !a.read).length > 0 && (
          <Box sx={{ mt: 3 }}>
            <Alert 
              severity="warning" 
              icon={<Notifications color="warning" />}
              action={
                <Button 
                  color="inherit" 
                  size="small" 
                  onClick={() => setSettingsOpen(true)}
                >
                  View All
                </Button>
              }
            >
              <AlertTitle>
                {alertHistory.filter(a => !a.read).length} Unread Alerts
              </AlertTitle>
              You have {alertHistory.filter(a => !a.read).length} unread liquidation alerts. 
            </Alert>
          </Box>
        )}
      </Paper>
      
      {/* Settings Dialog */}
      <SettingsDialog />
    </Box>
  );
};

export default LiquidationMonitor;