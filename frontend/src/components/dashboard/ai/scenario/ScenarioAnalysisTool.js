import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Paper,
  Typography,
  Slider,
  TextField,
  Button,
  Divider,
  CircularProgress,
  IconButton,
  Tooltip,
  useTheme,
  alpha,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Alert
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Refresh as RefreshIcon,
  Save as SaveIcon,
  Compare as CompareIcon,
  Info as InfoIcon,
  Check as CheckIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  Cell
} from 'recharts';

const ScenarioAnalysisTool = ({ currentRiskScore, riskFactors, address }) => {
  const theme = useTheme();
  
  // State for scenario management
  const [scenarios, setScenarios] = useState([
    { id: 1, name: 'Current Profile', isBaseline: true, riskScore: currentRiskScore, factors: riskFactors },
    { id: 2, name: 'Modified Scenario', isBaseline: false, riskScore: currentRiskScore, factors: [...riskFactors] }
  ]);
  const [activeScenarioId, setActiveScenarioId] = useState(2);
  const [isCalculating, setIsCalculating] = useState(false);
  const [factorAdjustments, setFactorAdjustments] = useState({});
  
  // Initialize factor adjustments
  useEffect(() => {
    const initialAdjustments = {};
    riskFactors.forEach(factor => {
      initialAdjustments[factor.name] = 0;
    });
    setFactorAdjustments(initialAdjustments);
  }, [riskFactors]);
  
  // Get active scenario
  const activeScenario = scenarios.find(s => s.id === activeScenarioId) || scenarios[0];
  const baselineScenario = scenarios.find(s => s.isBaseline) || scenarios[0];
  
  // Handle factor adjustment
  const handleFactorChange = (factorName, value) => {
    setFactorAdjustments(prev => ({
      ...prev,
      [factorName]: value
    }));
  };
  
  // Calculate new risk score based on adjustments
  const calculateNewRiskScore = () => {
    setIsCalculating(true);
    
    // Simulate API call with a timeout
    setTimeout(() => {
      // Copy base scenario factors
      const modifiedFactors = baselineScenario.factors.map(factor => {
        const adjustment = factorAdjustments[factor.name] || 0;
        
        // Calculate new contribution based on adjustment
        // For simplicity, we directly adjust the contribution
        const newContribution = factor.contribution - adjustment;
        
        return {
          ...factor,
          contribution: newContribution,
          // Adjustment might change the description too
          description: adjustment !== 0 
            ? `${factor.description} (Modified: ${adjustment > 0 ? '+' : ''}${adjustment})`
            : factor.description
        };
      });
      
      // Calculate new risk score by adjusting the baseline
      const contributionSum = Object.values(factorAdjustments).reduce((sum, val) => sum + val, 0);
      const newRiskScore = Math.max(0, Math.min(100, baselineScenario.riskScore - contributionSum));
      
      // Update the active scenario
      setScenarios(prev => 
        prev.map(scenario => 
          scenario.id === activeScenarioId 
            ? { ...scenario, riskScore: newRiskScore, factors: modifiedFactors } 
            : scenario
        )
      );
      
      setIsCalculating(false);
    }, 1000);
  };
  
  // Reset adjustments
  const resetAdjustments = () => {
    const resetValues = {};
    riskFactors.forEach(factor => {
      resetValues[factor.name] = 0;
    });
    setFactorAdjustments(resetValues);
    
    // Reset the active scenario to match baseline
    setScenarios(prev => 
      prev.map(scenario => 
        scenario.id === activeScenarioId 
          ? { ...scenario, riskScore: baselineScenario.riskScore, factors: [...baselineScenario.factors] } 
          : scenario
      )
    );
  };
  
  // Format factor name for display
  const formatFactorName = (name) => {
    return name.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };
  
  // Prepare data for the comparison chart
  const prepareComparisonData = () => {
    return scenarios.map(scenario => ({
      name: scenario.name,
      riskScore: scenario.riskScore,
      fill: scenario.isBaseline ? theme.palette.primary.main : theme.palette.secondary.main
    }));
  };
  
  // Custom tooltip for the comparison chart
  const CustomBarTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
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
            {data.name}
          </Typography>
          <Typography variant="body2">
            <strong>Risk Score:</strong> {data.riskScore.toFixed(1)}
          </Typography>
          <Typography 
            variant="body2" 
            sx={{ 
              color: data.riskScore <= 30 ? theme.palette.success.main : 
                     data.riskScore <= 60 ? theme.palette.warning.main : 
                     theme.palette.error.main 
            }}
          >
            <strong>Risk Level:</strong> {
              data.riskScore <= 30 ? 'Low Risk' : 
              data.riskScore <= 60 ? 'Medium Risk' : 
              'High Risk'
            }
          </Typography>
        </Box>
      );
    }
    return null;
  };
  
  return (
    <Box>
      <Grid container spacing={3}>
        {/* Scenario Comparison Chart */}
        <Grid item xs={12} md={5}>
          <Paper elevation={2} sx={{ p: 3, height: '100%' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="h6" gutterBottom>
                Scenario Comparison
              </Typography>
              <Tooltip title="Calculate new risk score based on your adjustments">
                <Button
                  variant="contained"
                  color="primary"
                  startIcon={isCalculating ? <CircularProgress size={20} /> : <CompareIcon />}
                  onClick={calculateNewRiskScore}
                  disabled={isCalculating || Object.values(factorAdjustments).every(val => val === 0)}
                  sx={{ borderRadius: 2 }}
                >
                  Calculate Impact
                </Button>
              </Tooltip>
            </Box>
            
            <Box sx={{ height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={prepareComparisonData()}
                  layout="vertical"
                  margin={{
                    top: 20,
                    right: 30,
                    left: 20,
                    bottom: 5,
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={alpha(theme.palette.divider, 0.7)} />
                  <XAxis 
                    type="number"
                    domain={[0, 100]} 
                    stroke={theme.palette.text.secondary}
                  />
                  <YAxis 
                    dataKey="name" 
                    type="category" 
                    stroke={theme.palette.text.secondary}
                  />
                  <RechartsTooltip content={<CustomBarTooltip />} />
                  <ReferenceLine x={30} stroke={theme.palette.success.main} strokeDasharray="3 3" />
                  <ReferenceLine x={60} stroke={theme.palette.warning.main} strokeDasharray="3 3" />
                  <Bar dataKey="riskScore" name="Risk Score" radius={[0, 4, 4, 0]}>
                    {prepareComparisonData().map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={
                          entry.riskScore <= 30 ? theme.palette.success.main : 
                          entry.riskScore <= 60 ? theme.palette.warning.main : 
                          theme.palette.error.main
                        } 
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Box>
            
            <Box sx={{ mt: 2 }}>
              <Alert severity="info" sx={{ mb: 2 }}>
                Adjust the factors on the right and click "Calculate Impact" to see how they would affect your risk score.
              </Alert>
              
              <Grid container spacing={2} alignItems="center">
                <Grid item xs={4}>
                  <Typography variant="body2" color="text.secondary">
                    Current Risk Score:
                  </Typography>
                  <Typography variant="h6" fontWeight="medium">
                    {baselineScenario.riskScore.toFixed(1)}
                  </Typography>
                </Grid>
                <Grid item xs={4}>
                  <Typography variant="body2" color="text.secondary">
                    Modified Risk Score:
                  </Typography>
                  <Typography 
                    variant="h6" 
                    fontWeight="medium"
                    color={
                      activeScenario.riskScore < baselineScenario.riskScore 
                        ? theme.palette.success.main 
                        : activeScenario.riskScore > baselineScenario.riskScore
                          ? theme.palette.error.main
                          : 'text.primary'
                    }
                  >
                    {activeScenario.riskScore.toFixed(1)}
                    {activeScenario.riskScore !== baselineScenario.riskScore && (
                      <Typography 
                        component="span" 
                        variant="body2" 
                        color={
                          activeScenario.riskScore < baselineScenario.riskScore 
                            ? theme.palette.success.main 
                            : theme.palette.error.main
                        }
                        sx={{ ml: 1 }}
                      >
                        ({activeScenario.riskScore < baselineScenario.riskScore ? '-' : '+'}
                        {Math.abs(activeScenario.riskScore - baselineScenario.riskScore).toFixed(1)})
                      </Typography>
                    )}
                  </Typography>
                </Grid>
                <Grid item xs={4}>
                  <Button 
                    variant="outlined"
                    color="secondary"
                    startIcon={<RefreshIcon />}
                    onClick={resetAdjustments}
                    sx={{ borderRadius: 2 }}
                    fullWidth
                  >
                    Reset
                  </Button>
                </Grid>
              </Grid>
            </Box>
          </Paper>
        </Grid>
        
        {/* Factor Adjustment Controls */}
        <Grid item xs={12} md={7}>
          <Paper elevation={2} sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Adjust Risk Factors
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              Move the sliders to simulate changes to your risk factors. Positive values reduce risk, negative values increase risk.
            </Typography>
            
            <Divider sx={{ my: 2 }} />
            
            <Box sx={{ maxHeight: 400, overflow: 'auto', pr: 1 }}>
              {baselineScenario.factors.map((factor, index) => (
                <Accordion 
                  key={factor.name} 
                  disableGutters 
                  elevation={0}
                  sx={{ 
                    border: `1px solid ${theme.palette.divider}`,
                    '&:not(:last-child)': {
                      borderBottom: 0,
                    },
                    '&:before': {
                      display: 'none',
                    },
                    borderRadius: index === 0 ? '8px 8px 0 0' : index === baselineScenario.factors.length - 1 ? '0 0 8px 8px' : 0,
                    mb: index === baselineScenario.factors.length - 1 ? 0 : 0.5,
                  }}
                >
                  <AccordionSummary
                    expandIcon={<ExpandMoreIcon />}
                    sx={{ 
                      backgroundColor: theme.palette.background.paper,
                      borderLeft: `4px solid ${factor.contribution > 0 ? theme.palette.error.main : theme.palette.success.main}`,
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', pr: 2 }}>
                      <Typography variant="subtitle2">
                        {formatFactorName(factor.name)}
                      </Typography>
                      <Box 
                        sx={{ 
                          display: 'flex', 
                          alignItems: 'center',
                          backgroundColor: alpha(
                            factorAdjustments[factor.name] > 0 
                              ? theme.palette.success.main 
                              : factorAdjustments[factor.name] < 0
                                ? theme.palette.error.main
                                : theme.palette.grey[300], 
                            0.1
                          ),
                          px: 1,
                          py: 0.5,
                          borderRadius: 1,
                          ml: 2
                        }}
                      >
                        {factorAdjustments[factor.name] !== 0 && (
                          <>
                            {factorAdjustments[factor.name] > 0 ? (
                              <CheckIcon 
                                fontSize="small" 
                                sx={{ 
                                  color: theme.palette.success.main,
                                  mr: 0.5,
                                  fontSize: '1rem'
                                }} 
                              />
                            ) : (
                              <CloseIcon 
                                fontSize="small" 
                                sx={{ 
                                  color: theme.palette.error.main,
                                  mr: 0.5,
                                  fontSize: '1rem'
                                }} 
                              />
                            )}
                          </>
                        )}
                        <Typography 
                          variant="body2" 
                          sx={{ 
                            fontWeight: 'medium',
                            color: factorAdjustments[factor.name] > 0 
                              ? theme.palette.success.main 
                              : factorAdjustments[factor.name] < 0
                                ? theme.palette.error.main
                                : theme.palette.text.secondary
                          }}
                        >
                          {factorAdjustments[factor.name] > 0 ? '+' : ''}
                          {factorAdjustments[factor.name]}
                        </Typography>
                      </Box>
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Box sx={{ py: 1 }}>
                      <Typography variant="body2" color="text.secondary" paragraph>
                        {factor.description}
                      </Typography>
                      
                      <Grid container spacing={2} alignItems="center">
                        <Grid item xs>
                          <Slider
                            value={factorAdjustments[factor.name] || 0}
                            min={-10}
                            max={10}
                            step={1}
                            valueLabelDisplay="auto"
                            onChange={(_, value) => handleFactorChange(factor.name, value)}
                            marks={[
                              { value: -10, label: '-10' },
                              { value: 0, label: '0' },
                              { value: 10, label: '+10' },
                            ]}
                            sx={{
                              '& .MuiSlider-valueLabel': {
                                backgroundColor: theme.palette.primary.main,
                              },
                              '& .MuiSlider-markLabel': {
                                fontSize: '0.75rem',
                              },
                            }}
                          />
                        </Grid>
                        <Grid item>
                          <TextField
                            value={factorAdjustments[factor.name] || 0}
                            onChange={(e) => {
                              const value = parseInt(e.target.value, 10);
                              if (!isNaN(value) && value >= -10 && value <= 10) {
                                handleFactorChange(factor.name, value);
                              }
                            }}
                            inputProps={{
                              step: 1,
                              min: -10,
                              max: 10,
                              type: 'number',
                            }}
                            sx={{ width: 80 }}
                            size="small"
                          />
                        </Grid>
                      </Grid>
                      
                      <Box 
                        sx={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          mt: 2,
                          p: 1,
                          borderRadius: 1,
                          backgroundColor: alpha(theme.palette.info.main, 0.05)
                        }}
                      >
                        <InfoIcon 
                          fontSize="small" 
                          sx={{ 
                            color: theme.palette.info.main,
                            mr: 1
                          }} 
                        />
                        <Typography variant="body2" color="text.secondary">
                          {factor.details}
                        </Typography>
                      </Box>
                    </Box>
                  </AccordionDetails>
                </Accordion>
              ))}
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default ScenarioAnalysisTool;
