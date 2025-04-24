import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Container, 
  Grid, 
  Typography, 
  Paper, 
  Box, 
  Button, 
  CircularProgress,
  Tabs,
  Tab,
  Divider,
  useTheme,
  alpha
} from '@mui/material';
import { 
  AccountBalanceWallet, 
  ShowChart, 
  SwapHoriz, 
  History,
  TrendingUp,
  Security,
  BarChart,
  Warning
} from '@mui/icons-material';
import { formatEther, formatUnits, parseUnits } from 'ethers/lib/utils';

// Custom components
import RiskScoreGauge from '../components/risk/RiskScoreGauge';
import AssetAllocation from '../components/dashboard/AssetAllocation';
import PositionsList from '../components/dashboard/PositionsList';
import TransactionHistory from '../components/dashboard/TransactionHistory';
import RiskAssessmentCard from '../components/risk/RiskAssessmentCard';
import MarketOverview from '../components/markets/MarketOverview';
import HealthFactorIndicator from '../components/dashboard/HealthFactorIndicator';
import ActionButtons from '../components/dashboard/ActionButtons';
import AdjustableInterestCard from '../components/dashboard/AdjustableInterestCard';
import RecommendationsList from '../components/risk/RecommendationsList';
import LoadingOverlay from '../components/common/LoadingOverlay';
import ErrorAlert from '../components/common/ErrorAlert';

// Hooks and services
import { useAccount } from '../hooks/useAccount';
import { useRiskAssessment } from '../hooks/useRiskAssessment';
import { useMarkets } from '../hooks/useMarkets';
import { useTransactionHistory } from '../hooks/useTransactionHistory';
import { useWeb3 } from '../hooks/useWeb3';
import { formatCurrency, shortenAddress, calculateAPY } from '../utils/formatters';

const Dashboard = () => {
  const { address } = useParams();
  const navigate = useNavigate();
  const theme = useTheme();
  const { connected, account } = useWeb3();
  const [tabValue, setTabValue] = useState(0);
  
  // Custom hooks for data fetching
  const { 
    accountData, 
    positions, 
    loading: accountLoading, 
    error: accountError,
    refetch: refetchAccount
  } = useAccount(address);
  
  const { 
    riskAssessment, 
    loading: riskLoading, 
    error: riskError 
  } = useRiskAssessment(address);
  
  const { 
    markets, 
    loading: marketsLoading, 
    error: marketsError 
  } = useMarkets();
  
  const { 
    transactions, 
    loading: txLoading, 
    error: txError 
  } = useTransactionHistory(address);
  
  // Derived state
  const isLoading = accountLoading || riskLoading || marketsLoading;
  const hasError = accountError || riskError || marketsError;
  const isOwner = connected && account?.toLowerCase() === address?.toLowerCase();
  
  // Wallet and position metrics
  const totalDeposited = positions?.deposits?.reduce(
    (sum, deposit) => sum + parseFloat(deposit.amountUSD || 0), 
    0
  ) || 0;
  
  const totalBorrowed = positions?.borrows?.reduce(
    (sum, borrow) => sum + parseFloat(borrow.amountUSD || 0), 
    0
  ) || 0;
  
  const depositAPY = positions?.deposits?.reduce((sum, deposit) => {
    const market = markets?.find(m => m.assetAddress === deposit.assetAddress);
    const apy = market ? parseFloat(market.liquidityRate) : 0;
    return sum + (apy * parseFloat(deposit.amountUSD || 0));
  }, 0) / (totalDeposited || 1);
  
  const borrowAPY = positions?.borrows?.reduce((sum, borrow) => {
    const market = markets?.find(m => m.assetAddress === borrow.assetAddress);
    const apy = borrow.interestRateType === 'stable' 
      ? parseFloat(market?.stableBorrowRate || 0)
      : parseFloat(market?.variableBorrowRate || 0);
    return sum + (apy * parseFloat(borrow.amountUSD || 0));
  }, 0) / (totalBorrowed || 1);
  
  // Handle tab change
  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };
  
  // Effect to redirect if no address provided
  useEffect(() => {
    if (!address && connected) {
      navigate(`/dashboard/${account}`);
    }
  }, [address, connected, account, navigate]);
  
  if (!address) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Typography variant="h5" align="center" color="textSecondary" paragraph>
          Please connect your wallet to view your dashboard
        </Typography>
      </Container>
    );
  }
  
  if (hasError) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <ErrorAlert 
          title="Error Loading Dashboard" 
          message={accountError || riskError || marketsError} 
          onRetry={refetchAccount}
        />
      </Container>
    );
  }
  
  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 8 }}>
      {isLoading ? (
        <LoadingOverlay message="Loading dashboard data..." />
      ) : (
        <>
          {/* Header */}
          <Grid container spacing={3} alignItems="center" sx={{ mb: 4 }}>
            <Grid item xs={12} md={8}>
              <Box display="flex" alignItems="center">
                <AccountBalanceWallet 
                  sx={{ fontSize: 40, mr: 2, color: theme.palette.primary.main }} 
                />
                <Box>
                  <Typography variant="h4" component="h1" gutterBottom>
                    Wallet Dashboard
                  </Typography>
                  <Typography variant="body1" color="textSecondary">
                    {shortenAddress(address)}
                  </Typography>
                </Box>
              </Box>
            </Grid>
            <Grid item xs={12} md={4} sx={{ textAlign: { xs: 'left', md: 'right' } }}>
              {isOwner && (
                <ActionButtons address={address} refetch={refetchAccount} />
              )}
            </Grid>
          </Grid>
          
          {/* Summary Cards */}
          <Grid container spacing={3} sx={{ mb: 4 }}>
            <Grid item xs={12} md={6} lg={3}>
              <Paper
                elevation={2}
                sx={{
                  p: 3,
                  display: 'flex',
                  flexDirection: 'column',
                  borderRadius: 2,
                  height: '100%',
                  borderLeft: `4px solid ${theme.palette.primary.main}`
                }}
              >
                <Typography variant="h6" color="textSecondary" gutterBottom>
                  Net Worth
                </Typography>
                <Typography variant="h4" component="div" sx={{ mb: 1 }}>
                  {formatCurrency(totalDeposited - totalBorrowed)}
                </Typography>
                <Box display="flex" justifyContent="space-between" alignItems="center">
                  <Typography variant="body2" color="textSecondary">
                    Supplied: {formatCurrency(totalDeposited)}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Borrowed: {formatCurrency(totalBorrowed)}
                  </Typography>
                </Box>
              </Paper>
            </Grid>
            
            <Grid item xs={12} md={6} lg={3}>
              <Paper
                elevation={2}
                sx={{
                  p: 3,
                  display: 'flex',
                  flexDirection: 'column',
                  borderRadius: 2,
                  height: '100%',
                  borderLeft: `4px solid ${theme.palette.secondary.main}`
                }}
              >
                <Typography variant="h6" color="textSecondary" gutterBottom>
                  Available to Borrow
                </Typography>
                <Typography variant="h4" component="div" sx={{ mb: 1 }}>
                  {formatCurrency(parseFloat(accountData?.availableBorrowsUSD || 0))}
                </Typography>
                <Box display="flex" justifyContent="space-between" alignItems="center">
                  <Typography variant="body2" color="textSecondary">
                    Collateral: {formatCurrency(parseFloat(accountData?.totalCollateralUSD || 0))}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    LTV: {(parseFloat(accountData?.currentLtv || 0)).toFixed(2)}%
                  </Typography>
                </Box>
              </Paper>
            </Grid>
            
            <Grid item xs={12} sm={6} lg={3}>
              <Paper
                elevation={2}
                sx={{
                  p: 3,
                  display: 'flex',
                  flexDirection: 'column',
                  borderRadius: 2,
                  height: '100%',
                  borderLeft: `4px solid ${totalDeposited > 0 ? theme.palette.success.main : alpha(theme.palette.text.secondary, 0.5)}`
                }}
              >
                <Typography variant="h6" color="textSecondary" gutterBottom>
                  Supply APY
                </Typography>
                <Typography variant="h4" component="div" sx={{ mb: 1 }}>
                  {totalDeposited > 0 ? `${depositAPY.toFixed(2)}%` : '0.00%'}
                </Typography>
                <Box display="flex" justifyContent="space-between" alignItems="center">
                  <Typography variant="body2" color="textSecondary">
                    Assets: {positions?.deposits?.length || 0}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Total: {formatCurrency(totalDeposited)}
                  </Typography>
                </Box>
              </Paper>
            </Grid>
            
            <Grid item xs={12} sm={6} lg={3}>
              <Paper
                elevation={2}
                sx={{
                  p: 3,
                  display: 'flex',
                  flexDirection: 'column',
                  borderRadius: 2,
                  height: '100%',
                  borderLeft: `4px solid ${totalBorrowed > 0 ? theme.palette.error.main : alpha(theme.palette.text.secondary, 0.5)}`
                }}
              >
                <Typography variant="h6" color="textSecondary" gutterBottom>
                  Borrow APY
                </Typography>
                <Typography variant="h4" component="div" sx={{ mb: 1 }}>
                  {totalBorrowed > 0 ? `${borrowAPY.toFixed(2)}%` : '0.00%'}
                </Typography>
                <Box display="flex" justifyContent="space-between" alignItems="center">
                  <Typography variant="body2" color="textSecondary">
                    Assets: {positions?.borrows?.length || 0}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Total: {formatCurrency(totalBorrowed)}
                  </Typography>
                </Box>
              </Paper>
            </Grid>
          </Grid>
          
          {/* Health Factor */}
          <Grid container spacing={3} sx={{ mb: 4 }}>
            <Grid item xs={12}>
              <Paper elevation={2} sx={{ p: 3, borderRadius: 2 }}>
                <Grid container spacing={3} alignItems="center">
                  <Grid item xs={12} md={4}>
                    <Typography variant="h6" gutterBottom>
                      Health Factor
                    </Typography>
                    <Box sx={{ mb: 2 }}>
                      <HealthFactorIndicator 
                        healthFactor={accountData?.healthFactor} 
                        showLabel 
                        size="large" 
                      />
                    </Box>
                    <Typography variant="body2" color="textSecondary">
                      Health factor represents the safety of your loan against liquidation. 
                      Keep it above 1 to avoid liquidation.
                    </Typography>
                  </Grid>
                  
                  <Grid item xs={12} md={4} sx={{ textAlign: 'center' }}>
                    <RiskScoreGauge 
                      score={riskAssessment?.riskScore || 50} 
                      size={180}
                      showLabel
                    />
                    <Typography variant="body2" sx={{ mt: 1 }}>
                      {riskAssessment?.riskClass || 'Medium Risk'}
                    </Typography>
                  </Grid>
                  
                  <Grid item xs={12} md={4}>
                    <AdjustableInterestCard 
                      currentScore={riskAssessment?.riskScore || 50}
                      baseRate={3.5}
                      address={address}
                      readOnly={!isOwner}
                    />
                  </Grid>
                </Grid>
              </Paper>
            </Grid>
          </Grid>
          
          {/* Main Tab Content */}
          <Paper elevation={2} sx={{ borderRadius: 2, mb: 4 }}>
            <Tabs
              value={tabValue}
              onChange={handleTabChange}
              indicatorColor="primary"
              textColor="primary"
              variant="fullWidth"
              sx={{ borderBottom: 1, borderColor: 'divider' }}
            >
              <Tab icon={<ShowChart />} label="Your Positions" />
              <Tab icon={<TrendingUp />} label="Markets" />
              <Tab icon={<History />} label="History" />
              <Tab icon={<Security />} label="Risk Analysis" />
            </Tabs>
            
            <Box sx={{ p: 3 }}>
              {tabValue === 0 && (
                <Grid container spacing={3}>
                  <Grid item xs={12} md={7}>
                    <PositionsList 
                      positions={positions} 
                      address={address} 
                      markets={markets}
                      isOwner={isOwner}
                      refetch={refetchAccount}
                    />
                  </Grid>
                  <Grid item xs={12} md={5}>
                    <AssetAllocation 
                      deposits={positions?.deposits || []} 
                      borrows={positions?.borrows || []} 
                    />
                  </Grid>
                </Grid>
              )}
              
              {tabValue === 1 && (
                <MarketOverview 
                  markets={markets} 
                  address={address}
                  userPositions={positions}
                  riskScore={riskAssessment?.riskScore}
                />
              )}
              
              {tabValue === 2 && (
                <TransactionHistory 
                  transactions={transactions?.transactions || []} 
                  loading={txLoading}
                  error={txError}
                  address={address}
                />
              )}
              
              {tabValue === 3 && (
                <Grid container spacing={3}>
                  <Grid item xs={12} md={6}>
                    <RiskAssessmentCard 
                      riskAssessment={riskAssessment} 
                      address={address}
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <RecommendationsList 
                      recommendations={riskAssessment?.recommendations || []} 
                      riskFactors={riskAssessment?.riskFactors || []}
                      address={address}
                    />
                  </Grid>
                </Grid>
              )}
            </Box>
          </Paper>
        </>
      )}
    </Container>
  );
};

export default Dashboard;
