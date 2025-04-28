import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Paper,
  Typography,
  Slider,
  TextField,
  Button,
  Tabs,
  Tab,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Divider,
  CircularProgress,
  IconButton,
  Tooltip,
  Switch,
  FormControlLabel,
  Alert,
  useTheme,
  alpha,
  Stack
} from '@mui/material';
import {
  PlayArrow as PlayArrowIcon,
  Refresh as RefreshIcon,
  Save as SaveIcon,
  TrendingUp as TrendingUpIcon,
  Warning as WarningIcon,
  Lightbulb as LightbulbIcon,
  Check as CheckIcon,
  Healing as HealingIcon,
  MoneyOff as LiquidateIcon
} from '@mui/icons-material';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  AreaChart,
  Area,
  Label,
  Scatter,
  ZAxis,
  Cell
} from 'recharts';

// Mock data for testing
const mockTokens = [
  { id: 'iota', name: 'IOTA', symbol: 'MIOTA', price: 0.267, volatility: 'high', apy: 5.2 },
  { id: 'eth', name: 'Ethereum', symbol: 'ETH', price: 1850.42, volatility: 'medium', apy: 3.8 },
  { id: 'usdt', name: 'Tether', symbol: 'USDT', price: 1.0, volatility: 'low', apy: 2.5 },
  { id: 'usdc', name: 'USD Coin', symbol: 'USDC', price: 1.0, volatility: 'low', apy: 2.3 }
];

// Mock market scenarios
const marketScenarios = [
  { id: 'base', name: 'Base Case', priceFactor: 1, volatilityFactor: 1 },
  { id: 'bull', name: 'Bull Market', priceFactor: 1.5, volatilityFactor: 1.2 },
  { id: 'bear', name: 'Bear Market', priceFactor: 0.7, volatilityFactor: 1.4 },
  { id: 'volatile', name: 'Highly Volatile', priceFactor: 1, volatilityFactor: 2 }
];

const BorrowingStrategySimulator = ({ currentRiskScore, address }) => {
  const theme = useTheme();
  
  // Tab state
  const [tabValue, setTabValue] = useState(0);
  
  // Loading state
  const [isCalculating, setIsCalculating] = useState(false);
  const [hasSimulated, setHasSimulated] = useState(false);
  
  // Strategy parameters
  const [strategy, setStrategy] = useState({
    collateralAsset: 'iota',
    borrowAsset: 'usdt',
    collateralAmount: 1000,
    borrowAmount: 500,
    collateralRatio: 150, // Percentage
    targetDuration: 30, // Days
    useOptimalRatio: true,
    reinvestProfit: false,
    autoAdjust: true,
    marketScenario: 'base'
  });
  
  // Simulation results
  const [simulationResults, setSimulationResults] = useState(null);
  
  // Handle strategy parameter changes
  const handleStrategyChange = (param, value) => {
    setStrategy(prev => ({
      ...prev,
      [param]: value
    }));
  };
  
  // Calculate various metrics based on strategy
  const calculateMaxBorrow = () => {
    const collateralToken = mockTokens.find(t => t.id === strategy.collateralAsset);
    const borrowToken = mockTokens.find(t => t.id === strategy.borrowAsset);
    
    if (!collateralToken || !borrowToken) return 0;
    
    const collateralValue = strategy.collateralAmount * collateralToken.price;
    return (collateralValue * 0.7) / borrowToken.price; // Assuming max LTV of 70%
  };
  
  const calculateCurrentLTV = () => {
    const collateralToken = mockTokens.find(t => t.id === strategy.collateralAsset);
    const borrowToken = mockTokens.find(t => t.id === strategy.borrowAsset);
    
    if (!collateralToken || !borrowToken) return 0;
    
    const collateralValue = strategy.collateralAmount * collateralToken.price;
    const borrowValue = strategy.borrowAmount * borrowToken.price;
    
    return (borrowValue / collateralValue) * 100;
  };
  
  const calculateHealthFactor = () => {
    const ltv = calculateCurrentLTV();
    return 100 / ltv * 1.5; // Simple health factor calculation
  };
  
  // Run simulation based on current strategy
  const runSimulation = () => {
    setIsCalculating(true);
    
    // Simulate API call with timeout
    setTimeout(() => {
      const collateralToken = mockTokens.find(t => t.id === strategy.collateralAsset);
      const borrowToken = mockTokens.find(t => t.id === strategy.borrowAsset);
      const scenario = marketScenarios.find(s => s.id === strategy.marketScenario);
      
      // Generate simulation data points
      const simulationData = [];
      const priceData = [];
      const liquidationEvents = [];
      let liquidated = false;
      let liquidationDay = -1;
      let totalInterestPaid = 0;
      let totalRewards = 0;
      let initialCollateralValue = strategy.collateralAmount * collateralToken.price;
      let initialBorrowValue = strategy.borrowAmount * borrowToken.price;
      let collateralAmount = strategy.collateralAmount;
      let borrowAmount = strategy.borrowAmount;
      
      // Generate daily price data with volatility based on the scenario
      for (let day = 0; day <= strategy.targetDuration; day++) {
        // Random walk with scenario factor
        const volatility = collateralToken.volatility === 'high' ? 0.03 : 
                           collateralToken.volatility === 'medium' ? 0.015 : 0.005;
        
        const adjustedVolatility = volatility * scenario.volatilityFactor;
        
        // Price change factor (random walk with trend based on scenario)
        const randomChange = ((Math.random() * 2) - 1) * adjustedVolatility;
        const trendFactor = (scenario.priceFactor - 1) / strategy.targetDuration;
        const priceChangeFactor = 1 + randomChange + trendFactor;
        
        // Update collateral price each day
        const prevDay = day > 0 ? priceData[day-1] : { collateralPrice: collateralToken.price };
        const collateralPrice = prevDay.collateralPrice * priceChangeFactor;
        
        // Stable coins don't change much
        const borrowPrice = borrowToken.price * (1 + ((Math.random() * 0.002) - 0.001));
        
        priceData.push({
          day,
          collateralPrice,
          borrowPrice
        });
        
        // Calculate current values
        const currentCollateralValue = collateralAmount * collateralPrice;
        const currentBorrowValue = borrowAmount * borrowPrice;
        
        // Calculate LTV and health factor
        const ltv = (currentBorrowValue / currentCollateralValue) * 100;
        const healthFactor = 100 / ltv * 1.5; // Simple health factor calculation
        
        // Check for liquidation
        if (!liquidated && healthFactor < 1.0) {
          liquidated = true;
          liquidationDay = day;
          liquidationEvents.push({
            day,
            collateralAmount,
            borrowAmount,
            healthFactor
          });
        }
        
        // Calculate interest and rewards
        const dailyBorrowInterestRate = (borrowToken.apy / 365) / 100;
        const dailyLendingRewardRate = (collateralToken.apy / 365) / 100;
        
        // Apply interest and rewards
        const dailyInterest = currentBorrowValue * dailyBorrowInterestRate;
        const dailyReward = currentCollateralValue * dailyLendingRewardRate;
        
        totalInterestPaid += dailyInterest;
        totalRewards += dailyReward;
        
        if (strategy.reinvestProfit && !liquidated) {
          // Reinvest rewards into collateral
          const additionalCollateral = dailyReward / collateralPrice;
          collateralAmount += additionalCollateral;
        }
        
        // Auto adjust position if enabled
        if (strategy.autoAdjust && ltv > 75 && !liquidated) {
          // Reduce borrow amount to restore health
          const targetLTV = 70; // Target safer LTV
          const targetBorrowValue = (currentCollateralValue * targetLTV) / 100;
          borrowAmount = targetBorrowValue / borrowPrice;
        }
        
        // Add data point
        simulationData.push({
          day,
          collateralValue: currentCollateralValue,
          borrowValue: currentBorrowValue,
          ltv,
          healthFactor,
          pnl: (currentCollateralValue - initialCollateralValue) - (currentBorrowValue - initialBorrowValue) - totalInterestPaid + totalRewards,
          roi: ((currentCollateralValue - initialCollateralValue) - (currentBorrowValue - initialBorrowValue) - totalInterestPaid + totalRewards) / initialCollateralValue * 100
        });
      }
      
      // Calculate final metrics
      const finalDay = simulationData[simulationData.length - 1];
      const maxPnl = Math.max(...simulationData.map(d => d.pnl));
      const minHealthFactor = Math.min(...simulationData.map(d => d.healthFactor));
      const averageLtv = simulationData.reduce((sum, d) => sum + d.ltv, 0) / simulationData.length;
      
      // Set simulation results
      setSimulationResults({
        success: !liquidated,
        liquidationDay,
        liquidationEvents,
        finalLtv: finalDay.ltv,
        finalHealthFactor: finalDay.healthFactor,
        finalPnl: finalDay.pnl,
        finalRoi: finalDay.roi,
        maxPnl,
        minHealthFactor,
        averageLtv,
        totalInterestPaid,
        totalRewards,
        simulationData,
        priceData,
        timestamp: Date.now()
      });
      
      setHasSimulated(true);
      setIsCalculating(false);
    }, 1500);
  };
  
  // Reset simulation
  const resetSimulation = () => {
    setSimulationResults(null);
    setHasSimulated(false);
  };
  
  // Handle tab change
  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };
  
  // Function to get risk assessment label
  const getRiskLabel = (healthFactor) => {
    if (healthFactor >= 2) return { label: 'Low Risk', color: theme.palette.success.main };
    if (healthFactor >= 1.2) return { label: 'Medium Risk', color: theme.palette.warning.main };
    return { label: 'High Risk', color: theme.palette.error.main };
  };
  
  // Get color for health factor
  const getHealthFactorColor = (value) => {
    if (value >= 2) return theme.palette.success.main;
    if (value >= 1.2) return theme.palette.warning.main;
    return theme.palette.error.main;
  };
  
  // Prepare data for a simpler display of results
  const prepareResultSummary = () => {
    if (!simulationResults) return null;
    
    return [
      {
        label: 'Outcome',
        value: simulationResults.success ? 'Profitable' : 'Liquidated',
        color: simulationResults.success ? theme.palette.success.main : theme.palette.error.main,
        icon: simulationResults.success ? <CheckIcon /> : <LiquidateIcon />
      },
      {
        label: 'Total Return',
        value: `${simulationResults.finalRoi.toFixed(2)}%`,
        color: simulationResults.finalRoi >= 0 ? theme.palette.success.main : theme.palette.error.main,
        icon: <TrendingUpIcon />
      },
      {
        label: 'Lowest Health Factor',
        value: simulationResults.minHealthFactor.toFixed(2),
        color: getHealthFactorColor(simulationResults.minHealthFactor),
        icon: <HealingIcon />
      },
      {
        label: 'Risk Assessment',
        value: getRiskLabel(simulationResults.minHealthFactor).label,
        color: getRiskLabel(simulationResults.minHealthFactor).color,
        icon: <WarningIcon />
      }
    ];
  };
  
  // Custom tooltip for the charts
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <Box
          sx={{
            background: theme.palette.background.paper,
            p: 2,
            border: `1px solid ${theme.palette.divider}`,
            borderRadius: 1,
            boxShadow: theme.shadows[3],
          }}
        >
          <Typography variant="subtitle2" gutterBottom>
            Day {label}
          </Typography>
          {payload.map((entry, index) => (
            <Typography 
              key={`item-${index}`} 
              variant="body2" 
              sx={{ color: entry.color, display: 'flex', alignItems: 'center' }}
            >
              <Box 
                component="span" 
                sx={{ 
                  display: 'inline-block', 
                  width: 10, 
                  height: 10, 
                  bgcolor: entry.color, 
                  borderRadius: '50%', 
                  mr: 1 
                }} 
              />
              {entry.name}: {typeof entry.value === 'number' ? entry.value.toFixed(2) : entry.value}
            </Typography>
          ))}
        </Box>
      );
    }
    return null;
  };
  
  return (
    <Box>
      <Grid container spacing={3}>
        {/* Strategy Controls */}
        <Grid item xs={12} md={4}>
          <Paper 
            elevation={2} 
            sx={{ 
              p: 3, 
              height: '100%',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            <Typography variant="h6" gutterBottom>
              Borrowing Strategy
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              Configure your borrowing strategy parameters and simulate the outcome.
            </Typography>
            
            <Divider sx={{ my: 2 }} />
            
            <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
              <Grid container spacing={3}>
                {/* Collateral Asset Selection */}
                <Grid item xs={12}>
                  <FormControl fullWidth size="small">
                    <InputLabel id="collateral-asset-label">Collateral Asset</InputLabel>
                    <Select
                      labelId="collateral-asset-label"
                      value={strategy.collateralAsset}
                      label="Collateral Asset"
                      onChange={(e) => handleStrategyChange('collateralAsset', e.target.value)}
                    >
                      {mockTokens.map((token) => (
                        <MenuItem key={token.id} value={token.id}>
                          {token.name} ({token.symbol})
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                
                {/* Borrow Asset Selection */}
                <Grid item xs={12}>
                  <FormControl fullWidth size="small">
                    <InputLabel id="borrow-asset-label">Borrow Asset</InputLabel>
                    <Select
                      labelId="borrow-asset-label"
                      value={strategy.borrowAsset}
                      label="Borrow Asset"
                      onChange={(e) => handleStrategyChange('borrowAsset', e.target.value)}
                    >
                      {mockTokens.map((token) => (
                        <MenuItem key={token.id} value={token.id}>
                          {token.name} ({token.symbol})
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                
                {/* Collateral Amount */}
                <Grid item xs={12}>
                  <Typography variant="body2" gutterBottom>
                    Collateral Amount
                  </Typography>
                  <Grid container spacing={2} alignItems="center">
                    <Grid item xs>
                      <Slider
                        value={strategy.collateralAmount}
                        min={100}
                        max={10000}
                        step={100}
                        onChange={(_, value) => handleStrategyChange('collateralAmount', value)}
                        valueLabelDisplay="auto"
                        valueLabelFormat={(value) => `${value} ${mockTokens.find(t => t.id === strategy.collateralAsset)?.symbol || ''}`}
                      />
                    </Grid>
                    <Grid item>
                      <TextField
                        value={strategy.collateralAmount}
                        onChange={(e) => {
                          const value = parseInt(e.target.value, 10);
                          if (!isNaN(value) && value >= 100 && value <= 10000) {
                            handleStrategyChange('collateralAmount', value);
                          }
                        }}
                        inputProps={{
                          step: 100,
                          min: 100,
                          max: 10000,
                          type: 'number',
                        }}
                        sx={{ width: 100 }}
                        size="small"
                      />
                    </Grid>
                  </Grid>
                </Grid>
                
                {/* Borrow Amount */}
                <Grid item xs={12}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="body2" gutterBottom>
                      Borrow Amount
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Max: {calculateMaxBorrow().toFixed(2)} {mockTokens.find(t => t.id === strategy.borrowAsset)?.symbol || ''}
                    </Typography>
                  </Box>
                  <Grid container spacing={2} alignItems="center">
                    <Grid item xs>
                      <Slider
                        value={strategy.borrowAmount}
                        min={0}
                        max={calculateMaxBorrow()}
                        step={10}
                        onChange={(_, value) => handleStrategyChange('borrowAmount', value)}
                        valueLabelDisplay="auto"
                        valueLabelFormat={(value) => `${value} ${mockTokens.find(t => t.id === strategy.borrowAsset)?.symbol || ''}`}
                      />
                    </Grid>
                    <Grid item>
                      <TextField
                        value={strategy.borrowAmount}
                        onChange={(e) => {
                          const value = parseInt(e.target.value, 10);
                          if (!isNaN(value) && value >= 0 && value <= calculateMaxBorrow()) {
                            handleStrategyChange('borrowAmount', value);
                          }
                        }}
                        inputProps={{
                          step: 10,
                          min: 0,
                          max: calculateMaxBorrow(),
                          type: 'number',
                        }}
                        sx={{ width: 100 }}
                        size="small"
                      />
                    </Grid>
                  </Grid>
                  <Box sx={{ mt: 1, display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="caption" color="text.secondary">
                      Current LTV: {calculateCurrentLTV().toFixed(2)}%
                    </Typography>
                    <Typography 
                      variant="caption" 
                      sx={{ 
                        color: calculateHealthFactor() > 1.5 
                          ? theme.palette.success.main 
                          : calculateHealthFactor() > 1.1 
                            ? theme.palette.warning.main 
                            : theme.palette.error.main
                      }}
                    >
                      Health Factor: {calculateHealthFactor().toFixed(2)}
                    </Typography>
                  </Box>
                </Grid>
                
                {/* Duration */}
                <Grid item xs={12}>
                  <Typography variant="body2" gutterBottom>
                    Simulation Duration (Days)
                  </Typography>
                  <Grid container spacing={2} alignItems="center">
                    <Grid item xs>
                      <Slider
                        value={strategy.targetDuration}
                        min={1}
                        max={90}
                        step={1}
                        onChange={(_, value) => handleStrategyChange('targetDuration', value)}
                        valueLabelDisplay="auto"
                        valueLabelFormat={(value) => `${value} days`}
                      />
                    </Grid>
                    <Grid item>
                      <TextField
                        value={strategy.targetDuration}
                        onChange={(e) => {
                          const value = parseInt(e.target.value, 10);
                          if (!isNaN(value) && value >= 1 && value <= 90) {
                            handleStrategyChange('targetDuration', value);
                          }
                        }}
                        inputProps={{
                          step: 1,
                          min: 1,
                          max: 90,
                          type: 'number',
                        }}
                        sx={{ width: 80 }}
                        size="small"
                      />
                    </Grid>
                  </Grid>
                </Grid>
                
                {/* Market Scenario */}
                <Grid item xs={12}>
                  <FormControl fullWidth size="small">
                    <InputLabel id="market-scenario-label">Market Scenario</InputLabel>
                    <Select
                      labelId="market-scenario-label"
                      value={strategy.marketScenario}
                      label="Market Scenario"
                      onChange={(e) => handleStrategyChange('marketScenario', e.target.value)}
                    >
                      {marketScenarios.map((scenario) => (
                        <MenuItem key={scenario.id} value={scenario.id}>
                          {scenario.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                
                {/* Strategy Options */}
                <Grid item xs={12}>
                  <Typography variant="body2" gutterBottom sx={{ mb: 1 }}>
                    Strategy Options
                  </Typography>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={strategy.reinvestProfit}
                        onChange={(e) => handleStrategyChange('reinvestProfit', e.target.checked)}
                      />
                    }
                    label="Reinvest Profit"
                  />
                  <FormControlLabel
                    control={
                      <Switch
                        checked={strategy.autoAdjust}
                        onChange={(e) => handleStrategyChange('autoAdjust', e.target.checked)}
                      />
                    }
                    label="Auto-Adjust Position"
                  />
                </Grid>
              </Grid>
            </Box>
            
            <Box sx={{ mt: 3, display: 'flex', gap: 2 }}>
              <Button
                variant="contained"
                color="primary"
                fullWidth
                startIcon={isCalculating ? <CircularProgress size={20} /> : <PlayArrowIcon />}
                onClick={runSimulation}
                disabled={isCalculating}
              >
                {isCalculating ? 'Simulating...' : 'Run Simulation'}
              </Button>
              <Button
                variant="outlined"
                color="secondary"
                onClick={resetSimulation}
                startIcon={<RefreshIcon />}
                disabled={isCalculating || !hasSimulated}
              >
                Reset
              </Button>
            </Box>
          </Paper>
        </Grid>
        
        {/* Simulation Results */}
        <Grid item xs={12} md={8}>
          <Paper 
            elevation={2} 
            sx={{ 
              p: 3,
              height: '100%',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            <Typography variant="h6" gutterBottom>
              Simulation Results
            </Typography>
            
            {!hasSimulated ? (
              <Box 
                sx={{ 
                  flexGrow: 1, 
                  display: 'flex', 
                  flexDirection: 'column', 
                  justifyContent: 'center', 
                  alignItems: 'center',
                  p: 4
                }}
              >
                <Typography 
                  variant="body1" 
                  color="text.secondary" 
                  align="center" 
                  sx={{ mb: 2 }}
                >
                  Configure your strategy parameters and run the simulation to see the results.
                </Typography>
                <Box 
                  component="img" 
                  src="/assets/simulation-placeholder.svg" 
                  alt="Simulation Placeholder" 
                  sx={{ 
                    width: '50%', 
                    maxWidth: 300,
                    opacity: 0.5
                  }} 
                />
              </Box>
            ) : isCalculating ? (
              <Box 
                sx={{ 
                  flexGrow: 1, 
                  display: 'flex', 
                  justifyContent: 'center', 
                  alignItems: 'center',
                  flexDirection: 'column'
                }}
              >
                <CircularProgress size={48} />
                <Typography variant="body1" sx={{ mt: 2 }}>
                  Running simulation...
                </Typography>
              </Box>
            ) : (
              <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                {/* Simulation Tabs */}
                <Tabs
                  value={tabValue}
                  onChange={handleTabChange}
                  sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}
                >
                  <Tab label="Summary" id="simulation-tab-0" />
                  <Tab label="Performance Chart" id="simulation-tab-1" />
                  <Tab label="Risk Metrics" id="simulation-tab-2" />
                  <Tab label="Market Conditions" id="simulation-tab-3" />
                </Tabs>
                
                {/* Summary Tab */}
                <Box 
                  hidden={tabValue !== 0} 
                  sx={{ flexGrow: 1, display: tabValue === 0 ? 'flex' : 'none', flexDirection: 'column' }}
                >
                  {/* Result Summary */}
                  <Grid container spacing={2} sx={{ mb: 3 }}>
                    {prepareResultSummary()?.map((item, index) => (
                      <Grid item xs={12} sm={6} key={index}>
                        <Paper 
                          elevation={0} 
                          sx={{ 
                            p: 2, 
                            display: 'flex', 
                            alignItems: 'center',
                            gap: 2,
                            border: `1px solid ${theme.palette.divider}`,
                            borderLeft: `4px solid ${item.color}`,
                            borderRadius: 1
                          }}
                        >
                          <Box 
                            sx={{ 
                              bgcolor: alpha(item.color, 0.1),
                              color: item.color,
                              p: 1,
                              borderRadius: '50%',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                          >
                            {item.icon}
                          </Box>
                          <Box>
                            <Typography variant="body2" color="text.secondary">
                              {item.label}
                            </Typography>
                            <Typography variant="h6" sx={{ color: item.color, fontWeight: 'medium' }}>
                              {item.value}
                            </Typography>
                          </Box>
                        </Paper>
                      </Grid>
                    ))}
                  </Grid>
                  
                  {/* Outcome Alert */}
                  {simulationResults?.success ? (
                    <Alert 
                      severity="success" 
                      sx={{ mb: 3 }}
                      icon={<CheckIcon fontSize="inherit" />}
                    >
                      <Typography variant="subtitle2">
                        Strategy Successful
                      </Typography>
                      <Typography variant="body2">
                        This strategy avoided liquidation with a final return of {simulationResults.finalRoi.toFixed(2)}% over {strategy.targetDuration} days.
                      </Typography>
                    </Alert>
                  ) : (
                    <Alert 
                      severity="error" 
                      sx={{ mb: 3 }}
                      icon={<LiquidateIcon fontSize="inherit" />}
                    >
                      <Typography variant="subtitle2">
                        Liquidation Occurred
                      </Typography>
                      <Typography variant="body2">
                        This strategy resulted in liquidation on day {simulationResults?.liquidationDay}. Consider using a lower LTV or enabling auto-adjustment.
                      </Typography>
                    </Alert>
                  )}
                  
                  {/* AI Recommendations */}
                  <Paper
                    elevation={0}
                    sx={{
                      p: 2,
                      mb: 3,
                      border: `1px solid ${theme.palette.divider}`,
                      borderRadius: 1
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                      <LightbulbIcon sx={{ color: theme.palette.warning.main, mr: 1 }} />
                      <Typography variant="subtitle1">
                        AI Recommendations
                      </Typography>
                    </Box>
                    <Divider sx={{ my: 1 }} />
                    <Typography variant="body2" paragraph>
                      Based on your risk profile (score: {currentRiskScore}) and simulation results, here are some recommendations to improve your strategy:
                    </Typography>
                    <ul style={{ paddingLeft: 20 }}>
                      {simulationResults?.minHealthFactor < 1.2 && (
                        <li>
                          <Typography variant="body2" sx={{ mb: 0.5 }}>
                            <strong>Increase Collateral Ratio:</strong> Your minimum health factor was {simulationResults.minHealthFactor.toFixed(2)}, which is risky. Consider increasing your collateral or reducing borrowed amount.
                          </Typography>
                        </li>
                      )}
                      {!strategy.autoAdjust && (
                        <li>
                          <Typography variant="body2" sx={{ mb: 0.5 }}>
                            <strong>Enable Auto-Adjustment:</strong> This can help prevent liquidation by automatically adjusting your position when it approaches unsafe levels.
                          </Typography>
                        </li>
                      )}
                      {strategy.collateralAsset === strategy.borrowAsset && (
                        <li>
                          <Typography variant="body2" sx={{ mb: 0.5 }}>
                            <strong>Use Different Assets:</strong> Using the same asset for collateral and borrowing limits potential benefits. Consider using a stable asset for borrowing.
                          </Typography>
                        </li>
                      )}
                      {mockTokens.find(t => t.id === strategy.collateralAsset)?.volatility === 'high' && !strategy.autoAdjust && (
                        <li>
                          <Typography variant="body2" sx={{ mb: 0.5 }}>
                            <strong>Consider Lower Volatility Asset:</strong> Your chosen collateral has high volatility, which increases liquidation risk. Either choose a more stable asset or reduce your LTV.
                          </Typography>
                        </li>
                      )}
                      {strategy.marketScenario === 'bear' && calculateCurrentLTV() > 60 && (
                        <li>
                          <Typography variant="body2" sx={{ mb: 0.5 }}>
                            <strong>Reduce LTV in Bear Markets:</strong> Your current LTV of {calculateCurrentLTV().toFixed(2)}% is risky in a bear market scenario. Consider a lower LTV when expecting downward price action.
                          </Typography>
                        </li>
                      )}
                    </ul>
                  </Paper>
                  
                  {/* Key Metrics */}
                  <Paper
                    elevation={0}
                    sx={{
                      p: 2,
                      border: `1px solid ${theme.palette.divider}`,
                      borderRadius: 1
                    }}
                  >
                    <Typography variant="subtitle1" gutterBottom>
                      Key Metrics
                    </Typography>
                    <Grid container spacing={2}>
                      <Grid item xs={12} sm={6}>
                        <Typography variant="body2" color="text.secondary">
                          Final ROI:
                        </Typography>
                        <Typography variant="body1" sx={{ fontWeight: 'medium' }}>
                          {simulationResults?.finalRoi.toFixed(2)}%
                        </Typography>
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <Typography variant="body2" color="text.secondary">
                          Final PnL:
                        </Typography>
                        <Typography variant="body1" sx={{ fontWeight: 'medium' }}>
                          ${simulationResults?.finalPnl.toFixed(2)}
                        </Typography>
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <Typography variant="body2" color="text.secondary">
                          Interest Paid:
                        </Typography>
                        <Typography variant="body1" sx={{ fontWeight: 'medium' }}>
                          ${simulationResults?.totalInterestPaid.toFixed(2)}
                        </Typography>
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <Typography variant="body2" color="text.secondary">
                          Lending Rewards:
                        </Typography>
                        <Typography variant="body1" sx={{ fontWeight: 'medium' }}>
                          ${simulationResults?.totalRewards.toFixed(2)}
                        </Typography>
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <Typography variant="body2" color="text.secondary">
                          Average LTV:
                        </Typography>
                        <Typography variant="body1" sx={{ fontWeight: 'medium' }}>
                          {simulationResults?.averageLtv.toFixed(2)}%
                        </Typography>
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <Typography variant="body2" color="text.secondary">
                          Min Health Factor:
                        </Typography>
                        <Typography 
                          variant="body1" 
                          sx={{ 
                            fontWeight: 'medium',
                            color: getHealthFactorColor(simulationResults?.minHealthFactor || 0)
                          }}
                        >
                          {simulationResults?.minHealthFactor.toFixed(2)}
                        </Typography>
                      </Grid>
                    </Grid>
                  </Paper>
                </Box>
                
                {/* Performance Chart Tab */}
                <Box 
                  hidden={tabValue !== 1} 
                  sx={{ flexGrow: 1, display: tabValue === 1 ? 'flex' : 'none', flexDirection: 'column' }}
                >
                  <Box sx={{ height: 400, mb: 3 }}>
                    <Typography variant="subtitle1" gutterBottom>
                      PnL Over Time
                    </Typography>
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={simulationResults?.simulationData}
                        margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke={alpha(theme.palette.divider, 0.7)} />
                        <XAxis 
                          dataKey="day" 
                          stroke={theme.palette.text.secondary}
                          label={{ value: 'Days', position: 'insideBottom', dy: 10 }}
                        />
                        <YAxis 
                          stroke={theme.palette.text.secondary}
                          label={{ value: 'Profit/Loss ($)', angle: -90, position: 'insideLeft', dx: -5 }}
                          tickFormatter={(value) => `$${value.toFixed(0)}`}
                        />
                        <RechartsTooltip content={<CustomTooltip />} />
                        <Area 
                          type="monotone" 
                          dataKey="pnl" 
                          name="Profit/Loss" 
                          stroke={theme.palette.primary.main} 
                          fill={alpha(theme.palette.primary.main, 0.2)} 
                        />
                        {simulationResults?.liquidationDay > 0 && (
                          <ReferenceLine 
                            x={simulationResults.liquidationDay} 
                            stroke={theme.palette.error.main} 
                            strokeDasharray="3 3"
                            label={{ 
                              value: 'Liquidation', 
                              position: 'top', 
                              fill: theme.palette.error.main,
                              fontSize: 12
                            }} 
                          />
                        )}
                        <ReferenceLine 
                          y={0} 
                          stroke={theme.palette.divider} 
                          strokeWidth={2}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </Box>
                  
                  <Box sx={{ height: 300 }}>
                    <Typography variant="subtitle1" gutterBottom>
                      ROI Over Time
                    </Typography>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={simulationResults?.simulationData}
                        margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke={alpha(theme.palette.divider, 0.7)} />
                        <XAxis 
                          dataKey="day" 
                          stroke={theme.palette.text.secondary}
                        />
                        <YAxis 
                          stroke={theme.palette.text.secondary}
                          tickFormatter={(value) => `${value.toFixed(1)}%`}
                        />
                        <RechartsTooltip content={<CustomTooltip />} />
                        <Line 
                          type="monotone" 
                          dataKey="roi" 
                          name="ROI (%)" 
                          stroke={theme.palette.secondary.main} 
                          strokeWidth={2}
                          dot={false}
                        />
                        {simulationResults?.liquidationDay > 0 && (
                          <ReferenceLine 
                            x={simulationResults.liquidationDay} 
                            stroke={theme.palette.error.main} 
                            strokeDasharray="3 3"
                          />
                        )}
                        <ReferenceLine 
                          y={0} 
                          stroke={theme.palette.divider} 
                          strokeWidth={2}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </Box>
                </Box>
                
                {/* Risk Metrics Tab */}
                <Box 
                  hidden={tabValue !== 2} 
                  sx={{ flexGrow: 1, display: tabValue === 2 ? 'flex' : 'none', flexDirection: 'column' }}
                >
                  <Box sx={{ height: 300, mb: 3 }}>
                    <Typography variant="subtitle1" gutterBottom>
                      LTV Over Time
                    </Typography>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={simulationResults?.simulationData}
                        margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke={alpha(theme.palette.divider, 0.7)} />
                        <XAxis 
                          dataKey="day" 
                          stroke={theme.palette.text.secondary}
                        />
                        <YAxis 
                          stroke={theme.palette.text.secondary}
                          domain={[0, 100]}
                          tickFormatter={(value) => `${value}%`}
                        />
                        <RechartsTooltip content={<CustomTooltip />} />
                        <Line 
                          type="monotone" 
                          dataKey="ltv" 
                          name="LTV (%)" 
                          stroke={theme.palette.warning.main} 
                          strokeWidth={2}
                          dot={false}
                        />
                        <ReferenceLine 
                          y={80} 
                          stroke={theme.palette.error.main} 
                          strokeDasharray="3 3"
                          label={{ 
                            value: 'Critical LTV', 
                            position: 'right', 
                            fill: theme.palette.error.main,
                            fontSize: 12
                          }} 
                        />
                        {simulationResults?.liquidationDay > 0 && (
                          <ReferenceLine 
                            x={simulationResults.liquidationDay} 
                            stroke={theme.palette.error.main} 
                            strokeDasharray="3 3"
                            label={{ 
                              value: 'Liquidation', 
                              position: 'top', 
                              fill: theme.palette.error.main,
                              fontSize: 12
                            }} 
                          />
                        )}
                      </LineChart>
                    </ResponsiveContainer>
                  </Box>
                  
                  <Box sx={{ height: 300 }}>
                    <Typography variant="subtitle1" gutterBottom>
                      Health Factor Over Time
                    </Typography>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={simulationResults?.simulationData}
                        margin={{ top: 10, right: 30, left: 0, bottom: 10 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke={alpha(theme.palette.divider, 0.7)} />
                        <XAxis 
                          dataKey="day" 
                          stroke={theme.palette.text.secondary}
                        />
                        <YAxis 
                          stroke={theme.palette.text.secondary}
                          domain={[0, 'dataMax + 0.5']}
                        />
                        <RechartsTooltip content={<CustomTooltip />} />
                        <Line 
                          type="monotone" 
                          dataKey="healthFactor" 
                          name="Health Factor" 
                          stroke={theme.palette.success.main} 
                          strokeWidth={2}
                          dot={false}
                        />
                        <ReferenceLine 
                          y={1.0} 
                          stroke={theme.palette.error.main} 
                          strokeWidth={2}
                          label={{ 
                            value: 'Liquidation Threshold', 
                            position: 'right', 
                            fill: theme.palette.error.main,
                            fontSize: 12
                          }} 
                        />
                        <ReferenceLine 
                          y={1.2} 
                          stroke={theme.palette.warning.main} 
                          strokeDasharray="3 3"
                          label={{ 
                            value: 'Warning Threshold', 
                            position: 'right', 
                            fill: theme.palette.warning.main,
                            fontSize: 12
                          }} 
                        />
                        {simulationResults?.liquidationDay > 0 && (
                          <ReferenceLine 
                            x={simulationResults.liquidationDay} 
                            stroke={theme.palette.error.main} 
                            strokeDasharray="3 3"
                          />
                        )}
                      </LineChart>
                    </ResponsiveContainer>
                  </Box>
                </Box>
                
                {/* Market Conditions Tab */}
                <Box 
                  hidden={tabValue !== 3} 
                  sx={{ flexGrow: 1, display: tabValue === 3 ? 'flex' : 'none', flexDirection: 'column' }}
                >
                  <Box sx={{ height: 400 }}>
                    <Typography variant="subtitle1" gutterBottom>
                      Collateral Price Over Time
                    </Typography>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={simulationResults?.priceData}
                        margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke={alpha(theme.palette.divider, 0.7)} />
                        <XAxis 
                          dataKey="day" 
                          stroke={theme.palette.text.secondary}
                        />
                        <YAxis 
                          stroke={theme.palette.text.secondary}
                          tickFormatter={(value) => `$${value.toFixed(2)}`}
                        />
                        <RechartsTooltip content={<CustomTooltip />} />
                        <Line 
                          type="monotone" 
                          dataKey="collateralPrice" 
                          name="Collateral Price" 
                          stroke={theme.palette.primary.main} 
                          strokeWidth={2}
                          dot={false}
                        />
                        {strategy.borrowAsset !== strategy.collateralAsset && (
                          <Line 
                            type="monotone" 
                            dataKey="borrowPrice" 
                            name="Borrow Asset Price" 
                            stroke={theme.palette.secondary.main} 
                            strokeWidth={2}
                            dot={false}
                          />
                        )}
                        {simulationResults?.liquidationDay > 0 && (
                          <ReferenceLine 
                            x={simulationResults.liquidationDay} 
                            stroke={theme.palette.error.main} 
                            strokeDasharray="3 3"
                            label={{ 
                              value: 'Liquidation', 
                              position: 'top', 
                              fill: theme.palette.error.main,
                              fontSize: 12
                            }} 
                          />
                        )}
                      </LineChart>
                    </ResponsiveContainer>
                  </Box>
                </Box>
              </Box>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default BorrowingStrategySimulator;
