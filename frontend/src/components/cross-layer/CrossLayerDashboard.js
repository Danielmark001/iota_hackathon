import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  CardHeader,
  CircularProgress,
  Divider,
  Grid,
  Tab,
  Tabs,
  Typography,
  Button,
  Paper,
  Alert,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  CompareArrows as SwapIcon,
  Send as SendIcon,
  AccountBalance as AccountIcon,
  Link as LinkIcon
} from '@mui/icons-material';
import axios from 'axios';
import { useWeb3React } from '@web3-react/core';
import { useIOTAContext } from '../../contexts/IOTAContext';

/**
 * Cross-Layer Dashboard Component
 * 
 * This component displays a unified dashboard for positions and transactions
 * on both IOTA Layer 1 (Tangle) and Layer 2 (EVM) networks.
 */
function CrossLayerDashboard() {
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [l1Data, setL1Data] = useState(null);
  const [l2Data, setL2Data] = useState(null);
  const [messages, setMessages] = useState([]);
  const [lastUpdated, setLastUpdated] = useState(null);
  
  // Web3 context for EVM connection
  const { active: web3Active, account, library } = useWeb3React();
  
  // IOTA context for L1 connection
  const { connected: iotaConnected, address: iotaAddress, api: iotaApi } = useIOTAContext();
  
  // Handle tab change
  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };
  
  // Fetch all data
  const fetchData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Prepare requests array
      const requests = [];
      
      // L1 data request (only if IOTA is connected)
      if (iotaConnected && iotaAddress) {
        requests.push(
          axios.get(`/api/iota/account/${iotaAddress}`)
            .then(response => setL1Data(response.data))
            .catch(error => {
              console.error('Error fetching L1 data:', error);
              setError(error.response?.data?.message || 'Failed to fetch L1 data');
            })
        );
      }
      
      // L2 data request (only if Web3 is connected)
      if (web3Active && account) {
        requests.push(
          axios.get(`/api/user/${account}`)
            .then(response => setL2Data(response.data))
            .catch(error => {
              console.error('Error fetching L2 data:', error);
              setError(error.response?.data?.message || 'Failed to fetch L2 data');
            })
        );
      }
      
      // Cross-layer messages request
      // Try L2 address first, fallback to L1 if not available
      const addressForMessages = account || iotaAddress;
      if (addressForMessages) {
        requests.push(
          axios.get(`/api/cross-layer/messages/${addressForMessages}`)
            .then(response => setMessages(response.data.messages || []))
            .catch(error => {
              console.error('Error fetching cross-layer messages:', error);
              // Don't set main error for this, as it's not critical
            })
        );
      }
      
      // Wait for all requests to complete
      await Promise.all(requests);
      
      // Update last updated timestamp
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error fetching data:', error);
      setError('Failed to fetch data. Please try again later.');
    } finally {
      setLoading(false);
    }
  };
  
  // Fetch data on component mount and when addresses change
  useEffect(() => {
    fetchData();
    
    // Set up refresh interval
    const intervalId = setInterval(() => {
      fetchData();
    }, 30000); // Refresh every 30 seconds
    
    return () => clearInterval(intervalId);
  }, [account, iotaAddress]);
  
  // Format date for display
  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    
    const date = new Date(timestamp);
    return date.toLocaleString();
  };
  
  // Format status for display
  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'confirmed':
      case 'completed':
        return 'success';
      case 'pending':
      case 'processing':
        return 'warning';
      case 'failed':
      case 'rejected':
      case 'conflicting':
        return 'error';
      default:
        return 'default';
    }
  };
  
  // Render loading state
  if (loading && !l1Data && !l2Data) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="300px">
        <CircularProgress />
      </Box>
    );
  }
  
  return (
    <Box>
      <Card>
        <CardHeader 
          title="Cross-Layer Dashboard" 
          subheader={`View your positions across IOTA L1 and L2 networks${lastUpdated ? ` • Updated ${formatDate(lastUpdated)}` : ''}`}
          action={
            <Button 
              startIcon={<RefreshIcon />} 
              onClick={fetchData}
              disabled={loading}
            >
              Refresh
            </Button>
          }
        />
        
        {error && (
          <Alert severity="error" sx={{ mx: 2, mb: 2 }}>
            {error}
          </Alert>
        )}
        
        <CardContent>
          {/* Connection Status */}
          <Paper sx={{ p: 2, mb: 3 }}>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Box display="flex" alignItems="center">
                  <AccountIcon color={iotaConnected ? "success" : "disabled"} sx={{ mr: 1 }} />
                  <Box>
                    <Typography variant="subtitle2">
                      IOTA L1 (Tangle) {iotaConnected ? "Connected" : "Not Connected"}
                    </Typography>
                    {iotaConnected && iotaAddress && (
                      <Typography variant="body2" color="text.secondary">
                        {iotaAddress.substring(0, 10)}...{iotaAddress.substring(iotaAddress.length - 10)}
                      </Typography>
                    )}
                  </Box>
                </Box>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <Box display="flex" alignItems="center">
                  <AccountIcon color={web3Active ? "success" : "disabled"} sx={{ mr: 1 }} />
                  <Box>
                    <Typography variant="subtitle2">
                      IOTA L2 (EVM) {web3Active ? "Connected" : "Not Connected"}
                    </Typography>
                    {web3Active && account && (
                      <Typography variant="body2" color="text.secondary">
                        {account.substring(0, 6)}...{account.substring(account.length - 4)}
                      </Typography>
                    )}
                  </Box>
                </Box>
              </Grid>
            </Grid>
          </Paper>
          
          {/* Dashboard Content Tabs */}
          <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
            <Tabs 
              value={activeTab} 
              onChange={handleTabChange}
              variant="fullWidth"
            >
              <Tab label="Overview" />
              <Tab label="Cross-Layer Messages" />
              <Tab label="Atomic Swaps" />
            </Tabs>
          </Box>
          
          {/* Overview Tab */}
          {activeTab === 0 && (
            <Grid container spacing={3}>
              {/* L1 Positions */}
              <Grid item xs={12} md={6}>
                <Card variant="outlined">
                  <CardHeader 
                    title="IOTA L1 Positions" 
                    subheader="Native IOTA and assets on Tangle"
                  />
                  <Divider />
                  <CardContent>
                    {!iotaConnected ? (
                      <Alert severity="info">
                        Connect your IOTA wallet to view L1 positions
                      </Alert>
                    ) : !l1Data ? (
                      <Box display="flex" justifyContent="center" py={2}>
                        <CircularProgress size={24} />
                      </Box>
                    ) : (
                      <>
                        <Typography variant="h6" gutterBottom>
                          Balance: {l1Data.balance} IOTA
                        </Typography>
                        
                        {l1Data.tokens && l1Data.tokens.length > 0 && (
                          <Box mt={2}>
                            <Typography variant="subtitle2" gutterBottom>
                              Native Tokens:
                            </Typography>
                            <Table size="small">
                              <TableHead>
                                <TableRow>
                                  <TableCell>Token</TableCell>
                                  <TableCell align="right">Balance</TableCell>
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {l1Data.tokens.map((token) => (
                                  <TableRow key={token.id}>
                                    <TableCell>{token.name || token.id.substring(0, 8)}</TableCell>
                                    <TableCell align="right">{token.balance}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </Box>
                        )}
                        
                        <Box mt={2} display="flex" justifyContent="flex-end">
                          <Button 
                            variant="outlined" 
                            size="small"
                            endIcon={<LinkIcon />}
                            onClick={() => window.open(`https://explorer.shimmer.network/testnet/address/${iotaAddress}`, '_blank')}
                          >
                            View on Explorer
                          </Button>
                        </Box>
                      </>
                    )}
                  </CardContent>
                </Card>
              </Grid>
              
              {/* L2 Positions */}
              <Grid item xs={12} md={6}>
                <Card variant="outlined">
                  <CardHeader 
                    title="IOTA L2 Positions" 
                    subheader="EVM assets and lending positions"
                  />
                  <Divider />
                  <CardContent>
                    {!web3Active ? (
                      <Alert severity="info">
                        Connect your EVM wallet to view L2 positions
                      </Alert>
                    ) : !l2Data ? (
                      <Box display="flex" justifyContent="center" py={2}>
                        <CircularProgress size={24} />
                      </Box>
                    ) : (
                      <>
                        <Grid container spacing={2}>
                          <Grid item xs={6}>
                            <Typography variant="subtitle2">Deposits:</Typography>
                            <Typography variant="h6">{l2Data.deposits} SMR</Typography>
                          </Grid>
                          <Grid item xs={6}>
                            <Typography variant="subtitle2">Borrows:</Typography>
                            <Typography variant="h6">{l2Data.borrows} SMR</Typography>
                          </Grid>
                          <Grid item xs={6}>
                            <Typography variant="subtitle2">Collateral:</Typography>
                            <Typography variant="h6">{l2Data.collateral} SMR</Typography>
                          </Grid>
                          <Grid item xs={6}>
                            <Typography variant="subtitle2">Health Factor:</Typography>
                            <Typography 
                              variant="h6" 
                              color={
                                l2Data.healthFactor > 1.5 ? 'success.main' : 
                                l2Data.healthFactor > 1.0 ? 'warning.main' : 
                                'error.main'
                              }
                            >
                              {l2Data.healthFactor.toFixed(2)}
                            </Typography>
                          </Grid>
                        </Grid>
                        
                        <Divider sx={{ my: 2 }} />
                        
                        <Box display="flex" alignItems="center">
                          <Typography variant="subtitle2" mr={1}>Risk Score:</Typography>
                          <Chip 
                            label={l2Data.riskScore} 
                            color={
                              l2Data.riskScore < 30 ? 'success' : 
                              l2Data.riskScore < 70 ? 'warning' : 
                              'error'
                            }
                            size="small"
                          />
                        </Box>
                        
                        <Box mt={2} display="flex" justifyContent="flex-end">
                          <Button 
                            variant="outlined" 
                            size="small"
                            endIcon={<LinkIcon />}
                            onClick={() => window.open(`https://explorer.evm.shimmer.network/address/${account}`, '_blank')}
                          >
                            View on Explorer
                          </Button>
                        </Box>
                      </>
                    )}
                  </CardContent>
                </Card>
              </Grid>
              
              {/* Cross-Layer Operations */}
              <Grid item xs={12}>
                <Card variant="outlined">
                  <CardHeader 
                    title="Cross-Layer Operations" 
                    subheader="Transfer assets and data between L1 and L2"
                  />
                  <Divider />
                  <CardContent>
                    <Grid container spacing={2}>
                      <Grid item xs={12} sm={6}>
                        <Button 
                          variant="contained" 
                          startIcon={<SwapIcon />}
                          fullWidth
                          onClick={() => window.location.href = '/swap'}
                          disabled={!iotaConnected || !web3Active}
                        >
                          Atomic Swap
                        </Button>
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <Button 
                          variant="outlined" 
                          startIcon={<SendIcon />}
                          fullWidth
                          onClick={() => window.location.href = '/bridge'}
                          disabled={!iotaConnected || !web3Active}
                        >
                          Bridge Assets
                        </Button>
                      </Grid>
                      <Grid item xs={12}>
                        {(!iotaConnected || !web3Active) && (
                          <Alert severity="info" sx={{ mt: 2 }}>
                            Connect both L1 and L2 wallets to enable cross-layer operations
                          </Alert>
                        )}
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          )}
          
          {/* Cross-Layer Messages Tab */}
          {activeTab === 1 && (
            <Card variant="outlined">
              <CardHeader 
                title="Cross-Layer Messages" 
                subheader="Communication between L1 and L2 layers"
              />
              <Divider />
              <CardContent>
                {messages.length === 0 ? (
                  <Alert severity="info">
                    No cross-layer messages found
                  </Alert>
                ) : (
                  <TableContainer>
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell>Message ID</TableCell>
                          <TableCell>Direction</TableCell>
                          <TableCell>Type</TableCell>
                          <TableCell>Status</TableCell>
                          <TableCell>Timestamp</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {messages.map((message) => (
                          <TableRow key={message.messageId}>
                            <TableCell>
                              {message.messageId.substring(0, 8)}...
                            </TableCell>
                            <TableCell>
                              {message.direction === 'L1ToL2' ? 'L1 → L2' : 'L2 → L1'}
                            </TableCell>
                            <TableCell>
                              {message.messageType || 'Unknown'}
                            </TableCell>
                            <TableCell>
                              <Chip 
                                label={message.status} 
                                color={getStatusColor(message.status)}
                                size="small"
                              />
                            </TableCell>
                            <TableCell>
                              {formatDate(message.timestamp)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </CardContent>
            </Card>
          )}
          
          {/* Atomic Swaps Tab */}
          {activeTab === 2 && (
            <Card variant="outlined">
              <CardHeader 
                title="Atomic Swaps" 
                subheader="Cross-layer asset exchanges"
              />
              <Divider />
              <CardContent>
                <Alert severity="info" sx={{ mb: 3 }}>
                  Atomic swaps allow you to exchange assets between IOTA L1 and L2 in a single transaction.
                </Alert>
                
                <Button 
                  variant="contained" 
                  startIcon={<SwapIcon />}
                  onClick={() => window.location.href = '/swap'}
                  disabled={!iotaConnected || !web3Active}
                >
                  Initiate New Atomic Swap
                </Button>
                
                {/* Todo: Add historical atomic swaps table */}
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}

export default CrossLayerDashboard;
