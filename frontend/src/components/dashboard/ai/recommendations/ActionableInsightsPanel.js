import React, { useState } from 'react';
import {
  Box,
  Grid,
  Paper,
  Typography,
  Button,
  Card,
  CardContent,
  CardActions,
  Divider,
  Chip,
  Stack,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Link,
  Collapse,
  IconButton,
  Alert,
  useTheme
} from '@mui/material';
import {
  Lightbulb,
  TrendingUp,
  TrendingDown,
  CheckCircle,
  ArrowForward,
  ExpandMore,
  ExpandLess,
  Info,
  PriorityHigh,
  Done,
  Star
} from '@mui/icons-material';
import { Link as RouterLink } from 'react-router-dom';

const ActionableInsightsPanel = ({ recommendations = [], riskFactors = [], riskScore = 50 }) => {
  const theme = useTheme();
  const [expandedRecommendation, setExpandedRecommendation] = useState(null);
  
  // Get risk category based on score
  const getRiskCategory = (score) => {
    if (score <= 30) return { text: 'Low Risk', color: 'success' };
    if (score <= 60) return { text: 'Medium Risk', color: 'warning' };
    return { text: 'High Risk', color: 'error' };
  };
  
  // Toggle recommendation expansion
  const toggleRecommendation = (index) => {
    if (expandedRecommendation === index) {
      setExpandedRecommendation(null);
    } else {
      setExpandedRecommendation(index);
    }
  };
  
  // Get icon based on impact
  const getImpactIcon = (impact) => {
    switch (impact) {
      case 'high':
        return <PriorityHigh color="error" />;
      case 'medium':
        return <Info color="warning" />;
      case 'low':
        return <Info color="info" />;
      case 'positive':
        return <Star color="success" />;
      default:
        return <Info />;
    }
  };
  
  // Get color based on impact
  const getImpactColor = (impact) => {
    switch (impact) {
      case 'high':
        return 'error';
      case 'medium':
        return 'warning';
      case 'low':
        return 'info';
      case 'positive':
        return 'success';
      default:
        return 'primary';
    }
  };
  
  // Get path based on recommendation type
  const getActionPath = (type) => {
    switch (type) {
      case 'verification':
        return '/identity';
      case 'collateral':
        return '/deposit';
      case 'network':
        return '/transactions';
      case 'yield':
        return '/portfolio';
      case 'strategy':
        return '/dashboard';
      default:
        return '/dashboard';
    }
  };
  
  // Generate steps for a recommendation
  const generateSteps = (recommendation) => {
    // Define steps based on recommendation type
    switch (recommendation.type) {
      case 'verification':
        return [
          {
            label: 'Go to Identity Verification',
            description: 'Navigate to the Identity page to start the verification process.',
            path: '/identity'
          },
          {
            label: 'Connect IOTA Wallet',
            description: 'Connect your IOTA wallet to enable secure identity verification.',
            path: '/wallet'
          },
          {
            label: 'Complete Verification Process',
            description: 'Follow the steps to verify your identity using IOTA\'s decentralized identity framework.',
            path: null
          }
        ];
      case 'collateral':
        return [
          {
            label: 'Assess Collateral Needs',
            description: 'Use the What-if Simulator to determine optimal collateral amount.',
            path: null
          },
          {
            label: 'Deposit Additional Collateral',
            description: 'Go to the Deposit page to add more collateral to your position.',
            path: '/deposit'
          },
          {
            label: 'Confirm New Health Factor',
            description: 'Check your updated risk score and health factor after increasing collateral.',
            path: '/dashboard'
          }
        ];
      case 'network':
        return [
          {
            label: 'Connect IOTA Wallet',
            description: 'Set up and connect your IOTA wallet if you haven\'t already.',
            path: '/wallet'
          },
          {
            label: 'Transfer Assets to IOTA',
            description: 'Use the bridge to transfer assets to the IOTA network.',
            path: '/bridge'
          },
          {
            label: 'Conduct Regular Transactions',
            description: 'Perform regular transactions on the IOTA network to build your on-chain reputation.',
            path: null
          }
        ];
      case 'yield':
        return [
          {
            label: 'Review Current Strategy',
            description: 'Examine your current yield strategy and performance.',
            path: '/portfolio'
          },
          {
            label: 'Switch to Recommended Strategy',
            description: 'Adjust your positions based on the optimized strategy.',
            path: null
          },
          {
            label: 'Monitor Performance',
            description: 'Regularly check your new yield performance and make adjustments as needed.',
            path: '/dashboard'
          }
        ];
      case 'strategy':
        return [
          {
            label: 'Analyze Current Position',
            description: 'Review your current borrowing and lending positions.',
            path: '/dashboard'
          },
          {
            label: 'Diversify Collateral',
            description: 'Add different asset types to your collateral portfolio.',
            path: '/deposit'
          },
          {
            label: 'Balance Risk Exposure',
            description: 'Ensure no single asset represents more than 50% of your collateral.',
            path: null
          }
        ];
      default:
        return [
          {
            label: 'Review Recommendation',
            description: 'Understand the details of this recommendation.',
            path: null
          },
          {
            label: 'Take Action',
            description: 'Follow the specific steps to implement this recommendation.',
            path: null
          }
        ];
    }
  };
  
  return (
    <Box>
      {/* Overall risk assessment summary */}
      <Paper elevation={3} sx={{ p: 3, mb: 4, borderRadius: 2 }}>
        <Grid container spacing={3} alignItems="center">
          <Grid item xs={12} md={8}>
            <Typography variant="h6" gutterBottom>
              Your Risk Assessment Summary
            </Typography>
            <Typography variant="body1" paragraph>
              Based on our AI analysis, your lending profile is currently rated as{' '}
              <Box component="span" sx={{ fontWeight: 'bold', color: theme.palette[getRiskCategory(riskScore).color].main }}>
                {getRiskCategory(riskScore).text} ({riskScore} points)
              </Box>
              . We've identified {recommendations.length} actionable recommendations that can improve your risk profile.
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Implementing these recommendations could potentially reduce your risk score by{' '}
              <Box component="span" sx={{ fontWeight: 'bold' }}>
                {recommendations.reduce((sum, rec) => {
                  // Estimate points reduction based on impact
                  const pointsMap = { high: 15, medium: 10, low: 5, positive: 5 };
                  return sum + (pointsMap[rec.impact] || 0);
                }, 0)} points
              </Box>{' '}
              and improve your borrowing terms.
            </Typography>
          </Grid>
          <Grid item xs={12} md={4} sx={{ textAlign: 'center' }}>
            <Box sx={{ 
              display: 'inline-flex',
              position: 'relative',
              backgroundColor: theme.palette.grey[100],
              borderRadius: '50%',
              p: 2
            }}>
              <Box sx={{ position: 'relative', display: 'inline-flex' }}>
                <Box
                  sx={{
                    width: 100,
                    height: 100,
                    borderRadius: '50%',
                    backgroundColor: theme.palette.grey[200],
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: theme.shadows[2]
                  }}
                >
                  <Typography variant="h3" component="div" fontWeight="medium" color={theme.palette[getRiskCategory(riskScore).color].main}>
                    {riskScore}
                  </Typography>
                </Box>
                <Box
                  sx={{
                    position: 'absolute',
                    top: '-16px',
                    right: '-16px',
                    backgroundColor: theme.palette.background.paper,
                    borderRadius: '50%',
                    p: 0.5,
                    boxShadow: theme.shadows[2]
                  }}
                >
                  {riskScore <= 30 ? (
                    <CheckCircle color="success" fontSize="large" />
                  ) : riskScore <= 60 ? (
                    <Info color="warning" fontSize="large" />
                  ) : (
                    <PriorityHigh color="error" fontSize="large" />
                  )}
                </Box>
              </Box>
            </Box>
          </Grid>
        </Grid>
      </Paper>
      
      {/* Key recommendations */}
      <Typography variant="h6" gutterBottom>
        Personalized Recommendations
      </Typography>
      
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {recommendations.length > 0 ? (
          recommendations.map((recommendation, index) => (
            <Grid item xs={12} key={index}>
              <Card variant={index === 0 ? 'outlined' : 'outlined'} sx={{ 
                borderColor: index === 0 ? theme.palette[getImpactColor(recommendation.impact)].main : 'inherit',
                boxShadow: index === 0 ? `0 0 8px ${theme.palette[getImpactColor(recommendation.impact)].main}` : 'none',
                position: 'relative',
                overflow: 'visible'
              }}>
                {index === 0 && (
                  <Box sx={{ 
                    position: 'absolute', 
                    top: -12, 
                    left: 16, 
                    bgcolor: theme.palette.background.paper,
                    color: theme.palette[getImpactColor(recommendation.impact)].main,
                    px: 1,
                    borderRadius: 1,
                    border: `1px solid ${theme.palette[getImpactColor(recommendation.impact)].main}`,
                    fontSize: '0.75rem',
                    fontWeight: 'bold'
                  }}>
                    TOP PRIORITY
                  </Box>
                )}
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 1 }}>
                    <Box sx={{ mr: 1.5, mt: 0.5 }}>
                      {getImpactIcon(recommendation.impact)}
                    </Box>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="h6" gutterBottom>
                        {recommendation.title}
                      </Typography>
                      <Typography variant="body1" paragraph>
                        {recommendation.description}
                      </Typography>
                      
                      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 1 }}>
                        <Chip
                          label={`${recommendation.impact === 'high' ? 'High' : recommendation.impact === 'medium' ? 'Medium' : recommendation.impact === 'low' ? 'Low' : 'Positive'} Impact`}
                          color={getImpactColor(recommendation.impact)}
                          size="small"
                        />
                        <Chip
                          label={recommendation.type === 'verification' ? 'Identity' : 
                                 recommendation.type === 'collateral' ? 'Collateral' :
                                 recommendation.type === 'network' ? 'Network' :
                                 recommendation.type === 'yield' ? 'Yield' :
                                 recommendation.type === 'strategy' ? 'Strategy' : 'General'}
                          size="small"
                          variant="outlined"
                        />
                      </Stack>
                      
                      {recommendation.details && (
                        <Collapse in={expandedRecommendation === index}>
                          <Box sx={{ mt: 2, mb: 2 }}>
                            <Typography variant="subtitle2" gutterBottom>
                              How This Improves Your Risk Profile
                            </Typography>
                            <Typography variant="body2" paragraph>
                              {recommendation.details}
                            </Typography>
                            
                            <Typography variant="subtitle2" gutterBottom>
                              Step-by-Step Implementation
                            </Typography>
                            <Stepper orientation="vertical" sx={{ mt: 2 }}>
                              {generateSteps(recommendation).map((step, stepIndex) => (
                                <Step key={stepIndex} active completed={false}>
                                  <StepLabel>{step.label}</StepLabel>
                                  <StepContent>
                                    <Typography variant="body2">{step.description}</Typography>
                                    {step.path && (
                                      <Box sx={{ mt: 1 }}>
                                        <Button 
                                          variant="outlined" 
                                          size="small" 
                                          component={RouterLink} 
                                          to={step.path}
                                          endIcon={<ArrowForward />}
                                        >
                                          Go to {step.path.substring(1)}
                                        </Button>
                                      </Box>
                                    )}
                                  </StepContent>
                                </Step>
                              ))}
                            </Stepper>
                          </Box>
                        </Collapse>
                      )}
                    </Box>
                  </Box>
                </CardContent>
                
                <Divider />
                
                <CardActions sx={{ justifyContent: 'space-between' }}>
                  <Button
                    startIcon={expandedRecommendation === index ? <ExpandLess /> : <ExpandMore />}
                    onClick={() => toggleRecommendation(index)}
                    size="small"
                  >
                    {expandedRecommendation === index ? 'Show Less' : 'Show Details'}
                  </Button>
                  
                  <Button
                    variant="contained"
                    color={getImpactColor(recommendation.impact)}
                    size="small"
                    component={RouterLink}
                    to={getActionPath(recommendation.type)}
                    endIcon={<ArrowForward />}
                  >
                    Take Action
                  </Button>
                </CardActions>
              </Card>
            </Grid>
          ))
        ) : (
          <Grid item xs={12}>
            <Alert severity="success" icon={<CheckCircle />} sx={{ mb: 2 }}>
              <Typography variant="subtitle1">
                No Recommendations Needed
              </Typography>
              <Typography variant="body2">
                Your risk profile is optimized! Continue maintaining your current practices.
              </Typography>
            </Alert>
          </Grid>
        )}
      </Grid>
      
      {/* Risk improvement potential */}
      <Paper elevation={3} sx={{ p: 3, borderRadius: 2, mb: 4 }}>
        <Typography variant="h6" gutterBottom>
          Risk Improvement Potential
        </Typography>
        
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card variant="outlined" sx={{ height: '100%' }}>
              <CardContent>
                <Typography variant="subtitle1" gutterBottom>
                  Current Risk Factors
                </Typography>
                <Box sx={{ mb: 1 }}>
                  {riskFactors.filter(f => f.contribution > 0).slice(0, 3).map((factor, index) => (
                    <Box key={index} sx={{ mb: 1 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="body2">
                          {factor.name.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                        </Typography>
                        <Chip
                          label={`+${factor.contribution} pts`}
                          size="small"
                          color="error"
                          icon={<TrendingUp fontSize="small" />}
                        />
                      </Box>
                      <Typography variant="caption" color="text.secondary">
                        {factor.description}
                      </Typography>
                    </Box>
                  ))}
                  
                  {riskFactors.filter(f => f.contribution > 0).length === 0 && (
                    <Typography variant="body2" color="text.secondary">
                      No negative risk factors identified.
                    </Typography>
                  )}
                </Box>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <Card variant="outlined" sx={{ height: '100%' }}>
              <CardContent>
                <Typography variant="subtitle1" gutterBottom>
                  Improvement Potential
                </Typography>
                <Alert severity="info" sx={{ mb: 2 }}>
                  <Typography variant="body2">
                    Implementing all recommendations could lower your risk score to approximately{' '}
                    <Box component="span" sx={{ fontWeight: 'bold' }}>
                      {Math.max(0, riskScore - recommendations.reduce((sum, rec) => {
                        // Estimate points reduction based on impact
                        const pointsMap = { high: 15, medium: 10, low: 5, positive: 5 };
                        return sum + (pointsMap[rec.impact] || 0);
                      }, 0))}
                    </Box>
                  </Typography>
                </Alert>
                
                <Box sx={{ mt: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Expected Benefits:
                  </Typography>
                  <Stack spacing={1}>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <Done color="success" fontSize="small" sx={{ mr: 1 }} />
                      <Typography variant="body2">
                        Lower interest rates on borrowing
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <Done color="success" fontSize="small" sx={{ mr: 1 }} />
                      <Typography variant="body2">
                        Increased borrowing capacity
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <Done color="success" fontSize="small" sx={{ mr: 1 }} />
                      <Typography variant="body2">
                        Reduced liquidation risk
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <Done color="success" fontSize="small" sx={{ mr: 1 }} />
                      <Typography variant="body2">
                        Enhanced protocol benefits
                      </Typography>
                    </Box>
                  </Stack>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Paper>
      
      {/* IOTA specific recommendations */}
      <Typography variant="h6" gutterBottom>
        IOTA Ecosystem Integration
      </Typography>
      
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card variant="outlined">
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'flex-start' }}>
                <Lightbulb color="primary" sx={{ mr: 1.5, mt: 0.5 }} />
                <Box>
                  <Typography variant="subtitle1" gutterBottom>
                    Leverage IOTA Identity Verification
                  </Typography>
                  <Typography variant="body2" paragraph>
                    IOTA's decentralized identity framework offers secure, privacy-preserving verification that can significantly improve your borrowing terms.
                  </Typography>
                  <Button
                    variant="outlined"
                    size="small"
                    component={RouterLink}
                    to="/identity"
                    endIcon={<ArrowForward />}
                  >
                    Explore Identity Verification
                  </Button>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} md={6}>
          <Card variant="outlined">
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'flex-start' }}>
                <Lightbulb color="primary" sx={{ mr: 1.5, mt: 0.5 }} />
                <Box>
                  <Typography variant="subtitle1" gutterBottom>
                    Utilize Cross-Layer Activities
                  </Typography>
                  <Typography variant="body2" paragraph>
                    Moving assets between IOTA's L1 (Move) and L2 (EVM) demonstrates blockchain expertise and can positively impact your risk assessment.
                  </Typography>
                  <Button
                    variant="outlined"
                    size="small"
                    component={RouterLink}
                    to="/cross-layer"
                    endIcon={<ArrowForward />}
                  >
                    Explore Cross-Layer Features
                  </Button>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default ActionableInsightsPanel;
