import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Chip,
  IconButton,
  Tooltip,
  TextField,
  MenuItem,
  Button,
  FormControl,
  InputLabel,
  Select,
  Grid,
  Card,
  CardContent,
  CircularProgress,
  Alert,
  Collapse,
  Tabs,
  Tab,
  FormControlLabel,
  Switch,
  Divider,
  Link
} from '@mui/material';
import {
  FilterList,
  Search,
  Refresh,
  ArrowDropDown,
  ArrowDropUp,
  OpenInNew,
  AccountBalanceWallet,
  CallMade,
  CallReceived,
  SwapHoriz,
  AttachMoney,
  LocalAtm,
  HistoryToggleOff,
  ViewList,
  BarChart
} from '@mui/icons-material';

// Charting components
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip, 
  Legend, 
  ResponsiveContainer,
  BarChart as RechartsBarChart,
  Bar,
  PieChart,
  Pie,
  Cell
} from 'recharts';

// Contexts
import { useIoTA } from '../../context/IoTAContext';
import { useWeb3 } from '../../context/Web3Context';

// Services
import apiService from '../../services/apiService';

/**
 * EnhancedTransactionHistory Component
 * 
 * A comprehensive transaction history view with filtering, visualization,
 * and analytics capabilities showing activities across both IOTA layers.
 */
const EnhancedTransactionHistory = () => {
  // Contexts
  const { isConnected: isIotaConnected, address: iotaAddress } = useIoTA();
  const { isConnected: isEvmConnected, currentAccount } = useWeb3();
  
  // State
  const [loading, setLoading] = useState(false);
  const [transactions, setTransactions] = useState([]);
  const [filteredTransactions, setFilteredTransactions] = useState([]);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalTxs, setTotalTxs] = useState(0);
  
  // Filters
  const [filterOpen, setFilterOpen] = useState(false);
  const [filters, setFilters] = useState({
    type: 'all',
    layer: 'all',
    dateFrom: '',
    dateTo: '',
    minAmount: '',
    maxAmount: '',
    status: 'all',
    search: ''
  });
  
  // View mode
  const [viewMode, setViewMode] = useState('list'); // 'list', 'analytics'
  const [chartType, setChartType] = useState('activity'); // 'activity', 'volume', 'distribution'
  const [tabValue, setTabValue] = useState(0);
  const [showCrossLayerOnly, setShowCrossLayerOnly] = useState(false);
  
  // Analytics data
  const [analyticsData, setAnalyticsData] = useState({
    byDate: [],
    byType: [],
    byLayer: [],
    volume: [],
    crossLayerMetrics: {
      l1ToL2Count: 0,
      l2ToL1Count: 0,
      l1ToL2Volume: 0,
      l2ToL1Volume: 0,
      averageTime: 0,
      successRate: 0
    }
  });
  
  // Load transactions on mount or when addresses change
  useEffect(() => {
    if ((isIotaConnected && iotaAddress) || (isEvmConnected && currentAccount)) {
      loadTransactions();
    }
  }, [isIotaConnected, iotaAddress, isEvmConnected, currentAccount]);
  
  // Update filtered transactions when filters or transactions change
  useEffect(() => {
    applyFilters();
  }, [filters, transactions, showCrossLayerOnly]);
  
  // Process analytics data when transactions change
  useEffect(() => {
    if (transactions.length > 0) {
      processAnalyticsData();
    }
  }, [transactions]);
  
  // Load transactions from API
  const loadTransactions = async () => {
    setLoading(true);
    try {
      let address = '';
      
      // Determine which address to use
      if (isEvmConnected && currentAccount) {
        address = currentAccount;
      } else if (isIotaConnected && iotaAddress) {
        address = iotaAddress;
      }
      
      if (address) {
        // Get both L1 and L2 transactions
        const l1Response = await apiService.getIotaTransactions(address);
        const l2Response = await apiService.getEvmTransactions(address);
        const crossLayerResponse = await apiService.getCrossLayerTransactions(address);
        
        // Combine and format transactions
        const allTransactions = [
          ...formatL1Transactions(l1Response.transactions || []),
          ...formatL2Transactions(l2Response.transactions || []),
          ...formatCrossLayerTransactions(crossLayerResponse.transactions || [])
        ];
        
        // Sort by timestamp (newest first)
        allTransactions.sort((a, b) => b.timestamp - a.timestamp);
        
        setTransactions(allTransactions);
        setTotalTxs(allTransactions.length);
        setFilteredTransactions(allTransactions);
      }
    } catch (error) {
      console.error('Error loading transactions:', error);
    } finally {
      setLoading(false);
    }
  };
  
  // Format L1 transactions
  const formatL1Transactions = (txs) => {
    return txs.map(tx => ({
      id: tx.id,
      hash: tx.id,
      from: tx.sender || tx.outputs?.[0]?.address || '',
      to: tx.recipient || tx.outputs?.[0]?.address || '',
      amount: parseFloat(tx.amount || tx.value || 0),
      timestamp: tx.timestamp,
      type: tx.type || (tx.sender === iotaAddress ? 'send' : 'receive'),
      status: tx.confirmed ? 'Confirmed' : 'Pending',
      layer: 'L1',
      symbol: 'SMR',
      explorerUrl: `https://explorer.shimmer.network/testnet/block/${tx.id}`
    }));
  };
  
  // Format L2 transactions
  const formatL2Transactions = (txs) => {
    return txs.map(tx => ({
      id: tx.hash,
      hash: tx.hash,
      from: tx.from,
      to: tx.to,
      amount: parseFloat(tx.value || 0),
      timestamp: tx.timestamp,
      type: tx.type || (tx.from.toLowerCase() === currentAccount?.toLowerCase() ? 'send' : 'receive'),
      status: tx.status || 'Confirmed',
      layer: 'L2',
      symbol: 'SMR',
      explorerUrl: `https://explorer.shimmer.network/testnet/evm/tx/${tx.hash}`
    }));
  };
  
  // Format cross-layer transactions
  const formatCrossLayerTransactions = (txs) => {
    return txs.map(tx => ({
      id: tx.id,
      hash: tx.id,
      from: tx.from || tx.sender,
      to: tx.to || tx.recipient,
      amount: parseFloat(tx.amount),
      timestamp: tx.timestamp,
      type: 'cross-layer',
      status: tx.status,
      layer: tx.direction || tx.type || 'L1ToL2', // L1ToL2 or L2ToL1
      symbol: 'SMR',
      explorerUrl: tx.layer === 'L1' 
        ? `https://explorer.shimmer.network/testnet/block/${tx.id}`
        : `https://explorer.shimmer.network/testnet/evm/tx/${tx.id}`
    }));
  };
  
  // Apply filters to transactions
  const applyFilters = () => {
    let filtered = [...transactions];
    
    // Filter by cross-layer only
    if (showCrossLayerOnly) {
      filtered = filtered.filter(tx => 
        tx.type === 'cross-layer' || 
        tx.layer === 'L1ToL2' || 
        tx.layer === 'L2ToL1'
      );
    }
    
    // Apply other filters
    if (filters.type !== 'all') {
      filtered = filtered.filter(tx => tx.type === filters.type);
    }
    
    if (filters.layer !== 'all') {
      filtered = filtered.filter(tx => tx.layer === filters.layer);
    }
    
    if (filters.status !== 'all') {
      filtered = filtered.filter(tx => tx.status === filters.status);
    }
    
    if (filters.dateFrom) {
      const fromDate = new Date(filters.dateFrom).getTime();
      filtered = filtered.filter(tx => tx.timestamp >= fromDate);
    }
    
    if (filters.dateTo) {
      const toDate = new Date(filters.dateTo).getTime() + (24 * 60 * 60 * 1000); // Include full day
      filtered = filtered.filter(tx => tx.timestamp <= toDate);
    }
    
    if (filters.minAmount) {
      filtered = filtered.filter(tx => tx.amount >= parseFloat(filters.minAmount));
    }
    
    if (filters.maxAmount) {
      filtered = filtered.filter(tx => tx.amount <= parseFloat(filters.maxAmount));
    }
    
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(tx => 
        tx.hash.toLowerCase().includes(searchLower) ||
        tx.from.toLowerCase().includes(searchLower) ||
        tx.to.toLowerCase().includes(searchLower)
      );
    }
    
    setFilteredTransactions(filtered);
    setPage(0); // Reset to first page when filters change
  };
  
  // Process analytics data
  const processAnalyticsData = () => {
    // Group transactions by date
    const txsByDate = groupTransactionsByDate(transactions);
    
    // Group transactions by type
    const txsByType = {};
    transactions.forEach(tx => {
      txsByType[tx.type] = (txsByType[tx.type] || 0) + 1;
    });
    
    // Group transactions by layer
    const txsByLayer = {};
    transactions.forEach(tx => {
      txsByLayer[tx.layer] = (txsByLayer[tx.layer] || 0) + 1;
    });
    
    // Calculate volume over time
    const volumeByDate = {};
    transactions.forEach(tx => {
      const date = new Date(tx.timestamp).toLocaleDateString();
      volumeByDate[date] = (volumeByDate[date] || 0) + tx.amount;
    });
    
    // Format data for charts
    const byDateData = Object.keys(txsByDate).map(date => ({
      date,
      count: txsByDate[date]
    }));
    
    const byTypeData = Object.keys(txsByType).map(type => ({
      name: formatTxType(type),
      value: txsByType[type]
    }));
    
    const byLayerData = Object.keys(txsByLayer).map(layer => ({
      name: formatLayerName(layer),
      value: txsByLayer[layer]
    }));
    
    const volumeData = Object.keys(volumeByDate).map(date => ({
      date,
      volume: volumeByDate[date]
    }));
    
    // Cross-layer specific metrics
    const crossLayerTxs = transactions.filter(tx => 
      tx.type === 'cross-layer' || 
      tx.layer === 'L1ToL2' || 
      tx.layer === 'L2ToL1'
    );
    
    const l1ToL2 = crossLayerTxs.filter(tx => 
      tx.layer === 'L1ToL2' || 
      (tx.type === 'cross-layer' && tx.from.startsWith('smr'))
    );
    
    const l2ToL1 = crossLayerTxs.filter(tx => 
      tx.layer === 'L2ToL1' || 
      (tx.type === 'cross-layer' && !tx.from.startsWith('smr'))
    );
    
    // Calculate success rate (confirmed / total)
    const successfulTxs = crossLayerTxs.filter(tx => 
      tx.status === 'Confirmed' || tx.status === 'Processed'
    );
    
    const successRate = crossLayerTxs.length > 0 
      ? (successfulTxs.length / crossLayerTxs.length) * 100 
      : 0;
    
    // Calculate volume
    const l1ToL2Volume = l1ToL2.reduce((sum, tx) => sum + tx.amount, 0);
    const l2ToL1Volume = l2ToL1.reduce((sum, tx) => sum + tx.amount, 0);
    
    // Set analytics data
    setAnalyticsData({
      byDate: byDateData,
      byType: byTypeData,
      byLayer: byLayerData,
      volume: volumeData,
      crossLayerMetrics: {
        l1ToL2Count: l1ToL2.length,
        l2ToL1Count: l2ToL1.length,
        l1ToL2Volume,
        l2ToL1Volume,
        averageTime: 0, // Would need more data to calculate
        successRate
      }
    });
  };
  
  // Group transactions by date
  const groupTransactionsByDate = (txs) => {
    const grouped = {};
    txs.forEach(tx => {
      const date = new Date(tx.timestamp).toLocaleDateString();
      grouped[date] = (grouped[date] || 0) + 1;
    });
    return grouped;
  };
  
  // Format transaction type for display
  const formatTxType = (type) => {
    switch (type) {
      case 'send': return 'Outgoing';
      case 'receive': return 'Incoming';
      case 'cross-layer': return 'Cross-Layer';
      default: return type.charAt(0).toUpperCase() + type.slice(1);
    }
  };
  
  // Format layer name for display
  const formatLayerName = (layer) => {
    switch (layer) {
      case 'L1': return 'IOTA L1';
      case 'L2': return 'IOTA EVM L2';
      case 'L1ToL2': return 'L1 to L2';
      case 'L2ToL1': return 'L2 to L1';
      default: return layer;
    }
  };
  
  // Reset filters
  const resetFilters = () => {
    setFilters({
      type: 'all',
      layer: 'all',
      dateFrom: '',
      dateTo: '',
      minAmount: '',
      maxAmount: '',
      status: 'all',
      search: ''
    });
    setShowCrossLayerOnly(false);
  };
  
  // Handle filter change
  const handleFilterChange = (event) => {
    const { name, value } = event.target;
    setFilters({
      ...filters,
      [name]: value
    });
  };
  
  // Handle page change
  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };
  
  // Handle rows per page change
  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };
  
  // Handle tab change
  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };
  
  // Handle view mode change
  const handleViewModeChange = (mode) => {
    setViewMode(mode);
  };
  
  // Handle chart type change
  const handleChartTypeChange = (type) => {
    setChartType(type);
  };
  
  // Format address for display
  const formatAddress = (address) => {
    if (!address) return '';
    
    // Check if it's the current user's address
    if (
      (iotaAddress && address === iotaAddress) || 
      (currentAccount && address.toLowerCase() === currentAccount.toLowerCase())
    ) {
      return 'You';
    }
    
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  };
  
  // Get transaction type icon
  const getTransactionTypeIcon = (tx) => {
    if (tx.type === 'send') {
      return <CallMade color="error" />;
    } else if (tx.type === 'receive') {
      return <CallReceived color="success" />;
    } else if (tx.type === 'cross-layer' || tx.layer === 'L1ToL2' || tx.layer === 'L2ToL1') {
      return <SwapHoriz color="primary" />;
    } else if (tx.type === 'stake' || tx.type === 'unstake') {
      return <LocalAtm color="warning" />;
    } else {
      return <AttachMoney />;
    }
  };
  
  // Get layer chip
  const getLayerChip = (layer) => {
    switch (layer) {
      case 'L1':
        return <Chip size="small" label="IOTA L1" color="primary" />;
      case 'L2':
        return <Chip size="small" label="IOTA L2" color="secondary" />;
      case 'L1ToL2':
        return <Chip size="small" label="L1 → L2" color="info" />;
      case 'L2ToL1':
        return <Chip size="small" label="L2 → L1" color="info" />;
      default:
        return <Chip size="small" label={layer} />;
    }
  };
  
  // Get status chip
  const getStatusChip = (status) => {
    switch (status) {
      case 'Confirmed':
      case 'Processed':
        return <Chip size="small" color="success" label={status} />;
      case 'Pending':
        return <Chip size="small" color="warning" label={status} />;
      case 'Failed':
        return <Chip size="small" color="error" label={status} />;
      default:
        return <Chip size="small" label={status} />;
    }
  };
  
  // No transactions view
  const NoTransactionsView = () => (
    <Box sx={{ textAlign: 'center', py: 4 }}>
      <Typography variant="h6" gutterBottom>
        No Transactions Found
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {isIotaConnected || isEvmConnected
          ? 'No transactions match your current filters. Try adjusting your filters or make some transactions!'
          : 'Connect your wallets to view your transaction history.'}
      </Typography>
      {(isIotaConnected || isEvmConnected) && (
        <Button 
          variant="outlined" 
          color="primary" 
          onClick={resetFilters} 
          sx={{ mt: 2 }}
        >
          Reset Filters
        </Button>
      )}
    </Box>
  );
  
  // Activity chart
  const ActivityChart = () => (
    <Box sx={{ height: 300, mt: 2 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={analyticsData.byDate}
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis />
          <RechartsTooltip formatter={(value) => [`${value} transactions`, 'Count']} />
          <Legend />
          <Line 
            type="monotone" 
            dataKey="count" 
            name="Transaction Count" 
            stroke="#8884d8" 
            activeDot={{ r: 8 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </Box>
  );
  
  // Volume chart
  const VolumeChart = () => (
    <Box sx={{ height: 300, mt: 2 }}>
      <ResponsiveContainer width="100%" height="100%">
        <RechartsBarChart
          data={analyticsData.volume}
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis />
          <RechartsTooltip formatter={(value) => [`${value.toFixed(2)} SMR`, 'Volume']} />
          <Legend />
          <Bar 
            dataKey="volume" 
            name="Transaction Volume (SMR)" 
            fill="#82ca9d" 
          />
        </RechartsBarChart>
      </ResponsiveContainer>
    </Box>
  );
  
  // Distribution charts
  const DistributionCharts = () => {
    const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];
    
    return (
      <Grid container spacing={2} sx={{ mt: 1 }}>
        <Grid item xs={12} md={6}>
          <Typography variant="subtitle2" align="center" gutterBottom>
            Transactions by Type
          </Typography>
          <Box sx={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={analyticsData.byType}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                  nameKey="name"
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                >
                  {analyticsData.byType.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <RechartsTooltip formatter={(value, name) => [`${value} transactions`, name]} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </Box>
        </Grid>
        
        <Grid item xs={12} md={6}>
          <Typography variant="subtitle2" align="center" gutterBottom>
            Transactions by Layer
          </Typography>
          <Box sx={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={analyticsData.byLayer}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                  nameKey="name"
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                >
                  {analyticsData.byLayer.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <RechartsTooltip formatter={(value, name) => [`${value} transactions`, name]} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </Box>
        </Grid>
      </Grid>
    );
  };
  
  // Cross-layer metrics
  const CrossLayerMetrics = () => (
    <Grid container spacing={2} sx={{ mt: 2 }}>
      <Grid item xs={12} sm={6} md={3}>
        <Card variant="outlined">
          <CardContent>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              L1 to L2 Transfers
            </Typography>
            <Typography variant="h5">
              {analyticsData.crossLayerMetrics.l1ToL2Count}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Volume: {analyticsData.crossLayerMetrics.l1ToL2Volume.toFixed(2)} SMR
            </Typography>
          </CardContent>
        </Card>
      </Grid>
      
      <Grid item xs={12} sm={6} md={3}>
        <Card variant="outlined">
          <CardContent>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              L2 to L1 Transfers
            </Typography>
            <Typography variant="h5">
              {analyticsData.crossLayerMetrics.l2ToL1Count}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Volume: {analyticsData.crossLayerMetrics.l2ToL1Volume.toFixed(2)} SMR
            </Typography>
          </CardContent>
        </Card>
      </Grid>
      
      <Grid item xs={12} sm={6} md={3}>
        <Card variant="outlined">
          <CardContent>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Success Rate
            </Typography>
            <Typography variant="h5">
              {analyticsData.crossLayerMetrics.successRate.toFixed(1)}%
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Completed transfers
            </Typography>
          </CardContent>
        </Card>
      </Grid>
      
      <Grid item xs={12} sm={6} md={3}>
        <Card variant="outlined">
          <CardContent>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Net Flow
            </Typography>
            <Typography variant="h5">
              {(analyticsData.crossLayerMetrics.l1ToL2Volume - analyticsData.crossLayerMetrics.l2ToL1Volume).toFixed(2)} SMR
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {analyticsData.crossLayerMetrics.l1ToL2Volume > analyticsData.crossLayerMetrics.l2ToL1Volume
                ? 'L1 ➝ L2 Outflow'
                : 'L2 ➝ L1 Outflow'}
            </Typography>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
  
  return (
    <Box sx={{ width: '100%' }}>
      <Paper elevation={2} sx={{ p: 3, borderRadius: 2 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h6">
            Transaction History
          </Typography>
          
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Button
              variant={viewMode === 'list' ? 'contained' : 'outlined'}
              size="small"
              startIcon={<ViewList />}
              onClick={() => handleViewModeChange('list')}
            >
              List
            </Button>
            <Button
              variant={viewMode === 'analytics' ? 'contained' : 'outlined'}
              size="small"
              startIcon={<BarChart />}
              onClick={() => handleViewModeChange('analytics')}
            >
              Analytics
            </Button>
            <Tooltip title="Refresh">
              <IconButton onClick={loadTransactions} disabled={loading}>
                {loading ? <CircularProgress size={24} /> : <Refresh />}
              </IconButton>
            </Tooltip>
            <Tooltip title="Filters">
              <IconButton onClick={() => setFilterOpen(!filterOpen)}>
                <FilterList />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
        
        {/* Filters */}
        <Collapse in={filterOpen}>
          <Box sx={{ mb: 3, p: 2, bgcolor: 'background.subtle', borderRadius: 1 }}>
            <Typography variant="subtitle2" gutterBottom>
              Filters
            </Typography>
            
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6} md={3}>
                <FormControl fullWidth variant="outlined" size="small">
                  <InputLabel>Type</InputLabel>
                  <Select
                    name="type"
                    value={filters.type}
                    onChange={handleFilterChange}
                    label="Type"
                  >
                    <MenuItem value="all">All Types</MenuItem>
                    <MenuItem value="send">Outgoing</MenuItem>
                    <MenuItem value="receive">Incoming</MenuItem>
                    <MenuItem value="cross-layer">Cross-Layer</MenuItem>
                    <MenuItem value="stake">Staking</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              
              <Grid item xs={12} sm={6} md={3}>
                <FormControl fullWidth variant="outlined" size="small">
                  <InputLabel>Layer</InputLabel>
                  <Select
                    name="layer"
                    value={filters.layer}
                    onChange={handleFilterChange}
                    label="Layer"
                  >
                    <MenuItem value="all">All Layers</MenuItem>
                    <MenuItem value="L1">IOTA L1</MenuItem>
                    <MenuItem value="L2">IOTA L2</MenuItem>
                    <MenuItem value="L1ToL2">L1 to L2</MenuItem>
                    <MenuItem value="L2ToL1">L2 to L1</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              
              <Grid item xs={12} sm={6} md={3}>
                <FormControl fullWidth variant="outlined" size="small">
                  <InputLabel>Status</InputLabel>
                  <Select
                    name="status"
                    value={filters.status}
                    onChange={handleFilterChange}
                    label="Status"
                  >
                    <MenuItem value="all">All Statuses</MenuItem>
                    <MenuItem value="Confirmed">Confirmed</MenuItem>
                    <MenuItem value="Pending">Pending</MenuItem>
                    <MenuItem value="Failed">Failed</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              
              <Grid item xs={12} sm={6} md={3}>
                <TextField
                  fullWidth
                  name="search"
                  label="Search"
                  value={filters.search}
                  onChange={handleFilterChange}
                  placeholder="Hash, Address..."
                  variant="outlined"
                  size="small"
                  InputProps={{
                    startAdornment: <Search fontSize="small" sx={{ mr: 1, opacity: 0.5 }} />
                  }}
                />
              </Grid>
              
              <Grid item xs={12} sm={6} md={3}>
                <TextField
                  fullWidth
                  type="date"
                  name="dateFrom"
                  label="From Date"
                  value={filters.dateFrom}
                  onChange={handleFilterChange}
                  variant="outlined"
                  size="small"
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              
              <Grid item xs={12} sm={6} md={3}>
                <TextField
                  fullWidth
                  type="date"
                  name="dateTo"
                  label="To Date"
                  value={filters.dateTo}
                  onChange={handleFilterChange}
                  variant="outlined"
                  size="small"
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              
              <Grid item xs={12} sm={6} md={3}>
                <TextField
                  fullWidth
                  type="number"
                  name="minAmount"
                  label="Min Amount"
                  value={filters.minAmount}
                  onChange={handleFilterChange}
                  variant="outlined"
                  size="small"
                  InputProps={{ inputProps: { min: 0, step: 0.01 } }}
                />
              </Grid>
              
              <Grid item xs={12} sm={6} md={3}>
                <TextField
                  fullWidth
                  type="number"
                  name="maxAmount"
                  label="Max Amount"
                  value={filters.maxAmount}
                  onChange={handleFilterChange}
                  variant="outlined"
                  size="small"
                  InputProps={{ inputProps: { min: 0, step: 0.01 } }}
                />
              </Grid>
            </Grid>
            
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={showCrossLayerOnly}
                    onChange={(e) => setShowCrossLayerOnly(e.target.checked)}
                    color="primary"
                  />
                }
                label="Show cross-layer transactions only"
              />
              
              <Button 
                variant="outlined" 
                size="small" 
                onClick={resetFilters}
              >
                Reset Filters
              </Button>
            </Box>
          </Box>
        </Collapse>
        
        {/* Cross-layer notice */}
        {showCrossLayerOnly && (
          <Alert severity="info" sx={{ mb: 3 }}>
            <Typography variant="body2">
              Showing only cross-layer transactions between IOTA L1 and L2
            </Typography>
          </Alert>
        )}
        
        {/* Connection notice */}
        {!isIotaConnected && !isEvmConnected && (
          <Alert severity="info" sx={{ mb: 3 }}>
            <Typography variant="body2">
              Connect at least one wallet (IOTA or EVM) to view your transaction history
            </Typography>
          </Alert>
        )}
        
        {/* Analytics View */}
        {viewMode === 'analytics' && (
          <>
            <Box sx={{ width: '100%', mb: 2 }}>
              <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                <Tabs value={tabValue} onChange={handleTabChange} aria-label="analytics tabs">
                  <Tab label="Activity" />
                  <Tab label="Volume" />
                  <Tab label="Distribution" />
                  <Tab label="Cross-Layer" />
                </Tabs>
              </Box>
              
              {/* Activity Tab */}
              {tabValue === 0 && (
                <Box sx={{ pt: 2 }}>
                  <Typography variant="subtitle1" gutterBottom>
                    Transaction Activity
                  </Typography>
                  {analyticsData.byDate.length > 0 ? (
                    <ActivityChart />
                  ) : (
                    <Alert severity="info" sx={{ mt: 2 }}>
                      <Typography variant="body2">
                        No transaction data available for the selected filters.
                      </Typography>
                    </Alert>
                  )}
                </Box>
              )}
              
              {/* Volume Tab */}
              {tabValue === 1 && (
                <Box sx={{ pt: 2 }}>
                  <Typography variant="subtitle1" gutterBottom>
                    Transaction Volume
                  </Typography>
                  {analyticsData.volume.length > 0 ? (
                    <VolumeChart />
                  ) : (
                    <Alert severity="info" sx={{ mt: 2 }}>
                      <Typography variant="body2">
                        No volume data available for the selected filters.
                      </Typography>
                    </Alert>
                  )}
                </Box>
              )}
              
              {/* Distribution Tab */}
              {tabValue === 2 && (
                <Box sx={{ pt: 2 }}>
                  <Typography variant="subtitle1" gutterBottom>
                    Transaction Distribution
                  </Typography>
                  {analyticsData.byType.length > 0 && analyticsData.byLayer.length > 0 ? (
                    <DistributionCharts />
                  ) : (
                    <Alert severity="info" sx={{ mt: 2 }}>
                      <Typography variant="body2">
                        No distribution data available for the selected filters.
                      </Typography>
                    </Alert>
                  )}
                </Box>
              )}
              
              {/* Cross-Layer Tab */}
              {tabValue === 3 && (
                <Box sx={{ pt: 2 }}>
                  <Typography variant="subtitle1" gutterBottom>
                    Cross-Layer Metrics
                  </Typography>
                  {filteredTransactions.some(tx => 
                    tx.type === 'cross-layer' || 
                    tx.layer === 'L1ToL2' || 
                    tx.layer === 'L2ToL1'
                  ) ? (
                    <CrossLayerMetrics />
                  ) : (
                    <Alert severity="info" sx={{ mt: 2 }}>
                      <Typography variant="body2">
                        No cross-layer transactions found for the selected filters.
                      </Typography>
                    </Alert>
                  )}
                </Box>
              )}
            </Box>
          </>
        )}
        
        {/* List View */}
        {viewMode === 'list' && (
          <>
            {filteredTransactions.length > 0 ? (
              <>
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Type</TableCell>
                        <TableCell>Hash</TableCell>
                        <TableCell>From</TableCell>
                        <TableCell>To</TableCell>
                        <TableCell align="right">Amount</TableCell>
                        <TableCell>Layer</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell>Date</TableCell>
                        <TableCell align="center">Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {(rowsPerPage > 0
                        ? filteredTransactions.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                        : filteredTransactions
                      ).map((tx) => (
                        <TableRow key={tx.id} hover>
                          <TableCell>
                            <Tooltip title={formatTxType(tx.type)}>
                              {getTransactionTypeIcon(tx)}
                            </Tooltip>
                          </TableCell>
                          <TableCell>
                            <Tooltip title={tx.hash}>
                              <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                                {tx.hash.substring(0, 10)}...
                              </Typography>
                            </Tooltip>
                          </TableCell>
                          <TableCell>
                            <Tooltip title={tx.from}>
                              <Typography variant="body2">
                                {formatAddress(tx.from)}
                              </Typography>
                            </Tooltip>
                          </TableCell>
                          <TableCell>
                            <Tooltip title={tx.to}>
                              <Typography variant="body2">
                                {formatAddress(tx.to)}
                              </Typography>
                            </Tooltip>
                          </TableCell>
                          <TableCell align="right">
                            <Typography
                              variant="body2"
                              color={tx.type === 'send' ? 'error.main' : 'success.main'}
                            >
                              {tx.type === 'send' ? '-' : '+'}
                              {tx.amount.toFixed(6)} {tx.symbol}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            {getLayerChip(tx.layer)}
                          </TableCell>
                          <TableCell>
                            {getStatusChip(tx.status)}
                          </TableCell>
                          <TableCell>
                            <Tooltip title={new Date(tx.timestamp).toLocaleString()}>
                              <Typography variant="body2">
                                {new Date(tx.timestamp).toLocaleDateString()}
                              </Typography>
                            </Tooltip>
                          </TableCell>
                          <TableCell align="center">
                            <Tooltip title="View in Explorer">
                              <IconButton
                                size="small"
                                component={Link}
                                href={tx.explorerUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <OpenInNew fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
                
                <TablePagination
                  rowsPerPageOptions={[10, 25, 50, 100]}
                  component="div"
                  count={filteredTransactions.length}
                  rowsPerPage={rowsPerPage}
                  page={page}
                  onPageChange={handleChangePage}
                  onRowsPerPageChange={handleChangeRowsPerPage}
                />
              </>
            ) : (
              <NoTransactionsView />
            )}
          </>
        )}
      </Paper>
    </Box>
  );
};

export default EnhancedTransactionHistory;