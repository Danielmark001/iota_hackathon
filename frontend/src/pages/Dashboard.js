import React, { useEffect, useState } from 'react';
import { 
  Box, 
  Typography, 
  Grid, 
  Card, 
  CardContent, 
  CardHeader,
  Divider,
  Button,
  CircularProgress,
  useTheme,
  alpha,
  Chip,
  useMediaQuery
} from '@mui/material';
import { 
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  AccountBalance as AccountBalanceIcon,
  ShowChart as ShowChartIcon,
  Wallet as WalletIcon,
  MoreVert as MoreVertIcon
} from '@mui/icons-material';
import { useWeb3 } from '../context/Web3Context';
import ConnectionErrorFallback from '../components/ui/ConnectionErrorFallback';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useNavigate } from 'react-router-dom';

// Mock market data
const mockMarketData = [
  { name: 'IOTA', symbol: 'MIOTA', price: 0.2687, change: 2.34, volume: '12.4M', tvl: '3.2M' },
  { name: 'Ethereum', symbol: 'ETH', price: 1850.42, change: -0.76, volume: '824M', tvl: '58.7M' },
  { name: 'USDT', symbol: 'USDT', price: 1.00, change: 0.01, volume: '432M', tvl: '28.1M' },
  { name: 'USDC', symbol: 'USDC', price: 1.00, change: 0.00, volume: '341M', tvl: '21.5M' },
];

// Mock portfolio data
const mockPortfolioData = {
  totalValue: 1287.34,
  totalDebt: 450.78,
  netWorth: 836.56,
  healthFactor: 2.86,
  assets: [
    { name: 'IOTA', amount: 4500, value: 1209.15 },
    { name: 'ETH', amount: 0.042, value: 78.19 },
  ],
  loans: [
    { name: 'USDT', amount: 450.78, interestRate: 3.2 }
  ]
};

// Mock chart data
const mockChartData = [
  { name: 'May 1', tvl: 1.2, users: 204 },
  { name: 'May 2', tvl: 1.5, users: 215 },
  { name: 'May 3', tvl: 1.8, users: 250 },
  { name: 'May 4', tvl: 2.3, users: 284 },
  { name: 'May 5', tvl: 2.7, users: 302 },
  { name: 'May 6', tvl: 3.1, users: 319 },
  { name: 'May 7', tvl: 3.2, users: 335 },
];

// Mock recent activity
const mockActivity = [
  { type: 'Deposit', asset: 'IOTA', amount: 1500, timestamp: '2025-04-27T10:23:45Z', txHash: '0x1a2b3c...' },
  { type: 'Borrow', asset: 'USDT', amount: 300, timestamp: '2025-04-26T18:12:30Z', txHash: '0x4d5e6f...' },
  { type: 'Repay', asset: 'USDT', amount: 50, timestamp: '2025-04-25T09:45:12Z', txHash: '0x7g8h9i...' },
];

const Dashboard = () => {
  const { connectionError, connectWallet, isConnected, useMockData } = useWeb3();
  const [isLoading, setIsLoading] = useState(true);
  const theme = useTheme();
  const navigate = useNavigate();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isTablet = useMediaQuery(theme.breakpoints.down('lg'));

  useEffect(() => {
    // Simulate data loading
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 1000);
    
    return () => clearTimeout(timer);
  }, []);

  if (connectionError) {
    return <ConnectionErrorFallback onRetry={connectWallet} />;
  }

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
        <Box sx={{ mb: isMobile ? 2 : 0 }}>
          <Typography variant="h4" component="h1" fontWeight={700} gutterBottom>
            Dashboard
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Welcome to IntelliLend - AI-Powered DeFi Lending Platform on IOTA
          </Typography>
        </Box>
        {!isConnected && (
          <Button 
            variant="contained" 
            startIcon={<WalletIcon />}
            onClick={connectWallet}
            sx={{ borderRadius: '10px', px: 3 }}
          >
            Connect Wallet
          </Button>
        )}
      </Box>
      
      <Grid container spacing={3}>
        {/* Portfolio Summary */}
        <Grid item xs={12} lg={8}>
          <Card 
            elevation={0}
            sx={{ 
              borderRadius: 3, 
              border: `1px solid ${theme.palette.divider}`,
              height: '100%'
            }}
          >
            <CardHeader 
              title="Your Portfolio" 
              titleTypographyProps={{ variant: 'h6', fontWeight: 600 }}
              action={
                <Button size="small" variant="outlined" sx={{ borderRadius: 2 }}>
                  View Details
                </Button>
              }
            />
            <Divider />
            <CardContent>
              {isConnected || useMockData ? (
                <Box>
                  <Grid container spacing={3} sx={{ mb: 2 }}>
                    <Grid item xs={12} sm={6} md={3}>
                      <Box sx={{ p: 2, bgcolor: 'background.subtle', borderRadius: 2 }}>
                        <Typography variant="caption" color="text.secondary">
                          Total Supply
                        </Typography>
                        <Typography variant="h6" fontWeight={600}>
                          ${mockPortfolioData.totalValue.toFixed(2)}
                        </Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <Box sx={{ p: 2, bgcolor: 'background.subtle', borderRadius: 2 }}>
                        <Typography variant="caption" color="text.secondary">
                          Total Borrows
                        </Typography>
                        <Typography variant="h6" fontWeight={600}>
                          ${mockPortfolioData.totalDebt.toFixed(2)}
                        </Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <Box sx={{ p: 2, bgcolor: 'background.subtle', borderRadius: 2 }}>
                        <Typography variant="caption" color="text.secondary">
                          Net Worth
                        </Typography>
                        <Typography variant="h6" fontWeight={600}>
                          ${mockPortfolioData.netWorth.toFixed(2)}
                        </Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <Box sx={{ p: 2, bgcolor: 'background.subtle', borderRadius: 2 }}>
                        <Typography variant="caption" color="text.secondary">
                          Health Factor
                        </Typography>
                        <Typography 
                          variant="h6" 
                          fontWeight={600}
                          color={mockPortfolioData.healthFactor > 1.5 ? 'success.main' : 'error.main'}
                        >
                          {mockPortfolioData.healthFactor.toFixed(2)}
                        </Typography>
                      </Box>
                    </Grid>
                  </Grid>
                  
                  <Box sx={{ mt: 3 }}>
                    <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                      Your Assets
                    </Typography>
                    <Box sx={{ 
                      display: 'flex', 
                      gap: 2, 
                      flexWrap: 'wrap',
                      mt: 1
                    }}>
                      {mockPortfolioData.assets.map((asset) => (
                        <Box 
                          key={asset.name}
                          sx={{ 
                            p: 2,
                            bgcolor: alpha(theme.palette.primary.main, 0.05),
                            borderRadius: 2,
                            minWidth: 180
                          }}
                        >
                          <Typography variant="body2" fontWeight={500} gutterBottom>
                            {asset.name}
                          </Typography>
                          <Typography variant="h6" fontWeight={600}>
                            {asset.amount.toLocaleString()}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            ${asset.value.toFixed(2)}
                          </Typography>
                        </Box>
                      ))}
                    </Box>
                  </Box>
                </Box>
              ) : (
                <Box 
                  sx={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    py: 4
                  }}
                >
                  <WalletIcon sx={{ fontSize: 48, color: 'primary.main', mb: 2, opacity: 0.7 }} />
                  <Typography variant="body1" gutterBottom>
                    Connect your wallet to view your portfolio
                  </Typography>
                  <Button 
                    variant="outlined" 
                    onClick={connectWallet}
                    sx={{ mt: 2, borderRadius: '10px' }}
                  >
                    Connect Wallet
                  </Button>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
        
        {/* Market Overview */}
        <Grid item xs={12} lg={4}>
          <Card 
            elevation={0}
            sx={{ 
              borderRadius: 3, 
              border: `1px solid ${theme.palette.divider}`,
              height: '100%'
            }}
          >
            <CardHeader 
              title="Market Overview" 
              titleTypographyProps={{ variant: 'h6', fontWeight: 600 }}
            />
            <Divider />
            <CardContent>
              <Box>
                {mockMarketData.map((token, index) => (
                  <Box 
                    key={token.symbol}
                    sx={{ 
                      py: 1.5,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      borderBottom: index < mockMarketData.length - 1 ? `1px solid ${alpha(theme.palette.divider, 0.5)}` : 'none',
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <Box sx={{ mr: 2 }}>
                        <Typography variant="body2" fontWeight={600}>
                          {token.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {token.symbol}
                        </Typography>
                      </Box>
                    </Box>
                    <Box sx={{ textAlign: 'right' }}>
                      <Typography variant="body2" fontWeight={600}>
                        ${token.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                        {token.change > 0 ? (
                          <TrendingUpIcon 
                            fontSize="small" 
                            sx={{ 
                              fontSize: '0.9rem',
                              color: 'success.main',
                              mr: 0.5
                            }} 
                          />
                        ) : token.change < 0 ? (
                          <TrendingDownIcon 
                            fontSize="small" 
                            sx={{ 
                              fontSize: '0.9rem',
                              color: 'error.main',
                              mr: 0.5
                            }} 
                          />
                        ) : null}
                        <Typography 
                          variant="caption" 
                          color={token.change > 0 ? 'success.main' : token.change < 0 ? 'error.main' : 'text.secondary'}
                        >
                          {token.change > 0 ? '+' : ''}{token.change}%
                        </Typography>
                      </Box>
                    </Box>
                  </Box>
                ))}
              </Box>
              <Button 
                fullWidth 
                variant="outlined" 
                sx={{ mt: 2, borderRadius: 2 }}
                onClick={() => navigate('/market')}
              >
                View All Markets
              </Button>
            </CardContent>
          </Card>
        </Grid>
        
        {/* Platform Stats */}
        <Grid item xs={12} md={8}>
          <Card 
            elevation={0}
            sx={{ 
              borderRadius: 3, 
              border: `1px solid ${theme.palette.divider}`,
            }}
          >
            <CardHeader 
              title="Platform Statistics" 
              titleTypographyProps={{ variant: 'h6', fontWeight: 600 }}
              action={
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Chip 
                    label="TVL" 
                    size="small" 
                    sx={{ 
                      bgcolor: alpha(theme.palette.primary.main, 0.1),
                      color: theme.palette.primary.main,
                      fontWeight: 600
                    }} 
                  />
                  <Chip 
                    label="Users" 
                    size="small" 
                    variant="outlined"
                    sx={{ fontWeight: 600 }} 
                  />
                </Box>
              }
            />
            <Divider />
            <CardContent>
              <Box sx={{ height: 250 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={mockChartData}
                    margin={{
                      top: 5,
                      right: 30,
                      left: 20,
                      bottom: 5,
                    }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke={alpha(theme.palette.divider, 0.7)} />
                    <XAxis 
                      dataKey="name" 
                      stroke={theme.palette.text.secondary}
                      tick={{ fontSize: 12 }}
                    />
                    <YAxis 
                      yAxisId="left"
                      stroke={theme.palette.primary.main}
                      tick={{ fontSize: 12 }}
                    />
                    <YAxis 
                      yAxisId="right"
                      orientation="right"
                      stroke={theme.palette.secondary.main}
                      tick={{ fontSize: 12 }}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: theme.palette.background.paper,
                        border: `1px solid ${theme.palette.divider}`,
                        borderRadius: 8
                      }}
                    />
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="tvl"
                      name="TVL (millions)"
                      stroke={theme.palette.primary.main}
                      strokeWidth={2}
                      dot={{ r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="users"
                      name="Active Users"
                      stroke={theme.palette.secondary.main}
                      strokeWidth={2}
                      dot={{ r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        {/* Recent Activity */}
        <Grid item xs={12} md={4}>
          <Card 
            elevation={0}
            sx={{ 
              borderRadius: 3, 
              border: `1px solid ${theme.palette.divider}`,
              height: '100%'
            }}
          >
            <CardHeader 
              title="Recent Activity" 
              titleTypographyProps={{ variant: 'h6', fontWeight: 600 }}
              action={
                <Button size="small" variant="text">
                  View All
                </Button>
              }
            />
            <Divider />
            <CardContent>
              {isConnected || useMockData ? (
                <Box>
                  {mockActivity.map((activity, index) => (
                    <Box 
                      key={index}
                      sx={{ 
                        py: 1.5,
                        display: 'flex',
                        borderBottom: index < mockActivity.length - 1 ? `1px solid ${alpha(theme.palette.divider, 0.5)}` : 'none',
                      }}
                    >
                      <Box 
                        sx={{ 
                          width: 40,
                          height: 40,
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          bgcolor: alpha(
                            activity.type === 'Deposit' 
                              ? theme.palette.success.main 
                              : activity.type === 'Borrow' 
                                ? theme.palette.warning.main 
                                : theme.palette.info.main,
                            0.1
                          ),
                          color: activity.type === 'Deposit' 
                            ? theme.palette.success.main 
                            : activity.type === 'Borrow' 
                              ? theme.palette.warning.main 
                              : theme.palette.info.main,
                          mr: 2
                        }}
                      >
                        {activity.type === 'Deposit' && <TrendingUpIcon />}
                        {activity.type === 'Borrow' && <AccountBalanceIcon />}
                        {activity.type === 'Repay' && <ShowChartIcon />}
                      </Box>
                      <Box sx={{ flex: 1 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Typography variant="body2" fontWeight={600}>
                            {activity.type}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {new Date(activity.timestamp).toLocaleDateString()}
                          </Typography>
                        </Box>
                        <Typography variant="body2">
                          {activity.amount} {activity.asset}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Tx: {activity.txHash}
                        </Typography>
                      </Box>
                    </Box>
                  ))}
                </Box>
              ) : (
                <Box 
                  sx={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    py: 4
                  }}
                >
                  <Typography variant="body2" color="text.secondary" textAlign="center">
                    Connect your wallet to view your recent activity
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Dashboard;