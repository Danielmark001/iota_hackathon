import React, { useState, useEffect } from 'react';
import {
  Container,
  Grid,
  Typography,
  Box,
  Paper,
  Button,
  Divider,
  Chip,
  CircularProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Card,
  CardContent,
  Alert,
  LinearProgress,
  IconButton,
  Tooltip,
  useTheme,
} from '@mui/material';
import {
  Assessment,
  TrendingUp,
  TrendingDown,
  History,
  AccountBalance,
  SecurityUpdateGood,
  Analytics,
  InsertChart,
  Refresh,
  Info,
  Check,
  Close,
  Error,
  Psychology,
  SwapHoriz,
  CalendarToday,
  ArrowForward,
} from '@mui/icons-material';
import { Link as RouterLink } from 'react-router-dom';

// Components
import LoadingBackdrop from '../components/ui/LoadingBackdrop';

// Contexts
import { useWeb3 } from '../context/Web3Context';
import { useSnackbar } from '../context/SnackbarContext';

// Services
import apiService from '../services/apiService';

// Helper to get color based on risk score
const getRiskColor = (score) => {
  if (score <= 30) return 'success';
  if (score <= 60) return 'warning';
  return 'error';
};

// Helper to get text based on risk score
const getRiskText = (score) => {
  if (score <= 30) return 'Low Risk';
  if (score <= 60) return 'Medium Risk';
  return 'High Risk';
};

const RiskAssessmentPage = () => {
  const theme = useTheme();
  const { currentAccount } = useWeb3();
  const { showSnackbar } = useSnackbar();
  
  // Component state
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [riskAssessment, setRiskAssessment] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  
  // Load risk assessment data
  useEffect(() => {
    const loadRiskData = async () => {
      if (!currentAccount) return;
      
      setLoading(true);
      try {
        // Fetch user profile and risk assessment in parallel
        const [profileData, riskData] = await Promise.all([
          apiService.getUserProfile(currentAccount),
          apiService.getRiskAssessment(currentAccount)
        ]);
        
        setUserProfile(profileData);
        setRiskAssessment(riskData);
      } catch (error) {
        console.error('Error loading risk assessment data:', error);
        showSnackbar('Failed to load risk assessment data', 'error');
        
        // Set mock data for demo purposes
        setRiskAssessment({
          address: currentAccount,
          riskScore: 45,
          confidence: 0.85,
          recommendations: [
            {
              title: 'Verify Your Identity',
              description: 'Complete identity verification to reduce your risk score by up to 15 points.',
              impact: 'high'
            },
            {
              title: 'Increase Collateral Ratio',
              description: 'Your current health factor is lower than optimal. Consider adding more collateral.',
              impact: 'medium'
            }
          ],
          topFactors: [
            {
              name: 'transaction_history',
              impact: 0.35,
              description: 'Consistent transaction history shows reliable behavior',
              contribution: -10
            },
            {
              name: 'collateral_ratio',
              impact: 0.25,
              description: 'Current collateral ratio is below optimal levels',
              contribution: 15
            },
            {
              name: 'wallet_age',
              impact: 0.15,
              description: 'Wallet has been active for a moderate period',
              contribution: -5
            },
            {
              name: 'repayment_history',
              impact: 0.15,
              description: 'Good history of repaying loans on time',
              contribution: -8
            },
            {
              name: 'cross_chain_activity',
              impact: 0.10,
              description: 'Limited activity across multiple chains',
              contribution: 3
            }
          ],
          analysisTimestamp: Date.now()
        });
        
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
      } finally {
        setLoading(false);
      }
    };
    
    loadRiskData();
  }, [currentAccount, showSnackbar]);
  
  // Handle refresh
  const handleRefresh = async () => {
    if (refreshing) return;
    
    setRefreshing(true);
    try {
      const riskData = await apiService.getRiskAssessment(currentAccount);
      setRiskAssessment(riskData);
      showSnackbar('Risk assessment updated successfully', 'success');
    } catch (error) {
      console.error('Error refreshing risk data:', error);
      showSnackbar('Failed to update risk assessment', 'error');
    } finally {
      setRefreshing(false);
    }
  };
  
  // Format timestamp
  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleString();
  };
  
  // Get sign for factor contribution
  const getContributionSign = (value) => {
    return value < 0 ? '-' : '+';
  };
  
  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <LoadingBackdrop open={loading} message="Analyzing your risk profile..." />
      
      {/* Page header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          AI Risk Assessment
        </Typography>
        <Tooltip title="Refresh risk assessment">
          <IconButton onClick={handleRefresh} disabled={refreshing || loading}>
            {refreshing ? <CircularProgress size={24} /> : <Refresh />}
          </IconButton>
        </Tooltip>
      </Box>
      
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        View your personalized risk assessment powered by AI analysis of on-chain activity.
      </Typography>
      
      {/* Main content */}
      <Grid container spacing={4}>
        {/* Left column - Risk score and info */}
        <Grid item xs={12} md={7}>
          {/* Risk score card */}
          <Paper elevation={2} sx={{ p: 3, borderRadius: 2, mb: 4 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
              <Typography variant="h5" gutterBottom>
                Risk Score
              </Typography>
              <Chip
                label={riskAssessment ? formatTimestamp(riskAssessment.analysisTimestamp) : 'Loading...'}
                size="small"
                icon={<CalendarToday fontSize="small" />}
                variant="outlined"
              />
            </Box>
            
            {riskAssessment && (
              <>
                {/* Visual risk score */}
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', my: 3 }}>
                  <Box sx={{ position: 'relative', display: 'inline-flex' }}>
                    <CircularProgress
                      variant="determinate"
                      value={100}
                      size={180}
                      thickness={4}
                      sx={{ color: (theme) => theme.palette.grey[200] }}
                    />
                    <CircularProgress
                      variant="determinate"
                      value={riskAssessment.riskScore}
                      size={180}
                      thickness={4}
                      sx={{ 
                        color: (theme) => theme.palette[getRiskColor(riskAssessment.riskScore)].main,
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
                      <Box sx={{ textAlign: 'center' }}>
                        <Typography variant="h3" component="div" fontWeight="medium" color={getRiskColor(riskAssessment.riskScore)}>
                          {riskAssessment.riskScore}
                        </Typography>
                        <Typography variant="body1" color="text.secondary">
                          {getRiskText(riskAssessment.riskScore)}
                        </Typography>
                      </Box>
                    </Box>
                  </Box>
                </Box>
                
                {/* Confidence and details */}
                <Box sx={{ textAlign: 'center', mb: 3 }}>
                  <Typography variant="body2" color="text.secondary">
                    AI Confidence Level: {(riskAssessment.confidence * 100).toFixed(0)}%
                  </Typography>
                  <LinearProgress
                    variant="determinate"
                    value={riskAssessment.confidence * 100}
                    sx={{ mt: 1, height: 6, borderRadius: 3 }}
                  />
                </Box>
                
                {/* Info about the score */}
                <Alert severity="info" sx={{ mb: 3 }}>
                  <Typography variant="body2">
                    Your risk score determines your interest rates and borrowing limits. A lower score means better terms.
                  </Typography>
                </Alert>
                
                {/* Risk scale */}
                <Box sx={{ mt: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Risk Scale
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Box sx={{ flex: 1 }}>
                      <LinearProgress
                        variant="determinate"
                        value={100}
                        sx={{ 
                          height: 8, 
                          borderRadius: 4, 
                          background: `linear-gradient(to right, ${theme.palette.success.main}, ${theme.palette.warning.main}, ${theme.palette.error.main})` 
                        }}
                      />
                    </Box>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
                    <Typography variant="caption" color="success.main">Low Risk (0-30)</Typography>
                    <Typography variant="caption" color="warning.main">Medium Risk (31-60)</Typography>
                    <Typography variant="caption" color="error.main">High Risk (61-100)</Typography>
                  </Box>
                </Box>
              </>
            )}
          </Paper>
          
          {/* Top contributing factors */}
          <Paper elevation={2} sx={{ p: 3, borderRadius: 2 }}>
            <Typography variant="h5" gutterBottom>
              Contributing Factors
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              The AI model analyzed these key factors to determine your risk score:
            </Typography>
            
            {riskAssessment && riskAssessment.topFactors ? (
              <List>
                {riskAssessment.topFactors.map((factor, index) => (
                  <React.Fragment key={index}>
                    <ListItem alignItems="flex-start">
                      <ListItemIcon>
                        {factor.contribution < 0 ? (
                          <TrendingDown color="success" />
                        ) : (
                          <TrendingUp color="error" />
                        )}
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <Typography variant="subtitle1">
                              {factor.name.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                            </Typography>
                            <Chip
                              label={`${getContributionSign(factor.contribution)}${Math.abs(factor.contribution)} points`}
                              size="small"
                              color={factor.contribution < 0 ? 'success' : 'error'}
                            />
                          </Box>
                        }
                        secondary={
                          <Box sx={{ mt: 1 }}>
                            <Typography variant="body2" color="text.secondary" paragraph>
                              {factor.description}
                            </Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                              <Typography variant="caption" color="text.secondary" sx={{ mr: 1 }}>
                                Impact:
                              </Typography>
                              <LinearProgress
                                variant="determinate"
                                value={factor.impact * 100}
                                sx={{ 
                                  height: 6, 
                                  borderRadius: 3, 
                                  width: 100,
                                  mr: 1
                                }}
                              />
                              <Typography variant="caption" color="text.secondary">
                                {(factor.impact * 100).toFixed(0)}%
                              </Typography>
                            </Box>
                          </Box>
                        }
                      />
                    </ListItem>
                    {index < riskAssessment.topFactors.length - 1 && <Divider variant="inset" />}
                  </React.Fragment>
                ))}
              </List>
            ) : (
              <Box sx={{ py: 3, textAlign: 'center' }}>
                <CircularProgress />
              </Box>
            )}
          </Paper>
        </Grid>
        
        {/* Right column - Recommendations and actions */}
        <Grid item xs={12} md={5}>
          {/* Recommendations */}
          <Paper elevation={2} sx={{ p: 3, borderRadius: 2, mb: 4 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <Psychology color="primary" sx={{ mr: 1 }} />
              <Typography variant="h5">
                AI Recommendations
              </Typography>
            </Box>
            <Divider sx={{ mb: 3 }} />
            
            {riskAssessment && riskAssessment.recommendations ? (
              riskAssessment.recommendations.length > 0 ? (
                <List>
                  {riskAssessment.recommendations.map((rec, index) => (
                    <React.Fragment key={index}>
                      <Card sx={{ mb: 2, bgcolor: 'background.default' }}>
                        <CardContent>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                            <Typography variant="subtitle1" fontWeight="medium">
                              {rec.title}
                            </Typography>
                            <Chip
                              label={rec.impact}
                              size="small"
                              color={
                                rec.impact === 'high' ? 'error' :
                                rec.impact === 'medium' ? 'warning' : 'success'
                              }
                            />
                          </Box>
                          <Typography variant="body2" color="text.secondary" paragraph>
                            {rec.description}
                          </Typography>
                          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                            <Button 
                              variant="outlined" 
                              size="small"
                              endIcon={<ArrowForward />}
                              component={RouterLink}
                              to={
                                rec.title.toLowerCase().includes('identity') ? '/identity' :
                                rec.title.toLowerCase().includes('collateral') ? '/deposit' : '/dashboard'
                              }
                            >
                              Take Action
                            </Button>
                          </Box>
                        </CardContent>
                      </Card>
                      {index < riskAssessment.recommendations.length - 1 && <Box sx={{ my: 1 }} />}
                    </React.Fragment>
                  ))}
                </List>
              ) : (
                <Box sx={{ textAlign: 'center', py: 3 }}>
                  <Check color="success" sx={{ fontSize: 48, mb: 2 }} />
                  <Typography variant="h6">
                    No Recommendations
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Great job! Your profile looks good. Continue maintaining good lending practices.
                  </Typography>
                </Box>
              )
            ) : (
              <Box sx={{ py: 3, textAlign: 'center' }}>
                <CircularProgress />
              </Box>
            )}
          </Paper>
          
          {/* Identity verification status */}
          <Paper elevation={2} sx={{ p: 3, borderRadius: 2, mb: 4 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <SecurityUpdateGood color="primary" sx={{ mr: 1 }} />
              <Typography variant="h5">
                Identity Verification
              </Typography>
            </Box>
            <Divider sx={{ mb: 3 }} />
            
            <Box sx={{ textAlign: 'center', py: 2 }}>
              {userProfile && userProfile.identityVerified ? (
                <>
                  <Check color="success" sx={{ fontSize: 48, mb: 1 }} />
                  <Typography variant="h6" color="success.main">
                    Verified
                  </Typography>
                  <Typography variant="body2" color="text.secondary" paragraph>
                    Your identity has been verified. This positively affects your risk score.
                  </Typography>
                  <Chip 
                    label="-15 risk points" 
                    color="success" 
                    variant="outlined" 
                    sx={{ mt: 1 }}
                  />
                </>
              ) : (
                <>
                  <Close color="error" sx={{ fontSize: 48, mb: 1 }} />
                  <Typography variant="h6" color="error.main">
                    Not Verified
                  </Typography>
                  <Typography variant="body2" color="text.secondary" paragraph>
                    Verifying your identity can significantly reduce your risk score and improve borrowing terms.
                  </Typography>
                  <Button
                    variant="contained"
                    color="primary"
                    component={RouterLink}
                    to="/identity"
                    endIcon={<ArrowForward />}
                    sx={{ mt: 1 }}
                  >
                    Verify Now
                  </Button>
                </>
              )}
            </Box>
          </Paper>
          
          {/* Actions */}
          <Paper elevation={2} sx={{ p: 3, borderRadius: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <SwapHoriz color="primary" sx={{ mr: 1 }} />
              <Typography variant="h5">
                Actions
              </Typography>
            </Box>
            <Divider sx={{ mb: 3 }} />
            
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <Button
                  variant="outlined"
                  fullWidth
                  component={RouterLink}
                  to="/deposit"
                  startIcon={<AccountBalance />}
                  sx={{ py: 1 }}
                >
                  Deposit
                </Button>
              </Grid>
              <Grid item xs={6}>
                <Button
                  variant="outlined"
                  fullWidth
                  component={RouterLink}
                  to="/identity"
                  startIcon={<SecurityUpdateGood />}
                  sx={{ py: 1 }}
                >
                  Verify Identity
                </Button>
              </Grid>
              <Grid item xs={6}>
                <Button
                  variant="outlined"
                  fullWidth
                  component={RouterLink}
                  to="/ai-dashboard"
                  startIcon={<Analytics />}
                  sx={{ py: 1 }}
                >
                  AI Dashboard
                </Button>
              </Grid>
              <Grid item xs={6}>
                <Button
                  variant="outlined"
                  fullWidth
                  startIcon={<History />}
                  sx={{ py: 1 }}
                  onClick={handleRefresh}
                  disabled={refreshing}
                >
                  Refresh Score
                </Button>
              </Grid>
            </Grid>
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
};

export default RiskAssessmentPage;
