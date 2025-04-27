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
  TableRow,
  Link,
  Tooltip,
  IconButton,
  LinearProgress
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  CompareArrows as SwapIcon,
  Send as SendIcon,
  AccountBalance as AccountIcon,
  Link as LinkIcon,
  CheckCircle as CheckIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  ScheduleOutlined as PendingIcon,
  ContentCopy as CopyIcon,
  Timeline as TimelineIcon,
  Info as InfoOutlined
} from '@mui/icons-material';
import axios from 'axios';
import { useWeb3 } from '../../context/Web3Context';
import { useIoTA } from '../../context/IoTAContext';
import { useSnackbar } from '../../context/SnackbarContext';

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
  const [transactions, setTransactions] = useState([]);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  
  // Web3 context for EVM connection
  const { isConnected: web3Active, account } = useWeb3();
  
  // IOTA context for L1 connection
  const { 
    isConnected: iotaConnected, 
    address: iotaAddress, 
    network, 
    networkInfo,
    getExplorerUrl,
    getTransactionExplorerUrl
  } = useIoTA();

  // Snackbar for notifications
  const { showSnackbar } = useSnackbar();
  
  // Handle tab change
  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };
  
  // Copy to clipboard
  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(
      () => showSnackbar('Copied to clipboard!', 'success'),
      () => showSnackbar('Failed to copy', 'error')
    );
  };
  
  // Fetch all data
  const fetchData = async () => {
    setRefreshing(true);
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
              setMessages([]);
            })
        );
      }
      
      // Cross-layer transactions request
      if (iotaAddress || account) {
        requests.push(
          axios.get(`/api/cross-layer/transactions/${iotaAddress || account}`)
            .then(response => setTransactions(response.data.transactions || []))
            .catch(error => {
              console.error('Error fetching cross-layer transactions:', error);
              // Don't set main error for this, as it's not critical
              setTransactions([]);
            })
        );
      }
      
      // Wait for all requests to complete
      await Promise.all(requests);
      
      // Update last updated timestamp
      setLastUpdated(new Date());
      setLoading(false);
    } catch (error) {
      console.error('Error fetching data:', error);
      setError('Failed to fetch data. Please try again later.');
      setLoading(false);
    } finally {
      setRefreshing(false);
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
  
  // Format address for display
  const formatAddress = (address) => {
    if (!address) return 'N/A';
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  };
  
  // Get status icon based on status
  const getStatusIcon = (status) => {
    const statusLower = status?.toLowerCase();
    
    if (['confirmed', 'completed', 'processed'].includes(statusLower)) {
      return <CheckIcon fontSize="small" color="success" />;
    } else if (['pending', 'processing'].includes(statusLower)) {
      return <PendingIcon fontSize="small" color="warning" />;
    } else if (['failed', 'rejected', 'conflicting'].includes(statusLower)) {
      return <ErrorIcon fontSize="small" color="error" />;
    }
    
    return <WarningIcon fontSize="small" color="action" />;
  };
  
  // Get status color for chips
  const getStatusColor = (status) => {
    const statusLower = status?.toLowerCase();
    
    if (['confirmed', 'completed', 'processed'].includes(statusLower)) {
      return 'success';
    } else if (['pending', 'processing'].includes(statusLower)) {
      return 'warning';
    } else if (['failed', 'rejected', 'conflicting'].includes(statusLower)) {
      return 'error';
    }
    
    return 'default';
  };
  
  // Render health factor indicator
  const renderHealthFactor = (factor) => {
    let color = 'success.main';
    let message = 'Good';
    
    if (factor <= 1.0) {
      color = 'error.main';
      message = 'Liquidation Risk';
    } else if (factor <= 1.5) {
      color = 'warning.main';
      message = 'At Risk';
    }
    
    return (
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
          <Typography variant="h6" color={color} fontWeight="bold">
            {factor.toFixed(2)}
          </Typography>
          <Tooltip title={`Health factor: ${message}`}>
            <Chip 
              label={message} 
              color={factor <= 1.0 ? 'error' : factor <= 1.5 ? 'warning' : 'success'} 
              size="small" 
              sx={{ ml: 1 }}
            />
          </Tooltip>
        </Box>
        <LinearProgress
          variant="determinate"
          value={Math.min(100, (factor / 3) * 100)}
          color={factor <= 1.0 ? 'error' : factor <= 1.5 ? 'warning' : 'success'}
          sx={{ height: 6, borderRadius: 3 }}
        />
      </Box>
    );
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
          title={
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <TimelineIcon sx={{ mr: 1 }} color="primary" />
              Cross-Layer Dashboard
            </Box>
          }
          subheader={
            <Typography variant="body2" color="text.secondary">
              View your positions across IOTA L1 and L2 networks
              {lastUpdated ? ` • Updated ${formatDate(lastUpdated)}` : ''}
            </Typography>
          }
          action={
            <Button 
              startIcon={refreshing ? <CircularProgress size={20} /> : <RefreshIcon />} 
              onClick={fetchData}
              disabled={refreshing}
              variant="outlined"
              size="small"
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
          <Paper 
            sx={{ 
              p: 2, 
              mb: 3, 
              borderRadius: 2,
              border: '1px solid',
              borderColor: 'divider'
            }}
          >
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Box display="flex" alignItems="center">
                  <Box 
                    sx={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      bgcolor: iotaConnected ? 'success.main' : 'grey.500',
                      mr: 1.5
                    }}
                  />
                  <Box>
                    <Typography variant="subtitle2" fontWeight="medium">
                      IOTA L1 (Tangle) {iotaConnected ? "Connected" : "Not Connected"}
                    </Typography>
                    {iotaConnected && iotaAddress && (
                      <Box sx={{ display: 'flex', alignItems: 'center', mt: 0.5 }}>
                        <Typography 
                          variant="body2" 
                          color="text.secondary"
                          sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}
                        >
                          {iotaAddress.substring(0, 10)}...{iotaAddress.substring(iotaAddress.length - 10)}
                        </Typography>
                        <Tooltip title="Copy address">
                          <IconButton 
                            size="small" 
                            onClick={() => copyToClipboard(iotaAddress)}
                            sx={{ ml: 0.5 }}
                          >
                            <CopyIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="View in explorer">
                          <IconButton
                            size="small"
                            component={Link}
                            href={getExplorerUrl(iotaAddress)}
                            target="_blank"
                            rel="noopener"
                            sx={{ ml: 0.5 }}
                          >
                            <LinkIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    )}
                  </Box>
                </Box>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <Box display="flex" alignItems="center">
                  <Box 
                    sx={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      bgcolor: web3Active ? 'success.main' : 'grey.500',
                      mr: 1.5
                    }}
                  />
                  <Box>
                    <Typography variant="subtitle2" fontWeight="medium">
                      IOTA L2 (EVM) {web3Active ? "Connected" : "Not Connected"}
                    </Typography>
                    {web3Active && account && (
                      <Box sx={{ display: 'flex', alignItems: 'center', mt: 0.5 }}>
                        <Typography 
                          variant="body2" 
                          color="text.secondary"
                          sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}
                        >
                          {account.substring(0, 6)}...{account.substring(account.length - 4)}
                        </Typography>
                        <Tooltip title="Copy address">
                          <IconButton 
                            size="small" 
                            onClick={() => copyToClipboard(account)}
                            sx={{ ml: 0.5 }}
                          >
                            <CopyIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="View in explorer">
                          <IconButton
                            size="small"
                            component={Link}
                            href={getExplorerUrl(account, 'l2')}
                            target="_blank"
                            rel="noopener"
                            sx={{ ml: 0.5 }}
                          >
                            <LinkIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
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
              <Tab label="Cross-Layer Transactions" />
            </Tabs>
          </Box>
          
          {/* Overview Tab */}
          {activeTab === 0 && (
            <Grid container spacing={3}>
              {/* L1 Positions */}
              <Grid item xs={12} md={6}>
                <Card 
                  variant="outlined"
                  sx={{
                    borderColor: iotaConnected ? 'primary.main' : 'divider',
                    borderRadius: 2,
                    transition: 'all 0.2s'
                  }}
                >
                  <CardHeader 
                    title={
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <AccountIcon sx={{ mr: 1 }} color="primary" />
                        IOTA L1 Positions
                      </Box>
                    }
                    subheader="Native IOTA and assets on Tangle"
                    action={
                      <Chip 
                        label={networkInfo?.name || 'IOTA Network'} 
                        color={network === 'mainnet' ? 'success' : 'warning'} 
                        size="small"
                      />
                    }
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
                        <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold' }}>
                          Balance: {l1Data.balance} IOTA
                        </Typography>
                        
                        {l1Data.tokens && l1Data.tokens.length > 0 && (
                          <Box mt={2}>
                            <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 'medium' }}>
                              Native Tokens:
                            </Typography>
                            <TableContainer>
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
                            </TableContainer>
                          </Box>
                        )}
                        
                        <Box mt={2} display="flex" justifyContent="flex-end">
                          <Button 
                            variant="outlined" 
                            size="small"
                            endIcon={<LinkIcon />}
                            component={Link}
                            href={getExplorerUrl(iotaAddress)}
                            target="_blank"
                            rel="noopener"
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
                <Card 
                  variant="outlined"
                  sx={{
                    borderColor: web3Active ? 'secondary.main' : 'divider',
                    borderRadius: 2,
                    transition: 'all 0.2s'
                  }}
                >
                  <CardHeader 
                    title={
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <AccountIcon sx={{ mr: 1 }} color="secondary" />
                        IOTA L2 Positions
                      </Box>
                    }
                    subheader="EVM assets and lending positions"
                    action={
                      <Chip 
                        label={`L2 ${networkInfo?.name || 'EVM Network'}`} 
                        color={network === 'mainnet' ? 'success' : 'warning'} 
                        size="small"
                      />
                    }
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
                        <Grid container spacing={2} sx={{ mb: 2 }}>
                          <Grid item xs={6}>
                            <Typography variant="subtitle2" color="text.secondary">Deposits:</Typography>
                            <Typography variant="h6" fontWeight="bold">{l2Data.deposits} SMR</Typography>
                          </Grid>
                          <Grid item xs={6}>
                            <Typography variant="subtitle2" color="text.secondary">Borrows:</Typography>
                            <Typography variant="h6" fontWeight="bold">{l2Data.borrows} SMR</Typography>
                          </Grid>
                          <Grid item xs={6}>
                            <Typography variant="subtitle2" color="text.secondary">Collateral:</Typography>
                            <Typography variant="h6" fontWeight="bold">{l2Data.collateral} SMR</Typography>
                          </Grid>
                          <Grid item xs={6}>
                            <Typography variant="subtitle2" color="text.secondary">Health Factor:</Typography>
                            {renderHealthFactor(l2Data.healthFactor)}
                          </Grid>
                        </Grid>
                        
                        <Divider sx={{ my: 2 }} />
                        
                        <Box display="flex" alignItems="center">
                          <Typography variant="subtitle2" color="text.secondary" mr={1}>Risk Score:</Typography>
                          <Chip 
                            label={l2Data.riskScore} 
                            color={
                              l2Data.riskScore < 30 ? 'success' : 
                              l2Data.riskScore < 70 ? 'warning' : 
                              'error'
                            }
                            size="small"
                          />
                          <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                            {l2Data.riskScore < 30 ? 'Low Risk' : 
                             l2Data.riskScore < 70 ? 'Medium Risk' : 
                             'High Risk'}
                          </Typography>
                        </Box>
                        
                        <Box mt={2} display="flex" justifyContent="flex-end">
                          <Button 
                            variant="outlined" 
                            size="small"
                            endIcon={<LinkIcon />}
                            component={Link}
                            href={getExplorerUrl(account, 'l2')}
                            target="_blank"
                            rel="noopener"
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
                <Card 
                  variant="outlined"
                  sx={{ 
                    borderRadius: 2,
                    bgcolor: 'background.subtle',
                    borderColor: 'primary.light'
                  }}
                >
                  <CardHeader 
                    title={
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <SwapIcon sx={{ mr: 1 }} color="primary" />
                        Cross-Layer Operations
                      </Box>
                    }
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
                          <Alert 
                            severity="info" 
                            sx={{ mt: 2 }}
                            icon={<InfoOutlined />}
                          >
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
            <Card variant="outlined" sx={{ borderRadius: 2 }}>
              <CardHeader 
                title={
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <SendIcon sx={{ mr: 1 }} color="primary" />
                    Cross-Layer Messages
                  </Box>
                }
                subheader="Communication between L1 and L2 layers"
              />
              <Divider />
              <CardContent>
                {(!iotaConnected && !web3Active) ? (
                  <Alert severity="info">
                    Connect at least one wallet to view cross-layer messages
                  </Alert>
                ) : messages.length === 0 ? (
                  <Alert severity="info">
                    No cross-layer messages found
                  </Alert>
                ) : (
                  <TableContainer sx={{ maxHeight: 400 }}>
                    <Table stickyHeader>
                      <TableHead>
                        <TableRow>
                          <TableCell>Message ID</TableCell>
                          <TableCell>Direction</TableCell>
                          <TableCell>Type</TableCell>
                          <TableCell>Status</TableCell>
                          <TableCell>Timestamp</TableCell>
                          <TableCell align="right">Actions</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {messages.map((message) => (
                          <TableRow key={message.messageId} hover>
                            <TableCell>
                              <Tooltip title={message.messageId}>
                                <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                                  {message.messageId.substring(0, 8)}...
                                </Typography>
                              </Tooltip>
                            </TableCell>
                            <TableCell>
                              <Chip 
                                label={message.direction === 'L1ToL2' ? 'L1 → L2' : 'L2 → L1'} 
                                color={message.direction === 'L1ToL2' ? 'primary' : 'secondary'} 
                                size="small"
                                variant="outlined"
                              />
                            </TableCell>
                            <TableCell>
                              {message.messageType || 'Unknown'}
                            </TableCell>
                            <TableCell>
                              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                {getStatusIcon(message.status)}
                                <Chip 
                                  label={message.status} 
                                  color={getStatusColor(message.status)}
                                  size="small"
                                  sx={{ ml: 1 }}
                                />
                              </Box>
                            </TableCell>
                            <TableCell>
                              {formatDate(message.timestamp)}
                            </TableCell>
                            <TableCell align="right">
                              <Tooltip title="View details">
                                <IconButton 
                                  size="small"
                                  onClick={() => {
                                    // Show message details dialog (not implemented)
                                    showSnackbar('Message details not implemented yet', 'info');
                                  }}
                                >
                                  <InfoOutlined fontSize="small" />
                                </IconButton>
                              </Tooltip>
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
          
          {/* Cross-Layer Transactions Tab */}
          {activeTab === 2 && (
            <Card variant="outlined" sx={{ borderRadius: 2 }}>
              <CardHeader 
                title={
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <SwapIcon sx={{ mr: 1 }} color="primary" />
                    Cross-Layer Transactions
                  </Box>
                }
                subheader="Asset transfers between L1 and L2"
              />
              <Divider />
              <CardContent>
                {(!iotaConnected && !web3Active) ? (
                  <Alert severity="info">
                    Connect at least one wallet to view cross-layer transactions
                  </Alert>
                ) : transactions.length === 0 ? (
                  <Alert severity="info">
                    No cross-layer transactions found. Transfer assets between layers to get started.
                  </Alert>
                ) : (
                  <TableContainer sx={{ maxHeight: 400 }}>
                    <Table stickyHeader>
                      <TableHead>
                        <TableRow>
                          <TableCell>Transaction ID</TableCell>
                          <TableCell>Direction</TableCell>
                          <TableCell>Amount</TableCell>
                          <TableCell>Status</TableCell>
                          <TableCell>Timestamp</TableCell>
                          <TableCell align="right">Actions</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {transactions.map((tx) => (
                          <TableRow key={tx.id || tx.transactionId} hover>
                            <TableCell>
                              <Tooltip title={tx.id || tx.transactionId}>
                                <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                                  {(tx.id || tx.transactionId).substring(0, 8)}...
                                </Typography>
                              </Tooltip>
                            </TableCell>
                            <TableCell>
                              <Chip 
                                label={tx.direction === 'L1ToL2' ? 'L1 → L2' : 'L2 → L1'} 
                                color={tx.direction === 'L1ToL2' ? 'primary' : 'secondary'} 
                                size="small"
                                variant="outlined"
                              />
                            </TableCell>
                            <TableCell>
                              {tx.amount} SMR
                            </TableCell>
                            <TableCell>
                              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                {getStatusIcon(tx.status)}
                                <Chip 
                                  label={tx.status} 
                                  color={getStatusColor(tx.status)}
                                  size="small"
                                  sx={{ ml: 1 }}
                                />
                              </Box>
                            </TableCell>
                            <TableCell>
                              {formatDate(tx.timestamp)}
                            </TableCell>
                            <TableCell align="right">
                              <Tooltip title="View in explorer">
                                <IconButton 
                                  size="small"
                                  component={Link}
                                  href={
                                    tx.direction === 'L1ToL2'
                                      ? getTransactionExplorerUrl(tx.blockId || tx.id || tx.transactionId, 'l1')
                                      : getTransactionExplorerUrl(tx.hash || tx.id || tx.transactionId, 'l2')
                                  }
                                  target="_blank"
                                  rel="noopener"
                                >
                                  <LinkIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
                
                <Box mt={3}>
                  <Button 
                    variant="contained" 
                    startIcon={<SwapIcon />}
                    onClick={() => window.location.href = '/swap'}
                    disabled={!iotaConnected && !web3Active}
                  >
                    New Cross-Layer Transfer
                  </Button>
                </Box>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}

export default CrossLayerDashboard;