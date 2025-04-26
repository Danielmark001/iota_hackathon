import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Paper,
  Typography,
  Slider,
  Button,
  TextField,
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Divider,
  CircularProgress,
  Alert,
  Chip,
  Tooltip,
  Stack,
  Card,
  CardContent,
  useTheme
} from '@mui/material';
import {
  TrendingUp,
  TrendingDown,
  PriorityHigh,
  CheckCircle,
  Info,
  SimCardDownload,
  Calculate,
  SyncAlt,
  ExpandMore,
  ExpandLess
} from '@mui/icons-material';

import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ReferenceLine
} from 'recharts';

// Simulated API call to simulate risk score
const simulateRiskScore = async (simulationParams) => {
  // In production, this would be an actual API call
  // For now, we'll simulate a response with a simple model
  return new Promise((resolve) => {
    setTimeout(() => {
      // Simple risk model for simulation
      const { 
        collateralAmount, 
        borrowAmount, 
        asset,
        useIOTA,
        crossChainActivity,
        identityVerified
      } = simulationParams;
      
      // Base risk factors
      const collateralRatio = collateralAmount / borrowAmount;
      let baseRisk = 50; // Start at medium risk
      
      // Collateral ratio factor (-20 to +30 points)
      let collateralRatioImpact = 0;
      if (collateralRatio >= 2.0) {
        collateralRatioImpact = -20; // Very good ratio
      } else if (collateralRatio >= 1.5) {
        collateralRatioImpact = -10; // Good ratio
      } else if (collateralRatio < 1.2) {
        collateralRatioImpact = 20; // Dangerous ratio
      } else if (collateralRatio < 1.3) {
        collateralRatioImpact = 10; // Risky ratio
      }
      
      // Asset factor (-10 to +10 points)
      let assetImpact = 0;
      if (asset === 'usdt' || asset === 'dai') {
        assetImpact = -5; // Stablecoins are less risky
      } else if (asset === 'eth' || asset === 'btc') {
        assetImpact = 5; // Major cryptos have moderate risk
      } else if (asset === 'smr') {
        assetImpact = -10; // IOTA's Shimmer has lower risk on this platform
      }
      
      // IOTA usage factor (-15 to 0 points)
      const iotaImpact = useIOTA ? -15 : 0;
      
      // Cross-chain activity (-10 to 0 points)
      const crossChainImpact = crossChainActivity ? -10 : 0;
      
      // Identity verification (-15 to 0 points)
      const identityImpact = identityVerified ? -15 : 0;
      
      // Calculate total risk score
      let riskScore = baseRisk + collateralRatioImpact + assetImpact + iotaImpact + crossChainImpact + identityImpact;
      
      // Ensure score is between 0 and 100
      riskScore = Math.max(0, Math.min(100, riskScore));
      
      // Liquidation risk
      const liquidationRisk = Math.max(0, Math.min(100, 100 - (collateralRatio * 50)));
      
      // Interest rate based on risk score
      const interestRate = 3 + (riskScore / 10);
      
      // Max borrowing power
      const maxBorrowAmount = collateralAmount * 0.8;
      
      // Return simulation results
      resolve({
        riskScore: Math.round(riskScore),
        collateralRatio,
        liquidationRisk: Math.round(liquidationRisk),
        interestRate: interestRate.toFixed(2),
        maxBorrowAmount: maxBorrowAmount.toFixed(2),
        factors: [
          { 
            name: 'Collateral Ratio', 
            impact: collateralRatioImpact,
            description: `${collateralRatio.toFixed(2)}x ratio ${collateralRatioImpact <= 0 ? 'decreases' : 'increases'} risk`
          },
          { 
            name: 'Asset Selection', 
            impact: assetImpact,
            description: `${asset.toUpperCase()} ${assetImpact <= 0 ? 'decreases' : 'increases'} risk`
          },
          { 
            name: 'IOTA Integration', 
            impact: iotaImpact,
            description: useIOTA ? 'IOTA usage lowers risk' : 'No IOTA integration'
          },
          { 
            name: 'Cross-Chain Activity', 
            impact: crossChainImpact,
            description: crossChainActivity ? 'Cross-chain activity lowers risk' : 'No cross-chain activity'
          },
          { 
            name: 'Identity Verification', 
            impact: identityImpact,
            description: identityVerified ? 'Verified identity lowers risk' : 'No identity verification'
          }
        ]
      });
    }, 800); // Simulate network delay
  });
};

const BorrowingStrategySimulator = ({ currentRiskScore = 50, address }) => {
  const theme = useTheme();
  
  // State for simulation parameters
  const [collateralAmount, setCollateralAmount] = useState(1000);
  const [borrowAmount, setBorrowAmount] = useState(500);
  const [asset, setAsset] = useState('smr');
  const [useIOTA, setUseIOTA] = useState(true);
  const [crossChainActivity, setCrossChainActivity] = useState(false);
  const [identityVerified, setIdentityVerified] = useState(false);
  
  // State for simulation results
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationResults, setSimulationResults] = useState(null);
  const [simulationHistory, setSimulationHistory] = useState([]);
  const [showDetails, setShowDetails] = useState(false);
  
  // Get color based on risk score
  const getRiskColor = (score) => {
    if (score <= 30) return theme.palette.success.main;
    if (score <= 60) return theme.palette.warning.main;
    return theme.palette.error.main;
  };
  
  // Get text based on risk score
  const getRiskText = (score) => {
    if (score <= 30) return 'Low Risk';
    if (score <= 60) return 'Medium Risk';
    return 'High Risk';
  };
  
  // Run initial simulation when component mounts
  useEffect(() => {
    handleRunSimulation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  // Handle collateral amount change
  const handleCollateralChange = (event) => {
    const value = parseFloat(event.target.value);
    if (!isNaN(value) && value >= 0) {
      setCollateralAmount(value);
    }
  };
  
  // Handle borrow amount change
  const handleBorrowChange = (event) => {
    const value = parseFloat(event.target.value);
    if (!isNaN(value) && value >= 0) {
      setBorrowAmount(value);
    }
  };
  
  // Handle asset change
  const handleAssetChange = (event) => {
    setAsset(event.target.value);
  };
  
  // Handle IOTA usage toggle
  const handleIOTAToggle = () => {
    setUseIOTA(!useIOTA);
  };
  
  // Handle cross-chain activity toggle
  const handleCrossChainToggle = () => {
    setCrossChainActivity(!crossChainActivity);
  };
  
  // Handle identity verification toggle
  const handleIdentityVerificationToggle = () => {
    setIdentityVerified(!identityVerified);
  };
  
  // Handle run simulation button
  const handleRunSimulation = async () => {
    setIsSimulating(true);
    
    try {
      // Run simulation
      const results = await simulateRiskScore({
        collateralAmount,
        borrowAmount,
        asset,
        useIOTA,
        crossChainActivity,
        identityVerified
      });
      
      // Add timestamp to results
      const resultsWithTimestamp = {
        ...results,
        timestamp: new Date().toISOString()
      };
      
      // Update simulation results
      setSimulationResults(resultsWithTimestamp);
      
      // Add to simulation history (limit to last 5 simulations)
      setSimulationHistory((prevHistory) => {
        const updatedHistory = [resultsWithTimestamp, ...prevHistory];
        return updatedHistory.slice(0, 5);
      });
    } catch (error) {
      console.error('Error running simulation:', error);
    } finally {
      setIsSimulating(false);
    }
  };
  
  // Handle reset simulation
  const handleResetSimulation = () => {
    setCollateralAmount(1000);
    setBorrowAmount(500);
    setAsset('smr');
    setUseIOTA(true);
    setCrossChainActivity(false);
    setIdentityVerified(false);
    setSimulationResults(null);
  };
  
  // Handle collateral ratio slider change
  const handleCollateralRatioChange = (event, newValue) => {
    const ratio = newValue;
    if (ratio > 0) {
      // Keep collateral constant, adjust borrow amount
      const newBorrowAmount = collateralAmount / ratio;
      setBorrowAmount(parseFloat(newBorrowAmount.toFixed(2)));
    }
  };
  
  // Handle comparison chart tooltip
  const CustomSimulationTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <Box sx={{ 
          bgcolor: 'background.paper', 
          p: 1.5,
          border: `1px solid ${theme.palette.divider}`,
          borderRadius: 1,
          boxShadow: theme.shadows[1]
        }}>
          <Typography variant="subtitle2">
            {payload[0].payload.name}
          </Typography>
          <Typography variant="body2" sx={{ color: payload[0].color }}>
            Risk Score: {payload[0].value}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {getRiskText(payload[0].value)}
          </Typography>
          {payload[0].payload.collateralRatio && (
            <Typography variant="body2" color="text.secondary">
              Collateral Ratio: {payload[0].payload.collateralRatio.toFixed(2)}x
            </Typography>
          )}
        </Box>
      );
    }
    return null;
  };
  
  return (
    <Grid container spacing={3}>
      <Grid item xs={12} md={5}>
        <Paper elevation={3} sx={{ p: 3, borderRadius: 2 }}>
          <Typography variant="h6" gutterBottom>
            Simulation Parameters
          </Typography>
          <Divider sx={{ mb: 3 }} />
          
          <Grid container spacing={3}>
            {/* Collateral Amount */}
            <Grid item xs={12}>
              <TextField
                label="Collateral Amount"
                value={collateralAmount}
                onChange={handleCollateralChange}
                fullWidth
                variant="outlined"
                type="number"
                InputProps={{
                  startAdornment: <InputAdornment position="start">$</InputAdornment>,
                }}
              />
            </Grid>
            
            {/* Borrow Amount */}
            <Grid item xs={12}>
              <TextField
                label="Borrow Amount"
                value={borrowAmount}
                onChange={handleBorrowChange}
                fullWidth
                variant="outlined"
                type="number"
                InputProps={{
                  startAdornment: <InputAdornment position="start">$</InputAdornment>,
                }}
              />
            </Grid>
            
            {/* Collateral Ratio Slider */}
            <Grid item xs={12}>
              <Typography variant="body2" gutterBottom>
                Collateral Ratio: {(collateralAmount / borrowAmount).toFixed(2)}x
              </Typography>
              <Slider
                value={collateralAmount / borrowAmount}
                min={1}
                max={3}
                step={0.1}
                marks={[
                  { value: 1, label: '1x' },
                  { value: 1.5, label: '1.5x' },
                  { value: 2, label: '2x' },
                  { value: 3, label: '3x' },
                ]}
                onChange={handleCollateralRatioChange}
                valueLabelDisplay="auto"
                valueLabelFormat={(value) => `${value.toFixed(2)}x`}
              />
            </Grid>
            
            {/* Asset Selection */}
            <Grid item xs={12}>
              <FormControl fullWidth variant="outlined">
                <InputLabel id="asset-select-label">Asset</InputLabel>
                <Select
                  labelId="asset-select-label"
                  id="asset-select"
                  value={asset}
                  onChange={handleAssetChange}
                  label="Asset"
                >
                  <MenuItem value="smr">Shimmer (SMR)</MenuItem>
                  <MenuItem value="iota">IOTA (MIOTA)</MenuItem>
                  <MenuItem value="eth">Ethereum (ETH)</MenuItem>
                  <MenuItem value="btc">Bitcoin (BTC)</MenuItem>
                  <MenuItem value="usdt">Tether (USDT)</MenuItem>
                  <MenuItem value="dai">DAI</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            
            {/* Advanced Options */}
            <Grid item xs={12}>
              <Typography variant="subtitle2" gutterBottom>
                Advanced Options
              </Typography>
              <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
                <Chip
                  label="Use IOTA Network"
                  icon={useIOTA ? <CheckCircle /> : <Info />}
                  onClick={handleIOTAToggle}
                  color={useIOTA ? "primary" : "default"}
                  variant={useIOTA ? "filled" : "outlined"}
                />
                <Chip
                  label="Cross-Chain Activity"
                  icon={crossChainActivity ? <CheckCircle /> : <Info />}
                  onClick={handleCrossChainToggle}
                  color={crossChainActivity ? "primary" : "default"}
                  variant={crossChainActivity ? "filled" : "outlined"}
                />
              </Stack>
              <Chip
                label="Identity Verified"
                icon={identityVerified ? <CheckCircle /> : <Info />}
                onClick={handleIdentityVerificationToggle}
                color={identityVerified ? "primary" : "default"}
                variant={identityVerified ? "filled" : "outlined"}
              />
            </Grid>
            
            {/* Action Buttons */}
            <Grid item xs={12} sx={{ mt: 2 }}>
              <Button
                variant="contained"
                fullWidth
                onClick={handleRunSimulation}
                startIcon={isSimulating ? <CircularProgress size={20} /> : <Calculate />}
                disabled={isSimulating}
              >
                {isSimulating ? 'Simulating...' : 'Run Simulation'}
              </Button>
              <Button
                variant="outlined"
                fullWidth
                onClick={handleResetSimulation}
                sx={{ mt: 1 }}
              >
                Reset Parameters
              </Button>
            </Grid>
          </Grid>
        </Paper>
      </Grid>
      
      <Grid item xs={12} md={7}>
        <Paper elevation={3} sx={{ p: 3, borderRadius: 2, height: '100%' }}>
          <Typography variant="h6" gutterBottom>
            Simulation Results
          </Typography>
          <Divider sx={{ mb: 3 }} />
          
          {isSimulating ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 400 }}>
              <CircularProgress />
            </Box>
          ) : simulationResults ? (
            <Box>
              {/* Risk Score and Metrics */}
              <Grid container spacing={3} sx={{ mb: 3 }}>
                <Grid item xs={12} sm={6} md={4}>
                  <Card variant="outlined" sx={{ height: '100%' }}>
                    <CardContent>
                      <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                        Simulated Risk Score
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <Box
                          sx={{
                            position: 'relative',
                            display: 'inline-flex',
                            mr: 1
                          }}
                        >
                          <CircularProgress
                            variant="determinate"
                            value={simulationResults.riskScore}
                            size={60}
                            thickness={5}
                            sx={{ color: getRiskColor(simulationResults.riskScore) }}
                          />
                          <Box
                            sx={{
                              top: 0,
                              left: 0,
                              bottom: 0,
                              right: 0,
                              position: 'absolute',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <Typography variant="body1" component="div" fontWeight="medium">
                              {simulationResults.riskScore}
                            </Typography>
                          </Box>
                        </Box>
                        <Typography variant="body2" sx={{ color: getRiskColor(simulationResults.riskScore) }}>
                          {getRiskText(simulationResults.riskScore)}
                        </Typography>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
                
                <Grid item xs={12} sm={6} md={4}>
                  <Card variant="outlined" sx={{ height: '100%' }}>
                    <CardContent>
                      <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                        Interest Rate
                      </Typography>
                      <Typography variant="h6">
                        {simulationResults.interestRate}%
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Annual borrowing rate
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                
                <Grid item xs={12} sm={6} md={4}>
                  <Card variant="outlined" sx={{ height: '100%' }}>
                    <CardContent>
                      <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                        Liquidation Risk
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        {simulationResults.liquidationRisk > 70 ? (
                          <PriorityHigh color="error" sx={{ mr: 1 }} />
                        ) : simulationResults.liquidationRisk > 40 ? (
                          <Info color="warning" sx={{ mr: 1 }} />
                        ) : (
                          <CheckCircle color="success" sx={{ mr: 1 }} />
                        )}
                        <Typography 
                          variant="h6"
                          color={
                            simulationResults.liquidationRisk > 70 ? "error.main" :
                            simulationResults.liquidationRisk > 40 ? "warning.main" :
                            "success.main"
                          }
                        >
                          {simulationResults.liquidationRisk}%
                        </Typography>
                      </Box>
                      <Typography variant="body2" color="text.secondary">
                        Based on collateral ratio
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
              
              {/* Comparison chart */}
              <Typography variant="subtitle1" gutterBottom>
                Risk Score Comparison
              </Typography>
              <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
                <ResponsiveContainer width="100%" height={250}>
                  <ComposedChart
                    data={[
                      { name: 'Current', score: currentRiskScore },
                      { 
                        name: 'Simulated', 
                        score: simulationResults.riskScore,
                        collateralRatio: simulationResults.collateralRatio
                      }
                    ]}
                    margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" />
                    <YAxis domain={[0, 100]} />
                    <RechartsTooltip content={<CustomSimulationTooltip />} />
                    <ReferenceLine y={30} stroke={theme.palette.success.main} strokeDasharray="3 3" />
                    <ReferenceLine y={60} stroke={theme.palette.error.main} strokeDasharray="3 3" />
                    <Bar dataKey="score" fill={theme.palette.primary.main} barSize={60} />
                  </ComposedChart>
                </ResponsiveContainer>
              </Paper>
              
              {/* Risk factor breakdown */}
              <Box sx={{ mb: 2 }}>
                <Button 
                  variant="text" 
                  endIcon={showDetails ? <ExpandLess /> : <ExpandMore />}
                  onClick={() => setShowDetails(!showDetails)}
                >
                  {showDetails ? 'Hide Details' : 'Show Risk Factor Details'}
                </Button>
              </Box>
              
              {showDetails && (
                <Grid container spacing={2} sx={{ mb: 3 }}>
                  {simulationResults.factors.map((factor, index) => (
                    <Grid item xs={12} sm={6} key={index}>
                      <Paper variant="outlined" sx={{ p: 1.5 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Typography variant="body2" fontWeight="medium">
                            {factor.name}
                          </Typography>
                          <Chip
                            label={`${factor.impact < 0 ? '' : '+'}${factor.impact} pts`}
                            size="small"
                            color={factor.impact < 0 ? 'success' : factor.impact > 0 ? 'error' : 'default'}
                            icon={factor.impact < 0 ? <TrendingDown /> : factor.impact > 0 ? <TrendingUp /> : <Info />}
                          />
                        </Box>
                        <Typography variant="caption" color="text.secondary">
                          {factor.description}
                        </Typography>
                      </Paper>
                    </Grid>
                  ))}
                </Grid>
              )}
              
              {/* Suggestion */}
              <Alert 
                severity={
                  simulationResults.riskScore < currentRiskScore ? "success" :
                  simulationResults.riskScore > currentRiskScore ? "warning" :
                  "info"
                }
                sx={{ mb: 2 }}
              >
                {simulationResults.riskScore < currentRiskScore ? (
                  <Typography variant="body2">
                    This strategy would reduce your risk score by {currentRiskScore - simulationResults.riskScore} points,
                    resulting in a better interest rate and lower liquidation risk.
                  </Typography>
                ) : simulationResults.riskScore > currentRiskScore ? (
                  <Typography variant="body2">
                    This strategy would increase your risk score by {simulationResults.riskScore - currentRiskScore} points,
                    resulting in a higher interest rate and increased liquidation risk.
                  </Typography>
                ) : (
                  <Typography variant="body2">
                    This strategy would maintain your current risk score.
                  </Typography>
                )}
              </Alert>
              
              {/* Optimization suggestion */}
              {borrowAmount > simulationResults.maxBorrowAmount && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  <Typography variant="body2">
                    The borrow amount exceeds your maximum borrowing limit of ${simulationResults.maxBorrowAmount}.
                    Consider reducing your borrow amount or increasing collateral.
                  </Typography>
                </Alert>
              )}
              
              {!identityVerified && (
                <Alert severity="info" sx={{ mb: 2 }}>
                  <Typography variant="body2">
                    Verifying your identity would reduce your risk score by up to 15 points and improve your borrowing terms.
                  </Typography>
                </Alert>
              )}
              
              {!useIOTA && (
                <Alert severity="info" sx={{ mb: 2 }}>
                  <Typography variant="body2">
                    Using the IOTA network would reduce your risk score by up to 15 points due to lower fees and faster transaction times.
                  </Typography>
                </Alert>
              )}
            </Box>
          ) : (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 400 }}>
              <Typography variant="body1" color="text.secondary">
                Run a simulation to see results
              </Typography>
            </Box>
          )}
        </Paper>
      </Grid>
    </Grid>
  );
};

export default BorrowingStrategySimulator;
