import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Divider,
  Grid,
  Card,
  CardContent,
  CardHeader,
  Tabs,
  Tab,
  Alert,
  Button,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  Tooltip,
  IconButton,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Link
} from '@mui/material';
import {
  SyncAlt,
  BarChart,
  OfflineBolt,
  AccountBalanceWallet,
  AttachMoney,
  ThumbUp,
  ThumbDown,
  Refresh,
  Info,
  ArrowDropUp,
  ArrowDropDown,
  SwapHoriz,
  MoreHoriz,
  OpenInNew
} from '@mui/icons-material';

// Contexts
import { useIoTA } from '../../context/IoTAContext';
import { useWeb3 } from '../../context/Web3Context';
import { useSnackbar } from '../../context/SnackbarContext';

// Services
import apiService from '../../services/apiService';

/**
 * CrossLayerDashboard Component
 * 
 * Displays a unified dashboard showing data from both IOTA L1 (Move) and L2 (EVM),
 * including transaction statuses, risk assessments, and liquidation events.
 */
const CrossLayerDashboard = () => {
  const { isConnected: isIotaConnected, address: iotaAddress } = useIoTA();
  const { currentAccount, chainId, isConnected: isEvmConnected } = useWeb3();
  const { showSnackbar } = useSnackbar();
  
  // State for dashboard data
  const [loading, setLoading] = useState(false);
  const [tabValue, setTabValue] = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [bridgeMessages, setBridgeMessages] = useState([]);
  const [liquidationEvents, setLiquidationEvents] = useState([]);
  const [crossLayerStats, setCrossLayerStats] = useState({
    l1TotalValue: 0,
    l2TotalValue: 0,
    crossLayerTransactions: 0,
    riskAssessmentEvents: 0
  });
  
  // Load dashboard data
  useEffect(() => {
    if ((isIotaConnected && iotaAddress) || (isEvmConnected && currentAccount)) {
      loadDashboardData();
    }
  }, [isIotaConnected, iotaAddress, isEvmConnected, currentAccount]);
  
  // Load all dashboard data
  const loadDashboardData = async () => {
    setLoading(true);
    try {
      // Get cross-layer transactions
      const txData = await fetchCrossLayerTransactions();
      setTransactions(txData);
      
      // Get bridge messages
      if (isEvmConnected && currentAccount) {
        const messages = await fetchBridgeMessages(currentAccount);
        setBridgeMessages(messages);
      }
      
      // Get liquidation events
      const liquidations = await fetchLiquidationEvents();
      setLiquidationEvents(liquidations);
      
      // Get overall stats
      const stats = await fetchCrossLayerStats();
      setCrossLayerStats(stats);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      showSnackbar('Failed to load cross-layer data', 'error');
    } finally {
      setLoading(false);
    }
  };
  
  // Fetch cross-layer transactions
  const fetchCrossLayerTransactions = async () => {
    try {
      let address = '';
      
      // Determine which address to use
      if (isEvmConnected && currentAccount) {
        address = currentAccount;
      } else if (isIotaConnected && iotaAddress) {
        address = iotaAddress;
      }
      
      if (address) {
        const response = await apiService.getCrossLayerTransactions(address);
        return response.transactions || [];
      }
      
      return [];
    } catch (error) {
      console.error('Error fetching cross-layer transactions:', error);
      return [];
    }
  };
  
  // Fetch bridge messages
  const fetchBridgeMessages = async (address) => {
    try {
      const response = await apiService.getBridgeMessages(address);
      return response.messages || [];
    } catch (error) {
      console.error('Error fetching bridge messages:', error);
      return [];
    }
  };
  
  // Fetch liquidation events
  const fetchLiquidationEvents = async () => {
    try {
      const response = await apiService.getLiquidationEvents();
      return response.events || [];
    } catch (error) {
      console.error('Error fetching liquidation events:', error);
      return [];
    }
  };
  
  // Fetch cross-layer stats
  const fetchCrossLayerStats = async () => {
    try {
      const response = await apiService.getCrossLayerStats();
      return response || {
        l1TotalValue: 0,
        l2TotalValue: 0,
        crossLayerTransactions: 0,
        riskAssessmentEvents: 0
      };
    } catch (error) {
      console.error('Error fetching cross-layer stats:', error);
      return {
        l1TotalValue: 0,
        l2TotalValue: 0,
        crossLayerTransactions: 0,
        riskAssessmentEvents: 0
      };
    }
  };
  
  // Handle tab change
  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };
  
  // Refresh dashboard data
  const handleRefresh = () => {
    loadDashboardData();
  };
  
  // Format address for display
  const formatAddress = (address) => {
    if (!address) return '';
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  };
  
  // Get transaction status chip
  const getStatusChip = (status) => {
    switch (status) {
      case 'Confirmed':
      case 'Processed':
        return <Chip size="small" color="success" label={status} icon={<ThumbUp sx={{ fontSize: 16 }} />} />;
      case 'Failed':
        return <Chip size="small" color="error" label={status} icon={<ThumbDown sx={{ fontSize: 16 }} />} />;
      case 'Pending':
        return <Chip size="small" color="warning" label={status} icon={<MoreHoriz sx={{ fontSize: 16 }} />} />;
      default:
        return <Chip size="small" color="default" label={status} />;
    }
  };
  
  // Get layer badge
  const getLayerBadge = (layer) => {
    switch (layer) {
      case 'L1':
        return <Chip size="small" color="primary" label="IOTA L1" />;
      case 'L2':
        return <Chip size="small" color="secondary" label="IOTA EVM" />;
      case 'L1ToL2':
        return <Chip size="small" label="L1 → L2" icon={<SwapHoriz sx={{ fontSize: 16 }} />} />;
      case 'L2ToL1':
        return <Chip size="small" label="L2 → L1" icon={<SwapHoriz sx={{ fontSize: 16 }} />} />;
      default:
        return <Chip size="small" label={layer} />;
    }
  };
  
  // Top Stats
  const TopStats = () => (
    <Grid container spacing={3}>
      <Grid item xs={12} md={6} lg={3}>
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <AccountBalanceWallet color="primary" sx={{ fontSize: 40, mr: 2 }} />
              <Box>
                <Typography variant="h5" component="div">
                  {crossLayerStats.l2TotalValue.toLocaleString()} SMR
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Total Value on L2 (EVM)
                </Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>
      </Grid>
      <Grid item xs={12} md={6} lg={3}>
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <OfflineBolt color="secondary" sx={{ fontSize: 40, mr: 2 }} />
              <Box>
                <Typography variant="h5" component="div">
                  {crossLayerStats.l1TotalValue.toLocaleString()} SMR
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Total Value on L1 (Move)
                </Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>
      </Grid>
      <Grid item xs={12} md={6} lg={3}>
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <SyncAlt color="success" sx={{ fontSize: 40, mr: 2 }} />
              <Box>
                <Typography variant="h5" component="div">
                  {crossLayerStats.crossLayerTransactions.toLocaleString()}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Cross-Layer Transactions
                </Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>
      </Grid>
      <Grid item xs={12} md={6} lg={3}>
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <BarChart color="warning" sx={{ fontSize: 40, mr: 2 }} />
              <Box>
                <Typography variant="h5" component="div">
                  {crossLayerStats.riskAssessmentEvents.toLocaleString()}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Risk Assessment Events
                </Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
  
  // Transactions Tab
  const TransactionsTab = () => (
    <Box>
      <Typography variant="h6" gutterBottom>
        Cross-Layer Transactions
      </Typography>
      <Typography variant="body2" color="text.secondary" paragraph>
        View transactions that move between IOTA L1 (Move) and L2 (EVM) layers.
      </Typography>
      
      {transactions.length > 0 ? (
        <TableContainer component={Paper} variant="outlined">
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Transaction ID</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>From</TableCell>
                <TableCell>To</TableCell>
                <TableCell align="right">Amount</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Timestamp</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {transactions.map((tx) => (
                <TableRow key={tx.id}>
                  <TableCell>
                    <Tooltip title={tx.id}>
                      <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                        {tx.id.substring(0, 10)}...
                      </Typography>
                    </Tooltip>
                  </TableCell>
                  <TableCell>{getLayerBadge(tx.type || tx.direction)}</TableCell>
                  <TableCell>{formatAddress(tx.from || tx.sender)}</TableCell>
                  <TableCell>{formatAddress(tx.to || tx.recipient)}</TableCell>
                  <TableCell align="right">{parseFloat(tx.amount).toFixed(4)} SMR</TableCell>
                  <TableCell>{getStatusChip(tx.status)}</TableCell>
                  <TableCell>
                    <Tooltip title={new Date(tx.timestamp).toLocaleString()}>
                      <Typography variant="body2">
                        {new Date(tx.timestamp).toLocaleDateString()}
                      </Typography>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      ) : (
        <Alert severity="info">
          <Typography variant="body2">
            No cross-layer transactions found. Transactions between L1 and L2 will appear here.
          </Typography>
        </Alert>
      )}
    </Box>
  );
  
  // Bridge Messages Tab
  const BridgeMessagesTab = () => (
    <Box>
      <Typography variant="h6" gutterBottom>
        Bridge Messages
      </Typography>
      <Typography variant="body2" color="text.secondary" paragraph>
        Messages sent between IOTA L1 and L2 through the cross-layer bridge.
      </Typography>
      
      {bridgeMessages.length > 0 ? (
        <TableContainer component={Paper} variant="outlined">
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Message ID</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Direction</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Timestamp</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {bridgeMessages.map((msg) => (
                <TableRow key={msg.messageId}>
                  <TableCell>
                    <Tooltip title={msg.messageId}>
                      <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                        {msg.messageId.substring(0, 10)}...
                      </Typography>
                    </Tooltip>
                  </TableCell>
                  <TableCell>{msg.messageType}</TableCell>
                  <TableCell>{getLayerBadge(msg.direction)}</TableCell>
                  <TableCell>{getStatusChip(msg.status)}</TableCell>
                  <TableCell>
                    <Tooltip title={new Date(msg.timestamp).toLocaleString()}>
                      <Typography variant="body2">
                        {new Date(msg.timestamp).toLocaleDateString()}
                      </Typography>
                    </Tooltip>
                  </TableCell>
                  <TableCell>
                    <Tooltip title="View details">
                      <IconButton size="small" component={Link} href={`/bridge/message/${msg.messageId}`}>
                        <OpenInNew fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      ) : (
        <Alert severity="info">
          <Typography variant="body2">
            No bridge messages found. Messages between L1 and L2 will appear here.
          </Typography>
        </Alert>
      )}
    </Box>
  );
  
  // Liquidation Events Tab
  const LiquidationEventsTab = () => (
    <Box>
      <Typography variant="h6" gutterBottom>
        Liquidation Events
      </Typography>
      <Typography variant="body2" color="text.secondary" paragraph>
        Monitor liquidation events across both L1 and L2 layers.
      </Typography>
      
      {liquidationEvents.length > 0 ? (
        <TableContainer component={Paper} variant="outlined">
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Event ID</TableCell>
                <TableCell>Layer</TableCell>
                <TableCell>Borrower</TableCell>
                <TableCell align="right">Collateral Amount</TableCell>
                <TableCell align="right">Debt Amount</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Timestamp</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {liquidationEvents.map((event) => (
                <TableRow key={event.id}>
                  <TableCell>
                    <Tooltip title={event.id}>
                      <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                        {event.id.substring(0, 10)}...
                      </Typography>
                    </Tooltip>
                  </TableCell>
                  <TableCell>{getLayerBadge(event.layer)}</TableCell>
                  <TableCell>{formatAddress(event.borrower)}</TableCell>
                  <TableCell align="right">{parseFloat(event.collateralAmount).toFixed(4)} SMR</TableCell>
                  <TableCell align="right">{parseFloat(event.debtAmount).toFixed(4)} SMR</TableCell>
                  <TableCell>{getStatusChip(event.status)}</TableCell>
                  <TableCell>
                    <Tooltip title={new Date(event.timestamp).toLocaleString()}>
                      <Typography variant="body2">
                        {new Date(event.timestamp).toLocaleDateString()}
                      </Typography>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      ) : (
        <Alert severity="info">
          <Typography variant="body2">
            No liquidation events found. Active liquidations will appear here.
          </Typography>
        </Alert>
      )}
    </Box>
  );
  
  return (
    <Box sx={{ width: '100%' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" component="h2">
          Cross-Layer Dashboard
        </Typography>
        <Button 
          startIcon={loading ? <CircularProgress size={20} /> : <Refresh />}
          onClick={handleRefresh}
          disabled={loading}
        >
          Refresh
        </Button>
      </Box>
      
      {!isIotaConnected && !isEvmConnected ? (
        <Alert severity="warning" sx={{ mb: 3 }}>
          <Typography variant="body1">
            Please connect at least one wallet (IOTA or EVM) to view cross-layer data.
          </Typography>
        </Alert>
      ) : (
        <>
          <TopStats />
          
          <Paper sx={{ mt: 3 }}>
            <Tabs
              value={tabValue}
              onChange={handleTabChange}
              indicatorColor="primary"
              textColor="primary"
              variant="fullWidth"
            >
              <Tab label="Transactions" icon={<SwapHoriz />} iconPosition="start" />
              <Tab label="Bridge Messages" icon={<SyncAlt />} iconPosition="start" />
              <Tab label="Liquidations" icon={<AttachMoney />} iconPosition="start" />
            </Tabs>
            
            <Divider />
            
            <Box sx={{ p: 3 }}>
              {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                  <CircularProgress />
                </Box>
              ) : (
                <>
                  {tabValue === 0 && <TransactionsTab />}
                  {tabValue === 1 && <BridgeMessagesTab />}
                  {tabValue === 2 && <LiquidationEventsTab />}
                </>
              )}
            </Box>
          </Paper>
        </>
      )}
    </Box>
  );
};

export default CrossLayerDashboard;
