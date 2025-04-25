import React, { useState, useEffect } from 'react';
import {
  Container,
  Grid,
  Typography,
  Box,
  Paper,
  Tabs,
  Tab,
  Button,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  CircularProgress,
  Avatar,
  Card,
  CardContent,
  IconButton,
  Tooltip,
  useTheme,
  useMediaQuery,
  LinearProgress,
} from '@mui/material';
import {
  AccountBalanceWallet,
  Refresh,
  TrendingUp,
  TrendingDown,
  Launch,
  History,
  SwapHoriz,
  VerifiedUser,
  ArrowUpward,
  ArrowDownward,
  Settings,
  FilterList,
  MonetizationOn,
  Security,
  Person,
} from '@mui/icons-material';
import { Link as RouterLink } from 'react-router-dom';

// Components
import LoadingBackdrop from '../components/ui/LoadingBackdrop';
import StatCard from '../components/dashboard/StatCard';

// Contexts
import { useWeb3 } from '../context/Web3Context';
import { useSnackbar } from '../context/SnackbarContext';

// Services
import apiService from '../services/apiService';

// Charts
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip as ChartTooltip,
  Legend,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
} from 'chart.js';
import { Pie, Line } from 'react-chartjs-2';

// Register ChartJS components
ChartJS.register(
  ArcElement,
  ChartTooltip,
  Legend,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title
);

const PortfolioPage = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { currentAccount } = useWeb3();
  const { showSnackbar } = useSnackbar();
  
  // Component state
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tabValue, setTabValue] = useState(0);
  const [userProfile, setUserProfile] = useState(null);
  const [portfolioData, setPortfolioData] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [portfolioHistory, setPortfolioHistory] = useState(null);
  
  // Format currency for display
  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  };
  
  // Load portfolio data
  useEffect(() => {
    const loadPortfolioData = async () => {
      if (!currentAccount) return;
      
      setLoading(true);
      try {
        // Fetch user profile data
        const profileData = await apiService.getUserProfile(currentAccount);
        setUserProfile(profileData);
        
        // Fetch history data
        const historyData = await apiService.getHistoricalData(currentAccount);
        setPortfolioHistory(historyData);
        
        // Mock portfolio data (would come from API in real app)
        const portfolioAssets = [
          {
            symbol: 'MIOTA',
            name: 'IOTA',
            deposited: 1000,
            borrowed: 0,
            collateral: 800,
            apy: 5.2,
            price: 1.1,
            value: 1100,
            isCollateral: true,
            icon: 'https://cryptologos.cc/logos/iota-miota-logo.png',
          },
          {
            symbol: 'ETH',
            name: 'Ethereum',
            deposited: 0.5,
            borrowed: 0,
            collateral: 0,
            apy: 3.8,
            price: 2000,
            value: 1000,
            isCollateral: false,
            icon: 'https://cryptologos.cc/logos/ethereum-eth-logo.png',
          },
          {
            symbol: 'USDT',
            name: 'Tether',
            deposited: 0,
            borrowed: 500,
            collateral: 0,
            apy: 0,
            borrowApy: 8.5,
            price: 1,
            value: 500,
            isCollateral: false,
            icon: 'https://cryptologos.cc/logos/tether-usdt-logo.png',
          },
        ];
        
        setPortfolioData({
          assets: portfolioAssets,
          totalDeposited: portfolioAssets.reduce((sum, asset) => sum + asset.deposited * asset.price, 0),
          totalBorrowed: portfolioAssets.reduce((sum, asset) => sum + asset.borrowed * asset.price, 0),
          totalCollateral: portfolioAssets.reduce((sum, asset) => sum + asset.collateral * asset.price, 0),
        });
        
        // Mock transaction history
        const mockTransactions = [
          {
            type: 'deposit',
            token: 'MIOTA',
            amount: 1000,
            timestamp: Date.now() - 7 * 24 * 60 * 60 * 1000,
            hash: '0x' + Math.random().toString(16).substring(2, 16) + Math.random().toString(16).substring(2, 16),
          },
          {
            type: 'collateral',
            token: 'MIOTA',
            amount: 800,
            timestamp: Date.now() - 7 * 24 * 60 * 60 * 1000 + 3600000,
            hash: '0x' + Math.random().toString(16).substring(2, 16) + Math.random().toString(16).substring(2, 16),
          },
          {
            type: 'deposit',
            token: 'ETH',
            amount: 0.5,
            timestamp: Date.now() - 3 * 24 * 60 * 60 * 1000,
            hash: '0x' + Math.random().toString(16).substring(2, 16) + Math.random().toString(16).substring(2, 16),
          },
          {
            type: 'borrow',
            token: 'USDT',
            amount: 500,
            timestamp: Date.now() - 2 * 24 * 60 * 60 * 1000,
            hash: '0x' + Math.random().toString(16).substring(2, 16) + Math.random().toString(16).substring(2, 16),
          },
        ];
        
        // Sort by timestamp, newest first
        mockTransactions.sort((a, b) => b.timestamp - a.timestamp);
        
        setTransactions(mockTransactions);
      } catch (error) {
        console.error('Error loading portfolio data:', error);
        showSnackbar('Failed to load portfolio data', 'error');
      } finally {
        setLoading(false);
      }
    };
    
    loadPortfolioData();
  }, [currentAccount, showSnackbar]);
  
  // Handle tab change
  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };
  
  // Handle refresh
  const handleRefresh = async () => {
    if (refreshing) return;
    
    setRefreshing(true);
    try {
      // Reload portfolio data
      // This would call the API in a real app
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      showSnackbar('Portfolio data refreshed successfully', 'success');
    } catch (error) {
      console.error('Error refreshing portfolio data:', error);
      showSnackbar('Failed to refresh portfolio data', 'error');
    } finally {
      setRefreshing(false);
    }
  };
  
  // Format date for display
  const formatDate = (timestamp) => {
    return new Date(timestamp).toLocaleDateString();
  };
  
  // Format transaction type
  const formatTransactionType = (type) => {
    switch (type) {
      case 'deposit':
        return 'Deposit';
      case 'withdraw':
        return 'Withdraw';
      case 'borrow':
        return 'Borrow';
      case 'repay':
        return 'Repay';
      case 'collateral':
        return 'Add Collateral';
      case 'liquidation':
        return 'Liquidation';
      default:
        return type.charAt(0).toUpperCase() + type.slice(1);
    }
  };
  
  // Get transaction icon
  const getTransactionIcon = (type) => {
    switch (type) {
      case 'deposit':
        return <ArrowDownward color="success" />;
      case 'withdraw':
        return <ArrowUpward color="primary" />;
      case 'borrow':
        return <ArrowUpward color="secondary" />;
      case 'repay':
        return <ArrowDownward color="info" />;
      case 'collateral':
        return <Security color="success" />;
      case 'liquidation':
        return <SwapHoriz color="error" />;
      default:
        return <SwapHoriz color="action" />;
    }
  };
  
  // Get transaction color
  const getTransactionColor = (type) => {
    switch (type) {
      case 'deposit':
        return 'success';
      case 'withdraw':
        return 'primary';
      case 'borrow':
        return 'secondary';
      case 'repay':
        return 'info';
      case 'collateral':
        return 'success';
      case 'liquidation':
        return 'error';
      default:
        return 'default';
    }
  };
  
  // Prepare pie chart data for asset allocation
  const getAssetAllocationData = () => {
    if (!portfolioData || !portfolioData.assets) return null;
    
    const depositedAssets = portfolioData.assets.filter(asset => asset.deposited > 0);
    
    return {
      labels: depositedAssets.map(asset => asset.name),
      datasets: [
        {
          data: depositedAssets.map(asset => asset.deposited * asset.price),
          backgroundColor: [
            '#4caf50',
            '#2196f3',
            '#9c27b0',
            '#ff9800',
            '#f44336',
            '#607d8b',
          ],
          borderWidth: 1,
        },
      ],
    };
  };
  
  // Pie chart options
  const pieOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right',
        labels: {
          boxWidth: 12,
          padding: 15,
        },
      },
      tooltip: {
        callbacks: {
          label: function(context) {
            const value = context.raw;
            const total = context.dataset.data.reduce((a, b) => a + b, 0);
            const percentage = Math.round((value / total) * 100);
            return `${context.label}: ${formatCurrency(value)} (${percentage}%)`;
          }
        }
      }
    },
  };
  
  // Overview component
  const Overview = () => (
    <Grid container spacing={3}>
      {/* Summary stats */}
      <Grid item xs={12} md={4}>
        <StatCard
          title="Total Supplied"
          value={formatCurrency(portfolioData?.totalDeposited || 0)}
          secondaryValue="Earning interest"
          icon={<MonetizationOn fontSize="large" color="success" />}
          loading={loading}
        />
      </Grid>
      <Grid item xs={12} md={4}>
        <StatCard
          title="Total Borrowed"
          value={formatCurrency(portfolioData?.totalBorrowed || 0)}
          secondaryValue="Against collateral"
          icon={<AccountBalanceWallet fontSize="large" color="secondary" />}
          loading={loading}
        />
      </Grid>
      <Grid item xs={12} md={4}>
        <StatCard
          title="Total Collateral"
          value={formatCurrency(portfolioData?.totalCollateral || 0)}
          secondaryValue={userProfile?.identityVerified ? "Identity Verified" : "Identity Not Verified"}
          icon={userProfile?.identityVerified ? <VerifiedUser fontSize="large" color="primary" /> : <Person fontSize="large" color="warning" />}
          loading={loading}
        />
      </Grid>
      
      {/* Asset allocation chart */}
      <Grid item xs={12} md={6}>
        <Paper elevation={2} sx={{ p: 3, borderRadius: 2, height: 350 }}>
          <Typography variant="h6" gutterBottom>
            Asset Allocation
          </Typography>
          <Box sx={{ height: 280, position: 'relative' }}>
            {loading ? (
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                <CircularProgress />
              </Box>
            ) : portfolioData && portfolioData.assets.some(asset => asset.deposited > 0) ? (
              <Pie data={getAssetAllocationData()} options={pieOptions} />
            ) : (
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                <Typography variant="body2" color="text.secondary">
                  No deposited assets to display
                </Typography>
              </Box>
            )}
          </Box>
        </Paper>
      </Grid>
      
      {/* Portfolio history chart */}
      <Grid item xs={12} md={6}>
        <Paper elevation={2} sx={{ p: 3, borderRadius: 2, height: 350 }}>
          <Typography variant="h6" gutterBottom>
            Portfolio Value History
          </Typography>
          <Box sx={{ height: 280, position: 'relative' }}>
            {loading ? (
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                <CircularProgress />
              </Box>
            ) : portfolioHistory ? (
              <Line
                data={{
                  labels: portfolioHistory.labels.slice(-30), // Last 30 days
                  datasets: [
                    {
                      label: 'Deposits',
                      data: portfolioHistory.datasets[0].data.slice(-30),
                      borderColor: '#4caf50',
                      backgroundColor: 'rgba(76, 175, 80, 0.1)',
                      fill: true,
                    },
                  ],
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      display: false,
                    },
                  },
                  scales: {
                    x: {
                      grid: {
                        display: false,
                      },
                    },
                  },
                }}
              />
            ) : (
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                <Typography variant="body2" color="text.secondary">
                  No historical data available
                </Typography>
              </Box>
            )}
          </Box>
        </Paper>
      </Grid>
      
      {/* Recent transactions */}
      <Grid item xs={12}>
        <Paper elevation={2} sx={{ p: 3, borderRadius: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">
              Recent Transactions
            </Typography>
            <Button
              variant="outlined"
              size="small"
              startIcon={<History />}
              disabled={loading || refreshing}
            >
              View All
            </Button>
          </Box>
          
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Type</TableCell>
                  <TableCell>Asset</TableCell>
                  <TableCell align="right">Amount</TableCell>
                  <TableCell>Date</TableCell>
                  <TableCell>Transaction</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  // Skeleton rows
                  Array(3).fill(0).map((_, index) => (
                    <TableRow key={index}>
                      <TableCell colSpan={5}>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 1 }}>
                          <CircularProgress size={20} />
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))
                ) : transactions.length > 0 ? (
                  transactions.slice(0, 5).map((tx, index) => (
                    <TableRow key={index} hover>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          {getTransactionIcon(tx.type)}
                          <Typography variant="body2" sx={{ ml: 1 }}>
                            {formatTransactionType(tx.type)}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={tx.token}
                          size="small"
                          variant="outlined"
                          color={getTransactionColor(tx.type)}
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" fontWeight="medium">
                          {tx.amount} {tx.token}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {formatDate(tx.timestamp)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Tooltip title="View on Explorer">
                          <IconButton size="small" href={`https://explorer.iota.org/transaction/${tx.hash}`} target="_blank">
                            <Launch fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} align="center">
                      <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                        No transactions found
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      </Grid>
    </Grid>
  );
  
  // Supplied Assets component
  const SuppliedAssets = () => (
    <Grid container spacing={3}>
      <Grid item xs={12}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">
            Supplied Assets
          </Typography>
          <Box>
            <Tooltip title="Filter">
              <IconButton size="small" sx={{ mr: 1 }}>
                <FilterList />
              </IconButton>
            </Tooltip>
            <Button
              variant="contained"
              color="primary"
              component={RouterLink}
              to="/deposit"
              startIcon={<MonetizationOn />}
            >
              Supply Asset
            </Button>
          </Box>
        </Box>
        
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : portfolioData && portfolioData.assets.some(asset => asset.deposited > 0) ? (
          <TableContainer component={Paper} sx={{ borderRadius: 2, boxShadow: 1 }}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Asset</TableCell>
                  <TableCell align="right">Balance</TableCell>
                  <TableCell align="right">APY</TableCell>
                  <TableCell align="right">Value</TableCell>
                  <TableCell align="right">Collateral</TableCell>
                  <TableCell></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {portfolioData.assets
                  .filter(asset => asset.deposited > 0)
                  .map((asset, index) => (
                    <TableRow key={index} hover>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <Avatar
                            src={asset.icon}
                            alt={asset.name}
                            sx={{ width: 24, height: 24, mr: 1 }}
                          />
                          <Typography variant="body2" fontWeight="medium">
                            {asset.name}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2">
                          {asset.deposited} {asset.symbol}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" color="success.main" fontWeight="medium">
                          {asset.apy}%
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2">
                          {formatCurrency(asset.deposited * asset.price)}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        {asset.isCollateral ? (
                          <Chip
                            label="Yes"
                            size="small"
                            color="success"
                            variant="outlined"
                          />
                        ) : (
                          <Chip
                            label="No"
                            size="small"
                            color="default"
                            variant="outlined"
                          />
                        )}
                      </TableCell>
                      <TableCell align="right">
                        <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                          <Button
                            variant="outlined"
                            size="small"
                            sx={{ mr: 1 }}
                          >
                            Withdraw
                          </Button>
                          {!asset.isCollateral && (
                            <Button
                              variant="outlined"
                              size="small"
                              color="secondary"
                            >
                              Use as Collateral
                            </Button>
                          )}
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </TableContainer>
        ) : (
          <Paper sx={{ p: 4, textAlign: 'center', borderRadius: 2 }}>
            <Box sx={{ mb: 2 }}>
              <MonetizationOn color="primary" sx={{ fontSize: 48, opacity: 0.5 }} />
            </Box>
            <Typography variant="h6" gutterBottom>
              No Supplied Assets
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              Start supplying assets to earn interest and use as collateral for borrowing.
            </Typography>
            <Button
              variant="contained"
              color="primary"
              component={RouterLink}
              to="/deposit"
            >
              Supply Asset
            </Button>
          </Paper>
        )}
      </Grid>
    </Grid>
  );
  
  // Borrowed Assets component
  const BorrowedAssets = () => (
    <Grid container spacing={3}>
      <Grid item xs={12}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">
            Borrowed Assets
          </Typography>
          <Box>
            <Tooltip title="Filter">
              <IconButton size="small" sx={{ mr: 1 }}>
                <FilterList />
              </IconButton>
            </Tooltip>
            <Button
              variant="contained"
              color="secondary"
              component={RouterLink}
              to="/borrow"
              startIcon={<AccountBalanceWallet />}
            >
              Borrow Asset
            </Button>
          </Box>
        </Box>
        
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : portfolioData && portfolioData.assets.some(asset => asset.borrowed > 0) ? (
          <TableContainer component={Paper} sx={{ borderRadius: 2, boxShadow: 1 }}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Asset</TableCell>
                  <TableCell align="right">Debt</TableCell>
                  <TableCell align="right">APR</TableCell>
                  <TableCell align="right">Value</TableCell>
                  <TableCell></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {portfolioData.assets
                  .filter(asset => asset.borrowed > 0)
                  .map((asset, index) => (
                    <TableRow key={index} hover>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <Avatar
                            src={asset.icon}
                            alt={asset.name}
                            sx={{ width: 24, height: 24, mr: 1 }}
                          />
                          <Typography variant="body2" fontWeight="medium">
                            {asset.name}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2">
                          {asset.borrowed} {asset.symbol}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" color="error.main" fontWeight="medium">
                          {asset.borrowApy}%
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2">
                          {formatCurrency(asset.borrowed * asset.price)}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Button
                          variant="outlined"
                          size="small"
                        >
                          Repay
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </TableContainer>
        ) : (
          <Paper sx={{ p: 4, textAlign: 'center', borderRadius: 2 }}>
            <Box sx={{ mb: 2 }}>
              <AccountBalanceWallet color="secondary" sx={{ fontSize: 48, opacity: 0.5 }} />
            </Box>
            <Typography variant="h6" gutterBottom>
              No Borrowed Assets
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              Put your supplied assets to work by borrowing against your collateral.
            </Typography>
            <Button
              variant="contained"
              color="secondary"
              component={RouterLink}
              to="/borrow"
            >
              Borrow Asset
            </Button>
          </Paper>
        )}
      </Grid>
      
      {/* Health factor card */}
      {portfolioData && portfolioData.assets.some(asset => asset.borrowed > 0) && (
        <Grid item xs={12} md={6}>
          <Card sx={{ p: 3, borderRadius: 2 }}>
            <Typography variant="h6" gutterBottom>
              Health Factor
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', my: 2 }}>
              <Box sx={{ width: '100%', mr: 1 }}>
                <LinearProgress
                  variant="determinate"
                  value={Math.min(userProfile?.healthFactor / 2 * 100, 100)}
                  sx={{ height: 10, borderRadius: 5 }}
                  color={
                    userProfile?.healthFactor >= 1.7
                      ? 'success'
                      : userProfile?.healthFactor >= 1.2
                      ? 'warning'
                      : 'error'
                  }
                />
              </Box>
              <Box sx={{ minWidth: 35 }}>
                <Typography variant="body2" color="text.secondary">
                  {userProfile?.healthFactor.toFixed(2)}
                </Typography>
              </Box>
            </Box>
            <Typography variant="body2" color="text.secondary">
              Your health factor represents the safety of your loan relative to your collateral. A value below 1.0 triggers liquidation.
            </Typography>
          </Card>
        </Grid>
      )}
    </Grid>
  );
  
  // Transaction History component
  const TransactionHistory = () => (
    <Grid container spacing={3}>
      <Grid item xs={12}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">
            Transaction History
          </Typography>
          <Box>
            <Tooltip title="Filter">
              <IconButton size="small">
                <FilterList />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
        
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : transactions.length > 0 ? (
          <TableContainer component={Paper} sx={{ borderRadius: 2, boxShadow: 1 }}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Type</TableCell>
                  <TableCell>Asset</TableCell>
                  <TableCell align="right">Amount</TableCell>
                  <TableCell>Date</TableCell>
                  <TableCell>Transaction</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {transactions.map((tx, index) => (
                  <TableRow key={index} hover>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        {getTransactionIcon(tx.type)}
                        <Typography variant="body2" sx={{ ml: 1 }}>
                          {formatTransactionType(tx.type)}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={tx.token}
                        size="small"
                        variant="outlined"
                        color={getTransactionColor(tx.type)}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" fontWeight="medium">
                        {tx.amount} {tx.token}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {formatDate(tx.timestamp)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Tooltip title="View on Explorer">
                        <IconButton size="small" href={`https://explorer.iota.org/transaction/${tx.hash}`} target="_blank">
                          <Launch fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        ) : (
          <Paper sx={{ p: 4, textAlign: 'center', borderRadius: 2 }}>
            <Box sx={{ mb: 2 }}>
              <History color="action" sx={{ fontSize: 48, opacity: 0.5 }} />
            </Box>
            <Typography variant="h6" gutterBottom>
              No Transaction History
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Your transaction history will appear here once you start using the platform.
            </Typography>
          </Paper>
        )}
      </Grid>
    </Grid>
  );
  
  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <LoadingBackdrop open={loading} message="Loading portfolio data..." />
      
      {/* Page header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Portfolio
        </Typography>
        <Tooltip title="Refresh data">
          <IconButton onClick={handleRefresh} disabled={refreshing || loading}>
            {refreshing ? <CircularProgress size={24} /> : <Refresh />}
          </IconButton>
        </Tooltip>
      </Box>
      
      {/* User info */}
      <Paper elevation={2} sx={{ p: 3, borderRadius: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item>
            <Avatar
              sx={{
                bgcolor: 'primary.main',
                width: 48,
                height: 48,
              }}
            >
              {currentAccount ? currentAccount.substring(2, 4).toUpperCase() : 'U'}
            </Avatar>
          </Grid>
          <Grid item xs>
            <Typography variant="h6">
              {currentAccount ? `${currentAccount.substring(0, 6)}...${currentAccount.substring(currentAccount.length - 4)}` : 'Loading...'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {userProfile?.identityVerified ? (
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <VerifiedUser fontSize="small" color="success" sx={{ mr: 0.5 }} />
                  Identity Verified
                </Box>
              ) : 'Identity Not Verified'}
            </Typography>
          </Grid>
          <Grid item>
            <Button
              variant="outlined"
              startIcon={<Settings />}
              component={RouterLink}
              to="/settings"
            >
              Settings
            </Button>
          </Grid>
        </Grid>
      </Paper>
      
      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs 
          value={tabValue} 
          onChange={handleTabChange}
          variant={isMobile ? "scrollable" : "standard"}
          scrollButtons={isMobile ? "auto" : undefined}
        >
          <Tab label="Overview" />
          <Tab label="Supplied Assets" />
          <Tab label="Borrowed Assets" />
          <Tab label="Transaction History" />
        </Tabs>
      </Box>
      
      {/* Tab content */}
      <Box sx={{ mb: 4 }}>
        {tabValue === 0 && <Overview />}
        {tabValue === 1 && <SuppliedAssets />}
        {tabValue === 2 && <BorrowedAssets />}
        {tabValue === 3 && <TransactionHistory />}
      </Box>
    </Container>
  );
};

export default PortfolioPage;
