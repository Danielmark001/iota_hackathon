import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Paper,
  Typography,
  TextField,
  Button,
  Card,
  CardContent,
  Divider,
  IconButton,
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControlLabel,
  Switch,
  Tab,
  Tabs,
  Alert,
  Chip,
  Stack,
  Tooltip,
  useTheme
} from '@mui/material';
import {
  Add,
  Delete,
  Compare,
  Save,
  PlayArrow,
  Edit,
  MoreVert,
  BarChart,
  PieChart,
  BubbleChart,
  Close,
  CheckCircle,
} from '@mui/icons-material';

import {
  BarChart as RechartsBarChart,
  Bar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ReferenceLine,
  Scatter,
  Cell
} from 'recharts';

// Simulated API call to get scenario analysis
const simulateScenarioAnalysis = async (scenarios) => {
  // In production, this would be an API call
  return new Promise((resolve) => {
    setTimeout(() => {
      // Process each scenario
      const results = scenarios.map(scenario => {
        // Simple risk model for simulation
        const { 
          collateralAmount, 
          borrowAmount, 
          asset,
          useIOTA,
          crossChainActivity,
          identityVerified,
          name
        } = scenario;
        
        // Base risk factors
        const collateralRatio = collateralAmount / (borrowAmount || 1); // Avoid division by zero
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
        
        // Return scenario results
        return {
          scenarioName: name,
          riskScore: Math.round(riskScore),
          collateralRatio,
          liquidationRisk: Math.round(liquidationRisk),
          interestRate: interestRate.toFixed(2),
          maxBorrowAmount: maxBorrowAmount.toFixed(2),
          collateralAmount,
          borrowAmount,
          asset,
          useIOTA,
          crossChainActivity,
          identityVerified,
          factors: [
            { 
              name: 'Collateral Ratio', 
              value: (100 - collateralRatioImpact * 2),
              impact: collateralRatioImpact,
              fullMark: 100
            },
            { 
              name: 'Asset Selection', 
              value: (100 - assetImpact * 2),
              impact: assetImpact,
              fullMark: 100
            },
            { 
              name: 'IOTA Integration', 
              value: useIOTA ? 100 : 50,
              impact: iotaImpact,
              fullMark: 100
            },
            { 
              name: 'Cross-Chain Activity', 
              value: crossChainActivity ? 100 : 50,
              impact: crossChainImpact,
              fullMark: 100
            },
            { 
              name: 'Identity Verification', 
              value: identityVerified ? 100 : 50,
              impact: identityImpact,
              fullMark: 100
            }
          ]
        };
      });
      
      resolve(results);
    }, 800);
  });
};

// Default scenarios
const DEFAULT_SCENARIOS = [
  {
    name: 'Current Strategy',
    collateralAmount: 1000,
    borrowAmount: 500,
    asset: 'smr',
    useIOTA: true,
    crossChainActivity: false,
    identityVerified: false
  },
  {
    name: 'Higher Collateral',
    collateralAmount: 1500,
    borrowAmount: 500,
    asset: 'smr',
    useIOTA: true,
    crossChainActivity: false,
    identityVerified: false
  },
  {
    name: 'Verified Identity',
    collateralAmount: 1000,
    borrowAmount: 500,
    asset: 'smr',
    useIOTA: true,
    crossChainActivity: false,
    identityVerified: true
  }
];

// TabPanel component
function TabPanel(props) {
  const { children, value, index, ...other } = props;
  
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`scenario-tabpanel-${index}`}
      aria-labelledby={`scenario-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ pt: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

const ScenarioAnalysisTool = ({ currentRiskScore = 50, riskFactors = [], address }) => {
  const theme = useTheme();
  
  // State for scenarios
  const [scenarios, setScenarios] = useState(DEFAULT_SCENARIOS);
  const [editingScenario, setEditingScenario] = useState(null);
  const [scenarioDialogOpen, setScenarioDialogOpen] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResults, setAnalysisResults] = useState([]);
  
  // State for visualization
  const [activeTab, setActiveTab] = useState(0);
  
  // Handle analyze scenarios
  const handleAnalyzeScenarios = async () => {
    setIsAnalyzing(true);
    
    try {
      // Call API to analyze scenarios
      const results = await simulateScenarioAnalysis(scenarios);
      
      // Set analysis results
      setAnalysisResults(results);
    } catch (error) {
      console.error('Error analyzing scenarios:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };
  
  // Run analysis when component mounts or scenarios change
  useEffect(() => {
    handleAnalyzeScenarios();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  // Handle tab change
  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };
  
  // Handle open scenario dialog
  const handleOpenScenarioDialog = (scenario = null) => {
    if (scenario) {
      setEditingScenario({ ...scenario });
    } else {
      setEditingScenario({
        name: `Scenario ${scenarios.length + 1}`,
        collateralAmount: 1000,
        borrowAmount: 500,
        asset: 'smr',
        useIOTA: true,
        crossChainActivity: false,
        identityVerified: false
      });
    }
    setScenarioDialogOpen(true);
  };
  
  // Handle close scenario dialog
  const handleCloseScenarioDialog = () => {
    setScenarioDialogOpen(false);
    setEditingScenario(null);
  };
  
  // Handle save scenario
  const handleSaveScenario = () => {
    if (editingScenario) {
      // Check if editing existing scenario
      const existingIndex = scenarios.findIndex(s => s.name === editingScenario.name);
      
      if (existingIndex >= 0) {
        // Update existing scenario
        const updatedScenarios = [...scenarios];
        updatedScenarios[existingIndex] = { ...editingScenario };
        setScenarios(updatedScenarios);
      } else {
        // Add new scenario
        setScenarios([...scenarios, editingScenario]);
      }
    }
    
    // Close dialog
    handleCloseScenarioDialog();
    
    // Re-run analysis
    handleAnalyzeScenarios();
  };
  
  // Handle delete scenario
  const handleDeleteScenario = (scenarioName) => {
    const updatedScenarios = scenarios.filter(s => s.name !== scenarioName);
    setScenarios(updatedScenarios);
    
    // Update analysis results
    const updatedAnalysisResults = analysisResults.filter(r => r.scenarioName !== scenarioName);
    setAnalysisResults(updatedAnalysisResults);
  };
  
  // Handle scenario input change
  const handleScenarioChange = (field, value) => {
    if (editingScenario) {
      setEditingScenario({
        ...editingScenario,
        [field]: value
      });
    }
  };
  
  // Get risk color
  const getRiskColor = (score) => {
    if (score <= 30) return theme.palette.success.main;
    if (score <= 60) return theme.palette.warning.main;
    return theme.palette.error.main;
  };
  
  // Custom chart tooltip
  const CustomChartTooltip = ({ active, payload, label }) => {
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
            {label}
          </Typography>
          <Typography variant="body2" sx={{ color: payload[0].color }}>
            Risk Score: {payload[0].value}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Collateral: ${payload[0].payload.collateralAmount}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Borrow: ${payload[0].payload.borrowAmount}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Ratio: {payload[0].payload.collateralRatio.toFixed(2)}x
          </Typography>
        </Box>
      );
    }
    return null;
  };
  
  // Custom radar tooltip
  const CustomRadarTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      
      return (
        <Box sx={{ 
          bgcolor: 'background.paper', 
          p: 1.5,
          border: `1px solid ${theme.palette.divider}`,
          borderRadius: 1,
          boxShadow: theme.shadows[1]
        }}>
          <Typography variant="subtitle2">
            {data.name}
          </Typography>
          {payload.map((entry, index) => (
            <Typography 
              key={index} 
              variant="body2" 
              sx={{ color: entry.color }}
            >
              {entry.name}: {entry.value}
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
        <Grid item xs={12}>
          <Paper elevation={3} sx={{ p: 3, borderRadius: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">
                Scenario Analysis
              </Typography>
              <Button
                variant="contained"
                color="primary"
                startIcon={<Add />}
                onClick={() => handleOpenScenarioDialog()}
              >
                Add Scenario
              </Button>
            </Box>
            
            <Typography variant="body2" color="text.secondary" paragraph>
              Compare different borrowing scenarios to understand their impact on your risk profile and borrowing terms.
            </Typography>
            
            <Divider sx={{ mb: 3 }} />
            
            {/* Scenario cards */}
            <Grid container spacing={2} sx={{ mb: 4 }}>
              {scenarios.map((scenario, index) => {
                // Find analysis result for this scenario
                const result = analysisResults.find(r => r.scenarioName === scenario.name);
                
                return (
                  <Grid item xs={12} sm={6} md={4} key={index}>
                    <Card variant="outlined" sx={{ height: '100%' }}>
                      <CardContent>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <Typography variant="subtitle1" gutterBottom>
                            {scenario.name}
                          </Typography>
                          <Box>
                            <IconButton 
                              size="small" 
                              onClick={() => handleOpenScenarioDialog(scenario)}
                              aria-label="edit scenario"
                            >
                              <Edit fontSize="small" />
                            </IconButton>
                            <IconButton 
                              size="small" 
                              onClick={() => handleDeleteScenario(scenario.name)}
                              aria-label="delete scenario"
                              disabled={scenarios.length <= 1}
                            >
                              <Delete fontSize="small" />
                            </IconButton>
                          </Box>
                        </Box>
                        
                        {result ? (
                          <>
                            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                              <Typography variant="body2" color="text.secondary" sx={{ mr: 1 }}>
                                Risk Score:
                              </Typography>
                              <Typography 
                                variant="body1" 
                                fontWeight="medium" 
                                sx={{ color: getRiskColor(result.riskScore) }}
                              >
                                {result.riskScore}
                              </Typography>
                            </Box>
                            
                            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                              <Typography variant="body2" color="text.secondary" sx={{ mr: 1 }}>
                                Interest Rate:
                              </Typography>
                              <Typography variant="body1" fontWeight="medium">
                                {result.interestRate}%
                              </Typography>
                            </Box>
                            
                            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                              <Typography variant="body2" color="text.secondary" sx={{ mr: 1 }}>
                                Collateral Ratio:
                              </Typography>
                              <Typography variant="body1" fontWeight="medium">
                                {result.collateralRatio.toFixed(2)}x
                              </Typography>
                            </Box>
                            
                            <Divider sx={{ my: 1 }} />
                            
                            <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: 'wrap', gap: 0.5 }}>
                              <Chip 
                                label={`$${scenario.collateralAmount} Collateral`} 
                                size="small" 
                                variant="outlined" 
                                color="primary"
                              />
                              <Chip 
                                label={`$${scenario.borrowAmount} Borrow`} 
                                size="small" 
                                variant="outlined" 
                                color="primary"
                              />
                              <Chip 
                                label={scenario.asset.toUpperCase()} 
                                size="small" 
                                variant="outlined" 
                              />
                              {scenario.useIOTA && (
                                <Chip 
                                  label="IOTA" 
                                  size="small" 
                                  color="secondary"
                                  variant="outlined"
                                />
                              )}
                              {scenario.identityVerified && (
                                <Chip 
                                  label="Verified" 
                                  size="small" 
                                  color="success"
                                  variant="outlined"
                                  icon={<CheckCircle fontSize="small" />}
                                />
                              )}
                            </Stack>
                          </>
                        ) : (
                          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 2 }}>
                            <CircularProgress size={20} />
                          </Box>
                        )}
                      </CardContent>
                    </Card>
                  </Grid>
                );
              })}
            </Grid>
            
            {/* Analyze button */}
            <Box sx={{ display: 'flex', justifyContent: 'center', mb: 4 }}>
              <Button
                variant="contained"
                color="primary"
                startIcon={isAnalyzing ? <CircularProgress size={20} /> : <PlayArrow />}
                onClick={handleAnalyzeScenarios}
                disabled={isAnalyzing || scenarios.length === 0}
              >
                {isAnalyzing ? 'Analyzing...' : 'Analyze Scenarios'}
              </Button>
            </Box>
            
            {/* Analysis visualization */}
            {analysisResults.length > 0 && (
              <Box>
                <Typography variant="h6" gutterBottom>
                  Scenario Comparison
                </Typography>
                
                <Tabs
                  value={activeTab}
                  onChange={handleTabChange}
                  variant="scrollable"
                  scrollButtons="auto"
                  sx={{ mb: 2 }}
                >
                  <Tab icon={<BarChart />} label="Risk Comparison" id="scenario-tab-0" aria-controls="scenario-tabpanel-0" />
                  <Tab icon={<PieChart />} label="Radar Analysis" id="scenario-tab-1" aria-controls="scenario-tabpanel-1" />
                  <Tab icon={<BubbleChart />} label="Risk Matrix" id="scenario-tab-2" aria-controls="scenario-tabpanel-2" />
                </Tabs>
                
                <TabPanel value={activeTab} index={0}>
                  <Typography variant="subtitle2" gutterBottom>
                    Risk Score Comparison by Scenario
                  </Typography>
                  <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart
                        data={analysisResults}
                        margin={{ top: 20, right: 30, left: 20, bottom: 70 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis 
                          dataKey="scenarioName" 
                          angle={-45} 
                          textAnchor="end"
                          tick={{ fontSize: 12 }}
                          height={70}
                        />
                        <YAxis domain={[0, 100]} />
                        <RechartsTooltip content={<CustomChartTooltip />} />
                        <ReferenceLine y={30} stroke={theme.palette.success.main} strokeDasharray="3 3" />
                        <ReferenceLine y={60} stroke={theme.palette.error.main} strokeDasharray="3 3" />
                        <Bar 
                          dataKey="riskScore" 
                          name="Risk Score"
                          fill={theme.palette.primary.main}
                        >
                          {analysisResults.map((entry, index) => (
                            <Cell 
                              key={`cell-${index}`} 
                              fill={getRiskColor(entry.riskScore)} 
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </Paper>
                  
                  <Grid container spacing={2}>
                    <Grid item xs={12} md={6}>
                      <Typography variant="subtitle2" gutterBottom>
                        Interest Rate Comparison
                      </Typography>
                      <Paper variant="outlined" sx={{ p: 2 }}>
                        <ResponsiveContainer width="100%" height={250}>
                          <BarChart
                            data={analysisResults}
                            margin={{ top: 20, right: 30, left: 20, bottom: 70 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis 
                              dataKey="scenarioName" 
                              angle={-45} 
                              textAnchor="end"
                              tick={{ fontSize: 12 }}
                              height={70}
                            />
                            <YAxis domain={[0, 15]} />
                            <RechartsTooltip />
                            <Bar 
                              dataKey="interestRate" 
                              name="Interest Rate (%)"
                              fill={theme.palette.info.main}
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      </Paper>
                    </Grid>
                    
                    <Grid item xs={12} md={6}>
                      <Typography variant="subtitle2" gutterBottom>
                        Liquidation Risk Comparison
                      </Typography>
                      <Paper variant="outlined" sx={{ p: 2 }}>
                        <ResponsiveContainer width="100%" height={250}>
                          <BarChart
                            data={analysisResults}
                            margin={{ top: 20, right: 30, left: 20, bottom: 70 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis 
                              dataKey="scenarioName" 
                              angle={-45} 
                              textAnchor="end"
                              tick={{ fontSize: 12 }}
                              height={70}
                            />
                            <YAxis domain={[0, 100]} />
                            <RechartsTooltip />
                            <Bar 
                              dataKey="liquidationRisk" 
                              name="Liquidation Risk (%)"
                              fill={theme.palette.error.main}
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      </Paper>
                    </Grid>
                  </Grid>
                </TabPanel>
                
                <TabPanel value={activeTab} index={1}>
                  <Typography variant="subtitle2" gutterBottom>
                    Factor Analysis by Scenario
                  </Typography>
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    <ResponsiveContainer width="100%" height={400}>
                      <RadarChart outerRadius={150} data={analysisResults[0].factors}>
                        <PolarGrid />
                        <PolarAngleAxis dataKey="name" />
                        <PolarRadiusAxis angle={90} domain={[0, 100]} />
                        <RechartsTooltip content={<CustomRadarTooltip />} />
                        {analysisResults.map((scenario, index) => (
                          <Radar
                            key={index}
                            name={scenario.scenarioName}
                            dataKey="value"
                            stroke={theme.palette.primary.main}
                            fill={theme.palette.primary.main}
                            fillOpacity={0.2 + (index * 0.1)}
                            data={scenario.factors}
                          />
                        ))}
                        <Legend />
                      </RadarChart>
                    </ResponsiveContainer>
                  </Paper>
                  
                  <Alert severity="info" sx={{ mt: 2 }}>
                    <Typography variant="body2">
                      The radar chart shows how each scenario performs across different risk factors. Higher values indicate better performance in that category.
                    </Typography>
                  </Alert>
                </TabPanel>
                
                <TabPanel value={activeTab} index={2}>
                  <Typography variant="subtitle2" gutterBottom>
                    Risk Matrix (Collateral Ratio vs. Risk Score)
                  </Typography>
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    <ResponsiveContainer width="100%" height={400}>
                      <ComposedChart
                        data={analysisResults}
                        margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis 
                          dataKey="collateralRatio" 
                          type="number" 
                          name="Collateral Ratio" 
                          domain={[1, 'dataMax']}
                          label={{ value: 'Collateral Ratio', position: 'insideBottom', offset: -10 }}
                          tickFormatter={(value) => value.toFixed(1) + 'x'}
                        />
                        <YAxis 
                          dataKey="riskScore" 
                          domain={[0, 100]} 
                          label={{ value: 'Risk Score', angle: -90, position: 'insideLeft' }}
                        />
                        <RechartsTooltip content={<CustomChartTooltip />} />
                        <ReferenceLine y={30} stroke={theme.palette.success.main} strokeDasharray="3 3" />
                        <ReferenceLine y={60} stroke={theme.palette.error.main} strokeDasharray="3 3" />
                        <ReferenceLine x={1.5} stroke={theme.palette.warning.main} strokeDasharray="3 3" />
                        <Scatter 
                          name="Scenario" 
                          dataKey="borrowAmount"
                          fill={theme.palette.primary.main}
                        >
                          {analysisResults.map((entry, index) => (
                            <Cell 
                              key={`cell-${index}`} 
                              fill={getRiskColor(entry.riskScore)} 
                            />
                          ))}
                        </Scatter>
                      </ComposedChart>
                    </ResponsiveContainer>
                  </Paper>
                  
                  <Alert severity="info" sx={{ mt: 2 }}>
                    <Typography variant="body2">
                      The risk matrix shows the relationship between collateral ratio and risk score. The size of each bubble represents the borrow amount.
                      The best scenarios are in the top-right quadrant with high collateral ratio and low risk score.
                    </Typography>
                  </Alert>
                </TabPanel>
              </Box>
            )}
          </Paper>
        </Grid>
      </Grid>
      
      {/* Scenario Edit Dialog */}
      <Dialog
        open={scenarioDialogOpen}
        onClose={handleCloseScenarioDialog}
        aria-labelledby="scenario-dialog-title"
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle id="scenario-dialog-title">
          {editingScenario && editingScenario.name !== '' ? `Edit ${editingScenario.name}` : 'Create New Scenario'}
          <IconButton
            aria-label="close"
            onClick={handleCloseScenarioDialog}
            sx={{
              position: 'absolute',
              right: 8,
              top: 8,
            }}
          >
            <Close />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  label="Scenario Name"
                  value={editingScenario ? editingScenario.name : ''}
                  onChange={(e) => handleScenarioChange('name', e.target.value)}
                  fullWidth
                  variant="outlined"
                  margin="normal"
                />
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Collateral Amount"
                  value={editingScenario ? editingScenario.collateralAmount : 0}
                  onChange={(e) => {
                    const value = parseFloat(e.target.value);
                    if (!isNaN(value) && value >= 0) {
                      handleScenarioChange('collateralAmount', value);
                    }
                  }}
                  fullWidth
                  type="number"
                  variant="outlined"
                  margin="normal"
                  InputProps={{
                    startAdornment: <InputAdornment position="start">$</InputAdornment>,
                  }}
                />
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Borrow Amount"
                  value={editingScenario ? editingScenario.borrowAmount : 0}
                  onChange={(e) => {
                    const value = parseFloat(e.target.value);
                    if (!isNaN(value) && value >= 0) {
                      handleScenarioChange('borrowAmount', value);
                    }
                  }}
                  fullWidth
                  type="number"
                  variant="outlined"
                  margin="normal"
                  InputProps={{
                    startAdornment: <InputAdornment position="start">$</InputAdornment>,
                  }}
                />
              </Grid>
              
              <Grid item xs={12}>
                <FormControl fullWidth variant="outlined" margin="normal">
                  <InputLabel id="asset-select-label">Asset</InputLabel>
                  <Select
                    labelId="asset-select-label"
                    value={editingScenario ? editingScenario.asset : 'smr'}
                    onChange={(e) => handleScenarioChange('asset', e.target.value)}
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
              
              <Grid item xs={12}>
                <Typography variant="subtitle2" gutterBottom sx={{ mt: 1 }}>
                  Advanced Options
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={4}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={editingScenario ? editingScenario.useIOTA : false}
                          onChange={(e) => handleScenarioChange('useIOTA', e.target.checked)}
                          color="primary"
                        />
                      }
                      label="Use IOTA Network"
                    />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={editingScenario ? editingScenario.crossChainActivity : false}
                          onChange={(e) => handleScenarioChange('crossChainActivity', e.target.checked)}
                          color="primary"
                        />
                      }
                      label="Cross-Chain Activity"
                    />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={editingScenario ? editingScenario.identityVerified : false}
                          onChange={(e) => handleScenarioChange('identityVerified', e.target.checked)}
                          color="primary"
                        />
                      }
                      label="Identity Verified"
                    />
                  </Grid>
                </Grid>
              </Grid>
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseScenarioDialog} color="inherit">
            Cancel
          </Button>
          <Button 
            onClick={handleSaveScenario} 
            color="primary" 
            variant="contained"
            startIcon={<Save />}
          >
            Save Scenario
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ScenarioAnalysisTool;
