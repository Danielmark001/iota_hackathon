import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  Paper, 
  Grid, 
  Card, 
  CardContent, 
  Divider, 
  Chip,
  Button,
  LinearProgress,
  IconButton,
  Tooltip,
  CircularProgress,
  useTheme
} from '@mui/material';
import { 
  Refresh as RefreshIcon,
  CompareArrows as CompareArrowsIcon,
  ArrowForward as ArrowForwardIcon,
  ArrowBack as ArrowBackIcon,
  Circle as CircleIcon,
  Speed as SpeedIcon,
  Layers as LayersIcon,
  Timeline as TimelineIcon,
  Insights as InsightsIcon
} from '@mui/icons-material';
import { useIoTA } from '../../context/IoTAContext';
import { useSnackbar } from '../../context/SnackbarContext';

// This is a custom component to display cross-layer metrics between IOTA's L1 (Tangle) and L2 (EVM)
const CrossLayerMetrics = () => {
  const theme = useTheme();
  const { networkInfo } = useIoTA();
  const { showSnackbar } = useSnackbar();
  
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  
  // Load cross-layer metrics
  useEffect(() => {
    loadMetrics();
  }, []);
  
  // Function to load metrics
  const loadMetrics = async () => {
    setLoading(true);
    try {
      // In a real implementation, this would fetch data from your backend
      // For now, we'll use sample data
      
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const sampleMetrics = {
        // L1 stats (IOTA Tangle)
        l1: {
          tps: 42,
          confirmedTransactions: 8754321,
          totalMessages: 9125634,
          avgConfirmationTime: 2.5, // seconds
          health: 'healthy'
        },
        // L2 stats (IOTA EVM)
        l2: {
          tps: 15,
          blockHeight: 3845762,
          totalTransactions: 2345678,
          avgBlockTime: 4.2, // seconds
          gasPrice: 0.001, // gwei
          health: 'healthy'
        },
        // Bridge metrics
        bridge: {
          crossLayerMessages: 28456,
          pendingTransactions: 3,
          recentBridgeOps: [
            { direction: 'l1-to-l2', timestamp: Date.now() - 300000, status: 'completed' },
            { direction: 'l2-to-l1', timestamp: Date.now() - 600000, status: 'completed' },
            { direction: 'l1-to-l2', timestamp: Date.now() - 1200000, status: 'completed' },
            { direction: 'l2-to-l1', timestamp: Date.now() - 1800000, status: 'completed' },
          ],
          l1ToL2Volume: 156789,
          l2ToL1Volume: 98765,
          health: 'operational'
        }
      };
      
      setMetrics(sampleMetrics);
    } catch (error) {
      console.error('Error loading cross-layer metrics:', error);
      showSnackbar('Failed to load cross-layer metrics', 'error');
    } finally {
      setLoading(false);
    }
  };
  
  // Handle refresh
  const handleRefresh = async () => {
    if (refreshing) return;
    
    setRefreshing(true);
    try {
      await loadMetrics();
      showSnackbar('Cross-layer metrics updated', 'success');
    } catch (error) {
      console.error('Error refreshing cross-layer metrics:', error);
      showSnackbar('Failed to refresh cross-layer metrics', 'error');
    } finally {
      setRefreshing(false);
    }
  };
  
  // Render loading state
  if (loading) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography variant="h5" gutterBottom>
          Cross-Layer Dashboard
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          Loading cross-layer metrics between IOTA's L1 (Tangle) and L2 (EVM)...
        </Typography>
        <LinearProgress sx={{ mt: 2 }} />
      </Box>
    );
  }
  
  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h5" gutterBottom>
            Cross-Layer Dashboard
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Monitoring metrics between IOTA's Layer 1 (Tangle) and Layer 2 (EVM)
          </Typography>
        </Box>
        <Tooltip title="Refresh Metrics">
          <IconButton
            onClick={handleRefresh}
            disabled={refreshing}
            color="primary"
          >
            {refreshing ? (
              <CircularProgress size={24} />
            ) : (
              <RefreshIcon />
            )}
          </IconButton>
        </Tooltip>
      </Box>
      
      {/* Network Status Card */}
      <Paper 
        elevation={0} 
        sx={{ 
          p: 2, 
          mb: 3, 
          borderRadius: 2,
          border: `1px solid ${theme.palette.divider}`,
          display: 'flex',
          justifyContent: 'space-around',
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', m: 1 }}>
          <CircleIcon 
            sx={{ 
              color: metrics?.l1.health === 'healthy' ? 'success.main' : 'warning.main',
              mr: 1,
              fontSize: 12
            }} 
          />
          <Typography variant="body2" fontWeight="medium">
            L1 Tangle: {metrics?.l1.health === 'healthy' ? 'Operational' : 'Degraded'}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', m: 1 }}>
          <CircleIcon 
            sx={{ 
              color: metrics?.l2.health === 'healthy' ? 'success.main' : 'warning.main',
              mr: 1,
              fontSize: 12
            }} 
          />
          <Typography variant="body2" fontWeight="medium">
            L2 EVM: {metrics?.l2.health === 'healthy' ? 'Operational' : 'Degraded'}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', m: 1 }}>
          <CircleIcon 
            sx={{ 
              color: metrics?.bridge.health === 'operational' ? 'success.main' : 'warning.main',
              mr: 1,
              fontSize: 12
            }} 
          />
          <Typography variant="body2" fontWeight="medium">
            Cross-Layer Bridge: {metrics?.bridge.health === 'operational' ? 'Operational' : 'Degraded'}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', m: 1 }}>
          <Chip 
            label={networkInfo?.name || 'Shimmer Testnet'} 
            size="small" 
            color="primary" 
            variant="outlined" 
          />
        </Box>
      </Paper>
      
      {/* Main Grid Layout */}
      <Grid container spacing={3}>
        {/* L1 Tangle Metrics */}
        <Grid item xs={12} md={4}>
          <Card 
            elevation={0} 
            sx={{ 
              height: '100%',
              borderRadius: 2,
              border: `1px solid ${theme.palette.divider}`,
              background: theme.palette.mode === 'dark' 
                ? 'linear-gradient(135deg, rgba(0,157,220,0.15) 0%, rgba(0,157,220,0.05) 100%)' 
                : 'linear-gradient(135deg, rgba(0,157,220,0.1) 0%, rgba(0,157,220,0.02) 100%)',
            }}
          >
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <SpeedIcon sx={{ color: '#009DDC', mr: 1 }} />
                <Typography variant="h6" component="div">
                  Layer 1 Tangle
                </Typography>
              </Box>
              
              <Divider sx={{ mb: 2 }} />
              
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  Transactions Per Second
                </Typography>
                <Typography variant="h4" sx={{ mt: 0.5, color: '#009DDC' }}>
                  {metrics?.l1.tps}
                </Typography>
              </Box>
              
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Paper 
                    elevation={0} 
                    sx={{ 
                      p: 1.5, 
                      borderRadius: 2,
                      bgcolor: 'background.paper',
                      height: '100%'
                    }}
                  >
                    <Typography variant="body2" color="text.secondary" noWrap>
                      Confirmed Tx
                    </Typography>
                    <Typography variant="body1" fontWeight="medium">
                      {(metrics?.l1.confirmedTransactions / 1000000).toFixed(2)}M
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={6}>
                  <Paper 
                    elevation={0} 
                    sx={{ 
                      p: 1.5, 
                      borderRadius: 2,
                      bgcolor: 'background.paper',
                      height: '100%'
                    }}
                  >
                    <Typography variant="body2" color="text.secondary" noWrap>
                      Confirm Time
                    </Typography>
                    <Typography variant="body1" fontWeight="medium">
                      {metrics?.l1.avgConfirmationTime}s
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12}>
                  <Paper 
                    elevation={0} 
                    sx={{ 
                      p: 1.5, 
                      borderRadius: 2,
                      bgcolor: 'background.paper',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        Total Messages
                      </Typography>
                      <Typography variant="body1" fontWeight="medium">
                        {(metrics?.l1.totalMessages / 1000000).toFixed(2)}M
                      </Typography>
                    </Box>
                    <Button
                      variant="outlined"
                      size="small"
                      endIcon={<ArrowForwardIcon />}
                      onClick={() => window.open('https://explorer.shimmer.network/testnet', '_blank')}
                      sx={{ borderRadius: 1.5 }}
                    >
                      Explorer
                    </Button>
                  </Paper>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>
        
        {/* Bridge Metrics */}
        <Grid item xs={12} md={4}>
          <Card 
            elevation={0} 
            sx={{ 
              height: '100%',
              borderRadius: 2,
              border: `1px solid ${theme.palette.divider}`,
              background: theme.palette.mode === 'dark' 
                ? 'linear-gradient(135deg, rgba(104,104,104,0.15) 0%, rgba(104,104,104,0.05) 100%)' 
                : 'linear-gradient(135deg, rgba(104,104,104,0.1) 0%, rgba(104,104,104,0.02) 100%)',
            }}
          >
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <CompareArrowsIcon sx={{ color: '#777777', mr: 1 }} />
                <Typography variant="h6" component="div">
                  Cross-Layer Bridge
                </Typography>
              </Box>
              
              <Divider sx={{ mb: 2 }} />
              
              <Box sx={{ textAlign: 'center', mb: 2 }}>
                <Box sx={{ 
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 2
                }}>
                  <Typography variant="body2" color="text.secondary" fontWeight="medium">
                    L1
                  </Typography>
                  <CompareArrowsIcon color="action" />
                  <Typography variant="body2" color="text.secondary" fontWeight="medium">
                    L2
                  </Typography>
                </Box>
                <Typography variant="h4" sx={{ mt: 0.5 }}>
                  {metrics?.bridge.crossLayerMessages.toLocaleString()}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Total Cross-Layer Messages
                </Typography>
              </Box>
              
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Paper 
                    elevation={0} 
                    sx={{ 
                      p: 1.5, 
                      borderRadius: 2,
                      bgcolor: 'background.paper',
                      textAlign: 'center',
                      height: '100%'
                    }}
                  >
                    <Box sx={{ display: 'flex', justifyContent: 'center', mb: 1 }}>
                      <ArrowForwardIcon color="primary" fontSize="small" />
                    </Box>
                    <Typography variant="body2" color="text.secondary" noWrap>
                      L1 → L2
                    </Typography>
                    <Typography variant="body1" fontWeight="medium">
                      {(metrics?.bridge.l1ToL2Volume / 1000).toFixed(1)}k
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={6}>
                  <Paper 
                    elevation={0} 
                    sx={{ 
                      p: 1.5, 
                      borderRadius: 2,
                      bgcolor: 'background.paper',
                      textAlign: 'center',
                      height: '100%'
                    }}
                  >
                    <Box sx={{ display: 'flex', justifyContent: 'center', mb: 1 }}>
                      <ArrowBackIcon color="secondary" fontSize="small" />
                    </Box>
                    <Typography variant="body2" color="text.secondary" noWrap>
                      L2 → L1
                    </Typography>
                    <Typography variant="body1" fontWeight="medium">
                      {(metrics?.bridge.l2ToL1Volume / 1000).toFixed(1)}k
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12}>
                  <Paper 
                    elevation={0} 
                    sx={{ 
                      p: 1.5, 
                      borderRadius: 2,
                      bgcolor: 'background.paper'
                    }}
                  >
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      Recent Bridge Operations
                    </Typography>
                    {metrics?.bridge.recentBridgeOps.slice(0, 3).map((op, index) => (
                      <Box 
                        key={index} 
                        sx={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'space-between',
                          mt: index > 0 ? 1 : 0
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          {op.direction === 'l1-to-l2' ? (
                            <ArrowForwardIcon color="primary" fontSize="small" sx={{ mr: 1 }} />
                          ) : (
                            <ArrowBackIcon color="secondary" fontSize="small" sx={{ mr: 1 }} />
                          )}
                          <Typography variant="body2">
                            {op.direction === 'l1-to-l2' ? 'L1 → L2' : 'L2 → L1'}
                          </Typography>
                        </Box>
                        <Chip 
                          label={op.status} 
                          size="small" 
                          color={op.status === 'completed' ? 'success' : 'warning'} 
                          variant="outlined"
                        />
                      </Box>
                    ))}
                  </Paper>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>
        
        {/* L2 EVM Metrics */}
        <Grid item xs={12} md={4}>
          <Card 
            elevation={0} 
            sx={{ 
              height: '100%',
              borderRadius: 2,
              border: `1px solid ${theme.palette.divider}`,
              background: theme.palette.mode === 'dark' 
                ? 'linear-gradient(135deg, rgba(137,87,255,0.15) 0%, rgba(137,87,255,0.05) 100%)' 
                : 'linear-gradient(135deg, rgba(137,87,255,0.1) 0%, rgba(137,87,255,0.02) 100%)',
            }}
          >
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <LayersIcon sx={{ color: '#8957FF', mr: 1 }} />
                <Typography variant="h6" component="div">
                  Layer 2 EVM
                </Typography>
              </Box>
              
              <Divider sx={{ mb: 2 }} />
              
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  Block Height
                </Typography>
                <Typography variant="h4" sx={{ mt: 0.5, color: '#8957FF' }}>
                  {metrics?.l2.blockHeight.toLocaleString()}
                </Typography>
              </Box>
              
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Paper 
                    elevation={0} 
                    sx={{ 
                      p: 1.5, 
                      borderRadius: 2,
                      bgcolor: 'background.paper',
                      height: '100%'
                    }}
                  >
                    <Typography variant="body2" color="text.secondary" noWrap>
                      Transactions
                    </Typography>
                    <Typography variant="body1" fontWeight="medium">
                      {(metrics?.l2.totalTransactions / 1000000).toFixed(2)}M
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={6}>
                  <Paper 
                    elevation={0} 
                    sx={{ 
                      p: 1.5, 
                      borderRadius: 2,
                      bgcolor: 'background.paper',
                      height: '100%'
                    }}
                  >
                    <Typography variant="body2" color="text.secondary" noWrap>
                      TPS
                    </Typography>
                    <Typography variant="body1" fontWeight="medium">
                      {metrics?.l2.tps}
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12}>
                  <Paper 
                    elevation={0} 
                    sx={{ 
                      p: 1.5, 
                      borderRadius: 2,
                      bgcolor: 'background.paper',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        Gas Price / Block Time
                      </Typography>
                      <Typography variant="body1" fontWeight="medium">
                        {metrics?.l2.gasPrice} gwei / {metrics?.l2.avgBlockTime}s
                      </Typography>
                    </Box>
                    <Button
                      variant="outlined"
                      size="small"
                      endIcon={<ArrowForwardIcon />}
                      onClick={() => window.open('https://explorer.evm.testnet.iota.cafe', '_blank')}
                      sx={{ borderRadius: 1.5 }}
                    >
                      Explorer
                    </Button>
                  </Paper>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>
        
        {/* Cross-Layer Activity Graph Card */}
        <Grid item xs={12}>
          <Card 
            elevation={0} 
            sx={{ 
              borderRadius: 2,
              border: `1px solid ${theme.palette.divider}`,
            }}
          >
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <InsightsIcon sx={{ mr: 1 }} />
                  <Typography variant="h6" component="div">
                    Cross-Layer Activity
                  </Typography>
                </Box>
                <Box>
                  <Button 
                    variant="outlined" 
                    size="small"
                    startIcon={<TimelineIcon />}
                    sx={{ borderRadius: 1.5 }}
                  >
                    View Analytics
                  </Button>
                </Box>
              </Box>
              
              <Divider sx={{ mb: 3 }} />
              
              <Box 
                sx={{ 
                  height: 200,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.01)',
                  borderRadius: 2,
                  p: 2
                }}
              >
                <Typography variant="body2" color="text.secondary">
                  Activity graph visualization would be displayed here
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default CrossLayerMetrics;