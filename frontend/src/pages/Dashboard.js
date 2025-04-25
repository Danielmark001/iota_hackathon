import React, { useState, useEffect } from 'react';
import { 
  Container, 
  Grid, 
  Typography, 
  Box, 
  Button, 
  Card, 
  Divider,
  IconButton, 
  Tooltip,
  useTheme,
  useMediaQuery
} from '@mui/material';
import { 
  MonetizationOn, 
  AccountBalanceWallet, 
  Security, 
  TrendingUp, 
  Refresh,
  ArrowForward 
} from '@mui/icons-material';
import { Link as RouterLink } from 'react-router-dom';

// Components
import StatCard from '../components/dashboard/StatCard';
import RiskScoreGauge from '../components/dashboard/RiskScoreGauge';
import ActivityChart from '../components/dashboard/ActivityChart';
import RecommendationCard from '../components/dashboard/RecommendationCard';
import HealthFactorCard from '../components/dashboard/HealthFactorCard';
import MarketStats from '../components/dashboard/MarketStats';
import LoadingBackdrop from '../components/ui/LoadingBackdrop';

// Contexts
import { useWeb3 } from '../context/Web3Context';
import { useSnackbar } from '../context/SnackbarContext';

// Services
import apiService from '../services/apiService';

const Dashboard = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { currentAccount } = useWeb3();
  const { showSnackbar } = useSnackbar();
  
  // Component state
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userProfile, setUserProfile] = useState(null);
  const [marketData, setMarketData] = useState(null);
  const [historyData, setHistoryData] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [marketAssets, setMarketAssets] = useState([]);
  
  // Format currency for display
  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  };
  
  // Load dashboard data on component mount
  useEffect(() => {
    const loadDashboardData = async () => {
      if (!currentAccount) return;
      
      setLoading(true);
      try {
        // Fetch data in parallel
        const [profileData, marketData, historyData, recommendationsData, assetsData] = await Promise.all([
          apiService.getUserProfile(currentAccount),
          apiService.getMarketData(),
          apiService.getHistoricalData(currentAccount),
          apiService.getMockRecommendations(), // Use mock data for now
          apiService.getMarketAssets()
        ]);
        
        setUserProfile(profileData);
        setMarketData(marketData);
        setHistoryData(historyData);
        setRecommendations(recommendationsData);
        setMarketAssets(assetsData);
      } catch (error) {
        console.error('Error loading dashboard data:', error);
        showSnackbar('Failed to load dashboard data. Please try again.', 'error');
        
        // Set demo data for development if API fails
        setUserProfile({
          address: currentAccount,
          deposits: 1500,
          borrows: 800,
          collateral: 2000,
          riskScore: 45,
          interestRate: 7.5,
          healthFactor: 1.8,
          identityVerified: false
        });
        
        // Demo market data
        setMarketData({
          totalDeposits: 500000,
          totalBorrows: 350000,
          totalCollateral: 750000,
          utilizationRate: 70
        });
      } finally {
        setLoading(false);
      }
    };
    
    loadDashboardData();
  }, [currentAccount, showSnackbar]);
  
  // Handler for manual refresh
  const handleRefresh = async () => {
    if (refreshing) return;
    
    setRefreshing(true);
    try {
      // Same loading logic as above but with different state variable
      const [profileData, marketData, historyData, recommendationsData, assetsData] = await Promise.all([
        apiService.getUserProfile(currentAccount),
        apiService.getMarketData(),
        apiService.getHistoricalData(currentAccount),
        apiService.getMockRecommendations(),
        apiService.getMarketAssets()
      ]);
      
      setUserProfile(profileData);
      setMarketData(marketData);
      setHistoryData(historyData);
      setRecommendations(recommendationsData);
      setMarketAssets(assetsData);
      
      showSnackbar('Dashboard updated successfully', 'success');
    } catch (error) {
      console.error('Error refreshing dashboard data:', error);
      showSnackbar('Failed to refresh dashboard data', 'error');
    } finally {
      setRefreshing(false);
    }
  };
  
  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      {/* Loading overlay */}
      <LoadingBackdrop open={loading} message="Loading dashboard..." />
      
      {/* Dashboard header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Dashboard
        </Typography>
        <Box>
          <Tooltip title="Refresh data">
            <IconButton onClick={handleRefresh} disabled={refreshing || loading}>
              <Refresh />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>
      
      {/* Overview stats row */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Total Deposited"
            value={userProfile ? formatCurrency(userProfile.deposits) : '$0.00'}
            secondaryValue="IOTA Lending Pool"
            icon={<MonetizationOn fontSize="large" />}
            loading={loading}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Total Borrowed"
            value={userProfile ? formatCurrency(userProfile.borrows) : '$0.00'}
            secondaryValue={userProfile ? `${userProfile.interestRate}% APR` : '0% APR'}
            icon={<AccountBalanceWallet fontSize="large" />}
            loading={loading}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Collateral"
            value={userProfile ? formatCurrency(userProfile.collateral) : '$0.00'}
            secondaryValue="IOTA + sIOTA"
            icon={<Security fontSize="large" />}
            loading={loading}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Market APY"
            value={`5.2%`}
            secondaryValue="Supply APY"
            icon={<TrendingUp fontSize="large" />}
            loading={loading}
            gradient={true}
            gradientType="success"
          />
        </Grid>
      </Grid>
      
      {/* Main dashboard content */}
      <Grid container spacing={3}>
        {/* Left column - Risk assessment and Health factor */}
        <Grid item xs={12} md={4}>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <RiskScoreGauge score={userProfile?.riskScore || 0} loading={loading} />
            </Grid>
            <Grid item xs={12}>
              <HealthFactorCard healthFactor={userProfile?.healthFactor || 0} loading={loading} />
            </Grid>
          </Grid>
        </Grid>
        
        {/* Middle column - Chart and Action buttons */}
        <Grid item xs={12} md={5}>
          <Card elevation={2} sx={{ borderRadius: 2, mb: 3, overflow: 'hidden' }}>
            <ActivityChart data={historyData} loading={loading} />
          </Card>
          
          {/* Quick actions */}
          <Grid container spacing={2}>
            <Grid item xs={6} sm={3}>
              <Button
                variant="contained"
                color="primary"
                fullWidth
                component={RouterLink}
                to="/deposit"
                startIcon={<MonetizationOn />}
                sx={{ py: 1.5 }}
              >
                Deposit
              </Button>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Button
                variant="contained"
                color="secondary"
                fullWidth
                component={RouterLink}
                to="/borrow"
                startIcon={<AccountBalanceWallet />}
                sx={{ py: 1.5 }}
              >
                Borrow
              </Button>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Button
                variant="outlined"
                color="primary"
                fullWidth
                component={RouterLink}
                to="/identity"
                startIcon={<Security />}
                sx={{ py: 1.5 }}
              >
                Identity
              </Button>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Button
                variant="outlined"
                color="secondary"
                fullWidth
                component={RouterLink}
                to="/risk"
                startIcon={<TrendingUp />}
                sx={{ py: 1.5 }}
              >
                Risk
              </Button>
            </Grid>
          </Grid>
        </Grid>
        
        {/* Right column - Recommendations */}
        <Grid item xs={12} md={3}>
          <RecommendationCard recommendations={recommendations} loading={loading} />
        </Grid>
        
        {/* Market stats (full width) */}
        <Grid item xs={12}>
          <Typography variant="h5" sx={{ mt: 2, mb: 2 }}>
            Market Overview
          </Typography>
          <MarketStats data={marketAssets} loading={loading} />
        </Grid>
      </Grid>
    </Container>
  );
};

export default Dashboard;
