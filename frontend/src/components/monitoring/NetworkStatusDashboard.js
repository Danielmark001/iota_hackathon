import React, { useEffect, useState } from 'react';
import axios from 'axios';
import {
  Card,
  CardContent,
  CardHeader,
  CircularProgress,
  Grid,
  Typography,
  Button,
  Box,
  Chip,
  Divider,
  Alert,
  AlertTitle,
  List,
  ListItem,
  ListItemText
} from '@mui/material';
import {
  CheckCircleOutline as CheckIcon,
  ErrorOutline as ErrorIcon,
  Refresh as RefreshIcon,
  Speed as SpeedIcon,
  Storage as StorageIcon,
  Sync as SyncIcon,
  NetworkCheck as NetworkIcon
} from '@mui/icons-material';

/**
 * IOTA Network Status Dashboard Component
 * 
 * This component displays real-time status information about the IOTA network,
 * including node health, connection status, transaction throughput, and more.
 * It also implements a circuit breaker visualization to show the status of
 * different service operations.
 */
function NetworkStatusDashboard() {
  const [loading, setLoading] = useState(true);
  const [networkStatus, setNetworkStatus] = useState({});
  const [circuitStatus, setCircuitStatus] = useState({});
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [showDetails, setShowDetails] = useState(false);

  // Function to fetch network status from backend
  const fetchNetworkStatus = async () => {
    setLoading(true);
    try {
      // Fetch network info
      const networkResponse = await axios.get('/api/iota/network');
      
      // Fetch circuit breaker status
      const circuitResponse = await axios.get('/api/iota/circuit-status');
      
      setNetworkStatus(networkResponse.data);
      setCircuitStatus(circuitResponse.data);
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      console.error('Error fetching network status:', err);
      setError('Failed to fetch network status. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  // Fetch status on component mount and every 30 seconds
  useEffect(() => {
    fetchNetworkStatus();
    
    const intervalId = setInterval(() => {
      fetchNetworkStatus();
    }, 30000);
    
    return () => clearInterval(intervalId);
  }, []);

  // Format relative time (e.g., '2 minutes ago')
  const formatRelativeTime = (timestamp) => {
    if (!timestamp) return 'Never';
    
    const now = new Date();
    const time = new Date(timestamp);
    const diff = Math.floor((now - time) / 1000); // Difference in seconds
    
    if (diff < 60) return `${diff} seconds ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)} minutes ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
    return `${Math.floor(diff / 86400)} days ago`;
  };

  // Get color based on status
  const getStatusColor = (isHealthy) => {
    return isHealthy ? 'success.main' : 'error.main';
  };

  // Get circuit breaker status color
  const getCircuitColor = (state) => {
    switch (state) {
      case 'closed': return 'success.main';
      case 'half-open': return 'warning.main';
      case 'open': return 'error.main';
      default: return 'text.secondary';
    }
  };

  // Get circuit breaker status text
  const getCircuitText = (state) => {
    switch (state) {
      case 'closed': return 'Operational';
      case 'half-open': return 'Recovering';
      case 'open': return 'Service Degraded';
      default: return 'Unknown';
    }
  };

  // Render loading state
  if (loading && !networkStatus.network) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="300px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Card>
      <CardHeader 
        title="IOTA Network Status" 
        subheader={lastUpdated ? `Last updated: ${formatRelativeTime(lastUpdated)}` : 'Not updated yet'}
        action={
          <Button 
            startIcon={<RefreshIcon />} 
            onClick={fetchNetworkStatus}
            disabled={loading}
          >
            Refresh
          </Button>
        }
      />
      
      {error && (
        <Alert severity="error" sx={{ mx: 2, mb: 2 }}>
          <AlertTitle>Error</AlertTitle>
          {error}
        </Alert>
      )}
      
      <CardContent>
        <Grid container spacing={3}>
          {/* Node Status */}
          <Grid item xs={12} sm={6} md={4}>
            <Card variant="outlined">
              <CardContent>
                <Box display="flex" alignItems="center" mb={1}>
                  <NetworkIcon sx={{ mr: 1 }} />
                  <Typography variant="h6">Node Status</Typography>
                </Box>
                
                {networkStatus.nodeInfo ? (
                  <>
                    <Box display="flex" justifyContent="space-between" alignItems="center" mt={2}>
                      <Typography variant="body2">Health:</Typography>
                      <Chip 
                        label={networkStatus.nodeInfo.healthy ? "Healthy" : "Unhealthy"} 
                        color={networkStatus.nodeInfo.healthy ? "success" : "error"}
                        size="small"
                      />
                    </Box>
                    
                    <Typography variant="body2" mt={1}>
                      <strong>URL:</strong> {networkStatus.nodeInfo.url || 'N/A'}
                    </Typography>
                    
                    <Typography variant="body2" mt={1}>
                      <strong>Version:</strong> {networkStatus.nodeInfo.version || 'Unknown'}
                    </Typography>
                    
                    <Typography variant="body2" mt={1}>
                      <strong>Uptime:</strong> {networkStatus.nodeInfo.uptimePercentage ? `${networkStatus.nodeInfo.uptimePercentage}%` : 'N/A'}
                    </Typography>
                  </>
                ) : (
                  <Typography color="text.secondary" mt={2}>
                    No node information available
                  </Typography>
                )}
              </CardContent>
            </Card>
          </Grid>
          
          {/* Network Information */}
          <Grid item xs={12} sm={6} md={4}>
            <Card variant="outlined">
              <CardContent>
                <Box display="flex" alignItems="center" mb={1}>
                  <StorageIcon sx={{ mr: 1 }} />
                  <Typography variant="h6">Network Info</Typography>
                </Box>
                
                {networkStatus.network ? (
                  <>
                    <Typography variant="body2" mt={2}>
                      <strong>Network:</strong> {networkStatus.network || 'Unknown'}
                    </Typography>
                    
                    {networkStatus.protocol && (
                      <>
                        <Typography variant="body2" mt={1}>
                          <strong>Protocol Version:</strong> {networkStatus.protocol.version || 'Unknown'}
                        </Typography>
                        
                        <Typography variant="body2" mt={1}>
                          <strong>Bech32 HRP:</strong> {networkStatus.protocol.bech32Hrp || 'Unknown'}
                        </Typography>
                      </>
                    )}
                    
                    {networkStatus.connectionStatus && (
                      <Box mt={2}>
                        <Typography variant="body2">
                          <strong>Healthy Nodes:</strong> {networkStatus.connectionStatus.healthyNodes || 0}
                        </Typography>
                        
                        <Typography variant="body2" mt={1}>
                          <strong>Connected Node:</strong> {
                            networkStatus.connectionStatus.connectedNode ? 
                            networkStatus.connectionStatus.connectedNode.split('/').pop() : 
                            'None'
                          }
                        </Typography>
                      </Box>
                    )}
                  </>
                ) : (
                  <Typography color="text.secondary" mt={2}>
                    No network information available
                  </Typography>
                )}
              </CardContent>
            </Card>
          </Grid>
          
          {/* Circuit Breaker Status */}
          <Grid item xs={12} sm={6} md={4}>
            <Card variant="outlined">
              <CardContent>
                <Box display="flex" alignItems="center" mb={1}>
                  <SyncIcon sx={{ mr: 1 }} />
                  <Typography variant="h6">Service Status</Typography>
                </Box>
                
                {Object.keys(circuitStatus).length > 0 ? (
                  <List dense>
                    {Object.entries(circuitStatus).map(([service, status]) => (
                      <ListItem key={service} disablePadding sx={{ py: 0.5 }}>
                        <ListItemText 
                          primary={
                            <Box display="flex" justifyContent="space-between" alignItems="center">
                              <Typography variant="body2">
                                {service.charAt(0).toUpperCase() + service.slice(1)}:
                              </Typography>
                              <Chip 
                                label={getCircuitText(status.state)} 
                                size="small"
                                sx={{ backgroundColor: getCircuitColor(status.state), color: 'white' }}
                              />
                            </Box>
                          }
                          secondary={
                            status.state === 'open' ? 
                            `Next retry: ${formatRelativeTime(status.nextAttemptTime)}` : 
                            null
                          }
                        />
                      </ListItem>
                    ))}
                  </List>
                ) : (
                  <Typography color="text.secondary" mt={2}>
                    No service status information available
                  </Typography>
                )}
              </CardContent>
            </Card>
          </Grid>
          
          {/* Transaction Metrics */}
          {networkStatus.metrics && (
            <Grid item xs={12}>
              <Card variant="outlined">
                <CardContent>
                  <Box display="flex" alignItems="center" mb={1}>
                    <SpeedIcon sx={{ mr: 1 }} />
                    <Typography variant="h6">Network Metrics</Typography>
                  </Box>
                  
                  <Grid container spacing={2} mt={1}>
                    <Grid item xs={12} sm={4}>
                      <Typography variant="body2">
                        <strong>Confirmed Transactions:</strong> {networkStatus.metrics.confirmedTransactions || 0}
                      </Typography>
                    </Grid>
                    
                    <Grid item xs={12} sm={4}>
                      <Typography variant="body2">
                        <strong>Transactions Per Second:</strong> {networkStatus.metrics.tps || 0}
                      </Typography>
                    </Grid>
                    
                    <Grid item xs={12} sm={4}>
                      <Typography variant="body2">
                        <strong>Confirmation Rate:</strong> {networkStatus.metrics.confirmationRate ? `${networkStatus.metrics.confirmationRate}%` : 'N/A'}
                      </Typography>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </Grid>
          )}
        </Grid>
        
        {/* Network Alerts */}
        {networkStatus.alerts && networkStatus.alerts.length > 0 && (
          <Box mt={3}>
            <Typography variant="h6" gutterBottom>Network Alerts</Typography>
            
            {networkStatus.alerts.map((alert, index) => (
              <Alert 
                key={index} 
                severity={alert.severity || 'info'}
                sx={{ mb: 2 }}
              >
                <AlertTitle>{alert.title}</AlertTitle>
                {alert.message}
              </Alert>
            ))}
          </Box>
        )}
        
        {/* Advanced Details Toggle */}
        <Box mt={3} display="flex" justifyContent="center">
          <Button 
            variant="outlined" 
            onClick={() => setShowDetails(!showDetails)}
          >
            {showDetails ? 'Hide Details' : 'Show Advanced Details'}
          </Button>
        </Box>
        
        {/* Advanced Details Section */}
        {showDetails && networkStatus.nodeInfo && (
          <Box mt={3}>
            <Typography variant="h6" gutterBottom>Advanced Node Details</Typography>
            <Divider sx={{ mb: 2 }} />
            
            <pre style={{ overflowX: 'auto', background: '#f5f5f5', padding: 16, borderRadius: 4 }}>
              {JSON.stringify(networkStatus, null, 2)}
            </pre>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}

export default NetworkStatusDashboard;
