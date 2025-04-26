import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Grid, 
  Paper, 
  Typography, 
  Tabs, 
  Tab, 
  CircularProgress,
  Button,
  IconButton,
  Tooltip,
  Container,
  Divider,
  Alert,
  useTheme
} from '@mui/material';
import {
  Refresh,
  Info,
  Dashboard,
  CompareArrows,
  Science,
  Lightbulb
} from '@mui/icons-material';

// Import visualization components
import RiskFactorBreakdownChart from './visualization/RiskFactorBreakdownChart';
import RiskTimelineChart from './visualization/RiskTimelineChart';
import RiskComparisonRadar from './visualization/RiskComparisonRadar';
import FactorImpactHeatmap from './visualization/FactorImpactHeatmap';

// Import scenario analysis components
import ScenarioAnalysisTool from './scenario/ScenarioAnalysisTool';

// Import simulator components
import BorrowingStrategySimulator from './simulator/BorrowingStrategySimulator';

// Import recommendation components
import ActionableInsightsPanel from './recommendations/ActionableInsightsPanel';

// Import API service
import apiService from '../../../services/apiService';

// Import contexts
import { useWeb3 } from '../../../context/Web3Context';
import { useSnackbar } from '../../../context/SnackbarContext';

// TabPanel component for tab content
function TabPanel(props) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`ai-dashboard-tabpanel-${index}`}
      aria-labelledby={`ai-dashboard-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

const ExplainableAIDashboard = () => {
  const theme = useTheme();
  const { currentAccount } = useWeb3();
  const { showSnackbar } = useSnackbar();
  
  // State
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tabValue, setTabValue] = useState(0);
  const [riskAssessment, setRiskAssessment] = useState(null);
  const [riskFactors, setRiskFactors] = useState([]);
  const [timelineData, setTimelineData] = useState([]);
  const [modelPerformance, setModelPerformance] = useState(null);
  const [featureImportance, setFeatureImportance] = useState([]);
  
  // Load risk assessment data when component mounts or address changes
  useEffect(() => {
    const fetchRiskData = async () => {
      if (!currentAccount) return;
      
      setLoading(true);
      try {
        // Fetch risk assessment data
        const riskData = await apiService.getRiskAssessment(currentAccount);
        setRiskAssessment(riskData);
        
        // Set risk factors from assessment
        if (riskData && riskData.topFactors) {
          setRiskFactors(riskData.topFactors);
        }
        
        // Fetch timeline data
        try {
          const timelineResponse = await fetch(`/api/risk-assessment/timeline/${currentAccount}`);
          if (timelineResponse.ok) {
            const timelineData = await timelineResponse.json();
            setTimelineData(timelineData);
          }
        } catch (timelineError) {
          console.warn('Timeline data not available:', timelineError);
          // Generate mock timeline data for development
          const mockTimelineData = generateMockTimelineData();
          setTimelineData(mockTimelineData);
        }
        
        // Fetch model performance (if user is authenticated)
        try {
          const performanceResponse = await fetch('/api/risk-assessment/model/performance');
          if (performanceResponse.ok) {
            const performanceData = await performanceResponse.json();
            setModelPerformance(performanceData);
          }
        } catch (performanceError) {
          console.warn('Model performance data not available:', performanceError);
        }
        
        // Fetch feature importance
        try {
          const importanceResponse = await fetch('/api/risk-assessment/model/feature-importance');
          if (importanceResponse.ok) {
            const importanceData = await importanceResponse.json();
            setFeatureImportance(importanceData.features);
          }
        } catch (importanceError) {
          console.warn('Feature importance data not available:', importanceError);
        }
      } catch (error) {
        console.error('Error loading risk assessment data:', error);
        showSnackbar('Failed to load risk assessment data', 'error');
        
        // Set mock data for development
        setMockData();
      } finally {
        setLoading(false);
      }
    };
    
    fetchRiskData();
  }, [currentAccount, showSnackbar]);
  
  // Generate mock timeline data for development
  const generateMockTimelineData = () => {
    const today = new Date();
    const mockData = [];
    
    for (let i = 30; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      
      // Start with a risk score between 40-60 and add some random variation
      const baseScore = 50;
      const randomVariation = Math.floor(Math.random() * 20) - 10; // -10 to +10
      const score = Math.max(0, Math.min(100, baseScore + randomVariation));
      
      mockData.push({
        date: date.toISOString(),
        score: score
      });
    }
    
    return mockData;
  };
  
  // Set mock data for development when API is not available
  const setMockData = () => {
    setRiskAssessment({
      address: currentAccount,
      riskScore: 45,
      riskClass: 'Medium Risk',
      confidence: 0.85,
      recommendations: [
        {
          title: 'Verify Your Identity',
          description: 'Complete identity verification to reduce your risk score by up to 15 points.',
          impact: 'high',
          type: 'verification',
          details: 'Verifying your identity using IOTA\'s decentralized identity solution provides a cryptographically secure way to prove your identity while maintaining privacy.'
        },
        {
          title: 'Increase Collateral Ratio',
          description: 'Your current health factor is lower than optimal. Consider adding more collateral.',
          impact: 'medium',
          type: 'collateral',
          details: 'A higher collateral ratio provides more security against market volatility and reduces liquidation risk. We recommend a minimum collateral ratio of 150%.'
        },
        {
          title: 'Increase IOTA Network Activity',
          description: 'Building a stronger history on the IOTA network improves your risk assessment.',
          impact: 'medium',
          type: 'activity',
          details: 'Regular transactions on the IOTA network demonstrate stable behavior and improve your on-chain reputation score.'
        }
      ],
      topFactors: [
        {
          name: 'transaction_history',
          impact: 0.35,
          description: 'Consistent transaction history shows reliable behavior',
          contribution: -10,
          details: 'Your transaction history shows regular activity over the past 3 months, which is a positive indicator of financial stability.'
        },
        {
          name: 'collateral_ratio',
          impact: 0.25,
          description: 'Current collateral ratio is below optimal levels',
          contribution: 15,
          details: 'Your current collateral ratio of 125% is below the recommended 150%, which increases liquidation risk during market volatility.'
        },
        {
          name: 'wallet_age',
          impact: 0.15,
          description: 'Wallet has been active for a moderate period',
          contribution: -5,
          details: 'Your wallet has been active for 6 months, which provides some history but not enough for maximum confidence.'
        },
        {
          name: 'repayment_history',
          impact: 0.15,
          description: 'Good history of repaying loans on time',
          contribution: -8,
          details: 'You have successfully repaid 3 previous loans, which positively affects your risk assessment.'
        },
        {
          name: 'cross_chain_activity',
          impact: 0.10,
          description: 'Limited activity across multiple chains',
          contribution: 3,
          details: 'More cross-chain activity between IOTA L1 and L2 would demonstrate broader blockchain usage and expertise.'
        }
      ],
      analysisTimestamp: Date.now()
    });
    
    setRiskFactors([
      {
        name: 'transaction_history',
        impact: 0.35,
        description: 'Consistent transaction history shows reliable behavior',
        contribution: -10,
        details: 'Your transaction history shows regular activity over the past 3 months, which is a positive indicator of financial stability.'
      },
      {
        name: 'collateral_ratio',
        impact: 0.25,
        description: 'Current collateral ratio is below optimal levels',
        contribution: 15,
        details: 'Your current collateral ratio of 125% is below the recommended 150%, which increases liquidation risk during market volatility.'
      },
      {
        name: 'wallet_age',
        impact: 0.15,
        description: 'Wallet has been active for a moderate period',
        contribution: -5,
        details: 'Your wallet has been active for 6 months, which provides some history but not enough for maximum confidence.'
      },
      {
        name: 'repayment_history',
        impact: 0.15,
        description: 'Good history of repaying loans on time',
        contribution: -8,
        details: 'You have successfully repaid 3 previous loans, which positively affects your risk assessment.'
      },
      {
        name: 'cross_chain_activity',
        impact: 0.10,
        description: 'Limited activity across multiple chains',
        contribution: 3,
        details: 'More cross-chain activity between IOTA L1 and L2 would demonstrate broader blockchain usage and expertise.'
      }
    ]);
    
    setTimelineData(generateMockTimelineData());
    
    setFeatureImportance([
      { feature: 'transaction_history', importance: 0.35 },
      { feature: 'collateral_ratio', importance: 0.25 },
      { feature: 'wallet_age', importance: 0.15 },
      { feature: 'repayment_history', importance: 0.15 },
      { feature: 'cross_chain_activity', importance: 0.10 }
    ]);
  };
  
  // Handle tab change
  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };
  
  // Handle refresh
  const handleRefresh = async () => {
    if (refreshing) return;
    
    setRefreshing(true);
    try {
      const riskData = await apiService.getRiskAssessment(currentAccount);
      setRiskAssessment(riskData);
      
      // Update risk factors
      if (riskData && riskData.topFactors) {
        setRiskFactors(riskData.topFactors);
      }
      
      showSnackbar('Risk assessment updated successfully', 'success');
    } catch (error) {
      console.error('Error refreshing risk data:', error);
      showSnackbar('Failed to update risk assessment', 'error');
    } finally {
      setRefreshing(false);
    }
  };
  
  // If loading, show loading indicator
  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
        <CircularProgress />
      </Box>
    );
  }
  
  // If no risk assessment, show error
  if (!riskAssessment) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">
          Failed to load risk assessment data. Please try again later.
        </Alert>
        <Button variant="contained" onClick={handleRefresh} sx={{ mt: 2 }}>
          Retry
        </Button>
      </Box>
    );
  }
  
  return (
    <Container>
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h4" component="h1">
            Explainable AI Dashboard
          </Typography>
          <Tooltip title="Refresh risk assessment">
            <IconButton onClick={handleRefresh} disabled={refreshing}>
              {refreshing ? <CircularProgress size={24} /> : <Refresh />}
            </IconButton>
          </Tooltip>
        </Box>
        
        <Typography variant="body1" color="text.secondary" paragraph>
          Understand your risk profile through interactive visualizations, scenario analysis, and actionable recommendations.
        </Typography>
        
        <Paper elevation={2} sx={{ mb: 4, p: 3, borderRadius: 2 }}>
          <Grid container spacing={3} alignItems="center">
            <Grid item xs={12} md={4} sx={{ textAlign: { xs: 'center', md: 'left' } }}>
              <Typography variant="h6" gutterBottom>
                Your Risk Score
              </Typography>
              <Box sx={{ position: 'relative', display: 'inline-flex' }}>
                <CircularProgress
                  variant="determinate"
                  value={100}
                  size={120}
                  thickness={4}
                  sx={{ color: theme.palette.grey[200] }}
                />
                <CircularProgress
                  variant="determinate"
                  value={riskAssessment.riskScore}
                  size={120}
                  thickness={4}
                  sx={{ 
                    color: riskAssessment.riskScore <= 30 ? theme.palette.success.main :
                          riskAssessment.riskScore <= 60 ? theme.palette.warning.main :
                          theme.palette.error.main,
                    position: 'absolute',
                    left: 0,
                  }}
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
                  <Typography variant="h4" component="div" fontWeight="medium">
                    {riskAssessment.riskScore}
                  </Typography>
                </Box>
              </Box>
              <Typography 
                variant="body1" 
                sx={{ 
                  mt: 1,
                  color: riskAssessment.riskScore <= 30 ? theme.palette.success.main :
                         riskAssessment.riskScore <= 60 ? theme.palette.warning.main :
                         theme.palette.error.main
                }}
              >
                {riskAssessment.riskClass}
              </Typography>
            </Grid>
            
            <Grid item xs={12} md={8}>
              <Typography variant="h6" gutterBottom>
                Key Insights
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Paper variant="outlined" sx={{ p: 2, height: '100%' }}>
                    <Typography variant="subtitle2" color="text.secondary">
                      Top Positive Factor
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: 'medium' }}>
                      {riskFactors.find(f => f.contribution < 0)?.name.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') || 'None'}
                    </Typography>
                    <Typography variant="body2" color="success.main">
                      {riskFactors.find(f => f.contribution < 0)?.contribution} points
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Paper variant="outlined" sx={{ p: 2, height: '100%' }}>
                    <Typography variant="subtitle2" color="text.secondary">
                      Top Risk Factor
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: 'medium' }}>
                      {riskFactors.find(f => f.contribution > 0)?.name.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') || 'None'}
                    </Typography>
                    <Typography variant="body2" color="error.main">
                      +{riskFactors.find(f => f.contribution > 0)?.contribution} points
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Paper variant="outlined" sx={{ p: 2, height: '100%' }}>
                    <Typography variant="subtitle2" color="text.secondary">
                      AI Confidence
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: 'medium' }}>
                      {(riskAssessment.confidence * 100).toFixed(0)}%
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Based on data quality
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Paper variant="outlined" sx={{ p: 2, height: '100%' }}>
                    <Typography variant="subtitle2" color="text.secondary">
                      IOTA Integration
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: 'medium' }}>
                      {riskAssessment.dataQuality?.usedRealIotaData ? 'Active' : 'Limited'}
                    </Typography>
                    <Typography variant="body2" color={riskAssessment.dataQuality?.usedRealIotaData ? 'success.main' : 'warning.main'}>
                      {riskAssessment.dataQuality?.usedRealIotaData ? 'Using IOTA data' : 'Connect IOTA wallet'}
                    </Typography>
                  </Paper>
                </Grid>
              </Grid>
            </Grid>
          </Grid>
        </Paper>
        
        {/* Tabs for different sections */}
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={tabValue} onChange={handleTabChange} aria-label="AI dashboard tabs" variant="scrollable" scrollButtons="auto">
            <Tab icon={<Dashboard />} label="Factor Analysis" id="ai-dashboard-tab-0" aria-controls="ai-dashboard-tabpanel-0" />
            <Tab icon={<CompareArrows />} label="Scenario Analysis" id="ai-dashboard-tab-1" aria-controls="ai-dashboard-tabpanel-1" />
            <Tab icon={<Science />} label="What-If Simulator" id="ai-dashboard-tab-2" aria-controls="ai-dashboard-tabpanel-2" />
            <Tab icon={<Lightbulb />} label="Recommendations" id="ai-dashboard-tab-3" aria-controls="ai-dashboard-tabpanel-3" />
          </Tabs>
        </Box>
        
        {/* Factor Analysis Tab */}
        <TabPanel value={tabValue} index={0}>
          <Alert severity="info" sx={{ mb: 3 }}>
            <Typography variant="body2">
              This visualization shows how each factor contributes to your risk score. Explore the charts to understand your risk profile in detail.
            </Typography>
          </Alert>
          
          <Grid container spacing={4}>
            <Grid item xs={12} lg={6}>
              <Paper elevation={2} sx={{ p: 2, height: '100%' }}>
                <Typography variant="h6" gutterBottom>
                  Risk Factor Contributions
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  See how each factor contributes to your overall risk score.
                </Typography>
                <RiskFactorBreakdownChart 
                  factors={riskFactors} 
                  height={300} 
                />
              </Paper>
            </Grid>
            
            <Grid item xs={12} lg={6}>
              <Paper elevation={2} sx={{ p: 2, height: '100%' }}>
                <Typography variant="h6" gutterBottom>
                  Risk Score Timeline
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Track how your risk score has changed over time.
                </Typography>
                <RiskTimelineChart 
                  data={timelineData} 
                  height={300} 
                />
              </Paper>
            </Grid>
            
            <Grid item xs={12} lg={6}>
              <Paper elevation={2} sx={{ p: 2, height: '100%' }}>
                <Typography variant="h6" gutterBottom>
                  Risk Factor Comparison
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Compare your risk factors to optimal values.
                </Typography>
                <RiskComparisonRadar 
                  factors={riskFactors} 
                  height={300} 
                />
              </Paper>
            </Grid>
            
            <Grid item xs={12} lg={6}>
              <Paper elevation={2} sx={{ p: 2, height: '100%' }}>
                <Typography variant="h6" gutterBottom>
                  Factor Impact Heatmap
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Visualize the impact of different factors on your risk score.
                </Typography>
                <FactorImpactHeatmap 
                  factors={riskFactors} 
                  height={300} 
                />
              </Paper>
            </Grid>
          </Grid>
        </TabPanel>
        
        {/* Scenario Analysis Tab */}
        <TabPanel value={tabValue} index={1}>
          <Alert severity="info" sx={{ mb: 3 }}>
            <Typography variant="body2">
              Compare different scenarios to understand how they affect your risk profile. This helps you make informed decisions about your borrowing and lending strategy.
            </Typography>
          </Alert>
          
          <ScenarioAnalysisTool 
            currentRiskScore={riskAssessment.riskScore} 
            riskFactors={riskFactors} 
            address={currentAccount} 
          />
        </TabPanel>
        
        {/* What-If Simulator Tab */}
        <TabPanel value={tabValue} index={2}>
          <Alert severity="info" sx={{ mb: 3 }}>
            <Typography variant="body2">
              Test different borrowing strategies to see how they would affect your risk score and collateral requirements. This simulator helps you optimize your lending and borrowing activities.
            </Typography>
          </Alert>
          
          <BorrowingStrategySimulator 
            currentRiskScore={riskAssessment.riskScore} 
            address={currentAccount} 
          />
        </TabPanel>
        
        {/* Recommendations Tab */}
        <TabPanel value={tabValue} index={3}>
          <Alert severity="info" sx={{ mb: 3 }}>
            <Typography variant="body2">
              Based on your risk assessment, here are personalized recommendations to improve your risk profile and optimize your borrowing strategy.
            </Typography>
          </Alert>
          
          <ActionableInsightsPanel 
            recommendations={riskAssessment.recommendations} 
            riskFactors={riskFactors} 
            riskScore={riskAssessment.riskScore} 
          />
        </TabPanel>
      </Box>
    </Container>
  );
};

export default ExplainableAIDashboard;
